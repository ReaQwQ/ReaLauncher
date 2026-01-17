import { useQuery } from '@tanstack/react-query'
import { fetchVersionManifest, mapVersionType } from '../services/mojang'

export interface FormattedVersion {
    version: string
    type: 'release' | 'snapshot' | 'beta' | 'alpha' | 'experiment'
    releaseTime: string
}

/**
 * Hook to fetch Minecraft versions from Mojang API
 */
export function useMinecraftVersions() {
    return useQuery({
        queryKey: ['minecraft-versions'],
        queryFn: async (): Promise<FormattedVersion[]> => {
            const manifest = await fetchVersionManifest()

            return manifest.versions.map(v => ({
                version: v.id,
                type: mapVersionType(v.id, v.type),
                releaseTime: v.releaseTime
            }))
        },
        staleTime: 1000 * 60 * 30, // 30 minutes
        gcTime: 1000 * 60 * 60, // 1 hour
    })
}

/**
 * Hook to get latest version info
 */
export function useLatestVersions() {
    return useQuery({
        queryKey: ['minecraft-latest'],
        queryFn: async () => {
            const manifest = await fetchVersionManifest()
            return manifest.latest
        },
        staleTime: 1000 * 60 * 30,
    })
}
