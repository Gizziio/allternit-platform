import React from 'react'
import { Text } from '@/ink.js'

interface Props {
  message: any
}

export function UserCrossSessionMessage(_props: Props): React.ReactElement {
  return <Text>Cross Session Message</Text>
}
