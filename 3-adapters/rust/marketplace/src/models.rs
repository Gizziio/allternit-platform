use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(rename_all = "lowercase")]
pub enum AssetSortBy {
    Relevance,
    Newest,
    Oldest,
    MostDownloads,
    HighestRated,
    MostReviews,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetSearchFilters {
    pub query: Option<String>,
    pub asset_type: Option<String>,
    pub source_type: Option<String>,
    pub category_id: Option<String>,
    pub publisher_id: Option<String>,
    pub trust_tier: Option<String>,
    pub min_rating: Option<f64>,
    pub max_rating: Option<f64>,
    pub min_downloads: Option<i64>,
    pub max_downloads: Option<i64>,
    pub featured_only: bool,
    pub status: Option<String>,
    pub sort_by: Option<AssetSortBy>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
    pub tags: Option<Vec<String>>,
}

impl Default for AssetSearchFilters {
    fn default() -> Self {
        Self {
            query: None,
            asset_type: None,
            source_type: None,
            category_id: None,
            publisher_id: None,
            trust_tier: None,
            min_rating: None,
            max_rating: None,
            min_downloads: None,
            max_downloads: None,
            featured_only: false,
            status: None,
            sort_by: None,
            limit: None,
            offset: None,
            tags: None,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct AssetRatingSummary {
    pub asset_id: String,
    pub average_rating: f64,
    pub total_ratings: i64,
    pub one_star: i64,
    pub two_star: i64,
    pub three_star: i64,
    pub four_star: i64,
    pub five_star: i64,
}

impl AssetRatingSummary {
    pub fn new(asset_id: String, average_rating: f64, total_ratings: i64) -> Self {
        Self {
            asset_id,
            average_rating,
            total_ratings,
            one_star: 0,
            two_star: 0,
            three_star: 0,
            four_star: 0,
            five_star: 0,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct AssetSearchResult {
    pub assets: Vec<Asset>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
    pub filters: AssetSearchFilters,
}

#[derive(Debug, Clone, Serialize)]
pub struct FeaturedAssets {
    pub assets: Vec<Asset>,
    pub updated_at: String,
    pub categories: Option<std::collections::HashMap<String, Vec<Asset>>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryTree {
    pub slug: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    pub parent_slug: Option<String>,
    #[serde(default)]
    pub asset_count: i64,
    #[serde(default)]
    pub children: Option<Vec<CategoryTree>>,
}

#[derive(Debug, Clone, Serialize)]
pub struct PublisherProfile {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub website: Option<String>,
    #[serde(default)]
    pub verified: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reputation_score: Option<f64>,
    #[serde(default)]
    pub total_assets: i64,
    #[serde(default)]
    pub total_downloads: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub member_since: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub assets: Option<Vec<Asset>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadCountIncrement {
    pub asset_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RatingSubmission {
    pub asset_id: String,
    pub rating: i32,
    pub scale: String,
    #[serde(default)]
    pub comment: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_id: Option<String>,
}

impl RatingSubmission {
    pub fn validate(&self) -> std::result::Result<(), String> {
        if self.rating < 1 || self.rating > 5 {
            return Err("Rating must be between 1 and 5".to_string());
        }
        if !matches!(self.scale.as_str(), "1-5" | "1-10") {
            return Err("Scale must be '1-5' or '1-10'".to_string());
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RatingUpdate {
    pub rating_id: i64,
    pub rating: i32,
    #[serde(default)]
    pub comment: String,
}

impl RatingUpdate {
    pub fn validate(&self) -> std::result::Result<(), String> {
        if self.rating < 1 || self.rating > 5 {
            return Err("Rating must be between 1 and 5".to_string());
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Asset {
    pub id: Option<Uuid>,
    pub asset_id: String,
    pub asset_type: String,
    pub version: String,
    pub name: String,
    pub description: String,
    pub author: String,
    pub trust_tier: String,
    pub status: String,
    pub downloads: i64,
    pub created_at: String,
    pub updated_at: String,
}
