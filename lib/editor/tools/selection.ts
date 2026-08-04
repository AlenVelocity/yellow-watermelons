export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };

export type Selection =
  | { shape: "rect"; width: number; height: number; data: Uint8Array; rect: Rect }
  | { shape: "freehand"; width: number; height: number; data: Uint8Array; points: Point[] };

export function rectToMask(rect: Rect, width: number, height: number): Uint8Array {
  const data = new Uint8Array(width * height);
  const x0 = clamp(Math.round(rect.x), 0, width);
  const y0 = clamp(Math.round(rect.y), 0, height);
  const x1 = clamp(Math.round(rect.x + rect.width), 0, width);
  const y1 = clamp(Math.round(rect.y + rect.height), 0, height);
  for (let y = y0; y < y1; y++) {
    const rowOffset = y * width;
    for (let x = x0; x < x1; x++) data[rowOffset + x] = 1;
  }
  return data;
}

/** Rasterizes a closed polygon (nonzero winding rule) into a 0/1 mask via an offscreen canvas fill. */
export function polygonToMask(points: Point[], width: number, height: number): Uint8Array {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const data = new Uint8Array(width * height);
  if (!ctx || points.length < 3) return data;

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
  ctx.fillStyle = "#fff";
  ctx.fill();

  const alpha = ctx.getImageData(0, 0, width, height).data;
  for (let i = 0; i < data.length; i++) data[i] = alpha[i * 4 + 3] > 0 ? 1 : 0;
  return data;
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}
