# Style guide (src/)

Guidance for code in `src/`. Follow this when adding or modifying library code so it matches the existing codebase and stays consistent for LLM and human readers.

## Formatting

- Use the project Prettier config: 4 spaces, single quotes, semicolons, ES5 trailing commas.
- Run `npm run eslint` before committing; the project extends Google TypeScript Style (gts).

## Naming

- **Classes, types, interfaces**: PascalCase 
- **Functions, methods, variables, parameters**: camelCase 
- **Constants** (enums or static config): UPPER_SNAKE_CASE when exported and immutable
- **Private instance fields**: prefix with underscore, camelCase 
- **Files**: Prefer camelCase 

## Imports

- Use namespace import for Three.js: `import * as THREE from 'three';`.
- Use relative paths for project modules 

## Exports and public API

- The **public API** is defined in `src/index.ts`. Only export from there what consumers should use.
- Internal modules may use `export` for types and classes used by other internal modules
- add new top-level exports to `index.ts` if there is intent to support them as public API.
- Prefer `export type` for type-only exports when re-exporting from `index.ts`.

## Types

- Use **interfaces** for object shapes 
- Use **type** for unions, aliases, and branded types 
- Prefer new types instead of anonymous objects if it simplifies code understanding
- Use **branded types** for indices and handles that must not be mixed 

## Comments and JSDoc

- Add JSDoc for public types and for non-obvious public methods (parameters, return value, brief description)
- Use inline comments for non-obvious logic (e.g. why geometry is cloned before applying a transform, or why a flag is checked).
- Avoid comments that only restate the code
- Do not swallow errors; propagate or rethrow with context.
- Add comments when there are opportunities for improvement using the following conventions for inline comments:
    - `//REFACTOR:` Refactoring -- the code should be refactored or improved, but is out of scope for the current task. 
    - `//OPTIMIZE:` Optimization -- the code should be optimized in a subsequent pass, but will require additional tes
    - `//PROFILE:` Profiling -- there is a potential performance issue that should be profiled    
    - `//VALIDATE:` Validation -- there are some assumptions that need to be validated. 

## Coding Style 

- Keep code succinct
- Prefer fewer arguments to functions
- One main concern per module or class. 
- Classes, interfaces, and functions should do one thing and do it well
- Break up large functions into smaller functions rather than using large functions that do many things with options
- Split new behavior into a focused module or class rather than overloading an existing one. 
- Prefer reuse by composition
- Prefer immutable classes 
- When developing examples, demos, and sample use existing libraries 
- Use defensive programming, checking invariants and assertions 
- Prefer logging to comments 
- Minimize side effects in functions, avoiding them where possible
- Prefer static functions where possible
- Prefer explicit return types on public functions and methods 

## Public API surface

- **The public API is what is re-exported from `src/index.ts`.** Do not add new exports there without a clear intent to support them long-term.
- Keep internal implementation in `src/` without re-exporting from `index.ts` if it is not part of the supported API. New features that are part of the supported API should be added to `index.ts` explicitly.
