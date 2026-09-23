---
name: nutrition-app-patterns
description: Patterns éprouvés extraits de 20+ apps de suivi nutritionnel open source clonées dans .freebuff/vendor/ — Health Connect, podomètre, streaks, notifications, Open Food Facts, architecture clean. À consulter avant toute nouvelle fonctionnalité de Nourish.
---

# Patterns des apps de référence (clonées dans `.freebuff/vendor/`)

## Santé & capteurs (pas, sport)

- **OpenNutriTracker** (Kotlin/Android, le plus abouti) : `HealthConnectWorkoutReader.kt` lit les séances de sport **directement depuis Health Connect** avec la permission minimale `READ_EXERCISE` seulement. Leçon clé : ne demander **que** les permissions réellement consommées (Play a rejeté distance+steps comme excessives). Attribuer l'énergie soi-même depuis les records bruts.
- **Nourish (implémenté)** : `lib/health.tsx` — podomètre par détection de pics sur DeviceMotion (iOS demande la permission « Motion & Fitness », identique à HealthKit), flush tous les 4 s pour limiter les re-renders, repli manuel (+1000 pas / +15 min) sur desktop. Source taguée `sensor | manual`, historique 365 jours.
- **NutritionKit** (Swift) : `CameraManager.swift` = pattern propre caméra AVFoundation réutilisable ; `OpenFoodFactsAPI.swift` = URL filtrée par champs (`?fields=`) pour économiser la bande passante.

## Streaks & engagement

- Définition retenue dans Nourish (`components/use-streak.ts`) : jour compté si ≥1 repas loggé **ou** > 3000 pas (l'activité compte, pas seulement la nourriture). Streak = jours consécutifs finissant aujourd'hui (ou hier si aujourd'hui vide).
- **train-libre** : module `pulse` (habitudes quotidiennes) — streak séparé par habitude, affiché avec flamme + record historique.

## Notifications

- Pattern de Nourish (`lib/notifications.tsx`) : 3 règles (streak à risque ≥17h, objectif <70% ≥20h, inactivité ≥14h), heures calmes 22h-8h, **1 notification max par règle et par jour** (anti-spam via stamp localStorage `nourish.nudge.<key>`).
- **smooth-app** (OFF officiel) : le seul repo avec AGENTS.md complet — guide de contribution/CI exemplaire pour projets multi-plateformes.

## Open Food Facts (voir skill `food-data-openfoodfacts`)

- **smooth-app** : architecture multi-packages Flutter, scanner avec fallback, cache produit agressif.
- **FoodYou**, **waistline** : recherche OFF avec debounce + tri par score NOVA/Nutri-Score.
- **fooddata-central** (metonym) : dataset FDC USDA structuré — bonne source pour les aliments génériques US.

## Architecture « clean » observée

| Repo | Leçon |
|---|---|
| OpenNutriTracker | Room + Repository pattern, WorkManager pour les imports Health en fond |
| purecal | UI minimaliste : 1 écran = 1 responsabilité, chiffres tabular-nums partout |
| waistline | Store réactif léger (comme nos Context stores), migrations DB explicites |
| FitBook / FoodTracker | Journal par date avec historique illimité + agrégats hebdo (comme notre `rollover`) |
| onigiri | Design tokens centralisés (notre équivalent : skill `nourish-design-aurora`) |

## Règles transverses pour Nourish

1. Chaque store : `hydrated` flag avant toute écriture localStorage (bug StrictMode déjà rencontré).
2. Toute donnée santé : source taguée, bornée (`MAX_HISTORY`), normalisée à la lecture.
3. Les repos vendés sont hors build (`.freebuff/vendor/` dans .gitignore) — s'en inspirer, ne jamais les importer.
