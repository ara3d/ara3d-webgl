# How to create a plan (plan.md)

Use this when writing `plan.md` for a task. The goal is a plan that is concrete enough to code from, in order, without re-discovering the codebase mid-stream.

## Before you write the plan

1. **Read the task** — Understand the ask. Note any ambiguities; add a "Questions/Assumptions" section in `task.md` if needed.
2. **Read the relevant code** — Skim entry points (`src/index.ts`), the modules the task touches, and existing patterns (e.g. how other loaders or viewer features are structured). Use this to ground "files to change" and "implementation steps" in reality.

## Filling out plan.md

### Goal

One or two sentences: what will be true when the task is done. Be specific.

### Non-goals / scope boundaries

What you are **not** doing. Prevents scope creep. Examples: "No changes to the camera API"; "Only the BOS loader; no glTF changes."

### Risks and open questions

- What could go wrong or block progress?
- What is still unknown? Call out if something needs a decision from the user or lead.

### Files to change

List each file and **why** it’s touched. Derive this from the task and from reading the code, not from guessing. Examples:

- `src/loader/bimOpenSchemaLoader.ts` — add option X and pass through to Y
- `src/index.ts` — export new type Z
- `examples/example-bos.html` — use new option X

### Implementation steps (ordered)

Order steps by **dependency**: things that other steps depend on come first. Typical order:

1. Types / interfaces (if new or changed)
2. Core logic or data layer
3. Wiring (e.g. pass options, register callbacks)
4. Public API (exports in `src/index.ts`)
5. Examples or demo updates
6. Lint/format and final build check

Each step should be concrete enough that you can implement it and then move to the next without re-planning. If a step is large, split it into sub-steps.

### Test plan (exact commands)

- Commands to run: e.g. `npm run build:lib`, `npm run build:docs`, `npm run eslint`.
- How to verify behavior: e.g. "Open examples/example-bos.html in dev server and confirm X."

### Rollback plan

If the change has to be reverted (e.g. it breaks the demo site or a dependent app), what is the safest way? e.g. "Revert commit range X–Y" or "Disable feature flag Z."

## After the plan is committed

When coding, follow the implementation steps in order. If you deviate (e.g. you discover a better order or an extra file), update `plan.md` and `decisions.md` with what you did and why.
