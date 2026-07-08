import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from './ThemeContext';

/**
 * Shown when a screen's data fetch fails, instead of silently rendering an
 * empty/zeroed view (which reads as "no data" rather than "couldn't load").
 * Gives the user a clear message and a Retry button.
 */
export function ErrorState({
  message = "Couldn't load your data.",
  onRetry,
  compact = false,
}: {
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <Ionicons name="cloud-offline-outline" size={compact ? 26 : 36} color={theme.textMuted} />
      <Text style={[styles.msg, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}>
        {message}
      </Text>
      <Text style={[styles.hint, { color: theme.textMuted, fontFamily: 'Inter_500Medium' }]}>
        Check that you're online and the server is reachable.
      </Text>
      {onRetry && (
        <TouchableOpacity
          style={[styles.btn, { borderColor: theme.inverse }]}
          onPress={onRetry}
          activeOpacity={0.8}
        >
          <Ionicons name="refresh" size={15} color={theme.text} />
          <Text style={[styles.btnText, { color: theme.text, fontFamily: 'Inter_700Bold' }]}>RETRY</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:        { alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 56, paddingHorizontal: 32 },
  wrapCompact: { paddingVertical: 28 },
  msg:         { fontSize: 15, textAlign: 'center' },
  hint:        { fontSize: 12, textAlign: 'center', marginTop: -2 },
  btn:         { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10, marginTop: 8 },
  btnText:     { fontSize: 12, letterSpacing: 1 },
});
