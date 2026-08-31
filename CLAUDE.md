## Communication

When responding to the user, or writing reports, speak plainly, 
avoid jargon and shorthand, don't use unnecessary words or sentences.

## Coding and Architecture Principles

These are the overriding principles:

1. Code must be correct and work well
2. Code must be easy to improve and refactor
3. Make decisions that help multiple agents working in parallel on a local machine 

## Git

Never create branches automatically. 
Commit to the current branch, even when it is the default branch do NOT branch first. 
Only create a branch if user explicitly asks for one.
Commit after each major milestone (a completed, verified unit of work) without asking, then push right away (no need to ask).
Before starting new work, make sure the working tree has a clean commit point for the files about to change (commit or surface any pending edits first) so the work can be reverted cleanly.
Never use `commit -a` or `add .` — always use a pathspec, staging only the files you edited.

## Software Architecture

Split modules early and aggressively - prefer many small modules over a few large ones, even before size forces the issue. Small modules keep dependencies explicit, reduce coupling, make testing and refactoring cheaper, and let parallel agents work without stepping on each other.

## Coding Guidelines

- Functions, files, and types should ideally have a well-defined role obvious from the name
- Keep functions, files, and types small and dense  
- Refactor frequently and early if it helps maintain the principles here
- Prefer immutable data types, pure functions free of effects, and composition over inheritance
- Prefer expressions to statements
- Functions should prefer to accept interfaces or generics
- Interfaces should be as small as possible to define the minimal required set of functions  
- Only add comments when useful, and keep them succinct

## The Standard Workflow (do things in steps)

Work in small, verifiable increments. 
Never combine "make it work" with "make it pretty" in the same step.

1. **Add code + tests** for the smallest useful slice of behavior.
2. **Verify it works** - build and run the tests. Do not proceed on a red build.
3. **Plan the refactor** - note what should improve. Add `// TODO:` markers in code (see below)
4. **Save the state** - this is a natural stopping/commit point. The working version is preserved.
5. **Apply the refactor** - change structure, not behavior. Tests prove you don't break anything.

> **Never refactor on a red build.** If tests are failing, get them green first, then refactor.

When given a multi-step task, use a todo list and keep it current.

## Best Practices

- **Write code as if writing a public API** - this encourages clean separation of concerns 
- **Eat your own dogfood:** consume existing SDK APIs before adding new ones; awkwardness in an existing API is a reason to improve it, not bypass it.
- **Design for relocation:** code should move cleanly between projects/layers - few, explicit dependencies.
- **Write for the next learner:** someone else must be able to learn and use it quickly.
- **Obvious usage:** correct use discoverable from signatures and names alone.
- **Types and affordances guide correct use:** illegal states unrepresentable; misuse a compile error where possible.
- **Path of least resistance = best practice:** the easiest way must be the right way.
- **Composition and reuse by default:** every new piece is a candidate building block.

These are ordered roughly by how often they apply.

- **Keep it simple at first.** Start with the most direct solution that could work.
- **Use as little code as possible** to achieve the goal. Less code = fewer bugs, easier refactors.
- **Make it work before you improve it.** Resist premature abstraction and premature optimization.
- **Avoid repetition.** The second time you copy-paste, stop and extract a helper.
- **Reuse code when it makes sense** - but do not contort code to force reuse.
- **Minimize side effects.** Prefer functions that take inputs and return outputs.
- **Minimize dependencies.** - When new dependencies must be added, consider whether refactoring in warranted. 
- **Identify and track areas for improvement** instead of fixing everything at once 
- **Minimize the chance of breaking things when adding code.** Add alongside; don't rewrite working code unless that is the task.

## Function Properties

Evaluate functions against these properties, **in this order** - earlier ones win when they conflict:

1. **Correct** - it computes the right answer.
2. **Composable** - it combines cleanly with other functions.
3. **Reusable** - it generalizes beyond the one call site.
4. **Functional** - inputs to outputs; prefer expressions.
5. **Side-effect free** - no mutation of inputs or shared state.
6. **Succinct** - as little code as the above allow.
7. **Easily verifiable** - obvious to read and test for correctness.

A more efficient or mutable variant is a **later** step, and should land as a *separate*
function that can be compared against the canonical functional implementation - never by
compromising the canonical one.

## Comments

- Don't comment obvious things
- Never use comments to explain the change you are making — that belongs in the commit message, not the source
- The only long-lived inline marker is `// TODO:` for tracked improvements

## Tracking Improvements

Don't fix everything at once, and don't silently leave messes. 
When you spot something worth improving but out of scope  
add a `// TODO:` marker at the spot in the code, with a short description that is actionable and specific.


## Testing

The goal of tests is fast iteration on small, localized changes without giving up confidence.
Match the test scope to the blast radius of the change. 
Don't rerun everything for small changes
Label tests so that they can be scoped properly. 
