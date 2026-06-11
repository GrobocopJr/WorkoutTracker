# WorkoutTracker

A personal, offline-first workout tracking app for Android built with React Native and Expo.

## Features

- **Exercise library** — 800+ exercises from [free-exercise-db](https://github.com/yuhonas/free-exercise-db), searchable and filterable by equipment and muscle group (multi-select); tap the 🔍 icon to type-filter the filter chips, long-press a chip to ⭐ favorite it so it floats to the front (saved across launches); long-press any exercise card to ⭐ favorite it so it rises to the top of results in both the library and the Add Exercise picker; tap ✕ in the search box to instantly clear it
- **Custom exercises** — create your own exercises with equipment + muscle-group tags, rename an exercise mid-workout and optionally save it to the library, and delete custom exercises (app-bundled ones are protected)
- **Routine builder** — create named routines, add/reorder/remove exercises; drag the ☰ handle on any routine card to reorder your routines list (order persisted to SQLite); exercise picker includes equipment + multi-select muscle group filters
- **Active workout** — log sets with weight and reps, auto-filled from your last session for each exercise; add or remove sets on the fly, remove an exercise entirely, drag the ☰ handle to reorder exercises, and tap the chevron (or double-tap the title) to collapse an exercise into a compact summary (removing a logged set/exercise deletes it from history)
- **Smart routines** — exercises added, removed, or reordered during a workout sync back to the routine, and each exercise remembers how many sets it had so the next session pre-fills them
- **Resumable sessions** — the in-progress workout is saved to SQLite as you go, so it survives app reloads and restarts; a "Resume Current Workout" button on the home tab jumps you back in
- **Workout duration timer** — a count-up timer at the top of the active workout screen shows elapsed time; tap the pause/resume button to pause it (paused intervals are excluded from the total); timer state persists across navigation and app reloads; completed workout durations are shown on history cards
- **Exercise notes** — jot a note on any exercise (e.g. grip, cues, settings); notes are tied to the exercise and reappear every time it comes up in a future workout
- **Rest timer** — automatic countdown after each logged set with haptic feedback on completion
- **History calendar** — tap any date to see every set logged that day, grouped by exercise; rename or delete past workouts, with start/end times shown in Chicago time (America/Chicago, DST-aware)
- **Personal records** — per-exercise stats including last weight used, best weight, and estimated 1RM via the Epley formula; when a logged set beats your all-time best 1RM a 🏆 "New PR!" badge appears inline on that set row with a gold border, amber log button, and stronger haptic feedback; current best 1RM shown in faint text next to each exercise title during a workout (toggled via Settings)
- **Plate calculator** — tap the barbell icon on any set row to open a bottom-sheet calculator; enter a target weight and it shows exactly which plates to load on each side of the bar using a greedy algorithm (largest plates first); color-coded plate indicators (red=45, yellow=35, green=25, white=10, blue=5, gray=2.5); "Load into Set" writes the weight back to the set field; "Clear" resets the input; respects lbs/kg units setting
- **Dark mode** — System / Light / Dark toggle in Settings, persisted across launches
- **Show 1RM in Workout** — On/Off toggle in Settings to show or hide the best 1RM next to each exercise title during a workout
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
| Drag & drop | react-native-reorderable-list (gesture-handler + reanimated) |
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
    ExercisePicker.tsx    # Shared modal picker: search + equipment + multi-select muscle filters
    ExerciseEditor.tsx    # Modal form to create a custom exercise with equipment + muscle tags
    PlateCalculator.tsx   # Bottom-sheet plate calculator: greedy plate breakdown per side
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

`legacy-peer-deps=true` is set in `.npmrc` to handle a benign `react-dom` version-range conflict in the Expo dependency tree — no flag needed on the command line. Scan the QR code with Expo Go. The database is created and seeded on first launch.

### Running from WSL2

The Expo dev server binds to a WSL2-internal IP that Android devices on your LAN cannot reach. Use tunnel mode instead:

```bash
npx expo start --tunnel --port 8083
```

This routes traffic through Expo's servers so the Expo Go QR code works from any network. The first run will prompt to install `@expo/ngrok` — accept it.

Line endings are enforced to LF via `.gitattributes` to prevent CRLF issues when the repo is cloned on Windows and developed in WSL2.

## Database Schema

Core tables: `exercises` (an `is_custom` flag marks user-created exercises), `routines`, `routine_exercises` (ordered exercises per routine, with a remembered `target_sets` count), `sessions` (each with an optional custom `name`), `sets`, `exercise_notes` (per-exercise notes keyed by exercise), `active_session` (single-row snapshot of the in-progress workout for reload survival), plus a `settings` key-value table. All data lives on-device in SQLite — no backend, no network requests.

## Personal Records

Best estimated 1RM is calculated using the [Epley formula](https://en.wikipedia.org/wiki/One-repetition_maximum#Epley_formula):

```
1RM = weight × (1 + reps / 30)
```
