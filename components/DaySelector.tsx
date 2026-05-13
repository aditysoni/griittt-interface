import React, { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from './ThemeContext';

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const CELL_W = 48;
const CELL_GAP = 6;
const PAST_DAYS   = 90;
const FUTURE_DAYS = 3;

function buildDays() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const total = PAST_DAYS + 1 + FUTURE_DAYS; // past + today + future
  return Array.from({ length: total }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - PAST_DAYS + i);
    return {
      letter: DAY_LETTERS[d.getDay()],
      date:   d.getDate(),
      full:   d.toISOString().slice(0, 10),
    };
  });
}

type Props = { selectedDate: string; onSelect: (date: string) => void };

export function DaySelector({ selectedDate, onSelect }: Props) {
  const { theme } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const today     = new Date().toISOString().slice(0, 10);
  const days      = buildDays();

  // Scroll so today is on screen with the 3 future days visible to its right.
  useEffect(() => {
    const idx = days.findIndex(d => d.full === today);
    if (idx < 0) return;
    // Show ~4 past days + today + 3 future cells. Position today as the 5th cell.
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
            style={[s.cell, active && { backgroundColor: '#FFFFFF' }, isFuture && !active && s.cellFuture]}
            onPress={() => onSelect(d.full)}
            activeOpacity={0.7}
          >
            <Text style={[s.letter, {
              color: active ? '#000' : isFuture ? 'rgba(255,255,255,0.3)' : theme.textSecondary,
            }]}>
              {d.letter}
            </Text>
            <Text style={[s.num, {
              color: active ? '#000' : isFuture ? 'rgba(255,255,255,0.3)' : theme.text,
              fontFamily: active ? 'Inter_900Black' : 'Inter_500Medium',
            }]}>
              {d.date}
            </Text>
            {isToday && !active && (
              <View style={[s.dot, { backgroundColor: '#34C759' }]} />
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
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  cellFuture: { backgroundColor: 'rgba(255,255,255,0.02)' },
  letter:     { fontSize: 7, fontWeight: '700', letterSpacing: 0.8 },
  num:        { fontSize: 16, lineHeight: 18 },
  dot:        { width: 4, height: 4, borderRadius: 2, position: 'absolute', bottom: 6 },
});
