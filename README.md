# WorkoutTracker

A personal, offline-first workout tracking app for Android built with React Native and Expo.

## Features

- **Exercise library** — 800+ exercises from [free-exercise-db](https://github.com/yuhonas/free-exercise-db), searchable and filterable by equipment and muscle group (multi-select)
- **Routine builder** — create named routines, add/reorder/remove exercises; exercise picker includes equipment + multi-select muscle group filters
- **Active workout** — log sets with weight and reps, auto-filled from your last session for each exercise; add or remove sets on the fly, or remove an exercise entirely (removing a logged set/exercise deletes it from history)
- **Resumable sessions** — the in-progress workout is saved to SQLite as you go, so it survives app reloads and restarts; a "Resume Current Workout" button on the home tab jumps you back in
- **Exercise notes** — jot a note on any exercise (e.g. grip, cues, settings); notes are tied to the exercise and reappear every time it comes up in a future workout
- **Rest timer** — automatic countdown after each logged set with haptic feedback on completion
- **History calendar** — tap any date to see every set logged that day, grouped by exercise
- **Personal records** — per-exercise stats including last weight used, best weight, and estimated 1RM via the Epley formula
- **Dark mode** — System / Light / Dark toggle in Settings, persisted across launches
- **Weight units** — lbs or kg, app-wide

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | React Native + Expo SDK 54 (managed workflow) |
| Routing | expo-router v6 (file-based) |
| Database | expo-sqlite v16 (local SQLite, offline-first) |
| State | Zustand (active workout session + theme override) |
| UI | React Native core + @expo/vector-icons (Ionicons) |
| Calendar | react-native-calendars |
| Haptics | expo-haptics + Vibration API |

## Project Structure

```
app/
  _layout.tsx           # Root layout: SQLiteProvider, ThemeLoader, Stack navigator
  (tabs)/
    _layout.tsx         # Tab bar (Workout / Exercises / History / Settings)
    index.tsx           # Workout tab: routines list, start workout
    exercises.tsx       # Exercise library with search + filters
    history.tsx         # Calendar view of past sessions
    settings.tsx        # Units, rest timer default, appearance
  workout/
    active.tsx          # Active workout screen: set logging, rest timer
  exercises/
    [id].tsx            # Exercise detail: muscles, instructions, personal stats
  routines/
    [id].tsx            # Routine editor: rename, add/remove exercises

src/
  db/
    schema.ts           # SQLite table definitions + initial settings seed
    queries.ts          # All typed async DB query functions
    seed.ts             # One-time exercise library seeder from bundled JSON
  store/
    workoutStore.ts     # Zustand: active session, sets, rest timer
    themeStore.ts       # Zustand: theme override (system/light/dark)
  components/
    ExercisePicker.tsx  # Shared modal picker: search + equipment + multi-select muscle filters
  theme.ts              # Color palettes + useColors() / useIsDark() hooks
  types/
    index.ts            # TypeScript interfaces for all domain models

assets/
  data/
    exercises.json      # Bundled exercise library (~800 exercises)
```

## Running Locally

Requires [Node.js](https://nodejs.org) and the [Expo Go](https://expo.dev/go) app (SDK 54) on your device.

```bash
cd WorkoutTracker
npm install
npx expo start
```

Scan the QR code with Expo Go. The database is created and seeded on first launch.

## Database Schema

Core tables: `exercises`, `routines`, `routine_exercises`, `sessions`, `sets`, `exercise_notes` (per-exercise notes keyed by exercise), `active_session` (single-row snapshot of the in-progress workout for reload survival), plus a `settings` key-value table. All data lives on-device in SQLite — no backend, no network requests.

## Personal Records

Best estimated 1RM is calculated using the [Epley formula](https://en.wikipedia.org/wiki/One-repetition_maximum#Epley_formula):

```
1RM = weight × (1 + reps / 30)
```
