# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Selected product direction

- Recreate ideation option 1: a warm, editorial, Russian-language step-by-step assistant.
- Keep one dominant action: enter a company website and city, then generate human-readable Avito listing drafts.
- Preserve the warm ivory surface, charcoal typography, orange accent, sunlit office photography, and three-step explanation from `design-reference.png`.
- Swagger remains developer-only; the root experience must be understandable to a non-technical business owner.
- Generate and visibly show SEO search phrases for Avito; embed them naturally in the title and description instead of adding a keyword dump.
- Never generate product imagery. Reuse only real photographs discovered on the source website and show their source.
