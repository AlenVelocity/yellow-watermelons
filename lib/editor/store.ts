import { create } from "zustand";
import type { EffectMode } from "@/lib/editor/tools/effects";
import type { Selection } from "@/lib/editor/tools/selection";
import type { ShapeKind } from "@/lib/editor/tools/shapes";
import { createTextDraft, type TextDraft } from "@/lib/editor/tools/text";

export type SourceFormat = "png" | "jpeg" | "webp" | "apng" | "webp-animated";

export type Frame = {
  imageData: ImageData;
  duration: number;
};

export type EditorDocument = {
  width: number;
  height: number;
  frames: Frame[];
  format: SourceFormat;
  fileName: string;
};

export type Tool =
  | "recolor"
  | "eyedropper"
  | "brush"
  | "eraser"
  | "blur"
  | "text"
  | "shape"
  | "crop"
  | "select";
export type SelectMode = "rect" | "freehand";

export type CropRect = { x: number; y: number; width: number; height: number };

interface EditorState {
  document: EditorDocument | null;
  activeFrameIndex: number;
  activeTool: Tool;
  isRecolorPanelOpen: boolean;
  brushColor: string;
  brushSize: number;
  // Whole-document snapshots. Stickers are small, so this is cheap and — unlike a
  // per-frame diff stack — handles dimension-changing edits (crop) for free.
  undoStack: EditorDocument[];
  redoStack: EditorDocument[];
  /** Uncommitted recolor preview shown instead of the active frame's real pixels. */
  previewImageData: ImageData | null;
  /** RGBA sampled by the eyedropper tool, consumed by whichever panel requested it. */
  pickedColor: [number, number, number, number] | null;
  /** Rect (image pixel space) awaiting confirm/cancel from the crop tool. */
  pendingCropRect: CropRect | null;
  /** Which drag shape the select tool draws. */
  selectMode: SelectMode;
  /** Whether the blur tool softens or mosaics the pixels it paints over. */
  effectMode: EffectMode;
  /** Blur radius / mosaic block size, in image pixels. */
  effectStrength: number;
  /** Which figure the shape tool draws on drag. */
  shapeKind: ShapeKind;
  /** Whether closed shapes are filled instead of outlined. */
  shapeFilled: boolean;
  /** Caption being positioned and styled, before it is baked into the frame. */
  textDraft: TextDraft | null;
  /** Scopes the recolor tool to part of the image, e.g. one of two watermelons on the same sticker. */
  selection: Selection | null;

  loadDocument: (doc: EditorDocument) => void;
  closeDocument: () => void;
  setActiveFrame: (index: number) => void;
  setActiveTool: (tool: Tool) => void;
  setRecolorPanelOpen: (open: boolean) => void;
  setBrushColor: (color: string) => void;
  setBrushSize: (size: number) => void;
  setPreview: (imageData: ImageData | null) => void;
  setPickedColor: (color: [number, number, number, number] | null) => void;
  setPendingCropRect: (rect: CropRect | null) => void;
  setSelectMode: (mode: SelectMode) => void;
  setSelection: (selection: Selection | null) => void;
  setEffectMode: (mode: EffectMode) => void;
  setEffectStrength: (strength: number) => void;
  setShapeKind: (kind: ShapeKind) => void;
  setShapeFilled: (filled: boolean) => void;
  updateTextDraft: (patch: Partial<TextDraft>) => void;
  /** Push the current document to undo history, then replace it with `next`. */
  commitDocument: (next: EditorDocument) => void;
  commitFrame: (frameIndex: number, imageData: ImageData) => void;
  commitAllFrames: (imageDatas: ImageData[]) => void;
  undo: () => void;
  redo: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  document: null,
  activeFrameIndex: 0,
  activeTool: "recolor",
  isRecolorPanelOpen: false,
  brushColor: "#facc15",
  brushSize: 12,
  undoStack: [],
  redoStack: [],
  previewImageData: null,
  pickedColor: null,
  pendingCropRect: null,
  selectMode: "rect",
  selection: null,
  effectMode: "blur",
  effectStrength: 10,
  shapeKind: "arrow",
  shapeFilled: false,
  textDraft: null,

  loadDocument: (doc) =>
    set({
      document: doc,
      activeFrameIndex: 0,
      undoStack: [],
      redoStack: [],
      previewImageData: null,
      pickedColor: null,
      pendingCropRect: null,
      selection: null,
      textDraft: null,
      isRecolorPanelOpen: true,
      activeTool: "recolor",
    }),

  closeDocument: () =>
    set({
      document: null,
      undoStack: [],
      redoStack: [],
      previewImageData: null,
      pickedColor: null,
      pendingCropRect: null,
      selection: null,
      textDraft: null,
      isRecolorPanelOpen: false,
    }),

  setActiveFrame: (index) => set({ activeFrameIndex: index, previewImageData: null }),

  setActiveTool: (tool) => {
    const doc = get().document;
    set({
      activeTool: tool,
      isRecolorPanelOpen: tool === "recolor",
      pendingCropRect: null,
      // Every other tool works on the committed pixels, so a recolor preview must not
      // outlive the panel that produced it.
      previewImageData: tool === "recolor" ? get().previewImageData : null,
      textDraft:
        tool !== "text"
          ? null
          : (get().textDraft ?? (doc ? createTextDraft(doc.width, doc.height) : null)),
    });
  },

  setRecolorPanelOpen: (open) =>
    set({ isRecolorPanelOpen: open, previewImageData: open ? get().previewImageData : null }),

  setBrushColor: (color) => set({ brushColor: color }),

  setBrushSize: (size) => set({ brushSize: size }),

  setPreview: (imageData) => set({ previewImageData: imageData }),

  setPickedColor: (color) => set({ pickedColor: color }),

  setPendingCropRect: (rect) => set({ pendingCropRect: rect }),

  setSelectMode: (mode) => set({ selectMode: mode }),

  setSelection: (selection) => set({ selection }),

  setEffectMode: (mode) => set({ effectMode: mode }),

  setEffectStrength: (strength) => set({ effectStrength: strength }),

  setShapeKind: (kind) => set({ shapeKind: kind }),

  setShapeFilled: (filled) => set({ shapeFilled: filled }),

  updateTextDraft: (patch) => {
    const draft = get().textDraft;
    if (!draft) return;
    set({ textDraft: { ...draft, ...patch } });
  },

  commitDocument: (next) => {
    const doc = get().document;
    if (!doc) return;
    const dimensionsChanged = next.width !== doc.width || next.height !== doc.height;
    set({
      document: next,
      undoStack: [...get().undoStack, doc],
      redoStack: [],
      previewImageData: null,
      // A selection mask is sized to the old dimensions and stops making sense after a crop.
      selection: dimensionsChanged ? null : get().selection,
    });
  },

  commitFrame: (frameIndex, imageData) => {
    const doc = get().document;
    if (!doc || !doc.frames[frameIndex]) return;
    const nextFrames = doc.frames.slice();
    nextFrames[frameIndex] = { ...nextFrames[frameIndex], imageData };
    get().commitDocument({ ...doc, frames: nextFrames });
  },

  commitAllFrames: (imageDatas) => {
    const doc = get().document;
    if (!doc || imageDatas.length !== doc.frames.length) return;
    get().commitDocument({
      ...doc,
      frames: doc.frames.map((f, i) => ({ ...f, imageData: imageDatas[i] })),
    });
  },

  undo: () => {
    const { undoStack, document: doc } = get();
    if (undoStack.length === 0 || !doc) return;
    const previous = undoStack[undoStack.length - 1];
    set({
      document: previous,
      activeFrameIndex: Math.min(get().activeFrameIndex, previous.frames.length - 1),
      undoStack: undoStack.slice(0, -1),
      redoStack: [...get().redoStack, doc],
      previewImageData: null,
    });
  },

  redo: () => {
    const { redoStack, document: doc } = get();
    if (redoStack.length === 0 || !doc) return;
    const next = redoStack[redoStack.length - 1];
    set({
      document: next,
      activeFrameIndex: Math.min(get().activeFrameIndex, next.frames.length - 1),
      redoStack: redoStack.slice(0, -1),
      undoStack: [...get().undoStack, doc],
      previewImageData: null,
    });
  },
}));
