import { env } from 'node:process'
import astroIcon from 'astro-icon'
import { defineConfig } from 'astro/config'

// https://astro.build/config
export default defineConfig({
  output: 'static',
  site: env.SITE_URL || 'https://iver15.github.io',
  base: env.BASE_PATH || '/legal-telegram-digest/',
  trailingSlash: 'always',
  integrations: [astroIcon()],
})
