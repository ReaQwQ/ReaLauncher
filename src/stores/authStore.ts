import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface MinecraftProfile {
    id: string
    name: string
    accessToken: string
}

interface AuthState {
    isLoggedIn: boolean
    isLoading: boolean
    activeProfile: MinecraftProfile | null
    accounts: MinecraftProfile[]
    error: string | null
    login: () => Promise<void>
    logout: () => Promise<void> // Logouts active account
    switchAccount: (id: string) => void
    removeAccount: (id: string) => Promise<void>
    checkAuth: () => Promise<void>
    deviceCode: { userCode: string, verificationUri: string } | null
    setDeviceCode: (code: { userCode: string, verificationUri: string } | null) => void
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            isLoggedIn: false,
            isLoading: false,
            activeProfile: null,
            accounts: [],
            error: null,
            deviceCode: null,

            setDeviceCode: (code) => set({ deviceCode: code }),

            login: async () => {
                set({ isLoading: true, error: null })
                try {
                    const result = await window.electronAPI.auth.login()
                    set({ deviceCode: null }) // Clear modal on login finish
                    if (result.success && result.profile) {
                        const newProfile = result.profile as MinecraftProfile
                        const currentAccounts = get().accounts

                        // Check if account already exists
                        const exists = currentAccounts.some(a => a.id === newProfile.id)
                        const newAccounts = exists
                            ? currentAccounts.map(a => a.id === newProfile.id ? newProfile : a)
                            : [...currentAccounts, newProfile]

                        set({
                            isLoggedIn: true,
                            activeProfile: newProfile,
                            accounts: newAccounts,
                            isLoading: false
                        })
                    } else {
                        set({
                            isLoading: false,
                            error: result.error || 'Login failed'
                        })
                    }
                } catch (error) {
                    set({
                        isLoading: false,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    })
                }
            },

            logout: async () => {
                const active = get().activeProfile
                if (!active) return

                set({ isLoading: true })
                try {
                    // For now, logout just removes the active profile but keeps session for switcher if desired
                    // But standard logout should probably invoke the backend logout
                    await window.electronAPI.auth.logout()
                    set({
                        isLoggedIn: false,
                        activeProfile: null,
                        isLoading: false,
                        error: null
                    })
                } catch (error) {
                    set({ isLoading: false })
                }
            },

            switchAccount: (id: string) => {
                const account = get().accounts.find(a => a.id === id)
                if (account) {
                    set({
                        isLoggedIn: true,
                        activeProfile: account,
                    })
                }
            },

            removeAccount: async (id: string) => {
                const currentAccounts = get().accounts
                const newAccounts = currentAccounts.filter(a => a.id !== id)

                const nextActive = get().activeProfile?.id === id
                    ? (newAccounts.length > 0 ? newAccounts[0] : null)
                    : get().activeProfile

                set({
                    accounts: newAccounts,
                    activeProfile: nextActive,
                    isLoggedIn: !!nextActive
                })

                if (!nextActive) {
                    await window.electronAPI.auth.logout()
                }
            },

            checkAuth: async () => {
                try {
                    const profile = await window.electronAPI.auth.getProfile()
                    if (profile) {
                        const p = profile as MinecraftProfile
                        set((state) => ({
                            isLoggedIn: true,
                            activeProfile: p,
                            // Add to accounts if missing
                            accounts: state.accounts.some(a => a.id === p.id)
                                ? state.accounts
                                : [...state.accounts, p]
                        }))
                    }
                } catch (error) {
                    console.error('Auth check failed:', error)
                }
            }
        }),
        {
            name: 'auth-storage',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                isLoggedIn: state.isLoggedIn,
                activeProfile: state.activeProfile,
                accounts: state.accounts
            })
        }
    )
)
