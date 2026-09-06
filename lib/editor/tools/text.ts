export type TextStyle = {
  fontSize: number;
  color: string;
  fontFamily: string;
  bold: boolean;
  /** Draws a contrasting outline behind the glyphs so text stays readable on busy art. */
  outline: boolean;
};

/** An uncommitted caption: styling plus where it sits, in image pixel space. */
export type TextDraft = TextStyle & {
  text: string;
  /** Centre of the text block. */
  x: number;
  y: number;
};

export const TEXT_FONTS: { label: string; value: string }[] = [
  { label: "Sans", value: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
  { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
  { label: "Mono", value: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  { label: "Impact", value: "Impact, 'Arial Black', system-ui, sans-serif" },
];

const LINE_HEIGHT = 1.2;
/** Share of the image width a caption may occupy before it wraps. */
const WRAP_WIDTH_RATIO = 0.92;

export function createTextDraft(width: number, height: number): TextDraft {
  return {
    text: "",
    x: width / 2,
    y: height / 2,
    // Roughly a seventh of the short edge — legible on a sticker without swamping it.
    fontSize: Math.max(8, Math.round(Math.min(width, height) / 7)),
    color: "#ffffff",
    fontFamily: TEXT_FONTS[0].value,
    bold: true,
    outline: true,
  };
}

/** Draws `draft` centred on its own (x, y), wrapped to the width of `ctx`'s canvas. */
export function drawText(ctx: CanvasRenderingContext2D, draft: TextDraft): void {
  if (!draft.text.trim()) return;

  ctx.save();
  ctx.font = `${draft.bold ? "bold " : ""}${draft.fontSize}px ${draft.fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;

  const lines = layoutLines(ctx, draft.text, ctx.canvas.width * WRAP_WIDTH_RATIO);
  const lineHeight = draft.fontSize * LINE_HEIGHT;
  const firstLineY = draft.y - ((lines.length - 1) * lineHeight) / 2;

  lines.forEach((line, i) => {
    const y = firstLineY + i * lineHeight;
    if (draft.outline) {
      ctx.lineWidth = Math.max(2, draft.fontSize * 0.14);
      ctx.strokeStyle = contrastColor(draft.color);
      ctx.strokeText(line, draft.x, y);
    }
    ctx.fillStyle = draft.color;
    ctx.fillText(line, draft.x, y);
  });

  ctx.restore();
}

/** Explicit line breaks first, then greedy word wrap on whatever is still too wide. */
function layoutLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let line = words[0];
    for (const word of words.slice(1)) {
      const candidate = `${line} ${word}`;
      // A single word wider than the image is left to overflow — breaking mid-word
      // would mangle it worse than the overhang does.
      if (ctx.measureText(candidate).width <= maxWidth) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

/** Bakes `draft` into a copy of `source`. */
export function renderTextToImageData(source: ImageData, draft: TextDraft): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.putImageData(source, 0, 0);
  drawText(ctx, draft);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/** Black or white, whichever stands out against `hex` (a #rgb or #rrggbb colour). */
export function contrastColor(hex: string): string {
  const value = hex.replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((c) => c + c)
          .join("")
      : value;
  if (full.length !== 6) return "#000000";
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? "#000000" : "#ffffff";
}
