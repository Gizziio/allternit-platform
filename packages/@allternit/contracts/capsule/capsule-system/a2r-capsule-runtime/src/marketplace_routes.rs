use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    routing::{get, post, Router},
};
use serde::Deserialize;
use crate::CapsuleService;
use marketplace::{MarketplaceService, AssetSearchFilters};
use tokio::sync::RwLock;

pub struct MarketplaceAppState {
    pub marketplace_service: RwLock<MarketplaceService>,
}

impl MarketplaceAppState {
    pub async fn new(pool: sqlx::SqlitePool) -> marketplace::Result<Self> {
        let service = MarketplaceService::new(pool).await?;
        Ok(Self {
            marketplace_service: RwLock::new(service),
        })
    }
}

async fn search_assets(
    State(service): State<CapsuleService>,
    Query(filters): Query<SearchQueryParams>,
) -> std::result::Result<Json<marketplace::AssetSearchResult>, StatusCode> {
    let mp = service.marketplace().blocking_read();
    let marketplace_service = mp.marketplace_service.read().await;

    let search_filters = AssetSearchFilters {
        query: filters.query.clone(),
        asset_type: filters.asset_type.clone(),
        source_type: filters.source_type.clone(),
        category_id: filters.category_id.clone(),
        publisher_id: filters.publisher_id.clone(),
        trust_tier: filters.trust_tier.clone(),
        min_rating: filters.min_rating,
        max_rating: filters.max_rating,
        min_downloads: filters.min_downloads,
        max_downloads: filters.max_downloads,
        featured_only: filters.featured_only.unwrap_or(false),
        status: filters.status.clone(),
        sort_by: filters.sort_by.clone(),
        limit: filters.limit,
        offset: filters.offset,
        tags: None,
    };

    match marketplace_service.search_assets(&search_filters).await {
        Ok(result) => Ok(Json(result)),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn get_featured_assets(
    State(service): State<CapsuleService>,
) -> std::result::Result<Json<marketplace::FeaturedAssets>, StatusCode> {
    let mp = service.marketplace().blocking_read();
    let marketplace_service = mp.marketplace_service.read().await;

    match marketplace_service.get_featured_assets().await {
        Ok(assets) => Ok(Json(assets)),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn get_asset(
    State(service): State<CapsuleService>,
    Path(asset_id): Path<String>,
) -> std::result::Result<Json<serde_json::Value>, StatusCode> {
    let mp = service.marketplace().blocking_read();
    let marketplace_service = mp.marketplace_service.read().await;

    let filters = AssetSearchFilters {
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
        limit: Some(1),
        offset: Some(0),
        tags: None,
    };

    match marketplace_service.search_assets(&filters).await {
        Ok(result) if !result.assets.is_empty() => {
            Ok(Json(serde_json::json!(result.assets[0])))
        }
        Ok(_) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn get_ratings(
    State(service): State<CapsuleService>,
    Path(asset_id): Path<String>,
) -> std::result::Result<Json<marketplace::AssetRatingSummary>, StatusCode> {
    let mp = service.marketplace().blocking_read();
    let marketplace_service = mp.marketplace_service.read().await;

    match marketplace_service.get_rating_summary(&asset_id).await {
        Ok(ratings) => Ok(Json(ratings)),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn submit_rating(
    State(service): State<CapsuleService>,
    Json(submission): Json<marketplace::RatingSubmission>,
) -> std::result::Result<Json<serde_json::Value>, StatusCode> {
    let mp = service.marketplace().blocking_read();
    let marketplace_service = mp.marketplace_service.write().await;

    match marketplace_service.submit_rating(&submission).await {
        Ok(_) => Ok(Json(serde_json::json!({"status": "submitted"}))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn get_categories(
    State(service): State<CapsuleService>,
) -> std::result::Result<Json<Vec<marketplace::CategoryTree>>, StatusCode> {
    let mp = service.marketplace().blocking_read();
    let marketplace_service = mp.marketplace_service.read().await;

    match marketplace_service.get_category_tree().await {
        Ok(categories) => Ok(Json(categories)),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn get_category(
    State(service): State<CapsuleService>,
    Path(slug): Path<String>,
) -> std::result::Result<Json<marketplace::CategoryTree>, StatusCode> {
    let mp = service.marketplace().blocking_read();
    let marketplace_service = mp.marketplace_service.read().await;

    match marketplace_service.get_category_tree().await {
        Ok(mut categories) => {
            categories.retain(|c| c.slug == slug);
            if let Some(category) = categories.into_iter().next() {
                Ok(Json(category))
            } else {
                Err(StatusCode::NOT_FOUND)
            }
        }
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn get_publisher(
    State(service): State<CapsuleService>,
    Path(author): Path<String>,
) -> std::result::Result<Json<marketplace::PublisherProfile>, StatusCode> {
    let mp = service.marketplace().blocking_read();
    let marketplace_service = mp.marketplace_service.read().await;

    match marketplace_service.get_publisher_profile(&author).await {
        Ok(profile) => Ok(Json(profile)),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

#[derive(Debug, Deserialize)]
struct SearchQueryParams {
    query: Option<String>,
    asset_type: Option<String>,
    source_type: Option<String>,
    category_id: Option<String>,
    publisher_id: Option<String>,
    trust_tier: Option<String>,
    min_rating: Option<f64>,
    max_rating: Option<f64>,
    min_downloads: Option<i64>,
    max_downloads: Option<i64>,
    featured_only: Option<bool>,
    status: Option<String>,
    sort_by: Option<marketplace::AssetSortBy>,
    limit: Option<usize>,
    offset: Option<usize>,
}

pub fn marketplace_routes() -> Router<CapsuleService> {
    Router::new()
        .route("/marketplace/assets", get(search_assets))
        .route("/marketplace/assets/featured", get(get_featured_assets))
        .route("/marketplace/assets/:asset_id", get(get_asset))
        .route("/marketplace/assets/:asset_id/ratings", get(get_ratings))
        .route("/marketplace/ratings", post(submit_rating))
        .route("/marketplace/categories", get(get_categories))
        .route("/marketplace/categories/:slug", get(get_category))
        .route("/marketplace/publishers/:author", get(get_publisher))
}
