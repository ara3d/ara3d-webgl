# Plan: BOS drag-and-drop in Viewer

## Goal

Users can drag a local `.bos` file onto the viewer canvas and the model opens automatically, replacing any previously loaded content.

## Non-goals / scope boundaries

- Hot-swapping in stateful examples (selection, filters, rooms, level-colors).
- glTF drag-drop.
- File picker UI.
- Manual edits to `docs/`.

## Risks and open questions

- `viewer.clear()` removes environment; use content tracking instead.
- Old geometry not disposed on replace (acceptable v1 follow-up).

## Files to change

- `src/loader/bimOpenSchemaLoader.ts` — buffer/file load API
- `src/viewer/inputs/bosFileDrop.ts` — new drag-drop handler
- `src/viewer/viewerSettings.ts` — fileDrop settings
- `src/viewer/inputs/input.ts` — wire handler
- `src/viewer/viewer.ts` — content tracking
- Stateful BOS examples — disable fileDrop

## Implementation steps (ordered)

1. Loader buffer API
2. Viewer content tracking
3. Settings
4. BosFileDropHandler
5. Wire Input + Viewer
6. Examples
7. Build/lint

## Test plan (exact commands)

- `npm run eslint`
- `npm run build`
- `npm run build:docs`
- Manual: drop .bos on basic example; verify replace; verify stateful examples ignore drop

## Rollback plan

Revert branch `feat/bos-drag-drop-viewer`.
