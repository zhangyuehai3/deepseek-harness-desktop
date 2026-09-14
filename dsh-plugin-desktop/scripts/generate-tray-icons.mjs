/** Generate native tray bitmaps from the repository-owned brand SVG. */

import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const buildRoot = join(packageRoot, 'build')
const sourcePath = join(buildRoot, 'tray-icon.svg')
const source = await readFile(sourcePath, 'utf8')

const BRAND_ARTWORK = 'data:image/png;base64,'
if (!source.includes(BRAND_ARTWORK) || /<style\b/iu.test(source)) {
  throw new Error('generate-tray-icons: tray-icon.svg must embed the repository-owned EZAI artwork')
}

const variants = [
  ['tray-iconTemplate.png', true, 16],
  ['tray-iconTemplate@2x.png', true, 32],
  ['tray-icon-blue.png', false, 16],
  ['tray-icon-blue@1.25x.png', false, 20],
  ['tray-icon-blue@1.5x.png', false, 24],
  ['tray-icon-blue@2x.png', false, 32],
]

await Promise.all(variants.map(async ([filename, grayscale, size]) => {
  let pipeline = sharp(Buffer.from(source), { failOn: 'warning' })
    .resize({ width: size, height: size, fit: 'contain' })
  if (grayscale) pipeline = pipeline.grayscale()
  await pipeline
    .png({ compressionLevel: 9 })
    .toFile(join(buildRoot, filename))
}))
