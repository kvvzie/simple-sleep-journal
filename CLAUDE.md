# Simple Sleep Journal - AI Assistant Guidelines

## Project Summary
- Minimalist sleep & mood journal with a body care / shaving razor blade wear tracker.
- Built with Expo SDK 57, React Native 0.86, React 19, TypeScript.
- Custom typography: Redaction font family.
- Storage: Local SQLite database via `expo-sqlite`, settings via `@react-native-async-storage/async-storage`.

## Code & Architecture Guidelines
- **UI Integrity**: Do not alter component visuals, spring animations, or layout behavior unless explicitly instructed.
- **Routing**: Expo Router `src/app`. Note that `src/app/(tabs)/_layout.tsx` renders an animated horizontal slider rather than the standard Expo Router `<Tabs />`.
- **Component Structure**: Components live under `src/components/<name>/` with an `index.ts` barrel file and a `<name>.styles.ts` file.
- **Pure Logic**: Mathematical calculations and data parsers should reside in `.utils.ts` or `src/constants/` to remain easily testable with Node.js built-in test runner.
- **No Unnecessary Dependencies**: Keep dependencies minimal. Use built-in Expo and React Native capabilities.

## Verification Commands
- `npm test`: Runs unit tests (`node:test`)
- `npm run typecheck`: TypeScript typecheck (`tsc --noEmit`)
- `npm run doctor`: Expo dependency doctor (`npx expo-doctor`)
