"use client";

import { useRef, useState, type ReactNode } from "react";
import { useEditorStore } from "@/lib/editor/store";
import { detectFormat } from "@/lib/formats/detect";
import { decodeStaticImage, encodeStaticImage } from "@/lib/formats/staticImage";
import { decodeApng, encodeApng } from "@/lib/formats/apng";
import { decodeAnimatedWebp, encodeAnimatedWebp } from "@/lib/formats/webp";
import { buildWhatsAppSticker } from "@/lib/formats/whatsappSticker";

function ErrorToast({ message }: { message: string }) {
  return (
    <div className="fixed inset-x-4 bottom-24 z-50 rounded-lg border border-destructive/40 bg-destructive/15 px-4 py-3 text-sm text-destructive-foreground backdrop-blur">
      {message}
    </div>
  );
}

export function ImportButton({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const loadDocument = useEditorStore((s) => s.loadDocument);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    try {
      const detected = await detectFormat(file);
      if (detected.kind === "unknown") {
        setError("Unsupported file. Use PNG, JPG, or WebP.");
        return;
      }
      if (detected.animated && detected.kind === "png") {
        const doc = await decodeApng(file);
        loadDocument(doc);
        return;
      }
      if (detected.animated && detected.kind === "webp") {
        const doc = await decodeAnimatedWebp(file);
        loadDocument(doc);
        return;
      }
      if (detected.animated) {
        setError(`Animated ${detected.kind.toUpperCase()} isn't supported yet.`);
        return;
      }
      const doc = await decodeStaticImage(file, detected.kind);
      loadDocument(doc);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open that file.");
    }
  }

  return (
    <>
      <button type="button" onClick={() => inputRef.current?.click()} className={className}>
        {children}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) handleFile(file);
        }}
      />
      {error && <ErrorToast message={error} />}
    </>
  );
}

export function DownloadButton({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const doc = useEditorStore((s) => s.document);
  const activeFrameIndex = useEditorStore((s) => s.activeFrameIndex);

  async function handleDownload() {
    if (!doc) return;

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

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doc.fileName.replace(/\.[^.]+$/, "")}-yellow.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button type="button" onClick={handleDownload} disabled={!doc} className={className}>
      {children}
    </button>
  );
}

export function ShareButton({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const doc = useEditorStore((s) => s.document);
  const [error, setError] = useState<string | null>(null);

  async function handleShare() {
    if (!doc) return;
    setError(null);
    try {
      const file = await buildWhatsAppSticker(doc);
      const nav = navigator as Navigator & {
        canShare?: (data: { files: File[] }) => boolean;
        share?: (data: { files: File[]; title?: string }) => Promise<void>;
      };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: "Sticker" });
      } else {
        const url = URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return; // user dismissed the share sheet
      setError(e instanceof Error ? e.message : "Couldn't prepare the sticker.");
    }
  }

  return (
    <>
      <button type="button" onClick={handleShare} disabled={!doc} className={className}>
        {children}
      </button>
      {error && <ErrorToast message={error} />}
    </>
  );
}
