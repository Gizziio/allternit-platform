import { PluginMarketplace } from '@/components/marketplace/PluginMarketplace';

export const metadata = {
  title: 'Plugin Marketplace - Allternit',
};

export default function MarketplacePage() {
  return (
    <div className="min-h-screen bg-zinc-950 pt-8">
      <PluginMarketplace />
    </div>
  );
}
