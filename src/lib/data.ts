/**
 * Data layer for SSG mode.
 * Reads posts, channel registry, fetched metadata, and generated digests.
 */

import type { ChannelDefinition, ChannelInfo, ChannelRegistry, DigestPayload, GetChannelInfoParams, Post } from '../types'
import fs from 'node:fs'
import path from 'node:path'
import { cwd } from 'node:process'
import { comparePostsForDigest, enrichLegalPost, normalizeChannelRegistry } from './legal'

const DATA_DIR = path.resolve(cwd(), 'data')
const DIGESTS_DIR = path.join(DATA_DIR, 'digests')
const TAG_PREFIX_REGEX = /^#/

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
      topPosts: filterEnabledPosts(payload.topPosts || [], definitions),
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
