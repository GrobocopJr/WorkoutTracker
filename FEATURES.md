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
- [ ] **"Last time" preview** — show the full previous session's sets for an exercise before logging, not just last weight/reps
- [ ] **Workout templates from history** — turn any past session into a new routine with one tap

## Data & Export
- [ ] **CSV export** — dump all logged sets to a file shareable from the history screen
- [ ] **Backup / restore** — export and re-import the entire SQLite database as a JSON file

## Completed
- [x] **Volume tracking** — total tonnage (weight × reps) summed across all sets, shown on history session cards alongside duration
- [x] **Workout duration timer** — elapsed time shown in a bar at the top of the active workout; pause/resume button; timer state (including accumulated paused time) persists across navigation and app reloads via Zustand + SQLite; duration shown on history cards
- [x] **Plate calculator** — barbell icon on each set row opens a bottom-sheet calculator; greedy plate breakdown per side (largest first); color-coded plate indicators; "Load into Set" writes weight back to the set; "Clear" resets input; respects lbs/kg
- [x] **PR badges** — trophy icon + "New PR!" label appears inline below a set when its Epley 1RM (`weight × (1 + reps / 30)`) beats the all-time best for that exercise; log button turns amber and the set row gets a gold border; stronger haptic feedback on a PR hit
- [x] Exercise library with search, equipment filter, multi-select muscle filter
- [x] Type-to-filter chips (🔍 icon per filter row)
- [x] Long-press to favorite equipment / muscle chips (float to front, persisted)
- [x] Long-press to favorite exercises (float to front, persisted)
- [x] Clear button (✕) in exercise search box
- [x] Card-style rows in Add Exercise picker
- [x] Custom exercise creation with equipment + muscle tags
- [x] Rename exercise mid-workout, option to save permanently
- [x] Delete custom exercises (app-seeded exercises protected)
- [x] Routine builder — create, rename, delete routines
- [x] Drag-to-reorder routines (☰ handle, persisted)
- [x] Active workout — log sets with weight and reps, auto-filled from last session
- [x] Add / remove sets per exercise
- [x] Remove exercise from active workout
- [x] Drag-to-reorder exercises in active workout (☰ handle)
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
