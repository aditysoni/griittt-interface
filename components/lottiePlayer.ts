/**
 * The Lottie player component, or null when it isn't usable on this platform.
 *
 * Kept behind a platform-suffixed module so the `require` is never in a file
 * the web bundler reads: lottie-react-native's web entry imports
 * @lottiefiles/dotlottie-react, which we don't ship. See lottiePlayer.web.ts.
 */
let cached: any;

/** Resolved once. Returns null when the JS package resolves but the native side
 *  isn't in the running binary. */
export function getLottie() {
  if (cached === undefined) {
    try {
      const m = require('lottie-react-native');
      cached = m?.default ?? m ?? null;
    } catch {
      cached = null;
    }
  }
  return cached;
}
