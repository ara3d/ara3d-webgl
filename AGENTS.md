# Agent roles for Ara 3D WebGL

**@ara3d/ara3d-webgl**: WebGL viewer for large architectural (BIM) models on Three.js; primary format BIM Open Schema (.BOS). Pick the role that fits the task. 
    
```
src/          library (loader, viewer). TypeScript.
examples/     example HTML/JS; add new demos here
docs/         built output (build:docs); do not edit by hand
```

---

## Shared conventions (all roles)

- TypeScript in `src/`; examples use JS and `import * as ARA3D from '../src/index'`.
- Use project ESLint and Prettier (`npm run eslint`). Match existing patterns.
- Public API = exports from `src/index.ts`; avoid breaking or unnecessary changes.
- After changes: `npm run build` (or `build:lib` / `build:docs` as relevant) must succeed.

---

## Role 1: Example creator

**When**: Add a new example (new .html demo, new demo flow).

**Scope**: New HTML under `examples/` (e.g. `example-<name>.html`); reuse `examples/style.css` and ARA3D import; keep runnable via `npm run dev`.

**Checklist**:
1. Create example in `examples/` (+ any example-specific JS/CSS).
2. Add sidebar entry in `examples/index.html` (`#exampleList`).
3. Register in **`vite.config.docs.js`** under `build.rollupOptions.input`.
4. Use same asset base path as other examples (`/ara3d-webgl/` for deployed docs).
5. Run `npm run build:docs` and confirm build and listing.

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

**Scope**: Produce design artifacts only: architecture notes, ADRs, refactor plans, module-boundary docs. Optional small PoC snippets. Prefer `docs/` or root (e.g. `docs/architecture/`, `ADR-*.md`). No large implementation; hand off to Feature developer or Code improver.

**Checklist**:
1. Understand relevant `src/` modules, public API, dependencies.
2. Write concise design/plan: options, recommendation, next steps for implementers.
3. For ADRs: context, decision, consequences.
4. Address only what was asked; don’t redesign unrelated areas.

**Do not**: Implement full features or refactors; don’t change build config or add examples unless the design requires it.

---

## Role 5: API documentation

**When**: Add or update API docs for the public surface—exports from `src/index.ts`, main types, and key usage.

**Scope**: JSDoc/TSDoc in `src/` for public APIs, and/or standalone API docs in `docs/` (e.g. markdown or generated from comments). Describe parameters, return types, and brief usage; link related symbols. Do not change behavior or add features.

**Checklist**:
1. Align with current `src/index.ts` exports and types; document new or undocumented public entries.
2. Use consistent style with existing comments; keep descriptions concise.
3. If generating docs, ensure the doc build (e.g. as part of `build:docs`) still runs and reflects changes.
4. Run `npm run build` (and doc generation if applicable) to verify.

**Do not**: Modify implementation logic, add exports, or change the public API surface.
