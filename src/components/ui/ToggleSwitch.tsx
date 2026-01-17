import { motion } from 'framer-motion'

interface ToggleSwitchProps {
    enabled: boolean
    onChange: (enabled: boolean) => void
    label?: string
    description?: string
    disabled?: boolean
}

export default function ToggleSwitch({
    enabled,
    onChange,
    label,
    description,
    disabled = false
}: ToggleSwitchProps) {
    return (
        <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
                {label && (
                    <label className="text-sm font-medium text-dark-200">
                        {label}
                    </label>
                )}
                {description && (
                    <p className="text-xs text-dark-400 mt-0.5">
                        {description}
                    </p>
                )}
            </div>
            <button
                type="button"
                onClick={() => !disabled && onChange(!enabled)}
                disabled={disabled}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-dark-900 ${disabled
                        ? 'opacity-50 cursor-not-allowed bg-dark-700'
                        : enabled
                            ? 'bg-primary-600'
                            : 'bg-dark-700'
                    }`}
            >
                <motion.span
                    layout
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                    transition={{
                        type: 'spring',
                        stiffness: 500,
                        damping: 30
                    }}
                />
            </button>
        </div>
    )
}
