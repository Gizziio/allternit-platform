/// <reference types="vite/client" />
import type { SlidesApi } from '../shared/ipc'
import type { ProjectApi } from '../stubs/project-store'

declare global {
  interface Window {
    slidesApi: SlidesApi
    readonly projectApi?: ProjectApi
  }
}

export {}
