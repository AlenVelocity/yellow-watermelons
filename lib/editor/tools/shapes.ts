import type { Point, Rect } from "@/lib/editor/tools/selection";

export type ShapeKind = "line" | "arrow" | "rect" | "ellipse";

export type ShapeSpec = {
  kind: ShapeKind;
  /** Drag start and end, in image pixel space. */
  start: Point;
  end: Point;
  color: string;
  strokeWidth: number;
  /** Only meaningful for the closed shapes; lines and arrows are always stroked. */
  filled: boolean;
};

/** Lines and arrows have no interior, so the fill toggle does not apply to them. */
export function isFillable(kind: ShapeKind): boolean {
  return kind === "rect" || kind === "ellipse";
}

/** True once the drag is long enough to be a deliberate shape rather than a stray tap. */
export function isDrawableShape(shape: ShapeSpec): boolean {
  return Math.hypot(shape.end.x - shape.start.x, shape.end.y - shape.start.y) > 2;
}

export function drawShape(ctx: CanvasRenderingContext2D, shape: ShapeSpec): void {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = shape.strokeWidth;
  ctx.strokeStyle = shape.color;
  ctx.fillStyle = shape.color;

  switch (shape.kind) {
    case "line": {
      ctx.beginPath();
      ctx.moveTo(shape.start.x, shape.start.y);
      ctx.lineTo(shape.end.x, shape.end.y);
      ctx.stroke();
      break;
    }
    case "arrow": {
      ctx.beginPath();
      ctx.moveTo(shape.start.x, shape.start.y);
      ctx.lineTo(shape.end.x, shape.end.y);
      ctx.stroke();
      drawArrowHead(ctx, shape);
      break;
    }
    case "rect": {
      const rect = normalizeRect(shape.start, shape.end);
      ctx.beginPath();
      ctx.rect(rect.x, rect.y, rect.width, rect.height);
      paint(ctx, shape);
      break;
    }
    case "ellipse": {
      const rect = normalizeRect(shape.start, shape.end);
      ctx.beginPath();
      ctx.ellipse(
        rect.x + rect.width / 2,
        rect.y + rect.height / 2,
        rect.width / 2,
        rect.height / 2,
        0,
        0,
        Math.PI * 2,
      );
      paint(ctx, shape);
      break;
    }
  }

  ctx.restore();
}

/** Bakes `shape` into a copy of `source`, for repeating it across every frame. */
export function renderShapeToImageData(source: ImageData, shape: ShapeSpec): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.putImageData(source, 0, 0);
  drawShape(ctx, shape);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function paint(ctx: CanvasRenderingContext2D, shape: ShapeSpec) {
  if (shape.filled) ctx.fill();
  else ctx.stroke();
}

function drawArrowHead(ctx: CanvasRenderingContext2D, shape: ShapeSpec) {
  const angle = Math.atan2(shape.end.y - shape.start.y, shape.end.x - shape.start.x);
  const length = Math.max(shape.strokeWidth * 3.2, 8);
  const spread = Math.PI / 7;
  ctx.beginPath();
  ctx.moveTo(shape.end.x, shape.end.y);
  ctx.lineTo(
    shape.end.x - length * Math.cos(angle - spread),
    shape.end.y - length * Math.sin(angle - spread),
  );
  ctx.lineTo(
    shape.end.x - length * Math.cos(angle + spread),
    shape.end.y - length * Math.sin(angle + spread),
  );
  ctx.closePath();
  ctx.fill();
}

function normalizeRect(start: Point, end: Point): Rect {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}
