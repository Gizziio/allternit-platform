from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, Optional

import requests
from quickjs import Context, JSException

REPO_ROOT = Path(__file__).resolve().parents[3]
PLUGIN_ROOT = REPO_ROOT / "5-ui" / "a2r-platform" / "src" / "a2r-usage" / "plugins"
APP_DATA_DIR = Path.home() / ".a2r" / "a2r-usage"
KEYCHAIN_DIR = APP_DATA_DIR / "keychain"


def _ensure_dirs():
    APP_DATA_DIR.mkdir(parents=True, exist_ok=True)
    KEYCHAIN_DIR.mkdir(parents=True, exist_ok=True)


def _expand_path(value: str) -> str:
    return os.path.expanduser(value)


def _keychain_file(service: str) -> Path:
    return KEYCHAIN_DIR / f"kc-{service}.json"


def _py_fs_exists(path: str) -> bool:
    try:
        return Path(_expand_path(path)).exists()
    except Exception:
        return False


def _py_fs_read(path: str) -> Optional[str]:
    try:
        return Path(_expand_path(path)).read_text()
    except Exception as exc:
        raise RuntimeError(str(exc))


def _py_fs_write(path: str, content: str) -> None:
    Path(_expand_path(path)).write_text(content)


def _py_env_get(name: str) -> Optional[str]:
    if name == "CODEX_HOME":
        return os.environ.get("CODEX_HOME")
    return None


def _py_log_info(msg: str) -> None:
    logging.info("[plugin] %s", msg)


def _py_log_warn(msg: str) -> None:
    logging.warning("[plugin] %s", msg)


def _py_log_error(msg: str) -> None:
    logging.error("[plugin] %s", msg)


def _py_http_request(payload: str) -> str:
    req = json.loads(payload or "{}")
    method = req.get("method", "GET").upper()
    url = req.get("url")
    headers = req.get("headers") or {}
    body = req.get("bodyText")
    timeout_ms = req.get("timeoutMs", 10000)
    verify = not req.get("dangerouslyIgnoreTls", False)

    try:
        resp = requests.request(
            method,
            url,
            headers=headers,
            data=body,
            timeout=timeout_ms / 1000,
            verify=verify,
        )
        return json.dumps(
            {
                "status": resp.status_code,
                "headers": dict(resp.headers),
                "bodyText": resp.text,
            }
        )
    except Exception as exc:
        logging.warning("plugin http error: %s", exc)
        return json.dumps(
            {"status": 0, "headers": {}, "bodyText": str(exc)}
        )


def _py_keychain_read(service: str) -> Optional[str]:
    path = _keychain_file(service)
    if path.exists():
        return path.read_text()
    return None


def _py_keychain_write(service: str, content: str) -> None:
    path = _keychain_file(service)
    path.write_text(content)


def _py_keychain_delete(service: str) -> None:
    path = _keychain_file(service)
    if path.exists():
        path.unlink()


def _py_ls_discover(_: str) -> str:
    return "null"


def _py_sqlite_query(_: str, __: str) -> str:
    return "[]"


def _py_sqlite_exec(_: str, __: str) -> str:
    return "[]"


def _build_host_template(plugin_id: str, plugin_data_dir: str) -> str:
    return f"""
const pluginId = {json.dumps(plugin_id)};
const pluginDataDir = {json.dumps(plugin_data_dir)};
const host = {{
  fs: {{
    exists: (path) => py_fs_exists(path),
    readText: (path) => py_fs_read(path),
    writeText: (path, content) => {{
      py_fs_write(path, content);
      return null;
    }},
  }},
  log: {{
    info: (msg) => py_log_info(msg),
    warn: (msg) => py_log_warn(msg),
    error: (msg) => py_log_error(msg),
  }},
  http: {{
    request: (opts) => JSON.parse(py_http_request(JSON.stringify(opts || {{}}))),
  }},
  env: {{
    get: (name) => py_env_get(name),
  }},
  keychain: {{
    readGenericPassword: (service) => py_keychain_read(service),
    writeGenericPassword: (service, value) => {{
      py_keychain_write(service, value);
    }},
    deleteGenericPassword: (service) => {{
      py_keychain_delete(service);
    }},
  }},
  ls: {{
    discover: (opts) => JSON.parse(py_ls_discover(JSON.stringify(opts || {{}}))),
  }},
  sqlite: {{
    query: (db, sql) => py_sqlite_query(db, sql),
    exec: (db, sql) => py_sqlite_exec(db, sql),
  }},
}};
const ctx = {{
  nowIso: new Date().toISOString(),
  host: host,
}};
ctx.line = {{
  text: (opts) => {{
    const line = {{ type: "text", label: opts.label, value: opts.value }};
    if (opts.color) line.color = opts.color;
    if (opts.subtitle) line.subtitle = opts.subtitle;
    return line;
  }},
  progress: (opts) => {{
    const line = {{
      type: "progress",
      label: opts.label,
      used: opts.used,
      limit: opts.limit,
      format: opts.format && opts.format.kind ? opts.format.kind : opts.format,
    }};
    if (opts.resetsAt) line.resetsAt = opts.resetsAt;
    if (opts.periodDurationMs) line.periodDurationMs = opts.periodDurationMs;
    if (opts.color) line.color = opts.color;
    if (opts.subtitle) line.subtitle = opts.subtitle;
    return line;
  }},
  badge: (opts) => {{
    const line = {{ type: "badge", label: opts.label, text: opts.text }};
    if (opts.color) line.color = opts.color;
    if (opts.subtitle) line.subtitle = opts.subtitle;
    return line;
  }},
}};
ctx.util = {{
  tryParseJson: (text) => {{
    if (text == null) return null;
    try {{
      return JSON.parse(text);
    }} catch (e) {{
      return null;
    }}
  }},
  safeJsonParse: (text) => {{
    if (text == null) return {{ ok: false }};
    try {{
      return {{ ok: true, value: JSON.parse(text) }};
    }} catch (e) {{
      return {{ ok: false }};
    }}
  }},
  request: (opts) => {{
    return ctx.host.http.request(opts);
  }},
  requestJson: (opts) => {{
    const resp = ctx.util.request(opts);
    const parsed = ctx.util.safeJsonParse(resp.bodyText);
    return {{ resp, json: parsed.ok ? parsed.value : null }};
  }},
  needsRefreshByExpiry: (opts) => {{
    if (!opts) return true;
    const nowMs = Number(opts.nowMs);
    const expiresAtMs = Number(opts.expiresAtMs);
    const bufferMs = Number(opts.bufferMs || 0);
    if (!Number.isFinite(nowMs) || !Number.isFinite(expiresAtMs)) return true;
    return nowMs + bufferMs >= expiresAtMs;
  }},
}};
ctx.fmt = {{
  planLabel: (value) => {{
    const text = String(value || "").trim();
    if (!text) return "";
    return text.replace(/(^|\\s)([a-z])/g, (match, space, letter) => space + letter.toUpperCase());
  }},
  resetIn: (seconds) => {{
    if (!Number.isFinite(seconds) || seconds < 0) return null;
    return Math.round(seconds / 60) + "m";
  }},
}};
__a2r_usage_ctx = ctx;
"""


HOST_TEMPLATE_CACHE: Dict[str, str] = {}


def _compose_host_js(plugin_id: str, plugin_data_dir: str) -> str:
    return _build_host_template(plugin_id, plugin_data_dir)


def run_probe(plugin_id: str) -> Optional[Dict[str, Any]]:
    _ensure_dirs()
    plugin_dir = PLUGIN_ROOT / plugin_id
    if not plugin_dir.exists():
        logging.warning("plugin %s missing", plugin_id)
        return None

    entry = plugin_dir / "plugin.js"
    if not entry.exists():
        logging.warning("plugin entry missing for %s", plugin_id)
        return None

    plugin_data_dir = APP_DATA_DIR / plugin_id
    plugin_data_dir.mkdir(parents=True, exist_ok=True)
    script = entry.read_text()
    code = "\n".join(
        [
            _compose_host_js(plugin_id, str(plugin_data_dir)),
            script,
            "JSON.stringify(__a2r_usage_plugin.probe(__a2r_usage_ctx));",
        ]
    )

    ctx = Context()
    ctx.add_callable("py_fs_exists", _py_fs_exists)
    ctx.add_callable("py_fs_read", _py_fs_read)
    ctx.add_callable("py_fs_write", _py_fs_write)
    ctx.add_callable("py_env_get", _py_env_get)
    ctx.add_callable("py_log_info", _py_log_info)
    ctx.add_callable("py_log_warn", _py_log_warn)
    ctx.add_callable("py_log_error", _py_log_error)
    ctx.add_callable("py_http_request", _py_http_request)
    ctx.add_callable("py_keychain_read", _py_keychain_read)
    ctx.add_callable("py_keychain_write", _py_keychain_write)
    ctx.add_callable("py_keychain_delete", _py_keychain_delete)
    ctx.add_callable("py_ls_discover", _py_ls_discover)
    ctx.add_callable("py_sqlite_query", _py_sqlite_query)
    ctx.add_callable("py_sqlite_exec", _py_sqlite_exec)

    try:
        payload = ctx.eval(code)
        if payload is None:
            return None
        return json.loads(payload)
    except (JSException, Exception) as exc:
        logging.error("plugin %s probe failed: %s", plugin_id, exc)
        return None
