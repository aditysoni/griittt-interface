# Sign in with Apple — backend contract

The app now ships a native "Sign in with Apple" flow (required by App Store
guideline 4.8). The app does its half; the backend at `grittt.online` must add
**one endpoint** to finish it.

## Endpoint

```
POST /api/auth/apple
Content-Type: application/json

{
  "identityToken": "<JWT signed by Apple>",
  "fullName": "Jane Appleseed" | null,   // present only on FIRST sign-in
  "email": "jane@privaterelay.appleid.com" | null  // present only on FIRST sign-in
}
```

**Response (200)** — identical shape to `/auth/login` and `/auth/signup`:

```json
{ "user": { ...User }, "token": "<our JWT>" }
```

On failure return a non-2xx with `{ "error": "..." }` (the app surfaces the message).

## What the endpoint must do

1. **Verify the identity token.** It's a JWT signed by Apple. Fetch Apple's
   public keys from `https://appleid.apple.com/auth/keys` (cache them), and
   verify the token signature (RS256). Then check the claims:
   - `iss` === `https://appleid.apple.com`
   - `aud` === `com.grittt.app`  ← our iOS bundle id
   - `exp` is in the future
   - (optional) `nonce` if you decide to add nonce support later
   Reject the request if any check fails.

2. **Identify the user.** The verified token's `sub` claim is a **stable,
   unique Apple user id** for our app. Use it as the primary key for the Apple
   identity (store it, e.g. `appleUserId`). The token also carries `email`
   (may be an `@privaterelay.appleid.com` relay address).

3. **Find or create the user.**
   - If a user already exists with this `appleUserId` → log them in.
   - Else, if a user exists with the same verified `email` → link `appleUserId`
     to that account (optional but nice for people who first signed up by email).
   - Else → create a new user. Use the `fullName`/`email` from the request body
     **only here, on first sign-in** — Apple only sends name/email the very first
     time a user authorizes the app, never again, so persist them now.

4. **Issue our JWT** exactly like login/signup does, and return `{ user, token }`.

## Notes / gotchas

- **Name & email are one-shot.** If you don't save them on the first call you
  can't get them again without the user revoking access in iOS Settings. The app
  forwards them but they'll be `null` on every subsequent sign-in.
- **Relay emails.** Users can hide their real email; you'll get a
  `…@privaterelay.appleid.com` address that forwards. Treat it as their email.
- **No client secret needed for this flow.** We verify the identity token
  directly; we are not doing the server-to-server `/auth/token` code exchange
  (that's only needed for refresh tokens / server-side session management).
- Suggested libraries: `apple-signin-auth` (Node) or `jose` + manual claim
  checks. Both handle the JWKS fetch/verify.

## Apple Developer portal (one-time, ops)

- Enable the **Sign in with Apple** capability on the App ID `com.grittt.app`
  (Certificates, Identifiers & Profiles). The app's entitlement is already set
  (`ios/Grittt/Grittt.entitlements`), and `app.json` has `ios.usesAppleSignIn: true`.
- Regenerate the provisioning profile after enabling the capability, then do a
  fresh native build (this can't ship as an OTA update — it adds a native module).
