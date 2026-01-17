import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Terminal, X, Minimize2, Maximize2, Trash2, ArrowDown } from 'lucide-react'
import { useLogStore } from '../stores/logStore'

interface GameConsoleProps {
    isOpen: boolean
    onClose: () => void
    instanceId?: string
}

export const GameConsole: React.FC<GameConsoleProps> = ({ isOpen, onClose, instanceId }) => {
    const { logs: allLogs, clearLogs: globalClearLogs } = useLogStore()
    const logs = instanceId ? allLogs.filter(log => log.instanceId === instanceId) : allLogs
    const [isMinimized, setIsMinimized] = useState(false)
    const [autoScroll, setAutoScroll] = useState(true)
    const logsEndRef = useRef<HTMLDivElement>(null)
    const scrollContainerRef = useRef<HTMLDivElement>(null)

    // Auto scroll
    useEffect(() => {
        if (autoScroll && logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [logs, autoScroll])

    // Detect manual scroll to disable auto-scroll
    const handleScroll = () => {
        if (!scrollContainerRef.current) return
        const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 50
        setAutoScroll(isAtBottom)
    }

    const handleClearLogs = () => globalClearLogs(instanceId)

    if (!isOpen) return null

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.95 }}
                animate={{
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    height: isMinimized ? 'auto' : '400px',
                    width: isMinimized ? '300px' : '800px'
                }}
                exit={{ opacity: 0, y: 50, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className={`fixed bottom-4 right-4 bg-dark-900/95 backdrop-blur-md border border-dark-700 rounded-lg shadow-2xl z-50 overflow-hidden flex flex-col`}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-2 bg-dark-800 border-b border-dark-700 select-none cursor-move">
                    <div className="flex items-center gap-2 text-dark-100">
                        <Terminal size={16} className="text-primary-500" />
                        <span className="font-medium text-sm">Game Console</span>
                        <span className="text-xs text-dark-400 bg-dark-700 px-2 py-0.5 rounded-full">{logs.length} lines</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={handleClearLogs}
                            className="p-1 hover:bg-dark-700 rounded text-dark-400 hover:text-red-400 transition-colors"
                            title="Clear Logs"
                        >
                            <Trash2 size={14} />
                        </button>
                        <button
                            onClick={() => setAutoScroll(!autoScroll)}
                            className={`p-1 hover:bg-dark-700 rounded transition-colors ${autoScroll ? 'text-primary-400' : 'text-dark-400'}`}
                            title="Auto Scroll"
                        >
                            <ArrowDown size={14} />
                        </button>
                        <div className="w-px h-4 bg-dark-700 mx-1" />
                        <button
                            onClick={() => setIsMinimized(!isMinimized)}
                            className="p-1 hover:bg-dark-700 rounded text-dark-400 hover:text-white transition-colors"
                        >
                            {isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1 hover:bg-red-500/20 rounded text-dark-400 hover:text-red-400 transition-colors"
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                {!isMinimized && (
                    <div
                        className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1 custom-scrollbar"
                        ref={scrollContainerRef}
                        onScroll={handleScroll}
                    >
                        {logs.length === 0 && (
                            <div className="text-dark-500 text-center mt-10 italic">
                                Waiting for game logs...
                            </div>
                        )}
                        {logs.map((log, index) => (
                            <div key={index} className="flex gap-2 break-all hover:bg-white/5 rounded px-1 -mx-1">
                                <span className="text-dark-500 shrink-0">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                                <span className={`shrink-0 font-bold w-12 ${log.level === 'error' ? 'text-red-500' :
                                    log.level === 'warn' ? 'text-yellow-500' :
                                        log.level === 'debug' ? 'text-blue-400' :
                                            log.level === 'success' ? 'text-emerald-400 font-bold' :
                                                'text-green-400'
                                    }`}>
                                    {log.level.toUpperCase()}
                                </span>
                                <span className={`${log.level === 'error' ? 'text-red-200' :
                                    log.level === 'warn' ? 'text-yellow-100' :
                                        log.level === 'success' ? 'text-emerald-100' :
                                            'text-dark-200'
                                    }`}>
                                    {log.message}
                                </span>
                            </div>
                        ))}
                        <div ref={logsEndRef} />
                    </div>
                )}
            </motion.div>
        </AnimatePresence>
    )
}
