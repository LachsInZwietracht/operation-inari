import { copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Copies the ZXing wasm binary into `public/` so the barcode scanner loads it
 * from our own origin.
 *
 * zxing-wasm otherwise fetches it from a CDN at runtime, which would mean a
 * third party sees every scan attempt and the scanner breaks whenever that CDN
 * does. Runs from `predev` and `prebuild`, so the copy cannot drift from the
 * installed package version.
 */
const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = resolve(root, "public/zxing/zxing_reader.wasm");

const source = require.resolve("zxing-wasm/reader/zxing_reader.wasm");

await mkdir(dirname(target), { recursive: true });
await copyFile(source, target);
