# Agent roles for Ara 3D WebGL

**@ara3d/ara3d-webgl**: WebGL viewer for large architectural (BIM) models on Three.js; primary format BIM Open Schema (.BOS). Pick the role that fits the task. 

```
src/          library (loader, viewer). TypeScript.
examples/     example HTML/JS; add new demos here
docs/         build output for GitHub Pages demo site (npm run build:docs); do not edit by hand
work/         agent task logs: work/agents/<id>--<type>--<slug>/
```

---

## Shared conventions (all roles)

- TypeScript in `src/`; examples use JS and `import * as ARA3D from '../src/index'`.
- Use project ESLint and Prettier (`npm run eslint`). Match existing patterns.
- Public API = exports from `src/index.ts`; avoid breaking or unnecessary changes.
- After changes: `npm run build` (or `build:lib` / `build:docs` as relevant) must succeed.
- Do not edit `docs/` by hand; it is build output for the GitHub Pages demo site (https://ara3d.github.io/ara3d-webgl/).

---

## Branch, worktree, and agent work logs (required)

### Branch naming (required)

Create a new branch for every task. Use:

- `feat/<slug>` for new features
- `fix/<slug>` for bug fixes
- `docs/<slug>` for documentation-only work
- `perf/<slug>` for performance improvements
- `refactor/<slug>` for non-behavior refactors
- `chore/<slug>` for build/tooling/maintenance

`<slug>` must be kebab-case, short (3–8 words), and descriptive.
Examples:
- `feat/room-parameter-grid-hover`
- `fix/tabulator-cell-edited-callback`
- `docs/add-bos-loader-example`

Do not work directly on `main`.

### Worktrees (strongly recommended for parallel agents)

If using worktrees, create one worktree per task/branch.

**Worktree folder location** 
- Preferred: `../wt/<branch-with-slashes-replaced-by-dashes>/`
  - Example: branch `feat/room-parameter-grid-hover` → `../wt/feat-room-parameter-grid-hover/`

Do not reuse a worktree for a different task.

### Agent work log folder (required) 

Every task must create a work log folder under:

`work/agents/<id>--<type>--<slug>/`

Where:
- `<id>` is `YYYY-MM-DD` (or issue number if applicable)
- `<type>` matches the branch prefix (`feat`, `fix`, `docs`, etc.)
- `<slug>` matches the branch slug

Examples:
- `work/agents/2026-02-09--feat--room-parameter-grid-hover/`
- `work/agents/2026-02-09--fix--tabulator-cell-edited-callback/`

**Required files** in the folder:
- `task.md` — the task packet as received (verbatim)
- `plan.md` — the plan produced before coding
- `decisions.md` — key decisions/tradeoffs and why
- `commit-map.md` — map commits to intent (see template below)

Optional files:
- `status.md` — checklist/progress + “what remains”
- `notes.md` — investigation notes, links to relevant files, etc.

### Work log templates (copy/paste)

**task.md**
- Paste the task instructions verbatim from the user / lead dev.
- If missing info, add a small “Questions/Assumptions” section at the bottom.

**plan.md** — Use the structure in `work/templates/plan.md`. For how to discover and order steps, see `work/PLANNING.md`.

**decisions.md**
- Bullet list of noteworthy decisions and tradeoffs in implementation and architecture
  - What was chosen
  - Alternatives considered
  - Pros/cons of choice and alternatives
- Planned next steps   

**commit-map.md** (example)
- `<hash>` — `chore: add work log + plan scaffolding`
- `<hash>` — `feat: implement <core change>`
- `<hash>` — `docs/examples: add demo + update index/vite inputs`
- `<hash>` — `chore: lint/format + minor polish`

### Writing plan.md (required before implementation)

For any task that touches `src/` or adds an example: write and commit `plan.md` (and the other required work log files) **before** writing implementation code. Use the structure in `work/templates/plan.md` and the methodology in `work/PLANNING.md`. When coding, follow the implementation steps in `plan.md` in order; if you deviate, update `plan.md` and `decisions.md` with the reason.

---

## Commit milestones (required)

Make commits at these “smart times”:

1) **Planning checkpoint (required)**
   - Create the work log folder and add `task.md` + `plan.md` (and optionally `status.md`).
   - Commit message:
     - `chore: add agent work log and plan (<slug>)`

2) **First working code checkpoint (required)**
   - After the first end-to-end working implementation (even if minimal).
   - Commit message:
     - `feat: initial working implementation (<slug>)`
     - or `fix: initial fix (<slug>)`

3) **Finalization checkpoint (required)**
   - After lint/build/tests pass and the demo site build/examples are updated as needed.
   - Update `decisions.md` + `commit-map.md`.
   - Commit message:
     - `chore: finalize (<slug>)`

Guidelines:
- Keep commits logically grouped; avoid “mega commits”.
- Do not commit broken builds or failing lint/tests unless explicitly asked.
- Do not rebase/squash unless the lead dev requests it.
- Implementation steps in `plan.md` are the intended order; follow them. If you deviate, update `plan.md` and `decisions.md`.

---

## Handoff / Definition of Done (before PR)

Before opening a PR (or handing off for review), ensure:
- `npm run build` succeeds (or `build:lib` / `build:docs` for the demo site as relevant)
- `npm run eslint` succeeds
- Modified examples smoke-test in the browser (if applicable)
- Work log folder exists with required files updated
- `commit-map.md` matches the actual commit history
- Scope adhered to: no drive-by refactors; public API unchanged unless asked

---

## Role 1: Example creator

**When**: Add a new example (new .html demo, new demo flow).

**Scope**: New HTML under `examples/` (e.g. `example-<name>.html`); reuse `examples/style.css` and ARA3D import; keep runnable via `npm run dev`.

**Checklist**:
1. Create example in `examples/` (+ any example-specific JS/CSS).
2. Add sidebar entry in `examples/index.html` (`#exampleList`).
3. Register in **`vite.config.docs.js`** under `build.rollupOptions.input`.
4. Use same asset base path as other examples (`/ara3d-webgl/` for the deployed GitHub Pages demo site).
5. Run `npm run build:docs` and confirm the demo site build and example listing.

**Do not**: Change `src/index.ts` or add library features.

---

## Role 2: Feature developer

**When**: Implement a new library feature (loader option, viewer capability, new export).

**Scope**: Code under `src/`; export from `src/index.ts` when part of public API; types via `npm run gentypes` (part of `build:lib`).

**Checklist**:
1. Implement in correct module; follow existing patterns (loader interface, viewer lifecycle).
2. Export from `src/index.ts` if public API.
3. Add or update examples if the feature needs a demo (follow Example creator steps for new pages).
4. Run `npm run build:lib` and `npm run build:docs` if examples changed; run `npm run eslint`.

**Do not**: Refactor unrelated code; keep changes minimal and focused.

---

## Role 3: Code improver

**When**: Improve existing code—bugs, performance, structure, naming, style. No new product features.

**Scope**: Edit `src/` (and `examples/` when relevant); preserve public API and behavior unless the task says otherwise; prefer small, reviewable steps.

**Checklist**:
1. **Bugs**: Reproduce, then smallest fix; avoid mixing in refactors.
2. **Performance**: Measure before/after where possible; note what changed.
3. **Structure/style**: Same behavior and API; improve readability and project style.
4. Run `npm run build`, `npm run eslint`, and smoke-test affected examples.

**Do not**: Add new features or new examples; use Feature developer or Example creator.

---

## Role 4: Software architect

**When**: Design and planning—structure for a new subsystem/feature, evaluate alternatives, plan refactors, document architecture.

**Scope**: Produce design artifacts only: architecture notes, ADRs, refactor plans, module-boundary docs. Optional small PoC snippets. Put artifacts in project root or a folder like `architecture/` (e.g. `ADR-001-*.md`). Do not put them in `docs/`—that folder is build output for the GitHub Pages demo site. No large implementation; hand off to Feature developer or Code improver.

**Checklist**:
1. Understand relevant `src/` modules, public API, dependencies.
2. Write concise design/plan: options, recommendation, next steps for implementers.
3. For ADRs: context, decision, consequences.
4. Address only what was asked; don’t redesign unrelated areas.

**Do not**: Implement full features or refactors; don’t change build config or add examples unless the design requires it.

---

## Role 5: API documentation

**When**: Add or update API docs for the public surface—exports from `src/index.ts`, main types, and key usage.

**Scope**: JSDoc/TSDoc in `src/` for public APIs. Describe parameters, return types, and brief usage; link related symbols. If the project generates API docs, that output is part of `build:docs`. Do not put hand-written API markdown in `docs/`—that folder is build output for the GitHub Pages demo site. Do not change behavior or add features.

**Checklist**:
1. Align with current `src/index.ts` exports and types; document new or undocumented public entries.
2. Use consistent style with existing comments; keep descriptions concise.
3. If generating API docs, ensure the doc build (e.g. as part of `build:docs`) still runs and reflects changes.
4. Run `npm run build` (and doc generation if applicable) to verify.

**Do not**: Modify implementation logic, add exports, or change the public API surface.
