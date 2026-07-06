import React, { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from './ThemeContext';
import { useAuth } from '../lib/auth';
import { today as getToday, toDateStr } from '../lib/api';

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const CELL_W = 48;
const CELL_GAP = 6;
const PAST_DAYS   = 90;
const FUTURE_DAYS = 3;

function buildDays() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const total = PAST_DAYS + 1 + FUTURE_DAYS;
  return Array.from({ length: total }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - PAST_DAYS + i);
    return {
      letter: DAY_LETTERS[d.getDay()],
      date:   d.getDate(),
      full:   toDateStr(d), // LOCAL date — must match today()/selectedDate elsewhere
    };
  });
}

type Props = { selectedDate: string; onSelect: (date: string) => void };

export function DaySelector({ selectedDate, onSelect }: Props) {
  const { theme } = useTheme();
  const { user }  = useAuth();
  const scrollRef = useRef<ScrollView>(null);
  const today     = getToday();
  // Never let users navigate to (or see) days before they joined — nothing was
  // tracked then, so those days are empty and meaningless. Use the LOCAL date of
  // the account-created timestamp so it lines up with today()/selectedDate.
  const joinDay   = user?.created_at ? toDateStr(new Date(user.created_at)) : null;
  const days      = buildDays().filter(d => !joinDay || d.full >= joinDay);

  useEffect(() => {
    const idx = days.findIndex(d => d.full === today);
    if (idx < 0) return;
    const x = (idx - 4) * (CELL_W + CELL_GAP);
    setTimeout(() => scrollRef.current?.scrollTo({ x: Math.max(0, x), animated: false }), 50);
  }, []);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.row}
    >
      {days.map((d) => {
        const active   = d.full === selectedDate;
        const isToday  = d.full === today;
        const isFuture = d.full > today;

        return (
          <TouchableOpacity
            key={d.full}
            style={[
              s.cell,
              { backgroundColor: '#FFFFFF' },
              active && { backgroundColor: theme.inverse },
              isFuture && !active && { backgroundColor: '#FFFFFF', opacity: 0.4 },
            ]}
            onPress={() => onSelect(d.full)}
            activeOpacity={0.7}
          >
            <Text style={[s.letter, {
              color: active ? theme.inverseText : isFuture ? theme.textMuted : theme.textSecondary,
            }]}>
              {d.letter}
            </Text>
            <Text style={[s.num, {
              color: active ? theme.inverseText : isFuture ? theme.textMuted : theme.text,
              fontFamily: active ? 'Inter_900Black' : 'Inter_500Medium',
            }]}>
              {d.date}
            </Text>
            {isToday && !active && (
              <View style={[s.dot, { backgroundColor: theme.success }]} />
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  row:        { paddingHorizontal: 14, gap: CELL_GAP, paddingVertical: 2 },
  cell:       {
    width: CELL_W,
    height: 58,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  letter:     { fontSize: 7, fontWeight: '700', letterSpacing: 0.8 },
  num:        { fontSize: 16, lineHeight: 18 },
  dot:        { width: 4, height: 4, borderRadius: 2, position: 'absolute', bottom: 6 },
});
