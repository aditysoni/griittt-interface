import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/auth';
import { habits, tasks, today } from '../lib/api';
import { todayStorage } from '../lib/storage';
import type { AssistantContext, AssistantScreen } from '../lib/assistant';
import type { DayHabit } from '../lib/today';
import { useTheme } from './ThemeContext';
import { AskGritttSheet } from './AskGritttSheet';

// A labelled "Ask GRITTT" entry point for screens other than Today. It loads the
// same habit records the Today screen uses (tasks + per-day status + priorities)
// when opened, so answers refer to the selected day on that screen. Writes that
// need the Today screen's flows (mark done, priorities) are not offered here;
// the sheet explains that and points the user to Today.

export function AskGritttButton({ screen, date, compact = false }: {
  screen: AssistantScreen;
  /** The date the host screen is showing (YYYY-MM-DD, local). Defaults to today. */
  date?: string;
  /** Icon-sized pill for crowded top bars; the full label is still read by screen readers. */
  compact?: boolean;
}) {
  const { theme } = useTheme();
  const { token, user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState<AssistantContext | null>(null);
  const [error, setError] = useState(false);
  const selected = date ?? today();
  const userKey = user?.id ?? 'anon';

  const load = useCallback(async () => {
    if (!token) { setError(true); return; }
    setError(false);
    try {
      const [taskList, statusList, priorityIds] = await Promise.all([
        tasks.list(token),
        habits.allStatus(token, selected),
        todayStorage.getPriorities(userKey),
      ]);
      const statusMap = new Map(statusList.map(s => [s.id, s]));
      const merged: DayHabit[] = taskList.filter(t => !t.archived_at).map(t => ({
        ...t,
        done:    statusMap.get(t.id)?.done    ?? false,
        yFailed: statusMap.get(t.id)?.yFailed ?? false,
        streak:  statusMap.get(t.id)?.streak  ?? 0,
        count:   statusMap.get(t.id)?.count   ?? null,
      }));
      const checkIns = await todayStorage.getCheckIns(userKey);
      setContext({
        screen, date: selected, todayStr: today(), habits: merged, priorityIds,
        checkIn: checkIns[selected], goals: user?.goals, userName: user?.name,
      });
    } catch {
      setError(true);
    }
  }, [token, selected, userKey, screen, user?.goals, user?.name]);

  useEffect(() => {
    if (!open) return;
    setContext(null);
    load();
  }, [open, load]);

  return (
    <>
      <TouchableOpacity
        style={[s.btn, compact && s.btnCompact, { backgroundColor: theme.inverse, borderColor: theme.inverse }]}
        onPress={() => setOpen(true)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Ask GRITTT"
      >
        <Ionicons name="sparkles" size={compact ? 14 : 15} color={theme.accent} />
        <Text style={[s.label, compact && s.labelCompact, { color: theme.inverseText, fontFamily: 'Inter_700Bold' }]} maxFontSizeMultiplier={1.3}>
          {compact ? 'Ask' : 'Ask GRITTT'}
        </Text>
      </TouchableOpacity>

      <AskGritttSheet
        visible={open}
        onClose={() => setOpen(false)}
        screen={screen}
        context={context}
        contextError={error}
        onRetryContext={load}
        token={token}
        userId={userKey}
        theme={theme}
        handlers={{
          onNavigate: route => router.push(route as any),
          onOpenHabit: () => router.push('/(tabs)' as any),
        }}
      />
    </>
  );
}

const s = StyleSheet.create({
  btn:          { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 12, borderWidth: 1, borderRadius: 18 },
  btnCompact:   { minHeight: 32, paddingHorizontal: 10 },
  label:        { fontSize: 13 },
  labelCompact: { fontSize: 12 },
});

