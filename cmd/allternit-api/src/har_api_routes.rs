//! HAR-derived API client routes.
//!
//! Accepts browser HAR archives, extracts repeatable API calls, and emits
//! parameterized client specs that agents and scripts can replay.

use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::post;
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use tracing::{info, warn};

use crate::auth::get_user;
use crate::AppState;

pub fn har_api_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/har-derived-api/ingest", post(ingest_har))
        .route("/har-derived-api/client", post(generate_client))
}

fn unauthorized() -> Response {
    (
        StatusCode::UNAUTHORIZED,
        Json(json!({ "error": "Unauthorized" })),
    )
        .into_response()
}

#[derive(Debug, Deserialize)]
struct HarArchive {
    log: HarLog,
}

#[derive(Debug, Deserialize)]
struct HarLog {
    entries: Vec<HarEntry>,
}

#[derive(Debug, Deserialize)]
struct HarEntry {
    request: HarRequest,
    response: HarResponse,
    #[serde(default)]
    time: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct HarRequest {
    method: String,
    url: String,
    #[serde(default)]
    headers: Vec<HarHeader>,
    #[serde(default)]
    query_string: Vec<HarParam>,
    #[serde(default)]
    post_data: Option<HarPostData>,
}

#[derive(Debug, Deserialize)]
struct HarResponse {
    status: u16,
    #[serde(default)]
    content: Option<HarContent>,
}

#[derive(Debug, Deserialize)]
struct HarHeader {
    name: String,
    value: String,
}

#[derive(Debug, Deserialize)]
struct HarParam {
    name: String,
    value: String,
}

#[derive(Debug, Deserialize)]
struct HarPostData {
    #[serde(default)]
    mime_type: Option<String>,
    #[serde(default)]
    text: Option<String>,
}

#[derive(Debug, Deserialize)]
struct HarContent {
    #[serde(default)]
    mime_type: Option<String>,
    #[serde(default)]
    text: Option<String>,
}

#[derive(Debug, Serialize)]
struct ApiEndpoint {
    id: String,
    method: String,
    url: String,
    host: String,
    path: String,
    path_template: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    summary: Option<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    query_params: Vec<TemplatedParam>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    path_params: Vec<TemplatedParam>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    headers: Vec<TemplatedParam>,
    #[serde(skip_serializing_if = "Option::is_none")]
    body_template: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    body_mime_type: Option<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    body_params: Vec<TemplatedParam>,
    status_code: u16,
    #[serde(skip_serializing_if = "Option::is_none")]
    response_sample: Option<String>,
}

#[derive(Debug, Serialize)]
struct TemplatedParam {
    name: String,
    value: String,
    templated: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    suggested_default: Option<String>,
}

#[derive(Debug, Serialize)]
struct IngestResponse {
    endpoints: Vec<ApiEndpoint>,
    stats: IngestStats,
}

#[derive(Debug, Serialize)]
struct IngestStats {
    total_entries: usize,
    api_entries: usize,
    hosts: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct GenerateClientRequest {
    endpoints: Vec<String>,
    language: String,
    #[serde(default)]
    include_auth: bool,
}

#[derive(Debug, Serialize)]
struct GenerateClientResponse {
    language: String,
    code: String,
    notes: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct IngestHarRequest {
    har: String,
}

async fn ingest_har(State(_state): State<Arc<AppState>>, headers: HeaderMap, Json(req): Json<IngestHarRequest>) -> Response {
    if get_user(&headers).is_none() {
        return unauthorized();
    }

    let archive: HarArchive = match serde_json::from_str(&req.har) {
        Ok(a) => a,
        Err(err) => {
            warn!(error = %err, "Failed to parse HAR JSON");
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "Invalid HAR JSON", "details": err.to_string() })),
            )
                .into_response();
        }
    };

    let endpoints = extract_endpoints(&archive.log.entries);
    let hosts = collect_hosts(&endpoints);

    info!(
        total = archive.log.entries.len(),
        extracted = endpoints.len(),
        "HAR-derived API ingest complete"
    );

    (
        StatusCode::OK,
        Json(IngestResponse {
            stats: IngestStats {
                total_entries: archive.log.entries.len(),
                api_entries: endpoints.len(),
                hosts,
            },
            endpoints,
        }),
    )
        .into_response()
}

async fn generate_client(State(_state): State<Arc<AppState>>, headers: HeaderMap, Json(req): Json<GenerateClientRequest>) -> Response {
    if get_user(&headers).is_none() {
        return unauthorized();
    }

    let code = match req.language.as_str() {
        "python" => generate_python_client(&req),
        "typescript" => generate_typescript_client(&req),
        "curl" => generate_curl_client(&req),
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "Unsupported language" })),
            )
                .into_response();
        }
    };

    (
        StatusCode::OK,
        Json(GenerateClientResponse {
            language: req.language,
            code,
            notes: vec![
                "Review extracted parameters and secrets before committing.".to_string(),
                "Replace hard-coded auth values with environment variables.".to_string(),
            ],
        }),
    )
        .into_response()
}

fn extract_endpoints(entries: &[HarEntry]) -> Vec<ApiEndpoint> {
    let mut seen = std::collections::HashSet::new();
    let mut result = Vec::new();

    for entry in entries {
        // Skip non-API responses and errors.
        if entry.response.status >= 400 {
            continue;
        }

        let parsed = match reqwest::Url::parse(&entry.request.url) {
            Ok(u) => u,
            Err(_) => continue,
        };

        let host = parsed.host_str().unwrap_or("").to_string();
        let path = parsed.path().to_string();

        // Skip common static assets.
        if is_static_asset(&path) {
            continue;
        }

        let id = format!("{} {}", entry.request.method.to_uppercase(), entry.request.url);
        if seen.contains(&id) {
            continue;
        }
        seen.insert(id.clone());

        let query_params: Vec<TemplatedParam> = entry
            .request
            .query_string
            .iter()
            .map(|p| TemplatedParam {
                name: p.name.clone(),
                value: p.value.clone(),
                templated: is_likely_variable(&p.value),
                suggested_default: if is_likely_variable(&p.value) { Some(p.value.clone()) } else { None },
            })
            .collect();

        let (path_template, path_params) = extract_path_params(&path);

        let headers: Vec<TemplatedParam> = entry
            .request
            .headers
            .iter()
            .filter(|h| !is_hop_by_hop_or_sensitive(&h.name))
            .map(|h| TemplatedParam {
                name: h.name.clone(),
                value: h.value.clone(),
                templated: is_likely_secret(&h.name, &h.value),
                suggested_default: None,
            })
            .collect();

        let (body_template, body_mime_type, body_params) = entry
            .request
            .post_data
            .as_ref()
            .map(|pd| {
                let params = if pd.mime_type.as_deref() == Some("application/x-www-form-urlencoded") {
                    parse_form_body(pd.text.as_deref().unwrap_or(""))
                } else if pd.text.as_deref().map(|t| t.trim().starts_with('{')).unwrap_or(false) {
                    extract_json_template_params(pd.text.as_deref().unwrap_or(""))
                } else {
                    Vec::new()
                };
                (pd.text.clone(), pd.mime_type.clone(), params)
            })
            .unwrap_or((None, None, Vec::new()));

        let response_sample = entry
            .response
            .content
            .as_ref()
            .and_then(|c| c.text.clone())
            .map(|t| truncate(&t, 2000));

        result.push(ApiEndpoint {
            id,
            method: entry.request.method.to_uppercase(),
            url: entry.request.url.clone(),
            host,
            path: path.clone(),
            path_template,
            summary: None,
            query_params,
            path_params,
            headers,
            body_template,
            body_mime_type,
            body_params,
            status_code: entry.response.status,
            response_sample,
        });
    }

    result
}

fn is_static_asset(path: &str) -> bool {
    let lower = path.to_lowercase();
    [
        ".js", ".css", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".woff", ".woff2",
        ".ttf", ".eot", ".otf", ".map", ".json", ".xml", ".webp",
    ]
    .iter()
    .any(|ext| lower.ends_with(ext))
}

fn is_hop_by_hop_or_sensitive(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    [
        "host", "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
        "te", "trailers", "transfer-encoding", "upgrade", "cookie", "set-cookie",
        "authorization", "x-api-key", "api-key",
    ]
    .contains(&lower.as_str())
}

fn is_likely_variable(value: &str) -> bool {
    value.len() > 8 || value.parse::<i64>().is_ok() || value.parse::<f64>().is_ok()
}

fn is_likely_secret(name: &str, value: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    lower.contains("auth") || lower.contains("token") || lower.contains("key") || value.len() > 32
}

fn extract_path_params(path: &str) -> (String, Vec<TemplatedParam>) {
    let mut params = Vec::new();
    let mut template_parts: Vec<String> = Vec::new();
    let mut id_counter = 1;

    for segment in path.split('/') {
        let is_variable = !segment.is_empty()
            && (segment.parse::<i64>().is_ok()
                || (segment.len() >= 12 && segment.contains('-'))
                || uuid_like(segment));

        if is_variable {
            let name = if id_counter == 1 {
                "id".to_string()
            } else {
                format!("id{}", id_counter)
            };
            id_counter += 1;
            params.push(TemplatedParam {
                name: name.clone(),
                value: segment.to_string(),
                templated: true,
                suggested_default: Some(segment.to_string()),
            });
            template_parts.push(format!("{{{}}}", name));
        } else {
            template_parts.push(segment.to_string());
        }
    }

    (template_parts.join("/"), params)
}

fn uuid_like(s: &str) -> bool {
    s.len() == 36 && s.chars().filter(|&c| c == '-').count() == 4
}

fn parse_form_body(text: &str) -> Vec<TemplatedParam> {
    text.split('&')
        .filter_map(|part| {
            let mut kv = part.splitn(2, '=');
            let name = kv.next()?.to_string();
            let raw_value = kv.next().unwrap_or("").to_string();
            let decoded = urlencoding::decode(&raw_value).map(|c| c.into_owned()).unwrap_or(raw_value.clone());
            Some(TemplatedParam {
                name,
                value: decoded,
                templated: is_likely_variable(&raw_value),
                suggested_default: None,
            })
        })
        .collect()
}

fn extract_json_template_params(text: &str) -> Vec<TemplatedParam> {
    let value: Value = match serde_json::from_str(text) {
        Ok(v) => v,
        Err(_) => return Vec::new(),
    };

    let mut params = Vec::new();
    collect_json_leaf_values(&value, "", &mut params);
    params
}

fn collect_json_leaf_values(value: &Value, prefix: &str, out: &mut Vec<TemplatedParam>) {
    match value {
        Value::Object(map) => {
            for (k, v) in map {
                let key = if prefix.is_empty() { k.clone() } else { format!("{}.{}", prefix, k) };
                collect_json_leaf_values(v, &key, out);
            }
        }
        Value::Array(arr) => {
            for (i, v) in arr.iter().enumerate() {
                collect_json_leaf_values(v, &format!("{}[{}]", prefix, i), out);
            }
        }
        Value::String(s) => {
            if is_likely_variable(s) {
                out.push(TemplatedParam {
                    name: prefix.to_string(),
                    value: s.clone(),
                    templated: true,
                    suggested_default: Some(s.clone()),
                });
            }
        }
        Value::Number(n) => {
            out.push(TemplatedParam {
                name: prefix.to_string(),
                value: n.to_string(),
                templated: true,
                suggested_default: Some(n.to_string()),
            });
        }
        _ => {}
    }
}

fn collect_hosts(endpoints: &[ApiEndpoint]) -> Vec<String> {
    let mut hosts: Vec<String> = endpoints.iter().map(|e| e.host.clone()).collect();
    hosts.sort();
    hosts.dedup();
    hosts
}

fn truncate(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else {
        format!("{}…", &s[..max_len])
    }
}

fn generate_python_client(req: &GenerateClientRequest) -> String {
    let mut lines = vec![
        "import os".to_string(),
        "import requests".to_string(),
        "".to_string(),
        "class HarApiClient:".to_string(),
        "    def __init__(self, base_url=None, api_key=None):".to_string(),
        "        self.base_url = base_url or os.environ.get('API_BASE_URL', '')".to_string(),
        "        self.api_key = api_key or os.environ.get('API_KEY')".to_string(),
        "        self.session = requests.Session()".to_string(),
        "        if self.api_key:".to_string(),
        "            self.session.headers['Authorization'] = f'Bearer {self.api_key}'".to_string(),
        "".to_string(),
    ];

    for (i, _endpoint_id) in req.endpoints.iter().enumerate() {
        lines.push(format!("    # Endpoint {}", i + 1));
        lines.push(format!("    def call_{}(self, **kwargs):", i + 1));
        lines.push(format!("        url = self.base_url + kwargs.get('path', '')"));
        lines.push(format!("        return self.session.request(kwargs.get('method', 'GET'), url, json=kwargs.get('json')).json()"));
        lines.push("".to_string());
    }

    lines.join("\n")
}

fn generate_typescript_client(_req: &GenerateClientRequest) -> String {
    r#"export class HarApiClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor(baseUrl = process.env.API_BASE_URL, apiKey = process.env.API_KEY) {
    this.baseUrl = baseUrl || '';
    this.apiKey = apiKey;
  }

  private async request(path: string, init: RequestInit = {}) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;
    const res = await fetch(`${this.baseUrl}${path}`, { ...init, headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
}
"#
    .to_string()
}

fn generate_curl_client(_req: &GenerateClientRequest) -> String {
    r#"# HAR-derived API replay template
# Set these in your environment before running:
# export API_BASE_URL="..."
# export API_KEY="..."

curl -s "$API_BASE_URL/REPLACE_PATH" \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json"
"#
    .to_string()
}
