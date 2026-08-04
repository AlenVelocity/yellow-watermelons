import { encodeAnimation } from "wasm-webp";
import type { EditorDocument } from "@/lib/editor/store";

const STICKER_SIZE = 512;
const MAX_STATIC_BYTES = 100 * 1024;
const MAX_ANIMATED_BYTES = 500 * 1024;

/**
 * Builds a WhatsApp-spec sticker file: every frame padded to a 512x512 square and
 * encoded as WebP under WhatsApp's size limits. WhatsApp animated stickers must be
 * WebP (not APNG), so multi-frame documents always go through the animated encoder
 * here even if they were imported as APNG.
 */
export async function buildWhatsAppSticker(doc: EditorDocument): Promise<File> {
  const paddedFrames = doc.frames.map((f) => resizeAndPad(f.imageData, STICKER_SIZE));
  const name = `${doc.fileName.replace(/\.[^.]+$/, "")}-yellow.webp`;

  if (paddedFrames.length > 1) {
    const blob = await encodeAnimatedUnderLimit(
      STICKER_SIZE,
      STICKER_SIZE,
      paddedFrames,
      doc.frames.map((f) => f.duration),
      MAX_ANIMATED_BYTES,
    );
    return new File([blob], name, { type: "image/webp" });
  }

  const blob = await encodeStaticUnderLimit(paddedFrames[0], MAX_STATIC_BYTES);
  return new File([blob], name, { type: "image/webp" });
}

function resizeAndPad(imageData: ImageData, size: number): ImageData {
  // Always scale to fill the square on the limiting axis — capping at 1 (never
  // upscaling) left small source stickers stranded in the middle of the 512x512
  // canvas with a lot of surrounding padding. Padding on the other axis is only
  // left over when the source isn't square, which is unavoidable without distorting it.
  const scale = Math.min(size / imageData.width, size / imageData.height);
  const w = Math.round(imageData.width * scale);
  const h = Math.round(imageData.height * scale);

  const src = document.createElement("canvas");
  src.width = imageData.width;
  src.height = imageData.height;
  const srcCtx = src.getContext("2d");
  if (!srcCtx) throw new Error("Canvas 2D context unavailable");
  srcCtx.putImageData(imageData, 0, 0);

  const out = document.createElement("canvas");
  out.width = size;
  out.height = size;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    src,
    0,
    0,
    imageData.width,
    imageData.height,
    (size - w) / 2,
    (size - h) / 2,
    w,
    h,
  );
  return ctx.getImageData(0, 0, size, size);
}

async function encodeStaticUnderLimit(imageData: ImageData, maxBytes: number): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.putImageData(imageData, 0, 0);

  let quality = 0.9;
  let blob = await toBlob(canvas, quality);
  while (blob.size > maxBytes && quality > 0.2) {
    quality -= 0.15;
    blob = await toBlob(canvas, quality);
  }
  return blob;
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Encoding failed"))),
      "image/webp",
      quality,
    );
  });
}

async function encodeAnimatedUnderLimit(
  width: number,
  height: number,
  frames: ImageData[],
  durations: number[],
  maxBytes: number,
): Promise<Blob> {
  let quality = 80;
  let result: Uint8Array | null = null;

  while (quality >= 20) {
    const wframes = frames.map((imgData, i) => ({
      data: new Uint8Array(imgData.data),
      duration: Math.max(20, Math.round(durations[i] || 100)),
      config: { lossless: 0, quality },
    }));
    result = await encodeAnimation(width, height, true, wframes);
    if (result && result.byteLength <= maxBytes) break;
    quality -= 20;
  }

  if (!result) throw new Error("Couldn't encode this animated sticker.");
  return new Blob([result.slice()], { type: "image/webp" });
}
