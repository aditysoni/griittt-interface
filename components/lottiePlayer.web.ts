/**
 * Web has no Lottie player. lottie-react-native's web entry pulls in
 * @lottiefiles/dotlottie-react, a dependency this app doesn't carry, so the
 * boot sequence takes <FallbackMark> — pure RN Animated, which react-native-web
 * renders fine.
 */
export function getLottie(): null {
  return null;
}
