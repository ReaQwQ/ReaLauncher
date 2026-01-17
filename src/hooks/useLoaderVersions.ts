import { useQuery } from '@tanstack/react-query'
import { getLoaderVersions, LoaderVersion } from '../services/loaders'

export function useLoaderVersions(loaderType: string, mcVersion: string) {
    return useQuery<LoaderVersion[]>({
        queryKey: ['loader-versions', loaderType, mcVersion],
        queryFn: () => getLoaderVersions(loaderType, mcVersion),
        enabled: loaderType !== 'none' && !!mcVersion,
        staleTime: 30 * 60 * 1000, // 30 minutes
        retry: 2
    })
}
