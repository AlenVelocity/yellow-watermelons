"use client";

import { useState, type ReactNode } from "react";
import {
  Bold,
  Circle,
  Droplet,
  Grid2x2,
  LassoSelect,
  Minus,
  MoveUpRight,
  Square,
} from "lucide-react";
import { useEditorStore } from "@/lib/editor/store";
import { cropDocument } from "@/lib/editor/tools/crop";
import { applyEffect } from "@/lib/editor/tools/effects";
import { isFillable } from "@/lib/editor/tools/shapes";
import { renderTextToImageData, TEXT_FONTS } from "@/lib/editor/tools/text";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ToolOptionsBar() {
  const activeTool = useEditorStore((s) => s.activeTool);
  const doc = useEditorStore((s) => s.document);
  const activeFrameIndex = useEditorStore((s) => s.activeFrameIndex);
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
  const effectMode = useEditorStore((s) => s.effectMode);
  const setEffectMode = useEditorStore((s) => s.setEffectMode);
  const effectStrength = useEditorStore((s) => s.effectStrength);
  const setEffectStrength = useEditorStore((s) => s.setEffectStrength);
  const shapeKind = useEditorStore((s) => s.shapeKind);
  const setShapeKind = useEditorStore((s) => s.setShapeKind);
  const shapeFilled = useEditorStore((s) => s.shapeFilled);
  const setShapeFilled = useEditorStore((s) => s.setShapeFilled);
  const textDraft = useEditorStore((s) => s.textDraft);
  const updateTextDraft = useEditorStore((s) => s.updateTextDraft);
  const commitDocument = useEditorStore((s) => s.commitDocument);
  const commitFrame = useEditorStore((s) => s.commitFrame);
  const commitAllFrames = useEditorStore((s) => s.commitAllFrames);

  // Shared by the one-shot actions below (blur a selection, stamp a caption); brush
  // strokes are inherently per-frame and ignore it.
  const [applyToAllFrames, setApplyToAllFrames] = useState(false);

  if (!doc) return null;
  const frame = doc.frames[activeFrameIndex];
  if (!frame) return null;
  const frameCount = doc.frames.length;

  function commitEdit(render: (source: ImageData) => ImageData) {
    if (!doc) return;
    if (applyToAllFrames && frameCount > 1) {
      commitAllFrames(doc.frames.map((f) => render(f.imageData)));
    } else {
      commitFrame(activeFrameIndex, render(frame.imageData));
    }
  }

  if (activeTool === "brush" || activeTool === "eraser") {
    return (
      <Panel>
        <div className="flex items-center gap-3">
          {activeTool === "brush" && (
            <ColorInput value={brushColor} onChange={setBrushColor} label="Brush color" />
          )}
          <SliderRow label="Size" value={brushSize} min={2} max={64} onChange={setBrushSize} />
        </div>
      </Panel>
    );
  }

  if (activeTool === "blur") {
    return (
      <Panel>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            ariaLabel="Blur style"
            value={effectMode}
            onChange={setEffectMode}
            options={[
              { value: "blur", label: "Blur", icon: Droplet },
              { value: "pixelate", label: "Pixels", icon: Grid2x2 },
            ]}
          />
          {selection ? (
            <>
              <div className="flex-1" />
              {frameCount > 1 && (
                <AllFramesToggle
                  checked={applyToAllFrames}
                  onChange={setApplyToAllFrames}
                  frameCount={frameCount}
                />
              )}
              <Button
                size="sm"
                onClick={() =>
                  commitEdit((source) =>
                    applyEffect(source, { mode: effectMode, strength: effectStrength }, selection),
                  )
                }
              >
                Apply to selection
              </Button>
            </>
          ) : (
            <span className="flex-1 text-xs text-muted-foreground">
              Paint over anything you want hidden.
            </span>
          )}
        </div>
        <SliderRow
          label={effectMode === "blur" ? "Strength" : "Blocks"}
          value={effectStrength}
          min={2}
          max={40}
          onChange={setEffectStrength}
        />
        <SliderRow label="Size" value={brushSize} min={2} max={64} onChange={setBrushSize} />
      </Panel>
    );
  }

  if (activeTool === "text" && textDraft) {
    const draft = textDraft;
    const maxFontSize = Math.max(24, Math.round(Math.min(doc.width, doc.height) / 2));
    return (
      <Panel>
        <div className="flex items-center gap-2">
          <textarea
            value={draft.text}
            onChange={(e) => updateTextDraft({ text: e.target.value })}
            placeholder="Type, then tap the image to place it"
            rows={Math.min(3, draft.text.split("\n").length)}
            autoFocus
            className="min-w-0 flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm leading-snug text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
          />
          <ColorInput
            value={draft.color}
            onChange={(color) => updateTextDraft({ color })}
            label="Text color"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={draft.fontFamily}
            onChange={(e) => updateTextDraft({ fontFamily: e.target.value })}
            aria-label="Font"
            className="h-8 shrink-0 rounded-lg border border-border bg-background px-2 text-xs text-foreground"
          >
            {TEXT_FONTS.map((font) => (
              <option key={font.label} value={font.value}>
                {font.label}
              </option>
            ))}
          </select>
          <ToggleChip
            active={draft.bold}
            onClick={() => updateTextDraft({ bold: !draft.bold })}
            label="Bold"
          >
            <Bold size={13} />
            Bold
          </ToggleChip>
          <ToggleChip
            active={draft.outline}
            onClick={() => updateTextDraft({ outline: !draft.outline })}
            label="Outline"
          >
            Outline
          </ToggleChip>
          <div className="flex-1" />
          {frameCount > 1 && (
            <AllFramesToggle
              checked={applyToAllFrames}
              onChange={setApplyToAllFrames}
              frameCount={frameCount}
            />
          )}
          <Button
            size="sm"
            disabled={!draft.text.trim()}
            onClick={() => {
              commitEdit((source) => renderTextToImageData(source, draft));
              updateTextDraft({ text: "" });
            }}
          >
            Add
          </Button>
        </div>
        <SliderRow
          label="Size"
          value={draft.fontSize}
          min={8}
          max={maxFontSize}
          onChange={(fontSize) => updateTextDraft({ fontSize })}
        />
      </Panel>
    );
  }

  if (activeTool === "shape") {
    return (
      <Panel>
        <div className="flex items-center gap-2">
          <Segmented
            ariaLabel="Shape"
            compact
            value={shapeKind}
            onChange={setShapeKind}
            options={[
              { value: "arrow", label: "Arrow", icon: MoveUpRight },
              { value: "line", label: "Line", icon: Minus },
              { value: "rect", label: "Rectangle", icon: Square },
              { value: "ellipse", label: "Ellipse", icon: Circle },
            ]}
          />
          <div className="flex-1" />
          <ToggleChip
            active={shapeFilled}
            disabled={!isFillable(shapeKind)}
            onClick={() => setShapeFilled(!shapeFilled)}
            label="Fill shape"
          >
            Fill
          </ToggleChip>
          <ColorInput value={brushColor} onChange={setBrushColor} label="Shape color" />
        </div>
        <SliderRow label="Width" value={brushSize} min={2} max={64} onChange={setBrushSize} />
      </Panel>
    );
  }

  if (activeTool === "crop") {
    const hasRect = !!pendingCropRect && pendingCropRect.width > 2 && pendingCropRect.height > 2;
    return (
      <Panel>
        <div className="flex items-center gap-2">
          <span className="flex-1 text-sm text-muted-foreground">
            {hasRect ? "Drag to adjust, then crop." : "Drag on the image to crop."}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={!hasRect}
            onClick={() => setPendingCropRect(null)}
          >
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
      </Panel>
    );
  }

  if (activeTool === "select") {
    return (
      <Panel>
        <div className="flex items-center gap-2">
          <Segmented
            ariaLabel="Selection shape"
            value={selectMode}
            onChange={setSelectMode}
            options={[
              { value: "rect", label: "Box", icon: Square },
              { value: "freehand", label: "Freehand", icon: LassoSelect },
            ]}
          />
          <span className="flex-1 text-sm text-muted-foreground">
            {selection ? "Recolor and blur are scoped here." : "Draw around the part to edit."}
          </span>
          <Button variant="secondary" size="sm" disabled={!selection} onClick={() => setSelection(null)}>
            Clear
          </Button>
        </div>
      </Panel>
    );
  }

  return null;
}

function Panel({ children }: { children: ReactNode }) {
  return <div className="space-y-2 border-t border-border bg-card px-4 py-3">{children}</div>;
}

function SliderRow({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="h-8 min-w-0 flex-1 touch-none accent-[var(--primary)]"
      />
      <span className="w-10 shrink-0 text-right text-xs text-muted-foreground">{value}px</span>
    </div>
  );
}

function ColorInput({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <input
      type="color"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="h-9 w-9 shrink-0 rounded-lg border border-border bg-transparent"
    />
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  compact = false,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; icon: typeof Square }[];
  ariaLabel: string;
  /** Icon-only, for groups with too many options to fit their labels on a phone. */
  compact?: boolean;
}) {
  return (
    <div className="flex shrink-0 gap-1 rounded-lg bg-muted p-0.5" role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-label={option.label}
          aria-pressed={value === option.value}
          className={cn(
            "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground",
            value === option.value && "bg-card text-foreground",
          )}
        >
          <option.icon size={13} />
          {!compact && option.label}
        </button>
      ))}
    </div>
  );
}

function ToggleChip({
  active,
  onClick,
  disabled,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "flex h-8 shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium",
        "text-muted-foreground transition-colors disabled:opacity-40",
        active && !disabled && "border-primary bg-primary/15 text-primary",
      )}
    >
      {children}
    </button>
  );
}

function AllFramesToggle({
  checked,
  onChange,
  frameCount,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  frameCount: number;
}) {
  return (
    <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[var(--primary)]"
      />
      All {frameCount}
    </label>
  );
}
