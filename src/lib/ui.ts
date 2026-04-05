import type { Post } from '../types'

export const siteTitleStyle = {
  'view-transition-name': 'site-title',
  'transition': '0.2s ease',
} as const

const CONTENT_MEDIA_ATTRIBUTE_REGEX = /\b(src|poster|href)=("|')media\/([^"']+)/g
const CONTENT_MEDIA_CSS_URL_REGEX = /url\((['"]?)media\/([^)"']+)\1\)/g
const WHITESPACE_REGEX = /\s+/g
const HTML_NAMED_ENTITY_REGEX = /&(nbsp|amp|quot|#39|times|mdash|ndash|hellip|lt|gt);/g
const HTML_DECIMAL_ENTITY_REGEX = /&#(\d+);/g
const HTML_HEX_ENTITY_REGEX = /&#x([0-9a-f]+);/gi
const HTML_BREAK_TAG_REGEX = /<br\s*\/?>/gi
const HTML_BLOCK_CLOSE_REGEX = /<\/(p|div|blockquote|li|h[1-6])>/gi
const HTML_BLOCK_OPEN_REGEX = /<(p|div|blockquote|ul|ol|h[1-6])[^>]*>/gi
const HTML_LIST_ITEM_OPEN_REGEX = /<li[^>]*>/gi
const HTML_IMAGE_TAG_REGEX = /<img[^>]*>/gi
const HTML_TAG_REGEX = /<[^>]+>/g
const BASE_PATH_EDGE_SLASHES_REGEX = /^\/+|\/+$/g
const ASSET_PATH_LEADING_SLASHES_REGEX = /^\/+/g
const TITLE_SENTENCE_REGEX = /^.{20,140}?[.!?…:](?=\s|$)/u
const HTML_ENTITY_MAP: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&quot;': '"',
  '&#39;': '\'',
  '&times;': '×',
  '&mdash;': '—',
  '&ndash;': '–',
  '&hellip;': '…',
  '&lt;': '<',
  '&gt;': '>',
}

function normalizeWhitespace(value: string): string {
  return value.replace(WHITESPACE_REGEX, ' ').trim()
}

function decodeBasicHtml(value: string): string {
  return value
    .replace(HTML_NAMED_ENTITY_REGEX, match => HTML_ENTITY_MAP[match] ?? match)
    .replace(HTML_DECIMAL_ENTITY_REGEX, (_, code) => String.fromCodePoint(Number(code)))
    .replace(HTML_HEX_ENTITY_REGEX, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
}

function stripHtmlToLines(html: string): string[] {
  return decodeBasicHtml(
    html
      .replace(HTML_BREAK_TAG_REGEX, '\n')
      .replace(HTML_BLOCK_CLOSE_REGEX, '\n')
      .replace(HTML_BLOCK_OPEN_REGEX, '\n')
      .replace(HTML_LIST_ITEM_OPEN_REGEX, '\n')
      .replace(HTML_IMAGE_TAG_REGEX, ' ')
      .replace(HTML_TAG_REGEX, ' '),
  )
    .split('\n')
    .map(normalizeWhitespace)
    .filter(Boolean)
}

function truncateTitle(value: string, maxLength = 140): string {
  if (value.length <= maxLength)
    return value

  const sliced = value.slice(0, maxLength + 1)
  const boundary = sliced.lastIndexOf(' ')
  return `${(boundary > 40 ? sliced.slice(0, boundary) : sliced.slice(0, maxLength)).trimEnd()}…`
}

function normalizeBasePath(basePath = '/'): string {
  const trimmed = basePath.trim()
  if (!trimmed || trimmed === '/') {
    return '/'
  }

  return `/${trimmed.replace(BASE_PATH_EDGE_SLASHES_REGEX, '')}/`
}

export function buildSiteAssetUrl(assetPath: string, basePath = '/'): string {
  const normalizedBasePath = normalizeBasePath(basePath)
  const normalizedAssetPath = assetPath.replace(ASSET_PATH_LEADING_SLASHES_REGEX, '')

  return normalizedBasePath === '/'
    ? `/${normalizedAssetPath}`
    : `${normalizedBasePath}${normalizedAssetPath}`
}

export function normalizePostContentMediaUrls(html: string, basePath = '/'): string {
  if (!html.includes('media/')) {
    return html
  }

  const mediaBaseUrl = buildSiteAssetUrl('media/', basePath)

  return html
    .replace(
      CONTENT_MEDIA_ATTRIBUTE_REGEX,
      (_match, attribute: string, quote: '"' | '\'', assetPath: string) => `${attribute}=${quote}${mediaBaseUrl}${assetPath}`,
    )
    .replace(CONTENT_MEDIA_CSS_URL_REGEX, (_match, quote: '"' | '\'' | '', assetPath: string) =>
      `url(${quote}${mediaBaseUrl}${assetPath}${quote})`)
}

export function getPostDisplayTitle(post: Post, fallback: string): string {
  const lines = stripHtmlToLines(post.content || '')
  let title = lines[0] || normalizeWhitespace(post.digestSummary || '') || normalizeWhitespace(post.title || '') || fallback

  if (lines.length > 1 && title.length < 90 && lines[1].length <= 48) {
    title = `${title} ${lines[1]}`
  }

  if (title.length > 140) {
    const firstSentence = title.match(TITLE_SENTENCE_REGEX)?.[0]?.trim()
    title = firstSentence || truncateTitle(title, 140)
  }

  return title
}
