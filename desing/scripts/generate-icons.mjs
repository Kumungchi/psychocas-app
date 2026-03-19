// Generates PWA icons (192x192 and 512x512) from an SVG template.
// Run: node scripts/generate-icons.mjs
// Requires: sharp (npm install -D sharp)

import sharp from 'sharp'
import { mkdirSync } from 'fs'

// Brand colors
const PRIMARY = '#1d4f7d'
const WHITE = '#ffffff'

// SVG template — Ψ (psi) letter on brand-colored rounded background
// Ψ is the symbol for psychology — perfect for Psychočas
function createSvg(size) {
  const fontSize = Math.round(size * 0.55)
  const yOffset = Math.round(size * 0.62)
  const radius = Math.round(size * 0.2)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="${PRIMARY}"/>
  <text
    x="50%" y="${yOffset}"
    font-family="Arial, Helvetica, sans-serif"
    font-size="${fontSize}"
    font-weight="bold"
    fill="${WHITE}"
    text-anchor="middle"
  >Ψ</text>
</svg>`
}

// Generate both sizes
const sizes = [192, 512]

mkdirSync('public/icons', { recursive: true })

for (const size of sizes) {
  const svg = Buffer.from(createSvg(size))
  await sharp(svg)
    .png()
    .toFile(`public/icons/icon-${size}.png`)
  console.log(`✓ public/icons/icon-${size}.png`)
}

console.log('\nDone! PWA icons generated.')
