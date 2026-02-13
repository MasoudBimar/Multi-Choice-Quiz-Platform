# Quiz Forge (Angular 21 MCQ Platform)

A production-style MCQ quiz platform built with Angular 21 standalone APIs, Angular Signals, @ngrx/signals SignalStore, Angular Material 3 theming, and Tailwind utilities.

## Stack

- Angular 21 (standalone components + signals)
- Angular Material 3 (official theming via `mat.theme` + system variables)
- Tailwind CSS v4
- State management: `@ngrx/signals` SignalStore
- Persistence: `localStorage` with in-memory fallback
- Tests: Native Angular 21 test runner (Vitest)

## Features

- Quiz catalog loaded from `assets/quizzes/index.json`
- Multiple quiz packs (JSON-driven content)
- Runtime schema validation for catalog and quiz payloads
- Deterministic seeded randomization for question + answer order
- Resume/restart attempts with stable ordering across refresh
- Progress tracking, scoring, and detailed review results
- Attempt history and aggregated stats persisted per quiz
- Dark mode preference persisted via UI prefs store
- Compatibility protection when quiz version/content changes

## Folder Structure

```text
src/app/
  core/
    services/
    utils/
  data/
    models/
    services/
    validation/
  state/
    stores/
    tokens/
  features/quizzes/
    components/
    pages/
    resolvers/
```

## Local Persistence Keys

- `quiz_attempt::<quizId>`: latest attempt snapshot per quiz
- `quiz_attempt_archive::<attemptId>`: archived finished attempt details for results replay
- `quiz_history`: global array of attempt summaries
- `quiz_stats::<quizId>`: aggregated quiz statistics
- `ui_prefs`: UI theme preference

## Run

```bash
pnpm install
pnpm start
```

App URL: `http://localhost:4200`

## Test (Vitest via `ng test`)

```bash
pnpm test
```

Optional watch mode:

```bash
pnpm test:watch
```

## Build

```bash
pnpm build
```

## Architecture Notes

- `QuizCatalogStore` (root store): loads catalog + definitions, caches quiz metadata, exposes stats snapshots.
- `QuizAttemptStore` (route-scoped store): one store instance per `/quiz/:quizId` route context, handles attempt lifecycle, derived scoring/results selectors, and debounced persistence.
- `UiPrefsStore` (root store): dark/light mode signal with persistent storage and body theme class sync.
- Randomization uses `mulberry32` seeded by hashed string seed to keep order reproducible on resume.
- Quiz JSON is validated at runtime with lightweight custom validators and routed to an error view when invalid.
