"use client"

/**
 * Synthèse vocale du coach — Web Speech API (`speechSynthesis`), zéro dépendance
 * et zéro coût serveur. Le coach répond en français par défaut, en arabe
 * (ar-TN) quand le mode derja 🇹🇳 est actif.
 *
 * Support : Safari iOS 16+, Chrome Android, Edge, desktop. Là où l'API manque
 * (Firefox sans voix, navigateurs in-app), `ttsSupported()` renvoie false et
 * l'UI masque simplement les boutons d'écoute — jamais d'erreur visible.
 */

export function ttsSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof window.SpeechSynthesisUtterance === "function"
  )
}

/** Retire le markdown, les emojis et les puces pour une lecture fluide. */
export function cleanForSpeech(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/^[#>\-•*\s]+/gm, "")
    // Emojis / pictogrammes : inutiles à l'oreille, souvent lus « visage… »
    .replace(/[\u{1F000}-\u{1FAFF}\u{2190}-\u{2BFF}\u{FE0F}]/gu, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, ". ")
    .trim()
}

/** Coupe un texte long en morceaux : certains moteurs avortent au-delà de ~200 caractères. */
function chunks(text: string, max = 180): string[] {
  // Découpage SANS lookbehind : les iPhone < iOS 16.4 n'acceptent pas cette
  // syntaxe dans un littéral regex (le module entier planterait au parse).
  const sentences = text.match(/[^.!?…]+[.!?…]*\s*/g) ?? [text]
  const out: string[] = []
  let current = ""
  for (const s of sentences) {
    if ((current + " " + s).trim().length > max && current) {
      out.push(current.trim())
      current = s
    } else {
      current = `${current} ${s}`
    }
  }
  if (current.trim()) out.push(current.trim())
  return out.length ? out : [text]
}

const FRENCH_FEMALE = ["Amel", "Audrey", "Aurelie", "Amelie", "Celine", "Marie"]

/** Voix la plus naturelle disponible pour la langue demandée. */
export function pickVoice(lang: string): SpeechSynthesisVoice | null {
  if (!ttsSupported()) return null
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null
  const prefix = lang.slice(0, 2).toLowerCase()
  const sameLang = voices.filter((v) => v.lang?.toLowerCase().startsWith(prefix))
  const pool = sameLang.length ? sameLang : []
  if (!pool.length) return null
  // Priorité aux voix locales (plus fluides hors ligne) puis aux voix nommées FR.
  const local = pool.filter((v) => v.localService)
  const named = (local.length ? local : pool).find((v) =>
    FRENCH_FEMALE.some((n) => v.name.toLowerCase().includes(n.toLowerCase())),
  )
  return named ?? (local[0] ?? pool[0]) ?? null
}

export type SpeakHandlers = {
  onStart?: () => void
  onEnd?: () => void
}

let activeUtterances = 0

/**
 * Lit un texte à voix haute. Renvoie false si la synthèse n'est pas disponible
 * ou si aucun texte lisible n'a été fourni.
 */
export function speak(text: string, lang = "fr-FR", handlers: SpeakHandlers = {}): boolean {
  if (!ttsSupported()) return false
  const clean = cleanForSpeech(text)
  if (!clean) return false

  stopSpeaking()

  const parts = chunks(clean)
  let finished = 0
  const voice = pickVoice(lang)
  activeUtterances = parts.length

  parts.forEach((part, i) => {
    const u = new SpeechSynthesisUtterance(part)
    u.lang = lang
    if (voice) u.voice = voice
    u.rate = 1
    u.pitch = 1
    u.volume = 1
    if (i === 0) u.onstart = () => handlers.onStart?.()
    u.onend = () => {
      finished += 1
      if (finished >= parts.length) {
        activeUtterances = 0
        handlers.onEnd?.()
      }
    }
    u.onerror = () => {
      finished += 1
      if (finished >= parts.length) {
        activeUtterances = 0
        handlers.onEnd?.()
      }
    }
    window.speechSynthesis.speak(u)
  })
  return true
}

export function stopSpeaking(): void {
  if (!ttsSupported()) return
  activeUtterances = 0
  try {
    window.speechSynthesis.cancel()
  } catch {
    // ignore
  }
}

export function isSpeaking(): boolean {
  if (!ttsSupported()) return false
  return activeUtterances > 0 || window.speechSynthesis.speaking
}
