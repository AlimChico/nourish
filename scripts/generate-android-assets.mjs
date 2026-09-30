/**
 * Génère les ressources Android natives (icône de lanceur + écran de démarrage)
 * à partir des icônes PWA de Sahtek — pour ne pas livrer l'APK avec le logo
 * Capacitor par défaut.
 *
 * Utilisation : node scripts/generate-android-assets.mjs
 * Nécessite `sharp`, déjà présent via Next.js. À relancer uniquement si les
 * icônes de public/icons changent : les PNG produits sont versionnés.
 */
import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'

const BG = { r: 11, g: 15, b: 13, alpha: 1 } // #0b0f0d — fond réel de l'app
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 }
const RES = 'android/app/src/main/res'

// Densités Android : préfixe de dossier → facteur (1dp = x px)
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }

// Le logo est un carré arrondi plein cadre (rayon de coin ≈ 22 % du côté).
// Android n'affiche de l'icône adaptative qu'un cercle de 66dp dans un canevas
// de 108dp : à 47 %, le point le plus éloigné du logo arrive juste au bord du
// cercle, donc aucun rognage quel que soit le masque du lanceur (cercle sur
// Pixel, carré arrondi sur Samsung/Oppo).
const ADAPTIVE_FRACTION = 0.47
// Icône « héritée » (Android 7 et antérieurs) : aucun masque système, on part
// de l'icône maskable (fond #0b0f0d + logo) et on dessine nous-mêmes la forme.
const LEGACY_FRACTION = 0.6
// Écran de démarrage : le thème natif étire l'image en CENTER_CROP, un logo
// centré survit donc au recadrage quel que soit le ratio de l'écran.
const SPLASH_FRACTION = 0.24

/**
 * Logo transparent : icon-512.png est un carré arrondi plein cadre posé sur du
 * transparent, c'est donc déjà exactement le logo, sans marge à détourer.
 * (icon-maskable-512.png, lui, a un fond opaque : inutilisable ici.)
 */
async function markBuffer() {
  return sharp('public/icons/icon-512.png').png().toBuffer()
}

/** Le logo redimensionné pour occuper `fraction` du côté demandé. */
async function markAt(mark, size, fraction) {
  return sharp(mark)
    .resize(Math.max(1, Math.round(size * fraction)), null, { fit: 'inside' })
    .png()
    .toBuffer()
}

const circle = (s) =>
  Buffer.from(
    `<svg width="${s}" height="${s}" xmlns="http://www.w3.org/2000/svg"><circle cx="${s / 2}" cy="${s / 2}" r="${s / 2}" fill="#fff"/></svg>`,
  )
const squircle = (s, r = Math.round(s * 0.22)) =>
  Buffer.from(
    `<svg width="${s}" height="${s}" xmlns="http://www.w3.org/2000/svg"><rect width="${s}" height="${s}" rx="${r}" ry="${r}" fill="#fff"/></svg>`,
  )

const mark = await markBuffer()
console.log(`logo source : ${(await sharp(mark).metadata()).width}px`)

for (const [density, factor] of Object.entries(DENSITIES)) {
  const dir = path.join(RES, `mipmap-${density}`)
  fs.mkdirSync(dir, { recursive: true })

  // Icône adaptative : canevas transparent de 108dp, logo dans la zone sûre.
  const canvas = Math.round(108 * factor)
  await sharp({ create: { width: canvas, height: canvas, channels: 4, background: CLEAR } })
    .composite([{ input: await markAt(mark, canvas, ADAPTIVE_FRACTION), gravity: 'center' }])
    .png()
    .toFile(path.join(dir, 'ic_launcher_foreground.png'))

  // Icône héritée : carré arrondi (puis cercle pour la variante ronde) teinté
  // en #0b0f0d, logo posé au centre.
  const legacy = Math.round(48 * factor)
  const inner = await markAt(mark, legacy, LEGACY_FRACTION)
  for (const [name, mask] of [
    ['ic_launcher.png', squircle(legacy)],
    ['ic_launcher_round.png', circle(legacy)],
  ]) {
    await sharp({ create: { width: legacy, height: legacy, channels: 4, background: BG } })
      .composite([{ input: mask, blend: 'dest-in' }, { input: inner, gravity: 'center' }])
      .png()
      .toFile(path.join(dir, name))
  }
  console.log(`mipmap-${density} : foreground ${canvas}px, héritée ${legacy}px`)
}

const SPLASHES = [
  ['drawable', 480, 320],
  ['drawable-port-mdpi', 320, 480],
  ['drawable-port-hdpi', 480, 800],
  ['drawable-port-xhdpi', 720, 1280],
  ['drawable-port-xxhdpi', 960, 1600],
  ['drawable-port-xxxhdpi', 1280, 1920],
  ['drawable-land-mdpi', 480, 320],
  ['drawable-land-hdpi', 800, 480],
  ['drawable-land-xhdpi', 1280, 720],
  ['drawable-land-xxhdpi', 1600, 960],
  ['drawable-land-xxxhdpi', 1920, 1280],
]

for (const [dir, w, h] of SPLASHES) {
  const out = path.join(RES, dir)
  fs.mkdirSync(out, { recursive: true })
  await sharp({ create: { width: w, height: h, channels: 4, background: BG } })
    .composite([{ input: await markAt(mark, Math.min(w, h), SPLASH_FRACTION), gravity: 'center' }])
    .flatten({ background: BG })
    .png()
    .toFile(path.join(out, 'splash.png'))
}
console.log(`${SPLASHES.length} écrans de démarrage générés.`)

console.log('\nRessources Android générées.')
