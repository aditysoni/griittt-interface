# Grittt

The Grittt mobile app — a React Native / Expo client for habit, fitness, and nutrition tracking. Built with Expo Router (file-based routing), TypeScript, and a REST backend.

## Tech stack

- **Expo** `~54.0` (SDK 54) with the New Architecture
- **React Native** `0.81` / **React** `19.1`
- **expo-router** `~6.0` — file-based routing with typed routes
- **TypeScript** `~5.3`
- **react-native-reanimated** `~4.1` + gesture-handler for animations
- **EAS** for builds and submission

## Prerequisites

- Node.js 18+ and npm
- [Expo CLI](https://docs.expo.dev/) (run via `npx expo`)
- iOS Simulator (Xcode) and/or Android emulator (Android Studio) for native builds
- An [Expo](https://expo.dev) account for EAS builds

> This project uses a **development client** (`expo-dev-client`), so some native modules require a dev build rather than Expo Go.

## Setup

```bash
# Install dependencies (repo pins legacy-peer-deps via .npmrc)
npm install

# Create your local env file
cp .env .env.local   # or edit .env directly
```

### Environment variables

Configured via `.env` (Expo reads `EXPO_PUBLIC_*` vars at build time):

| Variable               | Description                          | Default (dev)            |
| ---------------------- | ------------------------------------ | ------------------------ |
| `EXPO_PUBLIC_API_BASE` | Base URL of the Grittt REST backend  | `http://192.168.1.6:3001` |

The API client (`lib/api.ts`) appends `/api` to this base. EAS build profiles point at `https://grittt.online` (see `eas.json`).

## Running the app

```bash
npm start        # start the Metro bundler / Expo dev server
npm run ios      # open in the iOS Simulator
npm run android  # open in the Android emulator
```

## Project structure

```
app/                 # Screens & routes (expo-router, file-based)
  _layout.tsx        # Root layout: fonts, AuthProvider, ThemeProvider, auth gating
  (auth)/            # login, signup, onboarding
  (tabs)/            # Main tab screens: index, challenges, fuel, strength, ai, profile
  edit-profile.tsx
  first-win.tsx
  +not-found.tsx
components/          # Reusable UI (Gauge, ProgressBar, DaySelector, theme, ThemeContext, …)
lib/
  api.ts             # REST client + shared types (User, MacroTargets, OnboardingPayload…)
  auth.tsx           # AuthProvider / useAuth — session, login, Google OAuth, onboarding
  storage.ts         # AsyncStorage wrapper for token/session persistence
assets/              # Icons, splash, fonts
store/               # Play Store listing assets, privacy policy, console setup guide
app.json             # Expo app config
eas.json             # EAS build/submit profiles
```

## Routing & auth flow

Routing is file-based via `expo-router` with typed routes enabled (`experiments.typedRoutes`). The root layout (`app/_layout.tsx`) gates navigation:

- Unauthenticated users are routed to `(auth)` (login / signup).
- After signup, users go through `(auth)/onboarding` until `onboardingDone` is set.
- Authenticated, onboarded users land in `(tabs)`.

Auth (including server-side Google OAuth) is handled by `lib/auth.tsx` via the `useAuth()` hook.

## Building with EAS

Build profiles are defined in `eas.json`:

- **development** — internal APK with dev client
- **preview** — internal APK
- **production** — Android app bundle (auto-incrementing version)

```bash
npx eas build --profile development --platform android
npx eas build --profile production --platform android
```

All profiles set `EXPO_PUBLIC_API_BASE` to the production backend.

## Notes

- **Theme:** the app defaults to a dark UI (`userInterfaceStyle: "dark"`), managed via `components/ThemeContext.tsx`.
- **Fonts:** Inter, Space Grotesk, and Bricolage Grotesque are loaded at startup.
- **Permissions:** camera and photo-library access are requested for food tracking (`expo-image-picker`).
