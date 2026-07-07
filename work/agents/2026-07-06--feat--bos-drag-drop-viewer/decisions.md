# Decisions

- **Replace on drop** — Dropping a new `.bos` removes the prior tracked content via `Viewer.removeContent()` rather than `Viewer.clear()`, so environment lights and ground plane stay in the scene.
- **Content tracking** — `Viewer.add()` sets `_content`; `remove()` clears the reference when the tracked object is removed.
- **Default enabled** — `fileDrop.enable` defaults to `true`. Stateful examples (selection, filters, rooms, level-colors) pass `{ fileDrop: { enable: false } }` because they hold stale `bimData` references in closure scope.
- **Drop zone** — Events attach to the viewer canvas only.
- **In-flight guard** — A `_loading` flag ignores additional drops while a file is parsing.
- **Visual feedback** — Inline canvas outline during drag-over (no external CSS dependency).
- **Memory** — Old geometry is not explicitly disposed on replace; acceptable for v1; follow-up if needed.

## Planned next steps

- Optional geometry disposal when replacing content.
- Optional `Viewer.onBosFileLoaded` delegates for consumers who do not want to reach into `inputs.bosFileDrop`.
