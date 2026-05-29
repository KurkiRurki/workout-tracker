import sharp from 'sharp'
import { mkdirSync, writeFileSync } from 'fs'

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="20" fill="#0a0a12"/>
  <circle cx="20" cy="12" r="6.5" fill="none" stroke="#22d3a0" stroke-width="2.5"/>
  <circle cx="80" cy="12" r="6.5" fill="none" stroke="#22d3a0" stroke-width="2.5"/>
  <rect x="18.5" y="18.5" width="3" height="23" rx="1.5" fill="#22d3a0"/>
  <rect x="78.5" y="18.5" width="3" height="23" rx="1.5" fill="#22d3a0"/>
  <circle cx="50" cy="23" r="8.5" fill="#22d3a0"/>
  <ellipse cx="50" cy="34" rx="10" ry="5" fill="#22d3a0"/>
  <ellipse cx="37" cy="43" rx="9" ry="10" fill="#22d3a0"/>
  <rect x="12" y="39" width="26" height="8" rx="4" fill="#22d3a0"/>
  <ellipse cx="63" cy="43" rx="9" ry="10" fill="#22d3a0"/>
  <rect x="62" y="39" width="26" height="8" rx="4" fill="#22d3a0"/>
  <circle cx="20" cy="43" r="4.5" fill="#22d3a0"/>
  <circle cx="80" cy="43" r="4.5" fill="#22d3a0"/>
  <rect x="41" y="32" width="18" height="34" rx="6" fill="#22d3a0"/>
  <rect x="43" y="64" width="14" height="28" rx="6" fill="#22d3a0"/>
  <ellipse cx="50" cy="92" rx="10" ry="4" fill="#22d3a0"/>
</svg>`

mkdirSync('./public', { recursive: true })
writeFileSync('./public/favicon.svg', svg)
await sharp(Buffer.from(svg)).resize(192, 192).png().toFile('./public/icon-192.png')
await sharp(Buffer.from(svg)).resize(512, 512).png().toFile('./public/icon-512.png')
console.log('Icons created.')
