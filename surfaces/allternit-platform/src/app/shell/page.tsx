"use client";

import { useState, useCallback } from 'react';
import { BootSequence } from '@/components/boot';
import dynamic from 'next/dynamic';

const ShellApp = dynamic(
  () => import('../../shell/ShellApp').then((mod) => mod.ShellApp),
  { ssr: false, loading: () => <div style={{ color: 'white', padding: 20 }}>Loading Allternit Platform...</div> }
);

export default function ShellPage() {
  const [bootComplete, setBootComplete] = useState(false);

  // Use useCallback to stabilize the function reference
  const handleBootComplete = useCallback(() => {
    console.log('[ShellPage] Boot sequence complete!');
    setBootComplete(true);
  }, []);

  if (bootComplete) {
    return <ShellApp />;
  }

  return <BootSequence onComplete={handleBootComplete} />;
}
