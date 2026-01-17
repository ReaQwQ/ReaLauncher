import { useState, useEffect } from 'react'
import { Minus, Square, X, Copy, Zap, ZapOff } from 'lucide-react'
import { useUIStore } from '../../stores/uiStore'

export default function Titlebar() {
    const [isMaximized, setIsMaximized] = useState(false)
    const { runningInstances } = useUIStore()

    useEffect(() => {
        // Check initial state
        window.electronAPI?.isMaximized().then(setIsMaximized)

        // Listen for changes
        const unsubscribe = window.electronAPI?.onMaximizeChange(setIsMaximized)
        return () => unsubscribe?.()
    }, [])

    return (
        <header className="h-10 bg-dark-950/20 backdrop-blur-md flex items-center justify-between border-b border-dark-800 drag-region">
            <div className="flex items-center gap-2 px-4">
                <div className="w-5 h-5 rounded bg-gradient-to-br from-primary-500 to-primary-700" />
                <span className="text-sm font-semibold text-dark-200">ReaLauncher</span>
            </div>

            {/* Instance Status */}
            <div className="flex-1 flex justify-end items-center px-4 gap-3 no-drag">
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-300 ${runningInstances > 0
                    ? 'bg-green-500/10 text-green-400 border border-green-500/20 shadow-[0_0_10px_rgba(34,197,94,0.1)]'
                    : 'bg-dark-800/50 text-dark-400 border border-dark-700/50'
                    }`}>
                    {runningInstances > 0 ? (
                        <Zap size={10} className="animate-pulse" />
                    ) : (
                        <ZapOff size={10} />
                    )}
                    <span>
                        {runningInstances === 0
                            ? 'No Instances running'
                            : `${runningInstances} ${runningInstances === 1 ? 'instance' : 'instances'} running`}
                    </span>
                </div>
            </div>

            {/* Window controls */}
            <div className="flex h-full no-drag">
                <button
                    onClick={() => window.electronAPI?.minimize()}
                    className="h-full px-4 hover:bg-dark-800 transition-colors"
                    aria-label="Minimize"
                >
                    <Minus size={14} className="text-dark-400" />
                </button>
                <button
                    onClick={() => window.electronAPI?.maximize()}
                    className="h-full px-4 hover:bg-dark-800 transition-colors"
                    aria-label="Maximize"
                >
                    {isMaximized ? (
                        <Copy size={12} className="text-dark-400" />
                    ) : (
                        <Square size={12} className="text-dark-400" />
                    )}
                </button>
                <button
                    onClick={() => window.electronAPI?.close()}
                    className="h-full px-4 hover:bg-red-600 transition-colors"
                    aria-label="Close"
                >
                    <X size={14} className="text-dark-400 hover:text-white" />
                </button>
            </div>
        </header>
    )
}
