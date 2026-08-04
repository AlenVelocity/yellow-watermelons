import type { CropRect, EditorDocument } from "@/lib/editor/store";

/** Crops every frame of `doc` to `rect` (in image pixel space), clamped to the document bounds. */
export function cropDocument(doc: EditorDocument, rect: CropRect): EditorDocument {
  const x = Math.max(0, Math.round(rect.x));
  const y = Math.max(0, Math.round(rect.y));
  const width = Math.max(1, Math.min(Math.round(rect.width), doc.width - x));
  const height = Math.max(1, Math.min(Math.round(rect.height), doc.height - y));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  const frames = doc.frames.map((frame) => {
    const src = document.createElement("canvas");
    src.width = frame.imageData.width;
    src.height = frame.imageData.height;
    const srcCtx = src.getContext("2d");
    if (!srcCtx) throw new Error("Canvas 2D context unavailable");
    srcCtx.putImageData(frame.imageData, 0, 0);

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(src, x, y, width, height, 0, 0, width, height);
    return { ...frame, imageData: ctx.getImageData(0, 0, width, height) };
  });

  return { ...doc, width, height, frames };
}
