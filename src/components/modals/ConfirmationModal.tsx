import { motion, AnimatePresence } from 'framer-motion'
import { X, AlertTriangle } from 'lucide-react'

interface ConfirmationModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    title: string
    message: string
    confirmText?: string
    cancelText?: string
    isDestructive?: boolean
}

export default function ConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isDestructive = false
}: ConfirmationModalProps) {
    if (!isOpen) return null

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                {/* Backdrop with blur */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-dark-950/40 backdrop-blur-md"
                />

                {/* Modal content */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="relative w-full max-w-md overflow-hidden rounded-2xl bg-dark-900/80 border border-white/10 shadow-2xl backdrop-blur-xl p-6"
                >
                    {/* Close button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 text-dark-400 hover:text-dark-100 transition-colors"
                    >
                        <X size={20} />
                    </button>

                    <div className="flex flex-col items-center text-center">
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${isDestructive ? 'bg-red-500/20 text-red-500' : 'bg-primary-600/20 text-primary-400'}`}>
                            <AlertTriangle size={32} />
                        </div>

                        <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
                        <p className="text-dark-300 mb-8 max-w-[90%]">
                            {message}
                        </p>

                        <div className="flex gap-4 w-full">
                            <button
                                onClick={onClose}
                                className="flex-1 py-3 px-4 rounded-xl font-medium bg-dark-800 hover:bg-dark-700 text-dark-200 transition-colors"
                            >
                                {cancelText}
                            </button>
                            <button
                                onClick={() => {
                                    onConfirm()
                                    onClose()
                                }}
                                className={`flex-1 py-3 px-4 rounded-xl font-medium text-white transition-all shadow-lg ${isDestructive
                                        ? 'bg-red-600 hover:bg-red-500 shadow-red-600/20'
                                        : 'bg-primary-600 hover:bg-primary-500 shadow-primary-600/20'
                                    }`}
                            >
                                {confirmText}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    )
}
