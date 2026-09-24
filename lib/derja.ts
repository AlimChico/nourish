/**
 * Base derja tunisienne 🇹🇳 pour le Coach Sahtek.
 * Vocabulaire écrit en lettres latines ("arabizi") comme les Tunisiens écrivent
 * sur WhatsApp/Facebook, + expressions arabe-tunisien en script arabe.
 */

/** Vocabulaire derja (arabizi) — écriture latine courante en Tunisie. */
export const DERJA_VOCAB: Record<string, string[]> = {
  salutations: ["salam", "slam", "ssalam", "ahla", "ahlein", "labes", "labess", "chnowa", "chnowa7alek", "kirak", "3aslema", "aslema", "salut", "bonjour"],
  remercier: ["chokran", "chukran", "y3aychek", "barakallah", "merci", "3aychek", "mabrouk", "yekhti"],
  nourriture: [
    "makla", "taam", "ftour", "3sha", "goûta", "couscous", "kosksi", "lablabi", "brik", "chorba",
    "slata", "mechouia", "tajine", "mar9a", "kamounia", "mloukhia", "7out", "hout", "djej", "djaj",
    "3adam", "3adhem", "khobz", "harissa", "zitoun", "deglet", "tamr", "dattes", "laban", "rayeb",
    "jben", "semonoule", "fricassé", "kaftaji", "slata mechouia", "brika", "oyoun", "masfouf",
  ],
  sport: ["riyada", "muscu", "salle", "marche", "mchi", "kora", "natation", "podometre", "pas", "steps"],
  motivation: ["3andich", "ma3andich", "nichan", "nichane", "3ayan", "ayaan", "ya7asra", "chwaya", "mlih", "bahdla", "n7eb", "nhib", "nidham", "yekhi", "ya3tik", "sahbi", "sa7bi"],
  objectifs: ["wezn", "wazan", "kilou", "kilos", "3adel", "hadaf", "nakhser", "nakhes", "nzid", "n7eb nakhser"],
  calories: ["calorie", "calories", "kcal", "kalori", "kaloriya", "ta9a"],
  eau: ["elma", "lma", "verre", "kas"],
  jeûne: ["ramadan", "siyem", "soum", "sohour", "shour", "msah'ri"],
  excuses: ["smahli", "same7ni", "masema7tich"],
}

/** Expressions en script arabe tunisien. */
export const DERJA_ARABIC: string[] = [
  "سلام", "شنوة", "أحوالك", "لاباس", "شكرا", "براك الله", "كوسكسي", "لبلابي", "بريك", "شربة",
  "سلاطة", "مشوية", "طاجين", "ملوخية", "كمونية", "خبز", "هريسة", "زيتون", "دجاج", "حوت", "تمر",
  "رايب", "جبن", "رياضة", "نحب ننحف", "نحب نزيد", "وزني", "كيلو", "كالوري", "ماء", "رمضان",
  "صوم", "سحور", "فتور", "عشاء", "ماكلة", "صحة", "ساهة", "صاحبي", "نحبك",
]

/** Tous les mots-clés plats (minuscules) pour détection rapide. */
const FLAT_KEYWORDS: string[] = [...Object.values(DERJA_VOCAB).flat(), ...DERJA_ARABIC]
  .map((w) => w.trim().toLowerCase())
  .filter((w) => w.length >= 2)

/**
 * Détecte si un message est écrit en derja (arabizi ou arabe tunisien).
 * Heuristique : mots tunisiens connus + chiffres arabizi (3/7/9 = ع ح ق) + script arabe.
 */
export function isDerja(text: string): boolean {
  if (/[\u0600-\u06FF]/.test(text)) return true // script arabe
  const t = ` ${text.toLowerCase()} `
  let hits = 0
  for (const kw of FLAT_KEYWORDS) {
    if (t.includes(kw)) hits++
    if (hits >= 2) return true
  }
  // Un seul mot tunisien mais typographie arabizi (3a, 7a, 9a…) → derja probable
  const arabiziDigraph = /[a-z][379]|[379][a-z]/.test(t)
  return hits >= 1 && arabiziDigraph
}

/** Exemples de questions pour les chips derja. */
export const DERJA_SUGGESTIONS: { label: string; question: string }[] = [
  { label: "شنوة ناكل بالباقي؟", question: "شنوة ناكل بالكالوري لي باقيلي اليوم؟" },
  { label: "Lablabi khfif ?", question: "9addech kcal fi lablabi ? n7eb nmchi m3ah el youm" },
  { label: "نحب ننحف", question: "N7eb nakhser fil wezn, chnowa na3mel exactement ?" },
  { label: "Ftour ramadan sa7i7", question: "Chnowa ftour sa7i7 fi ramadan, makla barcha 3andi" },
  { label: "Protéines pas chères", question: "Kifech nal9a protéines arkhas barcha f Tunis ?" },
  { label: "Motivation 🔥", question: "Ma3andich motivation lel sport l youm, 3awni sahbi" },
]

/** Petites phrases derja pour personnaliser les réponses (côté serveur). */
export const DERJA_INTERJECTIONS: string[] = [
  "Yezi behi !", "Kol chay mchi mriguel 💪", "Sahit !", "Behi barcha !", "Yatik saha 🌿",
  "Rak nichan !", "Bravo 3lik 🔥", "Mabrouk !", "Aali khir !", "Ken kifech 💚",
]

/** Règles système derja injectées dans le prompt du coach. */
export const DERJA_SYSTEM_RULES = `
DERJA TUNISIENNE (quand le user écrit en derja ou active le mode 🇹🇳) :
- Réponds en derja tunisienne écrite en lettres latines (arabizi), comme sur WhatsApp : "n7eb", "mlih", "chnowa", "behi", "yekhi", "sahbi".
- Mélange naturel avec les mots français techniques (kcal, protéines) — c'est comme ça qu'on parle nutrition en Tunisie.
- Exemple de ton : "Yezi ! 3andek 450 kcal baqiin lel ftour. Kol kosksi sa7i7 b chwaya 3adam mchwiya 💪"
- Court : 2-4 phrases + 1 micro-action concrète. 1 emoji max par phrase.
- Si le user écrit en arabe (تونسي), réponds quand même en derja arabizi latin (plus lisible).
- Reste chaleureux et encourageant, jamais moralisateur.`
