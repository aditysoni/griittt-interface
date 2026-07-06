import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/** Google-branded sign-in button. White surface per Google's brand guidelines,
 *  with a graceful loading state while the OAuth browser flow runs. */
export function GoogleSignInButton({
  onPress,
  loading = false,
  label = 'Continue with Google',
}: {
  onPress: () => void;
  loading?: boolean;
  label?: string;
}) {
  return (
    <Pressable
      style={[styles.btn, loading && styles.disabled]}
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {loading ? (
        <ActivityIndicator color="#3C4043" />
      ) : (
        <View style={styles.row}>
          <Ionicons name="logo-google" size={18} color="#4285F4" />
          <Text style={styles.text}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  text: { color: '#1F1F1F', fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
});
