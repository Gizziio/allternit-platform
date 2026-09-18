#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_filters() {
        let filters = AssetSearchFilters {
            query: Some("test".to_string()),
            asset_type: Some("skill".to_string()),
            limit: Some(10),
            offset: Some(0),
        };

        assert_eq!(filters.query, Some("test".to_string()));
        assert_eq!(filters.limit, Some(10));
    }

    #[test]
    fn test_trust_tier_filter() {
        let filters = AssetSearchFilters {
            trust_tier: Some("verified".to_string()),
        };
        assert_eq!(filters.trust_tier, Some("verified".to_string()));
    }

    #[test]
    fn test_featured_only() {
        let filters = AssetSearchFilters {
            featured_only: true,
        };
        assert!(filters.featured_only);
    }

    #[test]
    fn test_tags_filter() {
        let filters = AssetSearchFilters {
            tags: Some(vec![
                "network".to_string(),
                "security".to_string(),
            ]),
        };
        assert_eq!(filters.tags.unwrap().len(), 2);
    }

    #[test]
    fn test_rating_range_filter() {
        let filters = AssetSearchFilters {
            min_rating: Some(3.0),
            max_rating: Some(5.0),
        };
        assert_eq!(filters.min_rating, Some(3.0));
        assert_eq!(filters.max_rating, Some(5.0));
    }

    #[test]
    fn test_rating_summary() {
        let summary = AssetRatingSummary::new(
            "test-asset".to_string(),
            4.5,
            10,
        );
        assert_eq!(summary.average_rating, 4.5);
        assert_eq!(summary.total_ratings, 10);
        assert_eq!(summary.one_star, 0);
        assert_eq!(summary.five_star, 0);
    }

    #[test]
    fn test_rating_counts_total() {
        let summary = AssetRatingSummary::new(
            "test".to_string(),
            4.0,
            10,
        );
        let total = summary.one_star
            + summary.two_star
            + summary.three_star
            + summary.four_star
            + summary.five_star;
        assert_eq!(total, 10);
    }

    #[test]
    fn test_category_tree() {
        let leaf = CategoryTree {
            slug: "network".to_string(),
            name: "Network".to_string(),
            description: "".to_string(),
            parent_slug: None,
            asset_count: 0,
            children: None,
        };
        assert!(leaf.slug == "network");
        assert!(leaf.parent_slug.is_none());
    }

    #[test]
    fn test_category_with_children() {
        let mut children = Vec::new();
        children.push(CategoryTree {
            slug: "tcp".to_string(),
            name: "TCP".to_string(),
            description: "".to_string(),
            parent_slug: Some("network".to_string()),
            asset_count: 0,
            children: None,
        });
        children.push(CategoryTree {
            slug: "udp".to_string(),
            name: "UDP".to_string(),
            description: "".to_string(),
            parent_slug: Some("network".to_string()),
            asset_count: 0,
            children: None,
        });

        let parent = CategoryTree {
            slug: "network".to_string(),
            name: "Network".to_string(),
            description: "".to_string(),
            parent_slug: None,
            asset_count: 2,
            children: Some(children),
        };
        assert!(parent.children.is_some());
    }

    #[test]
    fn test_pack_status_values() {
        assert_eq!(PackStatus::Available, PackStatus::Available);
        assert_eq!(PackStatus::Instaling, PackStatus::Instaling);
        assert_eq!(PackStatus::Installed, PackStatus::Installed);
        assert_eq!(PackStatus::Activated, PackStatus::Activated);
        assert_eq!(PackStatus::Error, PackStatus::Error);
        assert_eq!(PackStatus::Upgrading, PackStatus::Upgrading);
    }

    #[test]
    fn test_rating_validation_1_to_5() {
        for rating in 1..=5 {
            let submission = RatingSubmission {
                asset_id: "test-asset".to_string(),
                rating,
                scale: "1-5".to_string(),
                comment: "Great!".to_string(),
                user_id: None,
            };
            assert!(submission.validate().is_ok());
            assert_eq!(submission.rating, rating);
        }
    }

    #[test]
    fn test_rating_validation_below_1() {
        let submission = RatingSubmission {
            asset_id: "test".to_string(),
            rating: 0,
            scale: "1-5".to_string(),
            comment: "".to_string(),
            user_id: None,
        };
        assert!(submission.validate().is_err());
    }

    #[test]
    fn test_rating_validation_above_5() {
        let submission = RatingSubmission {
            asset_id: "test".to_string(),
            rating: 6,
            scale: "1-5".to_string(),
            comment: "".to_string(),
            user_id: None,
        };
        assert!(submission.validate().is_err());
    }

    #[test]
    fn test_rating_validation_invalid_scale() {
        let submission = RatingSubmission {
            asset_id: "test".to_string(),
            rating: 5,
            scale: "invalid".to_string(),
            comment: "".to_string(),
            user_id: None,
        };
        assert!(submission.validate().is_err());
    }

    #[test]
    fn test_rating_with_comment() {
        let submission = RatingSubmission {
            asset_id: "test".to_string(),
            rating: 5,
            scale: "1-5".to_string(),
            comment: "Excellent tool!".to_string(),
            user_id: None,
        };
        assert_eq!(submission.comment, "Excellent tool!");
    }

    #[test]
    fn test_simple_dependency_graph() {
        use std::collections::HashMap;

        let mut nodes: HashMap<String, Asset> = HashMap::new();
        let mut edges: HashMap<String, Vec<String>> = HashMap::new();

        let base_asset = Asset {
            id: None,
            asset_id: "base".to_string(),
            asset_type: "tool".to_string(),
            version: "1.0".to_string(),
            name: "Base".to_string(),
            description: "".to_string(),
            author: "test".to_string(),
            trust_tier: "community".to_string(),
            status: "available".to_string(),
            created_at: "".to_string(),
            updated_at: "".to_string(),
        };

        let dep1_asset = Asset {
            id: None,
            asset_id: "dep1".to_string(),
            asset_type: "tool".to_string(),
            version: "1.0".to_string(),
            name: "Dep 1".to_string(),
            description: "".to_string(),
            author: "test".to_string(),
            trust_tier: "community".to_string(),
            status: "available".to_string(),
            created_at: "".to_string(),
            updated_at: "".to_string(),
        };

        let dep2_asset = Asset {
            id: None,
            asset_id: "dep2".to_string(),
            asset_type: "tool".to_string(),
            version: "1.0".to_string(),
            name: "Dep 2".to_string(),
            description: "".to_string(),
            author: "test".to_string(),
            trust_tier: "community".to_string(),
            status: "available".to_string(),
            created_at: "".to_string(),
            updated_at: "".to_string(),
        };

        nodes.insert("base".to_string(), base_asset);
        nodes.insert("dep1".to_string(), dep1_asset);
        nodes.insert("dep2".to_string(), dep2_asset);

        edges.insert("dep1".to_string(), vec!["base".to_string()]);
        edges.insert("dep2".to_string(), vec!["base".to_string()]);

        let graph = PackDependencyGraph::new(nodes, edges);
        let result = graph.topological_sort();

        assert!(result.contains(&"base".to_string()));
        assert!(result.contains(&"dep1".to_string()));
        assert!(result.contains(&"dep2".to_string()));
        let base_idx = result.iter().position(|x| x == "base").unwrap();
        let dep1_idx = result.iter().position(|x| x == "dep1").unwrap();
        assert!(base_idx < dep1_idx);
    }

    #[test]
    fn test_circular_dependency_detection() {
        use std::collections::HashMap;

        let mut nodes: HashMap<String, Asset> = HashMap::new();
        let mut edges: HashMap<String, Vec<String>> = HashMap::new();

        let a_asset = Asset {
            id: None,
            asset_id: "a".to_string(),
            asset_type: "tool".to_string(),
            version: "1.0".to_string(),
            name: "A".to_string(),
            description: "".to_string(),
            author: "test".to_string(),
            trust_tier: "community".to_string(),
            status: "available".to_string(),
            created_at: "".to_string(),
            updated_at: "".to_string(),
        };

        let b_asset = Asset {
            id: None,
            asset_id: "b".to_string(),
            asset_type: "tool".to_string(),
            version: "1.0".to_string(),
            name: "B".to_string(),
            description: "".to_string(),
            author: "test".to_string(),
            trust_tier: "community".to_string(),
            status: "available".to_string(),
            created_at: "".to_string(),
            updated_at: "".to_string(),
        };

        let c_asset = Asset {
            id: None,
            asset_id: "c".to_string(),
            asset_type: "tool".to_string(),
            version: "1.0".to_string(),
            name: "C".to_string(),
            description: "".to_string(),
            author: "test".to_string(),
            trust_tier: "community".to_string(),
            status: "available".to_string(),
            created_at: "".to_string(),
            updated_at: "".to_string(),
        };

        nodes.insert("a".to_string(), a_asset);
        nodes.insert("b".to_string(), b_asset);
        nodes.insert("c".to_string(), c_asset);

        edges.insert("a".to_string(), vec!["b".to_string()]);
        edges.insert("b".to_string(), vec!["c".to_string()]);
        edges.insert("c".to_string(), vec!["a".to_string()]);

        let graph = PackDependencyGraph::new(nodes, edges);

        assert!(graph.topological_sort().is_err());
    }

    #[test]
    fn test_complex_dependency_graph() {
        use std::collections::HashMap;

        let mut nodes: HashMap<String, Asset> = HashMap::new();
        let mut edges: HashMap<String, Vec<String>> = HashMap::new();

        let base = Asset {
            id: None,
            asset_id: "base".to_string(),
            asset_type: "tool".to_string(),
            version: "1.0".to_string(),
            name: "Base".to_string(),
            description: "".to_string(),
            author: "test".to_string(),
            trust_tier: "community".to_string(),
            status: "available".to_string(),
            created_at: "".to_string(),
            updated_at: "".to_string(),
        };

        let mid1 = Asset {
            id: None,
            asset_id: "mid1".to_string(),
            asset_type: "tool".to_string(),
            version: "1.0".to_string(),
            name: "Mid 1".to_string(),
            description: "".to_string(),
            author: "test".to_string(),
            trust_tier: "community".to_string(),
            status: "available".to_string(),
            created_at: "".to_string(),
            updated_at: "".to_string(),
        };

        let mid2 = Asset {
            id: None,
            asset_id: "mid2".to_string(),
            asset_type: "tool".to_string(),
            version: "1.0".to_string(),
            name: "Mid 2".to_string(),
            description: "".to_string(),
            author: "test".to_string(),
            trust_tier: "community".to_string(),
            status: "available".to_string(),
            created_at: "".to_string(),
            updated_at: "".to_string(),
        };

        let top = Asset {
            id: None,
            asset_id: "top".to_string(),
            asset_type: "tool".to_string(),
            version: "1.0".to_string(),
            name: "Top".to_string(),
            description: "".to_string(),
            author: "test".to_string(),
            trust_tier: "community".to_string(),
            status: "available".to_string(),
            created_at: "".to_string(),
            updated_at: "".to_string(),
        };

        nodes.insert("base".to_string(), base);
        nodes.insert("mid1".to_string(), mid1);
        nodes.insert("mid2".to_string(), mid2);
        nodes.insert("top".to_string(), top);

        edges.insert("mid1".to_string(), vec!["base".to_string()]);
        edges.insert("mid2".to_string(), vec!["base".to_string()]);
        edges.insert("top".to_string(), vec!["mid1".to_string(), "mid2".to_string()]);

        let graph = PackDependencyGraph::new(nodes, edges);
        let result = graph.topological_sort().unwrap();

        assert_eq!(result.len(), 4);
        assert_eq!(result[0], "base");
        assert_eq!(result[1], "mid1");
        assert_eq!(result[2], "mid2");
        assert_eq!(result[3], "top");
    }
}
