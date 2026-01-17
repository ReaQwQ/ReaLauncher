import axios from 'axios'

// CurseForge API configuration
// Get your API key from https://console.curseforge.com/
const CURSEFORGE_API_KEY = 'YOUR_CURSEFORGE_API_KEY'
const CURSEFORGE_BASE_URL = 'https://api.curseforge.com/v1'
const MINECRAFT_GAME_ID = 432

// Mod loader IDs
export const ModLoaderTypes = {
    Forge: 1,
    Fabric: 4,
    Quilt: 5,
    NeoForge: 6
} as const

// Category IDs for Minecraft mods
export const CurseForgeCategories = {
    All: 0,
    WorldGen: 406,
    Biomes: 407,
    Dimensions: 410,
    Mobs: 411,
    Technology: 412,
    Processing: 413,
    PlayerTransport: 414,
    EnergyFluidItem: 417,
    Farming: 416,
    Magic: 419,
    Storage: 420,
    Library: 421,
    Adventure: 422,
    MapInformation: 423,
    Cosmetic: 424,
    Addons: 426,
    Utility: 5191,
    FoodCooking: 436,
    Redstone: 4558,
    Armor: 434,
    Structures: 409
} as const

export interface CurseForgeMod {
    id: number
    gameId: number
    name: string
    slug: string
    links: {
        websiteUrl: string
        wikiUrl?: string
        issuesUrl?: string
        sourceUrl?: string
    }
    summary: string
    status: number
    downloadCount: number
    isFeatured: boolean
    primaryCategoryId: number
    categories: Array<{
        id: number
        gameId: number
        name: string
        slug: string
        url: string
        iconUrl: string
        dateModified: string
        isClass: boolean
        classId: number
        parentCategoryId: number
    }>
    classId: number
    authors: Array<{
        id: number
        name: string
        url: string
    }>
    logo: {
        id: number
        modId: number
        title: string
        description: string
        thumbnailUrl: string
        url: string
    }
    screenshots: Array<{
        id: number
        modId: number
        title: string
        description: string
        thumbnailUrl: string
        url: string
    }>
    mainFileId: number
    latestFiles: Array<CurseForgeFile>
    latestFilesIndexes: Array<{
        gameVersion: string
        fileId: number
        filename: string
        releaseType: number
        gameVersionTypeId: number
        modLoader: number
    }>
    dateCreated: string
    dateModified: string
    dateReleased: string
    allowModDistribution: boolean
    gamePopularityRank: number
    isAvailable: boolean
    thumbsUpCount: number
}

export interface CurseForgeFile {
    id: number
    gameId: number
    modId: number
    isAvailable: boolean
    displayName: string
    fileName: string
    releaseType: number
    fileStatus: number
    hashes: Array<{ value: string; algo: number }>
    fileDate: string
    fileLength: number
    downloadCount: number
    downloadUrl: string
    gameVersions: string[]
    dependencies: Array<{
        modId: number
        relationType: number
    }>
}

export interface CurseForgeSearchParams {
    searchFilter?: string
    gameVersion?: string
    modLoaderType?: number
    categoryId?: number
    sortField?: 'Featured' | 'Popularity' | 'LastUpdated' | 'Name' | 'Author' | 'TotalDownloads'
    sortOrder?: 'asc' | 'desc'
    pageSize?: number
    index?: number
}

interface CurseForgeSearchResponse {
    data: CurseForgeMod[]
    pagination: {
        index: number
        pageSize: number
        resultCount: number
        totalCount: number
    }
}

const curseforgeApi = axios.create({
    baseURL: CURSEFORGE_BASE_URL,
    headers: {
        'Accept': 'application/json',
        'x-api-key': CURSEFORGE_API_KEY
    }
})

export async function searchCurseForgeMods(params: CurseForgeSearchParams): Promise<CurseForgeSearchResponse> {
    const response = await curseforgeApi.get<CurseForgeSearchResponse>('/mods/search', {
        params: {
            gameId: MINECRAFT_GAME_ID,
            classId: 6, // Mods class
            searchFilter: params.searchFilter,
            gameVersion: params.gameVersion,
            modLoaderType: params.modLoaderType,
            categoryId: params.categoryId !== 0 ? params.categoryId : undefined,
            sortField: params.sortField ? getSortFieldValue(params.sortField) : undefined,
            sortOrder: params.sortOrder,
            pageSize: params.pageSize || 20,
            index: params.index || 0
        }
    })
    return response.data
}

function getSortFieldValue(field: string): number {
    const fields: Record<string, number> = {
        'Featured': 1,
        'Popularity': 2,
        'LastUpdated': 3,
        'Name': 4,
        'Author': 5,
        'TotalDownloads': 6
    }
    return fields[field] || 2
}

export async function getCurseForgeMod(modId: number): Promise<CurseForgeMod> {
    const response = await curseforgeApi.get<{ data: CurseForgeMod }>(`/mods/${modId}`)
    return response.data.data
}

export async function getCurseForgeModFiles(modId: number, gameVersion?: string, modLoaderType?: number): Promise<CurseForgeFile[]> {
    const response = await curseforgeApi.get<{ data: CurseForgeFile[] }>(`/mods/${modId}/files`, {
        params: {
            gameVersion,
            modLoaderType
        }
    })
    return response.data.data
}

export async function getMinecraftVersions(): Promise<string[]> {
    const response = await curseforgeApi.get<{ data: Array<{ versions: Array<{ version: string }> }> }>('/games/432/versions')
    const versions: string[] = []

    response.data.data.forEach((type) => {
        type.versions.forEach((v) => {
            if (/^\d+\.\d+(\.\d+)?$/.test(v.version)) {
                versions.push(v.version)
            }
        })
    })

    // Sort versions descending
    return versions.sort((a, b) => {
        const aParts = a.split('.').map(Number)
        const bParts = b.split('.').map(Number)

        for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
            const aNum = aParts[i] || 0
            const bNum = bParts[i] || 0
            if (aNum !== bNum) return bNum - aNum
        }
        return 0
    })
}
