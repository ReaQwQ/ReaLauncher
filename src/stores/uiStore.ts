import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import jaJPContent from '../lang/ja-JP.lang?raw'
import enUSContent from '../lang/en-US.lang?raw'
import esESContent from '../lang/es-ES.lang?raw'
import frFRContent from '../lang/fr-FR.lang?raw'
import deDEContent from '../lang/de-DE.lang?raw'
import itITContent from '../lang/it-IT.lang?raw'
import ptBRContent from '../lang/pt-BR.lang?raw'
import ruRUContent from '../lang/ru-RU.lang?raw'
import trTRContent from '../lang/tr-TR.lang?raw'
import idIDContent from '../lang/id-ID.lang?raw'
import hiINContent from '../lang/hi-IN.lang?raw'
import arSAContent from '../lang/ar-SA.lang?raw'
import zhCNContent from '../lang/zh-CN.lang?raw'
import zhTWContent from '../lang/zh-TW.lang?raw'
import koKRContent from '../lang/ko-KR.lang?raw'

const jaJP = JSON.parse(jaJPContent)
const enUS = JSON.parse(enUSContent)
const esES = JSON.parse(esESContent)
const frFR = JSON.parse(frFRContent)
const deDE = JSON.parse(deDEContent)
const itIT = JSON.parse(itITContent)
const ptBR = JSON.parse(ptBRContent)
const ruRU = JSON.parse(ruRUContent)
const trTR = JSON.parse(trTRContent)
const idID = JSON.parse(idIDContent)
const hiIN = JSON.parse(hiINContent)
const arSA = JSON.parse(arSAContent)
const zhCN = JSON.parse(zhCNContent)
const zhTW = JSON.parse(zhTWContent)
const koKR = JSON.parse(koKRContent)

export type Language =
    | 'ja-JP' | 'en-US'  // Japanese, English
    | 'es-ES' | 'fr-FR' | 'de-DE' | 'it-IT' | 'pt-BR' // European
    | 'ru-RU' | 'tr-TR' // Eastern European / Eurasian
    | 'zh-CN' | 'zh-TW' | 'ko-KR' // East Asian
    | 'id-ID' | 'hi-IN' | 'ar-SA' // Others

interface UIState {
    language: Language
    setLanguage: (lang: Language) => void
    t: (path: string) => string

    runningInstances: number
    setRunningInstances: (count: number) => void
    incrementRunningInstances: () => void
    decrementRunningInstances: () => void
    runningInstanceIds: string[]
    addRunningInstance: (id: string) => void
    removeRunningInstance: (id: string) => void
    isInstanceRunning: (id: string) => boolean

    // Appearance
    font: 'inter' | 'minecraft' | 'system'
    setFont: (font: 'inter' | 'minecraft' | 'system') => void
    theme: 'default' | 'emerald' | 'rose' | 'amber' | 'blue' | 'orange'
    setTheme: (theme: 'default' | 'emerald' | 'rose' | 'amber' | 'blue' | 'orange') => void
    mode: 'dark' | 'light' | 'oled' | 'system'
    setMode: (mode: 'dark' | 'light' | 'oled' | 'system') => void
}

const translations: Record<Language, any> = {
    'ja-JP': jaJP,
    'en-US': enUS,
    'es-ES': esES,
    'fr-FR': frFR,
    'de-DE': deDE,
    'it-IT': itIT,
    'pt-BR': ptBR,
    'ru-RU': ruRU,
    'tr-TR': trTR,
    'id-ID': idID,
    'hi-IN': hiIN,
    'ar-SA': arSA,
    'zh-CN': zhCN,
    'zh-TW': zhTW,
    'ko-KR': koKR
}

export const useUIStore = create<UIState>()(
    persist(
        (set, get) => ({
            language: 'ja-JP',
            setLanguage: (lang) => set({ language: lang }),
            t: (path) => {
                const lang = get().language
                if (!lang || !translations[lang]) return path

                const keys = path.split('.')
                let current = translations[lang]

                for (const key of keys) {
                    if (current === undefined || current[key] === undefined) {
                        // Fallback to English
                        let englishCurrent = translations['en-US']
                        for (const eKey of keys) {
                            if (englishCurrent[eKey] === undefined) return path
                            englishCurrent = englishCurrent[eKey]
                        }
                        return typeof englishCurrent === 'string' ? englishCurrent : path
                    }
                    current = current[key]
                }

                return typeof current === 'string' ? current : path

            },


            runningInstances: 0,
            setRunningInstances: (count: number) => set({ runningInstances: count }),
            incrementRunningInstances: () => set((state) => ({ runningInstances: state.runningInstances + 1 })),
            decrementRunningInstances: () => set((state) => ({ runningInstances: Math.max(0, state.runningInstances - 1) })),
            runningInstanceIds: [],
            addRunningInstance: (id: string) => set((state) => {
                if (state.runningInstanceIds.includes(id)) return state
                const newIds = [...state.runningInstanceIds, id]
                return { runningInstanceIds: newIds, runningInstances: newIds.length }
            }),
            removeRunningInstance: (id: string) => set((state) => {
                const newIds = state.runningInstanceIds.filter(i => i !== id)
                return { runningInstanceIds: newIds, runningInstances: newIds.length }
            }),
            isInstanceRunning: (id: string) => {
                const ids = get().runningInstanceIds
                return Array.isArray(ids) ? ids.includes(id) : false
            },

            // Appearance defaults
            font: 'inter',
            setFont: (font) => set({ font }),
            theme: 'default',
            setTheme: (theme) => set({ theme }),
            mode: 'dark', // Default mode
            setMode: (mode) => set({ mode }),
        }),
        {
            name: 'realauncher-ui-storage',
            partialize: (state) => ({ language: state.language, font: state.font, theme: state.theme, mode: state.mode }),
        }
    )
)
