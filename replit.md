# Madhorse UI

A browser-based game-creation engine intended to simplify building and shipping 2D and 3D games.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

Madhorse UI is planned as a simplified, high-powered game creation environment inspired by Unity and Unreal workflows. The current build is only the blank first-screen shell; the following are product requirements for later steps, not features that are implemented yet:

- 2D and 3D game creation, world building, modeling/sculpting, texturing, rendering, scene building, and full-length animation.
- Automatic physics for created and edited objects, plus an automatic player controller.
- A 2D UI builder with RPG, racing, sports, fighting, and RTS starting styles.
- Asset import/export, automatic registration of Mixamo animations and AI-created meshes/textures, and a database/library for animations.
- A help builder with step-by-step instructions and diagrams, plus caption-only tutorials.
- Project deployment output for APK and web-based games.

### Data boundaries

- The system's shared game knowledge library is maintained by the system and is not user-editable. It is intended to cover 10,000+ game types, styles, themes, and layouts that can be used as editable starting points inside a project.
- Each project has its own game database for project-specific rules and saved project data. Users can edit project rules in their project; the shared system library must remain separate and inaccessible for direct editing.
- Project data should sync between the project and the system automatically without exposing internal database controls to users.

## User preferences

- Build Madhorse UI step by step; do not implement the full engine all at once.
- Keep the current screen blank for the user to fill in later.
- Use a black, silver, and red visual theme, with a raging fire horse surrounding a flaming circle as the logo.
- Use the uploaded streaming overlay as the layout reference: a large central workspace, a top title tab, a bottom status strip, and compact panels below.

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
