"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useEditorStore, type Frame, type EditorDocument } from "@/lib/editor/store";
import { cn } from "@/lib/utils";

export function FrameStrip() {
  const doc = useEditorStore((s) => s.document);
  const activeFrameIndex = useEditorStore((s) => s.activeFrameIndex);
  const setActiveFrame = useEditorStore((s) => s.setActiveFrame);
  const commitDocument = useEditorStore((s) => s.commitDocument);

  if (!doc || doc.frames.length <= 1) return null;

  function handleDelete(index: number) {
    const current = doc as EditorDocument;
    if (current.frames.length <= 1) return;
    const nextFrames = current.frames.filter((_, i) => i !== index);
    commitDocument({ ...current, frames: nextFrames });
    if (activeFrameIndex >= nextFrames.length) setActiveFrame(nextFrames.length - 1);
  }

  return (
    <div className="flex gap-2 overflow-x-auto border-t border-border bg-card px-3 py-2">
      {doc.frames.map((frame, i) => (
        <FrameThumb
          key={i}
          frame={frame}
          active={i === activeFrameIndex}
          onSelect={() => setActiveFrame(i)}
          onDelete={() => handleDelete(i)}
        />
      ))}
    </div>
  );
}

function FrameThumb({
  frame,
  active,
  onSelect,
  onDelete,
}: {
  frame: Frame;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = frame.imageData.width;
    canvas.height = frame.imageData.height;
    canvas.getContext("2d")?.putImageData(frame.imageData, 0, 0);
  }, [frame.imageData]);

  return (
    <div className="relative flex shrink-0 flex-col items-center gap-0.5">
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "h-14 w-14 overflow-hidden rounded-lg border-2 bg-[conic-gradient(#27272a_25%,#18181b_0_50%,#27272a_0_75%,#18181b_0)] bg-[length:10px_10px]",
          active ? "border-primary" : "border-border",
        )}
      >
        <canvas ref={canvasRef} className="h-full w-full object-contain" />
      </button>
      <span className="text-[10px] text-muted-foreground">{Math.round(frame.duration)}ms</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        aria-label="Delete frame"
        className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
      >
        <X size={10} strokeWidth={2.5} />
      </button>
    </div>
  );
}
