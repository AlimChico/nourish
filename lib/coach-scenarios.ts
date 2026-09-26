import { isDerja, DERJA_INTERJECTIONS } from "@/lib/derja"

/**
 * Bibliothèque de scénarios du Coach Sahtek 🇹🇳
 *
 * Objectif : couvrir TOUS les cas qu'un utilisateur peut poser au coach, dans
 * les 3 langues de l'app — derja tunisienne (arabizi latin), français, anglais.
 *
 * - `keywords` : détection d'intention (3 langues mélangées, minuscules).
 *   L'IA reçoit cette liste comme « couverture garantie » dans son prompt
 *   système ; le fallback local (pas de clé API, quota atteint, erreur réseau)
 *   y répond mot pour mot avec les DONNÉES RÉELLES du jour (kcal, protéines,
 *   eau, streak) — jamais de réponse creuse.
 */

export type CoachLang = "tn" | "fr" | "en"

export type CoachContext = {
  name?: string
  goal?: string
  targetCalories?: number
  eaten?: number
  remaining?: number
  protein?: { eaten: number; target: number }
  water?: { drunk: number; target: number }
  steps?: number
  workoutMinutes?: number
  streak?: number
  weightTrend?: { latest: number; changePerWeek: number } | null
  question: string
}

type Answer = string | ((c: CoachContext) => string)

export type Scenario = {
  id: string
  keywords: string[]
  answers: Record<CoachLang, Answer>
}

/* ---------- helpers ---------- */

/** 2180 → "2 180" (style français/tunisien, espace insécable évitée). */
const fmt = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")
const pLeft = (c: CoachContext): number => Math.max(0, (c.protein?.target ?? 0) - (c.protein?.eaten ?? 0))
const wLeft = (c: CoachContext): number => Math.max(0, (c.water?.target ?? 8) - (c.water?.drunk ?? 0))

/* ---------- scénarios ---------- */

export const SCENARIOS: Scenario[] = [
  {
    id: "greeting",
    keywords: ["salam", "slam", "ahla", "ahlein", "aslema", "3aslema", "labes", "chnowa", "chnowa7alek", "kirak", "sbah lkhir", "hello", "hi ", "hey", "bonjour", "salut", "coucou", "yo ", "good morning"],
    answers: {
      tn: "Ahla ! 🙌 Chnowa7alek ? Nnajem nchouf m3ak l budget, l protéines, idée meal wala sport — sa2elni. Micro-action : goli li kifech l youm.",
      fr: "Salut ! 👋 Prêt à avancer ? Je peux te parler budget kcal, protéines, idées repas ou sport. Micro-action : dis-moi où tu en es aujourd’hui.",
      en: "Hey! 👋 Ready to go? Ask me about your kcal budget, protein, meal ideas or training. Micro-action: tell me how today’s looking.",
    },
  },
  {
    id: "thanks",
    keywords: ["chokran", "chukran", "y3aychek", "barakallah", "merci", "thanks", "thank you", "thx", "mabrouk", "top ", "great"],
    answers: {
      tn: "Bil gharam 💚 Ana houna ken t7eb chay a5hor. Micro-action : kemmel l youm b 9owa.",
      fr: "Avec plaisir 💚 Je suis là quand tu veux. Micro-action : termine la journée en force.",
      en: "Anytime 💚 I’m here whenever you need. Micro-action: finish the day strong.",
    },
  },
  {
    id: "remaining_calories",
    keywords: ["baqi", "baqiin", "li baqi", "9addech", "kaddech", "reste", "restantes", "remaining", "left", "how many calories", "combien de calories", "budget"],
    answers: {
      tn: (c) => `Baqi lik ${fmt(c.remaining ?? 0)} kcal lel youm (${fmt(c.eaten ?? 0)}/${fmt(c.targetCalories ?? 0)}), w ${pLeft(c)} g protéines. El a7san : djej machwi wala 3adam maslou9 m3a slata khadra. Micro-action : sajjel el meal l jay 9bal ma takol 💪`,
      fr: (c) => `Il te reste ${fmt(c.remaining ?? 0)} kcal sur ${fmt(c.targetCalories ?? 0)} (${fmt(c.eaten ?? 0)} déjà mangées), dont ${pLeft(c)} g de protéines. Idéal : protéines maigres + légumes. Micro-action : logge ton prochain repas avant de manger 💪`,
      en: (c) => `You have ${fmt(c.remaining ?? 0)} kcal left today (${fmt(c.eaten ?? 0)}/${fmt(c.targetCalories ?? 0)} eaten) and ${pLeft(c)} g of protein. Best pick: lean protein + veggies. Micro-action: log your next meal before eating 💪`,
    },
  },
  {
    id: "over_budget",
    keywords: ["dépassé", "depasse", "trop mangé", "trop mange", "over ", "exceeded", "dbahalt", "tbahhalt", "ghlta", "khrejt", "too much"],
    answers: {
      tn: "Ma3lich, sahit ! Yom wa7ed ma yohrebch 💪 Erja3 lel nidham ghodwa. Micro-action : machi 20 min tawa w echreb elma, ghodwa nebdaw nidham.",
      fr: "Pas de drame — un jour dépassé ne casse rien 💪 Ce qui compte, c’est la semaine. Micro-action : marche 20 min ce soir et reviens au budget dès demain.",
      en: "No drama — one over-budget day breaks nothing 💪 What matters is the week. Micro-action: walk 20 min tonight and hit budget again tomorrow.",
    },
  },
  {
    id: "protein",
    keywords: ["protéine", "proteine", "protein", "muscler", "muscle", "3adam", "djej", "chicken", "egg", "whey"],
    answers: {
      tn: (c) => `Protéines : 3adam maslou9, djej machwi, ton, rayeb, jben blanc — arkhas w mchab3in. Baqi lik ${pLeft(c)} g lel youm. Micro-action : zid source protéine fel ftour w el 3sha.`,
      fr: (c) => `Protéines : œufs, poulet grillé, thon, yaourt grec, fromage blanc — pas chères et rassasiantes. Il t’en manque ${pLeft(c)} g aujourd’hui. Micro-action : une source à chaque repas.`,
      en: (c) => `Protein: eggs, grilled chicken, tuna, Greek yogurt, cottage cheese — cheap and filling. You still need ${pLeft(c)} g today. Micro-action: one protein source per meal.`,
    },
  },
  {
    id: "carbs",
    keywords: ["glucide", "glucides", "carbs", "khobz", "pain", "riz", "rice", "makaroun", "pâtes", "pasta", "semoule"],
    answers: {
      tn: "El carbs machi 3adou — el 9adrsa 3adou. Khobz 7awi wala semoule ba3d l machi, w 9is b el kaff. Micro-action : nos l khobz 3ada l youm, mach djeja.",
      fr: "Les glucides ne sont pas l’ennemi — la quantité l’est. Pain complet ou semoule autour du sport, portion à la main. Micro-action : divise ta portion de pain aujourd’hui.",
      en: "Carbs aren’t the enemy — portions are. Whole bread or semolina around workouts, measure by hand. Micro-action: halve your bread portion today.",
    },
  },
  {
    id: "fat_macros",
    keywords: ["lipide", "lipides", "gras", "huile", "zit", "zeyt", "olive oil", "fromage", "cheese", " fat "],
    answers: {
      tn: "Zit ez-zitoun mlih ama calorique : kas9i9 (cuillère) = 90 kcal. 9is biz-zit wala spray. Micro-action : zit wa7da fel slata l youm, mch thnin.",
      fr: "L’huile d’olive est excellente mais calorique : 1 cuillère ≈ 90 kcal. Dose à la cuillère, pas au filet. Micro-action : une seule cuillère dans la salade du jour.",
      en: "Olive oil is great but calorie-dense: 1 spoon ≈ 90 kcal. Measure with a spoon, don’t free-pour. Micro-action: one spoon in today’s salad, not two.",
    },
  },
  {
    id: "water",
    keywords: ["eau", "elma", "lma", "water", "hydratation", "echreb", "boire", "verre", "verres", "kas", "drink"],
    answers: {
      tn: (c) => `Echreb ${wLeft(c)} kas elma akther lel youm — el mo3da tnajem ya7ki « joo3 » w hiya 3atcha. Micro-action : kas tawa, w kas 9bal kol makla 💧`,
      fr: (c) => `Il te manque ${wLeft(c)} verre(s) d’eau. La soif passe souvent pour de la faim. Micro-action : un verre maintenant, un avant chaque repas 💧`,
      en: (c) => `You’re ${wLeft(c)} glass(es) short on water. Thirst often masquerades as hunger. Micro-action: one glass now, one before each meal 💧`,
    },
  },
  {
    id: "steps_activity",
    keywords: ["pas", "steps", "marcher", "marche", "machi", "walking", "podometre", "actif", "sedentaire", "bouger", "move more"],
    answers: {
      tn: "10 min machi ba3d kol makla = +3 000 pas w glycémie a7sen. Micro-action : aksel 1 000 pas 3la total mta3 el barah.",
      fr: "10 minutes de marche après chaque repas ≈ +3 000 pas/jour et une meilleure glycémie. Micro-action : dépasse ton total d’hier de 1 000 pas.",
      en: "A 10-minute walk after each meal ≈ +3,000 steps/day and better blood sugar. Micro-action: beat yesterday’s total by 1,000 steps.",
    },
  },
  {
    id: "workout_general",
    keywords: ["sport", "workout", "training", "entrainer", "exercise", "gym", "muscu", "salle", "riyada", "séance", "seance", "lift"],
    answers: {
      tn: "Ebda bsata : 3 séances/sem (squat, pompes, planche) wala 45 min full-body ken 3andek salle. Micro-action : 20 squat tawa 🏋️",
      fr: "Commence simple : 3 séances/semaine (squats, pompes, gainage) ou 45 min full-body en salle. Micro-action : 20 squats maintenant, sans excuses 🏋️",
      en: "Keep it simple: 3 sessions/week (squats, push-ups, planks), or 45-min full body at the gym. Micro-action: 20 squats right now 🏋️",
    },
  },
  {
    id: "workout_home",
    keywords: ["chez moi", "home workout", "sans matériel", "no equipment", "domicile", "mn dar", "home "],
    answers: {
      tn: "Fi dar bla matériel : squat, pompes (3ala rkanbien ken sa3b), fentes, planche — 3 tours, 20 min. Micro-action : a3mel l circuit l youm.",
      fr: "À la maison, sans matériel : squats, pompes (sur les genoux si besoin), fentes, planche — 3 tours, ~20 min. Micro-action : fais le circuit aujourd’hui.",
      en: "No equipment needed: squats, push-ups (knees if needed), lunges, plank — 3 rounds, ~20 min. Micro-action: run the circuit today.",
    },
  },
  {
    id: "weight_loss",
    keywords: ["perdre", "maigrir", "nakhser", "nakhes", "weight loss", "lose weight", "losing", "minceur", "n7eb nakhser", "engraisser"],
    answers: {
      tn: "Bech tkhser wezn : déficit dhki 300–500 kcal/yom, protéines 3alya, machi kol youm — bla régimes extrêmes. Micro-action : pes rou7ek ghodwa sbah 9bal l ftour.",
      fr: "Pour perdre : déficit doux de 300–500 kcal/jour, protéines élevées, marche quotidienne — pas de régime extrême. Micro-action : pèse-toi demain matin à jeun.",
      en: "To lose: a gentle 300–500 kcal/day deficit, high protein, daily steps — no crash diet. Micro-action: weigh yourself tomorrow morning, fasted.",
    },
  },
  {
    id: "weight_gain",
    keywords: ["prendre du poids", "grossir", "nzid", "gain", "bulk", "masse", "nzid fil wezn", "gain weight"],
    answers: {
      tn: "Bech tzid b muscle : surplus +250 kcal/yom, ~1.8 g protéines/kg, muscu 3–4x/sem. Micro-action : zid rayeb w 2 tranches jben fel ftour.",
      fr: "Pour prendre : surplus de +250 kcal/jour, ~1,8 g de protéines/kg, muscu 3–4×/semaine. Micro-action : ajoute yaourt + fromage blanc au petit-déj.",
      en: "To gain: +250 kcal/day surplus, ~1.8 g protein/kg, lift 3–4×/week. Micro-action: add yogurt and cottage cheese to breakfast.",
    },
  },
  {
    id: "plateau",
    keywords: ["palier", "plateau", "stagne", "stagner", "stuck", "stopped losing", "ma3adsh nzel", "plus rien bouge", "stall"],
    answers: {
      tn: "Ken l wezn w9ef 2–3 simanat : 3adi (el ma, cortisol). N9as 100–150 kcal wala zid 2 000 pas 3la 10 ayam. Micro-action : pes fi nafs l wa9t kol sbah.",
      fr: "Stagnation depuis 2–3 semaines ? C’est normal (eau, cortisol). Coupe 100–150 kcal ou ajoute 2 000 pas pendant 10 jours. Micro-action : pèse-toi à la même heure chaque matin.",
      en: "Stalled 2–3 weeks? That’s normal (water, cortisol). Trim 100–150 kcal or add 2,000 steps for 10 days. Micro-action: weigh at the same time every morning.",
    },
  },
  {
    id: "meal_ideas",
    keywords: ["manger ce soir", "dîner", "diner", "dinner", "lunch", "déjeuner", "dejeuner", "ftour", "3sha", "recette", "recipe", "idée repas", "idee repas", "chnowa nakol", "chnowa naakol", "what should i eat", "meal idea"],
    answers: {
      tn: "Idées lel youm 🇹🇳 : djej machwi + slata mechouia, ton + khobz chwaya, 3adam + semoule, lablabi khfif. Micro-action : a5tar wa7da w sajjelha 9bal ma takol.",
      fr: "Idées du jour : poulet grillé + salade mechouia, thon + un peu de pain, œufs + semoule, lablabi léger. Micro-action : choisis-en une et logge-la avant de manger.",
      en: "Ideas today: grilled chicken + mechouia salad, tuna + a little bread, eggs + semolina, light lablabi. Micro-action: pick one and log it before eating.",
    },
  },
  {
    id: "snack",
    keywords: ["collation", "snack", "goûter", "gouter", "faim entre", "grignoter", "hungry between", "hchwa"],
    answers: {
      tn: "Faim bin el wakit : rayeb, 3adam maslou9, lauz, tfa7. Micro-action : kas elma 9bal — nos l « joo3 » hiya 3atch.",
      fr: "Faim entre les repas : yaourt grec, œuf dur, amandes, pomme. Micro-action : bois un verre d’eau d’abord — la moitié de la « faim » est de la soif.",
      en: "Snack smart: Greek yogurt, boiled egg, almonds, apple. Micro-action: drink a glass of water first — half of “hunger” is thirst.",
    },
  },
  {
    id: "sweets",
    keywords: ["sucre", "sucré", "chocolat", "chocolate", "sweet", "dessert", "gateau", "gâteau", "7lou", "halwa", "craving"],
    answers: {
      tn: "7lou ma mamnou3 : 2–3 tamr wala fruit ba3d l makla (mch wa7dou), stanna 20 min 9bal ma t3awed. Micro-action : l youm baddel l dessert b 3 tamr 🌴",
      fr: "Le sucré n’est pas interdit : 2–3 dattes ou un fruit après le repas (jamais seul), attends 20 min avant de reprendre. Micro-action : dessert du jour = 3 dattes 🌴",
      en: "Sweets aren’t banned: 2–3 dates or fruit after a meal (never alone), wait 20 min before round two. Micro-action: today’s dessert = 3 dates 🌴",
    },
  },
  {
    id: "local_dishes",
    keywords: ["couscous", "kosksi", "lablabi", "brik", "brika", "chorba", "mloukhia", "kamounia", "tajine", "mechouia", "ojja", "masfouf", "harissa", "plat tunisien"],
    answers: {
      tn: (c) => `Repères kcal 🇹🇳 : kosksi ~600, lablabi ~450, brik ~300/l wa7da, mloukhia ~400, slata mechouia ~100. Baqi lik ${fmt(c.remaining ?? 0)} kcal — lablabi khfif wala djej + slata. Micro-action : sajjel 9bal ma takol.`,
      fr: (c) => `Repères kcal 🇹🇳 : couscous ~600, lablabi ~450, brik ~300/pièce, mloukhia ~400, mechouia ~100. Avec ${fmt(c.remaining ?? 0)} kcal restantes : lablabi léger ou djej + salade. Micro-action : logge avant de manger.`,
      en: (c) => `Rough kcal 🇹🇳: couscous ~600, lablabi ~450, brik ~300 each, mloukhia ~400, mechouia salad ~100. With ${fmt(c.remaining ?? 0)} kcal left: light lablabi or chicken + salad. Micro-action: log before you eat.`,
    },
  },
  {
    id: "fast_food",
    keywords: ["fast food", "mcdo", "kebab", "pizza", "burger", "frites", "sandwich", "street food", "fricassé"],
    answers: {
      tn: "Fast food mara fil simana mch catastrophe : burger simple ~500, pizza 2 parts ~550, frites ~330. El 7il : wa7da mch el combo. Micro-action : l youm burger WALA pizza, mch ezzouz.",
      fr: "Fast food 1×/semaine ≠ catastrophe : burger simple ~500 kcal, 2 parts de pizza ~550, frites ~330. L’astuce : UN item, pas le combo. Micro-action : burger OU pizza, pas les deux.",
      en: "Fast food once a week ≠ disaster: plain burger ~500 kcal, 2 pizza slices ~550, fries ~330. Trick: ONE item, not the combo. Micro-action: burger OR pizza, not both.",
    },
  },
  {
    id: "eating_out",
    keywords: ["restaurant", "invitation", "mariage", "wedding", "sortir", "soirée", "soiree", "invité", "3azima", "eating out", "dîner dehors"],
    answers: {
      tn: "3azima ? Akel chwaya protéine 9bal (rayeb/3adam), a5tar machwi mch m9li, w 3ammer l assiette slata. Micro-action : khaffef l ftour lel youm bech tsafer l 3sha bel raha.",
      fr: "Invitation ? Une collation protéinée avant (yaourt, œuf), grillé plutôt que frit, assiette remplie de salade. Micro-action : allège le déjeuner pour profiter du dîner sereinement.",
      en: "Eating out? Protein snack first (yogurt, egg), grilled over fried, load the plate with salad. Micro-action: lighten lunch so dinner stays stress-free.",
    },
  },
  {
    id: "ramadan",
    keywords: ["ramadan", "ramdhan", "siyem", "soum", "jeûne", "jeune", "fasting", "sohour", "shour", "suhoor", "iftar", "msahri"],
    answers: {
      tn: "Ramadan : sohour = 3adam + rayeb + tamr (dima protéine) ; ftour = tamr + chorba khfifa 9bal l makla l kbira, machi 30 min ba3d. Micro-action : 3 kas elma bin l ftour w l na9s 🌙",
      fr: "Ramadan : sohour = œufs + yaourt + dattes (toujours des protéines) ; ftour = dattes + chorba légère avant le plat principal, marche 30 min après. Micro-action : 3 verres d’eau entre l’iftar et le coucher 🌙",
      en: "Ramadan: sohour = eggs + yogurt + dates (always protein); iftar = dates + light soup before the main dish, walk 30 min after. Micro-action: 3 glasses of water between iftar and bed 🌙",
    },
  },
  {
    id: "stress_emotional",
    keywords: ["stress", "stressé", "anxiety", "anxiété", "émotion", "emotion", "emotional", "ennui", "boredom", "ta3ban", "mzari3"],
    answers: {
      tn: "Ken tekol mn el stress : wa9ef 10 min — machi wala nafas 3ami9 — kas elma, w estanna : joo3 s7i7 wala 7ala ? Micro-action : 10 min machi 9bal ay makla mn ghir joo3.",
      fr: "Manger sous stress ? Stop 10 minutes : marche ou respiration, verre d’eau, puis demande-toi si c’est une vraie faim. Micro-action : 10 min de marche avant toute collation émotionnelle.",
      en: "Stress eating? Pause 10 minutes: walk or breathe deeply, drink water, then ask if it’s real hunger. Micro-action: 10-minute walk before any emotional snack.",
    },
  },
  {
    id: "sleep",
    keywords: ["sommeil", "dormir", "sleep", "insomnie", "na9s", "ra9ad", "tired"],
    answers: {
      tn: "El na9s el 9alil yzid el joo3 (ghréline) w yna9as l volonté. Hadaf : 7–8 sa3a. Micro-action : l youm rou7 tena3s 30 min 9bal, telephone barra men l farch.",
      fr: "Le manque de sommeil augmente la faim (ghréline) et casse la volonté. Vise 7–8 h. Micro-action : ce soir, au lit 30 min plus tôt, téléphone hors du lit.",
      en: "Short sleep spikes hunger (ghrelin) and wrecks willpower. Aim for 7–8 h. Micro-action: tonight, lights out 30 min earlier, phone off the bed.",
    },
  },
  {
    id: "groceries_budget",
    keywords: ["courses", "budget courses", "arkhas", "pas cher", "cheap", "économies", "economies", "prix", "dmegh"],
    answers: {
      tn: "Protéines arkhas f Tunis : 3adam, ton canned, djej frozen, rayeb, jben blanc, 3adas, sardine. Micro-action : l simana — 3adam + ton + 3adas el 9a3da.",
      fr: "Protéines pas chères : œufs, thon en boîte, poulet congelé, yaourt, fromage blanc, lentilles, sardines. Micro-action : priorité courses = œufs + thon + lentilles.",
      en: "Budget proteins: eggs, canned tuna, frozen chicken, yogurt, cottage cheese, lentils, sardines. Micro-action: this week’s staples = eggs + tuna + lentils first.",
    },
  },
  {
    id: "vegetarian",
    keywords: ["végétarien", "vegetarien", "vegan", "végan", "sans viande", "no meat", "lentilles", "3adas", "pois chiches", "hommos"],
    answers: {
      tn: "Protéine bla l7am : 3adas, hommos, fasoulia, tofu, jben, rayeb, 3adam. Micro-action : zid 3adas wala hommos fel ftour l youm.",
      fr: "Protéines sans viande : lentilles, pois chiches, haricots, tofu, œufs, fromage blanc, yaourt grec. Micro-action : ajoute des lentilles ou pois chiches à ton déjeuner.",
      en: "Meat-free protein: lentils, chickpeas, beans, tofu, eggs, cottage cheese, Greek yogurt. Micro-action: add lentils or chickpeas to lunch.",
    },
  },
  {
    id: "drinks_coffee",
    keywords: ["café", "cafe", "coffee", "thé", "the ", "tea", "soda", "coca", "jus", "juice", "energy drink", "9ahwa", "atay", "limonade"],
    answers: {
      tn: "9ahwa bla sucre ✅, atay ✅ — soda w jus = sucre saye3 (cola 33cl ≈ 140 kcal). Micro-action : baddel l soda l youm b ma3 w limoun.",
      fr: "Café nature ✅, thé ✅ — sodas et jus = sucre liquide (un cola 33 cl ≈ 140 kcal). Micro-action : remplace le soda du jour par une eau citronnée.",
      en: "Black coffee ✅, tea ✅ — sodas and juices are liquid sugar (a 33 cl cola ≈ 140 kcal). Micro-action: swap today’s soda for lemon water.",
    },
  },
  {
    id: "if_16_8",
    keywords: ["jeûne intermittent", "jeune intermittent", "intermittent fasting", "16/8", "16:8", "fasting window"],
    answers: {
      tn: "16/8 tnajem : 9ra el makla 12h w 3sha 20h — el mohem el total kcal. Micro-action : sajjel l wa9t mta3 a5er 9adsha l youm.",
      fr: "Le 16/8 marche si le total calorique reste bon : première prise à 12 h, dîner à 20 h. Micro-action : note l’heure de ta dernière bouchée aujourd’hui.",
      en: "16:8 works if total calories stay on track: first meal at noon, dinner by 8 pm. Micro-action: log the time of your last bite today.",
    },
  },
  {
    id: "supplements",
    keywords: ["complément", "complement", "supplément", "supplement", "whey", "créatine", "creatine", "vitamine", "capsules", "protein powder"],
    answers: {
      tn: "Whey mlih ken l protéine daymen na9sa — mech lazem. Créatine : 3–5 g/yom, studied w safe. El complément ykammel l makla, ma ybadalha. Micro-action : dabbet l makla 9bal ay poudre.",
      fr: "La whey aide si les protéines manquent — sinon inutile. Créatine : 3–5 g/jour, bien étudiée. Les compléments complètent l’alimentation, jamais l’inverse. Micro-action : stabilise d’abord tes repas.",
      en: "Whey helps if protein falls short — otherwise skip it. Creatine: 3–5 g/day, well studied. Supplements complete your diet, never replace it. Micro-action: stabilize meals first.",
    },
  },
  {
    id: "medical",
    keywords: ["douleur", "mal ", "sick", "malade", "diabète", "diabete", "diabetes", "tension", "enceinte", "grossesse", "pregnant", "blessure", "injury", "vertige", "dizzy", "médicament", "medication"],
    answers: {
      tn: "Hedhi so2al tibbi — ma najemch n3awnek fiha : chouf tbib wala pharmacien. Ana houna lel makla, sport w tracking. Micro-action : el se77a 9bal kol chay — tbib 9bal ay taghyir.",
      fr: "Question médicale — je ne peux pas y répondre : consulte un médecin ou pharmacien. Je reste dispo pour nutrition, sport et suivi. Micro-action : santé d’abord — médecin avant tout changement.",
      en: "That’s a medical question — I can’t answer it: see a doctor or pharmacist. I’m here for nutrition, training and tracking. Micro-action: health first — doctor before any big change.",
    },
  },
  {
    id: "app_help",
    keywords: ["application", "app ", "comment utiliser", "how to use", "scanner", "log ", "ajouter repas", "supprimer compte", "premium", "abonnement", "données", "sync", "langue", "language"],
    answers: {
      tn: "Fel app : « + » bech tzid makla, l scanner (kamera) bech te9ra l assiette, Profile lel objectifs w réglages. Micro-action : jarreb l scanner 3ala l meal l jayya 📸",
      fr: "Dans l’app : « + » pour ajouter un repas, l’icône scanner pour photographier l’assiette, Profil pour objectifs et réglages. Micro-action : teste le scanner sur ton prochain repas 📸",
      en: "In the app: “+” adds a meal, the scanner icon photographs your plate, Profile holds goals and settings. Micro-action: try the scanner on your next meal 📸",
    },
  },
  {
    id: "motivation_low",
    keywords: ["motivation", "motivé", "abandonner", "give up", "3ayan", "ma3andich", "découragé", "decourage", "paresse", "lazy", "mood", "fatigué de"],
    answers: {
      tn: (c) => `Ken 3ayan : ma tbadelch kol chay — meal s7i7 w machi 10 min ykafyoo bech teb9a fil dynamique. Streak mta3ek ${fmt(c.streak ?? 0)} youm, 7afedh 3lih 💪 Micro-action : meal wa7ed s7i7 lel youm, kafiya.`,
      fr: (c) => `Pas besoin de journée parfaite : un bon repas + 10 min de marche suffisent à garder la dynamique. Série en cours : ${fmt(c.streak ?? 0)} jour(s) — protège-la 💪 Micro-action : un repas propre, c’est tout.`,
      en: (c) => `No perfect days needed: one clean meal + a 10-min walk keeps the momentum. Current streak: ${fmt(c.streak ?? 0)} day(s) — protect it 💪 Micro-action: one clean meal, that’s it.`,
    },
  },
  {
    id: "streak",
    keywords: ["streak", "série", "serie", "jours d'affilée", "cassé", "break my streak", "fire 🔥"],
    answers: {
      tn: (c) => `Streak ${fmt(c.streak ?? 0)} youm 🔥 bech tkemmel : sajjel ay meal l youm, hata ken khfif. Micro-action : photo l meal l jay w sajjelou.`,
      fr: (c) => `Série de ${fmt(c.streak ?? 0)} jour(s) 🔥 pour la garder : logge n’importe quel repas aujourd’hui, même léger. Micro-action : photo du prochain repas, et c’est fait.`,
      en: (c) => `${fmt(c.streak ?? 0)}-day streak 🔥 to keep it alive: log any meal today, even a light one. Micro-action: snap the next meal and log it.`,
    },
  },
  {
    id: "cheat_meal",
    keywords: ["cheat", "écart", "ecart", "tricher", "frauder", "gourmandise", "plaisir", "junk day"],
    answers: {
      tn: "Ecart planifié = stratégie : festa biha, w erja3 lel 3ada fel meal l jay — bla sajaya. Micro-action : l meal l jay = protéine + khodhra, w safi.",
      fr: "Un écart planifié est stratégique : profites-en, puis retour au normal au repas suivant — sans punition. Micro-action : prochain repas = protéines + légumes, point.",
      en: "A planned treat is strategy: enjoy it, then back to normal at the next meal — no punishment. Micro-action: next meal = protein + veggies, done.",
    },
  },
  {
    id: "weigh_in",
    keywords: ["se peser", "pesée", "pese", "scale", "balance", "weigh", "pondérer", "quand peser"],
    answers: {
      tn: "Pes : sbah, 9bal l ftour, ba3d l toilette, 3–4 marrat fil simana — w 5oud l moyenne hebdo, el wa7da ma thakarch. Micro-action : fixed nafs l wa9t kol youm.",
      fr: "Pèse-toi le matin, à jeun, après les toilettes, 3–4×/semaine, et regarde la moyenne hebdo — une mesure ne veut rien dire. Micro-action : même heure chaque jour.",
      en: "Weigh in the morning, fasted, after the bathroom, 3–4×/week, and watch the weekly average — one reading means nothing. Micro-action: same time daily.",
    },
  },
]

/* ---------- détection ---------- */

/** Détecte l'anglais (mots outils fréquents). Le français est le défaut. */
const EN_RE = /\b(what|how|why|when|can|should|i|my|me|you|eat|food|help|best|today|calories|protein|water|weight|lose|gain|hungry|dinner|lunch|workout|please|want|need|much|many|left|day)\b/gi

/**
 * Langue du coach : mode forcé (tn/fr/en) > derja auto > anglais auto > français.
 */
export function detectLang(question: string, forced?: string): CoachLang {
  if (forced === "tn" || forced === "en" || forced === "fr") return forced
  if (isDerja(question)) return "tn"
  const enHits = (question.match(EN_RE) ?? []).length
  return enHits >= 2 ? "en" : "fr"
}

/** Meilleur scénario par nombre de mots-clés distincts trouvés (≥ 1), sinon null. */
export function detectScenario(question: string): Scenario | null {
  const t = ` ${question.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ")} `
  let best: Scenario | null = null
  let bestScore = 0
  for (const s of SCENARIOS) {
    let score = 0
    for (const k of s.keywords) {
      if (t.includes(` ${k.toLowerCase().trim()} `)) score++
    }
    if (score > bestScore) {
      best = s
      bestScore = score
    }
  }
  return best
}

export function scenarioAnswer(s: Scenario, lang: CoachLang, c: CoachContext): string {
  const a = s.answers[lang]
  return typeof a === "function" ? a(c) : a
}

/** Petit interjectif derja aléatoire pour personnaliser le fallback générique. */
function interj(): string {
  return DERJA_INTERJECTIONS[Math.floor(Math.random() * DERJA_INTERJECTIONS.length)]
}

/* ---------- fallback générique (aucun scénario détecté) ---------- */

export function genericAnswer(lang: CoachLang, c: CoachContext, name?: string): string {
  const remaining = c.remaining ?? 0
  const p = pLeft(c)
  if (lang === "tn") {
    const head = interj()
    if (remaining <= 0) {
      return `${head} ${name ?? "sahbi"}, wesseltna lel budget mta3 l youm (${fmt(c.targetCalories ?? 0)} kcal) 👍 Chwaya machi (15 min) w echreb elma — ghodwa nebdaw nidham.`
    }
    return `${head} Baqi ${fmt(remaining)} kcal w ${fmt(p)} g protéines lel youm. El a7san : protéine khfifa (3adam, ton, djej machwi, rayeb) + slata khadra. Micro-action : sajjel el makla 9bal ma takol 💪`
  }
  if (lang === "en") {
    if (remaining <= 0) {
      return `You've hit today's budget (${fmt(c.targetCalories ?? 0)} kcal) 👍 A 15-min walk and some water — fresh start tomorrow.`
    }
    return `You have ${fmt(remaining)} kcal and ${fmt(p)} g of protein left today. Best: lean protein (eggs, tuna, grilled chicken, yogurt) + veggies. Micro-action: log your next meal before eating 💪`
  }
  if (remaining <= 0) {
    return `Tu as atteint ton budget calories du jour (${fmt(c.targetCalories ?? 0)} kcal) 👍 Bouge un peu ce soir (marche 15 min) et bois de l'eau — demain on repart propre.`
  }
  return `Il te reste ${fmt(remaining)} kcal et ${fmt(p)} g de protéines aujourd'hui. Idéal : une source de protéines maigres (œufs, thon, poulet grillé, yaourt grec) + des légumes. Micro-action : logge ton prochain repas avant de manger pour rester dans le budget 💪`
}

/* ---------- couverture injectée dans le prompt IA ---------- */

/** Liste compacte des scénarios garantis, pour le prompt système du coach IA. */
export const SCENARIO_COVERAGE = `SUJETS COUVERTS (réponds précisément si le user en parle, avec SES données réelles) :
${SCENARIOS.map((s) => `- ${s.id} : ${s.keywords.slice(0, 4).join(", ")}`).join("\n")}
Le user écrit en derja tunisienne (arabizi latin OU script arabe), en français OU en anglais — réponds TOUJOURS dans SA langue, sans mélanger (les mots techniques kcal/protéines restent tels quels). Si le sujet est médical (diabète, grossesse, douleur, médicaments), redirige vers un médecin et reste sur nutrition/sport.`
