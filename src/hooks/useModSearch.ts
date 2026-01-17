import { useQuery } from '@tanstack/react-query'
import {
    searchCurseForgeMods,
    CurseForgeMod,
    CurseForgeSearchParams,
    ModLoaderTypes,
    CurseForgeCategories
} from '../services/curseforge'
import {
    searchModrinthProjects,
    ModrinthSearchResult,
    buildModrinthFacets
} from '../services/modrinth'

// Unified mod type combining both sources
export interface UnifiedMod {
    id: string
    source: 'curseforge' | 'modrinth'
    name: string
    slug: string
    description: string
    iconUrl?: string
    downloads: number
    authors: string[]
    categories: string[]
    gameVersions: string[]
    loaders: string[]
    dateUpdated: string
    websiteUrl: string
}

export interface ModSearchParams {
    query: string
    gameVersion?: string
    loader?: string
    category?: string
    source?: 'all' | 'curseforge' | 'modrinth'
    sortBy?: 'popularity' | 'updated' | 'downloads' | 'name'
    page?: number
    pageSize?: number
}

export interface ModSearchResult {
    mods: UnifiedMod[]
    total: number
    hasMore: boolean
}

// Map loader names to CurseForge IDs
function getLoaderTypeId(loader: string): number | undefined {
    const loaderMap: Record<string, number> = {
        'forge': ModLoaderTypes.Forge,
        'fabric': ModLoaderTypes.Fabric,
        'quilt': ModLoaderTypes.Quilt,
        'neoforge': ModLoaderTypes.NeoForge
    }
    return loaderMap[loader.toLowerCase()]
}

// Map category names to CurseForge IDs
function getCategoryId(category: string): number {
    const categoryMap: Record<string, number> = {
        'all': CurseForgeCategories.All,
        'worldgen': CurseForgeCategories.WorldGen,
        'technology': CurseForgeCategories.Technology,
        'magic': CurseForgeCategories.Magic,
        'storage': CurseForgeCategories.Storage,
        'utility': CurseForgeCategories.Utility,
        'adventure': CurseForgeCategories.Adventure,
        'decoration': CurseForgeCategories.Cosmetic,
        'optimization': CurseForgeCategories.Library,
        'mobs': CurseForgeCategories.Mobs
    }
    return categoryMap[category.toLowerCase()] || CurseForgeCategories.All
}

// Convert CurseForge mod to unified format
function convertCurseForgeMod(mod: CurseForgeMod): UnifiedMod {
    return {
        id: `cf-${mod.id}`,
        source: 'curseforge',
        name: mod.name,
        slug: mod.slug,
        description: mod.summary,
        iconUrl: mod.logo?.thumbnailUrl,
        downloads: mod.downloadCount,
        authors: mod.authors.map(a => a.name),
        categories: mod.categories.map(c => c.name),
        gameVersions: mod.latestFilesIndexes.map(f => f.gameVersion).filter((v, i, a) => a.indexOf(v) === i),
        loaders: mod.latestFilesIndexes.map(f => {
            switch (f.modLoader) {
                case 1: return 'Forge'
                case 4: return 'Fabric'
                case 5: return 'Quilt'
                case 6: return 'NeoForge'
                default: return 'Unknown'
            }
        }).filter((v, i, a) => a.indexOf(v) === i),
        dateUpdated: mod.dateModified,
        websiteUrl: mod.links.websiteUrl
    }
}

// Convert Modrinth mod to unified format
function convertModrinthMod(mod: ModrinthSearchResult): UnifiedMod {
    return {
        id: `mr-${mod.project_id}`,
        source: 'modrinth',
        name: mod.title,
        slug: mod.slug,
        description: mod.description,
        iconUrl: mod.icon_url,
        downloads: mod.downloads,
        authors: [mod.author],
        categories: mod.display_categories,
        gameVersions: mod.versions,
        loaders: mod.display_categories.filter(c =>
            ['forge', 'fabric', 'quilt', 'neoforge'].includes(c.toLowerCase())
        ),
        dateUpdated: mod.date_modified,
        websiteUrl: `https://modrinth.com/mod/${mod.slug}`
    }
}

// Main search function
async function searchMods(params: ModSearchParams): Promise<ModSearchResult> {
    const results: UnifiedMod[] = []
    let totalCount = 0
    const pageSize = params.pageSize || 20
    const offset = ((params.page || 1) - 1) * pageSize

    const shouldSearchCurseForge = params.source === 'all' || params.source === 'curseforge'
    const shouldSearchModrinth = params.source === 'all' || params.source === 'modrinth'

    // Search CurseForge
    if (shouldSearchCurseForge) {
        try {
            const cfParams: CurseForgeSearchParams = {
                searchFilter: params.query,
                gameVersion: params.gameVersion,
                modLoaderType: params.loader ? getLoaderTypeId(params.loader) : undefined,
                categoryId: params.category ? getCategoryId(params.category) : undefined,
                sortField: params.sortBy === 'popularity' ? 'Popularity' :
                    params.sortBy === 'updated' ? 'LastUpdated' :
                        params.sortBy === 'downloads' ? 'TotalDownloads' :
                            params.sortBy === 'name' ? 'Name' : 'Popularity',
                sortOrder: 'desc',
                pageSize: params.source === 'all' ? Math.floor(pageSize / 2) : pageSize,
                index: params.source === 'all' ? Math.floor(offset / 2) : offset
            }

            const cfResponse = await searchCurseForgeMods(cfParams)
            results.push(...cfResponse.data.map(convertCurseForgeMod))
            totalCount += cfResponse.pagination.totalCount
        } catch (error) {
            console.error('CurseForge search error:', error)
        }
    }

    // Search Modrinth
    if (shouldSearchModrinth) {
        try {
            const facets = buildModrinthFacets({
                categories: params.category && params.category !== 'all' ? [params.category] : undefined,
                gameVersions: params.gameVersion ? [params.gameVersion] : undefined,
                loaders: params.loader ? [params.loader.toLowerCase()] : undefined
            })

            const mrResponse = await searchModrinthProjects({
                query: params.query,
                facets,
                index: params.sortBy === 'popularity' ? 'downloads' :
                    params.sortBy === 'updated' ? 'updated' :
                        params.sortBy === 'downloads' ? 'downloads' :
                            params.sortBy === 'name' ? 'relevance' : 'relevance',
                offset: params.source === 'all' ? Math.floor(offset / 2) : offset,
                limit: params.source === 'all' ? Math.ceil(pageSize / 2) : pageSize
            })

            results.push(...mrResponse.hits.map(convertModrinthMod))
            totalCount += mrResponse.total_hits
        } catch (error) {
            console.error('Modrinth search error:', error)
        }
    }

    // Sort combined results
    if (params.source === 'all') {
        results.sort((a, b) => {
            switch (params.sortBy) {
                case 'downloads':
                    return b.downloads - a.downloads
                case 'updated':
                    return new Date(b.dateUpdated).getTime() - new Date(a.dateUpdated).getTime()
                case 'name':
                    return a.name.localeCompare(b.name)
                default:
                    return b.downloads - a.downloads
            }
        })
    }

    return {
        mods: results.slice(0, pageSize),
        total: totalCount,
        hasMore: offset + pageSize < totalCount
    }
}

// React Query hook
export function useModSearch(params: ModSearchParams, enabled: boolean = true) {
    return useQuery({
        queryKey: ['mods', params],
        queryFn: () => searchMods(params),
        enabled: enabled && (!!params.query || !!params.category),
        staleTime: 1000 * 60 * 5, // 5 minutes
        placeholderData: (previousData) => previousData
    })
}
