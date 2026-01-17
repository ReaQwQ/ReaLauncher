import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Play, Settings, Loader2, Gamepad2, Folder } from 'lucide-react'
import { useUIStore } from '../stores/uiStore'
import InstanceSettingsModal from './modals/InstanceSettingsModal'

interface MinecraftInstance {
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

interface InstanceCardProps {
    instance: MinecraftInstance
    onDelete: (id: string) => void
    onLaunch: (instance: MinecraftInstance) => void
    onUpdate: (instance: MinecraftInstance) => void
}

export default function InstanceCard({
    instance,
    onDelete,
    onLaunch,
    onUpdate
}: InstanceCardProps) {
    const { addRunningInstance, removeRunningInstance, isInstanceRunning } = useUIStore()
    const navigate = useNavigate()
    const [isLaunching, setIsLaunching] = useState(false)
    const [showSettingsModal, setShowSettingsModal] = useState(false)
    const isRunning = isInstanceRunning(instance.id)

    const handleDuplicate = () => {
        // TODO: Implement duplicate functionality
        console.log('Duplicate:', instance.name)
    }

    const handleDelete = () => {
        onDelete(instance.id)
    }

    const handleLaunch = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (isRunning) return
        setIsLaunching(true)
        addRunningInstance(instance.id)
        onLaunch(instance)
        setTimeout(() => {
            setIsLaunching(false)
            removeRunningInstance(instance.id)
        }, 3000)
    }

    const handleCardClick = () => {
        navigate(`/instances/${instance.id}`)
    }

    const handleOpenFolder = async (e: React.MouseEvent) => {
        e.stopPropagation() // Prevent card click
        if (instance.path) {
            await window.electronAPI.launcher.openFolder(instance.path)
        }
    }

    const handleSettingsClick = (e: React.MouseEvent) => {
        e.stopPropagation()
        setShowSettingsModal(true)
    }

    useEffect(() => {
        const unsubscribe = window.electronAPI.eml.onGameClosed((data) => {
            if (data.instanceId === instance.id) {
                setIsLaunching(false)
                removeRunningInstance(instance.id)
            }
        })
        return unsubscribe
    }, [instance.id, removeRunningInstance])

    return (
        <>
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={handleCardClick}
                className="glass-card p-4 hover:bg-dark-800/70 transition-colors cursor-pointer"
            >
                <div className="flex items-center gap-4">
                    {/* Left: Icon with Play Overlay */}
                    <div className="relative group/icon w-12 h-12 flex-shrink-0">
                        {/* Icon or Default Box */}
                        {(instance.icon || instance.iconUrl) ? (
                            <img
                                src={instance.icon || instance.iconUrl}
                                alt=""
                                className="w-full h-full rounded-xl object-cover shadow-md border border-white/10"
                            />
                        ) : (
                            <div className="w-full h-full rounded-xl bg-dark-800 flex items-center justify-center text-dark-500 border border-dark-700">
                                <Gamepad2 size={20} />
                            </div>
                        )}

                        {/* Play Overlay (Visible on Hover) */}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl opacity-0 group-hover/icon:opacity-100 transition-all duration-300">
                            <button
                                onClick={handleLaunch}
                                disabled={isLaunching || isRunning}
                                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-lg text-black scale-90 group-hover/icon:scale-100 ${isLaunching || isRunning ? 'bg-gray-500 cursor-not-allowed' : 'bg-green-500 hover:bg-green-400'}`}
                            >
                                {isLaunching ? (
                                    <Loader2 size={16} className="animate-spin text-black" />
                                ) : (
                                    <Play size={16} fill="currentColor" className="ml-0.5" />
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Middle: Info */}
                    <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-white truncate">{instance.name}</h3>
                        <div className="flex items-center gap-2 mt-0.5 text-sm text-dark-400 font-medium">
                            <Gamepad2 size={14} />
                            <span>
                                {instance.loader ? `${instance.loader.type} ` : ''}
                                {instance.version}
                            </span>
                        </div>
                    </div>

                    {/* Right: Action Buttons */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                            onClick={handleOpenFolder}
                            className="p-3 rounded-xl bg-dark-800/50 hover:bg-dark-700 text-dark-200 hover:text-white transition-all"
                            title="Open Folder"
                        >
                            <Folder size={20} />
                        </button>
                        <button
                            onClick={handleSettingsClick}
                            className="p-3 rounded-xl bg-dark-800/50 hover:bg-dark-700 text-dark-200 hover:text-white transition-all"
                            title="Settings"
                        >
                            <Settings size={20} />
                        </button>
                    </div>
                </div>
            </motion.div>

            {/* Settings Modal */}
            {showSettingsModal && (
                <InstanceSettingsModal
                    isOpen={showSettingsModal}
                    onClose={() => setShowSettingsModal(false)}
                    instance={instance}
                    onSave={(updated) => {
                        onUpdate(updated)
                        setShowSettingsModal(false)
                    }}
                    onDelete={() => {
                        handleDelete()
                        setShowSettingsModal(false)
                    }}
                    onDuplicate={() => {
                        handleDuplicate()
                        setShowSettingsModal(false)
                    }}
                />
            )}
        </>
    )
}

// Re-export the interface for use in Instances.tsx
export type { MinecraftInstance }
