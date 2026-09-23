---
name: fitness-features-reference
description: Cartographie des fonctionnalités fitness/nutrition de référence (train-libre, FitnessApp) pour faire évoluer Nourish — modules à imiter, priorités, patterns. À consulter avant d'ajouter une nouvelle grosse fonctionnalité.
---

# Référentiel fonctionnalités fitness (train-libre × FitnessApp)

Deux apps complètes sont clonées en local et servent de référence produit :

- `.freebuff/vendor/train-libre/` — Flutter, offline-first, **21 modules** dans `lib/features/` : `diary`, `workout`, `exercise_catalog`, `nutrition_recommendation`, `statistics`, `sleep`, `steps`, `supplements`, `analytics`, `onboarding`, `profile`, `settings`, `sharing`, `health_export`, `home_widgets`…
- `.freebuff/vendor/FitnessApp/` — Flutter + Firebase : suivi quotidien (petit-déj/déjeuner/dîner/snacks), recherche OpenFoodFacts, ajustement des portions avec recalcul auto, poids avec courbes, dépenses caloriques objectif vs réel, programmes d'entraînement par niveau (Cardio / Upper / Lower), recettes sauvegardées, offline Hive.

## Patterns à retenir pour Nourish

| Besoin | Pattern observé | Application Nourish |
|---|---|---|
| Journal alimentaire | Entrées par repas avec portions ajustables, recalcul macros automatique | `lib/food-log.tsx` — déjà en place, étendre avec recettes/favoris |
| Historique | Vue calendrier + agrégats par jour | `progress-screen.tsx` — persister les totaux journaliers dans le store |
| Objectifs | Objectif vs réel, avec anneaux de progression | Ring calories HomeScreen — ajouter protéines/eau en anneaux secondaires |
| Entraînement | Programmes par niveau + catégories d'exercices | `workout-screen.tsx` — ajouter un catalogue d'exercices et un program builder |
| Recommandations | `nutrition_recommendation` (train-libre) : conseils basés sur les lacunes du jour | Le `nutritionTip` du scan — le généraliser en moteur de conseils quotidien |
| Export | `health_export` (train-libre) | Export JSON/CSV du journal depuis le profil |
| Onboarding | Multi-étapes avec calcul d'objectifs | Déjà en place — y ajouter le poids hebdo |

## Thème (transversal)

`train-libre/lib/theme/app_colors.dart` définit des **ThemeExtension** par rôle : `AppSurfaces` (fonds de cartes spécifiques) et `MacroColors` (calories, protéines, glucides, lipides, eau, sucre, fibres, sel, caféine + variantes). Leçon : typer les couleurs par **rôle sémantique**, pas par valeur — c'est déjà le modèle des variables CSS Nourish (`--protein`, `--water`, `--steps` + `-soft`).

## Priorités suggérées pour Nourish

1. Historique quotidien persistant (base de tout graphe de progression).
2. Scan code-barres (voir skill `food-data-openfoodfacts`).
3. Favoris/recettes rapides (reloger un repas en 1 tap).
4. Suivi poids + courbe (FitnessApp le fait avec de simples séries temporelles).
5. Export des données (crédibilité + santé).
