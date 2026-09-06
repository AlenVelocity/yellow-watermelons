import type { Point } from "@/lib/editor/tools/selection";

export type PaintMode = "brush" | "eraser";

export type PaintStrokeOptions = {
  size: number;
  color: string;
  mode: PaintMode;
};

export function beginStroke(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  options: PaintStrokeOptions,
): void {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = options.size;
  if (options.mode === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = options.color;
  }
  ctx.beginPath();
  ctx.moveTo(x, y);
  // Draw a dot immediately so a tap-without-drag still leaves a mark.
  ctx.lineTo(x + 0.01, y + 0.01);
  ctx.stroke();
}

export function continueStroke(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.lineTo(x, y);
  ctx.stroke();
}

export function endStroke(ctx: CanvasRenderingContext2D): void {
  ctx.closePath();
  ctx.globalCompositeOperation = "source-over";
}

/** Replays a recorded stroke onto a copy of `source`, for repeating it across every frame. */
export function renderStrokeToImageData(
  source: ImageData,
  points: Point[],
  options: PaintStrokeOptions,
): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.putImageData(source, 0, 0);
  if (points.length > 0) {
    beginStroke(ctx, points[0].x, points[0].y, options);
    for (const point of points.slice(1)) continueStroke(ctx, point.x, point.y);
    endStroke(ctx);
  }
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}
