import { useQuery } from '@tanstack/react-query'
import { getCurseForgeModFiles, CurseForgeFile } from '../services/curseforge'
import { getModrinthProjectVersions, ModrinthVersion } from '../services/modrinth'
import { ContentSource } from './useContentDetail'

export interface UnifiedVersion {
    id: string
    name: string
    versionNumber: string
    gameVersions: string[]
    loaders: string[]
    releaseType: 'release' | 'beta' | 'alpha'
    datePublished: string
    downloads: number
    fileUrl: string
    fileName: string
    fileSize: number
    changelog?: string
}

// Convert CurseForge file to unified format
function convertCurseForgeVersion(file: CurseForgeFile): UnifiedVersion {
    // Map release type: 1 = release, 2 = beta, 3 = alpha
    let releaseType: 'release' | 'beta' | 'alpha' = 'release'
    if (file.releaseType === 2) releaseType = 'beta'
    else if (file.releaseType === 3) releaseType = 'alpha'

    return {
        id: `cf-${file.id}`,
        name: file.displayName,
        versionNumber: file.fileName,
        gameVersions: file.gameVersions,
        loaders: [], // CurseForge doesn't provide this in file data
        releaseType,
        datePublished: file.fileDate,
        downloads: file.downloadCount,
        fileUrl: file.downloadUrl,
        fileName: file.fileName,
        fileSize: file.fileLength
    }
}

// Convert Modrinth version to unified format
function convertModrinthVersion(version: ModrinthVersion): UnifiedVersion {
    const primaryFile = version.files.find(f => f.primary) || version.files[0]

    return {
        id: `mr-${version.id}`,
        name: version.name,
        versionNumber: version.version_number,
        gameVersions: version.game_versions,
        loaders: version.loaders,
        releaseType: version.version_type,
        datePublished: version.date_published,
        downloads: version.downloads,
        fileUrl: primaryFile.url,
        fileName: primaryFile.filename,
        fileSize: primaryFile.size,
        changelog: version.changelog
    }
}

async function fetchVersions(
    source: ContentSource,
    id: string,
    gameVersion?: string,
    loader?: string
): Promise<UnifiedVersion[]> {
    // Remove source prefix if present
    const cleanId = id.replace(/^(cf|mr)-/, '')

    if (source === 'curseforge') {
        const numericId = parseInt(cleanId, 10)
        if (isNaN(numericId)) {
            throw new Error('Invalid CurseForge ID')
        }

        // Map loader to CurseForge mod loader type
        let modLoaderType: number | undefined
        if (loader) {
            const loaderMap: Record<string, number> = {
                'forge': 1,
                'fabric': 4,
                'quilt': 5,
                'neoforge': 6
            }
            modLoaderType = loaderMap[loader.toLowerCase()]
        }

        const files = await getCurseForgeModFiles(numericId, gameVersion, modLoaderType)
        return files.map(convertCurseForgeVersion)
    } else {
        const loaders = loader ? [loader.toLowerCase()] : undefined
        const gameVersions = gameVersion ? [gameVersion] : undefined

        const versions = await getModrinthProjectVersions(cleanId, loaders, gameVersions)
        return versions.map(convertModrinthVersion)
    }
}

export interface VersionListParams {
    source: ContentSource
    id: string
    gameVersion?: string
    loader?: string
}

export function useVersionList(
    params: VersionListParams,
    enabled: boolean = true
) {
    return useQuery({
        queryKey: ['versions', params.source, params.id, params.gameVersion, params.loader],
        queryFn: () => fetchVersions(params.source, params.id, params.gameVersion, params.loader),
        enabled: enabled && !!params.source && !!params.id,
        staleTime: 1000 * 60 * 5 // 5 minutes
    })
}
