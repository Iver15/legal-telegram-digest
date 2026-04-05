# Legal Telegram Digest

Multi-channel Telegram legal reader/digest built as a static Astro site with deploys to GitHub Pages and SourceCraft.

## Quick Reference

- **Install**: `pnpm install`
- **Fetch channel data**: `pnpm run fetch`
- **Local dev**: `pnpm run dev`
- **Build site**: `pnpm run build`
- **Preview build**: `pnpm run preview`
- **Lint**: `pnpm run lint`
- **Add channel**: edit `data/channels.json`, then run `pnpm run fetch`
- **Deploy**: push to `main`

## Project Structure

```text
scripts/fetch-channel.ts                      Telegram parser: t.me/s/* -> data/*.json
src/lib/data.ts                              Astro data layer + content normalization
src/lib/telegram/index.ts                    Telegram HTML/media normalization helpers
src/pages/index.astro                        Feed-first homepage
src/pages/digests/index.astro                Digest list
src/pages/hot.astro                          Ranked “hot” page
src/pages/compare.astro                      Channel comparison with sortable table
src/pages/channels/[channel].astro           Dedicated channel page
src/pages/posts/[...id].astro                Single post page
src/components/item.astro                    Post card
src/components/list.astro                    Post list + pagination
src/layouts/base.astro                       Shared layout + client scripts
src/styles/app.css                           Global styles
src/styles/content.css                       Reader/content typography
data/channels.json                           Site config + enabled channels
data/channel.json                            Aggregated channel metadata
data/posts.json                              All normalized posts
data/new-posts.json                          Delta from the last fetch
data/digests/*.json                          Digest snapshots
.github/workflows/sync.yml                   Fetch/build/deploy workflow
```

## Current Product Conventions

- **Project name**: `legal-telegram-digest`
- **Base path**: `/legal-telegram-digest/`
- **Post IDs**: composite `{channel}/{numericId}`
- **Post route**: `/posts/{channel}/{id}/`
- **Channel route**: `/channels/{channel}/`
- **Trailing slash**: always keep internal links with trailing `/`
- **Theme/colors**: use CSS variables, not hardcoded colors
- **Content**: preserve Telegram emoji and author text, normalize only structure/typography
- **Homepage**: starts with filters and then the feed; “Главное за сегодня” is not embedded there

## Reader-Specific Features

- legacy Telegram HTML is normalized into cleaner paragraphs and blocks;
- digest-like posts are split into sections, dividers and emoji lists;
- posts with multiple images are rendered as a carousel instead of a long vertical stack;
- comparison table supports sorting by columns;
- each author/channel has its own page with pagination;
- search pages exist both for tags and channel slugs.

## Deploy Behavior

- **Push to `main`**: triggers build and GitHub Pages deploy immediately
- **Schedule (`*/15 * * * *`)**: fetches channel updates, optionally commits refreshed `data/*`, then builds and deploys
- **GitHub Pages**: deployed through Actions Pages artifact flow
- **SourceCraft**: pushed from `dist/` as a subtree after successful build

## Docs

- [README.md](README.md) — overview, routes and workflow
- [docs/architecture.md](docs/architecture.md) — architecture and deploy model
- [docs/setup.md](docs/setup.md) — local setup
- [docs/extending.md](docs/extending.md) — extension points
