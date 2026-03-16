use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MarketplaceUIResponse {
    pub assets: Vec<MarketplaceAssetUI>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
    pub filters: MarketplaceFiltersUI,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MarketplaceAssetUI {
    pub id: String,
    pub name: String,
    pub description: String,
    pub author: String,
    pub trust_tier: String,
    pub status: String,
    pub version: String,
    pub downloads: i64,
    pub average_rating: f64,
    pub total_ratings: i64,
    pub category: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MarketplaceFiltersUI {
    pub query: Option<String>,
    pub asset_type: Option<String>,
    pub category_id: Option<String>,
    pub publisher_id: Option<String>,
    pub trust_tier: Option<String>,
    pub min_rating: Option<f64>,
    pub max_rating: Option<f64>,
    pub sort_by: Option<String>,
    pub show_filters: bool,
}

impl Default for MarketplaceFiltersUI {
    fn default() -> Self {
        Self {
            query: None,
            asset_type: None,
            category_id: None,
            publisher_id: None,
            trust_tier: None,
            min_rating: None,
            max_rating: None,
            sort_by: None,
            show_filters: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RatingSummaryUI {
    pub asset_id: String,
    pub average_rating: f64,
    pub total_ratings: i64,
    pub distribution: Vec<RatingCountUI>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RatingCountUI {
    pub rating: String,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PublisherProfileUI {
    pub name: String,
    pub verified: bool,
    pub total_assets: i64,
    pub total_downloads: i64,
    pub assets: Vec<MarketplaceAssetUI>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CategoryTreeUI {
    pub slug: String,
    pub name: String,
    pub asset_count: i64,
    pub children: Option<Vec<CategoryTreeUI>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MarketplaceAction {
    pub search_assets: String,
    pub filter_by_category: String,
    pub view_asset_details: String,
    pub rate_asset: String,
    pub download_asset: String,
    pub view_publisher: String,
}
