import { motion, AnimatePresence } from 'framer-motion'
import { Copy, ExternalLink, X, Check } from 'lucide-react'
import { useState } from 'react'
import { useAuthStore } from '../../stores/authStore'

export default function DeviceCodeModal() {
    const { deviceCode, setDeviceCode } = useAuthStore()
    const [copied, setCopied] = useState(false)

    const handleCopy = () => {
        if (!deviceCode) return
        navigator.clipboard.writeText(deviceCode.userCode)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    if (!deviceCode) return null

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                {/* Backdrop with blur */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setDeviceCode(null)}
                    className="absolute inset-0 bg-dark-950/40 backdrop-blur-md"
                />

                {/* Modal content */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="relative w-full max-w-md overflow-hidden rounded-2xl bg-dark-900/80 border border-primary-500/20 shadow-2xl backdrop-blur-xl p-8"
                >
                    {/* Close button */}
                    <button
                        onClick={() => setDeviceCode(null)}
                        className="absolute top-4 right-4 p-2 text-dark-400 hover:text-dark-100 transition-colors"
                    >
                        <X size={20} />
                    </button>

                    <div className="text-center">
                        <div className="w-16 h-16 rounded-2xl bg-primary-600/20 flex items-center justify-center mx-auto mb-6">
                            <ExternalLink size={32} className="text-primary-400" />
                        </div>

                        <h2 className="text-2xl font-bold text-white mb-2">Microsoft ログイン</h2>
                        <p className="text-dark-300 mb-8">
                            ブラウザで以下のコードを入力して、Minecraftアカウントにログインしてください。
                        </p>

                        {/* Code box */}
                        <div className="relative group mb-8">
                            <div className="absolute -inset-1 bg-gradient-to-r from-primary-600 to-primary-400 rounded-xl blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200" />
                            <div className="relative flex items-center justify-between bg-dark-950/50 rounded-xl px-6 py-4 border border-dark-800">
                                <span className="text-3xl font-mono font-bold tracking-[0.2em] text-primary-400">
                                    {deviceCode.userCode}
                                </span>
                                <button
                                    onClick={handleCopy}
                                    className="p-2 hover:bg-dark-800 rounded-lg transition-colors relative"
                                    title="コピー"
                                >
                                    {copied ? (
                                        <Check size={20} className="text-green-400" />
                                    ) : (
                                        <Copy size={20} className="text-dark-400" />
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <p className="text-sm text-dark-400">
                                ブラウザが自動的に開いていない場合は、以下のボタンを押してください。
                            </p>
                            <a
                                href={deviceCode.verificationUri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-medium transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-primary-600/20"
                            >
                                ログインページを開く
                                <ExternalLink size={18} />
                            </a>
                        </div>
                    </div>

                    {/* Footer decoration */}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary-500/50 to-transparent" />
                </motion.div>
            </div>
        </AnimatePresence>
    )
}
