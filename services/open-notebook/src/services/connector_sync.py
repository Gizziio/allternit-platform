"""
Connector Sync — pulls content from Allternit's existing connectors into notebook sources.

Reads connector configs from ~/.allternit/connectors/
Pushes extracted content into notebook sources via the Open Notebook API.

Supported connectors:
- Gmail: IMAP/polling → email threads + attachments
- Slack: API → channels, threads
- Notion: API → pages, databases
- Linear: API → issues, comments
- GitHub: API → issues, PRs, repo docs
"""

import os
import json
import asyncio
from typing import List, Dict, Any, Optional
from datetime import datetime

CONNECTORS_DIR = os.path.expanduser("~/.allternit/connectors")


class ConnectorSync:
    def __init__(self):
        self.connectors_dir = CONNECTORS_DIR

    def list_available_connectors(self) -> List[str]:
        """List configured connectors."""
        if not os.path.exists(self.connectors_dir):
            return []
        connectors = []
        for f in os.listdir(self.connectors_dir):
            if f.endswith('.json'):
                connectors.append(f[:-5])  # Remove .json
        return connectors

    def read_connector_config(self, name: str) -> Optional[Dict[str, Any]]:
        """Read a connector config file."""
        path = os.path.join(self.connectors_dir, f"{name}.json")
        if not os.path.exists(path):
            return None
        try:
            with open(path, 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"[ConnectorSync] Failed to read {name}: {e}")
            return None

    async def sync_gmail(self, notebook_id: str, max_emails: int = 20) -> List[Dict[str, Any]]:
        """Sync Gmail emails to notebook sources via IMAP."""
        config = self.read_connector_config("gmail")
        if not config:
            return []

        try:
            import imaplib
            import email
            from email.header import decode_header
        except ImportError:
            return [{
                "type": "gmail",
                "title": "Gmail sync: imaplib not available",
                "content": "Python imaplib module is required for Gmail sync.",
                "metadata": {"connector": "gmail", "synced_at": datetime.utcnow().isoformat()},
            }]

        email_address = config.get("email")
        app_password = config.get("app_password")
        if not email_address or not app_password:
            return [{
                "type": "gmail",
                "title": "Gmail sync: missing credentials",
                "content": "Connector config needs 'email' and 'app_password' fields.",
                "metadata": {"connector": "gmail", "synced_at": datetime.utcnow().isoformat()},
            }]

        items = []
        try:
            # Run IMAP in thread pool to avoid blocking async loop
            def _fetch():
                mail = imaplib.IMAP4_SSL("imap.gmail.com")
                mail.login(email_address, app_password)
                mail.select("inbox")
                _, data = mail.search(None, "UNSEEN")
                ids = data[0].split()[-max_emails:] if data[0] else []
                results = []
                for msg_id in ids:
                    _, msg_data = mail.fetch(msg_id, "(RFC822)")
                    raw = msg_data[0][1]
                    msg = email.message_from_bytes(raw)
                    subject = ""
                    for part, enc in decode_header(msg.get("Subject", "")):
                        if isinstance(part, bytes):
                            subject += part.decode(enc or "utf-8", errors="replace")
                        else:
                            subject += part
                    body = ""
                    if msg.is_multipart():
                        for part in msg.walk():
                            ctype = part.get_content_type()
                            if ctype == "text/plain":
                                payload = part.get_payload(decode=True)
                                if payload:
                                    body = payload.decode("utf-8", errors="replace")
                                break
                    else:
                        payload = msg.get_payload(decode=True)
                        if payload:
                            body = payload.decode("utf-8", errors="replace")
                    results.append({
                        "type": "gmail",
                        "title": subject or "(No Subject)",
                        "content": body[:8000],
                        "metadata": {
                            "connector": "gmail",
                            "from": msg.get("From", ""),
                            "date": msg.get("Date", ""),
                            "synced_at": datetime.utcnow().isoformat(),
                        },
                    })
                mail.logout()
                return results

            items = await asyncio.to_thread(_fetch)
        except Exception as e:
            items = [{
                "type": "gmail",
                "title": f"Gmail sync error: {type(e).__name__}",
                "content": str(e),
                "metadata": {"connector": "gmail", "synced_at": datetime.utcnow().isoformat()},
            }]

        return items

    async def sync_slack(self, notebook_id: str, channel: Optional[str] = None) -> List[Dict[str, Any]]:
        """Sync Slack messages to notebook sources via Slack API."""
        config = self.read_connector_config("slack")
        if not config:
            return []

        token = config.get("bot_token") or config.get("token")
        if not token:
            return [{
                "type": "slack",
                "title": "Slack sync: missing token",
                "content": "Connector config needs 'bot_token' or 'token' field.",
                "metadata": {"connector": "slack", "synced_at": datetime.utcnow().isoformat()},
            }]

        import urllib.request
        import urllib.error

        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        items = []

        def _api_call(url):
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=15) as resp:
                return json.loads(resp.read().decode())

        try:
            if channel:
                # Fetch specific channel history
                channel_id = channel
                if not channel.startswith("C") and not channel.startswith("D"):
                    # Resolve channel name to ID
                    channels_resp = await asyncio.to_thread(_api_call, "https://slack.com/api/conversations.list?types=public_channel,private_channel")
                    for ch in channels_resp.get("channels", []):
                        if ch["name"] == channel:
                            channel_id = ch["id"]
                            break
                url = f"https://slack.com/api/conversations.history?channel={channel_id}&limit=50"
                history = await asyncio.to_thread(_api_call, url)
                msgs = history.get("messages", [])
                content_lines = []
                for m in msgs:
                    if m.get("type") == "message" and not m.get("subtype"):
                        ts = datetime.fromtimestamp(float(m.get("ts", 0))).isoformat()
                        content_lines.append(f"[{ts}] {m.get('user', 'unknown')}: {m.get('text', '')}")
                items.append({
                    "type": "slack",
                    "title": f"Slack: #{channel}",
                    "content": "\n".join(content_lines)[:8000],
                    "metadata": {
                        "connector": "slack",
                        "channel": channel,
                        "message_count": len(msgs),
                        "synced_at": datetime.utcnow().isoformat(),
                    },
                })
            else:
                # List available channels
                channels_resp = await asyncio.to_thread(_api_call, "https://slack.com/api/conversations.list?types=public_channel&limit=10")
                for ch in channels_resp.get("channels", []):
                    url = f"https://slack.com/api/conversations.history?channel={ch['id']}&limit=20"
                    history = await asyncio.to_thread(_api_call, url)
                    msgs = history.get("messages", [])
                    content_lines = []
                    for m in msgs:
                        if m.get("type") == "message" and not m.get("subtype"):
                            ts = datetime.fromtimestamp(float(m.get("ts", 0))).isoformat()
                            content_lines.append(f"[{ts}] {m.get('user', 'unknown')}: {m.get('text', '')}")
                    if content_lines:
                        items.append({
                            "type": "slack",
                            "title": f"Slack: #{ch['name']}",
                            "content": "\n".join(content_lines)[:8000],
                            "metadata": {
                                "connector": "slack",
                                "channel": ch["name"],
                                "message_count": len(msgs),
                                "synced_at": datetime.utcnow().isoformat(),
                            },
                        })
        except Exception as e:
            items = [{
                "type": "slack",
                "title": f"Slack sync error: {type(e).__name__}",
                "content": str(e),
                "metadata": {"connector": "slack", "synced_at": datetime.utcnow().isoformat()},
            }]

        return items

    async def sync_notion(self, notebook_id: str, page_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Sync Notion pages to notebook sources via Notion API."""
        config = self.read_connector_config("notion")
        if not config:
            return []

        token = config.get("token") or config.get("integration_token")
        if not token:
            return [{
                "type": "notion",
                "title": "Notion sync: missing token",
                "content": "Connector config needs 'token' or 'integration_token' field.",
                "metadata": {"connector": "notion", "synced_at": datetime.utcnow().isoformat()},
            }]

        import urllib.request

        headers = {
            "Authorization": f"Bearer {token}",
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
        }
        items = []

        def _api_call(url):
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=15) as resp:
                return json.loads(resp.read().decode())

        def _fetch_blocks(page_id):
            blocks = []
            next_cursor = None
            while True:
                url = f"https://api.notion.com/v1/blocks/{page_id}/children?page_size=100"
                if next_cursor:
                    url += f"&start_cursor={next_cursor}"
                data = _api_call(url)
                for block in data.get("results", []):
                    block_type = block.get("type", "")
                    if block_type in ("paragraph", "heading_1", "heading_2", "heading_3", "bulleted_list_item", "numbered_list_item", "quote", "to_do"):
                        rich_text = block.get(block_type, {}).get("rich_text", [])
                        text = "".join(rt.get("plain_text", "") for rt in rich_text)
                        if text:
                            blocks.append(text)
                next_cursor = data.get("next_cursor")
                if not next_cursor:
                    break
            return blocks

        try:
            if page_id:
                title = "Notion Page"
                try:
                    page_data = await asyncio.to_thread(_api_call, f"https://api.notion.com/v1/pages/{page_id}")
                    props = page_data.get("properties", {})
                    if "title" in props:
                        title = "".join(t.get("plain_text", "") for t in props["title"].get("title", []))
                    elif "Name" in props:
                        title = "".join(t.get("plain_text", "") for t in props["Name"].get("title", []))
                except Exception:
                    pass
                blocks = await asyncio.to_thread(_fetch_blocks, page_id)
                items.append({
                    "type": "notion",
                    "title": title,
                    "content": "\n\n".join(blocks)[:8000],
                    "metadata": {
                        "connector": "notion",
                        "page_id": page_id,
                        "synced_at": datetime.utcnow().isoformat(),
                    },
                })
            else:
                # Search for pages
                req = urllib.request.Request(
                    "https://api.notion.com/v1/search",
                    headers=headers,
                    data=json.dumps({"page_size": 10}).encode(),
                    method="POST",
                )
                search_data = await asyncio.to_thread(lambda: json.loads(urllib.request.urlopen(req, timeout=15).read().decode()))
                for result in search_data.get("results", []):
                    pid = result.get("id", "")
                    title = result.get("properties", {}).get("title", {}).get("title", [{}])[0].get("plain_text", "Untitled")
                    blocks = await asyncio.to_thread(_fetch_blocks, pid)
                    if blocks:
                        items.append({
                            "type": "notion",
                            "title": title,
                            "content": "\n\n".join(blocks)[:8000],
                            "metadata": {
                                "connector": "notion",
                                "page_id": pid,
                                "synced_at": datetime.utcnow().isoformat(),
                            },
                        })
        except Exception as e:
            items = [{
                "type": "notion",
                "title": f"Notion sync error: {type(e).__name__}",
                "content": str(e),
                "metadata": {"connector": "notion", "synced_at": datetime.utcnow().isoformat()},
            }]

        return items

    async def sync_connector(self, notebook_id: str, connector_type: str, **kwargs) -> List[Dict[str, Any]]:
        """Generic sync dispatcher."""
        if connector_type == "gmail":
            return await self.sync_gmail(notebook_id, **kwargs)
        elif connector_type == "slack":
            return await self.sync_slack(notebook_id, **kwargs)
        elif connector_type == "notion":
            return await self.sync_notion(notebook_id, **kwargs)
        else:
            raise ValueError(f"Unknown connector type: {connector_type}")


connector_sync = ConnectorSync()
