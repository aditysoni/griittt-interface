import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Movement goals (Apple's default-ish targets; overridable per-user).
export const STEP_GOAL = 8000;
export const ACTIVE_KCAL_GOAL = 600;

/** Steps / Calories goal card: icon + label, big value, "of X goal", a progress
 *  bar, and a "%  ·  X to go" footer. Tap to edit the target when onSetGoal is
 *  provided. Shared by the profile + strength screens. */
export function MovementGoalCard({ label, icon, iconColor, value, goal, sub, theme, onSetGoal }: {
  label: string; icon: any; iconColor: string; value: number; goal: number; sub: string; theme: any;
  onSetGoal?: (goal: number) => void;
}) {
  const v       = Math.round(value);
  const pct     = goal > 0 ? Math.min(100, (v / goal) * 100) : 0;
  const toGo    = Math.max(0, goal - v);
  const pctText = pct > 0 && pct < 1 ? pct.toFixed(1) : String(Math.round(pct));

  const [editing, setEditing] = useState(false);
  const [input, setInput]     = useState(String(goal));

  const openEditor = () => { setInput(String(goal)); setEditing(true); };
  const save = () => {
    const n = Math.round(Number(input));
    if (!Number.isFinite(n) || n <= 0) { setEditing(false); return; }
    setEditing(false);
    onSetGoal?.(n);
  };

  return (
    <Pressable
      style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}
      onPress={onSetGoal ? openEditor : undefined}
      disabled={!onSetGoal}
    >
      <View style={s.top}>
        <View style={[s.icon, { backgroundColor: theme.surfaceStrong }]}>
          <Ionicons name={icon} size={16} color={iconColor} />
        </View>
        {onSetGoal
          ? <Ionicons name="create-outline" size={13} color={theme.textTertiary} />
          : <Text style={[s.label, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>{label}</Text>}
      </View>
      {onSetGoal && <Text style={[s.labelBelow, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>{label}</Text>}
      <Text style={[s.value, { color: theme.text, fontFamily: 'SpaceGrotesk_700Bold' }]}>{v.toLocaleString()}</Text>
      <Text style={[s.sub, { color: theme.textMuted, fontFamily: 'Inter_400Regular' }]}>{sub}</Text>
      <View style={[s.track, { backgroundColor: theme.surfaceStrong }]}>
        <View style={[s.fill, { width: `${Math.max(pct, 1)}%`, backgroundColor: theme.text }]} />
      </View>
      <View style={s.foot}>
        <Text style={[s.footText, { color: theme.textSecondary, fontFamily: 'SpaceGrotesk_500Medium' }]}>{pctText}%</Text>
        <Text style={[s.footText, { color: theme.textSecondary, fontFamily: 'SpaceGrotesk_500Medium' }]}>{toGo.toLocaleString()} to go</Text>
      </View>

      {/* Target editor */}
      <Modal visible={editing} transparent animationType="fade" onRequestClose={() => setEditing(false)}>
        <Pressable style={m.backdrop} onPress={() => setEditing(false)}>
          <Pressable style={[m.card, { backgroundColor: theme.bg, borderColor: theme.border }]} onPress={e => e.stopPropagation()}>
            <Text style={[m.title, { color: theme.text, fontFamily: 'Inter_900Black' }]}>SET {label} TARGET</Text>
            <TextInput
              style={[m.input, { color: theme.text, borderColor: theme.border, fontFamily: 'SpaceGrotesk_700Bold' }]}
              value={input}
              onChangeText={setInput}
              placeholder={String(goal)}
              placeholderTextColor={theme.textTertiary}
              keyboardType="number-pad"
              autoFocus
            />
            <View style={m.btnRow}>
              <TouchableOpacity style={[m.btnGhost, { borderColor: theme.border }]} onPress={() => setEditing(false)} activeOpacity={0.7}>
                <Text style={[m.btnGhostText, { color: theme.text, fontFamily: 'Inter_700Bold' }]}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[m.btnFill, { backgroundColor: theme.text }]} onPress={save} activeOpacity={0.7}>
                <Text style={[m.btnFillText, { color: theme.bg, fontFamily: 'Inter_900Black' }]}>SAVE</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card:      { flex: 1, borderWidth: 1, borderRadius: 18, padding: 16, gap: 4 },
  top:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  icon:      { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  label:     { fontSize: 9, letterSpacing: 1.5 },
  labelBelow:{ fontSize: 9, letterSpacing: 1.5, marginTop: 8 },
  value:     { fontSize: 34, letterSpacing: -1, marginTop: 6, lineHeight: 38 },
  sub:       { fontSize: 11, lineHeight: 15 },
  track:     { height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 10 },
  fill:      { height: '100%', borderRadius: 2 },
  foot:      { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  footText:  { fontSize: 11 },
});

const m = StyleSheet.create({
  backdrop:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card:         { width: '100%', maxWidth: 340, borderWidth: 1, borderRadius: 16, padding: 22 },
  title:        { fontSize: 12, letterSpacing: 2.5, textAlign: 'center', marginBottom: 16 },
  input:        { fontSize: 40, textAlign: 'center', borderBottomWidth: 1, paddingBottom: 6, marginBottom: 20 },
  btnRow:       { flexDirection: 'row', gap: 10 },
  btnGhost:     { flex: 1, paddingVertical: 14, borderWidth: 1, borderRadius: 10, alignItems: 'center' },
  btnGhostText: { fontSize: 10, letterSpacing: 3 },
  btnFill:      { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  btnFillText:  { fontSize: 10, letterSpacing: 3 },
});
