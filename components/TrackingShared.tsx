import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AppTheme } from './ThemeContext';
import { formatLongDate, relativeDay } from '../lib/today';

// Shared building blocks for the Food and Physical tracking screens: header,
// cards, choice chips, entry rows, empty states and the weekly summary. They only
// render what they are given; all data and writes stay in the screens.

type IconName = React.ComponentProps<typeof Ionicons>['name'];
const F = (family: string) => ({ fontFamily: family });

/** "Today · Saturday, 14 November" or "Viewing yesterday · Friday, 13 November". */
export function dateLine(date: string, todayStr: string): string {
  const rel = relativeDay(date, todayStr);
  const long = formatLongDate(date, todayStr);
  if (rel === 'today') return `Today · ${long}`;
  if (rel) return `Viewing ${rel} · ${long}`;
  return `Viewing ${long}`;
}

export function TrackingHeader({ title, subtitle, date, todayStr, theme, right, showDate = true }: {
  title: string; subtitle?: string; date: string; todayStr: string; theme: AppTheme; right?: React.ReactNode; showDate?: boolean;
}) {
  return (
    <View style={h.wrap}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[h.title, { color: theme.text }, F('BricolageGrotesque_800ExtraBold')]} accessibilityRole="header" maxFontSizeMultiplier={1.4}>
          {title}
        </Text>
        {!!subtitle && <Text style={[h.sub, { color: theme.textSecondary }, F('Inter_500Medium')]} maxFontSizeMultiplier={1.6}>{subtitle}</Text>}
        {showDate && <Text style={[h.date, { color: theme.text }, F('Inter_700Bold')]} maxFontSizeMultiplier={1.6} numberOfLines={1} adjustsFontSizeToFit>
          {dateLine(date, todayStr)}
        </Text>}
      </View>
      {right && <View style={h.right}>{right}</View>}
    </View>
  );
}

const h = StyleSheet.create({
  wrap:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 18, paddingTop: 6, paddingBottom: 10 },
  title: { fontSize: 28, lineHeight: 32 },
  sub:   { fontSize: 14, lineHeight: 19, marginTop: 2 },
  date:  { fontSize: 13, lineHeight: 18, marginTop: 8 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 2 },
});

export function IconButton({ icon, label, onPress, theme }: { icon: IconName; label: string; onPress: () => void; theme: AppTheme }) {
  return (
    <TouchableOpacity
      style={[c.iconBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={18} color={theme.textSecondary} />
    </TouchableOpacity>
  );
}

export function SectionCard({ title, subtitle, action, children, theme, tone = 'card' }: {
  title?: string; subtitle?: string;
  action?: { label: string; onPress: () => void; icon?: IconName };
  children: React.ReactNode; theme: AppTheme; tone?: 'card' | 'plain';
}) {
  return (
    <View style={[c.card, tone === 'card' ? { backgroundColor: theme.card, borderColor: theme.border } : { backgroundColor: 'transparent', borderColor: 'transparent', paddingHorizontal: 0 }]}>
      {(title || action) && (
        <View style={c.cardHead}>
          <View style={{ flex: 1, minWidth: 0 }}>
            {!!title && <Text style={[c.cardTitle, { color: theme.text }, F('Inter_800ExtraBold')]} accessibilityRole="header" maxFontSizeMultiplier={1.5}>{title}</Text>}
            {!!subtitle && <Text style={[c.cardSub, { color: theme.textSecondary }, F('Inter_500Medium')]} maxFontSizeMultiplier={1.6}>{subtitle}</Text>}
          </View>
          {action && (
            <TouchableOpacity style={c.cardAction} onPress={action.onPress} accessibilityRole="button" accessibilityLabel={action.label} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Text style={[c.cardActionText, { color: theme.text }, F('Inter_700Bold')]} maxFontSizeMultiplier={1.4}>{action.label}</Text>
              <Ionicons name={action.icon ?? 'chevron-forward'} size={14} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      )}
      {children}
    </View>
  );
}

export function PrimaryButton({ label, onPress, icon, disabled, loading, theme }: {
  label: string; onPress: () => void; icon?: IconName; disabled?: boolean; loading?: boolean; theme: AppTheme;
}) {
  const off = disabled || loading;
  return (
    <TouchableOpacity
      style={[c.primary, { backgroundColor: theme.inverse, opacity: off ? 0.45 : 1 }]}
      onPress={onPress}
      disabled={off}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
    >
      {icon && <Ionicons name={icon} size={18} color={theme.inverseText} />}
      <Text style={[c.primaryText, { color: theme.inverseText }, F('Inter_800ExtraBold')]} maxFontSizeMultiplier={1.4}>{loading ? 'Saving…' : label}</Text>
    </TouchableOpacity>
  );
}

export function SecondaryButton({ label, onPress, icon, theme, disabled }: {
  label: string; onPress: () => void; icon?: IconName; theme: AppTheme; disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[c.secondary, { borderColor: theme.borderStrong, opacity: disabled ? 0.45 : 1 }]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {icon && <Ionicons name={icon} size={16} color={theme.text} />}
      <Text style={[c.secondaryText, { color: theme.text }, F('Inter_700Bold')]} maxFontSizeMultiplier={1.4}>{label}</Text>
    </TouchableOpacity>
  );
}

/** A row of mutually exclusive choices with text labels, wrapping on narrow screens. */
export function ChoiceChips<T extends string>({ options, value, onChange, theme, disabled }: {
  options: { key: T; label: string; icon?: IconName }[];
  value: T | null; onChange: (v: T) => void; theme: AppTheme; disabled?: boolean;
}) {
  return (
    <View style={c.chips} accessibilityRole="radiogroup">
      {options.map(o => {
        const on = value === o.key;
        return (
          <TouchableOpacity
            key={o.key}
            style={[c.chip, { backgroundColor: on ? theme.inverse : theme.card, borderColor: on ? theme.inverse : theme.borderStrong, opacity: disabled ? 0.5 : 1 }]}
            onPress={() => onChange(o.key)}
            disabled={disabled}
            activeOpacity={0.8}
            accessibilityRole="radio"
            accessibilityState={{ checked: on, disabled: !!disabled }}
            accessibilityLabel={o.label}
          >
            {o.icon && <Ionicons name={o.icon} size={16} color={on ? theme.inverseText : theme.text} />}
            <Text style={[c.chipText, { color: on ? theme.inverseText : theme.text }, F('Inter_700Bold')]} maxFontSizeMultiplier={1.4}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function EntryRow({ icon, title, meta, time, right, onPress, onEdit, theme, last }: {
  icon?: IconName | string; title: string; meta?: string | null; time?: string | null;
  right?: React.ReactNode; onPress?: () => void; onEdit?: () => void; theme: AppTheme; last?: boolean;
}) {
  const body = (
    <View style={[c.entry, !last && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
      {icon !== undefined && (
        <View style={[c.entryIcon, { backgroundColor: theme.surface }]}>
          {typeof icon === 'string' && icon.length <= 2
            ? <Text style={{ fontSize: 16 }}>{icon}</Text>
            : <Ionicons name={icon as IconName} size={16} color={theme.text} />}
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[c.entryTitle, { color: theme.text }, F('Inter_700Bold')]} maxFontSizeMultiplier={1.6}>{title}</Text>
        {!!meta && <Text style={[c.entryMeta, { color: theme.textSecondary }, F('Inter_500Medium')]} maxFontSizeMultiplier={1.6}>{meta}</Text>}
      </View>
      {!!time && <Text style={[c.entryTime, { color: theme.textTertiary }, F('Inter_500Medium')]} maxFontSizeMultiplier={1.4}>{time}</Text>}
      {right}
      {onEdit && (
        <TouchableOpacity onPress={onEdit} style={c.editBtn} accessibilityRole="button" accessibilityLabel={`Edit ${title}`}>
          <Text style={[c.editText, { color: theme.text }, F('Inter_700Bold')]} maxFontSizeMultiplier={1.4}>Edit</Text>
        </TouchableOpacity>
      )}
    </View>
  );
  return onPress
    ? <TouchableOpacity onPress={onPress} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={title}>{body}</TouchableOpacity>
    : body;
}

export function EmptyState({ icon, title, body, action, theme }: {
  icon: IconName; title: string; body?: string; action?: { label: string; onPress: () => void }; theme: AppTheme;
}) {
  return (
    <View style={c.empty}>
      <Ionicons name={icon} size={22} color={theme.textTertiary} />
      <Text style={[c.emptyTitle, { color: theme.text }, F('Inter_700Bold')]} maxFontSizeMultiplier={1.6}>{title}</Text>
      {!!body && <Text style={[c.emptyBody, { color: theme.textSecondary }, F('Inter_500Medium')]} maxFontSizeMultiplier={1.8}>{body}</Text>}
      {action && <SecondaryButton label={action.label} onPress={action.onPress} theme={theme} />}
    </View>
  );
}

export type SummaryRow = { label: string; value: string; hint?: string };

export function WeekSummaryCard({ title, period, rows, note, onHistory, theme }: {
  title: string; period: string; rows: SummaryRow[]; note?: string | null; onHistory?: () => void; theme: AppTheme;
}) {
  return (
    <SectionCard title={title} subtitle={period} theme={theme} action={onHistory ? { label: 'Full history', onPress: onHistory } : undefined}>
      <View style={c.summaryGrid}>
        {rows.map(r => (
          <View key={r.label} style={[c.summaryCell, { backgroundColor: theme.surface }]} accessibilityLabel={`${r.label}: ${r.value}${r.hint ? `. ${r.hint}` : ''}`}>
            <Text style={[c.summaryValue, { color: theme.text }, F('Inter_800ExtraBold')]} maxFontSizeMultiplier={1.4}>{r.value}</Text>
            <Text style={[c.summaryLabel, { color: theme.textSecondary }, F('Inter_600SemiBold')]} maxFontSizeMultiplier={1.4}>{r.label}</Text>
            {!!r.hint && <Text style={[c.summaryHint, { color: theme.textTertiary }, F('Inter_500Medium')]} maxFontSizeMultiplier={1.4}>{r.hint}</Text>}
          </View>
        ))}
      </View>
      {!!note && <Text style={[c.note, { color: theme.textSecondary }, F('Inter_500Medium')]} maxFontSizeMultiplier={1.8}>{note}</Text>}
    </SectionCard>
  );
}

/** A collapsed row that reveals optional content. */
export function Disclosure({ label, hint, open, onToggle, theme, children }: {
  label: string; hint?: string; open: boolean; onToggle: () => void; theme: AppTheme; children: React.ReactNode;
}) {
  return (
    <View>
      <TouchableOpacity
        style={[c.disclosure, { borderColor: theme.border, backgroundColor: theme.card }]}
        onPress={onToggle}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={label}
      >
        <View style={{ flex: 1 }}>
          <Text style={[c.disclosureLabel, { color: theme.text }, F('Inter_700Bold')]} maxFontSizeMultiplier={1.5}>{label}</Text>
          {!!hint && <Text style={[c.entryMeta, { color: theme.textSecondary }, F('Inter_500Medium')]} maxFontSizeMultiplier={1.6}>{hint}</Text>}
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textSecondary} />
      </TouchableOpacity>
      {open && children}
    </View>
  );
}

export function timeOf(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

const c = StyleSheet.create({
  iconBtn:  { width: 40, height: 40, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  card:     { marginHorizontal: 16, marginBottom: 12, padding: 16, borderWidth: 1, borderRadius: 18 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  cardTitle:{ fontSize: 17, lineHeight: 22 },
  cardSub:  { fontSize: 13, lineHeight: 18, marginTop: 2 },
  cardAction: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 32 },
  cardActionText: { fontSize: 13 },

  primary:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 52, paddingHorizontal: 18, borderRadius: 16 },
  primaryText: { fontSize: 15 },
  secondary:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 46, paddingHorizontal: 16, borderWidth: 1.5, borderRadius: 14, alignSelf: 'flex-start' },
  secondaryText: { fontSize: 14 },

  chips:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:     { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 46, paddingHorizontal: 14, borderWidth: 1.5, borderRadius: 999, flexGrow: 1, justifyContent: 'center' },
  chipText: { fontSize: 14 },

  entry:    { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 10 },
  entryIcon:{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  entryTitle:{ fontSize: 15, lineHeight: 20 },
  entryMeta: { fontSize: 13, lineHeight: 18, marginTop: 1 },
  entryTime: { fontSize: 12 },
  editBtn:  { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  editText: { fontSize: 13 },

  empty:    { alignItems: 'flex-start', gap: 6, paddingVertical: 4 },
  emptyTitle:{ fontSize: 15 },
  emptyBody: { fontSize: 13, lineHeight: 19, marginBottom: 6 },

  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  summaryCell: { flexGrow: 1, flexBasis: '45%', padding: 12, borderRadius: 12, gap: 2 },
  summaryValue:{ fontSize: 20, lineHeight: 24 },
  summaryLabel:{ fontSize: 12, lineHeight: 16 },
  summaryHint: { fontSize: 11, lineHeight: 15 },
  note:     { fontSize: 13, lineHeight: 19, marginTop: 12 },

  disclosure: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 12, minHeight: 56, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderRadius: 16 },
  disclosureLabel: { fontSize: 15 },
});
