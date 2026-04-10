/**
 * Kölner Phonetik (Cologne Phonetics) — a phonetic algorithm designed for the German language.
 * Maps German words to phonetic codes so that similar-sounding words produce the same code.
 * Handles umlauts, compound consonants (sch, ch, ck, etc.), and German-specific rules.
 *
 * Reference: Hans Joachim Postel, "Die Kölner Phonetik", IBM-Nachrichten 19 (1969), pp. 925-931.
 */

const UMLAUT_MAP: Record<string, string> = {
  ä: "ae",
  ö: "oe",
  ü: "ue",
  ß: "ss",
}

function normalizeGerman(input: string): string {
  let result = input.toLowerCase().trim()
  for (const [umlaut, replacement] of Object.entries(UMLAUT_MAP)) {
    result = result.replaceAll(umlaut, replacement)
  }
  // Remove anything that's not a-z
  return result.replace(/[^a-z]/g, "")
}

/**
 * Returns the Cologne phonetic code for a German string.
 */
export function colognePhonetics(word: string): string {
  const normalized = normalizeGerman(word)
  if (normalized.length === 0) return ""

  const chars = normalized.split("")
  const codes: string[] = []

  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]
    const prev = i > 0 ? chars[i - 1] : ""
    const next = i < chars.length - 1 ? chars[i + 1] : ""

    let code: string

    switch (c) {
      case "a":
      case "e":
      case "i":
      case "o":
      case "u":
        code = "0"
        break
      case "h":
        code = ""
        break
      case "b":
        code = "1"
        break
      case "p":
        code = next === "h" ? "3" : "1"
        break
      case "d":
      case "t":
        code = ["c", "s", "z"].includes(next) ? "8" : "2"
        break
      case "f":
      case "v":
      case "w":
        code = "3"
        break
      case "g":
      case "k":
      case "q":
        code = "4"
        break
      case "c": {
        if (i === 0) {
          // Initial C: before A, H, K, L, O, Q, R, U, X → 4, else → 8
          code = ["a", "h", "k", "l", "o", "q", "r", "u", "x"].includes(next) ? "4" : "8"
        } else {
          // After S, Z → 8; before A, H, K, O, Q, U, X → 4 (unless preceded by S/Z); else → 8
          if (["s", "z"].includes(prev)) {
            code = "8"
          } else {
            code = ["a", "h", "k", "o", "q", "u", "x"].includes(next) ? "4" : "8"
          }
        }
        break
      }
      case "x":
        code = ["c", "k", "q"].includes(prev) ? "8" : "48"
        break
      case "l":
        code = "5"
        break
      case "m":
      case "n":
        code = "6"
        break
      case "r":
        code = "7"
        break
      case "s":
      case "z":
        code = "8"
        break
      case "j":
        code = "0"
        break
      case "y":
        code = "0"
        break
      default:
        code = ""
    }

    codes.push(code)
  }

  // Remove consecutive duplicates, then remove all 0s (except if it's the only code)
  let result = ""
  for (let i = 0; i < codes.length; i++) {
    if (codes[i] !== "" && (i === 0 || codes[i] !== codes[i - 1])) {
      result += codes[i]
    }
  }

  // Remove zeros (vowels) except leading zero
  if (result.length > 1) {
    result = result[0] + result.slice(1).replace(/0/g, "")
  }

  return result
}

/**
 * Checks if two German strings are phonetically similar using Cologne Phonetics.
 * Returns true if either code starts with the other (prefix match for partial queries).
 */
export function isPhoneticMatch(query: string, target: string): boolean {
  const qCode = colognePhonetics(query)
  const tCode = colognePhonetics(target)
  if (qCode.length === 0 || tCode.length === 0) return false
  return tCode.startsWith(qCode) || qCode.startsWith(tCode)
}

/**
 * Calculates phonetic similarity score between two strings (0-1).
 * 1 = identical phonetic codes, 0 = completely different.
 */
export function phoneticSimilarity(a: string, b: string): number {
  const codeA = colognePhonetics(a)
  const codeB = colognePhonetics(b)
  if (codeA.length === 0 || codeB.length === 0) return 0

  // Check prefix match length
  let matchLen = 0
  const minLen = Math.min(codeA.length, codeB.length)
  for (let i = 0; i < minLen; i++) {
    if (codeA[i] === codeB[i]) matchLen++
    else break
  }

  const maxLen = Math.max(codeA.length, codeB.length)
  return matchLen / maxLen
}
