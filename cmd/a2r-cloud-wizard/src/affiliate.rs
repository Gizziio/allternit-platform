//! Affiliate/Referral Tracking Module
//!
//! Tracks referral links for monetization:
//! - Provider affiliate programs
//! - Click tracking
//! - Conversion tracking
//! - Revenue attribution

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Affiliate tracker
pub struct AffiliateTracker {
    /// Affiliate ID
    pub affiliate_id: String,
    /// Tracked clicks
    pub clicks: Vec<AffiliateClick>,
    /// Conversions
    pub conversions: Vec<AffiliateConversion>,
}

/// Affiliate click
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AffiliateClick {
    /// Click ID
    pub click_id: String,
    /// Provider
    pub provider: String,
    /// Timestamp
    pub timestamp: DateTime<Utc>,
    /// User agent
    pub user_agent: String,
    /// Referrer URL
    pub referrer: Option<String>,
}

/// Affiliate conversion
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AffiliateConversion {
    /// Conversion ID
    pub conversion_id: String,
    /// Click ID that led to conversion
    pub click_id: String,
    /// Provider
    pub provider: String,
    /// Timestamp
    pub timestamp: DateTime<Utc>,
    /// Revenue (if known)
    pub revenue: Option<f64>,
    /// Commission (if known)
    pub commission: Option<f64>,
}

/// Provider affiliate program info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AffiliateProgram {
    /// Provider name
    pub provider: String,
    /// Program name
    pub program_name: String,
    /// Affiliate URL pattern
    pub url_pattern: String,
    /// Commission rate (%)
    pub commission_rate: f64,
    /// Cookie duration (days)
    pub cookie_duration_days: u32,
    /// Minimum payout
    pub minimum_payout: f64,
    /// Payment method
    pub payment_method: String,
    /// Application URL
    pub apply_url: String,
    /// Status
    pub status: AffiliateStatus,
}

/// Affiliate status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AffiliateStatus {
    /// Not applied
    NotApplied,
    /// Application pending
    Pending,
    /// Approved
    Approved,
    /// Rejected
    Rejected,
    /// Suspended
    Suspended,
}

impl AffiliateTracker {
    /// Create new affiliate tracker
    pub fn new(affiliate_id: String) -> Self {
        Self {
            affiliate_id,
            clicks: Vec::new(),
            conversions: Vec::new(),
        }
    }

    /// Track click
    pub fn track_click(&mut self, provider: String, user_agent: String, referrer: Option<String>) {
        self.clicks.push(AffiliateClick {
            click_id: Uuid::new_v4().to_string(),
            provider,
            timestamp: Utc::now(),
            user_agent,
            referrer,
        });
    }

    /// Track conversion
    pub fn track_conversion(
        &mut self,
        click_id: String,
        provider: String,
        revenue: Option<f64>,
        commission: Option<f64>,
    ) {
        self.conversions.push(AffiliateConversion {
            conversion_id: Uuid::new_v4().to_string(),
            click_id,
            provider,
            timestamp: Utc::now(),
            revenue,
            commission,
        });
    }

    /// Get total clicks
    pub fn total_clicks(&self) -> usize {
        self.clicks.len()
    }

    /// Get total conversions
    pub fn total_conversions(&self) -> usize {
        self.conversions.len()
    }

    /// Get total revenue
    pub fn total_revenue(&self) -> f64 {
        self.conversions
            .iter()
            .filter_map(|c| c.revenue)
            .sum()
    }

    /// Get total commission
    pub fn total_commission(&self) -> f64 {
        self.conversions
            .iter()
            .filter_map(|c| c.commission)
            .sum()
    }

    /// Get conversion rate
    pub fn conversion_rate(&self) -> f64 {
        if self.clicks.is_empty() {
            0.0
        } else {
            (self.conversions.len() as f64) / (self.clicks.len() as f64) * 100.0
        }
    }

    /// Get affiliate link for provider
    pub fn get_affiliate_link(
        &self,
        provider: crate::capability::SupportedProvider,
    ) -> Option<String> {
        match provider {
            crate::capability::SupportedProvider::Hetzner => {
                Some(format!(
                    "https://accounts.hetzner.com/register?ref={}",
                    self.affiliate_id
                ))
            }
            crate::capability::SupportedProvider::DigitalOcean => {
                Some(format!("https://m.do.co/c/{}", self.affiliate_id))
            }
            crate::capability::SupportedProvider::Aws => {
                // AWS doesn't have simple affiliate links
                None
            }
            crate::capability::SupportedProvider::Manual => None,
        }
    }
}

/// Known affiliate programs
pub fn get_known_programs() -> Vec<AffiliateProgram> {
    vec![
        AffiliateProgram {
            provider: "hetzner".to_string(),
            program_name: "Hetzner Partner Program".to_string(),
            url_pattern: "https://accounts.hetzner.com/register?ref={affiliate_id}".to_string(),
            commission_rate: 5.0,  // 5% of customer spend
            cookie_duration_days: 90,
            minimum_payout: 50.0,
            payment_method: "Bank transfer / PayPal".to_string(),
            apply_url: "https://www.hetzner.com/partner-program".to_string(),
            status: AffiliateStatus::NotApplied,
        },
        AffiliateProgram {
            provider: "digitalocean".to_string(),
            program_name: "DigitalOcean Referral Program".to_string(),
            url_pattern: "https://m.do.co/c/{affiliate_id}".to_string(),
            commission_rate: 0.0,  // $25 per referral + 15% of spend
            cookie_duration_days: 30,
            minimum_payout: 0.0,
            payment_method: "PayPal / DigitalOcean credit".to_string(),
            apply_url: "https://www.digitalocean.com/affiliates/".to_string(),
            status: AffiliateStatus::NotApplied,
        },
        AffiliateProgram {
            provider: "linode".to_string(),
            program_name: "Linode Cloud Partnership".to_string(),
            url_pattern: "https://www.linode.com/r/{affiliate_id}".to_string(),
            commission_rate: 0.0,  // $25 per referral + 10% of spend
            cookie_duration_days: 90,
            minimum_payout: 0.0,
            payment_method: "PayPal".to_string(),
            apply_url: "https://www.linode.com/partners/".to_string(),
            status: AffiliateStatus::NotApplied,
        },
        AffiliateProgram {
            provider: "vultr".to_string(),
            program_name: "Vultr Affiliate Program".to_string(),
            url_pattern: "https://www.vultr.com/?ref={affiliate_id}".to_string(),
            commission_rate: 0.0,  // Up to $100 per referral
            cookie_duration_days: 30,
            minimum_payout: 50.0,
            payment_method: "PayPal / Wire transfer".to_string(),
            apply_url: "https://www.vultr.com/company/affiliate-program/".to_string(),
            status: AffiliateStatus::NotApplied,
        },
    ]
}

/// Monetization tier configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonetizationTier {
    /// Tier name
    pub name: String,
    /// Monthly price
    pub monthly_price: f64,
    /// Includes managed compute
    pub includes_managed_compute: bool,
    /// Includes concierge setup
    pub includes_concierge: bool,
    /// Includes affiliate links
    pub includes_affiliate: bool,
    /// Compute markup (%)
    pub compute_markup_percent: f64,
    /// Max managed compute credits
    pub max_compute_credits: f64,
}

/// Default monetization tiers
pub fn get_default_tiers() -> Vec<MonetizationTier> {
    vec![
        MonetizationTier {
            name: "Free".to_string(),
            monthly_price: 0.0,
            includes_managed_compute: false,
            includes_concierge: false,
            includes_affiliate: true,  // Affiliate links shown
            compute_markup_percent: 0.0,
            max_compute_credits: 0.0,
        },
        MonetizationTier {
            name: "Pro".to_string(),
            monthly_price: 29.0,
            includes_managed_compute: false,
            includes_concierge: true,  // Concierge setup
            includes_affiliate: true,
            compute_markup_percent: 10.0,  // 10% markup on managed compute
            max_compute_credits: 100.0,  // $100/month compute credits
        },
        MonetizationTier {
            name: "Enterprise".to_string(),
            monthly_price: 299.0,
            includes_managed_compute: true,
            includes_concierge: true,
            includes_affiliate: false,  // No affiliate links for enterprise
            compute_markup_percent: 20.0,  // 20% markup
            max_compute_credits: 1000.0,  // $1000/month compute credits
        },
    ]
}
