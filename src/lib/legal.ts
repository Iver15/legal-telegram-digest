import type { ChannelDefinition, ChannelRegistry, DigestPayload, LegalCategory, Post, SiteDefinition } from '../types'

const DEFAULT_SITE: SiteDefinition = {
  title: 'Yuri\'s Legal Telegram Digest',
  shortTitle: 'Yuri Legal Digest',
  description:
    'Мобильный юридический Telegram-дайджест для отслеживания судебной практики, налогов, банкротства, комплаенса и AI+Law.',
  owner: 'Yuri',
}

export const DEFAULT_LEGAL_CATEGORIES: LegalCategory[] = [
  {
    id: 'bankruptcy',
    label: 'Bankruptcy',
    description: 'Restructuring, insolvency, bankruptcy procedure, and creditor risk.',
  },
  {
    id: 'arbitration',
    label: 'Arbitration',
    description: 'Commercial disputes, arbitrazh process, and forum practice.',
  },
  {
    id: 'tax',
    label: 'Tax',
    description: 'Tax disputes, audits, transfer pricing, and fiscal guidance.',
  },
  {
    id: 'courts',
    label: 'Courts',
    description: 'Supreme court, cassation, procedure, and key judicial positions.',
  },
  {
    id: 'enforcement',
    label: 'Enforcement',
    description: 'Bailiffs, asset recovery, interim relief, and execution strategy.',
  },
  {
    id: 'compliance',
    label: 'Compliance',
    description: 'Sanctions, AML, anti-corruption, investigations, and controls.',
  },
  {
    id: 'ai_law',
    label: 'AI Law',
    description: 'AI governance, privacy, platform regulation, and digital evidence.',
  },
]

const TOPIC_RULES: Array<{ id: string, label: string, keywords: string[], weight: number }> = [
  {
    id: 'bankruptcy',
    label: 'Bankruptcy',
    weight: 4,
    keywords: ['банкрот', 'несостоятельн', 'ефрсб', 'конкурсн', 'реструктуризац', 'арбитражный управляющ'],
  },
  {
    id: 'arbitration',
    label: 'Arbitration',
    weight: 3.5,
    keywords: ['арбитраж', 'арбитражн', 'третейск', 'подведомствен', 'подсудност', 'иск'],
  },
  {
    id: 'tax',
    label: 'Tax',
    weight: 3.5,
    keywords: ['налог', 'фнс', 'ндс', 'прибыл', 'ндфл', 'амнист', 'трансфертн', 'вычет'],
  },
  {
    id: 'courts',
    label: 'Courts',
    weight: 3,
    keywords: ['верховн', 'конституцион', 'кассац', 'апелляц', 'судебн', 'суд', 'пленум', 'обзор практики'],
  },
  {
    id: 'enforcement',
    label: 'Enforcement',
    weight: 3,
    keywords: ['исполнительн', 'пристав', 'взыскан', 'исполнен', 'арест имуществ', 'обеспечительн'],
  },
  {
    id: 'compliance',
    label: 'Compliance',
    weight: 3.5,
    keywords: ['комплаенс', 'aml', 'kyc', 'санкц', 'коррупц', 'антикоррупц', 'due diligence', 'контроль'],
  },
  {
    id: 'ai_law',
    label: 'AI Law',
    weight: 4,
    keywords: ['искусственн', 'ии ', 'ai ', 'ai-law', 'персональн', 'данн', 'privacy', 'цифров', 'алгоритм'],
  },
]

const DIGEST_WINDOWS: Record<DigestPayload['id'], { label: string, hours: number, startOffsetHours?: number }> = {
  today: { label: 'Today', hours: 24 },
  yesterday: { label: 'Yesterday', hours: 24, startOffsetHours: 24 },
  week: { label: 'Week', hours: 24 * 7 },
}
const CHANNEL_PREFIX_REGEX = /^@/
const TAG_PREFIX_REGEX = /^#/
const WHITESPACE_REGEX = /\s+/g

function normalizeChannelDefinition(raw: string | Partial<ChannelDefinition>): ChannelDefinition {
  if (typeof raw === 'string') {
    return { channel: raw, enabled: true }
  }

  return {
    channel: String(raw.channel || '').replace(CHANNEL_PREFIX_REGEX, ''),
    title: raw.title,
    category: raw.category,
    group: raw.group || raw.category,
    description: raw.description,
    topics: Array.isArray(raw.topics) ? raw.topics.filter(Boolean) : [],
    priorityBoost: Number(raw.priorityBoost || 0),
    enabled: raw.enabled !== false,
  }
}

export function normalizeChannelRegistry(raw: unknown): ChannelRegistry {
  if (Array.isArray(raw)) {
    const channels = raw.map(normalizeChannelDefinition)
    return {
      site: DEFAULT_SITE,
      categories: DEFAULT_LEGAL_CATEGORIES,
      channels,
    }
  }

  const record = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {}
  const channelsRaw = Array.isArray(record.channels) ? record.channels : []
  const categoriesRaw = Array.isArray(record.categories) ? record.categories : []
  const siteRaw = (record.site && typeof record.site === 'object') ? record.site as Partial<SiteDefinition> : {}

  return {
    site: {
      ...DEFAULT_SITE,
      ...siteRaw,
    },
    categories: categoriesRaw.length > 0
      ? categoriesRaw
          .map((item) => {
            const category = item as Partial<LegalCategory>
            return {
              id: String(category.id || ''),
              label: String(category.label || category.id || ''),
              description: String(category.description || ''),
            }
          })
          .filter(item => item.id)
      : DEFAULT_LEGAL_CATEGORIES,
    channels: channelsRaw.length > 0
      ? channelsRaw.map(item => normalizeChannelDefinition(item as Partial<ChannelDefinition>)).filter(item => item.channel)
      : [],
  }
}

function cleanText(value: string): string {
  return value.replace(WHITESPACE_REGEX, ' ').trim()
}

function normalizeTags(tags: string[]): string[] {
  return Array.from(new Set(tags.filter(Boolean).map(tag => cleanText(tag).replace(TAG_PREFIX_REGEX, ''))))
}

function getReactionCount(post: Pick<Post, 'reactions'>): number {
  return (post.reactions || []).reduce((sum, reaction) => sum + (Number.parseInt(String(reaction.count), 10) || 0), 0)
}

function getTopicMatches(text: string): Array<{ id: string, label: string, score: number }> {
  const lowered = text.toLowerCase()
  return TOPIC_RULES.flatMap((rule) => {
    const matches = rule.keywords.filter(keyword => lowered.includes(keyword.toLowerCase()))
    if (matches.length === 0)
      return []
    return [{
      id: rule.id,
      label: rule.label,
      score: rule.weight + matches.length * 0.35,
    }]
  }).sort((a, b) => b.score - a.score)
}

export function enrichLegalPost(post: Post, channelDefinition?: ChannelDefinition): Post {
  const sourceText = cleanText(`${post.title}\n${post.text}\n${post.tags.join(' ')}`)
  const topicMatches = getTopicMatches(sourceText)
  const legalTopics = new Set<string>(channelDefinition?.topics || [])

  if (channelDefinition?.category) {
    legalTopics.add(channelDefinition.category)
  }

  for (const match of topicMatches) {
    legalTopics.add(match.id)
  }

  const reactionCount = getReactionCount(post)
  const ageHours = Math.max(0, (Date.now() - new Date(post.datetime).getTime()) / (1000 * 60 * 60))
  const recencyScore = Math.max(0, 6 - Math.min(ageHours / 8, 6))
  const matchScore = topicMatches.reduce((sum, item) => sum + item.score, 0)
  const reactionScore = Math.min(5, reactionCount / 10)
  const channelBoost = Number(channelDefinition?.priorityBoost || 0)
  const priorityScore = Number((matchScore + reactionScore + recencyScore + channelBoost).toFixed(2))
  const reasons = Array.from(new Set([
    ...(channelDefinition?.category ? [`Channel category: ${channelDefinition.category}`] : []),
    ...topicMatches.slice(0, 3).map(item => `Topic hit: ${item.label}`),
    ...(reactionCount > 10 ? [`High engagement: ${reactionCount} reactions`] : []),
  ]))

  return {
    ...post,
    category: channelDefinition?.category || post.category || topicMatches[0]?.id,
    group: channelDefinition?.group || channelDefinition?.category || post.group || topicMatches[0]?.id,
    legalTopics: Array.from(legalTopics),
    tags: normalizeTags([...post.tags, ...Array.from(legalTopics)]),
    priorityScore,
    priorityReasons: reasons,
    digestSummary: cleanText(post.text).slice(0, 220),
    reactionCount,
  }
}

export function getCategoryLabel(categoryId: string | undefined, categories: LegalCategory[]): string {
  if (!categoryId)
    return 'General'
  return categories.find(item => item.id === categoryId)?.label || categoryId
}

export function buildDigestPayload(posts: Post[], registry: ChannelRegistry, period: DigestPayload['id']): DigestPayload {
  const config = DIGEST_WINDOWS[period]
  const now = Date.now()
  const windowEnd = now - ((config.startOffsetHours || 0) * 60 * 60 * 1000)
  const windowStart = windowEnd - (config.hours * 60 * 60 * 1000)
  const filtered = posts.filter((post) => {
    const timestamp = new Date(post.datetime).getTime()
    return timestamp >= windowStart && timestamp <= windowEnd
  })

  const topPosts = [...filtered]
    .sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0) || new Date(b.datetime).getTime() - new Date(a.datetime).getTime())
    .slice(0, 12)

  const topTopicsMap = new Map<string, number>()
  const topChannelsMap = new Map<string, { title: string, count: number }>()

  for (const post of filtered) {
    for (const topic of post.legalTopics || []) {
      topTopicsMap.set(topic, (topTopicsMap.get(topic) || 0) + 1)
    }

    if (post.channel) {
      const current = topChannelsMap.get(post.channel) || { title: post.channelTitle || post.channel, count: 0 }
      current.count += 1
      topChannelsMap.set(post.channel, current)
    }
  }

  return {
    id: period,
    label: config.label,
    generatedAt: new Date().toISOString(),
    totalPosts: filtered.length,
    topPosts,
    topTopics: [...topTopicsMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id, count]) => ({ id, label: getCategoryLabel(id, registry.categories), count })),
    topChannels: [...topChannelsMap.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8)
      .map(([channel, item]) => ({ channel, title: item.title, count: item.count })),
  }
}

export function buildAllDigestPayloads(posts: Post[], registry: ChannelRegistry): Record<DigestPayload['id'], DigestPayload> {
  return {
    today: buildDigestPayload(posts, registry, 'today'),
    yesterday: buildDigestPayload(posts, registry, 'yesterday'),
    week: buildDigestPayload(posts, registry, 'week'),
  }
}
