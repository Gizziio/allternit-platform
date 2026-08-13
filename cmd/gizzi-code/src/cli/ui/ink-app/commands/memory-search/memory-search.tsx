// @ts-nocheck
import * as React from 'react';
import { useState, useEffect } from 'react';
import type { CommandResultDisplay } from '../../commands';
import { Dialog } from '../../components/design-system/Dialog';
import { Box, Text } from '../../ink';
import type { LocalJSXCommandCall } from '../../types/command';
import { searchSessionMemory, type SessionMemorySearchResult } from '../../services/SessionMemory/search.js';
import { logError } from '../../utils/log.js';

function MemorySearchCommand({
  initialQuery,
  onDone,
}: {
  initialQuery: string;
  onDone: (result?: string, options?: { display?: CommandResultDisplay }) => void;
}): React.ReactNode {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SessionMemorySearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    searchSessionMemory(query, { limit: 10 })
      .then(setResults)
      .catch(err => {
        logError(err);
        setResults([]);
      })
      .finally(() => setLoading(false));
  }, [query]);

  const handleSubmit = (value: string) => {
    setQuery(value.trim());
  };

  return (
    <Dialog title="Search session memory" onCancel={() => onDone('Cancelled', { display: 'system' })} color="remember">
      <Box flexDirection="column" gap={1}>
        <Text dimColor>Enter a query to search your current session memory.</Text>
        {/* Minimal read-only render for Phase 1. A future phase can add an interactive input. */}
        {loading && <Text dimColor>Searching…</Text>}
        {!loading && results !== null && (
          <Box flexDirection="column" gap={1}>
            {results.length === 0 ? (
              <Text dimColor>No matches found.</Text>
            ) : (
              results.map((result, idx) => (
                <Box key={idx} flexDirection="column" paddingX={1}>
                  <Text bold>{result.section}</Text>
                  <Text dimColor>Line {result.line}</Text>
                  <Text>{result.excerpt}</Text>
                </Box>
              ))
            )}
          </Box>
        )}
      </Box>
    </Dialog>
  );
}

export const call: LocalJSXCommandCall = async (onDone, _context, args) => {
  return <MemorySearchCommand initialQuery={args ?? ''} onDone={onDone} />;
};
