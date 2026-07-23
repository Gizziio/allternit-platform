use crate::types::Cost;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Tracks costs across the system
#[derive(Debug)]
pub struct CostTracker {
    total_cost: Arc<RwLock<Cost>>,
    budget_limit: Option<f64>,
}

impl CostTracker {
    pub fn new() -> Self {
        Self {
            total_cost: Arc::new(RwLock::new(Cost::default())),
            budget_limit: None,
        }
    }

    pub fn with_budget_limit(mut self, limit: f64) -> Self {
        self.budget_limit = Some(limit);
        self
    }

    /// Record a cost
    pub async fn record(&self, cost: Cost) -> Result<(), String> {
        let mut total = self.total_cost.write().await;
        total.add(&cost);

        if let Some(limit) = self.budget_limit {
            if total.estimated_usd > limit {
                return Err(format!(
                    "Budget exceeded: ${:.2} of ${:.2}",
                    total.estimated_usd, limit
                ));
            }
        }

        Ok(())
    }

    /// Get current total cost
    pub async fn current(&self) -> Cost {
        *self.total_cost.read().await
    }

    /// Check if budget is exceeded
    pub async fn is_exceeded(&self) -> bool {
        if let Some(limit) = self.budget_limit {
            let total = self.total_cost.read().await;
            total.estimated_usd > limit
        } else {
            false
        }
    }

    /// Reset the tracker
    pub async fn reset(&self) {
        let mut total = self.total_cost.write().await;
        *total = Cost::default();
    }
}

impl Default for CostTracker {
    fn default() -> Self {
        Self::new()
    }
}
