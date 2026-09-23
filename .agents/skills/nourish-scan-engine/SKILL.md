---
name: nourish-scan-engine
description: Architecture du scan de repas de Nourish — analyse IA vision via /api/scan-meal, modèle de résultats détaillés, phases UI (capture → analyse → révision). À consulter pour tout travail sur le scan photo/IA.
---

# Nourish — Moteur de scan de repas

Fonctionnalité inspirée de **rezahedi/NutriScan** (app Next.js de scan nutritionnel, clonée dans `.freebuff/vendor/NutriScan/`).

## Pipeline (3 couches)

1. **Client** — `lib/meal-scan.ts` : capture (caméra `getUserMedia` + fallback upload), compression en JPEG base64 (~0.7), appel API, parsing tolerant.
2. **Serveur** — `app/api/scan-meal/route.ts` : route POST qui envoie l'image (content block `image` base64) au modèle vision Claude (variable d'env `ANTHROPIC_BASE_URL`/clé déjà configurées) avec un prompt strict JSON. **Fallback démo** automatique si l'API échoue (réponse 200 avec `source: "demo"`).
3. **UI** — `components/screens/scan-meal-screen.tsx` : machine à états `capture → analyzing → review`, cadre de détection avec balayage `scan-sweep`, révision éditable (quantités ±, exclusion d'items), log vers le journal via `lib/food-log.tsx`.

## Contrat JSON du modèle vision

```jsonc
{
  "dishName": "Couscous au poulet et légumes",
  "dishDescription": "Semoule, poulet grillé, légumes vapeur",
  "cuisine": "Tunisian",
  "items": [
    {
      "name": "Poulet grillé",
      "portion": "150 g",
      "calories": 248, "protein": 31, "carbs": 0, "fat": 12,
      "confidence": 0.92,           // 0..1
      "whatWeSee": "Morceaux dorés, traces de grill, herbes"
    }
  ],
  "nutritionTip": "Bon apport en protéines, ajoute une portion de fibres"
}
```

Règles : chaque aliment visible = 1 item ; portion estimée en g/ml ou unité ménagère ; macros calculées **pour la portion** ; `whatWeSee` = observations visuelles objectives (méthode de cuisson, couleur, sauce) ; haute véracité demandée au modèle, jamais d'invention hors photo.

## UI de révision (détail exigé)

Chaque item s'affiche en carte avec : nom, portion, macros en chips (P/C/F colorées via `--protein/--carbs/--fat`), barre de confiance colorée (≥0.8 verte `#34D399`, 0.6–0.8 ambre, <0.6 grise), et section « What we see » (description observée). Totaux recalculés en direct (kcal, P/C/F) en fonction des quantités/exclusions.

## Points d'attention connus

- Ne jamais référencer des ids de `foodDatabase` inexistants → filtrer et ignorer les entrées inconnues (bug déjà rencontré : écran bloqué sur « Analyzing »).
- En React StrictMode, l'effet de persistance doit attendre l'état `hydrated` du store avant d'écrire dans localStorage (sinon l'état vide écrase les données).
- Le scan est actuellement **illimité** (quota Premium retiré pour les tests) ; le quota 3 scans/jour reste dans `lib/premium.tsx` et peut être rebranché.

## Références

- Modèle d'app complète : `.freebuff/vendor/NutriScan/app/(app)/app/actions.ts` (serveur, Prisma + Open Food Facts, notation des nutriments)
- Scanners natifs : `.freebuff/vendor/NutritionKit/Sources/NutritionKit/Camera/FoodScannerView.swift`
