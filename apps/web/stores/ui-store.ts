import { create } from "zustand";

/**
 * SAD §6.4: Zustand for cross-component UI state (sidebar collapsed, active
 * filters) — deliberately not Redux, no time-travel/middleware complexity needed.
 */
interface UiState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  mobileNavOpen: false,
  setMobileNavOpen: (open) => set({ mobileNavOpen: open })
}));
