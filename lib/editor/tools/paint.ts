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
