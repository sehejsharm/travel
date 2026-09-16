/**
 * Renders the native icon set from the app's own icon routes.
 *
 * Two things the web icons cannot do:
 *
 *  - The App Store rejects a 1024 icon that carries an alpha channel, and
 *    everything `next/og` renders is RGBA. These are flattened onto the brand
 *    ink and re-encoded without alpha.
 *  - Android adaptive icons are two layers, not one image, and the foreground
 *    must sit inside a 66% safe circle or the launcher crops it.
 *
 * Run against a running build: `node scripts/build-native-icons.mjs [baseUrl]`.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const BASE = process.argv[2] ?? "http://localhost:3000";
const OUT = process.argv[3] ?? "native/icons";

/** Brand ink, matching src/lib/brand.ts. Opaque, so flattening is lossless. */
const INK = { r: 11, g: 17, b: 22 };

async function fetchPng(route) {
  const response = await fetch(`${BASE}${route}`);
  if (!response.ok) throw new Error(`${route} → ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function opaque(buffer, size) {
  return sharp(buffer)
    .resize(size, size, { fit: "cover" })
    .flatten({ background: INK })
    // removeAlpha drops the channel entirely, which is what the store checks.
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const written = [];

  const save = async (name, buffer) => {
    const file = path.join(OUT, name);
    await writeFile(file, buffer);
    const meta = await sharp(buffer).metadata();
    written.push({ name, size: `${meta.width}x${meta.height}`, alpha: meta.hasAlpha, bytes: buffer.length });
  };

  const source512 = await fetchPng("/icons/512");

  // iOS. The marketing icon must be opaque and square, with no rounded corners
  // pre-applied — the store draws its own mask.
  await save("ios-marketing-1024.png", await opaque(await fetchPng("/icons/store"), 1024));
  for (const size of [180, 167, 152, 120, 87, 80, 60, 58, 40, 20]) {
    await save(`ios-${size}.png`, await opaque(source512, size));
  }

  // Android legacy launcher icons, per density bucket.
  for (const [bucket, size] of [
    ["mdpi", 48],
    ["hdpi", 72],
    ["xhdpi", 96],
    ["xxhdpi", 144],
    ["xxxhdpi", 192],
  ]) {
    await save(`android-${bucket}-${size}.png`, await opaque(source512, size));
  }

  // Play Store listing icon: 512, opaque.
  await save("play-store-512.png", await opaque(source512, 512));

  /*
   * Adaptive icon foreground. Android renders 108dp but only the middle 72dp
   * is guaranteed visible, so the mark is scaled into that safe circle and the
   * rest is transparent padding — this layer keeps its alpha deliberately.
   */
  const maskable = await fetchPng("/icons/maskable");
  const safe = Math.round(432 * 0.62);
  const foreground = await sharp({
    create: { width: 432, height: 432, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      {
        input: await sharp(maskable)
          .resize(safe, safe, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .toBuffer(),
        gravity: "centre",
      },
    ])
    .png()
    .toBuffer();
  await save("android-adaptive-foreground-432.png", foreground);

  // The background layer is a flat plate; Android animates the two apart.
  await save(
    "android-adaptive-background-432.png",
    await sharp({
      create: { width: 432, height: 432, channels: 3, background: INK },
    })
      .png()
      .toBuffer(),
  );

  console.table(written);

  const bad = written.filter((entry) => entry.alpha && !entry.name.includes("foreground"));
  if (bad.length > 0) {
    console.error(`FAILED: ${bad.length} icon(s) still carry alpha:`, bad.map((e) => e.name));
    process.exit(1);
  }
  console.log(`\n${written.length} icons written to ${OUT}/ — none carry alpha except the adaptive foreground, which must.`);
}

await main();
