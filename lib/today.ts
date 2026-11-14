// ── "Today" screen logic ────────────────────────────────────────────────────────
// Pure, rule-based helpers behind the home screen: which habits are scheduled on
// a date, what state each one is in, the factual day summary and the "next small
// step". Nothing here calls the network or AI, so the screen works offline of any
// AI credentials and the rules can be checked in isolation.

import { shiftDate, toDateStr } from './api';
import type { Task } from './api';

export type DayHabit = Task & {
  done: boolean;
  yFailed: boolean;
  streak: number;
  count: number | null;
};

/** completed → logged as done · missed → logged as a slip, or a past scheduled
 *  day with no log · not_logged → scheduled, day still open, nothing logged yet ·
 *  not_scheduled → the habit doesn't run on this date. */
export type HabitDayState = 'completed' | 'missed' | 'not_logged' | 'not_scheduled';

export const MAX_PRIORITIES = 3;

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']; // index 0 = Monday

function parseLocal(date: string): Date {
  return new Date(date + 'T00:00:00'); // local midnight, same convention as lib/api
}

/** 0 = Monday … 6 = Sunday — the index the app and server store in task.days. */
export function weekdayIndex(date: string): number {
  return (parseLocal(date).getDay() + 6) % 7;
}

/** First local date the habit existed, or null when unknown. */
export function habitStartDate(task: Pick<Task, 'start_date' | 'created_at'>): string | null {
  const raw = task.start_date || task.created_at;
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : toDateStr(d);
}

/** A habit is scheduled on a date when that weekday is in its days (an empty or
 *  missing list means every day) and the habit already existed on that date. */
export function isScheduledOn(task: Pick<Task, 'days' | 'start_date' | 'created_at'>, date: string): boolean {
  const days = task.days;
  const onWeekday = !days || days.length === 0 || days.includes(weekdayIndex(date));
  if (!onWeekday) return false;
  const start = habitStartDate(task);
  return !start || date >= start;
}

export function habitDayState(h: DayHabit, date: string, todayStr: string): HabitDayState {
  if (!isScheduledOn(h, date)) return 'not_scheduled';
  if (h.done) return 'completed';
  if (h.yFailed) return 'missed';
  return date < todayStr ? 'missed' : 'not_logged';
}

/** True when completing the habit needs more than one tap (a count or a Y/N answer). */
export function needsInput(h: Pick<Task, 'category' | 'track_count'>): boolean {
  return h.category === 'control' || !!h.track_count;
}

/** Screen order: build habits, then control habits, each in their existing list order. */
export function inScreenOrder<T extends Pick<Task, 'category'>>(habits: T[]): T[] {
  return [
    ...habits.filter(h => h.category !== 'control'),
    ...habits.filter(h => h.category === 'control'),
  ];
}

/** Drops ids that no longer match a habit, removes duplicates and caps at three. */
export function sanitizePriorities(ids: unknown, habits: Pick<Task, 'id'>[]): string[] {
  if (!Array.isArray(ids)) return [];
  const known = new Set(habits.map(h => h.id));
  const out: string[] = [];
  for (const id of ids) {
    if (typeof id === 'string' && known.has(id) && !out.includes(id)) out.push(id);
    if (out.length === MAX_PRIORITIES) break;
  }
  return out;
}

// ── Day summary ────────────────────────────────────────────────────────────────

export type DaySummary = {
  /** counts → a real measurement · no_record → a past day with nothing logged, so
   *  no measurement is claimed · rest_day → habits exist but none are scheduled ·
   *  future → the day hasn't happened · no_habits → the user has no habits. */
  kind: 'no_habits' | 'rest_day' | 'future' | 'no_record' | 'counts';
  total: number;
  scheduled: number;
  completed: number;
  missed: number;
  /** Subset of `missed` that the user explicitly logged as a slip. */
  slipped: number;
  notLogged: number;
  notScheduled: number;
};

export function summarizeDay(habits: DayHabit[], date: string, todayStr: string): DaySummary {
  const s: DaySummary = {
    kind: 'counts', total: habits.length, scheduled: 0,
    completed: 0, missed: 0, slipped: 0, notLogged: 0, notScheduled: 0,
  };
  for (const h of habits) {
    const state = habitDayState(h, date, todayStr);
    if (state === 'not_scheduled') { s.notScheduled++; continue; }
    s.scheduled++;
    if (state === 'completed') s.completed++;
    else if (state === 'missed') { s.missed++; if (h.yFailed) s.slipped++; }
    else s.notLogged++;
  }
  if (s.total === 0) s.kind = 'no_habits';
  else if (s.scheduled === 0) s.kind = 'rest_day';
  else if (date > todayStr) s.kind = 'future';
  else if (date < todayStr && s.completed === 0 && s.slipped === 0) s.kind = 'no_record';
  return s;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function summaryHeadline(s: DaySummary): string {
  switch (s.kind) {
    case 'no_habits': return 'No habits yet';
    case 'rest_day':  return 'Nothing scheduled: a rest day';
    case 'future':    return `${plural(s.scheduled, 'habit')} scheduled`;
    case 'no_record': return 'Nothing was logged on this day';
    default:          return `${s.completed} of ${plural(s.scheduled, 'scheduled habit')} completed`;
  }
}

export function summaryDetail(s: DaySummary): string | null {
  switch (s.kind) {
    case 'no_habits': return 'Progress appears here once you add a habit.';
    case 'rest_day':  return 'Rest days are not counted against you.';
    case 'future':    return "This day hasn't happened yet, so there is nothing to measure.";
    case 'no_record':
      return `${plural(s.scheduled, 'habit')} ${s.scheduled === 1 ? 'was' : 'were'} scheduled. No score is shown because there is no record for this day.`;
    default: return null;
  }
}

// ── Next small step ────────────────────────────────────────────────────────────

export type NextStep =
  | { kind: 'no_habits' }
  | { kind: 'rest_day' }
  | { kind: 'future'; scheduled: number }
  | { kind: 'all_logged'; scheduled: number; completed: number; slipped: number }
  | { kind: 'habit'; habit: DayHabit; isPriority: boolean; needsInput: boolean };

/** Scheduled habits with nothing logged, priorities first (in the user's chosen
 *  order), then everything else in screen order. */
export function openHabits(habits: DayHabit[], priorityIds: string[], date: string): DayHabit[] {
  const open = habits.filter(h => isScheduledOn(h, date) && !h.done && !h.yFailed);
  const byId = new Map(open.map(h => [h.id, h]));
  const first = priorityIds.map(id => byId.get(id)).filter((h): h is DayHabit => !!h);
  const rest = inScreenOrder(open.filter(h => !priorityIds.includes(h.id)));
  return [...first, ...rest];
}

export function pickNextStep(habits: DayHabit[], priorityIds: string[], date: string, todayStr: string): NextStep {
  if (habits.length === 0) return { kind: 'no_habits' };
  const s = summarizeDay(habits, date, todayStr);
  if (s.scheduled === 0) return { kind: 'rest_day' };
  if (date > todayStr) return { kind: 'future', scheduled: s.scheduled };
  const next = openHabits(habits, priorityIds, date)[0];
  if (!next) return { kind: 'all_logged', scheduled: s.scheduled, completed: s.completed, slipped: s.slipped };
  return { kind: 'habit', habit: next, isPriority: priorityIds.includes(next.id), needsInput: needsInput(next) };
}

// ── Date wording ───────────────────────────────────────────────────────────────

/** "Friday, 6 November" (the year is added only when it differs from today's). */
export function formatLongDate(date: string, todayStr?: string): string {
  const d = parseLocal(date);
  const base = `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return todayStr && todayStr.slice(0, 4) !== date.slice(0, 4) ? `${base} ${d.getFullYear()}` : base;
}

/** "Thu 5 Nov" — for buttons that name the date they log against. */
export function formatShortDate(date: string): string {
  const d = parseLocal(date);
  return `${DAY_SHORT[weekdayIndex(date)]} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
}

export function relativeDay(date: string, todayStr: string): 'today' | 'yesterday' | 'tomorrow' | null {
  if (date === todayStr) return 'today';
  if (date === shiftDate(todayStr, -1)) return 'yesterday';
  if (date === shiftDate(todayStr, 1)) return 'tomorrow';
  return null;
}

/** Header line: "Today · Friday, 6 November", "Viewing yesterday · Thursday, 5 November",
 *  or "Viewing Monday, 2 November" for any other date. */
export function dayTitle(date: string, todayStr: string): string {
  const long = formatLongDate(date, todayStr);
  const rel = relativeDay(date, todayStr);
  if (rel === 'today') return `Today · ${long}`;
  if (rel) return `Viewing ${rel} · ${long}`;
  return `Viewing ${long}`;
}

/** How to refer to the selected day inside a sentence: "today", "yesterday", or the full date. */
export function dayWord(date: string, todayStr: string): string {
  return relativeDay(date, todayStr) ?? formatLongDate(date, todayStr);
}

export function greeting(hour: number, name?: string | null): string {
  const part = hour < 5 ? 'Hello' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const first = name?.trim().split(/\s+/)[0];
  return first ? `${part}, ${first}.` : `${part}.`;
}

/** "Every day" or "Mon, Wed, Fri". */
export function scheduleText(days: number[] | null | undefined): string {
  if (!days || days.length === 0 || days.length === 7) return 'Every day';
  return [...days].sort((a, b) => a - b).map(i => DAY_SHORT[i]).filter(Boolean).join(', ');
}
