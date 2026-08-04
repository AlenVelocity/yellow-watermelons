import UPNG from "upng-js";
import type { EditorDocument, Frame } from "@/lib/editor/store";

const DEFAULT_DELAY_MS = 100;

export async function decodeApng(file: File): Promise<EditorDocument> {
  const buffer = await file.arrayBuffer();
  const img = UPNG.decode(buffer);
  const rgbaFrames = UPNG.toRGBA8(img);

  const frames: Frame[] = rgbaFrames.map((buf, i) => ({
    imageData: new ImageData(new Uint8ClampedArray(buf), img.width, img.height),
    duration: img.frames[i]?.delay || DEFAULT_DELAY_MS,
  }));

  return {
    width: img.width,
    height: img.height,
    frames,
    format: "apng",
    fileName: file.name,
  };
}

export function encodeApng(doc: EditorDocument): Blob {
  const buffers = doc.frames.map((f) => new Uint8ClampedArray(f.imageData.data).buffer);
  const delays = doc.frames.map((f) => Math.max(20, Math.round(f.duration || DEFAULT_DELAY_MS)));
  const arrayBuffer = UPNG.encode(
    buffers,
    doc.width,
    doc.height,
    0,
    doc.frames.length > 1 ? delays : undefined,
  );
  return new Blob([arrayBuffer], { type: "image/png" });
}
