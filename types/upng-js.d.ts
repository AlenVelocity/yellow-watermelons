declare module "upng-js" {
  interface UpngFrame {
    rect: { x: number; y: number; width: number; height: number };
    delay: number;
    dispose: number;
    blend: number;
    data?: Uint8Array;
  }

  interface UpngImage {
    width: number;
    height: number;
    depth: number;
    ctype: number;
    frames: UpngFrame[];
    tabs: Record<string, unknown>;
    data: Uint8Array;
  }

  const UPNG: {
    decode(buffer: ArrayBuffer): UpngImage;
    toRGBA8(img: UpngImage): ArrayBuffer[];
    encode(imgs: ArrayBuffer[], w: number, h: number, cnum: number, dels?: number[]): ArrayBuffer;
  };

  export default UPNG;
}
