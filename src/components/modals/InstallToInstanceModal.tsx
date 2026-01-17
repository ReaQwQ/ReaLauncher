import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Search, Plus } from 'lucide-react'
import { useInstanceStore, MinecraftInstance } from '../../stores/instanceStore'

interface InstallToInstanceModalProps {
    isOpen: boolean
    onClose: () => void
    onInstall: (instanceId: string | null) => void // null means create new
    project: any
}

export default function InstallToInstanceModal({ isOpen, onClose, onInstall, project }: InstallToInstanceModalProps) {
    const { instances } = useInstanceStore()
    const [searchQuery, setSearchQuery] = useState('')
    const [filteredInstances, setFilteredInstances] = useState<MinecraftInstance[]>(instances)

    useEffect(() => {
        setFilteredInstances(
            instances.filter((inst: MinecraftInstance) =>
                inst.name.toLowerCase().includes(searchQuery.toLowerCase())
            )
        )
    }, [searchQuery, instances])

    if (!isOpen) return null

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-dark-900 border border-dark-700 rounded-xl w-full max-w-md shadow-2xl overflow-hidden"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-dark-800">
                        <div className="flex flex-col">
                            <h2 className="text-xl font-bold text-white">Select Instance</h2>
                            <p className="text-xs text-dark-400">Installing {project?.title || 'content'}</p>
                        </div>
                        <button onClick={onClose} className="text-dark-400 hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        {/* Search */}
                        <div className="relative mb-4">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search for an instance"
                                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-dark-800 border border-dark-700 text-dark-100 placeholder-dark-500 focus:outline-none focus:border-primary-500 transition-colors"
                            />
                        </div>

                        {/* List */}
                        <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar mb-4">
                            {filteredInstances.map((instance) => (
                                <div key={instance.id} className="flex items-center justify-between p-3 rounded-lg bg-dark-800/50 border border-dark-700/50">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded bg-dark-700 flex items-center justify-center text-dark-300 font-bold text-xs uppercase">
                                            {instance.icon ? (
                                                <img src={instance.icon} alt={instance.name} className="w-full h-full object-cover rounded" />
                                            ) : (
                                                instance.name.substring(0, 2)
                                            )}
                                        </div>
                                        <span className="font-medium text-dark-200">{instance.name}</span>
                                    </div>
                                    <button
                                        onClick={() => onInstall(instance.id)}
                                        className="px-3 py-1.5 rounded-md bg-dark-700 hover:bg-primary-600 text-dark-300 hover:text-white text-xs font-medium transition-colors"
                                    >
                                        Select
                                    </button>
                                </div>
                            ))}
                            {filteredInstances.length === 0 && (
                                <div className="text-center py-4 text-dark-500 text-sm">
                                    No instances found matching "{searchQuery}"
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => onInstall(null)}
                                className="flex-1 px-4 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 text-white font-medium flex items-center justify-center gap-2 transition-colors"
                            >
                                <Plus size={18} />
                                Create new instance
                            </button>
                            <button
                                onClick={onClose}
                                className="px-4 py-2.5 rounded-lg bg-dark-800 hover:bg-dark-700 text-dark-300 hover:text-white font-medium transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    )
}
