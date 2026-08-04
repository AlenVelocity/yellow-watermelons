"use client";

import {
  BoxSelect,
  Crop as CropIcon,
  Download,
  Eraser,
  Paintbrush,
  Palette,
  Redo2,
  Share2,
  Undo2,
  Upload,
} from "lucide-react";
import { useEditorStore, type Tool } from "@/lib/editor/store";
import { ImportButton, DownloadButton, ShareButton } from "./ImportExport";
import { cn } from "@/lib/utils";

const toolButtonClass =
  "flex h-14 w-16 shrink-0 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground active:bg-muted disabled:opacity-30";

const actionButtonClass =
  "flex h-12 w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground active:bg-muted disabled:opacity-30";

const TOOLS: { tool: Tool; label: string; icon: typeof Palette }[] = [
  { tool: "recolor", label: "Recolor", icon: Palette },
  { tool: "select", label: "Select", icon: BoxSelect },
  { tool: "brush", label: "Brush", icon: Paintbrush },
  { tool: "eraser", label: "Eraser", icon: Eraser },
  { tool: "crop", label: "Crop", icon: CropIcon },
];

export function Toolbar() {
  const hasDocument = useEditorStore((s) => s.document !== null);
  const activeTool = useEditorStore((s) => s.activeTool);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);
  const canUndo = useEditorStore((s) => s.undoStack.length > 0);
  const canRedo = useEditorStore((s) => s.redoStack.length > 0);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);

  return (
    <div className="border-t border-border bg-card">
      {hasDocument && (
        <nav className="flex justify-center gap-1 overflow-x-auto px-2 pt-2">
          {TOOLS.map(({ tool, label, icon: Icon }) => (
            <button
              key={tool}
              type="button"
              onClick={() => setActiveTool(tool)}
              className={cn(toolButtonClass, activeTool === tool && "text-primary")}
            >
              <Icon size={18} strokeWidth={activeTool === tool ? 2.3 : 1.8} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      )}

      <nav
        className="flex items-stretch gap-1 px-2 pt-1.5"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      >
        <ImportButton className={actionButtonClass}>
          <Upload size={17} strokeWidth={1.8} />
          <span>Import</span>
        </ImportButton>
        <button type="button" onClick={undo} disabled={!canUndo} className={actionButtonClass}>
          <Undo2 size={17} strokeWidth={1.8} />
          <span>Undo</span>
        </button>
        <button type="button" onClick={redo} disabled={!canRedo} className={actionButtonClass}>
          <Redo2 size={17} strokeWidth={1.8} />
          <span>Redo</span>
        </button>
        <div className="flex-1" />
        <DownloadButton className={actionButtonClass}>
          <Download size={17} strokeWidth={1.8} />
          <span>Save</span>
        </DownloadButton>
        <ShareButton
          className={cn(
            actionButtonClass,
            "bg-primary text-primary-foreground hover:text-primary-foreground",
          )}
        >
          <Share2 size={17} strokeWidth={2} />
          <span>Share</span>
        </ShareButton>
      </nav>
    </div>
  );
}
