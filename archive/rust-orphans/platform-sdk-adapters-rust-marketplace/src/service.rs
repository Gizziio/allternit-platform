use crate::error::{MarketplaceError, Result};
use crate::models::*;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::{QueryBuilder, Row, Sqlite, SqlitePool};
use std::collections::HashMap;
use uuid::Uuid;

pub use crate::models::*;
pub use crate::registry_service::*;

/// Search tools request
#[derive(Deserialize)]
pub struct MarketplaceSearchRequest {
    pub query: Option<String>,
    pub registry_type: Option<String>,
}

/// Search tools response
#[derive(Serialize)]
pub struct MarketplaceSearchResponse {
    pub tools: Vec<ExternalTool>,
    pub total: i64,
}

/// Install tool request
#[derive(Deserialize)]
pub struct MarketplaceInstallRequest {
    pub id: String,
    pub registry_type: String,
    pub package_name: Option<String>,
}

/// Installed tools list
#[derive(Serialize)]
pub struct InstalledToolsResponse {
    pub tools: Vec<InstalledToolJson>,
}

/// Installed tool JSON
#[derive(Serialize)]
pub struct InstalledToolJson {
    pub id: String,
    pub name: String,
    pub version: String,
    pub registry_type: String,
    pub installed_at: String,
}

#[derive(Debug, Clone, sqlx::FromRow)]
struct AssetRow {
    id: Option<String>,
    asset_id: String,
    asset_type: String,
    version: String,
    name: String,
    description: String,
    author: String,
    trust_tier: String,
    status: String,
    downloads: i64,
    created_at: String,
    updated_at: String,
}

#[derive(Clone)]
pub struct MarketplaceService {
    pool: SqlitePool,
}

impl MarketplaceService {
    pub async fn new(pool: SqlitePool) -> Result<Self> {
        let service = Self { pool };
        service.initialize_schema().await?;
        Ok(service)
    }

    pub async fn initialize_schema(&self) -> Result<()> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("PRAGMA foreign_keys = ON;")
            .execute(&mut *tx)
            .await?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS assets (
                id TEXT PRIMARY KEY,
                asset_id TEXT NOT NULL UNIQUE,
                asset_type TEXT NOT NULL,
                version TEXT NOT NULL,
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                author TEXT NOT NULL,
                trust_tier TEXT NOT NULL,
                status TEXT NOT NULL,
                downloads INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                source_type TEXT,
                category_id TEXT,
                publisher_id TEXT,
                featured INTEGER NOT NULL DEFAULT 0
            );
            "#,
        )
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS ratings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                asset_id TEXT NOT NULL,
                rating INTEGER NOT NULL,
                scale TEXT NOT NULL,
                comment TEXT NOT NULL DEFAULT '',
                user_id TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY(asset_id) REFERENCES assets(asset_id) ON DELETE CASCADE
            );
            "#,
        )
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS categories (
                slug TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                parent_slug TEXT
            );
            "#,
        )
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS asset_tags (
                asset_id TEXT NOT NULL,
                tag TEXT NOT NULL,
                PRIMARY KEY(asset_id, tag),
                FOREIGN KEY(asset_id) REFERENCES assets(asset_id) ON DELETE CASCADE
            );
            "#,
        )
        .execute(&mut *tx)
        .await?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(asset_type);")
            .execute(&mut *tx)
            .await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_assets_author ON assets(author);")
            .execute(&mut *tx)
            .await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_assets_trust ON assets(trust_tier);")
            .execute(&mut *tx)
            .await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);")
            .execute(&mut *tx)
            .await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_assets_created_at ON assets(created_at);")
            .execute(&mut *tx)
            .await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_ratings_asset_id ON ratings(asset_id);")
            .execute(&mut *tx)
            .await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_asset_tags_tag ON asset_tags(tag);")
            .execute(&mut *tx)
            .await?;

        tx.commit().await?;
        Ok(())
    }

    pub async fn register_asset(&self, asset: &Asset) -> Result<()> {
        if asset.asset_id.trim().is_empty() {
            return Err(MarketplaceError::Validation(
                "asset_id cannot be empty".to_string(),
            ));
        }
        if asset.name.trim().is_empty() {
            return Err(MarketplaceError::Validation(
                "name cannot be empty".to_string(),
            ));
        }

        let now = Utc::now().to_rfc3339();
        let id = asset
            .id
            .map(|val| val.to_string())
            .unwrap_or_else(|| Uuid::new_v4().to_string());
        let created_at = if asset.created_at.is_empty() {
            now.clone()
        } else {
            asset.created_at.clone()
        };
        let updated_at = if asset.updated_at.is_empty() {
            now
        } else {
            asset.updated_at.clone()
        };

        sqlx::query(
            r#"
            INSERT INTO assets (
                id, asset_id, asset_type, version, name, description, author, trust_tier,
                status, downloads, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(asset_id) DO UPDATE SET
                asset_type = excluded.asset_type,
                version = excluded.version,
                name = excluded.name,
                description = excluded.description,
                author = excluded.author,
                trust_tier = excluded.trust_tier,
                status = excluded.status,
                downloads = excluded.downloads,
                updated_at = excluded.updated_at
            "#,
        )
        .bind(id)
        .bind(&asset.asset_id)
        .bind(&asset.asset_type)
        .bind(&asset.version)
        .bind(&asset.name)
        .bind(&asset.description)
        .bind(&asset.author)
        .bind(&asset.trust_tier)
        .bind(&asset.status)
        .bind(asset.downloads)
        .bind(created_at)
        .bind(updated_at)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn search_assets(&self, filters: &AssetSearchFilters) -> Result<AssetSearchResult> {
        let limit = filters.limit.unwrap_or(20) as i64;
        let offset = filters.offset.unwrap_or(0) as i64;

        let mut query = QueryBuilder::<Sqlite>::new(
            "SELECT DISTINCT a.id, a.asset_id, a.asset_type, a.version, a.name, a.description, \
             a.author, a.trust_tier, a.status, a.downloads, a.created_at, a.updated_at \
             FROM assets a",
        );

        query.push(
            " LEFT JOIN (\
                SELECT asset_id, \
                       AVG(CASE WHEN scale = '1-10' THEN rating / 2.0 ELSE rating END) AS avg_rating, \
                       COUNT(*) AS rating_count \
                FROM ratings \
                GROUP BY asset_id\
            ) r ON a.asset_id = r.asset_id",
        );

        if filters
            .tags
            .as_ref()
            .map(|t| !t.is_empty())
            .unwrap_or(false)
        {
            query.push(" LEFT JOIN asset_tags t ON a.asset_id = t.asset_id");
        }

        query.push(" WHERE 1=1");
        apply_asset_filters(&mut query, filters);
        apply_sort(&mut query, filters);

        query.push(" LIMIT ").push_bind(limit);
        query.push(" OFFSET ").push_bind(offset);

        let rows: Vec<AssetRow> = query.build_query_as().fetch_all(&self.pool).await?;
        let assets = rows.into_iter().map(asset_from_row).collect::<Vec<_>>();

        let mut count_query =
            QueryBuilder::<Sqlite>::new("SELECT COUNT(DISTINCT a.asset_id) FROM assets a");
        count_query.push(
            " LEFT JOIN (\
                SELECT asset_id, \
                       AVG(CASE WHEN scale = '1-10' THEN rating / 2.0 ELSE rating END) AS avg_rating, \
                       COUNT(*) AS rating_count \
                FROM ratings \
                GROUP BY asset_id\
            ) r ON a.asset_id = r.asset_id",
        );

        if filters
            .tags
            .as_ref()
            .map(|t| !t.is_empty())
            .unwrap_or(false)
        {
            count_query.push(" LEFT JOIN asset_tags t ON a.asset_id = t.asset_id");
        }

        count_query.push(" WHERE 1=1");
        apply_asset_filters(&mut count_query, filters);

        let total: i64 = count_query
            .build_query_scalar()
            .fetch_one(&self.pool)
            .await?;
        let page = if limit > 0 { (offset / limit) + 1 } else { 1 };

        Ok(AssetSearchResult {
            assets,
            total,
            page,
            per_page: limit,
            filters: filters.clone(),
        })
    }

    pub async fn submit_rating(&self, submission: &RatingSubmission) -> Result<()> {
        submission
            .validate()
            .map_err(MarketplaceError::Validation)?;

        let exists: Option<(String,)> =
            sqlx::query_as("SELECT asset_id FROM assets WHERE asset_id = ?")
                .bind(&submission.asset_id)
                .fetch_optional(&self.pool)
                .await?;

        if exists.is_none() {
            return Err(MarketplaceError::NotFound(format!(
                "asset {} not found",
                submission.asset_id
            )));
        }

        let now = Utc::now().to_rfc3339();
        sqlx::query(
            r#"
            INSERT INTO ratings (asset_id, rating, scale, comment, user_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&submission.asset_id)
        .bind(submission.rating)
        .bind(&submission.scale)
        .bind(&submission.comment)
        .bind(&submission.user_id)
        .bind(now)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn get_rating_summary(&self, asset_id: &str) -> Result<AssetRatingSummary> {
        let row = sqlx::query(
            r#"
            SELECT
                COUNT(*) as total_ratings,
                AVG(CASE WHEN scale = '1-10' THEN rating / 2.0 ELSE rating END) as avg_rating,
                SUM(CASE WHEN (CASE WHEN scale = '1-10' THEN ROUND(rating / 2.0) ELSE rating END) = 1 THEN 1 ELSE 0 END) as one_star,
                SUM(CASE WHEN (CASE WHEN scale = '1-10' THEN ROUND(rating / 2.0) ELSE rating END) = 2 THEN 1 ELSE 0 END) as two_star,
                SUM(CASE WHEN (CASE WHEN scale = '1-10' THEN ROUND(rating / 2.0) ELSE rating END) = 3 THEN 1 ELSE 0 END) as three_star,
                SUM(CASE WHEN (CASE WHEN scale = '1-10' THEN ROUND(rating / 2.0) ELSE rating END) = 4 THEN 1 ELSE 0 END) as four_star,
                SUM(CASE WHEN (CASE WHEN scale = '1-10' THEN ROUND(rating / 2.0) ELSE rating END) = 5 THEN 1 ELSE 0 END) as five_star
            FROM ratings
            WHERE asset_id = ?
            "#,
        )
        .bind(asset_id)
        .fetch_one(&self.pool)
        .await?;

        let total_ratings: i64 = row.get::<i64, _>("total_ratings");
        if total_ratings == 0 {
            return Ok(AssetRatingSummary::new(asset_id.to_string(), 0.0, 0));
        }

        let average_rating: f64 = row.get::<Option<f64>, _>("avg_rating").unwrap_or(0.0);
        let one_star: i64 = row.get::<Option<i64>, _>("one_star").unwrap_or(0);
        let two_star: i64 = row.get::<Option<i64>, _>("two_star").unwrap_or(0);
        let three_star: i64 = row.get::<Option<i64>, _>("three_star").unwrap_or(0);
        let four_star: i64 = row.get::<Option<i64>, _>("four_star").unwrap_or(0);
        let five_star: i64 = row.get::<Option<i64>, _>("five_star").unwrap_or(0);

        Ok(AssetRatingSummary {
            asset_id: asset_id.to_string(),
            average_rating,
            total_ratings,
            one_star,
            two_star,
            three_star,
            four_star,
            five_star,
        })
    }

    pub async fn get_featured_assets(&self) -> Result<FeaturedAssets> {
        let rows: Vec<AssetRow> = sqlx::query_as(
            r#"
            SELECT id, asset_id, asset_type, version, name, description, author, trust_tier,
                   status, downloads, created_at, updated_at
            FROM assets
            WHERE featured = 1
            ORDER BY updated_at DESC
            "#,
        )
        .fetch_all(&self.pool)
        .await?;

        let assets = rows.into_iter().map(asset_from_row).collect::<Vec<_>>();
        let updated_at = assets
            .iter()
            .map(|asset| asset.updated_at.clone())
            .max()
            .unwrap_or_else(|| Utc::now().to_rfc3339());

        Ok(FeaturedAssets {
            assets,
            updated_at,
            categories: None,
        })
    }

    pub async fn increment_downloads(&self, increment: &DownloadCountIncrement) -> Result<()> {
        let result = sqlx::query(
            "UPDATE assets SET downloads = downloads + 1, updated_at = ? WHERE asset_id = ?",
        )
        .bind(Utc::now().to_rfc3339())
        .bind(&increment.asset_id)
        .execute(&self.pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(MarketplaceError::NotFound(format!(
                "asset {} not found",
                increment.asset_id
            )));
        }

        Ok(())
    }

    pub async fn get_category_tree(&self) -> Result<Vec<CategoryTree>> {
        let rows = sqlx::query(
            r#"
            SELECT slug, name, description, parent_slug
            FROM categories
            ORDER BY name ASC
            "#,
        )
        .fetch_all(&self.pool)
        .await?;

        if rows.is_empty() {
            return Ok(Vec::new());
        }

        let counts = sqlx::query(
            r#"
            SELECT category_id, COUNT(*) as asset_count
            FROM assets
            WHERE category_id IS NOT NULL
            GROUP BY category_id
            "#,
        )
        .fetch_all(&self.pool)
        .await?;

        let mut count_map: HashMap<String, i64> = HashMap::new();
        for row in counts {
            let category_id: String = row.get("category_id");
            let asset_count: i64 = row.get("asset_count");
            count_map.insert(category_id, asset_count);
        }

        let mut nodes: HashMap<String, CategoryTree> = HashMap::new();
        let mut parents: HashMap<String, Option<String>> = HashMap::new();

        for row in rows {
            let slug: String = row.get("slug");
            let name: String = row.get("name");
            let description: String = row
                .get::<Option<String>, _>("description")
                .unwrap_or_default();
            let parent_slug: Option<String> = row.get::<Option<String>, _>("parent_slug");
            let asset_count = count_map.get(&slug).copied().unwrap_or(0);

            nodes.insert(
                slug.clone(),
                CategoryTree {
                    slug: slug.clone(),
                    name,
                    description,
                    parent_slug: parent_slug.clone(),
                    asset_count,
                    children: None,
                },
            );
            parents.insert(slug, parent_slug);
        }

        for (slug, parent) in parents.clone() {
            if let Some(parent_slug) = parent {
                if let Some(child_node) = nodes.get(&slug).cloned() {
                    if let Some(parent_node) = nodes.get_mut(&parent_slug) {
                        parent_node
                            .children
                            .get_or_insert_with(Vec::new)
                            .push(child_node);
                    }
                }
            }
        }

        let mut roots = Vec::new();
        for (slug, parent) in parents {
            if parent.is_none() {
                if let Some(node) = nodes.get(&slug).cloned() {
                    roots.push(node);
                }
            }
        }

        Ok(roots)
    }

    pub async fn get_publisher_profile(&self, author: &str) -> Result<PublisherProfile> {
        let rows: Vec<AssetRow> = sqlx::query_as(
            r#"
            SELECT id, asset_id, asset_type, version, name, description, author, trust_tier,
                   status, downloads, created_at, updated_at
            FROM assets
            WHERE author = ?
            ORDER BY created_at DESC
            "#,
        )
        .bind(author)
        .fetch_all(&self.pool)
        .await?;

        if rows.is_empty() {
            return Err(MarketplaceError::NotFound(format!(
                "publisher {} not found",
                author
            )));
        }

        let assets = rows.into_iter().map(asset_from_row).collect::<Vec<_>>();
        let total_assets = assets.len() as i64;
        let total_downloads = assets.iter().map(|asset| asset.downloads).sum();
        let verified = assets.iter().any(|asset| {
            matches!(
                asset.trust_tier.as_str(),
                "verified" | "official" | "trusted"
            )
        });

        let rating_row = sqlx::query(
            r#"
            SELECT
                AVG(CASE WHEN scale = '1-10' THEN rating / 2.0 ELSE rating END) as avg_rating,
                COUNT(*) as rating_count
            FROM ratings r
            JOIN assets a ON r.asset_id = a.asset_id
            WHERE a.author = ?
            "#,
        )
        .bind(author)
        .fetch_one(&self.pool)
        .await?;

        let reputation_score = match rating_row.get::<i64, _>("rating_count") {
            0 => None,
            _ => rating_row.get::<Option<f64>, _>("avg_rating"),
        };

        let member_since = assets.iter().map(|asset| asset.created_at.clone()).min();

        Ok(PublisherProfile {
            name: author.to_string(),
            email: None,
            website: None,
            verified,
            reputation_score,
            total_assets,
            total_downloads,
            member_since,
            assets: Some(assets),
        })
    }
}

fn asset_from_row(row: AssetRow) -> Asset {
    let id = row.id.and_then(|val| Uuid::parse_str(&val).ok());

    Asset {
        id,
        asset_id: row.asset_id,
        asset_type: row.asset_type,
        version: row.version,
        name: row.name,
        description: row.description,
        author: row.author,
        trust_tier: row.trust_tier,
        status: row.status,
        downloads: row.downloads,
        created_at: row.created_at,
        updated_at: row.updated_at,
    }
}

fn apply_asset_filters(builder: &mut QueryBuilder<Sqlite>, filters: &AssetSearchFilters) {
    if let Some(query) = filters
        .query
        .as_ref()
        .map(|q| q.trim())
        .filter(|q| !q.is_empty())
    {
        let pattern = format!("%{}%", query.to_lowercase());
        builder.push(" AND (");
        builder
            .push("LOWER(a.name) LIKE ")
            .push_bind(pattern.clone());
        builder
            .push(" OR LOWER(a.description) LIKE ")
            .push_bind(pattern.clone());
        builder
            .push(" OR LOWER(a.asset_id) LIKE ")
            .push_bind(pattern);
        builder.push(")");
    }

    if let Some(asset_type) = &filters.asset_type {
        builder
            .push(" AND a.asset_type = ")
            .push_bind(asset_type.clone());
    }

    if let Some(source_type) = &filters.source_type {
        builder
            .push(" AND a.source_type = ")
            .push_bind(source_type.clone());
    }

    if let Some(category_id) = &filters.category_id {
        builder
            .push(" AND a.category_id = ")
            .push_bind(category_id.clone());
    }

    if let Some(publisher_id) = &filters.publisher_id {
        builder
            .push(" AND (a.publisher_id = ")
            .push_bind(publisher_id.clone());
        builder
            .push(" OR a.author = ")
            .push_bind(publisher_id.clone());
        builder.push(")");
    }

    if let Some(trust_tier) = &filters.trust_tier {
        builder
            .push(" AND a.trust_tier = ")
            .push_bind(trust_tier.clone());
    }

    if let Some(status) = &filters.status {
        builder.push(" AND a.status = ").push_bind(status.clone());
    }

    if let Some(min_rating) = filters.min_rating {
        builder
            .push(" AND COALESCE(r.avg_rating, 0) >= ")
            .push_bind(min_rating);
    }

    if let Some(max_rating) = filters.max_rating {
        builder
            .push(" AND COALESCE(r.avg_rating, 0) <= ")
            .push_bind(max_rating);
    }

    if let Some(min_downloads) = filters.min_downloads {
        builder
            .push(" AND a.downloads >= ")
            .push_bind(min_downloads);
    }

    if let Some(max_downloads) = filters.max_downloads {
        builder
            .push(" AND a.downloads <= ")
            .push_bind(max_downloads);
    }

    if filters.featured_only {
        builder.push(" AND a.featured = 1");
    }

    if let Some(tags) = filters.tags.as_ref().filter(|t| !t.is_empty()) {
        builder.push(" AND t.tag IN (");
        let mut separated = builder.separated(", ");
        for tag in tags {
            separated.push_bind(tag.clone());
        }
        builder.push(")");
    }
}

fn apply_sort(builder: &mut QueryBuilder<Sqlite>, filters: &AssetSearchFilters) {
    match filters.sort_by {
        Some(AssetSortBy::Newest) => builder.push(" ORDER BY a.created_at DESC"),
        Some(AssetSortBy::Oldest) => builder.push(" ORDER BY a.created_at ASC"),
        Some(AssetSortBy::MostDownloads) => builder.push(" ORDER BY a.downloads DESC"),
        Some(AssetSortBy::HighestRated) => builder
            .push(" ORDER BY COALESCE(r.avg_rating, 0) DESC, COALESCE(r.rating_count, 0) DESC"),
        Some(AssetSortBy::MostReviews) => builder
            .push(" ORDER BY COALESCE(r.rating_count, 0) DESC, COALESCE(r.avg_rating, 0) DESC"),
        Some(AssetSortBy::Relevance) => builder.push(" ORDER BY a.name ASC"),
        None => builder.push(" ORDER BY a.name ASC"),
    };
}
