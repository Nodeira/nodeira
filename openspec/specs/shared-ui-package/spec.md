## ADDED Requirements

### Requirement: `packages/ui` workspace is created as a shared component library

A new pnpm workspace `packages/ui` SHALL be created. It SHALL be a Vite library build targeting ESM. `apps/web` and `apps/desktop` SHALL both declare it as a workspace dependency and import shared components from it.

#### Scenario: Web app imports from shared package

- **WHEN** `apps/web` is built
- **THEN** shared components resolve from `@nodeira/ui` without duplication

#### Scenario: Desktop renderer imports from shared package

- **WHEN** `apps/desktop` renderer is built
- **THEN** shared components resolve from `@nodeira/ui` without duplication

---

### Requirement: Shared package exports presentational components only

`packages/ui` SHALL export only components that are pure presentational or editor-layer concerns: `NoteEditor`, `NoteList`, `Sidebar`, and shared layout primitives. Route-level components, TanStack Router bindings, and app-level providers SHALL remain in their respective app packages.

#### Scenario: Shared component renders in isolation

- **WHEN** a shared component from `@nodeira/ui` is rendered with required props
- **THEN** it renders correctly without importing anything from `apps/web` or `apps/desktop`

---

### Requirement: `apps/web` behaviour is unchanged after extraction

After extracting components into `packages/ui`, the web app SHALL pass all existing type checks and render identically to its pre-extraction state.

#### Scenario: Typecheck passes after extraction

- **WHEN** `pnpm run typecheck` is executed at the monorepo root
- **THEN** no type errors are reported in `apps/web` or `packages/ui`
