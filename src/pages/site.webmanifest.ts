import type { APIRoute } from 'astro'
import { getSiteMeta } from '../lib/data'

export const GET: APIRoute = async () => {
  const site = getSiteMeta()
  const siteName = site.shortTitle || site.title

  const manifest = {
    name: siteName,
    short_name: siteName,
    description: site.description || '',
    start_url: '/',
    display: 'standalone',
    theme_color: '#f4f1ec',
    background_color: '#f4f1ec',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ],
  }

  return new Response(JSON.stringify(manifest, null, 2), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
    },
  })
}
