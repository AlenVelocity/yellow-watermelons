"use client";

import { LassoSelect, Square } from "lucide-react";
import { useEditorStore } from "@/lib/editor/store";
import { cropDocument } from "@/lib/editor/tools/crop";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ToolOptionsBar() {
  const activeTool = useEditorStore((s) => s.activeTool);
  const doc = useEditorStore((s) => s.document);
  const brushColor = useEditorStore((s) => s.brushColor);
  const brushSize = useEditorStore((s) => s.brushSize);
  const setBrushColor = useEditorStore((s) => s.setBrushColor);
  const setBrushSize = useEditorStore((s) => s.setBrushSize);
  const pendingCropRect = useEditorStore((s) => s.pendingCropRect);
  const setPendingCropRect = useEditorStore((s) => s.setPendingCropRect);
  const selection = useEditorStore((s) => s.selection);
  const setSelection = useEditorStore((s) => s.setSelection);
  const selectMode = useEditorStore((s) => s.selectMode);
  const setSelectMode = useEditorStore((s) => s.setSelectMode);
  const commitDocument = useEditorStore((s) => s.commitDocument);

  if (!doc) return null;

  if (activeTool === "brush" || activeTool === "eraser") {
    return (
      <div className="flex items-center gap-3 border-t border-border bg-card px-4 py-3">
        {activeTool === "brush" && (
          <input
            type="color"
            value={brushColor}
            onChange={(e) => setBrushColor(e.target.value)}
            className="h-9 w-9 shrink-0 rounded-lg border border-border bg-transparent"
            aria-label="Brush color"
          />
        )}
        <span className="shrink-0 text-xs text-muted-foreground">Size</span>
        <input
          type="range"
          min={2}
          max={64}
          value={brushSize}
          onChange={(e) => setBrushSize(Number(e.target.value))}
          className="h-8 flex-1 touch-none accent-[var(--primary)]"
        />
        <span className="w-8 shrink-0 text-right text-xs text-muted-foreground">{brushSize}px</span>
      </div>
    );
  }

  if (activeTool === "crop") {
    const hasRect = !!pendingCropRect && pendingCropRect.width > 2 && pendingCropRect.height > 2;
    return (
      <div className="flex items-center gap-2 border-t border-border bg-card px-4 py-3">
        <span className="flex-1 text-sm text-muted-foreground">
          {hasRect ? "Drag to adjust, then crop." : "Drag on the image to crop."}
        </span>
        <Button variant="secondary" size="sm" disabled={!hasRect} onClick={() => setPendingCropRect(null)}>
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={!hasRect}
          onClick={() => {
            if (!pendingCropRect) return;
            commitDocument(cropDocument(doc, pendingCropRect));
            setPendingCropRect(null);
          }}
        >
          Crop
        </Button>
      </div>
    );
  }

  if (activeTool === "select") {
    return (
      <div className="flex items-center gap-2 border-t border-border bg-card px-4 py-3">
        <div className="flex shrink-0 gap-1 rounded-lg bg-muted p-0.5">
          <button
            type="button"
            onClick={() => setSelectMode("rect")}
            className={cn(
              "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground",
              selectMode === "rect" && "bg-card text-foreground",
            )}
          >
            <Square size={13} />
            Box
          </button>
          <button
            type="button"
            onClick={() => setSelectMode("freehand")}
            className={cn(
              "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground",
              selectMode === "freehand" && "bg-card text-foreground",
            )}
          >
            <LassoSelect size={13} />
            Freehand
          </button>
        </div>
        <span className="flex-1 text-sm text-muted-foreground">
          {selection ? "Recolor is scoped to this area." : "Draw around the part to recolor."}
        </span>
        <Button variant="secondary" size="sm" disabled={!selection} onClick={() => setSelection(null)}>
          Clear
        </Button>
      </div>
    );
  }

  return null;
}
