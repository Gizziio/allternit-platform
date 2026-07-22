//! Usage summary / invoice-draft rendering — Clerk-authenticated. Aggregates
//! `usage_events` into line items on demand; no `invoices` table exists yet
//! (see billing.rs's NoopCharger doc comment for why persisting drafts isn't
//! worth it until a real charger exists).

use axum::{
    extract::{Extension, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use rusqlite::params;
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;

use crate::auth::AuthUser;
use crate::billing::{self, InvoiceDraft, InvoiceLineItem};
use crate::AppState;

pub fn usage_router() -> Router<Arc<AppState>> {
    Router::new().route("/usage/summary", get(usage_summary))
}

#[derive(Debug, Deserialize)]
struct UsageSummaryQuery {
    organization_id: String,
    period_start: String,
    period_end: String,
}

async fn usage_summary(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Query(query): Query<UsageSummaryQuery>,
) -> impl IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;
    let active_organization_id = user.organization_id;
    let organization_id = query.organization_id;
    let period_start = query.period_start;
    let period_end = query.period_end;

    let result = tokio::task::spawn_blocking(move || -> Result<InvoiceDraft, (StatusCode, serde_json::Value)> {
        let conn = db.connect().map_err(|e| {
            (StatusCode::INTERNAL_SERVER_ERROR, json!({"error": "db_error", "message": e.to_string()}))
        })?;

        if active_organization_id.as_deref() != Some(organization_id.as_str()) {
            return Err((
                StatusCode::FORBIDDEN,
                json!({"error": "inactive_organization", "message": "Select this organization before viewing its metered usage."}),
            ));
        }

        // Metered invoice data is organization-sensitive. Only active owners
        // and admins may view it, even if another member guesses the URL.
        let is_admin = crate::rbac::is_org_admin(&conn, &organization_id, &user_id).map_err(|e| {
            (StatusCode::INTERNAL_SERVER_ERROR, json!({"error": "db_error", "message": e.to_string()}))
        })?;
        if !is_admin {
            return Err((
                StatusCode::FORBIDDEN,
                json!({"error": "insufficient_role", "message": "Only organization owners/admins can view metered billing."}),
            ));
        }

        let mut stmt = conn
            .prepare(
                "SELECT resource_type, unit, SUM(quantity) as total_quantity, SUM(computed_cost_cents) as total_cents
                 FROM usage_events
                 WHERE organization_id = ?1 AND started_at >= ?2 AND started_at < ?3
                 GROUP BY resource_type, unit
                 ORDER BY resource_type",
            )
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, json!({"error": "db_error", "message": e.to_string()})))?;

        let rows = stmt
            .query_map(params![organization_id, period_start, period_end], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, f64>(2)?,
                    row.get::<_, i64>(3)?,
                ))
            })
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, json!({"error": "db_error", "message": e.to_string()})))?;

        let mut line_items = Vec::new();
        let mut total_cents = 0i64;
        for row in rows {
            let (resource_type, unit, quantity, cents) = row.map_err(|e| {
                (StatusCode::INTERNAL_SERVER_ERROR, json!({"error": "db_error", "message": e.to_string()}))
            })?;
            total_cents += cents;
            line_items.push(InvoiceLineItem {
                description: format!("{resource_type} ({unit})"),
                resource_type,
                quantity,
                unit,
                subtotal_cents: cents,
            });
        }

        Ok(InvoiceDraft {
            organization_id,
            period_start,
            period_end,
            line_items,
            total_cents,
            seller_legal_name: billing::SELLER_LEGAL_NAME,
            seller_address_lines: billing::SELLER_ADDRESS_LINES,
            payment_terms: billing::PAYMENT_TERMS,
        })
    })
    .await;

    match result {
        Ok(Ok(draft)) => (StatusCode::OK, Json(json!(draft))).into_response(),
        Ok(Err((status, body))) => (status, Json(body)).into_response(),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "task_join_error"})),
        )
            .into_response(),
    }
}
