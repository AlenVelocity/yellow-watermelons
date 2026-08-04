"use client";

import { Upload } from "lucide-react";
import { Canvas } from "./Canvas";
import { Toolbar } from "./Toolbar";
import { RecolorPanel } from "./RecolorPanel";
import { ToolOptionsBar } from "./ToolOptionsBar";
import { FrameStrip } from "./FrameStrip";
import { ImportButton } from "./ImportExport";
import { MelonMark } from "./MelonMark";
import { KeyboardShortcuts } from "./KeyboardShortcuts";
import { useEditorStore } from "@/lib/editor/store";

export default function Editor() {
  const hasDocument = useEditorStore((s) => s.document !== null);
  const isRecolorPanelOpen = useEditorStore((s) => s.isRecolorPanelOpen);

  return (
    <div className="flex h-full flex-col">
      <KeyboardShortcuts />
      <header className="flex items-center justify-center gap-2 px-4 py-3">
        <MelonMark size={18} />
        <span className="text-sm font-medium text-foreground">Yellow Watermelons are real</span>
      </header>
      <main className="relative flex-1 overflow-hidden">
        <Canvas />
        {!hasDocument && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-5 px-8 text-center">
            <MelonMark size={56} />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">No sticker yet</p>
              <p className="text-sm text-muted-foreground">Import one to start.</p>
            </div>
            <div className="pointer-events-auto">
              <ImportButton className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                <Upload size={16} />
                Import
              </ImportButton>
            </div>
          </div>
        )}
      </main>
      <FrameStrip />
      {isRecolorPanelOpen ? <RecolorPanel /> : <ToolOptionsBar />}
      <Toolbar />
    </div>
  );
}
