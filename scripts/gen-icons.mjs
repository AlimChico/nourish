/**
 * Génère les icônes PWA PNG à partir de public/icon.svg (vectoriel).
 * - icon-192/512.png           : rendu tel quel (coins arrondis d'origine)
 * - icon-maskable-192/512.png  : art réduit à 80 % sur carré plein #0b0f0d (masque Android)
 * - apple-touch-icon.png (180) : carré plein pour l'écran d'accueil iOS
 * Usage : node scripts/gen-icons.mjs
 */
import { mkdirSync, readFileSync } from 'node:fs'
import sharp from 'sharp'

mkdirSync('public/icons', { recursive: true })

const svg = readFileSync('public/icon.svg')

await sharp(svg, { density: 300 }).resize(192, 192).png().toFile('public/icons/icon-192.png')
await sharp(svg, { density: 300 }).resize(512, 512).png().toFile('public/icons/icon-512.png')

// Maskable : le masque Android peut rogner jusqu'à 20 % — l'art est réduit à 80 %,
// centré sur un fond plein de la couleur de la marque.
const bg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="#0b0f0d"/></svg>`,
)
const art = await sharp(svg, { density: 300 }).resize(410, 410).png().toBuffer()
await sharp(bg)
  .composite([{ input: art, gravity: 'centre' }])
  .resize(512, 512)
  .png()
  .toFile('public/icons/icon-maskable-512.png')
await sharp('public/icons/icon-maskable-512.png')
  .resize(192, 192)
  .png()
  .toFile('public/icons/icon-maskable-192.png')

// iOS apple-touch-icon : carré plein (iOS rogne ses propres coins), 180×180.
await sharp(bg)
  .composite([{ input: await sharp(svg, { density: 300 }).resize(180, 180).png().toBuffer(), gravity: 'centre' }])
  .resize(180, 180)
  .png()
  .toFile('public/apple-touch-icon.png')

console.log('✔ icônes générées dans public/icons + public/apple-touch-icon.png')
