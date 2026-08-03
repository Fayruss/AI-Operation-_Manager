import { create } from "zustand";

/** SAD §6.4 Zustand UI state, mirroring ui-store.ts's sidebar-collapsed precedent — Chat Workspace open/collapsed is cross-component UI state, not server state. */
interface ChatStore {
  open: boolean;
  setOpen: (open: boolean) => void;
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;
  /** Set by the AI Copilot (SAD §13.3) before opening the panel, so the next message carries page context. */
  pendingContextEntity: { type: string; id: string; label: string } | null;
  setPendingContextEntity: (entity: { type: string; id: string; label: string } | null) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  activeSessionId: null,
  setActiveSessionId: (id) => set({ activeSessionId: id }),
  pendingContextEntity: null,
  setPendingContextEntity: (entity) => set({ pendingContextEntity: entity })
}));
