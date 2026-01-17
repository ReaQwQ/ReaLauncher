import axios from 'axios'

// Mojang Version Manifest API
const VERSION_MANIFEST_URL = 'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json'

export interface MinecraftVersion {
    id: string
    type: 'release' | 'snapshot' | 'old_beta' | 'old_alpha'
    url: string
    time: string
    releaseTime: string
    sha1: string
    complianceLevel: number
}

export interface VersionManifest {
    latest: {
        release: string
        snapshot: string
    }
    versions: MinecraftVersion[]
}

// Cache for version manifest
let cachedManifest: VersionManifest | null = null
let cacheTime: number = 0
const CACHE_DURATION = 1000 * 60 * 30 // 30 minutes

/**
 * Fetch version manifest from Mojang API
 */
export async function fetchVersionManifest(): Promise<VersionManifest> {
    // Return cached data if still valid
    if (cachedManifest && Date.now() - cacheTime < CACHE_DURATION) {
        return cachedManifest
    }

    try {
        const response = await axios.get<VersionManifest>(VERSION_MANIFEST_URL, {
            timeout: 10000,
            headers: {
                'Accept': 'application/json'
            }
        })

        cachedManifest = response.data
        cacheTime = Date.now()

        return cachedManifest
    } catch (error) {
        console.error('Failed to fetch version manifest:', error)

        // Return cached data if available, even if expired
        if (cachedManifest) {
            return cachedManifest
        }

        throw error
    }
}

/**
 * Get all versions with optional filtering
 */
export async function getMinecraftVersions(options?: {
    includeReleases?: boolean
    includeSnapshots?: boolean
    includeOldBeta?: boolean
    includeOldAlpha?: boolean
}): Promise<MinecraftVersion[]> {
    const manifest = await fetchVersionManifest()

    const opts = {
        includeReleases: true,
        includeSnapshots: false,
        includeOldBeta: false,
        includeOldAlpha: false,
        ...options
    }

    return manifest.versions.filter(v => {
        if (v.type === 'release' && opts.includeReleases) return true
        if (v.type === 'snapshot' && opts.includeSnapshots) return true
        if (v.type === 'old_beta' && opts.includeOldBeta) return true
        if (v.type === 'old_alpha' && opts.includeOldAlpha) return true
        return false
    })
}

/**
 * Get latest versions
 */
export async function getLatestVersions(): Promise<{ release: string; snapshot: string }> {
    const manifest = await fetchVersionManifest()
    return manifest.latest
}

/**
 * Get version details URL for downloading
 */
export async function getVersionDetailsUrl(versionId: string): Promise<string | null> {
    const manifest = await fetchVersionManifest()
    const version = manifest.versions.find(v => v.id === versionId)
    return version?.url ?? null
}

/**
 * Map Mojang type to our UI type
 */
export function mapVersionType(id: string, type: string): 'release' | 'snapshot' | 'beta' | 'alpha' | 'experiment' {
    if (id.toLowerCase().includes('experimental')) {
        return 'experiment'
    }
    switch (type) {
        case 'release':
            return 'release'
        case 'snapshot':
            return 'snapshot'
        case 'old_beta':
            return 'beta'
        case 'old_alpha':
            return 'alpha'
        default:
            return 'release'
    }
}
