#!/usr/bin/env node
/**
 * Publie l'APK Android construit dans `android/` vers `public/downloads/`, pour
 * que le site le serve sur `/downloads/sahtek.apk` — l'URL du bouton
 * « Télécharger l'APK » affiché aux visiteurs Android.
 *
 *   node scripts/publish-apk.mjs                 # APK release, sinon debug
 *   node scripts/publish-apk.mjs chemin/app.apk  # fichier explicite
 *
 * Pourquoi un script Node et pas un simple `cp` : les scripts npm tournent sous
 * cmd.exe sur Windows, où `cp` n'existe pas. Ici, une seule commande marche
 * partout.
 */
import { copyFileSync, existsSync, statSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"

const CANDIDATES = [
  "android/app/build/outputs/apk/release/app-release.apk",
  "android/app/build/outputs/apk/debug/app-debug.apk",
]

const TARGET = join("public", "downloads", "sahtek.apk")

const explicit = process.argv[2]
const source = explicit ?? CANDIDATES.find((p) => existsSync(p))

if (!source || !existsSync(source)) {
  console.error("\n❌ Aucun APK trouvé.")
  console.error("   Construis-le d'abord :  cd android && ./gradlew assembleRelease")
  console.error(`   Cherché : ${CANDIDATES.join(", ")}\n`)
  process.exit(1)
}

if (explicit && source.endsWith(".aab")) {
  console.warn("⚠️  Un .aab est destiné au Play Store, pas à l'installation manuelle.")
}

mkdirSync(dirname(TARGET), { recursive: true })
copyFileSync(source, TARGET)

const ko = statSync(TARGET).size / 1000
const mo = ko / 1000
console.log(`\n✅ ${source}\n   → ${TARGET}  (${mo >= 1 ? `${mo.toFixed(1)} Mo` : `${Math.round(ko)} ko`})`)
console.log("\nLe bouton « Télécharger l'APK » pointe déjà sur ce fichier.")
console.log("Pour qu'il soit servi en production, il faut le COMMITTER :")
console.log("   git add public/downloads/sahtek.apk && git commit -m \"Publier l'APK Android\"\n")
