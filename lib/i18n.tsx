"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

/**
 * Traduction de l'app — anglais (source), français, derja tunisienne 🇹🇳.
 *
 * ⚠️ Les dictionnaires sont indexés par le TEXTE ANGLAIS présent dans le code,
 * pas par des clés inventées (« Add food », pas « home.addFood »). Deux raisons :
 *
 *  1. L'anglais reste lisible partout dans le code : `t("Add food")` se comprend
 *     même sans ouvrir le dictionnaire, et un texte non traduit s'affiche en
 *     anglais au lieu d'afficher une clé technique.
 *  2. Ajouter une langue ne demande aucune modification des écrans.
 *
 * Corollaire : quand on change un texte source, il faut mettre à jour les deux
 * dictionnaires — d'où la règle « on ne reformule pas un libellé sans traduire ».
 *
 * Le derja est écrit en arabizi (lettres latines), comme les Tunisiens écrivent
 * sur WhatsApp — c'est aussi ce que fait déjà le Coach (voir `lib/derja.ts`).
 */

export type Locale = "en" | "fr" | "tn"

export const LOCALES: { code: Locale; label: string; hint: string }[] = [
  { code: "en", label: "English", hint: "English" },
  { code: "fr", label: "Français", hint: "Français" },
  { code: "tn", label: "Derja", hint: "تونسي — arabizi" },
]

const STORAGE_KEY = "sahtek.locale.v1"

/** Balise BCP-47 réelle de chaque langue — pour `lang` (lecteurs d'écran, SEO).
 *  Le derja s'écrit ici en lettres latines : la forme correcte est donc `ar-Latn`. */
const HTML_LANG: Record<Locale, string> = { en: "en", fr: "fr", tn: "ar-Latn-TN" }

type Values = Record<string, string | number>

/** 🇫🇷 */
const FR: Record<string, string> = {
  // ── Navigation ──────────────────────────────────────────────────────────────
  Home: "Accueil",
  Food: "Repas",
  Progress: "Progrès",
  Workout: "Sport",
  Profile: "Profil",

  // ── Tableau de bord ────────────────────────────────────────────────────────
  "Good morning": "Bonjour",
  "Good afternoon": "Bon après-midi",
  "Good evening": "Bonsoir",
  "Let's reach your goal today.": "Atteignons ton objectif aujourd'hui.",
  "Over budget": "Dépassé",
  Remaining: "Restant",
  "{done} / {goal} eaten": "{done} / {goal} consommées",
  Water: "Eau",
  Burn: "Brûlées",
  Steps: "Pas",
  "{n} kcal above your daily goal": "{n} kcal au-dessus de ton objectif",
  "{pct}% of today's {goal} kcal goal": "{pct} % de ton objectif de {goal} kcal",
  "Add food": "Ajouter un aliment",
  "Today's meals": "Repas du jour",
  "{n} kcal total": "{n} kcal au total",
  "Nothing in {meal} yet": "Rien dans {meal} pour l'instant",
  Add: "Ajouter",
  "See it in {meal}": "Voir dans {meal}",
  Portion: "Portion",
  "Move to": "Déplacer vers",
  "Delete this food": "Supprimer cet aliment",
  "{n} day streak": "{n} jours d'affilée",
  "This week": "Cette semaine",
  "Level {n}": "Niveau {n}",
  "{a} / {b} XP → level {n}": "{a} / {b} XP → niveau {n}",
  "+{n} today": "+{n} aujourd'hui",
  "Last scanned meal": "Dernier repas scanné",
  "Net calories": "Calories nettes",
  "(food − workout burn)": "(repas − sport)",
  // ── Repas & macros ─────────────────────────────────────────────────────────
  Breakfast: "Petit-déjeuner",
  Lunch: "Déjeuner",
  Dinner: "Dîner",
  Snacks: "Collations",
  Protein: "Protéines",
  Carbs: "Glucides",
  Fat: "Lipides",

  // ── Profil ─────────────────────────────────────────────────────────────────
  "Goal: {goal} · {kcal} kcal": "Objectif : {goal} · {kcal} kcal",
  "Lose weight": "Perdre du poids",
  Maintain: "Maintien",
  "Gain muscle": "Prendre du muscle",
  "Level {n} · {title}": "Niveau {n} · {title}",
  "Premium active 👑": "Premium actif 👑",
  "{plan} plan · unlimited scans": "Formule {plan} · scans illimités",
  "Go Premium": "Passer Premium",
  "{left}/{total} free scans left today · unlock unlimited":
    "{left}/{total} scans gratuits restants aujourd'hui · passe en illimité",
  "Body & progress": "Corps & progression",
  Current: "Actuel",
  Target: "Objectif",
  "Streak": "Série",
  "Days logged": "Jours loggés",
  "Weigh-ins": "Pesées",
  "Level": "Niveau",
  Tools: "Outils",
  "Calorie calculator": "Calculateur de calories",
  "Communauté — défis & recettes": "Communauté — défis & recettes",
  "Goals & targets": "Objectifs & cibles",
  "Body measurements & weight": "Mesures & poids",
  "Meal history": "Historique des repas",
  "Revoir le tutoriel": "Revoir le tutoriel",
  "Sign out": "Se déconnecter",
  "Log out": "Se déconnecter",
  "Settings & privacy": "Réglages & confidentialité",
  "Today's scans": "Scans du jour",
  "{pct}% of the way": "{pct} % du chemin",
  "to lose": "à perdre",
  "to gain": "à prendre",
  "— goal reached 🎉": "— objectif atteint 🎉",
  "{diff} kg since your first weigh-in": "{diff} kg depuis ta première pesée",
  Yearly: "annuelle",
  Monthly: "mensuelle",

  // ── Réglages ───────────────────────────────────────────────────────────────
  Settings: "Réglages",
  Account: "Compte",
  "Body profile": "Profil corporel",
  Diet: "Alimentation",
  Allergies: "Allergies",
  Preferences: "Préférences",
  "Privacy & data": "Confidentialité & données",
  "Progress & rewards": "Progression & récompenses",
  "Your profile": "Ton profil",
  Targets: "Cibles",
  App: "Application",
  "Privacy & legal": "Confidentialité & légal",
  Compte: "Compte",
  Leaderboard: "Classement",
  "Name, email": "Nom, e-mail",
  "Age, height, weight, activity": "Âge, taille, poids, activité",
  "Daily calories": "Calories quotidiennes",
  "BMR & TDEE": "Métabolisme (BMR & TDEE)",
  "Export my data": "Exporter mes données",
  "Download everything as JSON": "Tout télécharger en JSON",
  "Water goal": "Objectif d'eau",
  "glasses / day": "verres / jour",
  "Steps goal": "Objectif de pas",
  "steps / day": "pas / jour",
  "Dark mode": "Mode sombre",
  Notifications: "Notifications",
  "Rappel calories du jour": "Rappel calories du jour",
  "Heure du rappel": "Heure du rappel",
  "Entre 12h et 22h": "Entre 12h et 22h",
  "Politique de confidentialité": "Politique de confidentialité",
  "Supprimer mon compte": "Supprimer mon compte",
  "Language": "Langue",
  "App language": "Langue de l'app",
  "Used everywhere in the app": "Utilisée partout dans l'app",
  "Your rank vs all Sahtek players": "Ton rang face à tous les joueurs Sahtek",
  "Sign in to appear in the ranking": "Connecte-toi pour apparaître au classement",
  "{kcal} kcal · {g}g protein": "{kcal} kcal · {g} g de protéines",
  "BMR {bmr} kcal · maintenance {tdee} kcal": "BMR {bmr} kcal · maintien {tdee} kcal",
  "{n} glasses / day": "{n} verres / jour",
  "{n} steps / day": "{n} pas / jour",
  "Aurora night theme": "Thème nuit aurore",
  "Données, pubs, partage, contacts": "Données, pubs, partage, contacts",
  "Efface données + compte, définitif": "Efface données + compte, définitif",
  "No restriction": "Aucune restriction",
  Vegetarian: "Végétarien",
  Vegan: "Végétalien",
  Pescatarian: "Pescatarien",
  Halal: "Halal",
  "Delete all my data": "Supprimer toutes mes données",

  // ── Installation / hors ligne ──────────────────────────────────────────────
  "Offline — everything is kept, syncing as soon as you're back online.":
    "Hors-ligne — tout est gardé, synchro dès le retour du réseau.",
  "Sync interrupted — your data stays on your device.":
    "Synchro interrompue — tes données restent sur ton appareil.",
  Retry: "Réessayer",
  "Back online — syncing…": "De retour en ligne — synchronisation en cours…",
  "Install Sahtek as an app": "Installer Sahtek comme une app",
  "Fermer": "Fermer",

  // ── Phrases calculées (motivation, partage) ─────────
  "The day isn't over — log your meals to keep your streak alive.":
    "La journée n'est pas finie — logge tes repas pour garder ta série.",
  "Log your first meal to ignite today's streak.":
    "Logge ton premier repas pour lancer la série du jour.",
  "Over budget — a walk and a light dinner will balance the day.":
    "Au-dessus de ton objectif — une marche et un dîner léger équilibrent la journée.",
  "Almost at your goal — finish strong and on target!":
    "Presque à ton objectif — termine fort et pile dans la cible !",
  "Strong pace today — keep your meals balanced to land right on goal.":
    "Bon rythme aujourd'hui — garde des repas équilibrés pour tomber pile sur l'objectif.",
  "Halfway there — stay consistent, your goal is within reach.":
    "À mi-chemin — reste régulier, ton objectif est proche.",
  "Great start — fuel smart and keep the momentum going.":
    "Bon départ — mange intelligemment et garde l'élan.",
  "I've eaten {eaten} kcal today on Sahtek — {left} kcal left of my goal! 🥗🔥":
    "J'ai mangé {eaten} kcal aujourd'hui sur Sahtek — il me reste {left} kcal ! 🥗🔥",
  "{n} burn": "{n} brûlées",
  "1 item": "1 aliment",
  "{n} items": "{n} aliments",
  "Move to {meal}": "Déplacer vers {meal}",

  // ── Cartes secondaires du tableau de bord ───────────
  "Phone health sync": "Synchro santé du téléphone",
  "Motion sensors active — counting your steps 🚶": "Capteurs de mouvement actifs — tes pas sont comptés 🚶",
  "Motion access denied — add manually below": "Accès aux capteurs refusé — ajoute tes pas à la main",
  "Count steps with your phone's motion sensors": "Compter tes pas avec les capteurs du téléphone",
  "Desktop detected — add steps & workouts manually":
    "Ordinateur détecté — ajoute tes pas et tes séances à la main",
  "Enable": "Activer",
  "+ 1,000 steps": "+ 1 000 pas",
  "+ 15 min workout": "+ 15 min de sport",
  "Fits your {n} kcal left": "Ça rentre dans tes {n} kcal restantes",
  "Added!": "Ajouté !",
  "Quick add": "Ajout rapide",

  // ── Conseils du jour (le derja retombe sur le français) ──
  "Drink a glass of water before each meal — it helps with satiety.":
    "Bois un verre d'eau avant chaque repas — ça aide à être rassasié.",
  "Fill half your plate with veggies at lunch and dinner.":
    "Remplis la moitié de ton assiette de légumes au déjeuner et au dîner.",
  "A 10-minute walk after eating helps stabilize blood sugar.":
    "Une marche de 10 minutes après le repas aide à stabiliser la glycémie.",
  "Protein at breakfast keeps you full until lunch — try eggs or yogurt.":
    "Des protéines au petit-déjeuner tiennent jusqu'au déjeuner — œufs ou yaourt.",
  "Harissa and spices add flavor without calories — use them freely!":
    "Harissa et épices donnent du goût sans calories — n'hésite pas !",
  "Poor sleep increases hunger hormones. Aim for 7-8 hours tonight.":
    "Le manque de sommeil augmente la faim. Vise 7-8 h cette nuit.",
  "Eat slowly: your brain needs ~20 minutes to register fullness.":
    "Mange lentement : le cerveau met ~20 minutes à ressentir la satiété.",
}

/** 🇹🇳 — derja en arabizi, comme on l'écrit sur WhatsApp. Les mots techniques
 *  (kcal, protéines, Premium, Wi-Fi…) restent en français : c'est ainsi qu'on
 *  parle nutrition en Tunisie, et l'inventer autrement sonnerait faux. */
const TN: Record<string, string> = {
  // ── Navigation ──────────────────────────────────────────────────────────────
  Home: "El dar",
  Food: "Makla",
  Progress: "Ta9addom",
  Workout: "Riyada",
  Profile: "Profil",

  // ── Tableau de bord ────────────────────────────────────────────────────────
  "Good morning": "Sbah el khir",
  "Good afternoon": "3aslema",
  "Good evening": "Msa el khir",
  "Let's reach your goal today.": "Yalla nwasslou lel hadaf el youm.",
  "Over budget": "Fet el budget",
  Remaining: "Ba9i",
  "{done} / {goal} eaten": "{done} / {goal} mkoul",
  Water: "Maa",
  Burn: "Ma7rou9in",
  Steps: "Khatwat",
  "{n} kcal above your daily goal": "{n} kcal fok el hadaf mte3ek",
  "{pct}% of today's {goal} kcal goal": "{pct}% mel hadaf mte3ek {goal} kcal",
  "Add food": "Zid makla",
  "Today's meals": "Maklet el youm",
  "{n} kcal total": "{n} kcal fi kol chay",
  "Nothing in {meal} yet": "Mazelt ma 7attit chay fi {meal}",
  Add: "Zid",
  "See it in {meal}": "Choufha fi {meal}",
  Portion: "Kamiya",
  "Move to": "Na9el lel",
  "Delete this food": "N7i hadha el makla",
  "{n} day streak": "{n} nhar wra nhar",
  "This week": "El jom3a hedhi",
  "Level {n}": "Mostawa {n}",
  "{a} / {b} XP → level {n}": "{a} / {b} XP → mostawa {n}",
  "+{n} today": "+{n} el youm",
  "Last scanned meal": "A5er makla scannit'ha",
  "Net calories": "Kalori net",
  "(food − workout burn)": "(makla − riyada)",
  // ── Repas & macros ─────────────────────────────────────────────────────────
  Breakfast: "Ftour",
  Lunch: "Ghda",
  Dinner: "3cha",
  Snacks: "Gou3ta",
  Protein: "Protéines",
  Carbs: "Glucides",
  Fat: "Lipides",

  // ── Profil ─────────────────────────────────────────────────────────────────
  "Goal: {goal} · {kcal} kcal": "Hadaf: {goal} · {kcal} kcal",
  "Lose weight": "Nna99es el wezn",
  Maintain: "Nthabbet el wezn",
  "Gain muscle": "Nzid el muscle",
  "Premium active 👑": "Premium m3ak 👑",
  "{plan} plan · unlimited scans": "Formule {plan} · scans bla 7doud",
  "Go Premium": "Walli Premium",
  "{left}/{total} free scans left today · unlock unlimited":
    "Ba9i {left}/{total} scans bel free el youm · a7el bla 7doud",
  "Body & progress": "El jesm & ta9addom",
  Current: "Tawwa",
  Target: "Hadaf",
  "Streak": "Silsla",
  "Days logged": "Ayem mssadjlin",
  "Weigh-ins": "Waznat",
  "Level": "Mostawa",
  Tools: "Adawat",
  "Calorie calculator": "Calculateur de calories",
  "Communauté — défis & recettes": "Communauté — défis & recettes",
  "Goals & targets": "Hadaf & objectifs",
  "Body measurements & weight": "9yesset & wezn",
  "Meal history": "Historique mta3 el makla",
  "Revoir le tutoriel": "3awed el tutoriel",
  "Sign out": "O5rej",
  "Log out": "O5rej",
  "Settings & privacy": "Réglages & confidentialité",
  "Today's scans": "Scans el youm",
  "{pct}% of the way": "{pct}% mel tri9",
  "to lose": "bech tn9es",
  "to gain": "bech tzid",
  "— goal reached 🎉": "— wselt lel hadaf 🎉",
  "{diff} kg since your first weigh-in": "{diff} kg mel awel wazna",
  Yearly: "senawiya",
  Monthly: "chahriya",

  // ── Réglages ───────────────────────────────────────────────────────────────
  Settings: "Réglages",
  Account: "Compte",
  "Body profile": "Profil mta3 el jesm",
  Diet: "Nidham el makla",
  Allergies: "Allergies",
  Preferences: "Préférences",
  "Privacy & data": "Confidentialité & données",
  "Progress & rewards": "Ta9addom & récompenses",
  "Your profile": "Profil mte3ek",
  Targets: "Hadaf",
  App: "Application",
  "Privacy & legal": "Confidentialité & légal",
  Compte: "Compte",
  Leaderboard: "Classement",
  "Name, email": "Ism, e-mail",
  "Age, height, weight, activity": "3omr, toul, wezn, activité",
  "Daily calories": "Kalori el youm",
  "BMR & TDEE": "Métabolisme (BMR & TDEE)",
  "Export my data": "Nakhrej el données mte3i",
  "Download everything as JSON": "Kol chay fi fichier JSON",
  "Water goal": "Hadaf el maa",
  "glasses / day": "kas / youm",
  "Steps goal": "Hadaf el khatwat",
  "steps / day": "khatwa / youm",
  "Dark mode": "Mode sombre",
  Notifications: "Notifications",
  "Rappel calories du jour": "Rappel kalori el youm",
  "Heure du rappel": "Waqt el rappel",
  "Entre 12h et 22h": "Bin 12h w 22h",
  "Politique de confidentialité": "Politique de confidentialité",
  "Supprimer mon compte": "N7i el compte mte3i",
  "Language": "Lougha",
  "App language": "Lougha mta3 el app",
  "Used everywhere in the app": "Mosta3mla fi el app kolha",
  "Your rank vs all Sahtek players": "Rang mte3ek m3a el joueurs el kol",
  "Sign in to appear in the ranking": "Connecti bech tebda fi el classement",
  "{kcal} kcal · {g}g protein": "{kcal} kcal · {g}g protéines",
  "BMR {bmr} kcal · maintenance {tdee} kcal": "BMR {bmr} kcal · maintien {tdee} kcal",
  "{n} glasses / day": "{n} kas / youm",
  "{n} steps / day": "{n} khatwa / youm",
  "Aurora night theme": "Thème lil",
  "Données, pubs, partage, contacts": "Données, pub, partage, contacts",
  "Efface données + compte, définitif": "Yem7i el données + el compte, définitif",
  "Rappel même app fermée": "Rappel 7atta ki tkoun el app maskra",
  "No restriction": "Bla restriction",
  Vegetarian: "Nabti",
  Vegan: "Nabti 100%",
  Pescatarian: "Hout w khwaja",
  Halal: "Halal",
  "Delete all my data": "N7i el données mte3i kolhom",

  // ── Installation / hors ligne ──────────────────────────────────────────────
  "Offline — everything is kept, syncing as soon as you're back online.":
    "Offline — kol chay mssajjel, synchro ki terja3 el connexion.",
  "Sync interrupted — your data stays on your device.":
    "Synchro ma9tou3a — el données mte3ek b9aw fi el telifoun.",
  Retry: "3awed",
  "Back online — syncing…": "Rja3na online — synchro fi tri9ha…",
  "Install Sahtek as an app": "Installi Sahtek kima app",
  "Fermer": "Sakker",

  // ── Phrases calculées (motivation, partage) ─────────
  "The day isn't over — log your meals to keep your streak alive.":
    "El nhar mazel ma kmelch — sdajjel makletek bech ma te5sarch el silsla.",
  "Log your first meal to ignite today's streak.":
    "Sdajjel awel makla bech tbda el silsla mte3 el youm.",
  "Over budget — a walk and a light dinner will balance the day.":
    "Fok el hadaf — mchiya w 3cha khfif y3adlou el nhar.",
  "Almost at your goal — finish strong and on target!":
    "9rib tewsel lel hadaf — kemmel behi w b9a fi el hisab!",
  "Strong pace today — keep your meals balanced to land right on goal.":
    "Rythme behi el youm — kalli makla m3adla bech tewsel lel hadaf.",
  "Halfway there — stay consistent, your goal is within reach.":
    "Wselt lel nes — b9a régulier, el hadaf 9rib.",
  "Great start — fuel smart and keep the momentum going.":
    "Bidaya behia — kalli b3a9el w kemmel nichan.",
  "I've eaten {eaten} kcal today on Sahtek — {left} kcal left of my goal! 🥗🔥":
    "Klit {eaten} kcal el youm fi Sahtek — ba9i {left} kcal mel hadaf mte3i! 🥗🔥",
  "{n} burn": "{n} ma7rou9in",
  "1 item": "makla wa7da",
  "{n} items": "{n} maklat",
  "Move to {meal}": "Na9el lel {meal}",

  // ── Cartes secondaires du tableau de bord ───────────
  "Phone health sync": "Synchro santé mel telifoun",
  "Motion sensors active — counting your steps 🚶": "Capteurs mch3lin — 3addin lek el khatwat 🚶",
  "Motion access denied — add manually below": "Accès lel capteurs marfoudh — zid el khatwat b yeddek",
  "Count steps with your phone's motion sensors": "3add el khatwat b capteurs mte3 el telifoun",
  "Desktop detected — add steps & workouts manually":
    "Ordinateur — zid el khatwat w el riyada b yeddek",
  "Enable": "Ch3el",
  "+ 1,000 steps": "+ 1 000 khatwa",
  "+ 15 min workout": "+ 15 min riyada",
  "Fits your {n} kcal left": "Dakhl fi {n} kcal el ba9yin",
  "Added!": "Tzadet!",
  "Quick add": "Zid b sor3a",
}

const DICTS: Record<Exclude<Locale, "en">, Record<string, string>> = { fr: FR, tn: TN }

/** Remplace `{nom}` par sa valeur. Un jeton sans valeur reste visible : on voit
 *  tout de suite qu'un appel passe les mauvais paramètres. */
function interpolate(source: string, values?: Values): string {
  if (!values) return source
  return source.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  )
}

/**
 * Traduit un texte source. Chaîne de repli : langue choisie → français → anglais.
 * Le repli par le français est ce qui rend le derja utile même incomplet : un
 * libellé non encore traduit en derja s'affiche en français, pas en anglais.
 */
export function translate(locale: Locale, source: string, values?: Values): string {
  if (locale === "en") return interpolate(source, values)
  const hit = DICTS[locale][source] ?? (locale === "tn" ? FR[source] : undefined)
  return interpolate(hit ?? source, values)
}

export type T = (source: string, values?: Values) => string

type Ctx = { locale: Locale; setLocale: (l: Locale) => void; t: T }

const LocaleContext = createContext<Ctx>({ locale: "en", setLocale: () => {}, t: (s) => s })

/**
 * Langue au premier lancement : la préférence enregistrée, sinon celle du
 * navigateur — mais SEULEMENT pour le français. Un téléphone en arabe ne bascule
 * pas d'office en derja arabizi : c'est un choix d'écriture, on ne l'impose pas.
 */
function initialLocale(): Locale {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved === "en" || saved === "fr" || saved === "tn") return saved
  } catch {
    // stockage indisponible (navigation privée) : on reste sur la détection
  }
  try {
    if ((navigator.language || "").toLowerCase().startsWith("fr")) return "fr"
  } catch {
    // navigator absent (rendu serveur) : anglais
  }
  return "en"
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  // Anglais au premier rendu : le serveur ne connaît pas la préférence, et lire
  // localStorage pendant le rendu provoquerait un décalage d'hydratation.
  const [locale, setLocaleState] = useState<Locale>("en")

  useEffect(() => {
    setLocaleState(initialLocale())
  }, [])

  useEffect(() => {
    try {
      document.documentElement.lang = HTML_LANG[locale]
    } catch {
      // document absent : rien à faire
    }
  }, [locale])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // stockage indisponible : la langue reste active pour la session
    }
  }, [])

  const t = useCallback<T>((source, values) => translate(locale, source, values), [locale])

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t])

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

/** Traducteur courant. */
export function useT(): T {
  return useContext(LocaleContext).t
}

/** Langue courante + moyen de la changer (sélecteur des réglages). */
export function useLocale(): { locale: Locale; setLocale: (l: Locale) => void } {
  const { locale, setLocale } = useContext(LocaleContext)
  return { locale, setLocale }
}

/**
 * Initiales des jours (lundi → dimanche) pour la semaine du tableau de bord.
 * Des lettres seules ne se traduisent pas : « T » vaut mardi ET jeudi en anglais.
 * En Tunisie les jours se disent en français (lundi, mardi…) → même jeu de
 * lettres qu'en français, y compris en derja.
 */
const WEEK_LETTERS: Record<Locale, string[]> = {
  en: ["M", "T", "W", "T", "F", "S", "S"],
  fr: ["L", "M", "M", "J", "V", "S", "D"],
  tn: ["L", "M", "M", "J", "V", "S", "D"],
}

export function useWeekLetters(): string[] {
  return WEEK_LETTERS[useContext(LocaleContext).locale]
}
