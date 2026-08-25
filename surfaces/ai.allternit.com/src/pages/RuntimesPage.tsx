'use client';

import { ToastProvider } from '@/hooks/use-toast';
import { RemoteControlDashboard } from '@/components/remote-control/RemoteControlDashboard';

export default function RuntimesPage() {
  return (
    <ToastProvider>
      <RemoteControlDashboard />
    </ToastProvider>
  );
}
