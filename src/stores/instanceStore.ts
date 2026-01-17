import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface MinecraftInstance {
    id: string
    name: string
    description?: string
    version: string
    loader?: { type: string; version: string }
    memory: { min: number; max: number }
    mods: any[]
    resourcepacks?: any[]
    shaderpacks?: any[]
    datapacks?: any[]
    lastPlayed?: string
    created: string
    isModpack?: boolean
    icon?: string
    iconUrl?: string
    path?: string
}

interface InstanceState {
    instances: MinecraftInstance[]
    isLoading: boolean
    setInstances: (instances: MinecraftInstance[]) => void
    addInstance: (instance: MinecraftInstance) => void
    updateInstance: (instance: MinecraftInstance) => void
    removeInstance: (id: string) => void
    fetchInstances: () => Promise<void>
}

export const useInstanceStore = create<InstanceState>()(
    persist(
        (set) => ({
            instances: [],
            isLoading: false,
            setInstances: (instances) => set({ instances }),
            addInstance: (instance) => set((state) => ({
                instances: [...state.instances, instance]
            })),
            updateInstance: (instance) => set((state) => ({
                instances: state.instances.map((i) => (i.id === instance.id ? instance : i))
            })),
            removeInstance: (id) => set((state) => ({
                instances: state.instances.filter((i) => i.id !== id)
            })),
            fetchInstances: async () => {
                set({ isLoading: true })
                try {
                    const instances = await window.electronAPI.launcher.getInstances() as MinecraftInstance[]
                    set({ instances, isLoading: false })
                } catch (error) {
                    console.error('Failed to fetch instances:', error)
                    set({ isLoading: false })
                }
            }
        }),
        {
            name: 'realauncher-instances-storage'
        }
    )
)
