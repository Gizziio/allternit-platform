export type MarketplaceCategory = 'all' | 'agents' | 'plugins' | 'workflows' | 'knowledge';

export interface MarketplaceItem {
  id: string;
  name: string;
  description: string;
  type: 'agent' | 'plugin' | 'workflow' | 'pack';
  author: string;
  rating: number;
  installs: number;
  price: 'free' | 'paid' | 'enterprise';
  icon: string;
  category: MarketplaceCategory;
  tags: string[];
}
