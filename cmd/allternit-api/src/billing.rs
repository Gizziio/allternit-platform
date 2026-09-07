//! Billing constants (the real legal entity, from the business's existing
//! `03_Invoice_Template.md`) and the swappable charge/invoice-issuing
//! interface. Neither Clover's invoicing API (not ready yet) nor Stripe
//! (still being decided) is wired to anything -- `NoopCharger` is the only
//! implementation, and it charges nothing. A future `CloverCharger`/
//! `StripeCharger` implements the same `InvoiceCharger` trait without
//! touching `usage_routes.rs`'s summary-rendering code.

use serde::Serialize;

pub const SELLER_LEGAL_NAME: &str = "Allternit Labs, Inc.";
pub const SELLER_ADDRESS_LINES: [&str; 2] = ["123 Main Street, Suite 400", "Saint Paul, MN 55117"];
pub const PAYMENT_TERMS: &str = "Net 15";
pub const LATE_FEE_MONTHLY_PCT: f32 = 1.5;

#[derive(Debug, Clone, Serialize)]
pub struct InvoiceLineItem {
    pub description: String,
    pub resource_type: String,
    pub quantity: f64,
    pub unit: String,
    pub subtotal_cents: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct InvoiceDraft {
    pub organization_id: String,
    pub period_start: String,
    pub period_end: String,
    pub line_items: Vec<InvoiceLineItem>,
    pub total_cents: i64,
    pub seller_legal_name: &'static str,
    pub seller_address_lines: [&'static str; 2],
    pub payment_terms: &'static str,
}

#[derive(Debug, Clone, Serialize)]
pub struct ChargeResult {
    pub status: String, // "charged" | "deferred" | "failed"
    pub message: String,
    pub external_reference: Option<String>,
}

impl ChargeResult {
    pub fn deferred(message: impl Into<String>) -> Self {
        Self {
            status: "deferred".to_string(),
            message: message.into(),
            external_reference: None,
        }
    }
}

#[derive(Debug)]
pub struct ChargeError(pub String);

impl std::fmt::Display for ChargeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}
impl std::error::Error for ChargeError {}

/// Swappable charge/invoice-issuing interface.
pub trait InvoiceCharger: Send + Sync {
    fn name(&self) -> &'static str;
    fn issue(&self, draft: &InvoiceDraft) -> Result<ChargeResult, ChargeError>;
}

/// The only implementation today: renders the draft but charges nothing,
/// deferring to a human sending it manually (e.g. via Clover's dashboard)
/// until a real payment-processor integration exists.
pub struct NoopCharger;

impl InvoiceCharger for NoopCharger {
    fn name(&self) -> &'static str {
        "noop"
    }

    fn issue(&self, _draft: &InvoiceDraft) -> Result<ChargeResult, ChargeError> {
        Ok(ChargeResult::deferred(
            "No payment processor is configured yet (Clover invoicing API not ready, \
             Stripe undecided). Render this draft and send it manually.",
        ))
    }
}

/// Low-level Stripe client used by `StripeCharger`. Extracted as a trait so
/// the charger can be unit-tested without calling the real Stripe API.
pub trait StripeClient: Send + Sync {
    fn create_usage_record(
        &self,
        subscription_item: &str,
        quantity: i64,
        timestamp: i64,
    ) -> Result<String, ChargeError>;
}

/// Production Stripe client that POSTs usage records to Stripe.
pub struct StripeHttpClient {
    secret_key: String,
    base_url: String,
}

impl StripeHttpClient {
    pub fn from_env() -> Option<Self> {
        let secret_key = std::env::var("STRIPE_SECRET_KEY").ok()?;
        if secret_key.is_empty() {
            return None;
        }
        Some(Self {
            secret_key,
            base_url: "https://api.stripe.com".to_string(),
        })
    }

    pub fn with_base_url(secret_key: impl Into<String>, base_url: impl Into<String>) -> Self {
        Self {
            secret_key: secret_key.into(),
            base_url: base_url.into(),
        }
    }
}

impl StripeClient for StripeHttpClient {
    fn create_usage_record(
        &self,
        subscription_item: &str,
        quantity: i64,
        timestamp: i64,
    ) -> Result<String, ChargeError> {
        let client = reqwest::blocking::Client::new();
        let url = format!(
            "{}/v1/subscription_items/{}/usage_records",
            self.base_url.trim_end_matches('/'),
            subscription_item
        );
        let params = [
            ("quantity", quantity.to_string()),
            ("timestamp", timestamp.to_string()),
            ("action", "set".to_string()),
        ];
        let resp = client
            .post(&url)
            .basic_auth(&self.secret_key, Some(""))
            .form(&params)
            .send()
            .map_err(|e| ChargeError(format!("stripe request failed: {}", e)))?;
        let status = resp.status();
        let body = resp
            .text()
            .map_err(|e| ChargeError(format!("stripe response read failed: {}", e)))?;
        if !status.is_success() {
            return Err(ChargeError(format!(
                "stripe returned {}: {}",
                status, body
            )));
        }
        let id: serde_json::Value = serde_json::from_str(&body)
            .map_err(|e| ChargeError(format!("stripe response parse failed: {}", e)))?;
        let usage_record_id = id
            .get("id")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();
        Ok(usage_record_id)
    }
}

/// Stripe-backed charger. Converts an invoice draft into a Stripe usage record
/// for the configured subscription item. Use `NoopCharger` when Stripe is not
/// configured.
pub struct StripeCharger {
    client: Box<dyn StripeClient>,
    subscription_item: String,
}

impl StripeCharger {
    pub fn new(client: Box<dyn StripeClient>, subscription_item: impl Into<String>) -> Self {
        Self {
            client,
            subscription_item: subscription_item.into(),
        }
    }

    pub fn from_env() -> Option<Self> {
        let client = Box::new(StripeHttpClient::from_env()?);
        let subscription_item = std::env::var("STRIPE_DESKTOP_USAGE_SUBSCRIPTION_ITEM").ok()?;
        if subscription_item.is_empty() {
            return None;
        }
        Some(Self::new(client, subscription_item))
    }
}

impl InvoiceCharger for StripeCharger {
    fn name(&self) -> &'static str {
        "stripe"
    }

    fn issue(&self, draft: &InvoiceDraft) -> Result<ChargeResult, ChargeError> {
        let total_minutes = draft
            .line_items
            .iter()
            .map(|li| li.quantity as i64)
            .sum::<i64>();
        if total_minutes <= 0 {
            return Ok(ChargeResult::deferred("no usage to bill"));
        }
        let now = chrono::Utc::now().timestamp();
        let record_id = self
            .client
            .create_usage_record(&self.subscription_item, total_minutes, now)?;
        Ok(ChargeResult {
            status: "charged".to_string(),
            message: format!("Stripe usage record created: {}", record_id),
            external_reference: Some(record_id),
        })
    }
}

pub fn default_charger() -> Box<dyn InvoiceCharger> {
    StripeCharger::from_env()
        .map(|c| Box::new(c) as Box<dyn InvoiceCharger>)
        .unwrap_or_else(|| Box::new(NoopCharger))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Arc, Mutex};

    #[derive(Clone, Default)]
    struct FakeStripeClient {
        calls: Arc<Mutex<Vec<(String, i64)>>>,
        next_id: Arc<Mutex<String>>,
    }

    impl StripeClient for FakeStripeClient {
        fn create_usage_record(
            &self,
            subscription_item: &str,
            quantity: i64,
            _timestamp: i64,
        ) -> Result<String, ChargeError> {
            self.calls
                .lock()
                .unwrap()
                .push((subscription_item.to_string(), quantity));
            Ok(self.next_id.lock().unwrap().clone())
        }
    }

    #[test]
    fn stripe_charger_posts_usage_record() {
        let fake = FakeStripeClient::default();
        *fake.next_id.lock().unwrap() = "ur_test_123".to_string();
        let charger = StripeCharger::new(Box::new(fake.clone()), "si_test");
        let draft = InvoiceDraft {
            organization_id: "org_1".to_string(),
            period_start: "2026-08-01".to_string(),
            period_end: "2026-08-31".to_string(),
            line_items: vec![InvoiceLineItem {
                description: "desktop minutes".to_string(),
                resource_type: "desktop".to_string(),
                quantity: 120.0,
                unit: "minute".to_string(),
                subtotal_cents: 0,
            }],
            total_cents: 0,
            seller_legal_name: SELLER_LEGAL_NAME,
            seller_address_lines: SELLER_ADDRESS_LINES,
            payment_terms: PAYMENT_TERMS,
        };
        let result = charger.issue(&draft).unwrap();
        assert_eq!(result.status, "charged");
        assert_eq!(result.external_reference, Some("ur_test_123".to_string()));
        let calls = fake.calls.lock().unwrap();
        assert_eq!(calls.len(), 1);
        assert_eq!(calls[0].0, "si_test");
        assert_eq!(calls[0].1, 120);
    }

    #[test]
    fn stripe_charger_defers_when_no_usage() {
        let fake = FakeStripeClient::default();
        let charger = StripeCharger::new(Box::new(fake.clone()), "si_test");
        let draft = InvoiceDraft {
            organization_id: "org_1".to_string(),
            period_start: "2026-08-01".to_string(),
            period_end: "2026-08-31".to_string(),
            line_items: vec![],
            total_cents: 0,
            seller_legal_name: SELLER_LEGAL_NAME,
            seller_address_lines: SELLER_ADDRESS_LINES,
            payment_terms: PAYMENT_TERMS,
        };
        let result = charger.issue(&draft).unwrap();
        assert_eq!(result.status, "deferred");
        assert!(fake.calls.lock().unwrap().is_empty());
    }
}
