import React from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';

/**
 * Apple's official "Sign in with Apple" button. Rendered natively so it always
 * matches Apple's Human Interface Guidelines (required by App Store guideline
 * 4.8). Renders nothing off iOS — Apple sign-in is an iOS-only capability.
 *
 * The native button has no loading state, so while a sign-in is in flight we
 * cover it with a spinner and block touches.
 */
export function AppleSignInButton({
  onPress,
  loading = false,
  type = 'SIGN_IN',
  isDark = true,
}: {
  onPress: () => void;
  loading?: boolean;
  /** SIGN_IN → "Sign in with Apple", SIGN_UP → "Sign up with Apple". */
  type?: 'SIGN_IN' | 'SIGN_UP';
  /** Black button on light UIs, white button on dark UIs (Apple's guidance). */
  isDark?: boolean;
}) {
  if (Platform.OS !== 'ios') return null;

  const buttonType =
    type === 'SIGN_UP'
      ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
      : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN;

  const buttonStyle = isDark
    ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
    : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK;

  return (
    <View style={styles.wrap}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={buttonType}
        buttonStyle={buttonStyle}
        cornerRadius={12}
        style={styles.btn}
        onPress={onPress}
      />
      {loading && (
        <View style={[styles.overlay, { backgroundColor: isDark ? '#FFFFFF' : '#000000' }]}>
          <ActivityIndicator color={isDark ? '#000000' : '#FFFFFF'} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  btn: { width: '100%', height: 48 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
