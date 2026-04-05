/**
 * Data layer for SSG mode.
 * Reads posts, channel registry, fetched metadata, and generated digests.
 */

import type { AnyNode, CheerioAPI } from 'cheerio'
import type { ChannelDefinition, ChannelInfo, ChannelRegistry, DigestPayload, GetChannelInfoParams, Post } from '../types'
import fs from 'node:fs'
import path from 'node:path'
import { cwd, env } from 'node:process'
import * as cheerio from 'cheerio'
import { comparePostsForDigest, enrichLegalPost, normalizeChannelRegistry } from './legal'
import { normalizePostContentMediaUrls } from './ui'

const DATA_DIR = path.resolve(cwd(), 'data')
const DIGESTS_DIR = path.join(DATA_DIR, 'digests')
const MEDIA_DIR = path.resolve(cwd(), 'public', 'media')
const TAG_PREFIX_REGEX = /^#/
const LEADING_SLASHES_REGEX = /^\/+/g
const CLASS_NAME_SPLIT_REGEX = /\s+/
const TELEGRAM_EMOJI_SRC_REGEX = /^https:\/\/t\.me\/i\/emoji\//
const BLOCK_CONTENT_TAGS = new Set(['p', 'div', 'blockquote', 'ul', 'ol', 'pre', 'figure', 'table', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'iframe'])
const INLINE_BREAKOUT_TAGS = new Set(['a', 'b', 'strong', 'i', 'em', 'u', 's', 'span', 'small', 'mark', 'code'])
const SITE_BASE_URL = env.BASE_PATH || (import.meta.env.BASE_URL && import.meta.env.BASE_URL !== '/'
  ? import.meta.env.BASE_URL
  : '/legal-telegram-digest/')

function getLocalMediaPath(source: string | undefined): string | null {
  if (!source) {
    return null
  }

  const normalizedSource = source
    .replace(SITE_BASE_URL, '')
    .replace(LEADING_SLASHES_REGEX, '')

  if (!normalizedSource.startsWith('media/')) {
    return null
  }

  return path.join(MEDIA_DIR, normalizedSource.slice('media/'.length))
}

function sanitizeMissingLocalMedia(html: string): string {
  if (!html.includes('media/')) {
    return html
  }

  const $ = cheerio.load(`<div data-content-root>${html}</div>`, null, false)
  const root = $('[data-content-root]').first()

  for (const node of root.find('img, video, audio, source').toArray()) {
    const asset = $(node)
    const assetPath = getLocalMediaPath(asset.attr('src')) || getLocalMediaPath(asset.attr('poster'))
    if (!assetPath || fs.existsSync(assetPath)) {
      continue
    }

    asset.remove()
  }

  for (const selector of ['.image-preview-wrap', '.modal', '.image-list-container'] as const) {
    for (const node of root.find(selector).toArray()) {
      const block = $(node)
      if (block.find('img, video, audio, source').length === 0) {
        block.remove()
      }
    }
  }

  return root.html() ?? ''
}

function isBlankTextNode(node: AnyNode): boolean {
  return node.type === 'text' && !(node.data || '').trim()
}

function isIgnorableParagraphEdge(node: AnyNode): boolean {
  return isBlankTextNode(node) || (node.type === 'tag' && node.name === 'br')
}

function trimIgnorableEdges(nodes: AnyNode[]): AnyNode[] {
  const trimmed = [...nodes]

  while (trimmed.length > 0 && isIgnorableParagraphEdge(trimmed[0]!))
    trimmed.shift()

  while (trimmed.length > 0 && isIgnorableParagraphEdge(trimmed.at(-1)!))
    trimmed.pop()

  return trimmed
}

function splitInlineSegments(nodes: AnyNode[]): AnyNode[][] {
  const segments: AnyNode[][] = []
  let buffer: AnyNode[] = []

  const flushBuffer = () => {
    const trimmed = trimIgnorableEdges(buffer)
    buffer = []

    const hasMeaningfulContent = trimmed.some(node => !isBlankTextNode(node))
    if (hasMeaningfulContent && trimmed.length > 0) {
      segments.push(trimmed)
    }
  }

  for (const node of nodes) {
    if (node.type === 'tag' && node.name === 'br') {
      const previous = buffer.at(-1)
      const hasMeaningfulBufferedContent = buffer.some(bufferedNode => !isIgnorableParagraphEdge(bufferedNode))

      if (!hasMeaningfulBufferedContent) {
        continue
      }

      if (previous?.type === 'tag' && previous.name === 'br') {
        buffer.pop()
        flushBuffer()
        continue
      }
    }

    buffer.push(node)
  }

  flushBuffer()
  return segments
}

function normalizeLegacyInlineBlocks(root: cheerio.Cheerio<AnyNode>, $: CheerioAPI): void {
  const directNodes = root.contents().toArray()
  const renderedBlocks: string[] = []
  let inlineBuffer: AnyNode[] = []

  const flushBuffer = () => {
    const nodes = [...inlineBuffer]
    inlineBuffer = []

    while (nodes.length > 0 && isIgnorableParagraphEdge(nodes[0]!))
      nodes.shift()

    while (nodes.length > 0 && isIgnorableParagraphEdge(nodes.at(-1)!))
      nodes.pop()

    const hasMeaningfulContent = nodes.some(node => !isBlankTextNode(node))
    if (!hasMeaningfulContent || nodes.length === 0) {
      return
    }

    renderedBlocks.push(`<p>${nodes.map(node => $.html(node)).join('')}</p>`)
  }

  for (const node of directNodes) {
    if (node.type === 'tag' && BLOCK_CONTENT_TAGS.has(node.name)) {
      flushBuffer()
      renderedBlocks.push($.html(node))
      continue
    }

    if (node.type === 'tag' && node.name === 'br') {
      const previous = inlineBuffer.at(-1)
      const hasMeaningfulBufferedContent = inlineBuffer.some(bufferedNode => !isIgnorableParagraphEdge(bufferedNode))

      if (!hasMeaningfulBufferedContent) {
        continue
      }

      if (previous?.type === 'tag' && previous.name === 'br') {
        inlineBuffer.pop()
        flushBuffer()
        continue
      }
    }

    inlineBuffer.push(node)
  }

  flushBuffer()
  root.html(renderedBlocks.join(''))
}

function normalizeInlineBreakEdges(root: cheerio.Cheerio<AnyNode>, $: CheerioAPI): void {
  const selector = [...INLINE_BREAKOUT_TAGS].join(', ')
  for (const node of root.find(selector).toArray().reverse()) {
    const inlineElement = $(node)

    while (true) {
      const firstChild = inlineElement.contents().toArray()[0]
      if (!(firstChild?.type === 'tag' && firstChild.name === 'br')) {
        break
      }

      inlineElement.before(firstChild)
    }

    while (true) {
      const children = inlineElement.contents().toArray()
      const lastChild = children.at(-1)
      if (!(lastChild?.type === 'tag' && lastChild.name === 'br')) {
        break
      }

      inlineElement.after(lastChild)
    }

    const remainingChildren = inlineElement.contents().toArray()
    const hasMeaningfulContent = remainingChildren.some(child => !isBlankTextNode(child))
    if (!hasMeaningfulContent) {
      inlineElement.remove()
    }
  }
}

function splitParagraphsOnDoubleBreaks(root: cheerio.Cheerio<AnyNode>, $: CheerioAPI): void {
  for (const node of root.find('p').toArray()) {
    const paragraph = $(node)
    const segments = splitInlineSegments(paragraph.contents().toArray())
    if (segments.length <= 1) {
      continue
    }

    const attributes = paragraph.attr()
    const replacementHtml = segments.map((segment, index) => {
      const nextParagraph = $('<p></p>')

      if (attributes) {
        for (const [name, value] of Object.entries(attributes)) {
          if (index > 0 && name === 'id') {
            continue
          }

          nextParagraph.attr(name, value)
        }
      }

      nextParagraph.html(segment.map(child => $.html(child)).join(''))
      return $.html(nextParagraph)
    }).join('')

    paragraph.replaceWith(replacementHtml)
  }
}

function splitNodesOnBreaks(nodes: AnyNode[]): AnyNode[][] {
  const lines: AnyNode[][] = []
  let buffer: AnyNode[] = []

  const flushBuffer = () => {
    lines.push(trimIgnorableEdges(buffer))
    buffer = []
  }

  for (const node of nodes) {
    if (node.type === 'tag' && node.name === 'br') {
      flushBuffer()
      continue
    }

    buffer.push(node)
  }

  flushBuffer()
  return lines.filter(line => line.some(node => !isBlankTextNode(node)))
}

function isTelegramEmojiImage(node: AnyNode, srcPattern?: RegExp): boolean {
  if (node.type !== 'tag' || node.name !== 'img') {
    return false
  }

  const classes = node.attribs.class || ''
  if (!classes.split(CLASS_NAME_SPLIT_REGEX).includes('tg-emoji')) {
    return false
  }

  if (!srcPattern) {
    return true
  }

  return srcPattern.test(node.attribs.src || '')
}

function isDividerLine(line: AnyNode[]): boolean {
  if (line.length < 6) {
    return false
  }

  const emojiNodes = line.filter(node => isTelegramEmojiImage(node))
  if (emojiNodes.length !== line.length) {
    return false
  }

  const firstSrc = emojiNodes[0]?.attribs.src || ''
  return firstSrc !== '' && emojiNodes.every(node => node.attribs.src === firstSrc)
}

function getLeadingMarkerEmojiSrc(line: AnyNode[]): string | null {
  const [firstNode] = line
  if (!firstNode || !isTelegramEmojiImage(firstNode, TELEGRAM_EMOJI_SRC_REGEX)) {
    return null
  }

  return firstNode.attribs.src || null
}

function getFirstMarkerEmojiIndex(line: AnyNode[]): number {
  return line.findIndex(node => isTelegramEmojiImage(node, TELEGRAM_EMOJI_SRC_REGEX))
}

function removeLeadingMarker(line: AnyNode[]): AnyNode[] {
  const nodes = [...line]
  if (nodes[0] && getLeadingMarkerEmojiSrc(nodes)) {
    nodes.shift()
  }

  return trimIgnorableEdges(nodes)
}

function isLikelySectionLead(line: AnyNode[]): boolean {
  if (line.length === 0) {
    return false
  }

  if (getLeadingMarkerEmojiSrc(line)) {
    return false
  }

  const text = line.map(node => node.type === 'text' ? node.data || '' : '').join('').trim()
  const hasItalic = line.some(node => node.type === 'tag' && (node.name === 'i' || node.name === 'em'))
  const hasLink = line.some(node => node.type === 'tag' && node.name === 'a')
  return hasItalic || (!hasLink && text.length > 0 && text.length <= 180)
}

function renderLineAsParagraph(line: AnyNode[], $, className?: string): string {
  const paragraph = $('<p></p>')
  if (className) {
    paragraph.addClass(className)
  }

  paragraph.html(line.map(node => $.html(node)).join(''))
  return $.html(paragraph)
}

function renderEmojiList(lines: AnyNode[][], markerSrc: string, $: CheerioAPI): string {
  const list = $('<ul></ul>').addClass('content-emoji-list')
  list.attr('data-marker-src', markerSrc)

  for (const line of lines) {
    const itemNodes = removeLeadingMarker(line)
    if (itemNodes.length === 0) {
      continue
    }

    const item = $('<li></li>')
    item.html(line.map(node => $.html(node)).join(''))
    list.append(item)
  }

  return $.html(list)
}

type StructuredDigestLine
  = { type: 'divider' }
    | { type: 'line', nodes: AnyNode[] }

function normalizeStructuredDigestLines(lines: AnyNode[][]): StructuredDigestLine[] {
  const normalized: StructuredDigestLine[] = []

  for (const rawLine of lines) {
    const line = trimIgnorableEdges(rawLine)
    if (line.length === 0) {
      continue
    }

    if (isDividerLine(line)) {
      normalized.push({ type: 'divider' })
      continue
    }

    let trailingDividerStart = line.length
    while (trailingDividerStart > 0 && isTelegramEmojiImage(line[trailingDividerStart - 1]!)) {
      trailingDividerStart -= 1
    }

    const trailingDivider = line.slice(trailingDividerStart)
    const contentBeforeDivider = trimIgnorableEdges(line.slice(0, trailingDividerStart))
    if (trailingDivider.length >= 6 && isDividerLine(trailingDivider)) {
      if (contentBeforeDivider.length > 0) {
        normalized.push({ type: 'line', nodes: contentBeforeDivider })
      }

      normalized.push({ type: 'divider' })
      continue
    }

    const firstMarkerIndex = getFirstMarkerEmojiIndex(line)
    if (firstMarkerIndex > 0) {
      const leadNodes = trimIgnorableEdges(line.slice(0, firstMarkerIndex))
      const markerNodes = trimIgnorableEdges(line.slice(firstMarkerIndex))
      if (leadNodes.length > 0 && markerNodes.length > 0 && isLikelySectionLead(leadNodes) && getLeadingMarkerEmojiSrc(markerNodes)) {
        normalized.push({ type: 'line', nodes: leadNodes })
        normalized.push({ type: 'line', nodes: markerNodes })
        continue
      }
    }

    normalized.push({ type: 'line', nodes: line })
  }

  return normalized
}

function normalizeEmojiDigestParagraphs(root: cheerio.Cheerio<AnyNode>, $: CheerioAPI): void {
  for (const node of root.find('p').toArray()) {
    const paragraph = $(node)
    const children = paragraph.contents().toArray()
    const breakCount = children.filter(child => child.type === 'tag' && child.name === 'br').length
    const emojiCount = children.filter(child => isTelegramEmojiImage(child)).length

    if (breakCount < 4 || emojiCount < 8) {
      continue
    }

    const rawLines = splitNodesOnBreaks(children)
    const lines = normalizeStructuredDigestLines(rawLines)
    const dividerCount = lines.filter(line => line.type === 'divider').length
    if (lines.length < 4 || dividerCount === 0) {
      continue
    }

    const fragments: string[] = []
    let sectionLines: AnyNode[][] = []

    const flushSection = () => {
      if (sectionLines.length === 0) {
        return
      }

      let cursor = 0
      if (isLikelySectionLead(sectionLines[0]!)) {
        fragments.push(renderLineAsParagraph(sectionLines[0]!, $, 'content-section-lead'))
        cursor = 1
      }

      while (cursor < sectionLines.length) {
        const markerSrc = getLeadingMarkerEmojiSrc(sectionLines[cursor]!)
        if (markerSrc) {
          const listLines: AnyNode[][] = []
          while (cursor < sectionLines.length && getLeadingMarkerEmojiSrc(sectionLines[cursor]!) === markerSrc) {
            listLines.push(sectionLines[cursor]!)
            cursor += 1
          }

          fragments.push(renderEmojiList(listLines, markerSrc, $))
          continue
        }

        fragments.push(renderLineAsParagraph(sectionLines[cursor]!, $))
        cursor += 1
      }

      sectionLines = []
    }

    for (const line of lines) {
      if (line.type === 'divider') {
        flushSection()
        fragments.push('<hr class="content-divider">')
        continue
      }

      sectionLines.push(line.nodes)
    }

    flushSection()

    if (fragments.length > 0) {
      paragraph.replaceWith(fragments.join(''))
    }
  }
}

function normalizeLegacyPostMarkup(html: string): string {
  if (!html) {
    return html
  }

  const $ = cheerio.load(`<div data-content-root>${html}</div>`, null, false)
  const root = $('[data-content-root]').first()

  for (const node of root.find('.tgme_widget_message_text, .js-message_text').toArray()) {
    normalizeLegacyInlineBlocks($(node), $)
  }

  normalizeLegacyInlineBlocks(root, $)
  normalizeInlineBreakEdges(root, $)
  splitParagraphsOnDoubleBreaks(root, $)
  normalizeEmojiDigestParagraphs(root, $)

  for (const node of root.find('p').toArray()) {
    const paragraph = $(node)
    const children = paragraph.contents().toArray()
    const hasMeaningfulContent = children.some(child => !isIgnorableParagraphEdge(child))
    if (!hasMeaningfulContent) {
      paragraph.remove()
    }
  }

  return root.html() ?? ''
}

function preparePostContent(html: string): string {
  return normalizeLegacyPostMarkup(sanitizeMissingLocalMedia(normalizePostContentMediaUrls(html, SITE_BASE_URL)))
}

function isChannelEnabled(channel: string | undefined, definitions?: Map<string, ChannelDefinition>): boolean {
  if (!channel)
    return true

  const definition = (definitions || getChannelDefinitionMap()).get(channel)
  return definition?.enabled !== false
}

function filterEnabledPosts(posts: Post[], definitions?: Map<string, ChannelDefinition>): Post[] {
  return posts.filter(post => isChannelEnabled(post.channel, definitions))
}

let _posts: Post[] | null = null
let _channelRegistry: ChannelRegistry | null = null
let _channelsMeta: Record<string, { title: string, description: string, descriptionHTML: string | null, avatar: string | undefined }> | null = null
let _digests: Record<string, DigestPayload> | null = null

function readJsonFile<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath))
    return fallback

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  }
  catch {
    return fallback
  }
}

function getChannelDefinitionMap(): Map<string, ChannelDefinition> {
  const registry = loadChannelRegistry()
  return new Map(registry.channels.map(channel => [channel.channel, channel]))
}

function loadChannelRegistry(): ChannelRegistry {
  if (_channelRegistry)
    return _channelRegistry

  const file = path.join(DATA_DIR, 'channels.json')
  _channelRegistry = normalizeChannelRegistry(readJsonFile(file, {}))
  return _channelRegistry
}

function loadChannelsMeta() {
  if (_channelsMeta)
    return _channelsMeta

  const file = path.join(DATA_DIR, 'channel.json')
  const raw = readJsonFile(file, {})
  if (raw && typeof raw === 'object' && 'title' in (raw as Record<string, unknown>)) {
    _channelsMeta = { default: raw as { title: string, description: string, descriptionHTML: string | null, avatar: string | undefined } }
    return _channelsMeta
  }

  _channelsMeta = (raw && typeof raw === 'object') ? raw as Record<string, { title: string, description: string, descriptionHTML: string | null, avatar: string | undefined }> : {}
  return _channelsMeta
}

function loadPosts(): Post[] {
  if (_posts)
    return _posts

  const file = path.join(DATA_DIR, 'posts.json')
  const rawPosts = readJsonFile<Post[]>(file, [])
  const channelDefinitions = getChannelDefinitionMap()
  const channelsMeta = loadChannelsMeta()
  _posts = filterEnabledPosts(rawPosts, channelDefinitions)
    .map((post) => {
      const channelDefinition = post.channel ? channelDefinitions.get(post.channel) : undefined
      const channelMeta = post.channel ? channelsMeta[post.channel] : undefined
      const enriched = enrichLegalPost(post, channelDefinition)
      return {
        ...enriched,
        content: preparePostContent(enriched.content || ''),
        channelTitle: enriched.channelTitle || channelDefinition?.title || channelMeta?.title || post.channelTitle,
        channelAvatar: channelMeta?.avatar,
      }
    })
    .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime())
  return _posts
}

function loadDigests(): Record<string, DigestPayload> {
  if (_digests)
    return _digests

  const definitions = getChannelDefinitionMap()
  const sanitizeDigest = (payload: DigestPayload | null) => {
    if (!payload)
      return payload

    return {
      ...payload,
      topPosts: filterEnabledPosts(payload.topPosts || [], definitions)
        .map(post => ({
          ...post,
          content: preparePostContent(post.content || ''),
        })),
      topChannels: (payload.topChannels || []).filter(item => isChannelEnabled(item.channel, definitions)),
    }
  }

  _digests = {
    today: sanitizeDigest(readJsonFile(path.join(DIGESTS_DIR, 'today.json'), null)),
    yesterday: sanitizeDigest(readJsonFile(path.join(DIGESTS_DIR, 'yesterday.json'), null)),
    week: sanitizeDigest(readJsonFile(path.join(DIGESTS_DIR, 'week.json'), null)),
  } as Record<string, DigestPayload>

  return _digests
}

function getPrimaryChannelInfo(): ChannelInfo {
  const registry = loadChannelRegistry()
  const site = registry.site
  return {
    posts: [],
    title: site.title,
    description: site.description,
    descriptionHTML: `<p>${site.description}</p>`,
    avatar: undefined,
  }
}

function queryMatches(post: Post, query: string): boolean {
  const normalized = query.toLowerCase().replace(TAG_PREFIX_REGEX, '')
  return [
    post.title,
    post.text,
    post.channel,
    post.channelTitle,
    post.category,
    ...(post.tags || []),
    ...(post.legalTopics || []),
  ]
    .filter(Boolean)
    .some(value => String(value).toLowerCase().includes(normalized))
}

export function getChannelData(params: GetChannelInfoParams = {}): ChannelInfo {
  const primary = getPrimaryChannelInfo()
  let posts = loadPosts()

  if (params.channel) {
    posts = posts.filter(post => post.channel === params.channel)
  }

  if (params.category) {
    posts = posts.filter(post => post.category === params.category || post.group === params.category)
  }

  if (params.topic) {
    posts = posts.filter(post => (post.legalTopics || []).includes(params.topic!))
  }

  if (params.q) {
    posts = posts.filter(post => queryMatches(post, params.q!))
  }

  const pageSize = 20
  if (params.before) {
    const index = posts.findIndex(post => post.id === params.before)
    if (index !== -1)
      posts = posts.slice(index + 1, index + 1 + pageSize)
  }
  else if (params.after) {
    const index = posts.findIndex(post => post.id === params.after)
    if (index !== -1) {
      const start = Math.max(0, index - pageSize)
      posts = posts.slice(start, index)
    }
  }
  else {
    posts = posts.slice(0, pageSize)
  }

  return {
    ...primary,
    posts,
  }
}

export function getSiteMeta() {
  return loadChannelRegistry().site
}

export function getChannelRegistry() {
  return loadChannelRegistry()
}

export function getPost(id: string): Post | undefined {
  return loadPosts().find(post => post.id === id)
}

export function getAllPosts(): Post[] {
  return loadPosts()
}

export function getAllPostIds(): string[] {
  return loadPosts().map(post => post.id)
}

export function getAllTags(): string[] {
  const tags = new Set<string>()
  for (const post of loadPosts()) {
    for (const tag of post.tags || []) {
      tags.add(tag)
    }
  }
  return Array.from(tags).sort()
}

export function getAllChannels(): Array<{ name: string, title: string, postCount: number, category?: string, priorityBoost?: number, avatar?: string }> {
  const definitions = getChannelDefinitionMap()
  const fetchedMeta = loadChannelsMeta()
  const counts: Record<string, number> = {}

  for (const post of loadPosts()) {
    const channel = post.channel || 'unknown'
    counts[channel] = (counts[channel] || 0) + 1
  }

  return Array.from(new Set([...Object.keys(counts), ...definitions.keys()]))
    .map((name) => {
      const definition = definitions.get(name)
      const meta = fetchedMeta[name]
      return {
        name,
        title: definition?.title || meta?.title || name,
        postCount: counts[name] || 0,
        category: definition?.category,
        priorityBoost: definition?.priorityBoost,
        avatar: meta?.avatar,
      }
    })
    .sort((a, b) => b.postCount - a.postCount || a.name.localeCompare(b.name))
}

export function getAllCategories(): Array<{ id: string, label: string, description: string, count: number }> {
  const registry = loadChannelRegistry()
  const counts: Record<string, number> = {}

  for (const post of loadPosts()) {
    for (const topic of post.legalTopics || []) {
      counts[topic] = (counts[topic] || 0) + 1
    }
    if (post.category) {
      counts[post.category] = (counts[post.category] || 0) + 1
    }
  }

  return registry.categories.map(category => ({
    ...category,
    count: counts[category.id] || 0,
  }))
}

export function getTopPosts(limit = 10): Post[] {
  return [...loadPosts()]
    .sort(comparePostsForDigest)
    .slice(0, limit)
}

export function getChannelMeta() {
  return getPrimaryChannelInfo()
}

export function getDigestTitle(): string {
  return getSiteMeta().title
}

export function getDigestPayload(period: DigestPayload['id']): DigestPayload | undefined {
  return loadDigests()[period]
}

export function getDigestPayloads(): DigestPayload[] {
  const digests = loadDigests()
  return ['today', 'yesterday', 'week']
    .map(period => digests[period])
    .filter(Boolean)
}
