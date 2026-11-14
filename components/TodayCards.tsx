import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AppTheme } from './ThemeContext';
import type { CheckIn, Mood } from '../lib/storage';
import {
  DayHabit,
  DaySummary,
  MAX_PRIORITIES,
  NextStep,
  formatShortDate,
  habitDayState,
  isScheduledOn,
  needsInput,
  scheduleText,
  summaryDetail,
  summaryHeadline,
} from '../lib/today';

// Cards for the home "Today" screen. They only render what they are given: every
// completion goes back through the screen's own handlers, so a habit ticked here
// is the same record as the one in the full habit list.

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** "Mark done" / "Log…", naming the date whenever it isn't today. */
function actionLabel(h: DayHabit, isToday: boolean, date: string): string {
  const verb = needsInput(h) ? 'Log…' : 'Mark done';
  return isToday ? verb : `${verb.replace('…', '')} for ${formatShortDate(date)}${needsInput(h) ? '…' : ''}`;
}

// ── Viewing-another-date banner ────────────────────────────────────────────────

export function ViewingBanner({ theme, canLog, onToday }: {
  theme: AppTheme; canLog: boolean; onToday: () => void;
}) {
  return (
    <View
      style={[c.banner, { backgroundColor: theme.warning + '22', borderColor: theme.warning }]}
      accessibilityRole="alert"
    >
      <Ionicons name="calendar-outline" size={18} color={theme.text} />
      <View style={{ flex: 1, minWidth: 140 }}>
        <Text style={[c.bannerBody, { color: theme.text, fontFamily: 'Inter_600SemiBold' }]}>
          {canLog
            ? 'Not today. Anything you log here is saved to this date.'
            : "Not today. This day hasn't happened yet, so nothing can be logged."}
        </Text>
      </View>
      <TouchableOpacity
        style={[c.bannerBtn, { backgroundColor: theme.inverse }]}
        onPress={onToday}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Back to today"
      >
        <Text style={[c.bannerBtnText, { color: theme.inverseText, fontFamily: 'Inter_700Bold' }]}>Back to today</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Your next small step ───────────────────────────────────────────────────────

export function NextStepCard({ step, theme, isToday, date, dayWord, onAct, onAddHabit }: {
  step: NextStep;
  theme: AppTheme;
  isToday: boolean;
  date: string;
  /** "today", "yesterday" or a full date — used inside sentences. */
  dayWord: string;
  onAct: (h: DayHabit) => void;
  onAddHabit: () => void;
}) {
  const fg = theme.inverseText;
  const dim = theme.isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.72)';

  let eyebrow = isToday ? 'YOUR NEXT SMALL STEP' : 'STILL OPEN FOR THIS DAY';
  let title = '';
  let body = '';
  let button: { label: string; icon: IconName; onPress: () => void } | null = null;
  let badge: string | null = null;

  if (step.kind === 'habit') {
    const h = step.habit;
    title = h.name;
    badge = step.isPriority ? 'Priority' : null;
    body = h.tiny_version
      ? `Small version: ${h.tiny_version}`
      : h.category === 'control'
        ? 'Check in on this one when you are ready.'
        : h.track_count
          ? `Log how ${h.count_unit ? `many ${h.count_unit}` : 'much'} you did.`
          : 'One thing is enough to start.';
    button = {
      label: actionLabel(h, isToday, date),
      icon: step.needsInput ? 'create-outline' : 'checkmark',
      onPress: () => onAct(h),
    };
  } else if (step.kind === 'no_habits') {
    eyebrow = 'START HERE';
    title = 'Start with one habit';
    body = 'Pick something small you could do today. You can add more later.';
    button = { label: 'Choose your first habit', icon: 'add', onPress: onAddHabit };
  } else if (step.kind === 'rest_day') {
    eyebrow = 'REST DAY';
    title = `Nothing is scheduled ${dayWord === 'today' ? 'today' : 'on this day'}`;
    body = 'There is nothing to log, and nothing counts against you.';
  } else if (step.kind === 'future') {
    eyebrow = 'NOT YET';
    title = "This day hasn't started";
    body = `${plural(step.scheduled, 'habit')} scheduled. You can log once the day arrives.`;
  } else {
    eyebrow = 'ALL LOGGED';
    if (step.slipped === 0) {
      title = step.scheduled === 1
        ? 'Your scheduled habit is completed'
        : `All ${step.scheduled} scheduled habits completed`;
      body = `That is everything scheduled for ${dayWord}.`;
    } else {
      title = 'Everything scheduled is logged';
      body = `${step.completed} completed and ${step.slipped} logged as a slip. Nothing is left to log for ${dayWord}.`;
    }
  }

  return (
    <View style={[c.next, { backgroundColor: theme.inverse }]}>
      <View style={c.nextTop}>
        <Text style={[c.eyebrow, { color: theme.isDark ? theme.accentText : theme.accent, fontFamily: 'Inter_700Bold' }]}>
          {eyebrow}
        </Text>
        {badge && (
          <View style={[c.badge, { borderColor: dim }]}>
            <Ionicons name="star" size={11} color={fg} />
            <Text style={[c.badgeText, { color: fg, fontFamily: 'Inter_700Bold' }]}>{badge}</Text>
          </View>
        )}
      </View>
      <Text style={[c.nextTitle, { color: fg, fontFamily: 'BricolageGrotesque_800ExtraBold' }]}>{title}</Text>
      <Text style={[c.nextBody, { color: dim, fontFamily: 'Inter_500Medium' }]}>{body}</Text>
      {button && (
        <TouchableOpacity
          style={[c.nextBtn, { backgroundColor: theme.accent }]}
          onPress={button.onPress}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={step.kind === 'habit' ? `${button.label}: ${title}` : button.label}
        >
          <Ionicons name={button.icon} size={18} color={theme.accentText} />
          <Text style={[c.nextBtnText, { color: theme.accentText, fontFamily: 'Inter_800ExtraBold' }]}>
            {button.label}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Your priorities ────────────────────────────────────────────────────────────

function stateWording(h: DayHabit, date: string, todayStr: string): { text: string; icon: IconName; tone: 'good' | 'bad' | 'muted' } {
  const state = habitDayState(h, date, todayStr);
  if (state === 'completed') {
    const count = h.count != null ? ` · ${h.count}${h.count_unit ? ` ${h.count_unit}` : ''}` : '';
    return { text: (h.category === 'control' ? 'Stayed in control' : 'Completed') + count, icon: 'checkmark-circle', tone: 'good' };
  }
  if (state === 'missed' && h.yFailed) {
    const count = h.count != null ? ` · ${h.count}${h.count_unit ? ` ${h.count_unit}` : ''}` : '';
    return { text: 'Logged as a slip' + count, icon: 'alert-circle-outline', tone: 'bad' };
  }
  if (state === 'missed') return { text: 'Missed · nothing logged', icon: 'remove-circle-outline', tone: 'muted' };
  return { text: 'Not logged yet', icon: 'ellipse-outline', tone: 'muted' };
}

export function PrioritiesCard({ priorities, hasHabits, theme, date, todayStr, canLog, onAct, onUndo, onEdit, onAllHabits }: {
  /** The chosen habits, in the user's order (already limited to existing habits). */
  priorities: DayHabit[];
  hasHabits: boolean;
  theme: AppTheme;
  date: string;
  todayStr: string;
  canLog: boolean;
  onAct: (h: DayHabit) => void;
  onUndo: (h: DayHabit) => void;
  onEdit: () => void;
  onAllHabits: () => void;
}) {
  const isToday = date === todayStr;
  const scheduled = priorities.filter(h => isScheduledOn(h, date));
  const resting = priorities.filter(h => !isScheduledOn(h, date));

  return (
    <View style={[c.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={c.cardHead}>
        <Text style={[c.cardTitle, { color: theme.text, fontFamily: 'Inter_800ExtraBold' }]} accessibilityRole="header">
          Your priorities
        </Text>
        {hasHabits && (
          <TouchableOpacity
            style={c.textBtn}
            onPress={onEdit}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={priorities.length ? 'Change priorities' : 'Choose priorities'}
          >
            <Ionicons name="options-outline" size={16} color={theme.text} />
            <Text style={[c.textBtnLabel, { color: theme.text, fontFamily: 'Inter_700Bold' }]}>
              {priorities.length ? 'Change' : 'Choose'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {!hasHabits ? (
        <Text style={[c.muted, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}>
          Once you have a habit, you can pick up to three to keep in front of you.
        </Text>
      ) : priorities.length === 0 ? (
        <Text style={[c.muted, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}>
          Optional: pick up to three habits to keep at the top of this screen. One is fine.
        </Text>
      ) : (
        <>
          {scheduled.map(h => {
            const w = stateWording(h, date, todayStr);
            const logged = h.done || h.yFailed;
            const toneColor = w.tone === 'good' ? theme.success : w.tone === 'bad' ? theme.danger : theme.textSecondary;
            return (
              <View key={h.id} style={[c.prioRow, { borderTopColor: theme.border }]}>
                <View style={c.prioInfo}>
                  <Text style={[c.prioName, { color: theme.text, fontFamily: 'SpaceGrotesk_700Bold' }]}>{h.name}</Text>
                  <View style={c.stateLine}>
                    <Ionicons name={w.icon} size={15} color={toneColor} />
                    <Text style={[c.stateText, { color: toneColor, fontFamily: 'Inter_600SemiBold' }]}>{w.text}</Text>
                  </View>
                </View>
                {canLog && (logged ? (
                  <TouchableOpacity
                    style={[c.rowBtn, { borderColor: theme.borderStrong }]}
                    onPress={() => onUndo(h)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={`Undo log for ${h.name}`}
                  >
                    <Ionicons name="arrow-undo-outline" size={15} color={theme.text} />
                    <Text style={[c.rowBtnText, { color: theme.text, fontFamily: 'Inter_700Bold' }]}>Undo</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[c.rowBtn, { backgroundColor: theme.inverse, borderColor: theme.inverse }]}
                    onPress={() => onAct(h)}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={`${actionLabel(h, isToday, date)}: ${h.name}`}
                  >
                    <Ionicons name={needsInput(h) ? 'create-outline' : 'checkmark'} size={15} color={theme.inverseText} />
                    <Text style={[c.rowBtnText, { color: theme.inverseText, fontFamily: 'Inter_700Bold' }]}>
                      {needsInput(h) ? 'Log…' : 'Mark done'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            );
          })}
          {scheduled.length === 0 && (
            <Text style={[c.muted, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}>
              None of your priorities are scheduled {isToday ? 'today' : 'on this day'}.
            </Text>
          )}
          {resting.length > 0 && (
            <Text style={[c.restLine, { color: theme.textSecondary, fontFamily: 'Inter_500Medium', borderTopColor: theme.border }]}>
              Not scheduled {isToday ? 'today' : 'on this day'}: {resting.map(h => h.name).join(', ')}
            </Text>
          )}
        </>
      )}

      {hasHabits && (
        <TouchableOpacity
          style={[c.linkRow, { borderTopColor: theme.border }]}
          onPress={onAllHabits}
          accessibilityRole="button"
          accessibilityLabel="All habits"
        >
          <Ionicons name="list-outline" size={17} color={theme.text} />
          <Text style={[c.linkText, { color: theme.text, fontFamily: 'Inter_700Bold' }]}>All habits</Text>
          <Ionicons name="chevron-down" size={16} color={theme.textSecondary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Priority picker ────────────────────────────────────────────────────────────

export function PriorityPickerModal({ visible, habits, selected, theme, onClose, onSave }: {
  visible: boolean;
  habits: DayHabit[];
  selected: string[];
  theme: AppTheme;
  onClose: () => void;
  onSave: (ids: string[]) => void;
}) {
  const [ids, setIds] = useState<string[]>(selected);
  useEffect(() => { if (visible) setIds(selected); }, [visible]);

  const full = ids.length >= MAX_PRIORITIES;
  function toggle(id: string) {
    setIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : prev.length >= MAX_PRIORITIES ? prev : [...prev, id]);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[c.sheet, { backgroundColor: theme.bg }]}>
        <View style={[c.sheetHandle, { backgroundColor: theme.border }]} />
        <View style={[c.sheetHead, { borderBottomColor: theme.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[c.sheetTitle, { color: theme.text, fontFamily: 'Inter_800ExtraBold' }]} accessibilityRole="header">
              Choose priorities
            </Text>
            <Text style={[c.muted, { color: theme.textSecondary, fontFamily: 'Inter_500Medium', marginTop: 2 }]}>
              Up to {MAX_PRIORITIES}. Fewer is fine, and you can change them any time.
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={c.closeBtn} accessibilityRole="button" accessibilityLabel="Close without saving">
            <Ionicons name="close" size={22} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={c.sheetBody}>
          {habits.map(h => {
            const on = ids.includes(h.id);
            const disabled = !on && full;
            return (
              <TouchableOpacity
                key={h.id}
                style={[c.pickRow, {
                  backgroundColor: theme.card,
                  borderColor: on ? theme.inverse : theme.border,
                  opacity: disabled ? 0.45 : 1,
                }]}
                onPress={() => toggle(h.id)}
                disabled={disabled}
                activeOpacity={0.8}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on, disabled }}
                accessibilityLabel={`${h.name}, ${scheduleText(h.days)}`}
              >
                <View style={[c.pickBox, {
                  backgroundColor: on ? theme.inverse : 'transparent',
                  borderColor: on ? theme.inverse : theme.borderStrong,
                }]}>
                  {on && <Ionicons name="checkmark" size={15} color={theme.inverseText} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[c.prioName, { color: theme.text, fontFamily: 'SpaceGrotesk_700Bold' }]}>{h.name}</Text>
                  <Text style={[c.stateText, { color: theme.textSecondary, fontFamily: 'Inter_500Medium', marginTop: 2 }]}>
                    {h.category === 'control' ? 'Control' : 'Build'} · {scheduleText(h.days)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={[c.sheetFoot, { borderTopColor: theme.border, backgroundColor: theme.bg }]}>
          <Text style={[c.stateText, { color: theme.textSecondary, fontFamily: 'Inter_600SemiBold', flex: 1 }]}>
            {ids.length} of {MAX_PRIORITIES} selected
          </Text>
          <TouchableOpacity
            style={[c.saveBtn, { backgroundColor: theme.inverse }]}
            onPress={() => onSave(ids)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Save priorities"
          >
            <Text style={[c.saveBtnText, { color: theme.inverseText, fontFamily: 'Inter_800ExtraBold' }]}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Daily check-in ─────────────────────────────────────────────────────────────

const MOODS: { key: Mood; label: string; icon: IconName }[] = [
  { key: 'low',  label: 'Low energy', icon: 'battery-dead-outline' },
  { key: 'okay', label: 'Okay',       icon: 'reorder-two-outline' },
  { key: 'good', label: 'Good',       icon: 'sunny-outline' },
];

export function CheckInCard({ checkIn, theme, isToday, onSelect, onSkip }: {
  checkIn: CheckIn | undefined;
  theme: AppTheme;
  isToday: boolean;
  onSelect: (mood: Mood) => void;
  onSkip: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const answered = !!checkIn && !editing;
  const current = MOODS.find(m => m.key === checkIn?.mood);

  return (
    <View style={[c.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={c.cardHead}>
        <Text style={[c.cardTitleSm, { color: theme.text, fontFamily: 'Inter_700Bold' }]} accessibilityRole="header">
          {isToday ? "How's today feeling?" : 'How did this day feel?'}
        </Text>
        {answered ? (
          <TouchableOpacity
            style={c.textBtn}
            onPress={() => setEditing(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={current ? 'Change check-in' : 'Add a check-in'}
          >
            <Text style={[c.textBtnLabel, { color: theme.text, fontFamily: 'Inter_700Bold' }]}>
              {current ? 'Change' : 'Add'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={c.textBtn}
            onPress={() => { setEditing(false); if (!checkIn) onSkip(); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={checkIn ? 'Keep current check-in' : 'Skip check-in'}
          >
            <Text style={[c.textBtnLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>
              {checkIn ? 'Cancel' : 'Skip'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {answered ? (
        <View style={c.stateLine}>
          <Ionicons name={current ? current.icon : 'ellipse-outline'} size={17} color={theme.textSecondary} />
          <Text style={[c.muted, { color: theme.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
            {current ? `Feeling: ${current.label}` : 'Skipped'}
          </Text>
        </View>
      ) : (
        <>
          <View style={c.moodRow}>
            {MOODS.map(m => {
              const on = checkIn?.mood === m.key;
              return (
                <TouchableOpacity
                  key={m.key}
                  style={[c.moodChip, {
                    backgroundColor: on ? theme.inverse : 'transparent',
                    borderColor: on ? theme.inverse : theme.borderStrong,
                  }]}
                  onPress={() => { setEditing(false); onSelect(m.key); }}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={m.label}
                >
                  <Ionicons name={m.icon} size={16} color={on ? theme.inverseText : theme.text} />
                  <Text style={[c.moodText, { color: on ? theme.inverseText : theme.text, fontFamily: 'Inter_700Bold' }]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={[c.fine, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}>
            Optional. It never changes your score.
          </Text>
        </>
      )}
    </View>
  );
}

// ── Ask GRITTT entry ───────────────────────────────────────────────────────────

export function AskGritttRow({ theme, onPress }: { theme: AppTheme; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[c.askRow, { backgroundColor: theme.card, borderColor: theme.border }]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="Ask GRITTT"
    >
      <View style={[c.askIcon, { backgroundColor: theme.inverse }]}>
        <Ionicons name="sparkles" size={16} color={theme.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[c.cardTitleSm, { color: theme.text, fontFamily: 'Inter_700Bold' }]}>Ask GRITTT</Text>
        <Text style={[c.fine, { color: theme.textSecondary, fontFamily: 'Inter_500Medium', marginTop: 2 }]}>
          Suggested questions about your day, or ask your own
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
    </TouchableOpacity>
  );
}

// ── Compact progress ───────────────────────────────────────────────────────────

export function ProgressCard({ summary, theme, onDetails }: {
  summary: DaySummary; theme: AppTheme; onDetails: () => void;
}) {
  const detail = summaryDetail(summary);
  const showCounts = summary.kind === 'counts';
  const stats: { label: string; value: number; color: string }[] = showCounts
    ? [
        { label: 'Completed', value: summary.completed, color: theme.success },
        { label: 'Not logged', value: summary.notLogged, color: theme.textSecondary },
        { label: 'Missed', value: summary.missed, color: theme.danger },
        { label: 'Not scheduled', value: summary.notScheduled, color: theme.textSecondary },
      ]
    : summary.notScheduled > 0 && summary.kind !== 'rest_day'
      ? [{ label: 'Not scheduled', value: summary.notScheduled, color: theme.textSecondary }]
      : [];

  return (
    <View style={[c.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[c.eyebrow, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>PROGRESS</Text>
      <Text style={[c.progressHeadline, { color: theme.text, fontFamily: 'Inter_800ExtraBold' }]} accessibilityRole="header">
        {summaryHeadline(summary)}
      </Text>
      {detail && (
        <Text style={[c.muted, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}>{detail}</Text>
      )}
      {stats.length > 0 && (
        <View style={c.statWrap}>
          {stats.map(st => (
            <View
              key={st.label}
              style={[c.stat, { borderColor: theme.border }]}
              accessible
              accessibilityLabel={`${st.label}: ${st.value}`}
            >
              <Text style={[c.statValue, { color: st.value > 0 ? st.color : theme.textSecondary, fontFamily: 'SpaceGrotesk_700Bold' }]}>
                {st.value}
              </Text>
              <Text style={[c.statLabel, { color: theme.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>{st.label}</Text>
            </View>
          ))}
        </View>
      )}
      <TouchableOpacity
        style={[c.linkRow, { borderTopColor: theme.border }]}
        onPress={onDetails}
        accessibilityRole="button"
        accessibilityLabel="See detailed progress and charts"
      >
        <Ionicons name="stats-chart-outline" size={16} color={theme.text} />
        <Text style={[c.linkText, { color: theme.text, fontFamily: 'Inter_700Bold' }]}>See detailed progress</Text>
        <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

// ── Undo bar ───────────────────────────────────────────────────────────────────

export function UndoBar({ message, theme, onUndo }: { message: string; theme: AppTheme; onUndo: () => void }) {
  return (
    <View style={[c.undo, { backgroundColor: theme.inverse }]} accessibilityRole="alert">
      <Text style={[c.undoText, { color: theme.inverseText, fontFamily: 'Inter_600SemiBold' }]}>{message}</Text>
      <TouchableOpacity
        style={[c.undoBtn, { backgroundColor: theme.accent }]}
        onPress={onUndo}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Undo"
      >
        <Ionicons name="arrow-undo" size={15} color={theme.accentText} />
        <Text style={[c.undoBtnText, { color: theme.accentText, fontFamily: 'Inter_800ExtraBold' }]}>Undo</Text>
      </TouchableOpacity>
    </View>
  );
}

const c = StyleSheet.create({
  // Banner
  banner:        { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 12, padding: 14, borderWidth: 1, borderRadius: 16 },
  bannerBody:    { fontSize: 14, lineHeight: 20 },
  bannerBtn:     { minHeight: 44, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bannerBtnText: { fontSize: 14 },

  // Next step
  next:        { marginHorizontal: 16, marginBottom: 12, padding: 18, borderRadius: 20, gap: 6 },
  nextTop:     { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  eyebrow:     { fontSize: 11, letterSpacing: 1.4 },
  badge:       { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:   { fontSize: 11 },
  nextTitle:   { fontSize: 24, lineHeight: 29 },
  nextBody:    { fontSize: 14, lineHeight: 20 },
  nextBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 50, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14, marginTop: 10 },
  nextBtnText: { fontSize: 16 },

  // Generic card
  card:        { marginHorizontal: 16, marginBottom: 12, padding: 16, borderWidth: 1, borderRadius: 18, gap: 8 },
  cardHead:    { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle:   { fontSize: 17, flexShrink: 1 },
  cardTitleSm: { fontSize: 15, flexShrink: 1 },
  muted:       { fontSize: 14, lineHeight: 20, flexShrink: 1 },
  fine:        { fontSize: 12, lineHeight: 17 },
  textBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 32, paddingHorizontal: 2 },
  textBtnLabel:{ fontSize: 14 },
  linkRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingTop: 10, marginTop: 2, borderTopWidth: 1 },
  linkText:    { fontSize: 14, flex: 1 },

  // Priorities
  prioRow:    { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, paddingTop: 10, borderTopWidth: 1 },
  prioInfo:   { flex: 1, minWidth: 140, gap: 3 },
  prioName:   { fontSize: 15, lineHeight: 20 },
  stateLine:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stateText:  { fontSize: 13, lineHeight: 18, flexShrink: 1 },
  rowBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, minWidth: 104, paddingHorizontal: 14, borderWidth: 1, borderRadius: 12 },
  rowBtnText: { fontSize: 14 },
  restLine:   { fontSize: 13, lineHeight: 18, paddingTop: 10, borderTopWidth: 1 },

  // Picker sheet
  sheet:       { flex: 1, paddingTop: 8 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
  sheetHead:   { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  sheetTitle:  { fontSize: 20 },
  closeBtn:    { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  sheetBody:   { padding: 16, gap: 10, paddingBottom: 24 },
  pickRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1.5, borderRadius: 14 },
  pickBox:     { width: 26, height: 26, borderWidth: 1.5, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sheetFoot:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28, borderTopWidth: 1 },
  saveBtn:     { minHeight: 48, minWidth: 120, paddingHorizontal: 24, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontSize: 16 },

  // Check-in
  moodRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  moodChip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 14, borderWidth: 1.5, borderRadius: 999 },
  moodText: { fontSize: 14 },

  // Ask GRITTT
  askRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginBottom: 12, minHeight: 60, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderRadius: 18 },
  askIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  // Progress
  progressHeadline: { fontSize: 18, lineHeight: 24 },
  statWrap:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  stat:      { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  statValue: { fontSize: 15 },
  statLabel: { fontSize: 13 },

  // Undo
  undo:        { position: 'absolute', left: 16, right: 16, bottom: 90, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 16, paddingRight: 8, paddingVertical: 8, borderRadius: 16, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 12 },
  undoText:    { flex: 1, fontSize: 14, lineHeight: 19 },
  undoBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 14, borderRadius: 12 },
  undoBtnText: { fontSize: 14 },
});
