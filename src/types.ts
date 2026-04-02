export interface Reaction {
  emoji: string
  emojiId?: string
  emojiImage?: string
  count: string
  isPaid: boolean
}

export interface LegalCategory {
  id: string
  label: string
  description: string
}

export interface ChannelDefinition {
  channel: string
  title?: string
  category?: string
  group?: string
  description?: string
  topics?: string[]
  priorityBoost?: number
  enabled?: boolean
}

export interface SiteDefinition {
  title: string
  shortTitle?: string
  description: string
  owner?: string
}

export interface ChannelRegistry {
  site: SiteDefinition
  categories: LegalCategory[]
  channels: ChannelDefinition[]
}

export interface Post {
  id: string
  title: string
  type: 'text' | 'service'
  datetime: string
  tags: string[]
  text: string
  description?: string
  content: string
  reactions: Reaction[]
  /** Channel username this post belongs to */
  channel?: string
  /** Channel display title */
  channelTitle?: string
  channelAvatar?: string
  tgLink?: string
  category?: string
  group?: string
  legalTopics?: string[]
  priorityScore?: number
  priorityReasons?: string[]
  digestSummary?: string
  reactionCount?: number
  viewCount?: number
  engagementRate?: number
}

export interface ChannelInfo {
  posts: Post[]
  title: string
  description: string
  descriptionHTML: string | null
  avatar: string | undefined
  /** Optional SEO override injected by page routes */
  seo?: SeoMeta
}

export interface SeoMeta {
  title?: string
  text?: string
  noindex?: string | boolean
  nofollow?: string | boolean
}

/** Parameters accepted by getChannelInfo */
export interface GetChannelInfoParams {
  before?: string
  after?: string
  q?: string
  category?: string
  topic?: string
  channel?: string
}

export interface EnvCapableAstro {
  locals?: App.Locals & {
    runtime?: {
      env?: Record<string, string | undefined>
    }
  }
  request?: Request
  url?: URL
}

export interface NavItem {
  title: string
  href: string
}

export interface DigestPayload {
  id: 'today' | 'yesterday' | 'week'
  label: string
  generatedAt: string
  totalPosts: number
  topPosts: Post[]
  topTopics: { id: string, label: string, count: number }[]
  topChannels: { channel: string, title: string, count: number }[]
}
