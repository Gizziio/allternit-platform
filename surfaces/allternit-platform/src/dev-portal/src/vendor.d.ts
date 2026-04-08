declare module 'fuse.js' {
  interface FuseResult<T> {
    item: T;
    score?: number;
    matches?: any[];
  }
  class Fuse<T> {
    constructor(list: T[], options?: any);
    search(pattern: string): FuseResult<T>[];
  }
  export default Fuse;
}

declare module '@tanstack/react-query' {
  export function useQuery<T>(options: {
    queryKey: any[];
    queryFn: () => Promise<T>;
    enabled?: boolean;
    staleTime?: number;
    [key: string]: any;
  }): { data: T | undefined; isLoading: boolean; [key: string]: any };
  export function useMutation(options?: any): any;
  export function useQueryClient(): any;
  export class QueryClient { constructor(options?: any); [key: string]: any; }
  export function QueryClientProvider(props: any): any;
}
