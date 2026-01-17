import axios from 'axios'

// Modrinth API - No API key required, but has rate limits
const MODRINTH_BASE_URL = 'https://api.modrinth.com/v2'

// Mod loaders for Modrinth
export const ModrinthLoaders = ['forge', 'fabric', 'quilt', 'neoforge'] as const
export type ModrinthLoader = typeof ModrinthLoaders[number]

// Categories
export const ModrinthCategories = {
    adventure: 'adventure',
    cursed: 'cursed',
    decoration: 'decoration',
    economy: 'economy',
    equipment: 'equipment',
    food: 'food',
    'game-mechanics': 'game-mechanics',
    library: 'library',
    magic: 'magic',
    management: 'management',
    minigame: 'minigame',
    mobs: 'mobs',
    optimization: 'optimization',
    social: 'social',
    storage: 'storage',
    technology: 'technology',
    transportation: 'transportation',
    utility: 'utility',
    worldgen: 'worldgen'
} as const

export interface ModrinthProject {
    slug: string
    title: string
    description: string
    categories: string[]
    client_side: 'required' | 'optional' | 'unsupported'
    server_side: 'required' | 'optional' | 'unsupported'
    body: string
    status: string
    license: {
        id: string
        name: string
        url?: string
    }
    downloads: number
    followers: number
    id: string
    project_type: 'mod' | 'modpack' | 'resourcepack' | 'shader'
    team: string
    published: string
    updated: string
    versions: string[]
    game_versions: string[]
    loaders: string[]
    gallery: Array<{
        url: string
        featured: boolean
        title?: string
        description?: string
        created: string
    }>
    icon_url?: string
    color?: number
}

export interface ModrinthSearchResult {
    slug: string
    title: string
    description: string
    categories: string[]
    client_side: string
    server_side: string
    project_type: string
    downloads: number
    icon_url?: string
    color?: number
    project_id: string
    author: string
    display_categories: string[]
    versions: string[]
    follows: number
    date_created: string
    date_modified: string
    latest_version?: string
    license: string
    gallery: string[]
}

export interface ModrinthVersion {
    name: string
    version_number: string
    changelog?: string
    dependencies: Array<{
        version_id?: string
        project_id?: string
        file_name?: string
        dependency_type: 'required' | 'optional' | 'incompatible' | 'embedded'
    }>
    game_versions: string[]
    version_type: 'release' | 'beta' | 'alpha'
    loaders: string[]
    featured: boolean
    id: string
    project_id: string
    author_id: string
    date_published: string
    downloads: number
    files: Array<{
        hashes: {
            sha1: string
            sha512: string
        }
        url: string
        filename: string
        primary: boolean
        size: number
    }>
}

export interface ModrinthSearchParams {
    query?: string
    facets?: string[][]
    index?: 'relevance' | 'downloads' | 'follows' | 'newest' | 'updated'
    offset?: number
    limit?: number
}

interface ModrinthSearchResponse {
    hits: ModrinthSearchResult[]
    offset: number
    limit: number
    total_hits: number
}

const modrinthApi = axios.create({
    baseURL: MODRINTH_BASE_URL,
    headers: {
        'Accept': 'application/json',
        'User-Agent': 'ReaLauncher/0.1.0 (https://github.com/realauncher)'
    }
})

export async function searchModrinthProjects(params: ModrinthSearchParams): Promise<ModrinthSearchResponse> {
    // Build facets
    const facets: string[][] = [['project_type:mod']]

    if (params.facets) {
        facets.push(...params.facets)
    }

    const response = await modrinthApi.get<ModrinthSearchResponse>('/search', {
        params: {
            query: params.query,
            facets: JSON.stringify(facets),
            index: params.index || 'relevance',
            offset: params.offset || 0,
            limit: params.limit || 20
        }
    })
    return response.data
}

export async function getModrinthProject(idOrSlug: string): Promise<ModrinthProject> {
    const response = await modrinthApi.get<ModrinthProject>(`/project/${idOrSlug}`)
    return response.data
}

export async function getModrinthProjectVersions(
    idOrSlug: string,
    loaders?: string[],
    gameVersions?: string[]
): Promise<ModrinthVersion[]> {
    const response = await modrinthApi.get<ModrinthVersion[]>(`/project/${idOrSlug}/version`, {
        params: {
            loaders: loaders ? JSON.stringify(loaders) : undefined,
            game_versions: gameVersions ? JSON.stringify(gameVersions) : undefined
        }
    })
    return response.data
}

export async function getModrinthCategories(): Promise<Array<{ name: string; project_type: string; header: string }>> {
    const response = await modrinthApi.get<Array<{ name: string; project_type: string; header: string }>>('/tag/category')
    return response.data
}

export async function getModrinthGameVersions(): Promise<Array<{ version: string; version_type: string; date: string; major: boolean }>> {
    const response = await modrinthApi.get<Array<{ version: string; version_type: string; date: string; major: boolean }>>('/tag/game_version')
    return response.data.filter((v) => v.version_type === 'release')
}

// Build facets for filtering
export function buildModrinthFacets(options: {
    categories?: string[]
    gameVersions?: string[]
    loaders?: string[]
}): string[][] {
    const facets: string[][] = []

    if (options.categories && options.categories.length > 0) {
        facets.push(options.categories.map(c => `categories:${c}`))
    }

    if (options.gameVersions && options.gameVersions.length > 0) {
        facets.push(options.gameVersions.map(v => `versions:${v}`))
    }

    if (options.loaders && options.loaders.length > 0) {
        facets.push(options.loaders.map(l => `categories:${l}`))
    }

    return facets
}
