import { Redirect } from 'expo-router';

/**
 * Landing route for the `grittt://auth-done` deep link the OAuth callback page
 * redirects to.
 *
 * On current builds `openAuthSessionAsync` intercepts that URL and closes the
 * browser tab, so this route never renders. It exists for the cases where the
 * link reaches the router instead:
 *   - builds shipped before the openAuthSessionAsync change, which use
 *     openBrowserAsync and don't intercept anything
 *   - any future failure to intercept
 *
 * Without it those paths hit +not-found and the user finishes a successful
 * sign-in on a "this screen doesn't exist" page. Bounce to the root and let the
 * layout route on auth state, which the polling loop has already populated.
 */
export default function AuthDone() {
  return <Redirect href="/" />;
}
