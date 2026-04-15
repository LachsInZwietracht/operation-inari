/**
 * Fuzzy search utilities for German food names.
 * Combines trigram similarity, umlaut normalization, and Cologne phonetics
 * to provide tolerant search across compound German food names.
 */

import { colognePhonetics, phoneticSimilarity } from "./cologne-phonetics"

const UMLAUT_NORMALIZE: Record<string, string> = {
  ä: "ae",
  ö: "oe",
  ü: "ue",
  ß: "ss",
  ae: "ae",
  oe: "oe",
  ue: "ue",
}

/**
 * Normalize German text: lowercase, expand umlauts, strip diacritics.
 */
export function normalizeText(text: string): string {
  let result = text.toLowerCase().trim()
  // Replace umlauts
  result = result.replace(/[äöüß]/g, (match) => UMLAUT_NORMALIZE[match] ?? match)
  // Remove diacritics from any remaining accented chars
  result = result.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  return result
}

/**
 * Generate character trigrams from a string.
 * E.g., "karotte" → ["kar", "aro", "rot", "ott", "tte"]
 */
function trigrams(text: string): Set<string> {
  const normalized = normalizeText(text).replace(/\s+/g, " ")
  const result = new Set<string>()
  for (let i = 0; i <= normalized.length - 3; i++) {
    result.add(normalized.substring(i, i + 3))
  }
  return result
}

/**
 * Trigram similarity score (0-1). Similar to PostgreSQL's pg_trgm extension.
 */
export function trigramSimilarity(a: string, b: string): number {
  const triA = trigrams(a)
  const triB = trigrams(b)
  if (triA.size === 0 || triB.size === 0) return 0

  let intersection = 0
  for (const t of triA) {
    if (triB.has(t)) intersection++
  }

  return intersection / (triA.size + triB.size - intersection)
}

export interface SearchMatch {
  /** Relevance score 0-1 (higher = better match) */
  score: number
  /** How the match was found */
  matchType: "exact" | "prefix" | "contains" | "fuzzy" | "phonetic"
}

/**
 * Score a query against a target food name using multiple strategies.
 * Returns null if no meaningful match, or a SearchMatch with score and type.
 */
export function scoreMatch(query: string, target: string): SearchMatch | null {
  if (!query || !target) return null

  const normQuery = normalizeText(query)
  const normTarget = normalizeText(target)

  // 1. Exact match
  if (normTarget === normQuery) {
    return { score: 1.0, matchType: "exact" }
  }

  // 2. Prefix match (target starts with query)
  if (normTarget.startsWith(normQuery)) {
    return { score: 0.95, matchType: "prefix" }
  }

  // 3. Contains match (query appears anywhere in target)
  if (normTarget.includes(normQuery)) {
    // Score higher if the match is closer to the start
    const pos = normTarget.indexOf(normQuery)
    const positionBonus = 1 - pos / normTarget.length
    return { score: 0.7 + 0.15 * positionBonus, matchType: "contains" }
  }

  // 4. Word-level matching for compound names (e.g., "Hähnchenbrustfilet" or "Vollkorn Brot")
  const targetWords = normTarget.split(/[\s,()-]+/).filter(Boolean)
  const queryWords = normQuery.split(/[\s,()-]+/).filter(Boolean)

  // Check if all query words appear inside some target word (handles compound
  // names like "Vollkornbrot" matching query "brot"). Only forward direction —
  // the reverse (qw.includes(tw)) causes false positives with short target
  // words like "rot", "eis", "e" appearing inside unrelated queries.
  const allWordsMatch = queryWords.every((qw) =>
    targetWords.some((tw) => tw.includes(qw))
  )
  if (allWordsMatch && queryWords.length > 0) {
    return { score: 0.75, matchType: "contains" }
  }

  // 5. Trigram fuzzy match
  const triSim = trigramSimilarity(normQuery, normTarget)
  if (triSim >= 0.25) {
    return { score: 0.3 + triSim * 0.4, matchType: "fuzzy" }
  }

  // 6. Phonetic match — compare individual words for compound names
  const phoneticScore = computePhoneticScore(queryWords, targetWords)
  if (phoneticScore >= 0.5) {
    return { score: 0.2 + phoneticScore * 0.35, matchType: "phonetic" }
  }

  // 7. Last resort: check phonetic similarity of full strings
  const fullPhonetic = phoneticSimilarity(query, target)
  if (fullPhonetic >= 0.6) {
    return { score: 0.15 + fullPhonetic * 0.3, matchType: "phonetic" }
  }

  return null
}

function computePhoneticScore(queryWords: string[], targetWords: string[]): number {
  if (queryWords.length === 0 || targetWords.length === 0) return 0

  let totalScore = 0
  for (const qw of queryWords) {
    let bestWordScore = 0
    const qCode = colognePhonetics(qw)
    for (const tw of targetWords) {
      const tCode = colognePhonetics(tw)
      if (qCode.length > 0 && tCode.length > 0 && tCode.startsWith(qCode)) {
        bestWordScore = Math.max(bestWordScore, 0.8)
      } else {
        const sim = phoneticSimilarity(qw, tw)
        bestWordScore = Math.max(bestWordScore, sim)
      }
    }
    totalScore += bestWordScore
  }

  return totalScore / queryWords.length
}

/**
 * Search a list of foods by name with fuzzy matching.
 * Returns items sorted by relevance score (best first).
 */
export interface FuzzySearchOptions<T> {
  getAliases?: (item: T) => string[]
}

export interface FuzzySearchResultMeta {
  searchScore: number
  matchType: string
  matchedField?: "name" | "synonym"
  matchedValue?: string
}

type AugmentedSearchMatch = SearchMatch & {
  matchedField: "name" | "synonym"
  matchedValue: string
}

export function fuzzySearchFoods<T extends { name: string }>(
  query: string,
  items: T[],
  options?: FuzzySearchOptions<T>
): Array<T & FuzzySearchResultMeta> {
  if (!query.trim()) return items.map((item) => ({ ...item, searchScore: 1, matchType: "none" }))

  const results: Array<T & FuzzySearchResultMeta> = []

  for (const item of items) {
    let bestMatch: AugmentedSearchMatch | null = null

    const evaluateTarget = (target: string, field: "name" | "synonym") => {
      const match = scoreMatch(query, target)
      if (!match) return
      if (!bestMatch || match.score > bestMatch.score) {
        bestMatch = { ...match, matchedField: field, matchedValue: target }
      }
    }

    evaluateTarget(item.name, "name")

    if (options?.getAliases) {
      const aliases = options.getAliases(item)
      for (const alias of aliases) {
        evaluateTarget(alias, "synonym")
      }
    }

    if (bestMatch !== null) {
      const finalMatch: AugmentedSearchMatch = bestMatch
      results.push({
        ...item,
        searchScore: finalMatch.score,
        matchType: finalMatch.matchType,
        matchedField: finalMatch.matchedField,
        matchedValue: finalMatch.matchedValue,
      })
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.searchScore - a.searchScore)
  return results
}
