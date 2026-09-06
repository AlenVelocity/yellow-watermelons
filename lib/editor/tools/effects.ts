import type { Point, Selection } from "@/lib/editor/tools/selection";

export type EffectMode = "blur" | "pixelate";

export type EffectOptions = {
  mode: EffectMode;
  /** Blur radius, or mosaic block size, in image pixels. */
  strength: number;
};

export type EffectStrokeOptions = EffectOptions & { size: number };

export type EffectStroke = {
  /** Grows the painted area to (x, y) and repaints the target canvas. */
  extend: (x: number, y: number) => void;
};

/** Runs the effect over the whole image, or only inside `selection` when one is given. */
export function applyEffect(
  source: ImageData,
  options: EffectOptions,
  selection?: Selection | null,
): ImageData {
  const effect = renderEffect(source, options);
  if (!selection || selection.width !== source.width || selection.height !== source.height) {
    return effect;
  }

  const out = new Uint8ClampedArray(source.data);
  const mask = selection.data;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const p = i * 4;
    out[p] = effect.data[p];
    out[p + 1] = effect.data[p + 1];
    out[p + 2] = effect.data[p + 2];
    out[p + 3] = effect.data[p + 3];
  }
  return new ImageData(out, source.width, source.height);
}

/**
 * Starts a blur/pixelate brush on `ctx`. The effect is rendered once for the whole
 * frame up front and then revealed through a stroke mask, so a drag costs a couple of
 * canvas composites per step no matter how strong the effect is.
 */
export function beginEffectStroke(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  options: EffectStrokeOptions,
): EffectStroke {
  const { width, height } = ctx.canvas;
  const base = ctx.getImageData(0, 0, width, height);
  const effect = layerFrom(renderEffect(base, options));
  const mask = createLayer(width, height);
  const scratch = createLayer(width, height);

  beginMaskStroke(mask.ctx, x, y, options.size);
  paintThroughMask(ctx, base, effect.canvas, mask.canvas, scratch);

  return {
    extend(nextX, nextY) {
      mask.ctx.lineTo(nextX, nextY);
      mask.ctx.stroke();
      paintThroughMask(ctx, base, effect.canvas, mask.canvas, scratch);
    },
  };
}

/** Replays a recorded blur/pixelate stroke onto a copy of `source`, for every frame at once. */
export function applyEffectAlongStroke(
  source: ImageData,
  points: Point[],
  options: EffectStrokeOptions,
): ImageData {
  if (points.length === 0) return source;
  const { width, height } = source;
  const target = createLayer(width, height);
  const mask = createLayer(width, height);
  beginMaskStroke(mask.ctx, points[0].x, points[0].y, options.size);
  for (const point of points.slice(1)) mask.ctx.lineTo(point.x, point.y);
  mask.ctx.stroke();

  const effect = layerFrom(renderEffect(source, options));
  paintThroughMask(target.ctx, source, effect.canvas, mask.canvas, createLayer(width, height));
  return target.ctx.getImageData(0, 0, width, height);
}

function beginMaskStroke(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = size;
  ctx.strokeStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(x, y);
  // Draw a dot immediately so a tap-without-drag still leaves a mark.
  ctx.lineTo(x + 0.01, y + 0.01);
  ctx.stroke();
}

/** Renders `base` into `target` with `effect` showing through wherever `mask` is painted. */
function paintThroughMask(
  target: CanvasRenderingContext2D,
  base: ImageData,
  effect: HTMLCanvasElement,
  mask: HTMLCanvasElement,
  scratch: Layer,
) {
  const { width, height } = base;
  scratch.ctx.globalCompositeOperation = "source-over";
  scratch.ctx.clearRect(0, 0, width, height);
  scratch.ctx.drawImage(effect, 0, 0);
  scratch.ctx.globalCompositeOperation = "destination-in";
  scratch.ctx.drawImage(mask, 0, 0);

  // Punch the stroke out of the original before laying the effect in, so the effect
  // replaces those pixels outright — including their alpha, which matters when the
  // brush crosses a sticker's transparent edge.
  target.globalCompositeOperation = "source-over";
  target.putImageData(base, 0, 0);
  target.globalCompositeOperation = "destination-out";
  target.drawImage(mask, 0, 0);
  target.globalCompositeOperation = "source-over";
  target.drawImage(scratch.canvas, 0, 0);
}

function renderEffect(source: ImageData, options: EffectOptions): ImageData {
  return options.mode === "pixelate"
    ? pixelateImageData(source, options.strength)
    : blurImageData(source, options.strength);
}

/**
 * Separable box blur, run three times to approximate a Gaussian. Hand-rolled rather
 * than `ctx.filter` for predictable results across browsers, and cheap enough at
 * sticker sizes: the running-sum passes are O(pixels), independent of the radius.
 */
export function blurImageData(source: ImageData, radius: number): ImageData {
  const { width, height } = source;
  const r = Math.max(0, Math.round(radius));
  if (r === 0) return new ImageData(new Uint8ClampedArray(source.data), width, height);

  // Premultiplied, so fully transparent pixels can't bleed their (usually black)
  // colour into the visible edges of the sticker.
  const front = premultiply(source);
  const back = new Float32Array(front.length);
  for (let pass = 0; pass < 3; pass++) {
    boxBlurAxis(front, back, width, height, r, true);
    boxBlurAxis(back, front, width, height, r, false);
  }
  return unpremultiply(front, width, height);
}

/** Averages each `blockSize` square into a single colour — a mosaic censor. */
export function pixelateImageData(source: ImageData, blockSize: number): ImageData {
  const { width, height } = source;
  const size = Math.max(2, Math.round(blockSize));
  const src = source.data;
  const out = new Uint8ClampedArray(src.length);

  for (let blockY = 0; blockY < height; blockY += size) {
    const endY = Math.min(blockY + size, height);
    for (let blockX = 0; blockX < width; blockX += size) {
      const endX = Math.min(blockX + size, width);
      let r = 0;
      let g = 0;
      let b = 0;
      let alphaSum = 0;
      let count = 0;

      for (let y = blockY; y < endY; y++) {
        for (let x = blockX; x < endX; x++) {
          const i = (y * width + x) * 4;
          const a = src[i + 3] / 255;
          r += src[i] * a;
          g += src[i + 1] * a;
          b += src[i + 2] * a;
          alphaSum += src[i + 3];
          count++;
        }
      }

      const alpha = alphaSum / count;
      // Undo the premultiplied weighting: (sum / count) / (alpha / 255).
      const scale = alpha > 0 ? 255 / (alpha * count) : 0;
      for (let y = blockY; y < endY; y++) {
        for (let x = blockX; x < endX; x++) {
          const i = (y * width + x) * 4;
          out[i] = r * scale;
          out[i + 1] = g * scale;
          out[i + 2] = b * scale;
          out[i + 3] = alpha;
        }
      }
    }
  }
  return new ImageData(out, width, height);
}

/** One box-blur pass along a single axis, using a sliding window sum with clamped edges. */
function boxBlurAxis(
  src: Float32Array,
  dst: Float32Array,
  width: number,
  height: number,
  radius: number,
  horizontal: boolean,
) {
  const lineCount = horizontal ? height : width;
  const lineLength = horizontal ? width : height;
  const lineStride = (horizontal ? width : 1) * 4;
  const stepStride = (horizontal ? 1 : width) * 4;
  const windowSize = radius * 2 + 1;

  for (let line = 0; line < lineCount; line++) {
    const lineStart = line * lineStride;
    for (let channel = 0; channel < 4; channel++) {
      let sum = 0;
      for (let i = -radius; i <= radius; i++) {
        sum += src[lineStart + clampIndex(i, lineLength) * stepStride + channel];
      }
      for (let i = 0; i < lineLength; i++) {
        dst[lineStart + i * stepStride + channel] = sum / windowSize;
        sum += src[lineStart + clampIndex(i + radius + 1, lineLength) * stepStride + channel];
        sum -= src[lineStart + clampIndex(i - radius, lineLength) * stepStride + channel];
      }
    }
  }
}

function premultiply(source: ImageData): Float32Array {
  const src = source.data;
  const out = new Float32Array(src.length);
  for (let i = 0; i < src.length; i += 4) {
    const a = src[i + 3] / 255;
    out[i] = src[i] * a;
    out[i + 1] = src[i + 1] * a;
    out[i + 2] = src[i + 2] * a;
    out[i + 3] = src[i + 3];
  }
  return out;
}

function unpremultiply(buffer: Float32Array, width: number, height: number): ImageData {
  const out = new Uint8ClampedArray(buffer.length);
  for (let i = 0; i < buffer.length; i += 4) {
    const alpha = buffer[i + 3];
    if (alpha > 0) {
      const a = alpha / 255;
      out[i] = buffer[i] / a;
      out[i + 1] = buffer[i + 1] / a;
      out[i + 2] = buffer[i + 2] / a;
    }
    out[i + 3] = alpha;
  }
  return new ImageData(out, width, height);
}

type Layer = { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D };

function createLayer(width: number, height: number): Layer {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  return { canvas, ctx };
}

function layerFrom(imageData: ImageData): Layer {
  const layer = createLayer(imageData.width, imageData.height);
  layer.ctx.putImageData(imageData, 0, 0);
  return layer;
}

function clampIndex(value: number, length: number) {
  return Math.min(length - 1, Math.max(0, value));
}
