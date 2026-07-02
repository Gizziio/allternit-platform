// @ts-nocheck
import * as React from 'react'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { getSessionId } from '../../bootstrap/state.js'
import { Select } from '../../components/CustomSelect/index.js'
import { Pane } from '../../components/design-system/Pane.js'
import { Box, Text } from '../../ink.js'
import { useKeybinding } from '../../keybindings/useKeybinding.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'

interface ArtifactViewerProps {
  onDone: LocalJSXCommandOnDone
}

export function ArtifactViewer({ onDone }: ArtifactViewerProps) {
  const sessionId = getSessionId()
  const artifactDir = path.join(
    os.homedir(),
    '.gemini',
    'antigravity-cli',
    'brain',
    sessionId,
  )

  const [files, setFiles] = React.useState<string[]>([])
  const [selectedFile, setSelectedFile] = React.useState<string | null>(null)
  const [fileContent, setFileContent] = React.useState<string | null>(null)
  const [scrollOffset, setScrollOffset] = React.useState(0)

  React.useEffect(() => {
    try {
      if (fs.existsSync(artifactDir)) {
        const list = fs
          .readdirSync(artifactDir)
          .filter(f => f.endsWith('.md'))
        setFiles(list)
      }
    } catch {
      // Ignore error
    }
  }, [artifactDir])

  // Handle keys when viewing a specific file
  useKeybinding(
    'select:previous',
    () => {
      if (selectedFile) {
        setScrollOffset(prev => Math.max(0, prev - 1))
      }
    },
    { context: 'Chat', isActive: !!selectedFile },
  )

  useKeybinding(
    'select:next',
    () => {
      if (selectedFile) {
        setScrollOffset(prev => prev + 1)
      }
    },
    { context: 'Chat', isActive: !!selectedFile },
  )

  useKeybinding(
    'confirm:no',
    () => {
      if (selectedFile) {
        // Go back to file list
        setSelectedFile(null)
        setFileContent(null)
        setScrollOffset(0)
      } else {
        onDone()
      }
    },
    { context: 'Confirmation' },
  )

  const handleSelect = (fileName: string) => {
    try {
      const fullPath = path.join(artifactDir, fileName)
      const content = fs.readFileSync(fullPath, 'utf8')
      setSelectedFile(fileName)
      setFileContent(content)
    } catch {
      // Ignore error
    }
  }

  if (files.length === 0) {
    return (
      <Pane>
        <Text color="warning">No artifacts generated in this session.</Text>
        <Text dimColor>(press esc to close)</Text>
      </Pane>
    )
  }

  if (selectedFile && fileContent) {
    const lines = fileContent.split('\n')
    const maxVisibleLines = 15
    const visibleLines = lines.slice(scrollOffset, scrollOffset + maxVisibleLines)

    return (
      <Pane>
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="cyan">
            Viewing: {selectedFile}
          </Text>
          <Text dimColor>
            (Use Up/Down to scroll, Esc to go back to list)
          </Text>
        </Box>
        <Box
          flexDirection="column"
          borderStyle="single"
          borderColor="gray"
          padding={1}
          minHeight={15}
        >
          {visibleLines.map((line, idx) => (
            <Text key={idx}>{line || ' '}</Text>
          ))}
        </Box>
        <Box marginTop={1}>
          <Text dimColor>
            Line {scrollOffset + 1} to {Math.min(lines.length, scrollOffset + maxVisibleLines)} of {lines.length}
          </Text>
        </Box>
      </Pane>
    )
  }

  const options = files.map(f => ({
    label: f,
    value: f,
  }))

  return (
    <Pane>
      <Box marginBottom={1}>
        <Text bold>Generated Artifacts</Text>
      </Box>
      <Select
        options={options}
        onChange={handleSelect}
        onCancel={onDone}
        visibleOptionCount={8}
      />
      <Box marginTop={1}>
        <Text dimColor>(Press esc to close)</Text>
      </Box>
    </Pane>
  )
}

export async function call(
  onDone: LocalJSXCommandOnDone,
): Promise<React.ReactNode> {
  return <ArtifactViewer onDone={onDone} />
}
