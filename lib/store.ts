import { create } from 'zustand'

export type AppUser = any | null

export interface AppState {
  currentUser: AppUser
  setCurrentUser: (u: AppUser) => void
  isRefreshing: boolean
  setIsRefreshing: (v: boolean) => void
  installPromptEvent: Event | null;
  setInstallPromptEvent: (e: Event | null) => void;
  isOnline: boolean
  setIsOnline: (v: boolean) => void
  connectionType: string
  setConnectionType: (v: string) => void
}

export const useAppStore = create<AppState>((set: any) => ({
  currentUser: null,
  setCurrentUser: (u: AppUser) => set({ currentUser: u }),
  isRefreshing: false,
  setIsRefreshing: (v: boolean) => set({ isRefreshing: v }),
  installPromptEvent: null,
  setInstallPromptEvent: (e: Event | null) => set({ installPromptEvent: e }),
  isOnline: true,
  setIsOnline: (v: boolean) => set({ isOnline: v }),
  connectionType: 'unknown',
  setConnectionType: (v: string) => set({ connectionType: v }),
}))
