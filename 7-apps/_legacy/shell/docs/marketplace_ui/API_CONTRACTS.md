# API Contracts for Marketplace Feature

This document defines the exact request/response shapes that the UI expects for the marketplace functionality, including stubs/mocks for cases where backend endpoints are missing.

## 1. Search Assets

### Request
```typescript
interface SearchParams {
  query?: string;          // Search term to filter assets by name, description, or tags
  category?: string;       // Category to filter by (e.g., 'integration', 'analytics', 'development')
  tags?: string[];         // Array of tags to filter by
  page?: number;           // Page number for pagination (default: 1)
  limit?: number;          // Number of items per page (default: 10)
}
```

### Response
```typescript
interface SearchResults {
  items: Asset[];
  total: number;           // Total number of assets matching the criteria
  page: number;            // Current page number
  limit: number;           // Number of items per page
}

interface Asset {
  id: string;              // Unique identifier for the asset
  name: string;            // Display name of the asset
  description: string;     // Brief description of the asset
  version: string;         // Version string (e.g., "1.2.3")
  author: string;          // Name of the author/publisher
  category: string;        // Category of the asset (e.g., 'integration', 'analytics')
  tags: string[];          // Array of tags associated with the asset
  rating: number;          // Average rating (0-5 scale)
  downloadCount: number;   // Number of times the asset has been downloaded/imported
  isImported: boolean;     // Whether the asset has been imported to the local registry
  createdAt: string;       // ISO date string when asset was created
  updatedAt: string;       // ISO date string when asset was last updated
  icon?: string;           // Optional emoji or icon representation
  screenshots?: string[];  // Optional array of screenshot URLs
  documentationUrl?: string; // Optional URL to documentation
}
```

## 2. Get Asset Detail

### Request
```typescript
// Single parameter: assetId (string)
// Path: /assets/{assetId}
```

### Response
```typescript
interface AssetDetail extends Asset {
  readme: string;          // Full README content in markdown format
  changelog: string;       // Changelog content in markdown format
  dependencies: string[];  // List of required dependencies
  compatibility: {
    minVersion: string;    // Minimum compatible version of the platform
    maxVersion: string;    // Maximum compatible version of the platform (or null for no upper limit)
  };
}
```

## 3. Import Asset

### Request
```typescript
// Single parameter: assetId (string)
// Method: POST
// Path: /assets/{assetId}/import
```

### Response
```typescript
interface ImportResult {
  success: boolean;        // Whether the import was successful
  assetId: string;         // ID of the asset that was imported
  message: string;         // Human-readable message about the result
  importedAt: string;      // ISO date string when the asset was imported
}
```

## 4. Production API Endpoints

The marketplace client connects to actual backend endpoints as defined in the marketplace service:

### Base URL
```
http://localhost:3004 (matches the kernel API endpoint used by ApiClient)
```

### Endpoint Definitions

#### Search Assets
```
GET /api/v1/marketplace/search
```
- Query parameters:
  - `q` (optional): Search query string
  - `category` (optional): Category filter
  - `tags` (optional): Multiple tag filters (can be repeated)
  - `page` (optional): Page number for pagination
  - `limit` (optional): Items per page

#### Get Asset Detail
```
GET /api/v1/marketplace/assets/{assetId}
```
- Path parameter:
  - `assetId`: Unique identifier for the asset

#### Import Asset
```
POST /api/v1/marketplace/import/{assetId}
```
- Path parameter:
  - `assetId`: Unique identifier for the asset to import
- Request body:
  ```json
  {
    "assetId": "string"
  }
  ```

## 5. Error Handling

All API methods should handle the following common error cases:

- Network errors (connection timeouts, DNS failures)
- HTTP error responses (4xx, 5xx status codes)
- Invalid response formats
- Missing required fields in responses

The UI should display appropriate error messages to the user in each case.