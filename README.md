# WorkoutTracker

A personal, offline-first workout tracking app for Android built with React Native and Expo.

## Features

- **Exercise library** — 800+ exercises searchable and filterable by equipment and muscle group; long-press chips or exercise cards to favorite them so they float to the top; detail page shows animated start/end images with fullscreen view
- **Custom exercises** — create exercises with equipment and muscle tags; rename mid-workout with the option to save permanently; app-bundled exercises are protected from deletion
- **Routine builder** — create named routines; add, reorder (drag handle), and remove exercises; order persists to SQLite
- **Active workout** — log sets with weight and reps auto-filled from your last session; add/remove sets and exercises on the fly; drag to reorder; tap ⓘ to view exercise detail without leaving the workout; Finish offers Keep Going, Discard, or Save & Finish
- **Smart routines** — exercise changes made during a workout (additions, removals, reorders, set counts) sync back to the routine template
- **Resumable sessions** — in-progress workouts survive app reloads; resume or finish from the home tab without navigating to the workout screen
- **Workout duration timer** — count-up timer starts on first logged set or "Start" tap; pause/resume supported; floating timer chip on every other screen shows live time and taps back to the workout
- **Exercise notes** — per-exercise notes (cues, grip, settings) persist across sessions
- **Session notes** — free-text note per workout session; add or edit via the notepad icon in the active workout header or inline on the summary screen; auto-saves as you type; displayed on history session cards
- **Rest timer** — auto-starts after each logged set with haptic feedback on completion
- **Volume tracking** — total tonnage (weight × reps) shown on history session cards; updates live as sets are logged
- **History calendar** — opens to today automatically; tap a workout card to view its full summary (stats, PR sets, session note); rename or delete past workouts; exercise names link to the detail page; times in Chicago time (DST-aware)
- **Workout summary** — shown after finishing a workout and accessible from history; displays duration, total volume, PR sets, and per-exercise set breakdown; session note is editable inline
- **Personal records** — last weight, best weight, and Epley est. 1RM per exercise; PR sets get a 🏆 badge, gold border, and stronger haptic; best 1RM shown next to exercise titles during a workout (toggleable in Settings)
- **Progress charts** — line chart on each exercise detail page (max weight, volume, or est. 1RM, pinch to zoom); dedicated comparison screen (chart icon in History header) overlays up to 8 exercises on one chart with a shared date axis and the same metric toggle
- **Plate calculator** — tap the barbell icon on any set row for a greedy plate breakdown per side with color-coded indicators; editable bar weight; "Load into Set" fills all unsaved sets; respects lbs/kg
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
| Drag & drop | react-native-reorderable-list (gesture-handler + reanimated) |
| Charts | react-native-svg (custom SVG line charts) |
| Haptics | expo-haptics + Vibration API |

## Project Structure

```
app/
  _layout.tsx           # Root layout: SQLiteProvider, ThemeLoader, GestureHandlerRootView, Stack navigator
  (tabs)/
    _layout.tsx         # Tab bar (Workout / Exercises / History / Settings)
    index.tsx           # Workout tab: routines list, start/resume workout
    exercises.tsx       # Exercise library with search + filters
    history.tsx         # Calendar view of past sessions
    settings.tsx        # Units, rest timer default, appearance
  workout/
    active.tsx          # Active workout screen: set logging, rest timer, reorder
    summary.tsx         # Workout summary: stats, PR sets, editable note; reached via finish flow or history tap
  exercises/
    [id].tsx            # Exercise detail: images, muscles, instructions, stats, progress chart
  charts.tsx            # Multi-exercise comparison chart (up to 8 exercises, shared date axis)
  routines/
    [id].tsx            # Routine editor: rename, add/remove/reorder exercises

src/
  db/
    schema.ts           # SQLite table definitions + initial settings seed
    queries.ts          # All typed async DB query functions
    seed.ts             # One-time exercise library seeder from bundled JSON
  store/
    workoutStore.ts     # Zustand: active session, sets, timer state
    themeStore.ts       # Zustand: theme override (system/light/dark)
  components/
    ExercisePicker.tsx  # Shared modal: search + equipment + multi-select muscle filters + favorites
    ExerciseEditor.tsx  # Modal form to create a custom exercise with equipment + muscle tags
    PlateCalculator.tsx # Bottom-sheet plate calculator: greedy breakdown per side, color-coded
    WorkoutTimerChip.tsx# Floating timer pill shown on all non-workout screens
    ProgressChart.tsx   # Single-exercise SVG line chart with pinch-to-zoom
    MultiLineChart.tsx  # Multi-exercise SVG line chart with shared date axis + pinch-to-zoom
  theme.ts              # Color palettes (light/dark) + useColors() / useIsDark() hooks
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

`legacy-peer-deps=true` is set in `.npmrc` to handle a benign `react-dom` version-range conflict in the Expo dependency tree. Scan the QR code with Expo Go. The database is created and seeded on first launch.

### Running from WSL2

The Expo dev server binds to a WSL2-internal IP that Android devices cannot reach directly. Use ADB wireless reverse tunneling instead.

#### One-time setup

1. On your Android phone: **Developer Options → Wireless Debugging** — enable it
2. On Windows: download [Android Platform Tools](https://developer.android.com/tools/releases/platform-tools) and extract to `C:\platform-tools`
3. In WSL2: first run requires your phone's wireless debugging IP and port:
   ```bash
   ~/expo-connect.sh 192.168.x.x PORT
   ```

#### Each development session

1. Enable **Wireless Debugging** on your phone and note the port shown on that screen
2. Reconnect ADB (only the port changes after toggling Wireless Debugging):
   ```bash
   ~/expo-connect.sh PORT
   ```
3. Start Metro:
   ```bash
   npx expo start --port 8083 --localhost
   ```
4. Scan the QR code with Expo Go, or connect manually via `exp://localhost:8083`

The `--localhost` flag makes Metro advertise `localhost` in the QR code, which resolves correctly through the ADB reverse tunnel. Line endings are enforced to LF via `.gitattributes` to prevent CRLF issues on Windows/WSL2.

## Database Schema

Core tables: `exercises` (`is_custom` flag marks user-created ones), `routines`, `routine_exercises` (ordered exercises per routine with a remembered `target_sets` count), `sessions`, `sets`, `exercise_notes` (per-exercise, keyed by exercise ID), `active_session` (single-row snapshot for reload survival), and a `settings` key-value table. All data lives on-device — no backend, no network requests.

## Personal Records

Best estimated 1RM is calculated using the [Epley formula](https://en.wikipedia.org/wiki/One-repetition_maximum#Epley_formula):

```
1RM = weight × (1 + reps / 30)
```
