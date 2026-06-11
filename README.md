# WorkoutTracker

A personal, offline-first workout tracking app for Android built with React Native and Expo.

## Features

- **Exercise library** — 800+ exercises from [free-exercise-db](https://github.com/yuhonas/free-exercise-db), searchable and filterable by equipment and muscle group (multi-select); tap the 🔍 icon to type-filter the filter chips, long-press a chip to ⭐ favorite it so it floats to the front (saved across launches); long-press any exercise card to ⭐ favorite it so it rises to the top of results in both the library and the Add Exercise picker; tap ✕ in the search box to instantly clear it; exercise detail page shows animated start/end position images (auto-toggles every 1.2 s, tap to pause/resume, tap image to go fullscreen)
- **Custom exercises** — create your own exercises with equipment + muscle-group tags, rename an exercise mid-workout and optionally save it to the library, and delete custom exercises (app-bundled ones are protected)
- **Routine builder** — create named routines, add/reorder/remove exercises; drag the ☰ handle on any routine card to reorder your routines list (order persisted to SQLite); exercise picker includes equipment + multi-select muscle group filters
- **Active workout** — a green "Start" button begins the session and starts the timer; logging your first set also starts the session automatically; once started, all other routines on the home tab are greyed out so you can't accidentally start a second workout — the active routine shows "In progress" and the started state persists across navigation; log sets with weight and reps; weight and reps fields are pre-filled with your last session's values in gray — start typing to replace them; tap the green checkmark on a saved set (or tap back into a saved field) to undo its completion and re-edit it; add or remove sets on the fly, remove an exercise entirely, drag the ☰ handle to reorder exercises, and tap the chevron (or double-tap the title) to collapse an exercise into a compact summary; an exercise auto-collapses when all its sets are logged; tap ⓘ next to the note field to open the exercise detail (images, muscles, instructions) without leaving the workout; tapping Finish shows three options — Keep Going, Discard (removes all sets and the session from history), or Save & Finish
- **Smart routines** — exercises added, removed, or reordered during a workout sync back to the routine, and each exercise remembers how many sets it had so the next session pre-fills them
- **Resumable sessions** — the in-progress workout is saved to SQLite as you go, so it survives app reloads and restarts; the home tab shows "Resume Current Workout" to jump back in, plus a "Finish Workout" button to save or discard the session without returning to the workout screen
- **Workout duration timer** — a count-up timer at the top of the active workout screen shows elapsed time; the timer starts when you tap "Start" or log your first set, not when you open the screen; tap the pause/resume button to pause it (paused intervals are excluded from the total); timer state persists across navigation and app reloads; a floating timer chip is visible on every other screen in the app (Exercises, History, Settings, exercise detail, routine editor) — it shows the live elapsed time and paused/running state, and tapping it navigates straight back to the workout; completed workout durations are shown on history cards
- **Exercise notes** — jot a note on any exercise (e.g. grip, cues, settings); notes are tied to the exercise and reappear every time it comes up in a future workout
- **Rest timer** — automatic countdown after each logged set with haptic feedback on completion
- **Volume tracking** — total tonnage (weight × reps, summed across all sets) shown on each history session card alongside the duration; updates automatically as sets are logged
- **History calendar** — tap any date to see every set logged that day, grouped by exercise; rename or delete past workouts, with start/end times shown in Chicago time (America/Chicago, DST-aware)
- **Personal records** — per-exercise stats including last weight used, best weight, and estimated 1RM via the Epley formula; when a logged set beats your all-time best 1RM a 🏆 "New PR!" badge appears inline on that set row with a gold border, amber log button, and stronger haptic feedback; current best 1RM shown in faint text next to each exercise title during a workout (toggled via Settings)
- **Progress charts** — every exercise detail page shows an SVG line chart of your logged history; toggle between Max Weight, Volume (total tonnage), and Est. 1RM; pinch the chart to zoom the visible date window in or out (minimum 3 sessions); exercise names on the History screen are blue tappable links that jump directly to the detail page; a dedicated **Progress** screen (chart icon in the History tab header) lets you overlay up to eight exercises on a single chart — each drawn in a distinct color on a shared date axis — with the same metric toggle and pinch-to-zoom
- **Plate calculator** — tap the barbell icon on any set row to open a bottom-sheet calculator; enter a target weight and it shows exactly which plates to load on each side of the bar using a greedy algorithm (largest plates first); color-coded plate indicators (red=45, yellow=35, green=25, white=10, blue=5, gray=2.5); bar weight is editable (defaults to 45 lbs / 20 kg) for non-standard bars; "Load into Set" writes the weight back to all unsaved sets; "Clear" resets the input; respects lbs/kg units setting
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
| Charts | react-native-svg (custom SVG line charts) |
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
    [id].tsx            # Exercise detail: muscles, instructions, personal stats, progress chart
  charts.tsx            # Multi-exercise comparison chart (up to 8 exercises, shared date axis)
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
    WorkoutTimerChip.tsx  # Floating timer pill shown on all screens during an active workout
    ProgressChart.tsx     # Single-exercise SVG line chart with pinch-to-zoom
    MultiLineChart.tsx    # Multi-exercise SVG line chart with shared date axis + pinch-to-zoom
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

The Expo dev server binds to a WSL2-internal IP that Android devices cannot reach directly. Use ADB wireless reverse tunneling instead — this routes Metro traffic from the phone through ADB to WSL2 with no external tunnel service required.

#### One-time setup

1. On your Android phone: **Developer Options → Wireless Debugging** — enable it
2. On Windows: download [Android Platform Tools](https://developer.android.com/tools/releases/platform-tools) and extract to `C:\platform-tools`
3. In WSL2: a helper script is included at `~/expo-connect.sh` — first run requires your phone's wireless debugging IP and port:
   ```bash
   ~/expo-connect.sh 192.168.x.x PORT
   ```

#### Each development session

1. Enable **Wireless Debugging** on your phone and note the IP and port shown on that screen
2. Run the connect script (just press Enter to reuse the saved IP — only the port changes after toggling Wireless Debugging):
   ```bash
   ~/expo-connect.sh PORT
   ```
3. Start Metro:
   ```bash
   npx expo start --port 8083 --localhost
   ```
4. Scan the QR code with Expo Go, or enter `exp://localhost:8083` manually

The `--localhost` flag makes Metro advertise `localhost` in the QR code, which resolves correctly through the ADB reverse tunnel.

Line endings are enforced to LF via `.gitattributes` to prevent CRLF issues when the repo is cloned on Windows and developed in WSL2.

## Database Schema

Core tables: `exercises` (an `is_custom` flag marks user-created exercises), `routines`, `routine_exercises` (ordered exercises per routine, with a remembered `target_sets` count), `sessions` (each with an optional custom `name`), `sets`, `exercise_notes` (per-exercise notes keyed by exercise), `active_session` (single-row snapshot of the in-progress workout for reload survival), plus a `settings` key-value table. All data lives on-device in SQLite — no backend, no network requests.

## Personal Records

Best estimated 1RM is calculated using the [Epley formula](https://en.wikipedia.org/wiki/One-repetition_maximum#Epley_formula):

```
1RM = weight × (1 + reps / 30)
```
