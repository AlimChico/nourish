---
name: nourish-design-aurora
description: Palette de couleurs "Aurora" officielle de l'app Nourish et règles d'application UI (thème sombre vert émeraude). À utiliser pour toute nouvelle surface, composant ou écran de Nourish.
---

# Nourish — Palette Aurora

Identité visuelle dérivée du wallpaper « aurore verte » de référence. L'app est **sombre par défaut** (mode clair conservé, secondaire).

## Les 7 couleurs canoniques

| Token | Hex | Usage |
|---|---|---|
| `background` | `#0B0F0D` | Fond de l'app (near-black vert) |
| `card` | `#0F1F17` | Cartes, surfaces élevées |
| `secondary` / `accent` | `#0A3D2E` | Bezel téléphone, chips actives, panneaux dégradés |
| `steps` / accents forts | `#16A34A` | Succès, dégradés de marque, boutons secondaires |
| `primary` | `#34D399` | Actions interactives, anneaux, focus, actif nav |
| `mint` | `#A7F3D0` | Highlights, bordures translucides (`/10`, `/20`), badges |
| `foreground` | `#E6FFF1` | Texte principal (jamais `text-white` pur) |

## Règles d'application

1. **Jamais de gris/blanc pur** : texte = `text-[#e6fff1]` (ou `text-foreground`), surfaces translucides = `bg-[#a7f3d0]/5`…`/10`, bordures = `border-[#a7f3d0]/10`. Utiliser les tokens shadcn (`bg-card`, `text-muted-foreground`) en priorité.
2. **Texte sur fond clair** : dans les rares surfaces claires (mode light), le texte sur `--primary` reste `--primary-foreground` = `#06130c` (presque noir vert) en dark, `#e6fff1` en light.
3. **Fond aurora** : l'arrière-plan hors téléphone utilise l'utility `aurora-bg` (dégradés radiaux émeraude sur `#0B0F0D`, comme le wallpaper). À l'intérieur de l'app, `aurora-glow` ajoute une lueur douce en haut des écrans.
4. **Le cadre téléphone** (`MobileFrame`) : bezel `sm:border-[#0a3d2e]` + glow `shadow-[0_0_90px_rgba(52,211,153,0.16),…]`.
5. **Thème** : dark par défaut. Le hook `lib/use-theme.ts` + le script inline de `app/layout.tsx` (clé `nourish.theme.v1`) appliquent la classe avant peinture. Toute nouvelle couleur se définit dans les deux blocs `:root` et `.dark` de `app/globals.css`.
6. **Couleurs macros sémantiques** (inspiré de train-libre `MacroColors`) : `--protein` (bleu), `--carbs` (ambre), `--fat` (violet), `--water` (cyan), `--steps` (vert `#16A34A`) — chaque macro a sa variante `-soft` pour les fonds.

## Référence

- Définition : `app/globals.css` (blocs `:root`, `.dark`, `@utility aurora-bg`, `@utility aurora-glow`)
- Inspiration structurelle : `.freebuff/vendor/train-libre/lib/theme/app_colors.dart` (ThemeExtension par rôle : surfaces, macros, hydration)
