// Custom Hook for Data Fetching with React Query
// Place this in src/hooks/use-fetch.ts

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query'

// Generic fetch function
async function fetcher<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.message || `HTTP error! status: ${response.status}`)
  }

  return response.json()
}

// Hook for fetching data
export function useFetch<T>(
  key: string | (string | number)[],
  url: string | null,
  options?: Omit<UseQueryOptions<T, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery<T, Error>({
    queryKey: Array.isArray(key) ? key : [key],
    queryFn: () => fetcher<T>(url!),
    enabled: !!url,
    ...options,
  })
}

// Hook for mutations (POST, PUT, DELETE)
export function useMutate<TData = unknown, TVariables = unknown>(
  url: string,
  method: 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'POST',
  options?: Omit<
    UseMutationOptions<TData, Error, TVariables>,
    'mutationFn'
  > & {
    invalidateQueries?: string | string[]
  }
) {
  const queryClient = useQueryClient()
  const { invalidateQueries, ...mutationOptions } = options || {}

  return useMutation<TData, Error, TVariables>({
    mutationFn: async (variables) => {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: variables ? JSON.stringify(variables) : undefined,
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.message || `HTTP error! status: ${response.status}`)
      }

      return response.json()
    },
    onSuccess: () => {
      if (invalidateQueries) {
        const keys = Array.isArray(invalidateQueries)
          ? invalidateQueries
          : [invalidateQueries]
        keys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: [key] })
        })
      }
    },
    ...mutationOptions,
  })
}

// Specific hooks for common operations

export function useUsers(options?: { page?: number; limit?: number; search?: string }) {
  const { page = 1, limit = 10, search = '' } = options || {}
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    ...(search && { search }),
  })

  return useFetch(
    ['users', page, limit, search],
    `/api/users?${params.toString()}`,
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  )
}

export function usePosts(options?: {
  page?: number
  limit?: number
  published?: boolean
  authorId?: string
  tag?: string
}) {
  const { page = 1, limit = 10, published, authorId, tag } = options || {}
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    ...(published !== undefined && { published: String(published) }),
    ...(authorId && { authorId }),
    ...(tag && { tag }),
  })

  return useFetch(
    ['posts', page, limit, published, authorId, tag],
    `/api/posts?${params.toString()}`,
    {
      staleTime: 2 * 60 * 1000, // 2 minutes
    }
  )
}

export function useCreatePost() {
  return useMutate('/api/posts', 'POST', {
    invalidateQueries: 'posts',
  })
}

export function useUpdatePost(id: string) {
  return useMutate(`/api/posts/${id}`, 'PUT', {
    invalidateQueries: ['posts', id],
  })
}

export function useDeletePost() {
  return useMutate('/api/posts', 'DELETE', {
    invalidateQueries: 'posts',
  })
}
