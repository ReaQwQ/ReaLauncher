// Unified loader version type
export interface LoaderVersion {
    version: string
    stable: boolean
    loader: string
}

/**
 * Get loader versions for a specific loader and MC version
 */
export async function getLoaderVersions(
    loaderType: string,
    mcVersion: string
): Promise<LoaderVersion[]> {
    if (loaderType === 'none') return []

    try {
        // Use IPC handler to bypass CORS and get more robust data
        const versions = await window.electronAPI.eml.getLoaderVersions(loaderType, mcVersion)
        return versions as LoaderVersion[]
    } catch (error) {
        console.error(`Failed to fetch ${loaderType} versions for ${mcVersion}:`, error)
        return []
    }
}
