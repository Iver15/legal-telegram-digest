import type { Post, Reaction } from '../types'

const TELEGRAM_COUNTER_REGEX = /^(\d+(?:[.,]\d+)?)([kmb])?$/i
const NBSP_REGEX = /\s+/g
const COMMA_REGEX = /,/g
const NON_DIGIT_REGEX = /\D/g

const compactNumberFormatter = new Intl.NumberFormat('ru-RU', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

export function parseTelegramCounter(rawValue: string | null | undefined): number | undefined {
  if (!rawValue)
    return undefined

  const normalized = rawValue
    .replace(NBSP_REGEX, '')
    .replace(COMMA_REGEX, '.')
    .trim()
    .toLowerCase()

  if (!normalized)
    return undefined

  const compactMatch = normalized.match(TELEGRAM_COUNTER_REGEX)
  if (compactMatch) {
    const base = Number.parseFloat(compactMatch[1])
    if (!Number.isFinite(base))
      return undefined

    const multiplier = compactMatch[2] === 'k'
      ? 1_000
      : compactMatch[2] === 'm'
        ? 1_000_000
        : compactMatch[2] === 'b'
          ? 1_000_000_000
          : 1

    return Math.round(base * multiplier)
  }

  const digits = normalized.replace(NON_DIGIT_REGEX, '')
  if (!digits)
    return undefined

  const parsed = Number.parseInt(digits, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

export function getReactionCount(value: Pick<Post, 'reactions'> | Reaction[] | undefined): number {
  const reactions = Array.isArray(value) ? value : value?.reactions
  return (reactions || []).reduce((sum, reaction) => sum + (Number.parseInt(String(reaction.count), 10) || 0), 0)
}

export function getEngagementRate(reactionCount: number, viewCount?: number): number | undefined {
  if (!viewCount || viewCount <= 0)
    return undefined

  return reactionCount / viewCount
}

export function formatCompactNumberRu(value: number | undefined, fallback = '—'): string {
  if (typeof value !== 'number' || !Number.isFinite(value))
    return fallback

  if (value < 1000)
    return new Intl.NumberFormat('ru-RU').format(value)

  return compactNumberFormatter.format(value)
}

export function formatPercentRu(value: number | undefined, digits = 1, fallback = '—'): string {
  if (typeof value !== 'number' || !Number.isFinite(value))
    return fallback

  return new Intl.NumberFormat('ru-RU', {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}
