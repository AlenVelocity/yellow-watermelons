import type { EditorDocument, SourceFormat } from "@/lib/editor/store";

export async function decodeStaticImage(
  file: File,
  format: SourceFormat,
): Promise<EditorDocument> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(bitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  bitmap.close();

  return {
    width: canvas.width,
    height: canvas.height,
    frames: [{ imageData, duration: 0 }],
    format,
    fileName: file.name,
  };
}

export async function encodeStaticImage(
  imageData: ImageData,
  mimeType: "image/png" | "image/webp" | "image/jpeg" = "image/png",
  quality = 0.92,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.putImageData(imageData, 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Encoding failed"))),
      mimeType,
      quality,
    );
  });
}
