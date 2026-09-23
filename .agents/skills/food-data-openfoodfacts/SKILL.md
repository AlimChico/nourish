---
name: food-data-openfoodfacts
description: Intégrer la base alimentaire Open Food Facts dans Nourish — endpoints API v2, champs utiles, pattern cache + fallback, scan code-barres. À utiliser pour toute recherche de produit packagé ou extension de la base alimentaire.
---

# Open Food Facts pour Nourish

Source de vérité pour les produits packagés (dérivée des deux repos de référence : NutritionKit en Swift et NutriScan en Next.js/Prisma).

## API v2 (lecture, sans clé)

```
GET https://world.openfoodfacts.org/api/v2/product/{barcode}.json
GET https://world.openfoodfacts.org/api/v2/product/{barcode}.json?fields=product_name,brands,nutriments,serving_quantity,serving_unit,image_front_small_url
GET https://world.openfoodfacts.org/cgi/search.pl?search_terms={q}&page_size=20&json=1   (recherche texte, legacy mais fonctionnelle)
```

- User-Agent poli requis : `Nourish/1.1 (contact@example.com)` — OFF peut limiter les UA génériques.
- Champs nutriments (`nutriments`) : `energy-kcal_100g`, `proteins_100g`, `carbohydrates_100g`, `fat_100g`, `sugars_100g`, `fiber_100g`, `salt_100g`. Toujours **pour 100 g/ml** ; multiplier par la quantité consommée.
- `product_name` peut être vide ou anglais → prévoir un libellé de secours (`brands` + générique).

## Pattern d'intégration recommandé (copié de NutriScan)

1. **Valider le code-barres** d'abord : 8 à 13 chiffres, EAN-8/EAN-13/UPC. Rejeter avant tout fetch.
2. **Cache local d'abord** : NutriScan stocke chaque produit consulté en base (Prisma, table `products` + `productNutrients` notés) et ne frappe OFF que si absent. Dans Nourish (client-only), l'équivalent est un cache localStorage (`nourish.off-cache.v1`, TTL ~30 jours) pour économiser les requêtes.
3. **Normaliser** vers le modèle local (kcal/portion, macros, portion par défaut) avant affichage/log.
4. **Fallback gracieux** : produit introuvable ou sans nutriments → message clair, ne jamais loguer un item à 0 kcal silencieusement.

## Scan code-barres (si ajouté)

- NutritionKit fournit le pattern UI : `BarcodeScannerView` = flux caméra + détection, callback sur le code lu (`.freebuff/vendor/NutritionKit/Sources/NutritionKit/Camera/BarcodeScannerView.swift`).
- Côté web : librairie `@zxing/browser` ou détection native `BarcodeDetector` (Chrome Android) avec fallback ZXing.
- À brancher dans le même écran `ScanMealScreen` : un onglet « photo / code-barres », réutiliser la capture caméra existante.

## Références locales

- `.freebuff/vendor/NutritionKit/Sources/NutritionKit/OpenFoodFacts/OpenFoodFactsAPI.swift` (construction d'URL avec `?fields=` filtrés)
- `.freebuff/vendor/NutriScan/app/(app)/app/actions.ts` (checkBarcodeFormat → cache → fetch → notation → insertion)
- `.freebuff/vendor/FitnessApp/` (recherche OFF + ajustement des portions avec recalcul auto des macros)
