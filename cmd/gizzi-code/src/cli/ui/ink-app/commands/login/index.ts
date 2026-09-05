// @ts-nocheck
import type { Command } from '../../commands'
import { hasAllternitApiKeyAuth } from '../../utils/auth'
import { isEnvTruthy } from '../../utils/envUtils'

export default () =>
  ({
    type: 'local-jsx',
    name: 'login',
    description: hasAllternitApiKeyAuth()
      ? 'Switch Allternit accounts'
      : 'Sign in with your Allternit account',
    isEnabled: () => !isEnvTruthy(process.env.DISABLE_LOGIN_COMMAND),
    load: () => import('./login.js'),
  }) satisfies Command
