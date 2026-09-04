import memoize from 'lodash-es/memoize.js'
import { join } from 'path'
import { getGizziConfigHomeDir } from './envUtils.js'
import { sanitizePath } from './sessionStoragePortable.js'

export function getProjectsDir(): string {
  return join(getGizziConfigHomeDir(), 'projects')
}

export const getProjectDir = memoize((projectDir: string): string => {
  return join(getProjectsDir(), sanitizePath(projectDir))
})
