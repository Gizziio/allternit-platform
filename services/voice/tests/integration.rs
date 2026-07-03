use axum::body::Body;
use axum::http::{Request, StatusCode};
use serde_json::json;
use tower::ServiceExt;
use voice_service::{VoiceServiceState, create_router};

fn app() -> axum::Router {
    create_router(VoiceServiceState::new())
}

#[tokio::test]
async fn health_check_returns_ok() {
    let response = app()
        .oneshot(Request::builder().uri("/health").body(Body::empty()).unwrap())
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["service"], "voice");
    assert_eq!(json["status"], "healthy");
}

#[tokio::test]
async fn list_voices_returns_defaults() {
    let response = app()
        .oneshot(Request::builder().uri("/v1/voices").body(Body::empty()).unwrap())
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let voices: serde_json::Value = serde_json::from_slice(&body).unwrap();
    let voices = voices.as_array().unwrap();
    assert_eq!(voices.len(), 3);
    assert!(voices.iter().any(|v| v["id"] == "default"));
}

#[tokio::test]
async fn get_voice_returns_404_for_unknown() {
    let response = app()
        .oneshot(
            Request::builder()
                .uri("/v1/voices/unknown")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn text_to_speech_returns_audio_url() {
    let response = app()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/v1/tts")
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({ "text": "Hello world", "voice_id": "default" }).to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert!(json["audio_url"].as_str().unwrap().starts_with("/v1/audio/"));
    assert_eq!(json["format"], "wav");
    assert!(json["duration_secs"].as_f64().unwrap() > 0.0);
}

#[tokio::test]
async fn create_and_get_session() {
    let app = app();

    let create_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/v1/sessions")
                .header("content-type", "application/json")
                .body(Body::from(json!({ "mode": "tts" }).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(create_response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(create_response.into_body(), usize::MAX)
        .await
        .unwrap();
    let created: serde_json::Value = serde_json::from_slice(&body).unwrap();
    let session_id = created["session_id"].as_str().unwrap();
    assert_eq!(created["mode"], "tts");

    let get_response = app
        .oneshot(
            Request::builder()
                .uri(format!("/v1/sessions/{}", session_id))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(get_response.status(), StatusCode::OK);
}

#[tokio::test]
async fn stats_reflect_request_count() {
    let app = app();

    let _ = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/v1/tts")
                .header("content-type", "application/json")
                .body(Body::from(json!({ "text": "count me" }).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    let stats_response = app
        .oneshot(Request::builder().uri("/v1/stats").body(Body::empty()).unwrap())
        .await
        .unwrap();

    assert_eq!(stats_response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(stats_response.into_body(), usize::MAX)
        .await
        .unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["total_requests"], 1);
    assert_eq!(json["tts_models"], 3);
    assert_eq!(json["stt_models"], 1);
}
