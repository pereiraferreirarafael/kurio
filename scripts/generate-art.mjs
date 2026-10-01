// Gera artes SVG provisórias em public/nfts. Substituir pelos assets exportados do Figma.
import { mkdirSync, writeFileSync } from 'node:fs'

const palettes = [
  { bg: '#e9e3c3', fur: '#7a4b2a', face: '#e0b98a', acc: '#2f6b4f' },
  { bg: '#c7d9cf', fur: '#6b6f7a', face: '#c9c5bd', acc: '#6b4fa0' },
  { bg: '#dbd0e8', fur: '#3d3a44', face: '#b9b2b0', acc: '#e9e3c3' },
  { bg: '#f0d9b5', fur: '#b8621f', face: '#f0c48a', acc: '#2a8a8a' },
  { bg: '#cfe0d8', fur: '#5a4f3a', face: '#d8c7a2', acc: '#8a5bb5' },
  { bg: '#e6d2c5', fur: '#4a3326', face: '#d9b08c', acc: '#c9a227' },
  { bg: '#d6e0ef', fur: '#33415c', face: '#b8c2d4', acc: '#e89b55' },
  { bg: '#efe2bb', fur: '#8c5a14', face: '#f2cf8d', acc: '#2f6b4f' },
]

function art({ bg, fur, face, acc }, i) {
  const extra =
    i % 3 === 0
      ? `<rect x="120" y="112" width="160" height="26" rx="13" fill="${acc}"/>`
      : i % 3 === 1
        ? `<path d="M110 150 q90 -80 180 0 z" fill="${acc}"/>`
        : `<path d="M100 215 q-20 -80 100 -100 q120 20 100 100" fill="none" stroke="${acc}" stroke-width="14"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" role="img" aria-label="Arte abstrata ${i + 1}">
<rect width="400" height="400" fill="${bg}"/>
<circle cx="200" cy="215" r="120" fill="${fur}"/>
<ellipse cx="200" cy="240" rx="82" ry="70" fill="${face}"/>
<circle cx="150" cy="210" r="22" fill="#fff"/><circle cx="250" cy="210" r="22" fill="#fff"/>
<circle cx="152" cy="212" r="10" fill="#140d0a"/><circle cx="248" cy="212" r="10" fill="#140d0a"/>
<rect x="176" y="262" width="48" height="10" rx="5" fill="${fur}"/>
${extra}
<rect x="80" y="330" width="240" height="70" rx="30" fill="${acc}"/>
</svg>`
}

mkdirSync('public/nfts', { recursive: true })
palettes.forEach((p, i) => writeFileSync(`public/nfts/art-${i}.svg`, art(p, i)))
console.log(`${palettes.length} artes geradas em public/nfts`)
