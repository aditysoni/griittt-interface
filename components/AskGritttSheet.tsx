import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AppTheme } from './ThemeContext';
import { chatStorage } from '../lib/storage';
import { formatShortDate } from '../lib/today';
import {
  AnswerResult, AssistantAction, AssistantContext, AssistantMessage, AssistantScreen, GROUP_LABEL,
  MAX_QUESTION_CHARS, MAX_STORED_MESSAGES, REQUEST_TIMEOUT_MS, Suggestion, answer, newId,
  savedChangeMessage, suggestionsFor,
} from '../lib/assistant';

// ── Ask GRITTT ───────────────────────────────────────────────────────────────────
// One assistant surface for the whole app. The host screen gives it the context
// (the selected day's habits and states) and, where it can, the handlers that
// perform real writes. Every reply is labelled with where it came from:
//   FROM YOUR LOG  — computed on-device from the user's own records, not AI;
//   AI-GENERATED   — one of the server's AI endpoints;
//   SAVED CHANGE   — something the user confirmed and the app actually wrote.
// When no source can answer, the reply says so; nothing is made up to fill it.

/** handoff → the host opened its own input step (a count or a Y/N answer) rather than writing directly. */
export type ActionOutcome = 'done' | 'cancelled' | 'failed' | 'unsupported' | 'handoff';

export type AssistantHandlers = {
  /** Log the habit as done for the context date, using the screen's own flow. */
  onMarkDone?: (habitId: string) => Promise<ActionOutcome>;
  /** Add the habit to Today priorities. */
  onSetPriority?: (habitId: string) => Promise<ActionOutcome>;
  /** Open the habit's detail view. */
  onOpenHabit?: (habitId: string) => void;
  onNavigate: (route: string) => void;
};

type Pending = { id: string; question: string; controller: AbortController };

export function AskGritttSheet({
  visible, onClose, screen, context, contextError, onRetryContext, token, userId, theme, handlers,
}: {
  visible: boolean;
  onClose: () => void;
  screen: AssistantScreen;
  /** null while the host is still loading the day. */
  context: AssistantContext | null;
  contextError?: boolean;
  onRetryContext?: () => void;
  token: string | null;
  userId: string;
  theme: AppTheme;
  handlers: AssistantHandlers;
}) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const pendingRef = useRef<Pending | null>(null);
  pendingRef.current = pending;
  const contextRef = useRef(context);
  contextRef.current = context;

  // Load this user's saved conversation when the sheet opens.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoaded(false);
    chatStorage.get<AssistantMessage>(userId)
      .then(list => { if (!cancelled) { setMessages(list.filter(isMessage)); setLoaded(true); } })
      .catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [visible, userId]);

  // Cancel an in-flight request if the sheet closes.
  useEffect(() => {
    if (!visible && pendingRef.current) { pendingRef.current.controller.abort(); setPending(null); }
  }, [visible]);

  function commit(next: AssistantMessage[]) {
    setMessages(next);
    chatStorage.set(userId, next, MAX_STORED_MESSAGES).catch(() => {});
  }

  const { initial, more } = suggestionsFor(screen);
  const askedIds = useMemo(() => new Set(messages.filter(m => m.role === 'user').map(m => m.text)), [messages]);

  // ── Sending ───────────────────────────────────────────────────────────────────

  async function send(rawQuestion: string, opts: { retryOfId?: string } = {}) {
    const question = rawQuestion.trim().slice(0, MAX_QUESTION_CHARS);
    if (!question || pendingRef.current) return;           // one request at a time: no duplicates
    const ctx = contextRef.current;
    if (!ctx) return;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const id = newId();
    setPending({ id, question, controller });
    setInput('');

    // On retry the failed reply is replaced; the original question bubble stays.
    const base = opts.retryOfId ? messages.filter(m => m.id !== opts.retryOfId) : messages;
    const withQuestion = opts.retryOfId
      ? base
      : [...base, { id: newId(), role: 'user' as const, text: question, at: new Date().toISOString() }];
    commit(withQuestion);
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));

    let result: AnswerResult;
    try {
      result = await answer(question, ctx, withQuestion, { token, signal: controller.signal });
    } catch (err: any) {
      result = { ok: false, reason: controller.signal.aborted ? 'aborted' : 'unavailable', detail: err?.message };
    } finally {
      clearTimeout(timeout);
    }
    if ((pendingRef.current as Pending | null)?.id !== id) return; // superseded (closed or cancelled)
    setPending(null);

    if (result.ok) {
      commit([...withQuestion, result.message]);
    } else if (result.reason === 'aborted') {
      commit([...withQuestion, unavailable(question, 'Cancelled. Your question is kept above; tap Retry to send it again.')]);
    } else {
      commit([...withQuestion, unavailable(question, unavailableText(result.reason, result.detail))]);
    }
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }

  function cancel() {
    pendingRef.current?.controller.abort();
  }

  function newConversation() {
    if (pending) cancel();
    if (messages.length === 0) return;
    Alert.alert('Start a new conversation?', 'This clears the chat from this device. Nothing in your habits or logs changes.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear chat', style: 'destructive', onPress: () => { setMessages([]); chatStorage.clear(userId).catch(() => {}); } },
    ]);
  }

  // ── Actions offered in replies ─────────────────────────────────────────────────

  async function runAction(a: AssistantAction) {
    const ctx = contextRef.current;
    if (!ctx) return;
    const dateWord = ctx.date === ctx.todayStr ? 'today' : formatShortDate(ctx.date);

    if (a.kind === 'open_screen') { handlers.onNavigate(a.route); onClose(); return; }
    if (a.kind === 'open_habit') {
      if (handlers.onOpenHabit) { onClose(); handlers.onOpenHabit(a.habitId); }
      else { onClose(); handlers.onNavigate('/(tabs)'); }
      return;
    }

    const habit = ctx.habits.find(h => h.id === a.habitId);
    if (!habit) { Alert.alert('Habit not found', 'That habit is no longer in your list.'); return; }

    if (a.kind === 'mark_done') {
      if (!handlers.onMarkDone) {
        Alert.alert('Open Today to log this', 'Logging from the assistant is only available on the Today screen, where the habit list is loaded.');
        return;
      }
      confirm(`Mark "${habit.name}" done?`, `This will be saved to your habit log for ${dateWord}. It is the same record as the one on your habit list.`, 'Mark done', async () => {
        const outcome = await handlers.onMarkDone!(a.habitId);
        if (outcome === 'handoff') onClose();
        report(outcome, `Marked "${habit.name}" done for ${dateWord}.`, `Could not mark "${habit.name}" done.`);
      });
      return;
    }
    if (a.kind === 'set_priority') {
      if (!handlers.onSetPriority) {
        Alert.alert('Open Today to change priorities', 'Priorities are edited on the Today screen.');
        return;
      }
      confirm(`Add "${habit.name}" to your priorities?`, 'It will appear in the Your priorities card on Today. You can have up to three.', 'Add priority', async () => {
        const outcome = await handlers.onSetPriority!(a.habitId);
        report(outcome, `Added "${habit.name}" to your Today priorities.`, `Could not add "${habit.name}": you may already have three priorities.`);
      });
    }
  }

  function confirm(title: string, body: string, ok: string, run: () => Promise<void>) {
    Alert.alert(title, body, [
      { text: 'Cancel', style: 'cancel' },
      { text: ok, onPress: () => { run().catch(() => report('failed', '', 'Something went wrong; nothing was changed.')); } },
    ]);
  }

  function report(outcome: ActionOutcome, okText: string, failText: string) {
    if (outcome === 'cancelled') return;
    if (outcome === 'handoff') return; // the host screen's own step takes over; it reports its own result
    const text = outcome === 'done' ? okText : outcome === 'unsupported' ? 'That change is not available from here.' : failText;
    setMessages(prev => { const next = [...prev, savedChangeMessage(text)]; chatStorage.set(userId, next, MAX_STORED_MESSAGES).catch(() => {}); return next; });
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }

  // ── Rendering ──────────────────────────────────────────────────────────────────

  const canAsk = !!context && !pending;
  const f = (family: string) => ({ fontFamily: family });

  function renderSuggestion(sg: Suggestion, muted?: boolean) {
    const asked = askedIds.has(sg.text);
    return (
      <TouchableOpacity
        key={sg.id}
        style={[a.chip, { backgroundColor: theme.card, borderColor: theme.border, opacity: canAsk ? 1 : 0.5 }]}
        onPress={() => send(sg.text)}
        disabled={!canAsk}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={sg.text}
        accessibilityState={{ disabled: !canAsk }}
      >
        <Text style={[a.chipText, { color: muted ? theme.textSecondary : theme.text }, f('Inter_600SemiBold')]} allowFontScaling maxFontSizeMultiplier={1.6}>
          {sg.text}
        </Text>
        {asked && <Ionicons name="checkmark" size={14} color={theme.textTertiary} />}
      </TouchableOpacity>
    );
  }

  function renderMessage(m: AssistantMessage) {
    if (m.role === 'user') {
      return (
        <View key={m.id} style={[a.userBubble, { backgroundColor: theme.inverse }]} accessibilityLabel={`You asked: ${m.text}`}>
          <Text style={[a.userText, { color: theme.inverseText }, f('Inter_600SemiBold')]} maxFontSizeMultiplier={1.8}>{m.text}</Text>
        </View>
      );
    }
    if (m.role === 'system') {
      return (
        <View key={m.id} style={[a.systemRow, { borderColor: theme.success }]} accessibilityLabel={`Saved change: ${m.text}`}>
          <Ionicons name="checkmark-circle" size={16} color={theme.success} />
          <View style={{ flex: 1 }}>
            <Text style={[a.tag, { color: theme.success }, f('Inter_700Bold')]}>SAVED CHANGE</Text>
            <Text style={[a.body, { color: theme.text }, f('Inter_500Medium')]} maxFontSizeMultiplier={1.8}>{m.text}</Text>
          </View>
        </View>
      );
    }
    if (m.source === 'unavailable') {
      return (
        <View key={m.id} style={[a.aiBubble, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={a.unavailableHead}>
            <Ionicons name="cloud-offline-outline" size={18} color={theme.textSecondary} />
            <Text style={[a.unavailableTitle, { color: theme.text }, f('Inter_700Bold')]} maxFontSizeMultiplier={1.6}>No answer available</Text>
          </View>
          <Text style={[a.body, { color: theme.textSecondary }, f('Inter_500Medium')]} maxFontSizeMultiplier={1.8}>{m.text}</Text>
          <TouchableOpacity
            style={[a.retry, { borderColor: theme.inverse, opacity: canAsk ? 1 : 0.5 }]}
            onPress={() => send(m.question, { retryOfId: m.id })}
            disabled={!canAsk}
            accessibilityRole="button"
            accessibilityLabel="Retry this question"
          >
            <Ionicons name="refresh" size={15} color={theme.text} />
            <Text style={[a.retryText, { color: theme.text }, f('Inter_700Bold')]}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    const isAI = m.source === 'ai';
    return (
      <View key={m.id} style={[a.aiBubble, { backgroundColor: theme.card, borderColor: isAI ? theme.accent : theme.border }]}>
        <View style={a.tagRow}>
          <Ionicons name={isAI ? 'sparkles' : 'list-outline'} size={12} color={isAI ? theme.accent : theme.textSecondary} />
          <Text style={[a.tag, { color: isAI ? theme.accent : theme.textSecondary }, f('Inter_700Bold')]}>
            {isAI ? 'AI-GENERATED' : 'FROM YOUR LOG · NOT AI'}
          </Text>
        </View>
        <Text style={[a.body, { color: theme.text }, f('Inter_500Medium')]} maxFontSizeMultiplier={1.8}>{m.text}</Text>
        <Text style={[a.basis, { color: theme.textTertiary }, f('Inter_500Medium')]} maxFontSizeMultiplier={1.6}>Based on {m.basis}.</Text>
        {!!m.actions?.length && (
          <View style={a.actions}>
            {m.actions.map((act, i) => {
              const isWrite = act.kind === 'mark_done' || act.kind === 'set_priority';
              return (
                <TouchableOpacity
                  key={i}
                  style={[a.actionBtn, isWrite
                    ? { backgroundColor: theme.inverse, borderColor: theme.inverse }
                    : { backgroundColor: 'transparent', borderColor: theme.borderStrong }]}
                  onPress={() => runAction(act)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={isWrite ? `${act.label}. Asks for confirmation first.` : act.label}
                >
                  <Ionicons
                    name={act.kind === 'mark_done' ? 'checkmark' : act.kind === 'set_priority' ? 'star-outline' : 'open-outline'}
                    size={14} color={isWrite ? theme.inverseText : theme.text}
                  />
                  <Text style={[a.actionText, { color: isWrite ? theme.inverseText : theme.text }, f('Inter_700Bold')]} maxFontSizeMultiplier={1.5}>
                    {act.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <Text style={[a.actionNote, { color: theme.textTertiary }, f('Inter_500Medium')]}>
              Suggestions only. Changes ask you to confirm and then use your normal habit log.
            </Text>
          </View>
        )}
      </View>
    );
  }

  const groupedMore = useMemo(() => {
    const out = new Map<AssistantScreen, Suggestion[]>();
    for (const sg of more) out.set(sg.group, [...(out.get(sg.group) ?? []), sg]);
    return [...out.entries()];
  }, [more]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={[a.sheet, { backgroundColor: theme.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[a.handle, { backgroundColor: theme.border }]} />

        {/* Header */}
        <View style={[a.head, { borderBottomColor: theme.border }]}>
          <View style={[a.headIcon, { backgroundColor: theme.inverse }]}>
            <Ionicons name="sparkles" size={16} color={theme.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[a.title, { color: theme.text }, f('Inter_800ExtraBold')]} accessibilityRole="header" maxFontSizeMultiplier={1.4}>Ask GRITTT</Text>
          </View>
          {messages.length > 0 && (
            <TouchableOpacity onPress={newConversation} style={a.headBtn} accessibilityRole="button" accessibilityLabel="New conversation. Clears this chat from the device.">
              <Ionicons name="create-outline" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onClose} style={a.headBtn} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={22} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={a.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onContentSizeChange={() => { if (pending) scrollRef.current?.scrollToEnd({ animated: true }); }}
        >
          {contextError && !context && (
            <View style={[a.aiBubble, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[a.body, { color: theme.text }, f('Inter_500Medium')]}>Your habits for this day couldn't be loaded, so there's nothing to answer from yet.</Text>
              {onRetryContext && (
                <TouchableOpacity style={[a.retry, { borderColor: theme.inverse }]} onPress={onRetryContext} accessibilityRole="button" accessibilityLabel="Retry loading">
                  <Ionicons name="refresh" size={15} color={theme.text} />
                  <Text style={[a.retryText, { color: theme.text }, f('Inter_700Bold')]}>Retry</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Conversation */}
          {!loaded ? (
            <View style={a.loadingRow}><ActivityIndicator color={theme.text} /></View>
          ) : (
            messages.map(renderMessage)
          )}

          {pending && (
            <View style={[a.aiBubble, { backgroundColor: theme.card, borderColor: theme.border }]} accessibilityLiveRegion="polite">
              <View style={a.loadingRow}>
                <ActivityIndicator color={theme.text} />
                <Text style={[a.body, { color: theme.textSecondary, flex: 1 }, f('Inter_500Medium')]}>Thinking about “{pending.question}”…</Text>
              </View>
              <TouchableOpacity style={[a.retry, { borderColor: theme.borderStrong }]} onPress={cancel} accessibilityRole="button" accessibilityLabel="Cancel this request">
                <Ionicons name="close" size={15} color={theme.text} />
                <Text style={[a.retryText, { color: theme.text }, f('Inter_700Bold')]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Suggestions */}
          <Text style={[a.sectionHead, { color: theme.textSecondary }, f('Inter_700Bold')]} accessibilityRole="header">
            {messages.length === 0 ? 'SUGGESTED' : 'ASK ANOTHER'} · {GROUP_LABEL[screen].toUpperCase()}
          </Text>
          <View style={a.chips}>{initial.map(sg => renderSuggestion(sg))}</View>

          <TouchableOpacity
            style={a.moreBtn}
            onPress={() => setShowMore(v => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showMore }}
            accessibilityLabel={showMore ? 'Fewer questions' : 'More questions'}
          >
            <Text style={[a.moreText, { color: theme.text }, f('Inter_700Bold')]}>{showMore ? 'Fewer questions' : 'More questions'}</Text>
            <Ionicons name={showMore ? 'chevron-up' : 'chevron-down'} size={16} color={theme.textSecondary} />
          </TouchableOpacity>

          {showMore && groupedMore.map(([group, list]) => (
            <View key={group} style={{ gap: 8 }}>
              <Text style={[a.groupHead, { color: theme.textTertiary }, f('Inter_700Bold')]}>{GROUP_LABEL[group].toUpperCase()}</Text>
              <View style={a.chips}>{list.map(sg => renderSuggestion(sg, true))}</View>
            </View>
          ))}

          <TouchableOpacity
            style={[a.coachLink, { borderTopColor: theme.border }]}
            onPress={() => { onClose(); handlers.onNavigate('/coach'); }}
            accessibilityRole="button"
            accessibilityLabel="Open your personal AI coach"
          >
            <Text style={[a.coachText, { color: theme.text }, f('Inter_700Bold')]}>Open AI Coach</Text>
            <Text style={[a.sub, { color: theme.textSecondary, flex: 1 }, f('Inter_500Medium')]}>Conversations and plans</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
          </TouchableOpacity>
        </ScrollView>

        {/* Composer: the keyboard opens only when the user taps here. */}
        <View style={[a.composer, { borderTopColor: theme.border, backgroundColor: theme.bg }]}>
          <TextInput
            style={[a.input, { color: theme.text, backgroundColor: theme.card, borderColor: theme.border }, f('Inter_500Medium')]}
            value={input}
            onChangeText={t => setInput(t.slice(0, MAX_QUESTION_CHARS))}
            placeholder={context ? 'Ask your own question…' : 'Loading your day…'}
            placeholderTextColor={theme.textTertiary}
            editable={!!context}
            multiline
            maxLength={MAX_QUESTION_CHARS}
            returnKeyType="send"
            blurOnSubmit
            onSubmitEditing={() => send(input)}
            accessibilityLabel="Your question"
            maxFontSizeMultiplier={1.6}
          />
          <TouchableOpacity
            style={[a.sendBtn, { backgroundColor: input.trim() && canAsk ? theme.inverse : theme.surfaceStrong }]}
            onPress={() => send(input)}
            disabled={!input.trim() || !canAsk}
            accessibilityRole="button"
            accessibilityLabel="Send"
            accessibilityState={{ disabled: !input.trim() || !canAsk }}
          >
            <Ionicons name="arrow-up" size={20} color={input.trim() && canAsk ? theme.inverseText : theme.textTertiary} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function isMessage(m: any): m is AssistantMessage {
  return !!m && typeof m.id === 'string' && typeof m.text === 'string' && ['user', 'assistant', 'system'].includes(m.role);
}

function unavailable(question: string, text: string): AssistantMessage {
  return { id: newId(), role: 'assistant', at: new Date().toISOString(), source: 'unavailable', text, question };
}

function unavailableText(reason: 'unavailable' | 'no_server_chat' | 'offline', detail?: string): string {
  switch (reason) {
    case 'no_server_chat':
      return "GRITTT's server can't take open questions yet, only the suggested ones that use its existing coaching features. Your habits, logs and progress all work as normal.";
    case 'offline':
      return "Couldn't reach the server. Check your connection and retry; your question is kept above.";
    default:
      return `The AI service didn't answer${detail ? ` (${detail})` : ''}, so there's no reply to show. Nothing has been made up in its place.`;
  }
}

const a = StyleSheet.create({
  sheet:    { flex: 1, paddingTop: 8 },
  handle:   { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
  head:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1 },
  headIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headBtn:  { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title:    { fontSize: 20 },
  sub:      { fontSize: 13, lineHeight: 18, marginTop: 2 },
  content:  { padding: 16, gap: 12, paddingBottom: 24 },


  userBubble: { alignSelf: 'flex-end', maxWidth: '85%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, borderBottomRightRadius: 6 },
  userText:   { fontSize: 15, lineHeight: 21 },
  aiBubble:   { alignSelf: 'stretch', padding: 14, borderWidth: 1, borderRadius: 18, borderTopLeftRadius: 6, gap: 8 },
  tagRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tag:        { fontSize: 11, letterSpacing: 1.1 },
  body:       { fontSize: 15, lineHeight: 22 },
  basis:      { fontSize: 12, lineHeight: 17 },
  systemRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderWidth: 1, borderRadius: 14 },

  actions:    { gap: 8, marginTop: 4 },
  actionBtn:  { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: 14, borderWidth: 1.5, borderRadius: 999 },
  actionText: { fontSize: 14 },
  actionNote: { fontSize: 11, lineHeight: 15 },

  unavailableHead:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  unavailableTitle: { fontSize: 15, flex: 1 },
  retry:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: 16, borderWidth: 1.5, borderRadius: 999 },
  retryText:  { fontSize: 14 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },

  sectionHead: { fontSize: 11, letterSpacing: 1.2, marginTop: 8 },
  groupHead:   { fontSize: 10, letterSpacing: 1.1, marginTop: 6 },
  chips:       { gap: 8 },
  chip:        { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderRadius: 14 },
  chipText:    { fontSize: 15, flex: 1 },
  moreBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, alignSelf: 'flex-start' },
  moreText:    { fontSize: 14 },

  coachLink:  { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, minHeight: 48, paddingTop: 14, marginTop: 4, borderTopWidth: 1 },
  coachText:  { fontSize: 14 },

  composer:   { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 24, borderTopWidth: 1 },
  input:      { flex: 1, minHeight: 46, maxHeight: 120, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, borderWidth: 1, borderRadius: 16 },
  sendBtn:    { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
});
