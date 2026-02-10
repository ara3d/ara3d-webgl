# Style guide (src/)

Guidance for code in `src/`. Follow this when adding or modifying library code so it matches the existing codebase and stays consistent for LLM and human readers.

## Formatting

- Use the project Prettier config: 4 spaces, single quotes, semicolons, ES5 trailing commas.
- Run `npm run eslint` before committing; the project extends Google TypeScript Style (gts).

## Naming

- **Classes, types, interfaces**: PascalCase (`Viewer`, `BimData`, `Settings`).
- **Functions, methods, variables, parameters**: camelCase (`buildGeometry`, `getSettings`, `onResize`).
- **Constants** (enums or static config): UPPER_SNAKE_CASE when exported and immutable (`KEYS`).
- **Private instance fields**: prefix with underscore, camelCase (`_viewport`, `_onResize`, `_allowedMovement`).
- **Files**: Prefer camelCase (`bimData.ts`, `viewerSettings.ts`). PascalCase is used when the file has a single main export named exactly like the file (`DataTable.ts`, `BimParameterDescriptors.ts`). When in doubt, use camelCase.

## Imports

- Use namespace import for Three.js: `import * as THREE from 'three';`.
- Use relative paths for project modules (`./viewerSettings`, `../viewport`).
- Order: external packages first (three, jszip, deepmerge, ste-signals), then local by depth (e.g. viewer before viewer/camera).

## Exports and public API

- The **public API** is defined in `src/index.ts`. Only export from there what consumers should use.
- Internal modules may use `export` for types and classes used by other internal modules; do not add new top-level exports to `index.ts` without intent to support them as public API.
- Prefer `export type` for type-only exports when re-exporting from `index.ts`.

## Types

- Use **interfaces** for object shapes (e.g. `BimGeometry`, `Settings`).
- Use **type** for unions, aliases, and branded types (e.g. `PointerMode`, `EntityIndex`, `PartialSettings`).
- Branded number types for type-safe indices: `number & { __brand: "EntityIndex" }` (see `bimData.ts`).

## Comments and JSDoc

- Add JSDoc for public types and for non-obvious public methods (parameters, return value, brief description).
- Use inline comments for non-obvious logic (e.g. why geometry is cloned before applying a transform, or why a flag is checked).
- Avoid comments that only restate the code.

## Async and errors

- Loaders and other async APIs: use `async/await` and return `Promise<T>`.
- On failure, throw `new Error('clear message')` with enough context (e.g. URL, status, or what was expected).
- Do not swallow errors; propagate or rethrow with context.

## Miscellaneous

- Prefer `Array<T>` over `T[]` for consistency in exported types and function signatures (both exist in the codebase; prefer `Array<T>` for new code when touching those areas).
- Avoid `console.log` in production code paths; remove or gate behind a debug flag if added during development.
