//! Integration tests for health and metrics endpoints.

use allternit_api::health::{health_router, HealthState};
use allternit_api::metrics::{metrics_middleware, metrics_router};
use async_trait::async_trait;
use axum::{body::Body, http::Request, routing::get, Router};
use serde_json::Value;
use tower::ServiceExt;

/// Helper to read a response body into a UTF-8 string.
async fn body_text(response: axum::response::Response) -> String {
    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("failed to read body");
    String::from_utf8(bytes.to_vec()).expect("body is not valid UTF-8")
}

/// Helper to read a response body as JSON.
async fn body_json(response: axum::response::Response) -> Value {
    let text = body_text(response).await;
    serde_json::from_str(&text).expect("body is not valid JSON")
}

#[derive(Clone)]
struct TestState {
    db: bool,
    jwks: bool,
    gizzi: bool,
}

#[async_trait]
impl HealthState for TestState {
    async fn db_healthy(&self) -> bool {
        self.db
    }

    async fn jwks_ready(&self) -> bool {
        self.jwks
    }

    async fn gizzi_healthy(&self) -> bool {
        self.gizzi
    }
}

#[tokio::test]
async fn test_metrics_endpoint_renders_prometheus_text() {
    // Record at least one request so the histogram/counter families appear in the output.
    let app = Router::new()
        .route("/test", get(|| async { "ok" }))
        .layer(axum::middleware::from_fn(metrics_middleware));

    app.clone()
        .oneshot(
            Request::builder()
                .uri("/test")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    let metrics_app = metrics_router::<()>();
    let response = metrics_app
        .oneshot(
            Request::builder()
                .uri("/metrics")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), 200);
    let text = body_text(response).await;
    assert!(
        text.contains("http_request_duration_seconds"),
        "expected request duration histogram in metrics output"
    );
}

#[tokio::test]
async fn test_metrics_middleware_records_requests() {
    let app = Router::new()
        .route("/test", get(|| async { "ok" }))
        .layer(axum::middleware::from_fn(metrics_middleware));

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/test")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), 200);

    let metrics_response = metrics_router::<()>()
        .oneshot(
            Request::builder()
                .uri("/metrics")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(metrics_response.status(), 200);
    let text = body_text(metrics_response).await;
    let expected_label = r#"method="GET",path="/test",status="200""#;
    assert!(
        text.contains(expected_label),
        "expected metric with label {expected_label} in output:\n{text}"
    );
}

#[tokio::test]
async fn test_health_live_returns_ok() {
    let app = health_router::<TestState>().with_state(TestState {
        db: true,
        jwks: true,
        gizzi: true,
    });
    let response = app
        .oneshot(
            Request::builder()
                .uri("/live")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), 200);
    let json = body_json(response).await;
    assert_eq!(json["status"], "alive");
}

#[tokio::test]
async fn test_health_ready_when_healthy() {
    let app = health_router::<TestState>().with_state(TestState {
        db: true,
        jwks: true,
        gizzi: true,
    });
    let response = app
        .oneshot(
            Request::builder()
                .uri("/ready")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), 200);
    let json = body_json(response).await;
    assert_eq!(json["status"], "ready");
    assert_eq!(json["checks"]["db"], true);
    assert_eq!(json["checks"]["jwks"], true);
    assert_eq!(json["checks"]["gizzi"], true);
}

#[tokio::test]
async fn test_health_ready_when_db_unhealthy() {
    let app = health_router::<TestState>().with_state(TestState {
        db: false,
        jwks: true,
        gizzi: true,
    });
    let response = app
        .oneshot(
            Request::builder()
                .uri("/ready")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), 503);
    let json = body_json(response).await;
    assert_eq!(json["status"], "not_ready");
    assert_eq!(json["checks"]["db"], false);
    assert_eq!(json["checks"]["jwks"], true);
    assert_eq!(json["checks"]["gizzi"], true);
}

#[tokio::test]
async fn test_health_aggregate() {
    let healthy_app = health_router::<TestState>().with_state(TestState {
        db: true,
        jwks: true,
        gizzi: true,
    });
    let response = healthy_app
        .oneshot(
            Request::builder()
                .uri("/")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), 200);
    let json = body_json(response).await;
    assert_eq!(json["status"], "healthy");
    assert_eq!(json["live"], true);
    assert_eq!(json["ready"]["db"], true);
    assert_eq!(json["ready"]["jwks"], true);
    assert_eq!(json["ready"]["gizzi"], true);

    let degraded_app = health_router::<TestState>().with_state(TestState {
        db: true,
        jwks: false,
        gizzi: true,
    });
    let response = degraded_app
        .oneshot(
            Request::builder()
                .uri("/")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), 503);
    let json = body_json(response).await;
    assert_eq!(json["status"], "degraded");
    assert_eq!(json["live"], true);
    assert_eq!(json["ready"]["jwks"], false);
    assert_eq!(json["ready"]["gizzi"], true);
}
