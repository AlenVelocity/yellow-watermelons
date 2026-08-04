export type RecolorOptions = {
  /** Source hue to target, in degrees [0, 360). */
  sourceHue: number;
  /** How far from sourceHue (in degrees) still counts as a match. */
  tolerance: number;
  /** Hue to rotate matched pixels to, in degrees [0, 360). */
  targetHue: number;
  /** Width of the soft blend zone at the edge of the tolerance band, in degrees. */
  feather: number;
  /** Ignore near-white/near-black/near-gray pixels (very low saturation) so backgrounds don't shift. */
  minSaturation?: number;
  /** Restrict the effect to a selection mask (rect or freehand) — e.g. one of two watermelons on the same sticker. */
  selection?: { data: Uint8Array };
};

export const RED_TO_YELLOW: Pick<
  RecolorOptions,
  "sourceHue" | "tolerance" | "targetHue" | "feather"
> = {
  sourceHue: 0,
  tolerance: 28,
  targetHue: 52,
  feather: 12,
};

/** Hue in degrees [0, 360) for a color, for eyedropper/UI display. */
export function rgbToHue(r: number, g: number, b: number): number {
  const [h] = rgbToHsl(r / 255, g / 255, b / 255);
  return h;
}

/** Mutates `data` (RGBA, e.g. from ImageData) in place, hue-shifting pixels near sourceHue to targetHue. */
export function recolorPixels(data: Uint8ClampedArray, options: RecolorOptions): void {
  const { sourceHue, tolerance, targetHue, feather, minSaturation = 0.12, selection } = options;

  for (let i = 0; i < data.length; i += 4) {
    if (selection && !selection.data[i / 4]) continue;

    const a = data[i + 3];
    if (a === 0) continue;

    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    const [h, s, l] = rgbToHsl(r, g, b);

    if (s < minSaturation) continue;

    const dist = hueDistance(h, sourceHue);
    if (dist > tolerance + feather) continue;

    // 1 inside the tolerance band, fading to 0 across the feather zone.
    const weight = dist <= tolerance ? 1 : 1 - (dist - tolerance) / feather;

    const shiftedHue = blendHue(h, targetHue, weight);
    const [nr, ng, nb] = hslToRgb(shiftedHue, s, l);

    data[i] = Math.round(nr * 255);
    data[i + 1] = Math.round(ng * 255);
    data[i + 2] = Math.round(nb * 255);
  }
}

export function recolorImageData(imageData: ImageData, options: RecolorOptions): ImageData {
  const out = new ImageData(
    new Uint8ClampedArray(imageData.data),
    imageData.width,
    imageData.height,
  );
  recolorPixels(out.data, options);
  return out;
}

/** Shortest angular distance between two hues, both in degrees, handling the 0/360 wraparound. */
function hueDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

/** Rotate hue `h` toward `target` by `weight` (0..1), taking the shorter way around the circle. */
function blendHue(h: number, target: number, weight: number): number {
  let diff = target - h;
  diff = ((diff + 180) % 360 + 360) % 360 - 180;
  return (h + diff * weight + 360) % 360;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) return [0, 0, l];

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h: number;
  switch (max) {
    case r:
      h = (g - b) / d + (g < b ? 6 : 0);
      break;
    case g:
      h = (b - r) / d + 2;
      break;
    default:
      h = (r - g) / d + 4;
  }
  return [h * 60, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l, l, l];

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hk = h / 360;

  const r = hueToRgb(p, q, hk + 1 / 3);
  const g = hueToRgb(p, q, hk);
  const b = hueToRgb(p, q, hk - 1 / 3);
  return [r, g, b];
}

function hueToRgb(p: number, q: number, t: number): number {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
}
