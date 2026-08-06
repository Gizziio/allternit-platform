import { writeFileSync } from 'node:fs'
import { buildKitchenSinkDocx } from '../../../packages/@allternit/office-docx-engine/tests/helpers/build-docx.ts'

const bytes = await buildKitchenSinkDocx()
const path = new URL('../tmp/kitchen-sink.docx', import.meta.url)
writeFileSync(path, bytes)
console.log(`wrote ${path.pathname} (${bytes.byteLength} bytes)`)
