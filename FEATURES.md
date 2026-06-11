# Feature Backlog

Track planned features. Check off items as they are completed.

## In Progress
<!-- none -->

## Quality of Life
- [ ] **Bulk weight edit** — change the weight across all sets of an exercise at once from the active workout screen
- [ ] **Offline exercise images** — cache exercise images locally on first load so detail pages work without Wi-Fi

## Progress & Motivation
- [ ] **Muscle group volume dashboard** — weekly tonnage broken down by muscle group using the muscle tags already on each exercise; visualize training balance across chest, back, legs, etc.
- [ ] **Body weight log** — log body weight by date with a line chart; correlate strength progress with body composition over time
- [ ] **PR history** — log of every time a PR was set per exercise, not just the current best; shows the date and value of each lifetime PR
- [ ] **Weekly / monthly summary** — stats screen showing workouts per week, total volume, PRs set, and most-trained muscles over a selectable time period
- [ ] **Warm-up sets** — mark a set as warm-up so it's excluded from PR calculations and stats
- [ ] **Body weight exercises** — option to log bodyweight + added weight or just reps with no weight

## Workout Experience
- [ ] **Per-exercise rest timer** — save a default rest duration on each exercise that overrides the global setting; useful when some lifts need 3 min and others need 60 sec
- [ ] **Time-based sets** — log duration instead of reps for exercises like planks and carries; includes an in-set countdown timer
- [ ] **Session notes** — free-text note field on the session as a whole (separate from per-exercise notes); for logging context like fatigue level, location, or max-effort attempts
- [ ] **RPE logging** — optional Rate of Perceived Exertion (1–10) field per set alongside weight and reps
- [ ] **Superset grouping** — link two exercises together so they alternate sets

## Data & Export
- [ ] **CSV export** — dump all logged sets to a file shareable from the history screen
- [ ] **Backup / restore** — export and re-import the entire SQLite database as a JSON file

## Completed
- [x] **Progress charts** — SVG line chart on every exercise detail page showing max weight, total volume, or estimated 1RM over time; pinch the chart to zoom the date window in or out; exercise names in the History screen are tappable links to the detail page; a dedicated multi-exercise comparison chart is accessible via the chart icon in the History tab header — add up to eight exercises, each drawn in a distinct color on a shared date axis, with the same pinch-to-zoom and metric toggle
- [x] **Rest timer auto-start** — rest timer triggers automatically the moment a set is logged
- [x] **Set completion checkmarks** — logged sets show a filled green checkmark and a tinted background row; tapping the checkmark or re-entering a field un-logs the set for editing
- [x] **Last-time auto-fill** — weight and reps fields are pre-filled from your previous session for each exercise in light gray; typing any value instantly commits it as your own entry (gray clears to normal); extra sets beyond the previous session's count inherit the last known values
- [x] **Volume tracking** — total tonnage (weight x reps) summed across all sets, shown on history session cards alongside duration
- [x] **Workout duration timer** — elapsed time shown in a bar at the top of the active workout; timer starts only when the user taps "Start" or logs their first set (not on screen open); pause/resume button available after starting; timer state (including accumulated paused time) persists across navigation and app reloads via Zustand + SQLite; duration shown on history cards; resumed sessions restore timer state automatically
- [x] **Global timer chip** — a floating dark pill appears on every screen outside the active workout (Exercises, History, Settings, exercise detail, routine editor) showing the live elapsed time and paused/running state; tap it to jump directly back to the workout; persists through app reloads via Zustand store
- [x] **Single active workout enforcement** — once a workout is started (Start pressed or first set logged), all other routine cards in My Routines are greyed out and non-tappable; "Start Empty Workout" is also disabled; the active routine shows "In progress"; started state persists across navigation via Zustand store
- [x] **Undo set completion** — tap the green checkmark on a saved set, or tap directly into a saved weight or reps field, to un-log that set; the row reopens for editing, the PR badge is removed, and the DB row is deleted so the correction is clean
- [x] **Discard workout** — tapping "Finish" on the active workout screen now shows three choices: Keep Going, Discard (destroys all logged sets and removes the session from history after a second confirmation), and Save & Finish; a "Finish Workout" button on the home tab provides the same flow without needing to navigate to the workout screen first
- [x] **Plate calculator** — barbell icon on each set row opens a bottom-sheet calculator; greedy plate breakdown per side (largest first); color-coded plate indicators; editable bar weight field (defaults 45 lbs / 20 kg) for non-standard bars; "Load into Set" writes weight back to all unsaved sets for that exercise; "Clear" resets input; respects lbs/kg
- [x] **PR badges** — trophy icon + "New PR!" label appears inline below a set when its Epley 1RM (`weight x (1 + reps / 30)`) beats the all-time best for that exercise; log button turns amber and the set row gets a gold border; stronger haptic feedback on a PR hit
- [x] **Exercise images** — animated start/end position photos on every exercise detail page (sourced from free-exercise-db via jsDelivr CDN); auto-toggles every 1.2 s; tap to pause/resume; tap image to view fullscreen with 90% black backdrop; dismiss by tapping image or X button; ⓘ button in active workout opens exercise detail without leaving the session
- [x] **Auto-collapse on completion** — an exercise group collapses automatically once all its sets are logged
- [x] Exercise library with search, equipment filter, multi-select muscle filter
- [x] Type-to-filter chips (search icon per filter row)
- [x] Long-press to favorite equipment / muscle chips (float to front, persisted)
- [x] Long-press to favorite exercises (float to front, persisted)
- [x] Clear button in exercise search box
- [x] Card-style rows in Add Exercise picker
- [x] Custom exercise creation with equipment + muscle tags
- [x] Rename exercise mid-workout, option to save permanently
- [x] Delete custom exercises (app-seeded exercises protected)
- [x] Routine builder — create, rename, delete routines
- [x] Drag-to-reorder routines (handle, persisted)
- [x] Active workout — log sets with weight and reps, auto-filled from last session
- [x] Add / remove sets per exercise
- [x] Remove exercise from active workout
- [x] Drag-to-reorder exercises in active workout (handle)
- [x] Collapse / expand exercises (chevron tap or double-tap title)
- [x] Per-exercise notes (tied to exercise, reappear each session)
- [x] Smart routines — sync exercises + set counts back to routine after workout
- [x] Resumable sessions — in-progress workout survives reloads (SQLite-persisted)
- [x] Rest timer with haptic feedback
- [x] History calendar — view sets by date, rename / delete past workouts
- [x] Chicago-time display in history (DST-aware)
- [x] Personal records — last weight, best weight, estimated 1RM (Epley)
- [x] Dark mode — System / Light / Dark toggle, persisted
- [x] Weight units — lbs / kg app-wide
