import OfficeLauncherView from '@/views/office/OfficeLauncherView';
import { OfficePageChrome } from '@/shell/OfficePageChrome';

export default function OfficeLauncherPage() {
  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden">
      <OfficePageChrome />
      <div className="min-h-0 flex-1">
        <OfficeLauncherView />
      </div>
    </main>
  );
}
