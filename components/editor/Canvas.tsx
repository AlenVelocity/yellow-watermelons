"use client";

import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "@/lib/editor/store";
import { beginStroke, continueStroke, endStroke } from "@/lib/editor/tools/paint";
import { rectToMask, polygonToMask, type Point, type Rect } from "@/lib/editor/tools/selection";

const MIN_ZOOM = 1;
const MAX_ZOOM = 6;
// Minimum image-space distance between consecutive freehand points, to keep the
// path/mask cheap at high zoom without visibly affecting the traced shape.
const FREEHAND_MIN_STEP = 1.5;

type LiveSelection = { shape: "rect"; rect: Rect } | { shape: "freehand"; points: Point[] };

export function Canvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fitSize, setFitSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [liveSelection, setLiveSelection] = useState<LiveSelection | null>(null);

  const doc = useEditorStore((s) => s.document);
  const activeFrameIndex = useEditorStore((s) => s.activeFrameIndex);
  const activeTool = useEditorStore((s) => s.activeTool);
  const selectMode = useEditorStore((s) => s.selectMode);
  const brushColor = useEditorStore((s) => s.brushColor);
  const brushSize = useEditorStore((s) => s.brushSize);
  const previewImageData = useEditorStore((s) => s.previewImageData);
  const pendingCropRect = useEditorStore((s) => s.pendingCropRect);
  const selection = useEditorStore((s) => s.selection);
  const setPickedColor = useEditorStore((s) => s.setPickedColor);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);
  const setPendingCropRect = useEditorStore((s) => s.setPendingCropRect);
  const setSelection = useEditorStore((s) => s.setSelection);
  const commitFrame = useEditorStore((s) => s.commitFrame);

  const frame = doc?.frames[activeFrameIndex] ?? null;
  const renderedData = previewImageData ?? frame?.imageData ?? null;

  // Gesture bookkeeping — refs so pointer handlers don't need to be redefined every render.
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{ dist: number; midX: number; midY: number } | null>(null);
  const isDrawingRef = useRef(false);
  const cropStartRef = useRef<{ x: number; y: number } | null>(null);
  const selectRectStartRef = useRef<{ x: number; y: number } | null>(null);
  const freehandPointsRef = useRef<Point[]>([]);
  // Mirrors `liveSelection` synchronously — reading it (instead of the state
  // variable) in finalizeSelection avoids stale-closure reads when several
  // pointermove events fire in the same synchronous batch (fast drags).
  const liveSelectionRef = useRef<LiveSelection | null>(null);

  function updateLiveSelection(next: LiveSelection | null) {
    liveSelectionRef.current = next;
    setLiveSelection(next);
  }

  // Backing canvas stays at native image resolution; CSS handles the on-screen scale.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !renderedData) return;
    canvas.width = renderedData.width;
    canvas.height = renderedData.height;
    const ctx = canvas.getContext("2d");
    ctx?.putImageData(renderedData, 0, 0);
  }, [renderedData]);

  // Fit the canvas into the available space, preserving aspect ratio.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !doc) return;

    const compute = () => {
      const rect = container.getBoundingClientRect();
      const padding = 24;
      const availW = Math.max(rect.width - padding * 2, 1);
      const availH = Math.max(rect.height - padding * 2, 1);
      const scale = Math.min(availW / doc.width, availH / doc.height, 6);
      setFitSize({
        width: Math.round(doc.width * scale),
        height: Math.round(doc.height * scale),
      });
    };

    compute();
    const observer = new ResizeObserver(compute);
    observer.observe(container);
    return () => observer.disconnect();
  }, [doc]);

  // Reset the view whenever a different document loads (React-recommended
  // "adjust state during render" pattern — avoids an extra effect-driven render).
  const docKey = doc ? `${doc.fileName}:${doc.width}x${doc.height}` : null;
  const lastDocKeyRef = useRef(docKey);
  if (docKey !== lastDocKeyRef.current) {
    lastDocKeyRef.current = docKey;
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  function imageCoordsFromClient(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;
    return { x, y };
  }

  function finalizeSelection() {
    if (!doc) return;
    const current = liveSelectionRef.current;
    if (current?.shape === "rect") {
      const { rect } = current;
      if (rect.width > 2 && rect.height > 2) {
        const data = rectToMask(rect, doc.width, doc.height);
        setSelection({ shape: "rect", width: doc.width, height: doc.height, data, rect });
      }
    } else if (current?.shape === "freehand") {
      const points = current.points;
      if (points.length >= 3) {
        const data = polygonToMask(points, doc.width, doc.height);
        setSelection({ shape: "freehand", width: doc.width, height: doc.height, data, points });
      }
    }
    updateLiveSelection(null);
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2) {
      // Second finger down — switch to pinch mode, abandon any single-finger stroke.
      isDrawingRef.current = false;
      cropStartRef.current = null;
      selectRectStartRef.current = null;
      freehandPointsRef.current = [];
      updateLiveSelection(null);
      pinchRef.current = computePinchState(pointersRef.current);
      return;
    }
    if (pointersRef.current.size > 2) return;

    const coords = imageCoordsFromClient(e.clientX, e.clientY);
    if (!coords) return;

    if (activeTool === "eyedropper") {
      const ctx = canvas.getContext("2d");
      const x = clamp(Math.floor(coords.x), 0, canvas.width - 1);
      const y = clamp(Math.floor(coords.y), 0, canvas.height - 1);
      const px = ctx?.getImageData(x, y, 1, 1).data;
      if (px) setPickedColor([px[0], px[1], px[2], px[3]]);
      setActiveTool("recolor");
      return;
    }

    if (activeTool === "brush" || activeTool === "eraser") {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      isDrawingRef.current = true;
      beginStroke(ctx, coords.x, coords.y, {
        size: brushSize,
        color: brushColor,
        mode: activeTool,
      });
      return;
    }

    if (activeTool === "crop") {
      cropStartRef.current = coords;
      setPendingCropRect({ x: coords.x, y: coords.y, width: 0, height: 0 });
      return;
    }

    if (activeTool === "select") {
      if (selectMode === "rect") {
        selectRectStartRef.current = coords;
        updateLiveSelection({ shape: "rect", rect: { x: coords.x, y: coords.y, width: 0, height: 0 } });
      } else {
        freehandPointsRef.current = [coords];
        updateLiveSelection({ shape: "freehand", points: [coords] });
      }
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2 && pinchRef.current) {
      const next = computePinchState(pointersRef.current);
      const prev = pinchRef.current;
      const scaleDelta = next.dist / prev.dist;
      setZoom((z) => clamp(z * scaleDelta, MIN_ZOOM, MAX_ZOOM));
      setPan((p) => ({ x: p.x + (next.midX - prev.midX), y: p.y + (next.midY - prev.midY) }));
      pinchRef.current = next;
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const coords = imageCoordsFromClient(e.clientX, e.clientY);
    if (!coords) return;

    if (isDrawingRef.current && (activeTool === "brush" || activeTool === "eraser")) {
      const ctx = canvas.getContext("2d");
      if (ctx) continueStroke(ctx, coords.x, coords.y);
      return;
    }

    if (activeTool === "crop" && cropStartRef.current) {
      const start = cropStartRef.current;
      setPendingCropRect({
        x: Math.min(start.x, coords.x),
        y: Math.min(start.y, coords.y),
        width: Math.abs(coords.x - start.x),
        height: Math.abs(coords.y - start.y),
      });
      return;
    }

    if (activeTool === "select" && selectMode === "rect" && selectRectStartRef.current) {
      const start = selectRectStartRef.current;
      updateLiveSelection({
        shape: "rect",
        rect: {
          x: Math.min(start.x, coords.x),
          y: Math.min(start.y, coords.y),
          width: Math.abs(coords.x - start.x),
          height: Math.abs(coords.y - start.y),
        },
      });
      return;
    }

    if (activeTool === "select" && selectMode === "freehand" && freehandPointsRef.current.length > 0) {
      const points = freehandPointsRef.current;
      const last = points[points.length - 1];
      if (Math.hypot(coords.x - last.x, coords.y - last.y) >= FREEHAND_MIN_STEP) {
        points.push(coords);
        updateLiveSelection({ shape: "freehand", points: [...points] });
      }
    }
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;

    if (isDrawingRef.current && pointersRef.current.size === 0) {
      isDrawingRef.current = false;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) {
        endStroke(ctx);
        commitFrame(activeFrameIndex, ctx.getImageData(0, 0, canvas.width, canvas.height));
      }
    }

    if (activeTool === "select" && pointersRef.current.size === 0) {
      finalizeSelection();
    }

    if (pointersRef.current.size === 0) {
      cropStartRef.current = null;
      selectRectStartRef.current = null;
      freehandPointsRef.current = [];
    }
  }

  const displaySelection: LiveSelection | null =
    liveSelection ??
    (selection
      ? selection.shape === "rect"
        ? { shape: "rect", rect: selection.rect }
        : { shape: "freehand", points: selection.points }
      : null);

  return (
    <div ref={containerRef} className="flex h-full w-full items-center justify-center">
      {doc && renderedData && (
        <div
          style={{
            position: "relative",
            display: "inline-block",
            lineHeight: 0,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center center",
          }}
        >
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
              width: fitSize.width,
              height: fitSize.height,
              touchAction: "none",
              cursor: activeTool === "eyedropper" ? "crosshair" : "default",
            }}
            className="rounded-xl bg-[conic-gradient(#27272a_25%,#18181b_0_50%,#27272a_0_75%,#18181b_0)] bg-[length:20px_20px] shadow-lg"
          />
          {pendingCropRect && fitSize.width > 0 && (
            <div
              className="pointer-events-none absolute rounded-sm border-2 border-primary bg-primary/10"
              style={{
                left: (pendingCropRect.x / doc.width) * fitSize.width,
                top: (pendingCropRect.y / doc.height) * fitSize.height,
                width: (pendingCropRect.width / doc.width) * fitSize.width,
                height: (pendingCropRect.height / doc.height) * fitSize.height,
              }}
            />
          )}
          {displaySelection?.shape === "rect" && fitSize.width > 0 && (
            <div
              className="pointer-events-none absolute rounded-sm border-2 border-dashed border-accent bg-accent/10"
              style={{
                left: (displaySelection.rect.x / doc.width) * fitSize.width,
                top: (displaySelection.rect.y / doc.height) * fitSize.height,
                width: (displaySelection.rect.width / doc.width) * fitSize.width,
                height: (displaySelection.rect.height / doc.height) * fitSize.height,
              }}
            />
          )}
          {displaySelection?.shape === "freehand" && fitSize.width > 0 && (
            <svg
              className="pointer-events-none absolute left-0 top-0"
              width={fitSize.width}
              height={fitSize.height}
              viewBox={`0 0 ${fitSize.width} ${fitSize.height}`}
            >
              <polygon
                points={displaySelection.points
                  .map((p) => `${(p.x / doc.width) * fitSize.width},${(p.y / doc.height) * fitSize.height}`)
                  .join(" ")}
                fill="var(--accent)"
                fillOpacity={0.15}
                stroke="var(--accent)"
                strokeWidth={2}
                strokeDasharray="6 4"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
      )}
    </div>
  );
}

function computePinchState(pointers: Map<number, { x: number; y: number }>) {
  const [a, b] = Array.from(pointers.values());
  return {
    dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
    midX: (a.x + b.x) / 2,
    midY: (a.y + b.y) / 2,
  };
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}
