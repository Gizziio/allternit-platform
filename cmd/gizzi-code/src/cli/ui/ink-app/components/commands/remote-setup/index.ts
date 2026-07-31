// @ts-nocheck
import type { Command } from '../../../commands'
import { getFeatureValue_CACHED_MAY_BE_STALE } from '../../../../../../runtime/services/analytics/growthbook'
import { isPolicyAllowed } from '../../index'

const web = {
  type: 'local-jsx',
  name: 'web-setup',
  description:
    'Setup Gizzi Code on the web (requires connecting your GitHub account)',
  availability: ['claude-ai'],
  isEnabled: () =>
    getFeatureValue_CACHED_MAY_BE_STALE('tengu_cobalt_lantern', false) &&
    isPolicyAllowed('allow_remote_sessions'),
  get isHidden() {
    return !isPolicyAllowed('allow_remote_sessions')
  },
  load: () => import('../../../commands/remote-setup/remote-setup.js'),
} satisfies Command
export default web
