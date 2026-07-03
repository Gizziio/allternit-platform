#[cfg(test)]
mod tests {
    use crate::service::*;
    use crate::models::*;

    async fn create_test_pool() -> SqlitePool {
        sqlx::SqlitePool::connect("sqlite::file::memory:?").await.unwrap()
    }

    #[tokio::test]
    async fn test_marketplace_service_creation() {
        let pool = create_test_pool().await;
        let service = MarketplaceService::new(pool).await;
        
        assert_eq!(service.pool.read().await.marketplace_service.is_some());
    }

    #[tokio::test]
    async fn test_search_assets_with_empty_filters() {
        let pool = create_test_pool().await;
        let service = MarketplaceService::new(pool).await;

        let result = service.search_assets(&AssetSearchFilters::default()).await.unwrap();
        assert!(result.assets.is_empty());
        assert_eq!(result.total, 0);
        assert_eq!(result.page, 1);
        assert_eq!(result.per_page, 20);
    }

    #[tokio::test]
    async fn test_search_assets_with_query() {
        let pool = create_test_pool().await;
        let service = MarketplaceService::new(pool).await;

        let test_asset = Asset {
            id: None,
            asset_id: "test-query-asset".to_string(),
            asset_type: "tool".to_string(),
            version: "1.0.0".to_string(),
            name: "Test Query Asset".to_string(),
            description: "Test asset for query search".to_string(),
            author: "test-author".to_string(),
            trust_tier: "community".to_string(),
            status: "published".to_string(),
            created_at: "2025-01-01T00:00:00Z".to_string(),
            updated_at: "2025-01-01T00:00:00Z".to_string(),
        };

        service.register_asset(&test_asset).await.unwrap();

        let filters = AssetSearchFilters {
            query: Some("Test Query".to_string()),
            ..Default::default()
        };

        let result = service.search_assets(&filters).await.unwrap();
        assert!(result.is_ok());
        assert_eq!(result.assets.len(), 1);
        assert_eq!(result.assets[0].name, "Test Query Asset");
    }

    #[tokio::test]
    async fn test_search_with_filters() {
        let pool = create_test_pool().await;
        let service = MarketplaceService::new(pool).await;

        for i in 0..3 {
            let asset = Asset {
                id: None,
                asset_id: format!("test-filter-asset-{}", i),
                asset_type: if i % 2 == 0 { "tool".to_string() } else { "skill".to_string() },
                version: "1.0.0".to_string(),
                name: format!("Test Asset {}", i),
                description: format!("Test asset for filter {}", i),
                author: "test-author".to_string(),
                trust_tier: "verified".to_string(),
                status: "published".to_string(),
                created_at: "2025-01-01T00:00:00Z".to_string(),
                updated_at: "2025-01-01T00:00:00Z".to_string(),
            };

            service.register_asset(&asset).await.unwrap();
        }

        let filters = AssetSearchFilters {
            asset_type: Some("tool".to_string()),
            ..Default::default()
        };

        let result = service.search_assets(&filters).await.unwrap();
        assert!(result.is_ok());
        assert_eq!(result.assets.len(), 3);
    }

    #[tokio::test]
    async fn test_rating_submission() {
        let pool = create_test_pool().await;
        let service = MarketplaceService::new(pool).await;

        let test_asset = Asset {
            id: None,
            asset_id: "test-rating-asset".to_string(),
            asset_type: "tool".to_string(),
            version: "1.0.0".to_string(),
            name: "Test Rating Asset".to_string(),
            description: "Test asset for rating functionality".to_string(),
            author: "test-author".to_string(),
            trust_tier: "community".to_string(),
            status: "published".to_string(),
            created_at: "2025-01-01T00:00:00Z".to_string(),
            updated_at: "2025-01-01T00:00:00Z".to_string(),
        };

        service.register_asset(&test_asset).await.unwrap();

        let submission = RatingSubmission {
            asset_id: "test-rating-asset".to_string(),
            rating: 5,
            scale: "1-5".to_string(),
            comment: "Excellent asset!".to_string(),
            user_id: None,
        };

        service.submit_rating(&submission).await.unwrap();

        let summary = service.get_rating_summary("test-rating-asset").await.unwrap();
        assert_eq!(summary.asset_id, "test-rating-asset");
        assert_eq!(summary.total_ratings, 1);
        assert_eq!(summary.average_rating, 5.0);
        assert_eq!(summary.five_star, 1);
    }

    #[tokio::test]
    async fn test_invalid_rating_validation() {
        let pool = create_test_pool().await;
        let service = MarketplaceService::new(pool).await;

        let asset = Asset {
            id: None,
            asset_id: "test-validation-asset".to_string(),
            asset_type: "tool".to_string(),
            version: "1.0.0".to_string(),
            name: "Test Validation Asset".to_string(),
            description: "Test asset for invalid rating validation".to_string(),
            author: "test-author".to_string(),
            trust_tier: "community".to_string(),
            status: "published".to_string(),
            created_at: "2025-01-01T00:00:00Z".to_string(),
            updated_at: "2025-01-01T00:00:00Z".to_string(),
        };

        service.register_asset(&asset).await.unwrap();

        let submission = RatingSubmission {
            asset_id: "test-validation-asset".to_string(),
            rating: 0,
            scale: "1-5".to_string(),
            comment: "".to_string(),
            user_id: None,
        };

        let result = submission.validate();
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_rating_scale_validation() {
        let pool = create_test_pool().await;
        let service = MarketplaceService::new(pool).await;

        let submission = RatingSubmission {
            asset_id: "test-scale-asset".to_string(),
            rating: 5,
            scale: "invalid-scale".to_string(),
            comment: "".to_string(),
            user_id: None,
        };

        let result = submission.validate();
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("scale must be '1-5' or '1-10'"));
    }

    #[tokio::test]
    async fn test_download_count_increment() {
        let pool = create_test_pool().await;
        let service = MarketplaceService::new(pool).await;

        let asset = Asset {
            id: None,
            asset_id: "test-download-asset".to_string(),
            asset_type: "tool".to_string(),
            version: "1.0.0".to_string(),
            name: "Test Download Asset".to_string(),
            description: "Test asset for download tracking".to_string(),
            author: "test-author".to_string(),
            trust_tier: "community".to_string(),
            status: "published".to_string(),
            created_at: "2025-01-01T00:00:00Z".to_string(),
            updated_at: "2025-01-01T00:00:00Z".to_string(),
            downloads: 100,
        };

        service.register_asset(&asset).await.unwrap();

        let increment = DownloadCountIncrement {
            asset_id: "test-download-asset".to_string(),
            user_id: None,
        };

        service.increment_downloads(&increment).await.unwrap();

        let filters = AssetSearchFilters {
            query: Some("Download".to_string()),
            ..Default::default()
        };

        let result = service.search_assets(&filters).await.unwrap();
        assert!(result.is_ok());
        assert_eq!(result.assets.len(), 1);
        assert_eq!(result.assets[0].downloads, 101);
    }

    #[tokio::test]
    async fn test_category_tree() {
        let pool = create_test_pool().await;
        let service = MarketplaceService::new(pool).await;

        let categories = service.get_category_tree().await.unwrap();
        assert!(!categories.is_empty());
    }

    #[tokio::test]
    async fn test_publisher_profile() {
        let pool = create_test_pool().await;
        let service = MarketplaceService::new(pool).await;

        let asset = Asset {
            id: None,
            asset_id: "test-publisher-asset".to_string(),
            asset_type: "tool".to_string(),
            version: "1.0.0".to_string(),
            name: "Publisher Test Asset".to_string(),
            description: "Test asset for publisher profile".to_string(),
            author: "publisher-test".to_string(),
            trust_tier: "community".to_string(),
            status: "published".to_string(),
            created_at: "2025-01-01T00:00:00Z".to_string(),
            updated_at: "2025-01-01T00:00:00Z".to_string(),
        };

        service.register_asset(&asset).await.unwrap();

        let profile = service.get_publisher_profile("publisher-test").await.unwrap();
        assert_eq!(profile.name, "publisher-test");
        assert!(profile.assets.is_some());
        assert!(!profile.assets.unwrap().is_empty());
    }

    #[tokio::test]
    async fn test_featured_assets() {
        let pool = create_test_pool().await;
        let service = MarketplaceService::new(pool).await;

        let featured = service.get_featured_assets().await.unwrap();
        assert!(featured.assets.is_empty());
    }

    #[tokio::test]
    async fn test_multiple_filters() {
        let pool = create_test_pool().await;
        let service = MarketplaceService::new(pool).await;

        let trusted_asset = Asset {
            id: None,
            asset_id: "test-verified-asset".to_string(),
            asset_type: "tool".to_string(),
            version: "1.0.0".to_string(),
            name: "Trusted Asset".to_string(),
            description: "Test asset for verified tier".to_string(),
            author: "test-author".to_string(),
            trust_tier: "verified".to_string(),
            status: "published".to_string(),
            created_at: "2025-01-01T00:00:00Z".to_string(),
            updated_at: "2025-01-01T00:00:00Z".to_string(),
        };

        service.register_asset(&trusted_asset).await.unwrap();

        let community_asset = Asset {
            id: None,
            asset_id: "test-community-asset".to_string(),
            asset_type: "skill".to_string(),
            version: "1.0.0".to_string(),
            name: "Community Asset".to_string(),
            description: "Test asset for community tier".to_string(),
            author: "test-author".to_string(),
            trust_tier: "community".to_string(),
            status: "published".to_string(),
            created_at: "2025-01-01T00:00:00Z".to_string(),
            updated_at: "2025-01-01T00:00:00Z".to_string(),
        };

        service.register_asset(&community_asset).await.unwrap();

        let filters = AssetSearchFilters {
            trust_tier: Some("verified".to_string()),
            ..Default::default()
        };

        let result = service.search_assets(&filters).await.unwrap();
        assert!(result.is_ok());
        assert_eq!(result.assets.len(), 1);
        assert_eq!(result.assets[0].trust_tier, "verified");
    }

    #[tokio::test]
    async fn test_asset_pagination() {
        let pool = create_test_pool().await;
        let service = MarketplaceService::new(pool).await;

        for i in 0..5 {
            let asset = Asset {
                id: None,
                asset_id: format!("test-asset-{}", i),
                asset_type: "tool".to_string(),
                version: "1.0.0".to_string(),
                name: format!("Test Asset {}", i),
                description: "Test asset for pagination".to_string(),
                author: "test-author".to_string(),
                trust_tier: "community".to_string(),
                status: "published".to_string(),
                created_at: "2025-01-01T00:00:00Z".to_string(),
                updated_at: "2025-01-01T00:00:00Z".to_string(),
            };

            service.register_asset(&asset).await.unwrap();
        }

        for (page, expected_count) in [(0, 10), (1, 20), (2, 40), (3, 60), (4, 80), (5, 100)] {
            let filters = AssetSearchFilters {
                limit: Some(expected_count),
                offset: Some(page * expected_count),
                ..Default::default()
            };

            let result = service.search_assets(&filters).await.unwrap();
            assert!(result.is_ok());
            assert_eq!(result.assets.len(), expected_count as i64);
            assert_eq!(result.page, page as i64 + 1);
            assert_eq!(result.per_page, expected_count);
        }
    }
}
