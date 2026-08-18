//! HAR-derived API capture service.
//!
//! Shared persistence, extraction, replay, and client generation used by
//! `har_api_routes.rs` and `tool_routes.rs`.

use chrono::Utc;
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashSet;

pub use crate::db::{ApiContract, ApiEndpoint, CaptureSession, TemplatedParam};
use crate::db::DbHandle;

// ─── Session lifecycle ──────────────────────────────────────────────────────

pub async fn create_capture_session(
    db: &DbHandle,
    user_id: &str,
    domain: Option<&str>,
    source: Option<&str>,
) -> Result<String, String> {
    let session_id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    db.create_capture_session(&session_id, user_id, domain, source, "active", &now)
        .map_err(|e| format!("Failed to create capture session: {}", e))?;
    Ok(session_id)
}

pub fn get_capture_session(db: &DbHandle, session_id: &str) -> Result<Option<CaptureSession>, String> {
    db.get_capture_session(session_id)
        .map_err(|e| format!("Failed to read capture session: {}", e))
}

pub fn list_capture_sessions_for_user(
    db: &DbHandle,
    user_id: &str,
) -> Result<Vec<CaptureSession>, String> {
    db.list_capture_sessions_for_user(user_id)
        .map_err(|e| format!("Failed to list capture sessions: {}", e))
}

pub fn update_capture_session_status(
    db: &DbHandle,
    session_id: &str,
    status: &str,
    ended_at: Option<&str>,
) -> Result<(), String> {
    db.update_capture_session_status(session_id, status, ended_at)
        .map_err(|e| format!("Failed to update capture session: {}", e))
}

pub fn delete_capture_session(db: &DbHandle, session_id: &str) -> Result<bool, String> {
    db.delete_capture_session(session_id)
        .map_err(|e| format!("Failed to delete capture session: {}", e))
}

/// Stop a capture session. If `har_json` is supplied, derive endpoints and
/// persist a contract; otherwise just mark the session as stopped.
pub async fn stop_capture_session(
    db: &DbHandle,
    session_id: &str,
    har_json: Option<&str>,
) -> Result<Value, String> {
    let session = get_capture_session(db, session_id)?
        .ok_or_else(|| format!("Capture session not found: {}", session_id))?;

    let now = Utc::now().to_rfc3339();

    if let Some(har_json) = har_json {
        let endpoints = extract_endpoints_from_har(har_json)?;
        let domain = derive_domain(&endpoints, session.domain.as_deref());
        let contract_id = create_api_contract(db, &session.user_id, &domain, session.source.as_deref(), endpoints).await?;
        update_capture_session_status(db, session_id, "completed", Some(&now))?;
        let (contract, endpoints) = get_contract_with_endpoints(db, &contract_id)?
            .ok_or_else(|| "Contract disappeared after creation".to_string())?;
        Ok(json!({
            "session_id": session_id,
            "contract": contract,
            "endpoints": endpoints,
        }))
    } else {
        update_capture_session_status(db, session_id, "stopped", Some(&now))?;
        Ok(json!({
            "session_id": session_id,
            "status": "stopped",
        }))
    }
}

fn derive_domain(endpoints: &[ApiEndpoint], fallback: Option<&str>) -> String {
    endpoints
        .iter()
        .filter_map(|e| e.host.as_ref())
        .find(|h| !h.is_empty())
        .cloned()
        .or_else(|| fallback.map(String::from))
        .unwrap_or_else(|| "unknown".to_string())
}

// ─── Contract CRUD ──────────────────────────────────────────────────────────

pub async fn create_api_contract(
    db: &DbHandle,
    user_id: &str,
    domain: &str,
    source: Option<&str>,
    mut endpoints: Vec<ApiEndpoint>,
) -> Result<String, String> {
    let contract_id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    db.create_api_contract(&contract_id, user_id, domain, source, &now)
        .map_err(|e| format!("Failed to create contract: {}", e))?;
    for ep in &mut endpoints {
        ep.contract_id = contract_id.clone();
    }
    db.create_api_endpoints(&endpoints)
        .map_err(|e| format!("Failed to create endpoints: {}", e))?;
    Ok(contract_id)
}

pub fn get_contract_with_endpoints(
    db: &DbHandle,
    contract_id: &str,
) -> Result<Option<(ApiContract, Vec<ApiEndpoint>)>, String> {
    db.get_contract_with_endpoints(contract_id)
        .map_err(|e| format!("Failed to read contract: {}", e))
}

pub fn list_contracts_for_user(db: &DbHandle, user_id: &str) -> Result<Vec<ApiContract>, String> {
    db.list_contracts_for_user(user_id)
        .map_err(|e| format!("Failed to list contracts: {}", e))
}

pub fn delete_contract(db: &DbHandle, contract_id: &str) -> Result<bool, String> {
    db.delete_contract(contract_id)
        .map_err(|e| format!("Failed to delete contract: {}", e))
}

// ─── HAR extraction ─────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct HarArchive {
    log: HarLog,
}

#[derive(Debug, Deserialize)]
struct HarLog {
    entries: Vec<HarEntry>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HarEntry {
    request: HarRequest,
    response: HarResponse,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
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
#[serde(rename_all = "camelCase")]
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
#[serde(rename_all = "camelCase")]
struct HarPostData {
    #[serde(default)]
    mime_type: Option<String>,
    #[serde(default)]
    text: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HarContent {
    #[serde(default)]
    text: Option<String>,
}

pub fn extract_endpoints_from_har(har_json: &str) -> Result<Vec<ApiEndpoint>, String> {
    let archive: HarArchive = serde_json::from_str(har_json)
        .map_err(|e| format!("Invalid HAR JSON: {}", e))?;
    Ok(extract_endpoints(&archive.log.entries))
}

fn extract_endpoints(entries: &[HarEntry]) -> Vec<ApiEndpoint> {
    let mut seen = HashSet::new();
    let mut result = Vec::new();

    for entry in entries {
        if entry.response.status >= 400 {
            continue;
        }

        let parsed = match reqwest::Url::parse(&entry.request.url) {
            Ok(u) => u,
            Err(_) => continue,
        };

        let host = parsed.host_str().map(String::from);
        let path = parsed.path().to_string();

        if is_static_asset(&path) {
            continue;
        }

        let key = format!(
            "{} {} {}",
            entry.request.method.to_uppercase(),
            host.as_deref().unwrap_or(""),
            path
        );
        if seen.contains(&key) {
            continue;
        }
        seen.insert(key);

        let id = uuid::Uuid::new_v4().to_string();

        let query_params: Vec<TemplatedParam> = entry
            .request
            .query_string
            .iter()
            .map(|p| TemplatedParam {
                name: p.name.clone(),
                value: p.value.clone(),
                templated: is_likely_variable(&p.value),
                suggested_default: if is_likely_variable(&p.value) {
                    Some(p.value.clone())
                } else {
                    None
                },
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
            contract_id: String::new(),
            method: entry.request.method.to_uppercase(),
            url: entry.request.url.clone(),
            host,
            path: Some(path),
            path_template: Some(path_template),
            summary: None,
            query_params,
            path_params,
            headers,
            body_template,
            body_mime_type,
            body_params,
            status_code: Some(entry.response.status as i64),
            response_sample,
            hit_count: 1,
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
        "host",
        "connection",
        "keep-alive",
        "proxy-authenticate",
        "proxy-authorization",
        "te",
        "trailers",
        "transfer-encoding",
        "upgrade",
        "cookie",
        "set-cookie",
        "authorization",
        "x-api-key",
        "api-key",
    ]
    .contains(&lower.as_str())
}

fn is_likely_variable(value: &str) -> bool {
    value.len() > 8 || value.parse::<i64>().is_ok() || value.parse::<f64>().is_ok()
}

fn is_likely_secret(name: &str, value: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    lower.contains("auth")
        || lower.contains("token")
        || lower.contains("key")
        || value.len() > 32
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
            let decoded = urlencoding::decode(&raw_value)
                .map(|c| c.into_owned())
                .unwrap_or_else(|_| raw_value.clone());
            Some(TemplatedParam {
                name,
                value: decoded.clone(),
                templated: is_likely_variable(&decoded),
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
                let key = if prefix.is_empty() {
                    k.clone()
                } else {
                    format!("{}.{}", prefix, k)
                };
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

fn truncate(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else {
        format!("{}…", &s[..max_len])
    }
}

// ─── Server-side replay ─────────────────────────────────────────────────────

pub async fn replay_endpoint(
    db: &DbHandle,
    contract_id: &str,
    endpoint_id: &str,
    path_params: Option<&Value>,
    query_params: Option<&Value>,
    headers: Option<&Value>,
    body: Option<&Value>,
) -> Result<Value, String> {
    let (_contract, endpoints) = get_contract_with_endpoints(db, contract_id)?
        .ok_or_else(|| format!("Contract not found: {}", contract_id))?;
    let endpoint = endpoints
        .into_iter()
        .find(|e| e.id == endpoint_id)
        .ok_or_else(|| format!("Endpoint not found: {}", endpoint_id))?;

    let path_template = endpoint
        .path_template
        .as_deref()
        .or(endpoint.path.as_deref())
        .unwrap_or("");
    let path = substitute_path_params(path_template, path_params)?;
    let host = endpoint.host.as_deref().unwrap_or("");
    let url = build_url(host, &path, query_params, &endpoint.query_params)?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    let mut req = match endpoint.method.as_str() {
        "GET" => client.get(&url),
        "POST" => client.post(&url),
        "PUT" => client.put(&url),
        "PATCH" => client.patch(&url),
        "DELETE" => client.delete(&url),
        "HEAD" => client.head(&url),
        "OPTIONS" => client.request(reqwest::Method::OPTIONS, &url),
        _ => client.request(
            reqwest::Method::from_bytes(endpoint.method.as_bytes()).map_err(|e| e.to_string())?,
            &url,
        ),
    };

    // Apply stored headers, skipping templated/sensitive ones unless explicitly supplied.
    for h in &endpoint.headers {
        if h.templated {
            continue;
        }
        if let Some(supplied) = headers.and_then(|hdrs| hdrs.get(&h.name)) {
            if let Some(v) = supplied.as_str() {
                req = req.header(&h.name, v);
            }
        } else if !is_hop_by_hop_or_sensitive(&h.name) {
            req = req.header(&h.name, &h.value);
        }
    }

    if let Some(body) = body {
        req = req.json(body);
    } else if let Some(template) = endpoint.body_template.as_deref() {
        let substituted = substitute_body_template(template, body)?;
        if let Some(mime) = endpoint.body_mime_type.as_deref() {
            req = req.header("Content-Type", mime);
        }
        req = req.body(substituted);
    }

    match req.send().await {
        Ok(resp) => {
            let status = resp.status().as_u16();
            let body_text = resp
                .text()
                .await
                .map_err(|e| format!("Failed to read response body: {}", e))?;
            Ok(json!({
                "status": status,
                "body": body_text,
            }))
        }
        Err(e) => Ok(json!({
            "status": Value::Null,
            "body": Value::Null,
            "error": e.to_string(),
        })),
    }
}

fn substitute_path_params(template: &str, params: Option<&Value>) -> Result<String, String> {
    let mut result = template.to_string();
    if let Some(params) = params {
        if let Value::Object(map) = params {
            for (k, v) in map {
                let placeholder = format!("{{{}}}", k);
                let value = value_to_string(v)?;
                result = result.replace(&placeholder, &value);
            }
        }
    }
    Ok(result)
}

fn build_url(
    host: &str,
    path: &str,
    supplied_query: Option<&Value>,
    captured_query: &[TemplatedParam],
) -> Result<String, String> {
    let base = if host.starts_with("http://") || host.starts_with("https://") {
        host.to_string()
    } else {
        format!("https://{}", host)
    };
    let mut url = reqwest::Url::parse(&format!("{}{}", base.trim_end_matches('/'), path))
        .map_err(|e| format!("Invalid replay URL: {}", e))?;

    if let Some(Value::Object(map)) = supplied_query {
        for (k, v) in map {
            url.query_pairs_mut()
                .append_pair(k, &value_to_string(v)?);
        }
    } else {
        for p in captured_query {
            if !p.templated {
                url.query_pairs_mut().append_pair(&p.name, &p.value);
            }
        }
    }

    Ok(url.to_string())
}

fn substitute_body_template(template: &str, body: Option<&Value>) -> Result<String, String> {
    if let Some(Value::Object(map)) = body {
        let mut result = template.to_string();
        for (k, v) in map {
            let placeholder = format!("{{{}}}", k);
            let value = value_to_string(v)?;
            result = result.replace(&placeholder, &value);
        }
        Ok(result)
    } else {
        Ok(template.to_string())
    }
}

fn value_to_string(v: &Value) -> Result<String, String> {
    match v {
        Value::String(s) => Ok(s.clone()),
        Value::Number(n) => Ok(n.to_string()),
        Value::Bool(b) => Ok(b.to_string()),
        Value::Null => Ok(String::new()),
        _ => serde_json::to_string(v).map_err(|e| e.to_string()),
    }
}

// ─── Client generation ──────────────────────────────────────────────────────

pub async fn generate_client(
    db: &DbHandle,
    contract_id: &str,
    endpoint_ids: Option<&[String]>,
    language: &str,
) -> Result<String, String> {
    let (_contract, endpoints) = get_contract_with_endpoints(db, contract_id)?
        .ok_or_else(|| format!("Contract not found: {}", contract_id))?;

    let selected: Vec<ApiEndpoint> = match endpoint_ids {
        Some(ids) => endpoints.into_iter().filter(|e| ids.contains(&e.id)).collect(),
        None => endpoints,
    };

    generate_client_from_endpoints(&selected, language)
}

pub async fn generate_client_for_endpoints(
    db: &DbHandle,
    endpoint_ids: &[String],
    language: &str,
) -> Result<String, String> {
    let endpoints: Vec<ApiEndpoint> = tokio::task::spawn_blocking({
        let db = db.clone();
        let endpoint_ids = endpoint_ids.to_vec();
        move || db.get_endpoints_by_ids(&endpoint_ids)
    })
    .await
    .map_err(|e| format!("DB task failed: {}", e))?
    .map_err(|e| format!("Failed to load endpoints: {}", e))?;

    generate_client_from_endpoints(&endpoints, language)
}

fn generate_client_from_endpoints(endpoints: &[ApiEndpoint], language: &str) -> Result<String, String> {
    if endpoints.is_empty() {
        return Err("No endpoints selected for client generation".to_string());
    }

    let code = match language {
        "python" => generate_python_client(endpoints),
        "typescript" => generate_typescript_client(endpoints),
        "curl" => generate_curl_client(endpoints),
        _ => return Err(format!("Unsupported language: {}", language)),
    };

    Ok(code)
}

fn generate_python_client(endpoints: &[ApiEndpoint]) -> String {
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

    for ep in endpoints {
        let path_for_name = ep.path.as_deref().unwrap_or(&ep.path_template.as_deref().unwrap_or("")).to_string();
        let fn_name = sanitize_fn_name(&format!("{}_{}", ep.method.to_lowercase(), path_for_name.replace('/', "_").replace('{', "").replace('}', "")));
        lines.push(format!("    def {}(self, **kwargs):", fn_name));
        lines.push(format!("        \"\"\"{} {}\"\"\"", ep.method, ep.path_template.as_deref().unwrap_or("")));
        lines.push(format!("        path_template = {:?}", ep.path_template.as_deref().unwrap_or("")));
        lines.push("        path = self._substitute_path(path_template, kwargs.get('path_params', {}))".to_string());
        lines.push("        url = self.base_url.rstrip('/') + path".to_string());
        if !ep.query_params.is_empty() {
            lines.push("        params = kwargs.get('query_params')".to_string());
            lines.push("        if params is None:".to_string());
            let defaults: Vec<String> = ep
                .query_params
                .iter()
                .map(|p| format!("{:?}: {:?}", p.name, p.value))
                .collect();
            lines.push(format!("            params = {{{}}}", defaults.join(", ")));
        } else {
            lines.push("        params = kwargs.get('query_params')".to_string());
        }
        lines.push(format!("        method = {:?}", ep.method));
        lines.push("        data = kwargs.get('body')".to_string());
        lines.push(format!(
            "        return self.session.request(method, url, params=params, json=data).json()"
        ));
        lines.push("".to_string());
    }

    lines.push("    def _substitute_path(self, template, params):".to_string());
    lines.push("        path = template".to_string());
    lines.push("        for k, v in params.items():".to_string());
    lines.push("            path = path.replace('{' + k + '}', str(v))".to_string());
    lines.push("        return path".to_string());

    lines.join("\n")
}

fn generate_typescript_client(endpoints: &[ApiEndpoint]) -> String {
    let mut lines = vec![
        "export class HarApiClient {".to_string(),
        "  private baseUrl: string;".to_string(),
        "  private apiKey?: string;".to_string(),
        "".to_string(),
        "  constructor(baseUrl = process.env.API_BASE_URL, apiKey = process.env.API_KEY) {".to_string(),
        "    this.baseUrl = baseUrl || '';".to_string(),
        "    this.apiKey = apiKey;".to_string(),
        "  }".to_string(),
        "".to_string(),
        "  private async request(path: string, init: RequestInit = {}) {".to_string(),
        "    const headers: Record<string, string> = { 'Content-Type': 'application/json' };".to_string(),
        "    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;".to_string(),
        "    const res = await fetch(`${this.baseUrl}${path}`, { ...init, headers });".to_string(),
        "    if (!res.ok) throw new Error(`HTTP ${res.status}`);".to_string(),
        "    return res.json();".to_string(),
        "  }".to_string(),
        "".to_string(),
    ];

    for ep in endpoints {
        let path_for_name = ep.path.as_deref().unwrap_or(&ep.path_template.as_deref().unwrap_or("")).to_string();
        let fn_name = sanitize_fn_name(&format!("{}_{}", ep.method.to_lowercase(), path_for_name.replace('/', "_").replace('{', "").replace('}', "")));
        lines.push(format!(
            "  async {}(pathParams: Record<string, string> = {{}}, queryParams: Record<string, string> = {{}}, body?: unknown) {{",
            fn_name
        ));
        lines.push(format!("    // {} {}", ep.method, ep.path_template.as_deref().unwrap_or("")));
        lines.push(format!("    let path = {:?};", ep.path_template.as_deref().unwrap_or("")));
        lines.push("    for (const [k, v] of Object.entries(pathParams)) {".to_string());
        lines.push("      path = path.replace(`{${k}}`, encodeURIComponent(String(v)));".to_string());
        lines.push("    }".to_string());
        if !ep.query_params.is_empty() {
            lines.push("    const qs = new URLSearchParams(queryParams).toString();".to_string());
            lines.push("    if (qs) path += '?' + qs;".to_string());
        }
        lines.push(format!("    return this.request(path, {{ method: {:?}, body: body ? JSON.stringify(body) : undefined }});", ep.method));
        lines.push("  }".to_string());
        lines.push("".to_string());
    }

    lines.push("}".to_string());
    lines.join("\n")
}

fn generate_curl_client(endpoints: &[ApiEndpoint]) -> String {
    let mut lines = vec![
        "# HAR-derived API replay commands".to_string(),
        "# Set these in your environment before running:".to_string(),
        "# export API_BASE_URL=\"...\"".to_string(),
        "# export API_KEY=\"...\"".to_string(),
        "".to_string(),
    ];

    for ep in endpoints {
        lines.push(format!("# {} {}", ep.method, ep.path_template.as_deref().unwrap_or("")));
        let mut cmd = format!("curl -s \"$API_BASE_URL{}\" ", ep.path_template.as_deref().unwrap_or(""));
        for h in &ep.headers {
            if !h.templated && !is_hop_by_hop_or_sensitive(&h.name) {
                cmd.push_str(&format!("-H \"{}: {}\" ", h.name, h.value));
            }
        }
        if ep.method != "GET" {
            cmd.push_str(&format!("-X {} ", ep.method));
        }
        if let Some(body) = ep.body_template.as_deref() {
            cmd.push_str(&format!("-d '{}'", body.replace('\'', "'\\''")));
        }
        lines.push(cmd);
        lines.push("".to_string());
    }

    lines.join("\n")
}

fn sanitize_fn_name(name: &str) -> String {
    let mut result = String::new();
    for c in name.chars() {
        if c.is_alphanumeric() || c == '_' {
            result.push(c);
        } else {
            result.push('_');
        }
    }
    result = result.trim_matches('_').to_string();
    if result.is_empty() {
        result = "call".to_string();
    }
    // Collapse multiple underscores.
    while result.contains("__") {
        result = result.replace("__", "_");
    }
    result
}

// ─── Tests ──────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extract_endpoints_ignores_static_assets() {
        let har = r#"{"log":{"entries":[]}}"#;
        let eps = extract_endpoints_from_har(har).unwrap();
        assert!(eps.is_empty());
    }

    #[test]
    fn extract_endpoints_assigns_stable_uuids() {
        let har = r#"{"log":{"entries":[{"request":{"method":"GET","url":"https://example.com/api/users/123","headers":[],"queryString":[]},"response":{"status":200}}]}}"#;
        let eps = extract_endpoints_from_har(har).unwrap();
        assert_eq!(eps.len(), 1);
        assert_eq!(eps[0].method, "GET");
        assert_eq!(eps[0].path_template.as_deref().unwrap(), "/api/users/{id}");
        assert_eq!(eps[0].path_params.len(), 1);
        // UUIDs are not deterministic, but they are 36 chars.
        assert_eq!(eps[0].id.len(), 36);
    }

    #[test]
    fn substitute_path_params_replaces_placeholders() {
        let params = json!({"id": "abc"});
        let out = substitute_path_params("/api/users/{id}", Some(&params)).unwrap();
        assert_eq!(out, "/api/users/abc");
    }
}
