#!/usr/bin/env node
/**
 * Convert the repository-root appicon.png into all desktop-owned logo assets:
 * - build/app-icon.png (1024x1024 RGBA16 PNG with ICC profile)
 * - build/app-icon-mac.png (macOS Dock icon with 100 px visual inset)
 * - build/tray-icon*.png (macOS template + brand-color Windows/Linux tray icons)
 *
 * Also emits a base64-encoded UI logo suitable for embedding in upstream
 * React components, printed to stdout when run with --print-ui-logo.
 */
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const packageRoot = resolve(__dirname, '..')
const buildRoot = join(packageRoot, 'build')
const repoRoot = resolve(packageRoot, '..')

const sourcePath = join(repoRoot, 'appicon.png')

/** Pixel width and height of the application icon canvas. */
const APP_ICON_SIZE = 1024
/** Pixel width and height of the centered artwork inside the macOS icon. */
const MAC_ICON_ARTWORK_SIZE = 824
/** Transparent inset on each edge of the generated macOS icon. */
const MAC_ICON_INSET = (APP_ICON_SIZE - MAC_ICON_ARTWORK_SIZE) / 2

/**
 * Extract the ICC profile from the existing app-icon.png into a temporary file
 * so sharp can embed it in the generated icons.
 */
async function extractIccProfile() {
  const existing = join(buildRoot, 'app-icon.png')
  const metadata = await sharp(existing).metadata()
  if (metadata.icc === undefined) {
    throw new Error('existing build/app-icon.png has no ICC profile')
  }
  const tmpDir = await mkdtemp(join(tmpdir(), 'dsh-appicon-'))
  const iccPath = join(tmpDir, 'profile.icc')
  await writeFile(iccPath, metadata.icc)
  return iccPath
}

async function main() {
  const args = process.argv.slice(2)
  const printUiLogo = args.includes('--print-ui-logo')

  const icc = await extractIccProfile()

  // Pad the source to a square with transparent background, then resize to the
  // canonical app icon size. The source may be rectangular (e.g. 5000x3489).
  const squareSource = sharp(sourcePath)
    .resize({
      width: APP_ICON_SIZE,
      height: APP_ICON_SIZE,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toColourspace('rgb16')
    .withMetadata({ icc })
    .png({
      compressionLevel: 9,
      progressive: false,
      adaptiveFiltering: false,
      palette: false,
    })

  const appIconBuffer = await squareSource.toBuffer()
  await writeFile(join(buildRoot, 'app-icon.png'), appIconBuffer)

  // macOS icon: center the artwork on a transparent canvas.
  const macIconBuffer = await sharp(appIconBuffer)
    .resize({
      width: MAC_ICON_ARTWORK_SIZE,
      height: MAC_ICON_ARTWORK_SIZE,
      fit: 'fill',
      kernel: sharp.kernel.lanczos3,
    })
    .extend({
      top: MAC_ICON_INSET,
      bottom: MAC_ICON_INSET,
      left: MAC_ICON_INSET,
      right: MAC_ICON_INSET,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toColourspace('rgb16')
    .keepIccProfile()
    .png({
      compressionLevel: 9,
      progressive: false,
      adaptiveFiltering: false,
      palette: false,
    })
    .toBuffer()
  await writeFile(join(buildRoot, 'app-icon-mac.png'), macIconBuffer)

  // Tray icons. macOS template images are grayscale silhouettes; Windows/Linux
  // use the full-color logo.
  const trayVariants = [
    ['tray-iconTemplate.png', 16, true],
    ['tray-iconTemplate@2x.png', 32, true],
    ['tray-icon-blue.png', 16, false],
    ['tray-icon-blue@1.25x.png', 20, false],
    ['tray-icon-blue@1.5x.png', 24, false],
    ['tray-icon-blue@2x.png', 32, false],
  ]

  await Promise.all(trayVariants.map(async ([filename, size, grayscale]) => {
    let pipeline = sharp(appIconBuffer).resize({
      width: size,
      height: size,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    if (grayscale) {
      pipeline = pipeline.grayscale()
    }
    const buffer = await pipeline
      .png({ compressionLevel: 9 })
      .toBuffer()
    await writeFile(join(buildRoot, filename), buffer)
  }))

  // UI logo: preserve the original aspect ratio, retina width 256 px.
  const uiLogoBuffer = await sharp(sourcePath)
    .resize({ width: 256, height: 256, fit: 'inside' })
    .png({ compressionLevel: 9 })
    .toBuffer()
  const uiLogoDataUri = `data:image/png;base64,${uiLogoBuffer.toString('base64')}`

  if (printUiLogo) {
    process.stdout.write(uiLogoDataUri)
  }

  console.log(`applied ${sourcePath} to desktop icon assets in ${buildRoot}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
