# AGENTS

This repository is `legal-telegram-digest`: a static multi-channel legal Telegram reader built with Astro.

## What Matters Here

- Main data source is public Telegram web preview: `https://t.me/s/<channel>`
- Parsed output lands in `data/*.json`
- UI is static Astro SSG, not a runtime app with a backend
- The product is reader-first: feed, digests, hot page, compare, stats, search, and per-channel pages

## Core Commands

- `pnpm install`
- `pnpm run fetch`
- `pnpm run dev`
- `pnpm run build`
- `pnpm run preview`
- `pnpm run lint`

## Files To Know

- `scripts/fetch-channel.ts` — fetch/parsing pipeline
- `src/lib/data.ts` — post shaping, filtering, normalization
- `src/lib/telegram/index.ts` — Telegram-specific HTML/media helpers
- `src/pages/index.astro` — homepage feed
- `src/pages/compare.astro` — sortable channel comparison
- `src/pages/channels/[channel].astro` — dedicated channel page
- `src/pages/posts/[...id].astro` — single post page
- `src/layouts/base.astro` — shared browser-side behaviors
- `src/styles/content.css` — typography and reader polish
- `.github/workflows/sync.yml` — fetch/build/deploy automation

## Project Conventions

- Keep internal URLs aligned with `trailingSlash: 'always'`
- Use `/legal-telegram-digest/` as the base path assumption
- Preserve Telegram emoji and author wording; normalize layout, not content
- Prefer CSS variables over hardcoded colors
- Treat `data/posts.json` and digest snapshots as generated artifacts
- Dedicated channel pages should link to `/channels/{channel}/`, not generic search when author-only browsing is intended

## Deploy Model

- `push` to `main` deploys the current site to GitHub Pages
- scheduled workflow refreshes Telegram data every 15 minutes and then deploys
- SourceCraft mirror is published from `dist/` after build

## Useful Docs

- [README.md](README.md)
- [docs/architecture.md](docs/architecture.md)
- [docs/setup.md](docs/setup.md)
