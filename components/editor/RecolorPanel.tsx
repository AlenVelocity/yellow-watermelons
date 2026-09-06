"use client";

import { useEffect, useRef, useState } from "react";
import { Pipette, X } from "lucide-react";
import { useEditorStore } from "@/lib/editor/store";
import { recolorImageData, RED_TO_YELLOW, rgbToHue } from "@/lib/editor/recolor";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function hueSwatch(hue: number) {
  return `hsl(${hue}, 85%, 55%)`;
}

export function RecolorPanel() {
  const doc = useEditorStore((s) => s.document);
  const activeFrameIndex = useEditorStore((s) => s.activeFrameIndex);
  const isOpen = useEditorStore((s) => s.isRecolorPanelOpen);
  const pickedColor = useEditorStore((s) => s.pickedColor);
  const setPickedColor = useEditorStore((s) => s.setPickedColor);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);
  const setRecolorPanelOpen = useEditorStore((s) => s.setRecolorPanelOpen);
  const setPreview = useEditorStore((s) => s.setPreview);
  const commitFrame = useEditorStore((s) => s.commitFrame);
  const commitAllFrames = useEditorStore((s) => s.commitAllFrames);
  const selection = useEditorStore((s) => s.selection);
  const setSelection = useEditorStore((s) => s.setSelection);
  const applyToAllFrames = useEditorStore((s) => s.applyToAllFrames);

  const [sourceHue, setSourceHue] = useState(RED_TO_YELLOW.sourceHue);
  const [tolerance, setTolerance] = useState(RED_TO_YELLOW.tolerance);
  const [targetHue, setTargetHue] = useState(RED_TO_YELLOW.targetHue);
  const [feather, setFeather] = useState(RED_TO_YELLOW.feather);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const frame = doc?.frames[activeFrameIndex] ?? null;
  const frameCount = doc?.frames.length ?? 0;

  // Eyedropper feeds its result back here. This subscribes to a one-shot event
  // from an external store (not component props/state), which is a case React
  // docs explicitly call out as legitimate effect usage.
  useEffect(() => {
    if (!pickedColor) return;
    const [r, g, b] = pickedColor;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSourceHue(Math.round(rgbToHue(r, g, b)));
    setPickedColor(null);
  }, [pickedColor, setPickedColor]);

  // Debounced live preview whenever the sliders or selection area move.
  useEffect(() => {
    if (!isOpen || !frame) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPreview(
        recolorImageData(frame.imageData, {
          sourceHue,
          tolerance,
          targetHue,
          feather,
          selection: selection ?? undefined,
        }),
      );
    }, 60);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // frame is intentionally excluded: it should only re-run for slider moves, not
    // because the preview effect itself just replaced the rendered frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceHue, tolerance, targetHue, feather, selection, isOpen]);

  if (!isOpen || !doc || !frame) return null;
  const currentDoc = doc;
  const currentFrame = frame;

  function applyPreset() {
    setSourceHue(RED_TO_YELLOW.sourceHue);
    setTolerance(RED_TO_YELLOW.tolerance);
    setTargetHue(RED_TO_YELLOW.targetHue);
    setFeather(RED_TO_YELLOW.feather);
  }

  function handleApply() {
    const options = {
      sourceHue,
      tolerance,
      targetHue,
      feather,
      selection: selection ?? undefined,
    };
    if (applyToAllFrames) {
      commitAllFrames(currentDoc.frames.map((f) => recolorImageData(f.imageData, options)));
    } else {
      commitFrame(activeFrameIndex, recolorImageData(currentFrame.imageData, options));
    }
    setPreview(null);
  }

  function handleClose() {
    setPreview(null);
    setRecolorPanelOpen(false);
  }

  return (
    <div className="rounded-t-2xl border-t border-border bg-card px-4 pb-3 pt-3 shadow-[0_-4px_16px_rgba(0,0,0,0.3)]">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-card-foreground">Recolor</span>
        <button
          type="button"
          onClick={handleClose}
          className="rounded-md p-1 text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>

      {selection && (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-dashed border-accent bg-accent/10 px-3 py-2 text-xs text-accent">
          <span>Scoped to selected area</span>
          <button
            type="button"
            onClick={() => setSelection(null)}
            className="rounded p-0.5 hover:bg-accent/20"
            aria-label="Clear selection"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className="mb-4 flex gap-2">
        <Button onClick={applyPreset} className="flex-1">
          Reds to yellow
        </Button>
        <Button variant="outline" onClick={() => setActiveTool("eyedropper")}>
          <Pipette size={16} />
          Pick color
        </Button>
      </div>

      <HueSlider label="Source hue" value={sourceHue} onChange={setSourceHue} />
      <Slider label="Tolerance" value={tolerance} min={0} max={90} onChange={setTolerance} />
      <HueSlider label="Target hue" value={targetHue} onChange={setTargetHue} />
      <Slider label="Feather" value={feather} min={0} max={60} onChange={setFeather} />

      {frameCount > 1 && applyToAllFrames && (
        <p className="mb-3 text-xs text-muted-foreground">
          Applies to all {frameCount} frames.
        </p>
      )}

      <Button onClick={handleApply} className="w-full" size="default">
        Apply
      </Button>
    </div>
  );
}

function Slider({
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
  onChange: (v: number) => void;
}) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>{Math.round(value)}°</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 w-full touch-none accent-[var(--primary)]"
      />
    </div>
  );
}

const HUE_TRACK_GRADIENT =
  "linear-gradient(to right, hsl(0,90%,58%), hsl(60,90%,58%), hsl(120,90%,58%), hsl(180,90%,58%), hsl(240,90%,58%), hsl(300,90%,58%), hsl(360,90%,58%))";

const hueThumbClass = cn(
  "relative z-10 h-7 w-full touch-none appearance-none bg-transparent",
  "[&::-webkit-slider-runnable-track]:h-2.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-transparent",
  "[&::-webkit-slider-thumb]:mt-[-6px] [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:cursor-pointer",
  "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px]",
  "[&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-[var(--thumb-color)] [&::-webkit-slider-thumb]:shadow-[0_1px_4px_rgba(0,0,0,0.5)]",
  "[&::-moz-range-track]:h-2.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent",
  "[&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full",
  "[&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-[var(--thumb-color)]",
  "[&::-moz-range-thumb]:shadow-[0_1px_4px_rgba(0,0,0,0.5)]",
);

function HueSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>{Math.round(value)}°</span>
      </div>
      <div className="relative flex h-7 items-center">
        <div
          className="pointer-events-none absolute inset-x-0 h-2.5 rounded-full"
          style={{ background: HUE_TRACK_GRADIENT }}
        />
        <input
          type="range"
          min={0}
          max={359}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ "--thumb-color": hueSwatch(value) } as React.CSSProperties}
          className={hueThumbClass}
        />
      </div>
    </div>
  );
}
