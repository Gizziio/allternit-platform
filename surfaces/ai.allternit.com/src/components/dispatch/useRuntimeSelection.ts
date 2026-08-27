'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

export function useRuntimeSelection(paramName = 'runtime'): [string | null, (id: string | null) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedId, setSelectedIdState] = useState<string | null>(() => searchParams.get(paramName));

  useEffect(() => {
    setSelectedIdState(searchParams.get(paramName));
  }, [searchParams, paramName]);

  const setSelectedId = useCallback(
    (id: string | null) => {
      setSelectedIdState(id);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (id) {
            next.set(paramName, id);
          } else {
            next.delete(paramName);
          }
          return next;
        },
        { replace: true }
      );
    },
    [paramName, setSearchParams]
  );

  return [selectedId, setSelectedId];
}
