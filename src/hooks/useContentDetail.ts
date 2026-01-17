import { useQuery } from '@tanstack/react-query'
import { getCurseForgeMod, CurseForgeMod } from '../services/curseforge'
import { getModrinthProject, ModrinthProject } from '../services/modrinth'

export type ContentType = 'mod' | 'modpack'
export type ContentSource = 'curseforge' | 'modrinth'

// Unified content detail type
export interface UnifiedContentDetail {
    id: string
    source: ContentSource
    type: ContentType
    name: string
    slug: string
    description: string
    body: string // Full description (markdown for Modrinth, HTML for CurseForge)
    iconUrl?: string
    downloads: number
    followers?: number
    authors: string[]
    categories: string[]
    gameVersions: string[]
    loaders: string[]
    dateCreated: string
    dateUpdated: string
    websiteUrl: string
    screenshots: Array<{
        title?: string
        description?: string
        url: string
        thumbnailUrl?: string
    }>
    license?: {
        name: string
        url?: string
    }
}

// Convert CurseForge mod to unified format
function convertCurseForgeContent(content: CurseForgeMod, type: ContentType): UnifiedContentDetail {
    return {
        id: `cf-${content.id}`,
        source: 'curseforge',
        type,
        name: content.name,
        slug: content.slug,
        description: content.summary,
        body: content.summary, // CurseForge doesn't provide full body in this endpoint
        iconUrl: content.logo?.url,
        downloads: content.downloadCount,
        followers: content.thumbsUpCount,
        authors: content.authors.map(a => a.name),
        categories: content.categories.map(c => c.name),
        gameVersions: content.latestFilesIndexes
            .map(f => f.gameVersion)
            .filter((v, i, a) => a.indexOf(v) === i),
        loaders: content.latestFilesIndexes
            .map(f => {
                switch (f.modLoader) {
                    case 1: return 'Forge'
                    case 4: return 'Fabric'
                    case 5: return 'Quilt'
                    case 6: return 'NeoForge'
                    default: return null
                }
            })
            .filter((v, i, a) => v && a.indexOf(v) === i) as string[],
        dateCreated: content.dateCreated,
        dateUpdated: content.dateModified,
        websiteUrl: content.links.websiteUrl,
        screenshots: content.screenshots.map(s => ({
            title: s.title,
            description: s.description,
            url: s.url,
            thumbnailUrl: s.thumbnailUrl
        }))
    }
}

// Convert Modrinth project to unified format
function convertModrinthContent(project: ModrinthProject, type: ContentType): UnifiedContentDetail {
    return {
        id: `mr-${project.id}`,
        source: 'modrinth',
        type,
        name: project.title,
        slug: project.slug,
        description: project.description,
        body: project.body,
        iconUrl: project.icon_url,
        downloads: project.downloads,
        followers: project.followers,
        authors: [project.team], // Modrinth uses team ID, would need another call for names
        categories: project.categories,
        gameVersions: project.game_versions,
        loaders: project.loaders,
        dateCreated: project.published,
        dateUpdated: project.updated,
        websiteUrl: `https://modrinth.com/${type}/${project.slug}`,
        screenshots: project.gallery.map(g => ({
            title: g.title,
            description: g.description,
            url: g.url,
            thumbnailUrl: g.url // Modrinth doesn't provide separate thumbnails
        })),
        license: project.license ? {
            name: project.license.name,
            url: project.license.url
        } : undefined
    }
}

async function fetchContentDetail(
    source: ContentSource,
    id: string,
    type: ContentType
): Promise<UnifiedContentDetail> {
    // Remove source prefix if present (cf- or mr-)
    const cleanId = id.replace(/^(cf|mr)-/, '')

    if (source === 'curseforge') {
        const numericId = parseInt(cleanId, 10)
        if (isNaN(numericId)) {
            throw new Error('Invalid CurseForge ID')
        }
        const content = await getCurseForgeMod(numericId)
        return convertCurseForgeContent(content, type)
    } else {
        const project = await getModrinthProject(cleanId)
        return convertModrinthContent(project, type)
    }
}

export function useContentDetail(
    source: ContentSource,
    id: string,
    type: ContentType,
    enabled: boolean = true
) {
    return useQuery({
        queryKey: ['content-detail', source, id, type],
        queryFn: () => fetchContentDetail(source, id, type),
        enabled: enabled && !!source && !!id,
        staleTime: 1000 * 60 * 10 // 10 minutes
    })
}
