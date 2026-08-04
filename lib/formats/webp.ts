import { decodeAnimation, encodeAnimation } from "wasm-webp";
import type { EditorDocument, Frame } from "@/lib/editor/store";

const DEFAULT_DELAY_MS = 100;

export async function decodeAnimatedWebp(file: File): Promise<EditorDocument> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  const decoded = await decodeAnimation(buffer, true);
  if (!decoded || decoded.length === 0) {
    throw new Error("Couldn't decode this animated WebP.");
  }

  const frames: Frame[] = decoded.map((f) => ({
    imageData: new ImageData(new Uint8ClampedArray(f.data), f.width, f.height),
    duration: f.duration || DEFAULT_DELAY_MS,
  }));

  return {
    width: decoded[0].width,
    height: decoded[0].height,
    frames,
    format: "webp-animated",
    fileName: file.name,
  };
}

export async function encodeAnimatedWebp(doc: EditorDocument): Promise<Blob> {
  const frames = doc.frames.map((f) => ({
    data: new Uint8Array(f.imageData.data),
    duration: Math.max(20, Math.round(f.duration || DEFAULT_DELAY_MS)),
  }));
  const result = await encodeAnimation(doc.width, doc.height, true, frames);
  if (!result) throw new Error("Couldn't encode animated WebP.");
  return new Blob([result.slice()], { type: "image/webp" });
}
