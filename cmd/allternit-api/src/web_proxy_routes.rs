use axum::{
    body::Body,
    extract::Query,
    http::{HeaderMap, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use reqwest::redirect::Policy;
use serde::Deserialize;
use std::{net::IpAddr, time::Duration};

use crate::AppState;
use std::sync::Arc;

pub fn web_proxy_router() -> Router<Arc<AppState>> {
    Router::new().route("/web-proxy", get(web_proxy))
}

#[derive(Debug, Deserialize)]
struct WebProxyQuery {
    url: Option<String>,
}

async fn web_proxy(Query(query): Query<WebProxyQuery>) -> Response {
    let Some(target_url) = query.url else {
        return json_error(StatusCode::BAD_REQUEST, "Missing ?url= query parameter");
    };

    let parsed = match reqwest::Url::parse(&target_url) {
        Ok(url) => url,
        Err(_) => return json_error(StatusCode::BAD_REQUEST, "Invalid URL"),
    };

    if !matches!(parsed.scheme(), "http" | "https") {
        return json_error(StatusCode::FORBIDDEN, "Only http/https URLs are allowed");
    }

    if is_private_host(parsed.host_str().unwrap_or_default()) {
        return json_error(
            StatusCode::FORBIDDEN,
            "Requests to private/loopback addresses are blocked",
        );
    }

    let client = match reqwest::Client::builder()
        .redirect(Policy::limited(10))
        .timeout(Duration::from_secs(15))
        .build()
    {
        Ok(client) => client,
        Err(_) => {
            return json_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to build proxy client",
            )
        }
    };

    let upstream = match client
        .get(parsed.clone())
        .header(
            reqwest::header::USER_AGENT,
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        )
        .header(
            reqwest::header::ACCEPT,
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        )
        .header(reqwest::header::ACCEPT_LANGUAGE, "en-US,en;q=0.9")
        .send()
        .await
    {
        Ok(response) => response,
        Err(_) => return json_error(StatusCode::BAD_GATEWAY, "Failed to fetch upstream URL"),
    };

    let status = upstream.status();
    let final_url = upstream.url().clone();
    let content_type = upstream
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("")
        .to_string();
    let is_html = content_type.contains("text/html") || content_type.is_empty();

    if !is_html {
        let mut headers = HeaderMap::new();
        if let Some(value) = upstream.headers().get(reqwest::header::CONTENT_TYPE) {
            if let Ok(value_str) = value.to_str() {
                if let Ok(header_value) = HeaderValue::from_str(value_str) {
                    headers.insert(axum::http::header::CONTENT_TYPE, header_value);
                }
            }
        }
        headers.insert(
            axum::http::header::ACCESS_CONTROL_ALLOW_ORIGIN,
            HeaderValue::from_static("*"),
        );

        let body = match upstream.bytes().await {
            Ok(bytes) => Body::from(bytes),
            Err(_) => return json_error(StatusCode::BAD_GATEWAY, "Failed to read response body"),
        };

        return (
            StatusCode::from_u16(status.as_u16()).unwrap_or(StatusCode::BAD_GATEWAY),
            headers,
            body,
        )
            .into_response();
    }

    let mut body_text = match upstream.text().await {
        Ok(body) => body,
        Err(_) => return json_error(StatusCode::BAD_GATEWAY, "Failed to read response body"),
    };

    let base_origin = format!(
        "{}://{}",
        final_url.scheme(),
        final_url.host_str().unwrap_or_default()
    );

    if final_url
        .host_str()
        .map(|host| host.ends_with("login.microsoftonline.com"))
        .unwrap_or(false)
    {
        body_text = body_text.replace("sso_reload=True", "");
        body_text = body_text.replace("\"reloadOnFailure\":true", "\"reloadOnFailure\":false");
        body_text = body_text.replace(
            "\"enabled\":true,\"type\":\"chrome\",\"reason\":\"Pull is needed\"",
            "\"enabled\":false,\"type\":\"chrome\",\"reason\":\"Disabled by embedded proxy\"",
        );
    }

    for pattern in [
        r#"(<iframe\b[^>]+\ssrc=)(["'])([^"']*)(["'])"#,
        r#"(<frame\b[^>]+\ssrc=)(["'])([^"']*)(["'])"#,
        r#"(<form\b[^>]+\saction=)(["'])([^"']*)(["'])"#,
        r#"(<a\b[^>]+\shref=)(["'])([^"']*)(["'])"#,
    ] {
        let regex = regex::Regex::new(pattern).expect("valid proxy rewrite regex");
        body_text = regex
            .replace_all(&body_text, |caps: &regex::Captures| {
                let prefix = caps.get(1).map(|m| m.as_str()).unwrap_or_default();
                let opening_quote = caps.get(2).map(|m| m.as_str()).unwrap_or("\"");
                let raw = caps.get(3).map(|m| m.as_str()).unwrap_or_default();
                let closing_quote = caps.get(4).map(|m| m.as_str()).unwrap_or(opening_quote);
                format!(
                    "{prefix}{opening_quote}{}{closing_quote}",
                    proxify_url(raw, &final_url)
                )
            })
            .into_owned();
    }

    let injected_head = format!(
        r#"<base href="{base_origin}/"><script>
(function(){{
  var _proxyPrefix = '/api/web-proxy?url=';
  function toProxy(url) {{
    if (!url || url.charAt(0) === '#') return url;
    try {{
      var abs = new URL(url, '{final_url}').toString();
      if (abs.indexOf('/api/web-proxy?url=') !== -1) return abs;
      return _proxyPrefix + encodeURIComponent(abs);
    }} catch(e) {{ return url; }}
  }}
  document.addEventListener('click', function(event) {{
    var anchor = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (!anchor) return;
    var href = anchor.getAttribute('href');
    if (!href || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#')) return;
    event.preventDefault();
    window.parent.postMessage({{ type: 'allternit-navigate', url: toProxy(href) }}, '*');
  }}, true);
  var _push = history.pushState.bind(history);
  var _replace = history.replaceState.bind(history);
  history.pushState = function(state, title, url) {{
    if (url) {{
      window.parent.postMessage({{ type: 'allternit-navigate', url: toProxy(String(url)) }}, '*');
      return;
    }}
    return _push(state, title, url);
  }};
  history.replaceState = function(state, title, url) {{
    if (url) {{
      window.parent.postMessage({{ type: 'allternit-navigate', url: toProxy(String(url)) }}, '*');
      return;
    }}
    return _replace(state, title, url);
  }};
}})();
</script>"#,
    );

    if let Some(idx) = body_text.find("<head>") {
        body_text.insert_str(idx + "<head>".len(), &injected_head);
    } else if let Some(idx) = body_text.find("<html>") {
        body_text.insert_str(
            idx + "<html>".len(),
            &format!("<head>{}</head>", injected_head),
        );
    } else {
        body_text = format!("<head>{}</head>{}", injected_head, body_text);
    }

    let mut headers = HeaderMap::new();
    headers.insert(
        axum::http::header::CONTENT_TYPE,
        HeaderValue::from_static("text/html; charset=utf-8"),
    );
    headers.insert(
        axum::http::header::ACCESS_CONTROL_ALLOW_ORIGIN,
        HeaderValue::from_static("*"),
    );

    (
        StatusCode::from_u16(status.as_u16()).unwrap_or(StatusCode::BAD_GATEWAY),
        headers,
        Body::from(body_text),
    )
        .into_response()
}

fn proxify_url(raw_url: &str, final_url: &reqwest::Url) -> String {
    if raw_url.is_empty()
        || raw_url.starts_with("data:")
        || raw_url.starts_with("blob:")
        || raw_url.starts_with("javascript:")
        || raw_url.starts_with('#')
        || raw_url.starts_with("mailto:")
        || raw_url.starts_with("tel:")
    {
        return raw_url.to_string();
    }
    if raw_url.starts_with("/api/web-proxy?url=") {
        return raw_url.to_string();
    }
    match final_url.join(raw_url) {
        Ok(abs) => format!("/api/web-proxy?url={}", urlencoding::encode(abs.as_str())),
        Err(_) => raw_url.to_string(),
    }
}

fn json_error(status: StatusCode, message: &str) -> Response {
    (
        status,
        axum::Json(serde_json::json!({
            "error": message,
        })),
    )
        .into_response()
}

fn is_private_host(hostname: &str) -> bool {
    let host = hostname.trim().to_ascii_lowercase();
    if host.is_empty() {
        return true;
    }
    if host == "localhost" || host.ends_with(".local") {
        return true;
    }
    if let Ok(ip) = host.parse::<IpAddr>() {
        return match ip {
            IpAddr::V4(ipv4) => {
                ipv4.is_loopback()
                    || ipv4.is_private()
                    || ipv4.is_link_local()
                    || ipv4.is_multicast()
                    || ipv4.is_unspecified()
            }
            IpAddr::V6(ipv6) => {
                ipv6.is_loopback()
                    || ipv6.is_multicast()
                    || ipv6.is_unspecified()
                    || ipv6.is_unique_local()
                    || ipv6.is_unicast_link_local()
            }
        };
    }
    false
}
