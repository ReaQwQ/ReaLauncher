import { useState, useEffect } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { useUIStore } from '../stores/uiStore'
import { useNavigate } from 'react-router-dom'
import InstanceCard, { type MinecraftInstance } from '../components/InstanceCard'

export default function Instances() {
    const navigate = useNavigate()
    const { t } = useUIStore()
    const { activeProfile } = useAuthStore()
    const [instances, setInstances] = useState<MinecraftInstance[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const load = async () => {
            try {
                const data = await window.electronAPI.launcher.getInstances()
                setInstances(data as MinecraftInstance[])
            } catch (error) {
                console.error('Failed to load instances:', error)
            } finally {
                setIsLoading(false)
            }
        }
        load()

        // Listen for instance updates from backend
        const cleanup = window.electronAPI.launcher.onInstanceUpdated(async ({ instanceId }) => {
            console.log('[UI] Instance updated, reloading list:', instanceId)
            const data = await window.electronAPI.launcher.getInstances()
            setInstances(data as MinecraftInstance[])
        })

        return () => cleanup()
    }, [])

    const handleDelete = async (id: string) => {
        try {
            await window.electronAPI.launcher.deleteInstance(id)
            setInstances(prev => prev.filter(i => i.id !== id))
        } catch (error) {
            console.error('Failed to delete instance:', error)
        }
    }

    const handleLaunch = async (instance: MinecraftInstance) => {
        if (!activeProfile) {
            console.error('No active profile')
            return
        }

        try {
            await window.electronAPI.eml.launch({
                version: instance.version,
                loader: instance.loader,
                memory: instance.memory,
                profile: {
                    id: activeProfile.id,
                    name: activeProfile.name,
                    accessToken: activeProfile.accessToken
                },
                instancePath: instance.path || instance.id,
                instanceId: instance.id,
                instanceName: instance.name
            })

            // Update last played
            await window.electronAPI.launcher.updateInstance({
                ...instance,
                lastPlayed: new Date().toISOString()
            })
        } catch (error) {
            console.error('Launch failed:', error)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-dark-100">{t('instances.title')}</h1>
                    <p className="text-dark-400 text-sm mt-1">
                        {instances.length} {t('instances.count_label')}
                    </p>
                </div>
                <button
                    onClick={() => navigate('/instances/create')}
                    className="btn-glow px-6 py-2.5 rounded-xl bg-primary-600 text-white font-bold flex items-center gap-2 shadow-lg shadow-primary-600/20"
                >
                    <Plus size={20} />
                    {t('instances.create_new')}
                </button>
            </div>

            {isLoading ? (
                <div className="glass-card p-12 text-center">
                    <Loader2 size={40} className="mx-auto text-primary-400 animate-spin" />
                </div>
            ) : instances.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 grayscale opacity-50">
                    <p className="text-dark-500 text-sm">{t('instances.no_instances')}</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {instances.map((instance) => (
                        <InstanceCard
                            key={instance.id}
                            instance={instance}
                            onDelete={handleDelete}
                            onLaunch={handleLaunch}
                            onUpdate={async (updated) => {
                                try {
                                    await window.electronAPI.launcher.updateInstance(updated)
                                    setInstances(prev => prev.map(i => i.id === updated.id ? updated : i))
                                } catch (error) {
                                    console.error('Failed to update instance:', error)
                                }
                            }}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
