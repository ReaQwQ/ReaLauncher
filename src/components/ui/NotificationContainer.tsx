import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from 'lucide-react'
import { useNotificationStore } from '../../stores/notificationStore'

const iconMap = {
    success: <CheckCircle className="text-green-500" size={20} />,
    error: <AlertCircle className="text-red-500" size={20} />,
    info: <Info className="text-blue-500" size={20} />,
    warning: <AlertTriangle className="text-amber-500" size={20} />
}

const bgMap = {
    success: 'bg-green-500/10 border-green-500/20',
    error: 'bg-red-500/10 border-red-500/20',
    info: 'bg-blue-500/10 border-blue-500/20',
    warning: 'bg-amber-500/10 border-amber-500/20'
}

export default function NotificationContainer() {
    const { notifications, removeNotification } = useNotificationStore()

    return (
        <div className="fixed top-12 right-6 z-[100] flex flex-col gap-3 pointer-events-none w-80">
            <AnimatePresence mode="popLayout">
                {notifications.map((n) => (
                    <motion.div
                        key={n.id}
                        layout
                        initial={{ opacity: 0, x: 50, scale: 0.9 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 20, scale: 0.95 }}
                        className={`pointer-events-auto glass-card p-4 flex gap-3 items-start relative overflow-hidden ${bgMap[n.type]}`}
                        onClick={() => removeNotification(n.id)}
                    >
                        {/* Progress line for auto-dismiss */}
                        {n.duration !== 0 && (
                            <motion.div
                                initial={{ width: '100%' }}
                                animate={{ width: '0%' }}
                                transition={{ duration: (n.duration || 5000) / 1000, ease: 'linear' }}
                                className="absolute bottom-0 left-0 h-0.5 bg-current opacity-20"
                            />
                        )}

                        <div className="mt-0.5 shrink-0">
                            {iconMap[n.type]}
                        </div>

                        <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-bold text-dark-100 truncate">{n.title}</h4>
                            <p className="text-xs text-dark-400 mt-0.5 line-clamp-2">{n.message}</p>

                            {/* Progress Bar */}
                            {n.progress && (
                                <div className="mt-2 text-xs">
                                    <div className="flex justify-between text-dark-400 mb-1">
                                        <span>{n.progress.percentage}%</span>
                                        <span>{n.progress.current}/{n.progress.total}</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-dark-800 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${n.progress.percentage}%` }}
                                            transition={{ duration: 0.2 }}
                                            className="h-full bg-primary-500 rounded-full"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                removeNotification(n.id)
                            }}
                            className="p-1 hover:bg-dark-800/50 rounded-md transition-colors text-dark-500"
                        >
                            <X size={14} />
                        </button>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    )
}
