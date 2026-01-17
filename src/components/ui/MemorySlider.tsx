import { useState, useEffect } from 'react'

interface MemorySliderProps {
    value: number
    onChange: (value: number) => void
    min?: number
    max?: number
    step?: number
    disabled?: boolean
}

export default function MemorySlider({
    value,
    onChange,
    min = 512,
    max = 16104,
    step = 64,
    disabled = false
}: MemorySliderProps) {
    const [inputValue, setInputValue] = useState(value.toString())

    useEffect(() => {
        setInputValue(value.toString())
    }, [value])

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = parseInt(e.target.value)
        onChange(newValue)
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value)
    }

    const handleInputBlur = () => {
        let newValue = parseInt(inputValue)
        if (isNaN(newValue)) {
            setInputValue(value.toString())
            return
        }
        // Clamp to min/max
        newValue = Math.max(min, Math.min(max, newValue))
        // Round to nearest step
        newValue = Math.round(newValue / step) * step
        onChange(newValue)
        setInputValue(newValue.toString())
    }

    const percentage = ((value - min) / (max - min)) * 100

    // Special tick marks at 2048, 4096, 8192
    const specialTicks = [2048, 4096, 8192]

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-dark-400">
                <span>{min} MB</span>
                <span>{max} MB</span>
            </div>

            <div className="relative">
                {/* Custom tick marks */}
                <div className="absolute -top-2 left-0 right-0 h-6 pointer-events-none">
                    {specialTicks.map((tick) => {
                        const tickPercentage = ((tick - min) / (max - min)) * 100
                        return (
                            <div
                                key={tick}
                                className="absolute"
                                style={{ left: `${tickPercentage}%` }}
                            >
                                <div className="relative -translate-x-1/2">
                                    <div className="w-0.5 h-4 bg-primary-500/50" />
                                    <div className="text-[10px] text-primary-400 mt-0.5 -translate-x-1/2">
                                        {tick / 1024}GB
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Slider track */}
                <div className="relative h-2 bg-dark-700 rounded-full mt-6">
                    {/* Progress fill */}
                    <div
                        className="absolute h-full bg-primary-600 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                    />

                    {/* Slider input */}
                    <input
                        type="range"
                        min={min}
                        max={max}
                        step={step}
                        value={value}
                        onChange={handleSliderChange}
                        disabled={disabled}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    />

                    {/* Thumb */}
                    <div
                        className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white shadow-lg border-2 border-primary-600 transition-all ${disabled ? 'opacity-50' : ''
                            }`}
                        style={{ left: `calc(${percentage}% - 8px)` }}
                    />
                </div>
            </div>

            {/* Value input */}
            <div className="flex items-center gap-2">
                <input
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onBlur={handleInputBlur}
                    disabled={disabled}
                    className="w-24 px-3 py-1.5 text-sm bg-dark-800 border border-dark-700 rounded-lg text-dark-200 focus:outline-none focus:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <span className="text-sm text-dark-400">MB</span>
            </div>
        </div>
    )
}
