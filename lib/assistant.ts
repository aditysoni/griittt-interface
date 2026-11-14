// ── Ask GRITTT: the assistant's model layer ─────────────────────────────────────
// Everything behind the chat sheet that isn't UI: the predefined questions, the
// per-user context we are willing to send, and the routing of each question to
// one of three sources —
//   • 'log'   : a rule-based answer computed on-device from the user's own records
//               (always labelled as "from your log", never presented as AI);
//   • 'ai'    : one of the AI endpoints the backend already exposes;
//   • 'chat'  : the open-ended /ai/chat endpoint. The server does not implement
//               this yet, so today it surfaces as an honest "unavailable" reply.
// No text is ever invented on behalf of the AI: when a source fails or returns
// nothing, the reply is a typed failure the UI renders as such.

import { ai, fuel, habits, shiftDate, type FoodLog, type Task } from './api';
import {
  DayHabit, DaySummary, NextStep, formatLongDate, formatShortDate, habitDayState, isScheduledOn,
  openHabits, pickNextStep, scheduleText, summarizeDay, summaryHeadline,
} from './today';
import type { CheckIn } from './storage';

// ── Screens and suggestions ────────────────────────────────────────────────────

export type AssistantScreen = 'today' | 'habits' | 'progress' | 'food' | 'reflection';

export type Suggestion = { id: string; group: AssistantScreen; text: string };

export const SUGGESTIONS: Suggestion[] = [
  { id: 'today.focus',      group: 'today',      text: 'What should I focus on today?' },
  { id: 'today.step',       group: 'today',      text: "What's one small step I can take now?" },
  { id: 'today.busy',       group: 'today',      text: 'Help me plan a busy day.' },

  { id: 'habits.next',      group: 'habits',     text: 'Which habit should I work on next?' },
  { id: 'habits.easier',    group: 'habits',     text: 'Help me make this habit easier.' },
  { id: 'habits.restart',   group: 'habits',     text: 'I missed a few days. Help me restart.' },

  { id: 'progress.week',    group: 'progress',   text: 'How am I doing this week?' },
  { id: 'progress.compare', group: 'progress',   text: 'What improved compared with last week?' },
  { id: 'progress.patterns',group: 'progress',   text: 'What patterns can you see in my logs?' },

  { id: 'food.summary',     group: 'food',       text: 'Summarize my food check-ins.' },
  { id: 'food.easier',      group: 'food',       text: 'Help me make food logging easier.' },

  { id: 'reflect.well',     group: 'reflection', text: 'What went well this week?' },
  { id: 'reflect.goals',    group: 'reflection', text: 'How do my actions connect with my goals?' },
  { id: 'reflect.change',   group: 'reflection', text: 'Help me choose one change for next week.' },
];

export const GROUP_LABEL: Record<AssistantScreen, string> = {
  today: 'Today', habits: 'Habits', progress: 'Progress', food: 'Food', reflection: 'Reflection',
};

/** The three questions shown first for a screen, then the rest grouped for "More questions". */
export function suggestionsFor(screen: AssistantScreen): { initial: Suggestion[]; more: Suggestion[] } {
  const own = SUGGESTIONS.filter(s => s.group === screen);
  const pad = SUGGESTIONS.filter(s => s.group === 'today' && !own.includes(s));
  const initial = [...own, ...pad].slice(0, 3);
  const more = SUGGESTIONS.filter(s => !initial.includes(s));
  return { initial, more };
}

// ── Context: what we know about the signed-in user's selected day ──────────────

export type AssistantContext = {
  screen: AssistantScreen;
  /** The selected date (YYYY-MM-DD, local) and the device's local today. */
  date: string;
  todayStr: string;
  habits: DayHabit[];
  priorityIds: string[];
  checkIn?: CheckIn;
  goals?: string[];
  userName?: string | null;
};

export function describeDay(ctx: AssistantContext): { label: string; summary: DaySummary; headline: string; nextStep: NextStep } {
  const summary = summarizeDay(ctx.habits, ctx.date, ctx.todayStr);
  const rel = ctx.date === ctx.todayStr ? 'Today' : formatLongDate(ctx.date, ctx.todayStr);
  return {
    label: rel === 'Today' ? `Today · ${formatLongDate(ctx.date, ctx.todayStr)}` : rel,
    summary,
    headline: summaryHeadline(summary),
    nextStep: pickNextStep(ctx.habits, ctx.priorityIds, ctx.date, ctx.todayStr),
  };
}

/** The first scheduled habit on the day that isn't completed: an unlogged one if any, else a slip. */
export function restartCandidate(ctx: AssistantContext): DayHabit | null {
  if (ctx.date > ctx.todayStr) return null;
  const open = openHabits(ctx.habits, ctx.priorityIds, ctx.date)[0];
  return open ?? ctx.habits.find(h => isScheduledOn(h, ctx.date) && !h.done) ?? null;
}

// ── Messages ───────────────────────────────────────────────────────────────────

export type Source = 'log' | 'ai';

/** A thing the user can do from a reply. Writes always go through a confirmation
 *  in the UI and then the app's own operations — never a separate AI copy. */
export type AssistantAction =
  | { kind: 'open_habit';   habitId: string; label: string }
  | { kind: 'mark_done';    habitId: string; label: string }
  | { kind: 'set_priority'; habitId: string; label: string }
  | { kind: 'open_screen';  route: '/(tabs)/ai' | '/(tabs)/profile' | '/(tabs)/fuel' | '/(tabs)/strength'; label: string };

export type AssistantMessage =
  | { id: string; role: 'user'; text: string; at: string }
  | {
      id: string; role: 'assistant'; at: string;
      source: Source;
      /** What the answer is based on, shown under the label: e.g. "your habit list for 6 Nov". */
      basis: string;
      text: string;
      actions?: AssistantAction[];
    }
  | {
      id: string; role: 'assistant'; at: string;
      source: 'unavailable';
      /** Why there is no answer, in plain words. */
      text: string;
      /** The question to resend on Retry. */
      question: string;
    }
  | { id: string; role: 'system'; at: string; text: string };

/** A saved application change, so the conversation shows what was actually written. */
export function savedChangeMessage(text: string): AssistantMessage {
  return { id: newId(), role: 'system', at: new Date().toISOString(), text };
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** How many prior turns are sent to the open chat endpoint, and the longest question accepted. */
export const MAX_CONTEXT_TURNS = 6;
export const MAX_QUESTION_CHARS = 500;
export const MAX_STORED_MESSAGES = 60;
export const REQUEST_TIMEOUT_MS = 25_000;

// ── Answering ──────────────────────────────────────────────────────────────────

export type AnswerResult =
  | { ok: true; message: AssistantMessage }
  | { ok: false; reason: 'unavailable' | 'no_server_chat' | 'aborted' | 'offline'; detail?: string };

type Deps = { token: string | null; signal: AbortSignal };

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
const quote = (s: string) => `"${s}"`;

function reply(source: Source, basis: string, text: string, actions?: AssistantAction[]): AnswerResult {
  return { ok: true, message: { id: newId(), role: 'assistant', at: new Date().toISOString(), source, basis, text, actions } };
}

function matchSuggestion(question: string): Suggestion | null {
  const q = question.trim().toLowerCase().replace(/[’']/g, "'");
  return SUGGESTIONS.find(s => s.text.toLowerCase().replace(/[’']/g, "'") === q) ?? null;
}

/** Routes a question. Predefined questions get the best source we have for them;
 *  anything else goes to the open chat endpoint. */
export async function answer(question: string, ctx: AssistantContext, history: AssistantMessage[], deps: Deps): Promise<AnswerResult> {
  const s = matchSuggestion(question);
  try {
    switch (s?.id) {
      case 'today.focus':
      case 'today.step':
      case 'habits.next':     return answerNextStep(ctx, s.id);
      case 'today.busy':      return answerBusyDay(ctx);
      case 'habits.easier':   return answerEasier(ctx);
      case 'habits.restart':  return await answerRestart(ctx, deps);
      case 'progress.week':
      case 'reflect.well':    return await answerWeek(ctx, deps, s.id);
      case 'progress.compare':return await answerCompare(ctx, deps);
      case 'progress.patterns': return await answerPatterns(ctx, deps);
      case 'food.summary':    return await answerFoodSummary(ctx, deps);
      case 'food.easier':     return answerFoodEasier(ctx);
      default:                return await answerOpenChat(question, ctx, history, deps);
    }
  } catch (err: any) {
    if (deps.signal.aborted || err?.name === 'AbortError') return { ok: false, reason: 'aborted' };
    if (err?.status === 404) return { ok: false, reason: 'no_server_chat' };
    if (typeof err?.message === 'string' && /network request failed/i.test(err.message)) return { ok: false, reason: 'offline' };
    return { ok: false, reason: 'unavailable', detail: err?.message };
  }
}

// ── Rule-based answers (source: 'log') ─────────────────────────────────────────

function dayRef(ctx: AssistantContext): string {
  return ctx.date === ctx.todayStr ? 'today' : `on ${formatShortDate(ctx.date)}`;
}

function answerNextStep(ctx: AssistantContext, id: string): AnswerResult {
  const { nextStep, summary } = describeDay(ctx);
  const basis = `your habit list and log for ${formatShortDate(ctx.date)}`;
  const openList = openHabits(ctx.habits, ctx.priorityIds, ctx.date);

  if (nextStep.kind === 'no_habits') {
    return reply('log', basis, "You don't have any habits yet, so there's nothing to pick from. Adding one habit, scheduled on the days you can realistically do it, is the next step.");
  }
  if (nextStep.kind === 'rest_day') {
    return reply('log', basis, `Nothing is scheduled ${dayRef(ctx)}. That's a rest day by your own schedule, not a miss. If you want to do something anyway, your unscheduled habits are listed under "All habits".`);
  }
  if (nextStep.kind === 'future') {
    return reply('log', basis, `${formatShortDate(ctx.date)} hasn't started yet. ${plural(nextStep.scheduled, 'habit')} ${nextStep.scheduled === 1 ? 'is' : 'are'} scheduled for it, so there's nothing to log until the day arrives.`);
  }
  if (nextStep.kind === 'all_logged') {
    const slip = nextStep.slipped ? ` ${plural(nextStep.slipped, 'habit')} ${nextStep.slipped === 1 ? 'was' : 'were'} logged as a slip, which is a record, not a failure.` : '';
    return reply('log', basis, `Everything scheduled ${dayRef(ctx)} is logged: ${nextStep.completed} of ${nextStep.scheduled} completed.${slip} There's no open step left for this day.`);
  }

  const h = nextStep.habit;
  const why = nextStep.isPriority ? "it's one of your chosen priorities" : 'it is the first open habit in your list order';
  const others = openList.length > 1 ? ` After that, ${plural(openList.length - 1, 'other habit')} ${openList.length - 1 === 1 ? 'is' : 'are'} still open.` : ' It is the only open habit.';
  const tiny = h.tiny_version ? ` Your smaller version of it is: ${h.tiny_version}.` : '';
  const lead = id === 'today.step' ? `One small step: ${quote(h.name)}.` : `Focus on ${quote(h.name)}.`;
  return reply('log', basis,
    `${lead} It's picked because ${why}.${others}${tiny} ${summary.completed} of ${plural(summary.scheduled, 'scheduled habit')} ${summary.scheduled === 1 ? 'is' : 'are'} already done ${dayRef(ctx)}.`,
    [
      { kind: 'mark_done', habitId: h.id, label: nextStep.needsInput ? `Log ${quote(h.name)}` : `Mark ${quote(h.name)} done` },
      { kind: 'open_habit', habitId: h.id, label: 'Open habit' },
    ]);
}

function answerBusyDay(ctx: AssistantContext): AnswerResult {
  const basis = `your scheduled habits for ${formatShortDate(ctx.date)}`;
  const { summary } = describeDay(ctx);
  if (summary.kind === 'no_habits') return reply('log', basis, "You have no habits yet, so there's nothing to fit into the day. Add one and I can order it for you.");
  if (summary.kind === 'rest_day') return reply('log', basis, `Nothing is scheduled ${dayRef(ctx)}, so a busy day costs you nothing here. Rest days aren't counted against you.`);
  const open = openHabits(ctx.habits, ctx.priorityIds, ctx.date);
  if (open.length === 0) return reply('log', basis, `Everything scheduled ${dayRef(ctx)} is already logged. The busy part is done.`);
  if (ctx.date < ctx.todayStr) {
    return reply('log', basis,
      `${formatShortDate(ctx.date)} is already over, so there's nothing to plan for it. ${plural(open.length, 'scheduled habit')} ${open.length === 1 ? 'has' : 'have'} no log for that day; if you did any of them, you can still record it.`,
      open.slice(0, 3).map(h => ({ kind: 'mark_done' as const, habitId: h.id, label: `Log ${quote(h.name)} for ${formatShortDate(ctx.date)}` })));
  }
  if (ctx.date > ctx.todayStr) {
    return reply('log', basis, `${formatShortDate(ctx.date)} hasn't started. ${plural(open.length, 'habit')} ${open.length === 1 ? 'is' : 'are'} scheduled for it; come back on the day and I'll order them for you.`);
  }

  const lines = open.map((h, i) => {
    const bits = [h.tiny_version ? `smaller version: ${h.tiny_version}` : null, h.track_count && h.count_unit ? `counts in ${h.count_unit}` : null].filter(Boolean);
    return `${i + 1}. ${h.name}${bits.length ? ` (${bits.join('; ')})` : ''}`;
  });
  const first = open[0];
  return reply('log', basis,
    `A simple plan from your own list, priorities first. Do ${quote(first.name)} first; if the day collapses, that one still counts.\n\n${lines.join('\n')}\n\nThis is an ordering of what you already scheduled, not new advice. Drop anything that doesn't fit and log it honestly.`,
    [{ kind: 'mark_done', habitId: first.id, label: `Start with ${quote(first.name)}` }]);
}

function answerEasier(ctx: AssistantContext): AnswerResult {
  const basis = `the habit details you saved`;
  const h = restartCandidate(ctx) ?? openHabits(ctx.habits, ctx.priorityIds, ctx.date)[0] ?? null;
  if (!h) {
    if (ctx.habits.length === 0) return reply('log', basis, "You don't have a habit to make easier yet.");
    return reply('log', basis, `Nothing is open ${dayRef(ctx)}, so I can't tell which habit you mean. Open a habit from "All habits" and ask again from there.`);
  }
  const parts: string[] = [`For ${quote(h.name)}:`];
  if (h.tiny_version) parts.push(`You already wrote a smaller version: ${quote(h.tiny_version)}. On a hard day, doing that still counts as done.`);
  else parts.push("You haven't saved a smaller version yet. Pick the smallest action that still feels like the habit (two minutes, one rep, one page) and save it as the habit's small version.");
  if (h.why_started) parts.push(`You started it because: ${quote(h.why_started)}.`);
  const sched = scheduleText(h.days);
  parts.push(`It's scheduled: ${sched.toLowerCase()}. If that's more days than you've been managing, cutting a day is a change you can make yourself in the habit's settings.`);
  return reply('log', basis, parts.join(' '),
    [{ kind: 'open_habit', habitId: h.id, label: 'Open habit to edit' }]);
}

async function answerRestart(ctx: AssistantContext, deps: Deps): Promise<AnswerResult> {
  const h = restartCandidate(ctx);
  if (!h) {
    return reply('log', `your log for ${formatShortDate(ctx.date)}`,
      ctx.habits.length === 0
        ? "There's nothing to restart yet because you have no habits. Choosing one is the restart."
        : `There's nothing open to restart ${dayRef(ctx)}: every scheduled habit is already logged, or nothing was scheduled.`);
  }
  if (!deps.token) return { ok: false, reason: 'unavailable' };
  const res = await habits.recoveryNudge(deps.token, {
    habitName: h.name, streak: h.streak,
    tinyVersion: h.tiny_version ?? undefined, whyStarted: h.why_started ?? undefined,
  });
  const text = res?.nudge?.trim();
  if (!text) return { ok: false, reason: 'unavailable' };
  const tiny = res.suggestTiny && h.tiny_version ? `\n\nYour smaller version: ${h.tiny_version}.` : '';
  return reply('ai', `the AI coach, given only the name, streak and saved details of ${quote(h.name)}`, text + tiny, [
    { kind: 'mark_done', habitId: h.id, label: `Mark ${quote(h.name)} done` },
    { kind: 'open_habit', habitId: h.id, label: 'Open habit' },
  ]);
}

async function answerWeek(ctx: AssistantContext, deps: Deps, id: string): Promise<AnswerResult> {
  if (!deps.token) return { ok: false, reason: 'unavailable' };
  const d = await habits.weeklyDebrief(deps.token);
  const sections: [string, string | undefined][] = id === 'reflect.well'
    ? [['What went well', d?.summary], ['Pattern', d?.pattern], ['One change to keep', d?.suggestion]]
    : [['Summary', d?.summary], ['Pattern', d?.pattern], ['Suggestion', d?.suggestion], ['Identity', d?.identity]];
  const body = sections.filter(([, t]) => !!t?.trim()).map(([h, t]) => `${h}\n${t!.trim()}`).join('\n\n');
  if (!body) return { ok: false, reason: 'unavailable' };
  const { headline } = describeDay(ctx);
  return reply('ai', `the AI weekly debrief over your last 14 days of habit logs. Today's count from your log: ${headline.toLowerCase()}`, body);
}

async function answerCompare(ctx: AssistantContext, deps: Deps): Promise<AnswerResult> {
  // A true week-over-week comparison needs the server's history, which the app
  // reads per habit. The debrief is the closest existing source, so we use it and
  // say plainly that it covers a 14-day window rather than two separate weeks.
  if (!deps.token) return { ok: false, reason: 'unavailable' };
  const d = await habits.weeklyDebrief(deps.token);
  const text = [d?.pattern, d?.summary].filter(t => !!t?.trim()).map(t => t!.trim()).join('\n\n');
  if (!text) return { ok: false, reason: 'unavailable' };
  return reply('ai', 'the AI weekly debrief, which looks at the last 14 days together rather than comparing two separate weeks', text);
}

async function answerPatterns(ctx: AssistantContext, deps: Deps): Promise<AnswerResult> {
  if (!deps.token) return { ok: false, reason: 'unavailable' };
  const res = await habits.patterns(deps.token);
  const items = (res?.patterns ?? []).filter(p => p?.insight?.trim());
  if (items.length === 0) {
    return reply('log', 'your habit history', "There isn't enough logged history yet for a pattern to be more than a guess. Keep logging for another week or two and ask again; a pattern needs several repeats before it means anything.");
  }
  const text = items.map(p => `• ${p.insight.trim()}${p.actionable?.trim() ? `\n  Try: ${p.actionable.trim()}` : ''}`).join('\n\n');
  return reply('ai', 'the AI pattern analysis of your habit completion history. Treat these as suggested explanations, not facts', text);
}

async function answerFoodSummary(ctx: AssistantContext, deps: Deps): Promise<AnswerResult> {
  if (!deps.token) return { ok: false, reason: 'unavailable' };
  const end = ctx.date > ctx.todayStr ? ctx.todayStr : ctx.date;
  const days = Array.from({ length: 7 }, (_, i) => shiftDate(end, -i));
  const settled = await Promise.all(days.map(d => fuel.logs(deps.token!, d).then(l => ({ d, logs: l ?? [] })).catch(() => ({ d, logs: null as FoodLog[] | null }))));
  if (deps.signal.aborted) return { ok: false, reason: 'aborted' };
  const failed = settled.filter(s => s.logs === null).length;
  const logged = settled.filter(s => (s.logs?.length ?? 0) > 0);
  const basis = `your food check-ins for the 7 days ending ${formatShortDate(end)}`;
  if (failed === settled.length) return { ok: false, reason: 'unavailable' };
  if (logged.length === 0) {
    return reply('log', basis, `No food check-ins were logged in those 7 days${failed ? ` (${failed} day${failed === 1 ? '' : 's'} couldn't be loaded)` : ''}. That's missing data, not a bad week. One quick check-in today would start the record.`,
      [{ kind: 'open_screen', route: '/(tabs)/fuel', label: 'Open Fuel' }]);
  }
  const all = logged.flatMap(s => s.logs!);
  const detailed = all.filter(l => l.mode === 'detailed');
  const quality = all.map(l => l.foodQuality).filter((q): q is number => typeof q === 'number');
  const junk = all.filter(l => l.hadJunkFood === true || (l.junkMeals ?? 0) > 0).length;
  const cals = detailed.map(l => l.calories).filter((c): c is number => typeof c === 'number');
  const lines = [
    `${plural(logged.length, 'day')} of 7 have a check-in (${all.length} ${all.length === 1 ? 'entry' : 'entries'}).`,
    quality.length ? `Average food quality you rated: ${(quality.reduce((a, b) => a + b, 0) / quality.length).toFixed(1)} across ${plural(quality.length, 'rating')}.` : null,
    cals.length ? `Calories were logged on ${plural(cals.length, 'day')}, averaging ${Math.round(cals.reduce((a, b) => a + b, 0) / cals.length)} kcal.` : null,
    `Junk food flagged on ${plural(junk, 'entry')}.`,
    failed ? `${failed} day${failed === 1 ? '' : 's'} couldn't be loaded, so the totals may be low.` : null,
    logged.length < 4 ? 'With fewer than four days logged, this is a snapshot rather than a trend.' : null,
  ].filter(Boolean);
  return reply('log', basis, lines.join(' '), [{ kind: 'open_screen', route: '/(tabs)/fuel', label: 'Open Fuel' }]);
}

function answerFoodEasier(ctx: AssistantContext): AnswerResult {
  return reply('log', 'how food logging works in this app',
    'The quickest honest log is the Quick mode on Fuel: three taps (did you eat three meals, how clean was it, any junk) and you are done. Snap Track on the AI Coach screen estimates a meal from a photo if you want detail without typing. Logging the same way at the same time each day beats logging perfectly.',
    [{ kind: 'open_screen', route: '/(tabs)/fuel', label: 'Open Fuel' }, { kind: 'open_screen', route: '/(tabs)/ai', label: 'Open Snap Track' }]);
}

// ── Open chat (source: 'ai' via /ai/chat) ──────────────────────────────────────

/** The smallest context the server needs to personalise an answer. Names and
 *  states only, no ids, emails or notes; the server adds nothing we didn't send. */
export function minimalContext(ctx: AssistantContext) {
  const { summary } = describeDay(ctx);
  return {
    date: ctx.date,
    isToday: ctx.date === ctx.todayStr,
    tzOffsetMinutes: new Date().getTimezoneOffset(),
    goals: (ctx.goals ?? []).slice(0, 5),
    checkIn: ctx.checkIn?.mood ?? null,
    counts: { scheduled: summary.scheduled, completed: summary.completed, missed: summary.missed, notLogged: summary.notLogged, kind: summary.kind },
    habits: ctx.habits.slice(0, 20).map(h => ({
      name: h.name.slice(0, 60),
      state: habitDayState(h, ctx.date, ctx.todayStr),
      priority: ctx.priorityIds.includes(h.id),
      streak: h.streak,
      smallVersion: h.tiny_version?.slice(0, 80) ?? null,
    })),
  };
}

async function answerOpenChat(question: string, ctx: AssistantContext, history: AssistantMessage[], deps: Deps): Promise<AnswerResult> {
  if (!deps.token) return { ok: false, reason: 'unavailable' };
  const turns = history
    .filter((m): m is Extract<AssistantMessage, { role: 'user' } | { role: 'assistant'; source: Source }> =>
      m.role === 'user' || (m.role === 'assistant' && m.source !== 'unavailable'))
    .slice(-MAX_CONTEXT_TURNS)
    .map(m => ({ role: m.role, content: m.text.slice(0, 1500) }));
  const res = await ai.chat(deps.token, {
    question: question.slice(0, MAX_QUESTION_CHARS),
    screen: ctx.screen,
    context: minimalContext(ctx),
    history: turns,
  }, deps.signal);
  const text = res?.answer?.trim();
  if (!text) return { ok: false, reason: 'unavailable' };
  return reply('ai', res.basis?.trim() || `the AI coach, given your habits and counts for ${formatShortDate(ctx.date)}`, text);
}
