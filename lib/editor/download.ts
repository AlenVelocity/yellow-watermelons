import type { EditorDocument } from "@/lib/editor/store";
import { encodeStaticImage } from "@/lib/formats/staticImage";
import { encodeApng } from "@/lib/formats/apng";
import { encodeAnimatedWebp } from "@/lib/formats/webp";

export async function buildDocumentFile(doc: EditorDocument, activeFrameIndex: number): Promise<File> {
  let blob: Blob;
  let ext: string;

  if (doc.format === "webp-animated" && doc.frames.length > 1) {
    blob = await encodeAnimatedWebp(doc);
    ext = "webp";
  } else if (doc.frames.length > 1) {
    blob = encodeApng(doc);
    ext = "png";
  } else {
    const mime =
      doc.format === "jpeg" ? "image/jpeg" : doc.format === "webp" ? "image/webp" : "image/png";
    blob = await encodeStaticImage(doc.frames[activeFrameIndex].imageData, mime);
    ext = mime === "image/jpeg" ? "jpg" : mime === "image/webp" ? "webp" : "png";
  }

  const name = `${doc.fileName.replace(/\.[^.]+$/, "")}-yellow.${ext}`;
  return new File([blob], name, { type: blob.type });
}

export async function downloadDocument(doc: EditorDocument, activeFrameIndex: number): Promise<void> {
  const file = await buildDocumentFile(doc, activeFrameIndex);
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
}
