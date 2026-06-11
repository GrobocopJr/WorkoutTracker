# Feature Backlog

Track planned features. Check off items as they are completed.

## In Progress
<!-- none -->

## Quality of Life
- [ ] **Rest timer auto-start** — auto-trigger the rest timer the moment a set is logged
- [ ] **Set completion checkmarks** — visually tick off each set as you log it so you don't lose your place mid-workout

## Progress & Motivation
- [ ] **Progress charts** — line graph of weight or volume over time per exercise, viewable from the exercise detail screen
- [ ] **Warm-up sets** — mark a set as warm-up so it's excluded from PR calculations and stats
- [ ] **Body weight exercises** — option to log bodyweight + added weight or just reps with no weight

## Workout Experience
- [ ] **Superset grouping** — link two exercises together so they alternate sets
- [ ] **Workout templates from history** — turn any past session into a new routine with one tap

## Data & Export
- [ ] **CSV export** — dump all logged sets to a file shareable from the history screen
- [ ] **Backup / restore** — export and re-import the entire SQLite database as a JSON file

## Completed
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
