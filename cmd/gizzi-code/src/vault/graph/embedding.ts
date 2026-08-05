/**
 * Deterministic note embeddings.
 *
 * Real semantic embeddings need either a network call (OpenAI, ruled out —
 * this must be deterministic and dependency-free) or a local ML model (not
 * available here). Instead: TF-IDF-weighted feature hashing — a
 * well-established, fully local, fully deterministic technique (the
 * "hashing trick"). Same vault content always produces the same vectors.
 *
 * The hash primitive is the same rolling multiply-add
 * runtime/brain/brain.service.ts's KeywordEmbedding already uses, just
 * scoped per-token and reduced mod N instead of returned as one raw
 * whole-string scalar — reuses the existing style rather than inventing a
 * new hash function.
 *
 * No persistent cache in this module — recomputing per `gizzi vault graph`
 * run is pure tokenization/hashing/counting, no ML inference cost, and is
 * fine at the hundreds-to-low-thousands-of-notes scale a personal vault
 * actually reaches. See semantic-linking.ts for the O(n^2) pairwise-compare
 * scale ceiling this feeds into.
 */

const DIMENSIONS = 384

// Small, deterministic English stopword list — not exhaustive, just enough
// to keep the highest-frequency structural words from dominating every
// vector.
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "then", "else", "of", "to",
  "in", "on", "at", "for", "with", "by", "from", "as", "is", "are", "was",
  "were", "be", "been", "being", "this", "that", "these", "those", "it",
  "its", "you", "your", "i", "we", "they", "he", "she", "his", "her",
  "their", "not", "no", "so", "do", "does", "did", "have", "has", "had",
  "will", "would", "can", "could", "should", "there", "here", "what",
  "which", "who", "when", "where", "how", "all", "each", "into", "about",
  "up", "out", "over", "under", "again", "than", "just", "also",
])

/** Lowercase, strip punctuation, split on whitespace, drop stopwords and very short tokens. */
export function tokenize(text: string): string[] {
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ")
  const raw = normalized.split(/\s+/).filter(Boolean)
  return raw.filter((t) => t.length >= 3 && !STOPWORDS.has(t))
}

/** Same rolling hash as brain.service.ts's KeywordEmbedding, scoped per-token and bucketed. */
function hashToken(token: string): number {
  let hash = 0
  for (let i = 0; i < token.length; i++) {
    hash = ((hash << 5) - hash + token.charCodeAt(i)) | 0
  }
  return Math.abs(hash) % DIMENSIONS
}

/** Document frequency (number of docs containing each token) across the whole corpus. */
export function computeDocumentFrequencies(tokenizedDocs: string[][]): Map<string, number> {
  const df = new Map<string, number>()
  for (const tokens of tokenizedDocs) {
    for (const token of new Set(tokens)) {
      df.set(token, (df.get(token) ?? 0) + 1)
    }
  }
  return df
}

/** TF-IDF-weighted, hash-bucketed dense vector for one document's tokens. */
export function embed(tokens: string[], df: Map<string, number>, totalDocs: number): number[] {
  const vector = new Array<number>(DIMENSIONS).fill(0)
  if (tokens.length === 0) return vector

  const tf = new Map<string, number>()
  for (const token of tokens) {
    tf.set(token, (tf.get(token) ?? 0) + 1)
  }

  for (const [token, count] of tf) {
    const docFreq = df.get(token) ?? 1
    // +1 smoothing avoids log(0)/div-by-zero when a token appears in every doc.
    const idf = Math.log(totalDocs / docFreq + 1)
    const weight = (count / tokens.length) * idf
    vector[hashToken(token)] += weight
  }

  return vector
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0
  let magA = 0
  let magB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!
    magA += a[i]! * a[i]!
    magB += b[i]! * b[i]!
  }
  if (magA === 0 || magB === 0) return 0
  return dot / (Math.sqrt(magA) * Math.sqrt(magB))
}
