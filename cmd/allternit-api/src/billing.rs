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

pub fn default_charger() -> Box<dyn InvoiceCharger> {
    Box::new(NoopCharger)
}
