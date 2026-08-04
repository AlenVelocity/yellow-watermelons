"use client";

import { useEffect } from "react";
import { useEditorStore, type Tool } from "@/lib/editor/store";
import { downloadDocument } from "@/lib/editor/download";

const TOOL_KEYS: Record<string, Tool> = {
  r: "recolor",
  s: "select",
  b: "brush",
  e: "eraser",
  c: "crop",
};

/** Renders nothing — just wires up desktop keyboard shortcuts for the editor. */
export function KeyboardShortcuts() {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      // Read live state imperatively rather than subscribing — this listener is
      // added once, so a subscribed value here would go stale after the first render.
      const store = useEditorStore.getState();

      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) store.redo();
        else store.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        store.redo();
        return;
      }
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (store.document) void downloadDocument(store.document, store.activeFrameIndex);
        return;
      }
      if (e.key === "Escape") {
        if (store.isRecolorPanelOpen) store.setRecolorPanelOpen(false);
        return;
      }

      const target = e.target as HTMLElement | null;
      const isEditableTarget =
        !!target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (isEditableTarget || !store.document) return;

      const tool = TOOL_KEYS[e.key.toLowerCase()];
      if (tool) {
        e.preventDefault();
        store.setActiveTool(tool);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return null;
}
