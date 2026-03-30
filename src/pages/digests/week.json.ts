import type { APIRoute } from 'astro'
import { getDigestPayload } from '../../lib/data'

export const GET: APIRoute = async () => Response.json(getDigestPayload('week') || {})
