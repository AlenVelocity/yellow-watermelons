export type DetectedFormat =
  | { kind: "png"; animated: boolean }
  | { kind: "webp"; animated: boolean }
  | { kind: "jpeg"; animated: false }
  | { kind: "unknown"; animated: false };

export async function detectFormat(file: File): Promise<DetectedFormat> {
  const head = new Uint8Array(await file.slice(0, 32).arrayBuffer());

  if (isPngSignature(head)) {
    return { kind: "png", animated: await isAnimatedPng(file) };
  }
  if (isJpegSignature(head)) {
    return { kind: "jpeg", animated: false };
  }
  if (isWebpSignature(head)) {
    return { kind: "webp", animated: isAnimatedWebpHeader(head) };
  }
  return { kind: "unknown", animated: false };
}

function isPngSignature(bytes: Uint8Array): boolean {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  return sig.every((b, i) => bytes[i] === b);
}

function isJpegSignature(bytes: Uint8Array): boolean {
  return bytes[0] === 0xff && bytes[1] === 0xd8;
}

function isWebpSignature(bytes: Uint8Array): boolean {
  return (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 && // "RIFF"
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50 // "WEBP"
  );
}

/** A VP8X chunk right after the RIFF/WEBP header carries an ANIM flag bit for animated WebP. */
function isAnimatedWebpHeader(bytes: Uint8Array): boolean {
  const hasVp8x =
    bytes[12] === 0x56 && bytes[13] === 0x50 && bytes[14] === 0x38 && bytes[15] === 0x58; // "VP8X"
  if (!hasVp8x) return false;
  const flags = bytes[20];
  return (flags & 0x02) !== 0;
}

/** An APNG must have an acTL chunk before the first IDAT chunk. */
async function isAnimatedPng(file: File): Promise<boolean> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let offset = 8; // skip the 8-byte PNG signature
  while (offset + 8 <= buf.length) {
    const length = readUint32BE(buf, offset);
    const type = String.fromCharCode(
      buf[offset + 4],
      buf[offset + 5],
      buf[offset + 6],
      buf[offset + 7],
    );
    if (type === "acTL") return true;
    if (type === "IDAT") return false;
    offset += 8 + length + 4; // length field + type + data + crc
  }
  return false;
}

function readUint32BE(buf: Uint8Array, offset: number): number {
  return (
    ((buf[offset] << 24) | (buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3]) >>>
    0
  );
}
