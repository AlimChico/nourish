import type { TunisianCategory } from "@/lib/tunisian-foods"

/**
 * BASE DE RÉFÉRENCE TUNISIENNE — valeurs POUR 100 g 🇹🇳
 *
 * C'est la source de VÉRITÉ du scanner : dès qu'un aliment reconnu correspond à
 * une entrée ci-dessous, les calories et macros sont calculées à partir de cette
 * table locale (per100 × poids / 100) au lieu d'être estimées par le modèle IA.
 * Le modèle ne sert alors qu'à RECONNAÎTRE l'aliment et estimer son poids ; les
 * chiffres, eux, ne dépendent plus de sa fantaisie.
 *
 * Pour ajouter un aliment : ajoute une entrée à `tunisianFoods100` (id unique
 * préfixé `tn100_`, valeurs pour 100 g). Rien d'autre à modifier.
 *
 * Les valeurs sont des moyennes de table de composition (plats cuisinés =
 * recette tunisienne classique), cohérentes avec `lib/tunisian-foods.ts` qui
 * exprime les mêmes aliments pour une portion complète.
 */

export type Per100 = {
  /** kcal pour 100 g */
  kcal: number
  /** protéines (g) pour 100 g */
  protein: number
  /** glucides (g) pour 100 g */
  carbs: number
  /** lipides (g) pour 100 g */
  fat: number
}

export type TunisianFood100 = {
  id: string
  name: string
  /** alias de recherche : français, translittéré, arabe, variantes courantes */
  aliases?: string[]
  category: TunisianCategory
  emoji: string
  per100: Per100
}

export const tunisianFoods100: TunisianFood100[] = [
  // ------------------------------------------------------------------- plats
  {
    id: "tn100_couscous_poulet",
    name: "Couscous au poulet",
    aliases: ["kosksi", "kosksi djej", "couscous poulet"],
    category: "plats",
    emoji: "🍲",
    per100: { kcal: 175, protein: 11, carbs: 22, fat: 5 },
  },
  {
    id: "tn100_couscous_agneau",
    name: "Couscous à l'agneau",
    aliases: ["kosksi ghallaba", "couscous mouton", "couscous agneau"],
    category: "plats",
    emoji: "🍲",
    per100: { kcal: 190, protein: 11, carbs: 21, fat: 7 },
  },
  {
    id: "tn100_couscous_poisson",
    name: "Couscous au poisson",
    aliases: ["kosksi 7out", "couscous poisson"],
    category: "plats",
    emoji: "🐟",
    per100: { kcal: 160, protein: 10, carbs: 20, fat: 4 },
  },
  {
    id: "tn100_couscous_legumes",
    name: "Couscous aux légumes",
    aliases: ["couscous legumes", "kosksi khodra"],
    category: "plats",
    emoji: "🥕",
    per100: { kcal: 140, protein: 4, carbs: 26, fat: 3 },
  },
  {
    id: "tn100_mloukhia_veau",
    name: "Mloukhia (veau)",
    aliases: ["mloukhia", "ملوخية", "mulukhiyah"],
    category: "plats",
    emoji: "🥘",
    per100: { kcal: 160, protein: 11, carbs: 6, fat: 10 },
  },
  {
    id: "tn100_mloukhia_agneau",
    name: "Mloukhia à l'agneau",
    aliases: ["mloukhia mouton", "ملوخية بالعلوش"],
    category: "plats",
    emoji: "🥘",
    per100: { kcal: 175, protein: 11, carbs: 5, fat: 12 },
  },
  {
    id: "tn100_tajine_tunisien",
    name: "Tajine tunisien",
    aliases: ["tajine tounsi", "طاجين"],
    category: "plats",
    emoji: "🥧",
    per100: { kcal: 185, protein: 11, carbs: 9, fat: 11 },
  },
  {
    id: "tn100_ojja_merguez",
    name: "Ojja merguez",
    aliases: ["ojja", "عجة"],
    category: "plats",
    emoji: "🍳",
    per100: { kcal: 185, protein: 9, carbs: 5, fat: 14 },
  },
  {
    id: "tn100_ojja_crevettes",
    name: "Ojja crevettes",
    aliases: ["ojja gambas", "ojja shrimp"],
    category: "plats",
    emoji: "🍤",
    per100: { kcal: 120, protein: 10, carbs: 4, fat: 7 },
  },
  {
    id: "tn100_ojja_poulet",
    name: "Ojja au poulet",
    aliases: ["ojja djej"],
    category: "plats",
    emoji: "🍳",
    per100: { kcal: 165, protein: 11, carbs: 5, fat: 11 },
  },
  {
    id: "tn100_kamounia",
    name: "Kamounia",
    aliases: ["kamounia veau", "كمونية"],
    category: "plats",
    emoji: "🥘",
    per100: { kcal: 155, protein: 11, carbs: 7, fat: 9 },
  },
  {
    id: "tn100_marqa_hrous",
    name: "Marqa h'rous",
    aliases: ["mar9a hrous", "مرقة حروس", "marqa"],
    category: "plats",
    emoji: "🥘",
    per100: { kcal: 127, protein: 9, carbs: 6, fat: 7 },
  },
  {
    id: "tn100_kabkabou",
    name: "Kabkabou",
    aliases: ["kabkabou bel hout", "كبكابو"],
    category: "plats",
    emoji: "🐟",
    per100: { kcal: 140, protein: 9, carbs: 5, fat: 9 },
  },
  {
    id: "tn100_osbane",
    name: "Osbane",
    aliases: ["osban", "عصبان"],
    category: "plats",
    emoji: "🥘",
    per100: { kcal: 233, protein: 11, carbs: 14, fat: 14 },
  },
  {
    id: "tn100_masfouf",
    name: "Masfouf",
    aliases: ["masfouf hlou", "مسفوف", "kosksi hlou"],
    category: "plats",
    emoji: "🍮",
    per100: { kcal: 185, protein: 3, carbs: 35, fat: 4 },
  },
  {
    id: "tn100_kosksi_djerbi",
    name: "Kosksi djerbi",
    aliases: ["couscous djerbien", "borghol djerbi", "برغل جربي"],
    category: "plats",
    emoji: "🍲",
    per100: { kcal: 160, protein: 8, carbs: 21, fat: 5 },
  },
  {
    id: "tn100_mhamsa",
    name: "Mhamsa",
    aliases: ["mhamsa bel hout", "محمسة"],
    category: "plats",
    emoji: "🍲",
    per100: { kcal: 137, protein: 9, carbs: 18, fat: 3 },
  },
  {
    id: "tn100_nwasser",
    name: "Nwasser",
    aliases: ["nouaisser", "نواصر"],
    category: "plats",
    emoji: "🍜",
    per100: { kcal: 135, protein: 8, carbs: 18, fat: 3 },
  },
  {
    id: "tn100_tlitli",
    name: "Tlitli",
    aliases: ["tlitli bel djej", "تليتلي"],
    category: "plats",
    emoji: "🍝",
    per100: { kcal: 133, protein: 6, carbs: 20, fat: 3 },
  },
  {
    id: "tn100_riz_jerbi",
    name: "Riz jerbi",
    aliases: ["riz djerbien", "أرز جربي"],
    category: "plats",
    emoji: "🍚",
    per100: { kcal: 140, protein: 4, carbs: 24, fat: 3 },
  },
  {
    id: "tn100_douwida",
    name: "Douwida",
    aliases: ["douwida djerbia", "دويّدة"],
    category: "plats",
    emoji: "🌾",
    per100: { kcal: 107, protein: 4, carbs: 17, fat: 3 },
  },
  {
    id: "tn100_borghol_khodra",
    name: "Borghol bel khodra",
    aliases: ["borghol aux légumes", "برغل بالخضرة"],
    category: "plats",
    emoji: "🌾",
    per100: { kcal: 120, protein: 4, carbs: 21, fat: 3 },
  },
  {
    id: "tn100_pkaila",
    name: "Pkaïla",
    aliases: ["pkaïla bel lahme", "بكايلة", "بقلّة"],
    category: "plats",
    emoji: "🥬",
    per100: { kcal: 127, protein: 7, carbs: 4, fat: 9 },
  },
  {
    id: "tn100_lablabi",
    name: "Lablabi",
    aliases: ["لبلابي", "leblebi"],
    category: "plats",
    emoji: "🥣",
    per100: { kcal: 115, protein: 4, carbs: 15, fat: 4 },
  },
  {
    id: "tn100_chorba_frik",
    name: "Chorba frik",
    aliases: ["soupe frik", "شربة فريك"],
    category: "plats",
    emoji: "🍜",
    per100: { kcal: 70, protein: 4, carbs: 9, fat: 2 },
  },
  {
    id: "tn100_chorba_hris",
    name: "Chorba h'ris",
    aliases: ["chorba hris", "شربة حريس"],
    category: "plats",
    emoji: "🍜",
    per100: { kcal: 93, protein: 5, carbs: 9, fat: 4 },
  },
  {
    id: "tn100_dchicha",
    name: "Soupe dchicha",
    aliases: ["dchicha", "دشيشة"],
    category: "plats",
    emoji: "🥣",
    per100: { kcal: 60, protein: 2, carbs: 11, fat: 1 },
  },
  {
    id: "tn100_ftat",
    name: "Ftat",
    aliases: ["fatat"],
    category: "entrees",
    emoji: "🍞",
    per100: { kcal: 150, protein: 5, carbs: 17, fat: 7 },
  },
  {
    id: "tn100_assida",
    name: "Assida",
    aliases: ["assida zriga", "عصيدة"],
    category: "douceurs",
    emoji: "🍮",
    per100: { kcal: 208, protein: 3, carbs: 39, fat: 4 },
  },
  {
    id: "tn100_chakchouka",
    name: "Chakchouka",
    aliases: ["chakchuka", "شكشوكة"],
    category: "entrees",
    emoji: "🍅",
    per100: { kcal: 107, protein: 5, carbs: 6, fat: 7 },
  },
  {
    id: "tn100_salade_mechouia",
    name: "Salade méchouia",
    aliases: ["slata mechouia", "mechouia", "مشوية"],
    category: "entrees",
    emoji: "🫑",
    per100: { kcal: 78, protein: 2, carbs: 8, fat: 5 },
  },
  {
    id: "tn100_salade_tunisienne",
    name: "Salade tunisienne",
    aliases: ["slata tounsiya", "slata tounsia"],
    category: "entrees",
    emoji: "🥗",
    per100: { kcal: 55, protein: 1, carbs: 6, fat: 3 },
  },
  {
    id: "tn100_salade_pois_chiches",
    name: "Salade pois chiches",
    aliases: ["slata hommos", "salade houmous"],
    category: "entrees",
    emoji: "🥗",
    per100: { kcal: 125, protein: 5, carbs: 16, fat: 4 },
  },

  // --------------------------------------------------------------- street food
  {
    id: "tn100_kafteji",
    name: "Kafteji",
    aliases: ["كفتاجي"],
    category: "rue",
    emoji: "🥙",
    per100: { kcal: 207, protein: 5, carbs: 17, fat: 13 },
  },
  {
    id: "tn100_kafteji_viande",
    name: "Kafteji à la viande",
    aliases: ["kafteji viande", "kafteji all viande"],
    category: "rue",
    emoji: "🥙",
    per100: { kcal: 205, protein: 7, carbs: 15, fat: 13 },
  },
  {
    id: "tn100_kafteji_oeuf",
    name: "Kafteji à l'œuf",
    aliases: ["kafteji oeuf"],
    category: "rue",
    emoji: "🍳",
    per100: { kcal: 205, protein: 6, carbs: 16, fat: 13 },
  },
  {
    id: "tn100_fricasse",
    name: "Fricassé au thon",
    aliases: ["fricassi", "fricassé"],
    category: "rue",
    emoji: "🥖",
    per100: { kcal: 292, protein: 9, carbs: 29, fat: 15 },
  },
  {
    id: "tn100_mlawi",
    name: "Mlawi",
    aliases: ["mlewi", "mlouwi", "ملوي"],
    category: "rue",
    emoji: "🫓",
    per100: { kcal: 275, protein: 6, carbs: 37, fat: 12 },
  },
  {
    id: "tn100_msemen",
    name: "Msemen",
    aliases: ["مسمن"],
    category: "rue",
    emoji: "🫓",
    per100: { kcal: 273, protein: 5, carbs: 36, fat: 12 },
  },
  {
    id: "tn100_chapati",
    name: "Chapati",
    aliases: ["chapati thon", "شاباتي"],
    category: "rue",
    emoji: "🫓",
    per100: { kcal: 233, protein: 5, carbs: 32, fat: 9 },
  },
  {
    id: "tn100_kesra",
    name: "Késra",
    aliases: ["kesra", "كسرة"],
    category: "rue",
    emoji: "🫓",
    per100: { kcal: 192, protein: 5, carbs: 35, fat: 2 },
  },
  {
    id: "tn100_bambalouni",
    name: "Bambalouni",
    aliases: ["bambalouni sucré", "بمبالوني"],
    category: "rue",
    emoji: "🍩",
    per100: { kcal: 322, protein: 3, carbs: 38, fat: 17 },
  },
  {
    id: "tn100_brik_oeuf",
    name: "Brik à l'œuf",
    aliases: ["brik", "brika", "بريك", "brik oeuf"],
    category: "entrees",
    emoji: "🥟",
    per100: { kcal: 282, protein: 11, carbs: 22, fat: 17 },
  },
  {
    id: "tn100_brik_thon",
    name: "Brik au thon",
    aliases: ["brik thon"],
    category: "entrees",
    emoji: "🥟",
    per100: { kcal: 283, protein: 12, carbs: 22, fat: 17 },
  },
  {
    id: "tn100_khobz_tabouna",
    name: "Khobz tabouna",
    aliases: ["tabouna", "خبز طابونة", "pain tabouna"],
    category: "entrees",
    emoji: "🫓",
    per100: { kcal: 129, protein: 4, carbs: 26, fat: 1 },
  },
  {
    id: "tn100_baguette",
    name: "Baguette",
    aliases: ["pain", "pain blanc", "خبز"],
    category: "rue",
    emoji: "🥖",
    per100: { kcal: 270, protein: 9, carbs: 55, fat: 1 },
  },
  {
    id: "tn100_pain_complet",
    name: "Pain complet",
    aliases: ["pain de blé complet"],
    category: "rue",
    emoji: "🍞",
    per100: { kcal: 250, protein: 9, carbs: 45, fat: 3 },
  },
  {
    id: "tn100_frites",
    name: "Frites",
    aliases: ["pommes frites", "pomme de terre frite"],
    category: "rue",
    emoji: "🍟",
    per100: { kcal: 312, protein: 4, carbs: 41, fat: 15 },
  },

  // ------------------------------------------------------------- grillades & protéines
  {
    id: "tn100_djej_machwi",
    name: "Djej machwi",
    aliases: ["poulet grillé", "poulet", "دجاج مشوي"],
    category: "plats",
    emoji: "🍗",
    per100: { kcal: 165, protein: 31, carbs: 0, fat: 4 },
  },
  {
    id: "tn100_kefta",
    name: "Kefta grillée",
    aliases: ["kefta", "keftaji", "كفتة"],
    category: "plats",
    emoji: "🍖",
    per100: { kcal: 260, protein: 19, carbs: 3, fat: 19 },
  },
  {
    id: "tn100_merguez",
    name: "Merguez",
    aliases: ["مرقاز"],
    category: "plats",
    emoji: "🌭",
    per100: { kcal: 250, protein: 15, carbs: 2, fat: 20 },
  },
  {
    id: "tn100_poisson_grille",
    name: "Poisson grillé",
    aliases: ["dorade", "merlan", "7out", "hout", "حوت"],
    category: "plats",
    emoji: "🐟",
    per100: { kcal: 120, protein: 20, carbs: 0, fat: 5 },
  },
  {
    id: "tn100_sardines",
    name: "Sardines grillées",
    aliases: ["sardines", "سردين"],
    category: "plats",
    emoji: "🐟",
    per100: { kcal: 167, protein: 18, carbs: 0, fat: 10 },
  },
  {
    id: "tn100_calamar",
    name: "Calamar frit",
    aliases: ["calamar", "kalamar"],
    category: "plats",
    emoji: "🦑",
    per100: { kcal: 167, protein: 15, carbs: 8, fat: 8 },
  },
  {
    id: "tn100_oeuf",
    name: "Œuf",
    aliases: ["oeuf dur", "œuf dur", "oeuf", "œuf"],
    category: "entrees",
    emoji: "🥚",
    per100: { kcal: 155, protein: 13, carbs: 1, fat: 11 },
  },
  {
    id: "tn100_thon_huile",
    name: "Thon à l'huile",
    aliases: ["thon", "thon en conserve"],
    category: "entrees",
    emoji: "🐟",
    per100: { kcal: 190, protein: 25, carbs: 0, fat: 10 },
  },
  {
    id: "tn100_boeuf_grille",
    name: "Viande de bœuf grillée",
    aliases: ["boeuf", "viande de boeuf", "لحم"],
    category: "plats",
    emoji: "🥩",
    per100: { kcal: 250, protein: 26, carbs: 0, fat: 16 },
  },
  {
    id: "tn100_agneau",
    name: "Viande d'agneau",
    aliases: ["agneau", "mouton", "علوش"],
    category: "plats",
    emoji: "🥩",
    per100: { kcal: 290, protein: 24, carbs: 0, fat: 21 },
  },
  {
    id: "tn100_escalope",
    name: "Escalope de dinde",
    aliases: ["dinde", "escalope"],
    category: "plats",
    emoji: "🍗",
    per100: { kcal: 150, protein: 30, carbs: 0, fat: 2 },
  },

  // ------------------------------------------------------------------- laitiers
  {
    id: "tn100_jben",
    name: "Jben",
    aliases: ["fromage frais", "jben tunisien", "جبن"],
    category: "entrees",
    emoji: "🧀",
    per100: { kcal: 100, protein: 9, carbs: 4, fat: 6 },
  },
  {
    id: "tn100_rayeb",
    name: "Rayeb / lben",
    aliases: ["lben", "leben", "رائب"],
    category: "boissons",
    emoji: "🥛",
    per100: { kcal: 45, protein: 3, carbs: 4, fat: 2 },
  },
  {
    id: "tn100_yaourt",
    name: "Yaourt nature",
    aliases: ["yaourt", "yaourt nature"],
    category: "boissons",
    emoji: "🥛",
    per100: { kcal: 60, protein: 4, carbs: 5, fat: 3 },
  },
  {
    id: "tn100_lait",
    name: "Lait",
    aliases: ["lait entier", "lait demi-écrémé"],
    category: "boissons",
    emoji: "🥛",
    per100: { kcal: 55, protein: 3, carbs: 5, fat: 3 },
  },
  {
    id: "tn100_fromage",
    name: "Fromage à pâte dure",
    aliases: ["gruyère", "edam", "fromage"],
    category: "entrees",
    emoji: "🧀",
    per100: { kcal: 380, protein: 26, carbs: 2, fat: 30 },
  },
  {
    id: "tn100_beurre",
    name: "Beurre",
    aliases: ["زيدة"],
    category: "entrees",
    emoji: "🧈",
    per100: { kcal: 750, protein: 1, carbs: 1, fat: 83 },
  },

  // ------------------------------------------------- idéaux / condiments / matières grasses
  {
    id: "tn100_huile_olive",
    name: "Huile d'olive",
    aliases: ["huile", "zit zitouna", "زيت زيتون"],
    category: "entrees",
    emoji: "🫒",
    per100: { kcal: 880, protein: 0, carbs: 0, fat: 100 },
  },
  {
    id: "tn100_harissa",
    name: "Harissa",
    aliases: ["هريسة"],
    category: "entrees",
    emoji: "🌶️",
    per100: { kcal: 125, protein: 5, carbs: 20, fat: 5 },
  },
  {
    id: "tn100_olives",
    name: "Olives",
    aliases: ["zitoun", "زيتون"],
    category: "entrees",
    emoji: "🫒",
    per100: { kcal: 150, protein: 1, carbs: 5, fat: 15 },
  },
  {
    id: "tn100_miel",
    name: "Miel",
    aliases: ["عسل"],
    category: "douceurs",
    emoji: "🍯",
    per100: { kcal: 320, protein: 0, carbs: 80, fat: 0 },
  },
  {
    id: "tn100_amandes",
    name: "Amandes",
    aliases: ["amande", "لوز"],
    category: "douceurs",
    emoji: "🥜",
    per100: { kcal: 600, protein: 21, carbs: 7, fat: 55 },
  },
  {
    id: "tn100_dattes",
    name: "Dattes deglet nour",
    aliases: ["deglet nour", "dattes", "dates", "دقلة النور"],
    category: "douceurs",
    emoji: "🌴",
    per100: { kcal: 280, protein: 2, carbs: 70, fat: 0 },
  },

  // ------------------------------------------------------------- accompagnements
  {
    id: "tn100_riz_blanc",
    name: "Riz blanc cuit",
    aliases: ["riz", "riz cuit"],
    category: "plats",
    emoji: "🍚",
    per100: { kcal: 130, protein: 3, carbs: 28, fat: 0 },
  },
  {
    id: "tn100_pates",
    name: "Pâtes cuites",
    aliases: ["pâtes", "spaghetti", "macaroni", "nouilles"],
    category: "plats",
    emoji: "🍝",
    per100: { kcal: 158, protein: 6, carbs: 31, fat: 1 },
  },
  {
    id: "tn100_semoule",
    name: "Semoule cuite",
    aliases: ["couscous grain", "couscous nature"],
    category: "plats",
    emoji: "🌾",
    per100: { kcal: 112, protein: 4, carbs: 23, fat: 0 },
  },
  {
    id: "tn100_pois_chiches",
    name: "Pois chiches cuits",
    aliases: ["pois chiches", "hommos", "حمص"],
    category: "entrees",
    emoji: "🫘",
    per100: { kcal: 164, protein: 9, carbs: 27, fat: 3 },
  },
  {
    id: "tn100_lentilles",
    name: "Lentilles cuites",
    aliases: ["lentilles", "عدس"],
    category: "entrees",
    emoji: "🫘",
    per100: { kcal: 116, protein: 9, carbs: 20, fat: 0 },
  },
  {
    id: "tn100_pomme_de_terre",
    name: "Pomme de terre cuite",
    aliases: ["pomme de terre", "patate"],
    category: "plats",
    emoji: "🥔",
    per100: { kcal: 85, protein: 2, carbs: 19, fat: 0 },
  },
  {
    id: "tn100_flocons_avoine",
    name: "Flocons d'avoine",
    aliases: ["avoine", "oatmeal", "porridge"],
    category: "plats",
    emoji: "🥣",
    per100: { kcal: 380, protein: 13, carbs: 60, fat: 7 },
  },

  // --------------------------------------------------------------- légumes & fruits
  {
    id: "tn100_tomate",
    name: "Tomate",
    aliases: ["tomates", "طماطم"],
    category: "entrees",
    emoji: "🍅",
    per100: { kcal: 20, protein: 1, carbs: 4, fat: 0 },
  },
  {
    id: "tn100_concombre",
    name: "Concombre",
    aliases: ["خيار"],
    category: "entrees",
    emoji: "🥒",
    per100: { kcal: 15, protein: 1, carbs: 3, fat: 0 },
  },
  {
    id: "tn100_salade_verte",
    name: "Salade verte",
    aliases: ["laitue", "salade verte"],
    category: "entrees",
    emoji: "🥬",
    per100: { kcal: 15, protein: 1, carbs: 3, fat: 0 },
  },
  {
    id: "tn100_courgette",
    name: "Courgette",
    aliases: ["قرع"],
    category: "entrees",
    emoji: "🥒",
    per100: { kcal: 17, protein: 1, carbs: 3, fat: 0 },
  },
  {
    id: "tn100_carotte",
    name: "Carotte",
    aliases: ["carottes", "زرودية"],
    category: "entrees",
    emoji: "🥕",
    per100: { kcal: 40, protein: 1, carbs: 9, fat: 0 },
  },
  {
    id: "tn100_oignon",
    name: "Oignon",
    aliases: ["oignons", "بصل"],
    category: "entrees",
    emoji: "🧅",
    per100: { kcal: 40, protein: 1, carbs: 9, fat: 0 },
  },
  {
    id: "tn100_poivron",
    name: "Poivron",
    aliases: ["poivrons", "فلفل"],
    category: "entrees",
    emoji: "🫑",
    per100: { kcal: 30, protein: 1, carbs: 6, fat: 0 },
  },
  {
    id: "tn100_aubergine",
    name: "Aubergine",
    aliases: ["باذنجان"],
    category: "entrees",
    emoji: "🍆",
    per100: { kcal: 25, protein: 1, carbs: 6, fat: 0 },
  },
  {
    id: "tn100_banane",
    name: "Banane",
    aliases: ["bananes"],
    category: "douceurs",
    emoji: "🍌",
    per100: { kcal: 90, protein: 1, carbs: 23, fat: 0 },
  },
  {
    id: "tn100_pomme",
    name: "Pomme",
    aliases: ["pommes"],
    category: "douceurs",
    emoji: "🍎",
    per100: { kcal: 52, protein: 0, carbs: 14, fat: 0 },
  },
  {
    id: "tn100_orange",
    name: "Orange",
    aliases: ["oranges", "برتقال"],
    category: "douceurs",
    emoji: "🍊",
    per100: { kcal: 47, protein: 1, carbs: 12, fat: 0 },
  },
  {
    id: "tn100_raisin",
    name: "Raisin",
    aliases: ["raisins", "عناب"],
    category: "douceurs",
    emoji: "🍇",
    per100: { kcal: 70, protein: 1, carbs: 18, fat: 0 },
  },
  {
    id: "tn100_figue",
    name: "Figue",
    aliases: ["figues", "karmous", "تين"],
    category: "douceurs",
    emoji: "🫐",
    per100: { kcal: 75, protein: 1, carbs: 19, fat: 0 },
  },
  {
    id: "tn100_pasteque",
    name: "Pastèque",
    aliases: ["melon", "pastèque", "بطيخ"],
    category: "douceurs",
    emoji: "🍉",
    per100: { kcal: 30, protein: 1, carbs: 8, fat: 0 },
  },
  {
    id: "tn100_grenade",
    name: "Grenade",
    aliases: ["grenades", "رمّان"],
    category: "douceurs",
    emoji: "🍎",
    per100: { kcal: 83, protein: 2, carbs: 19, fat: 1 },
  },

  // ------------------------------------------------------------------ douceurs
  {
    id: "tn100_makroudh",
    name: "Makroudh",
    aliases: ["makroud", "مقروض"],
    category: "douceurs",
    emoji: "🍯",
    per100: { kcal: 350, protein: 5, carbs: 58, fat: 12 },
  },
  {
    id: "tn100_kaak_warka",
    name: "Ka'ak warka",
    aliases: ["kaak warka", "كاعك ورقة"],
    category: "douceurs",
    emoji: "🍪",
    per100: { kcal: 400, protein: 7, carbs: 58, fat: 18 },
  },
  {
    id: "tn100_baklawa",
    name: "Baklawa",
    aliases: ["baklava"],
    category: "douceurs",
    emoji: "🥮",
    per100: { kcal: 430, protein: 7, carbs: 48, fat: 24 },
  },
  {
    id: "tn100_ghriba",
    name: "Ghriba",
    aliases: ["ghriba amande", "غريبة"],
    category: "douceurs",
    emoji: "🍪",
    per100: { kcal: 430, protein: 9, carbs: 51, fat: 23 },
  },
  {
    id: "tn100_zlabia",
    name: "Zlabia",
    aliases: ["zlabia boula", "زلابية"],
    category: "douceurs",
    emoji: "🍯",
    per100: { kcal: 215, protein: 1, carbs: 43, fat: 6 },
  },
  {
    id: "tn100_samsa",
    name: "Samsa",
    aliases: ["samsa tunisienne", "سمسة"],
    category: "douceurs",
    emoji: "🥮",
    per100: { kcal: 440, protein: 8, carbs: 52, fat: 22 },
  },
  {
    id: "tn100_deblah",
    name: "Deblah",
    aliases: ["دبلة"],
    category: "douceurs",
    emoji: "🍬",
    per100: { kcal: 445, protein: 7, carbs: 67, fat: 18 },
  },
  {
    id: "tn100_mkhabez",
    name: "Mkhabez",
    aliases: ["مخبز"],
    category: "douceurs",
    emoji: "🍪",
    per100: { kcal: 420, protein: 9, carbs: 53, fat: 20 },
  },
  {
    id: "tn100_bouza",
    name: "Bouza",
    aliases: ["بوزة"],
    category: "douceurs",
    emoji: "🍮",
    per100: { kcal: 120, protein: 2, carbs: 22, fat: 2 },
  },

  // ------------------------------------------------------------------ boissons
  {
    id: "tn100_the_menthe",
    name: "Thé à la menthe",
    aliases: ["atay", "thé", "أتاي"],
    category: "boissons",
    emoji: "🫖",
    per100: { kcal: 40, protein: 0, carbs: 10, fat: 0 },
  },
  {
    id: "tn100_cafe_turc",
    name: "Café turc",
    aliases: ["kahwa", "قهوة"],
    category: "boissons",
    emoji: "☕",
    per100: { kcal: 31, protein: 0, carbs: 6, fat: 0 },
  },
  {
    id: "tn100_express",
    name: "Express",
    aliases: ["café express", "espresso"],
    category: "boissons",
    emoji: "☕",
    per100: { kcal: 8, protein: 1, carbs: 1, fat: 0 },
  },
  {
    id: "tn100_citronnade",
    name: "Citronnade",
    aliases: ["citron b'bidha", "لمون بالبيضة", "citron pressé"],
    category: "boissons",
    emoji: "🍋",
    per100: { kcal: 36, protein: 0, carbs: 9, fat: 0 },
  },
  {
    id: "tn100_jus_orange",
    name: "Jus d'orange",
    aliases: ["jus d'orange pressé", "jus", "عصير"],
    category: "boissons",
    emoji: "🍊",
    per100: { kcal: 45, protein: 1, carbs: 10, fat: 0 },
  },
  {
    id: "tn100_soda",
    name: "Soda",
    aliases: ["coca", "coca cola", "soda", "boisson gazeuse", "limonade"],
    category: "boissons",
    emoji: "🥤",
    per100: { kcal: 42, protein: 0, carbs: 10, fat: 0 },
  },
]

/** Enlève accents/ponctuation pour comparer « Salade Méchouia » et « salade mechouia ». */
function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
}

/** Mots trop génériques qui ne doivent pas, seuls, déclencher une correspondance. */
const STOP_WORDS = new Set([
  "au", "aux", "de", "du", "des", "la", "le", "les", "un", "une", "et", "avec",
  "sans", "en", "a", "l", "d", "maison", "fait", "frais", "friche",
])

function tokens(value: string): string[] {
  return normalizeName(value)
    .split(" ")
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t))
}

/**
 * Retrouve une entrée locale pour un nom reconnu par le scanner.
 * Stratégie prudente (on préfère ne PAS matcher plutôt que d'écraser avec un
 * mauvais aliment) : correspondance exacte → inclusion (le plus long gagne) →
 * recouvrement de mots significatifs (score strictement meilleur).
 */
export function matchTunisianFood100(name: string): TunisianFood100 | null {
  const raw = (name || "").trim()
  if (!raw) return null
  // On retire le contenu entre parenthèses (« Pain (baguette) »).
  const q = normalizeName(raw.replace(/\([^)]*\)/g, " "))
  if (!q) return null

  const termsOf = (f: TunisianFood100) => [f.name, ...(f.aliases ?? [])].map(normalizeName)

  // 1) Correspondance exacte (nom ou alias).
  for (const f of tunisianFoods100) {
    if (termsOf(f).includes(q)) return f
  }

  // 2) Inclusion : le terme local est contenu dans le nom reconnu (ou l'inverse).
  //    On exige un terme SPÉCIFIQUE — un alias court et générique ("thon", "pain")
  //    ne doit pas capter un plat sans rapport ("Pizza au thon" ≠ thon à l'huile).
  //    Le terme le plus long gagne pour rester précis.
  let best: TunisianFood100 | null = null
  let bestLen = 0
  for (const f of tunisianFoods100) {
    for (const term of termsOf(f)) {
      if (term.length < 4) continue
      const forward = q.includes(term) && (term.length >= 6 || term.length >= q.length * 0.6)
      const reverse = q.length >= 6 && term.includes(q)
      if ((forward || reverse) && term.length > bestLen) {
        best = f
        bestLen = term.length
      }
    }
  }
  if (best) return best

  // 3) Recouvrement de mots : au moins 1 mot significatif en commun, et le
  //    meilleur score doit être unique (sinon ambigu → on ne devine pas).
  const qTokens = new Set(tokens(raw))
  if (qTokens.size === 0) return null
  let top: TunisianFood100 | null = null
  let topScore = 0
  let tie = false
  for (const f of tunisianFoods100) {
    const fTokens = tokens(f.name)
    const score = fTokens.reduce((n, t) => (qTokens.has(t) ? n + 1 : n), 0)
    if (score === 0) continue
    if (score > topScore) {
      top = f
      topScore = score
      tie = false
    } else if (score === topScore) {
      tie = true
    }
  }
  return tie ? null : top
}

/** Macros locales pour un poids donné, calées sur la table pour 100 g. */
export function macrosForGrams(entry: TunisianFood100, grams: number) {
  const g = grams > 0 ? grams : 100
  const f = g / 100
  return {
    calories: entry.per100.kcal * f,
    protein: entry.per100.protein * f,
    carbs: entry.per100.carbs * f,
    fat: entry.per100.fat * f,
  }
}
