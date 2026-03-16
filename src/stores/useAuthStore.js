import create from 'zustand'

export const useAuthStore = create(set => ({
  user: null,
  // Whether we've finished checking/rehydrating the auth session on app load.
  authReady: false,
  setUser: (u) => set({ user: u, authReady: true }),
  clear: () => set({ user: null, authReady: true }),
  setAuthReady: (v) => set({ authReady: v })
}))
