import { SkillPackage } from '../../../shared/contracts';

// Define the interfaces for the marketplace client
export interface SearchParams {
  query?: string;
  category?: string;
  tags?: string[];
  page?: number;
  limit?: number;
}

export interface SearchResults {
  items: Asset[];
  total: number;
  page: number;
  limit: number;
}

export interface Asset {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  category: string;
  tags: string[];
  rating: number;
  downloadCount: number;
  isImported: boolean;
  createdAt: string;
  updatedAt: string;
  icon?: string;
  screenshots?: string[];
  documentationUrl?: string;
}

export interface AssetDetail extends Asset {
  readme: string;
  changelog: string;
  dependencies: string[];
  compatibility: {
    minVersion: string;
    maxVersion: string;
  };
}

export interface ImportResult {
  success: boolean;
  assetId: string;
  message: string;
  importedAt: string;
}


/**
 * Marketplace client for handling marketplace operations
 */
export class MarketplaceClient {
  /**
   * Search for assets in the marketplace
   * @param params Search parameters
   * @returns Search results
   */
  async searchAssets(params: SearchParams = {}): Promise<SearchResults> {
    const url = new URL(`${this.getBaseURL()}/api/v1/marketplace/search`);

    if (params.query) url.searchParams.append('q', params.query);
    if (params.category) url.searchParams.append('category', params.category);
    if (params.tags) params.tags.forEach(tag => url.searchParams.append('tags', tag));
    if (params.page) url.searchParams.append('page', params.page.toString());
    if (params.limit) url.searchParams.append('limit', params.limit.toString());

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Failed to search assets: ${response.statusText}`);
    }

    const data = await response.json();
    return data as SearchResults;
  }

  /**
   * Get detailed information about a specific asset
   * @param assetId ID of the asset
   * @returns Detailed asset information
   */
  async getAssetDetail(assetId: string): Promise<AssetDetail> {
    const response = await fetch(`${this.getBaseURL()}/api/v1/marketplace/assets/${assetId}`);

    if (!response.ok) {
      throw new Error(`Failed to get asset detail: ${response.statusText}`);
    }

    const data = await response.json();
    return data as AssetDetail;
  }

  /**
   * Import an asset to the registry (draft)
   * @param assetId ID of the asset to import
   * @returns Import result
   */
  async importAsset(assetId: string): Promise<ImportResult> {
    const response = await fetch(`${this.getBaseURL()}/api/v1/marketplace/import/${assetId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ assetId }),
    });

    if (!response.ok) {
      throw new Error(`Failed to import asset: ${response.statusText}`);
    }

    const data = await response.json();
    return data as ImportResult;
  }

  private getBaseURL(): string {
    return 'http://localhost:3004'; // Using the same base URL as ApiClient
  }
}

// Export a singleton instance
export const marketplaceClient = new MarketplaceClient();