// 生成 PWA 需要的 PNG 图标（用 sharp 把 SVG 渲染成 192/512/maskable）
// 运行:  node scripts/generate-pwa-icons.mjs
import sharp from 'sharp'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')
const source = join(publicDir, 'icon-source.svg')
const sourceBuffer = await import('node:fs').then(m => m.readFileSync(source))

const targets = [
  { file: 'pwa-192x192.png',        size: 192, purpose: 'any' },
  { file: 'pwa-512x512.png',        size: 512, purpose: 'any' },
  { file: 'pwa-512x512-maskable.png', size: 512, purpose: 'maskable', safeZone: true },
  { file: 'apple-touch-icon.png',   size: 180, purpose: 'apple' },
  { file: 'favicon-32.png',         size: 32,  purpose: 'favicon' },
]

for (const t of targets) {
  let img = sharp(sourceBuffer)
  if (t.safeZone) {
    // maskable: 留 10% 安全区，缩到 80% 居中
    const inner = Math.round(t.size * 0.8)
    const pad = Math.round((t.size - inner) / 2)
    const resized = await sharp(sourceBuffer).resize(inner, inner).toBuffer()
    img = sharp({
      create: { width: t.size, height: t.size, channels: 4, background: { r: 11, g: 16, b: 32, alpha: 1 } }
    })
      .composite([{ input: resized, top: pad, left: pad }])
  } else {
    img = sharp(sourceBuffer).resize(t.size, t.size)
  }
  const out = await img.png().toBuffer()
  writeFileSync(join(publicDir, t.file), out)
  console.log(`  ✓ ${t.file}  (${t.size}px${t.purpose === 'maskable' ? ' maskable' : ''})`)
}

console.log('Done. PWA icons written to public/')
