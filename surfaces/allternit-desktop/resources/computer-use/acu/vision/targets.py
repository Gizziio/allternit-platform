"""
Allternit Computer Use — Target Detection Heuristics

Detects actionable targets from page/desktop state using regex and keyword
matching rather than visual inference. Used as heuristic fallback inside
the VisionLoop when a VLM is not available.
"""

import re
from typing import Any, Dict, List, Optional


# ---------------------------------------------------------------------------
# Verb → action_type maps
# ---------------------------------------------------------------------------

_CLICK_VERBS = {
    "click", "press", "tap", "select", "choose", "open", "launch",
    "navigate", "go", "visit", "follow", "activate",
}

_TYPE_VERBS = {
    "type", "enter", "input", "write", "fill", "search", "query", "paste",
}

_SCROLL_VERBS = {
    "scroll", "swipe",
}

_SUBMIT_VERBS = {
    "submit", "send", "confirm", "save", "login", "sign in", "sign up",
    "register", "download", "upload",
}

# Common button/link keywords (used for boosting and fallback text scan)
_CLICK_KEYWORDS = [
    "submit", "continue", "next", "confirm", "ok", "yes", "accept",
    "save", "send", "sign in", "log in", "login", "sign up", "register",
    "download", "upload", "open", "close", "cancel", "back", "proceed",
    "buy", "checkout", "pay", "search", "find", "apply", "install",
]

# Input field keywords
_INPUT_KEYWORDS = [
    "email", "password", "username", "name", "search", "query",
    "address", "phone", "message", "comment",
]


# ---------------------------------------------------------------------------
# TargetDetector
# ---------------------------------------------------------------------------

class TargetDetector:
    """
    Detect actionable targets from page state without VLM.

    All methods are static — no instance state required.

    Return schema for from_browser_state candidates:
        action_type  str   "click" | "fill" | "scroll"
        selector     str   CSS selector or text= hint
        text         str   Visible label / placeholder text
        parameters   dict  Ready-to-pass action parameters
        confidence   float 0.0 – 1.0
        source       str   "elements" | "html" | "text"

    Return schema for from_task_description:
        action_type  str
        target       str   selector or coordinate hint
        parameters   dict
        confidence   float
        reason       str
    """

    # ------------------------------------------------------------------
    # from_browser_state
    # ------------------------------------------------------------------

    @staticmethod
    def from_browser_state(extracted_content: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Extract candidate targets from a browser adapter's extracted_content dict.

        Accepted keys (all optional):
            text     - page innerText
            html     - raw HTML string
            url      - current page URL
            title    - page title
            elements - pre-extracted element list [{tag, text, selector, ...}]

        Returns a list of candidate dicts sorted by confidence descending.
        """
        candidates: List[Dict[str, Any]] = []

        # --- 1. Pre-extracted elements (highest confidence) ---
        for el in extracted_content.get("elements", []):
            tag = (el.get("tag") or el.get("type") or "").lower()
            text = (el.get("text") or el.get("label") or el.get("placeholder") or "").strip()
            sel = (
                el.get("selector")
                or (f"#{el['id']}" if el.get("id") else None)
                or (f"[name='{el['name']}']" if el.get("name") else None)
                or (f"text={text}" if text else "")
            )

            if tag in ("button", "a", "link"):
                candidates.append({
                    "action_type": "click",
                    "selector": sel,
                    "text": text,
                    "parameters": {"selector": sel},
                    "confidence": 0.85,
                    "source": "elements",
                })
            elif tag in ("input", "textarea", "select"):
                input_type = (el.get("input_type") or el.get("type") or "text").lower()
                if input_type in ("submit", "button", "reset"):
                    label = text or el.get("value", "")
                    candidates.append({
                        "action_type": "click",
                        "selector": sel,
                        "text": label,
                        "parameters": {"selector": sel},
                        "confidence": 0.8,
                        "source": "elements",
                    })
                elif input_type not in ("hidden",):
                    candidates.append({
                        "action_type": "fill",
                        "selector": sel,
                        "text": text,
                        "parameters": {"selector": sel, "text": ""},
                        "confidence": 0.75,
                        "source": "elements",
                    })

        # --- 2. HTML scraping ---
        html = extracted_content.get("html", "")
        if html:
            # Buttons
            for m in re.finditer(
                r'<button[^>]*>(.*?)</button>', html, re.IGNORECASE | re.DOTALL
            ):
                btn_text = re.sub(r'<[^>]+>', '', m.group(1))
                btn_text = re.sub(r'\s+', ' ', btn_text).strip()
                if btn_text and len(btn_text) < 80:
                    sel = f"button:has-text('{btn_text[:40]}')"
                    candidates.append({
                        "action_type": "click",
                        "selector": sel,
                        "text": btn_text,
                        "parameters": {"selector": sel},
                        "confidence": 0.7,
                        "source": "html",
                    })

            # Anchors
            for m in re.finditer(
                r'<a\s[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)</a>',
                html, re.IGNORECASE | re.DOTALL
            ):
                href = m.group(1)
                link_text = re.sub(r'<[^>]+>', '', m.group(2))
                link_text = re.sub(r'\s+', ' ', link_text).strip()
                if link_text and len(link_text) < 100 and not href.startswith(("#", "javascript")):
                    sel = f"a:has-text('{link_text[:40]}')"
                    candidates.append({
                        "action_type": "click",
                        "selector": sel,
                        "text": link_text,
                        "parameters": {"selector": sel, "href": href},
                        "confidence": 0.65,
                        "source": "html",
                    })

            # Inputs
            for m in re.finditer(
                r'<input([^>]+)/?>',
                html, re.IGNORECASE
            ):
                attrs_str = m.group(1)
                input_type_m = re.search(r'type=["\'](\w+)["\']', attrs_str, re.IGNORECASE)
                input_type = (input_type_m.group(1) if input_type_m else "text").lower()

                # grab name, id, or placeholder for identification
                name_m = re.search(r'(?:name|id|placeholder)=["\']([^"\']+)["\']', attrs_str, re.IGNORECASE)
                attr_val = name_m.group(1) if name_m else ""
                if not attr_val:
                    continue

                if input_type in ("submit", "button"):
                    sel = f"input[value='{attr_val}']"
                    candidates.append({
                        "action_type": "click",
                        "selector": sel,
                        "text": attr_val,
                        "parameters": {"selector": sel},
                        "confidence": 0.65,
                        "source": "html",
                    })
                elif input_type not in ("hidden", "checkbox", "radio"):
                    sel = f"input[name='{attr_val}'], input[id='{attr_val}']"
                    candidates.append({
                        "action_type": "fill",
                        "selector": sel,
                        "text": attr_val,
                        "parameters": {"selector": sel, "text": ""},
                        "confidence": 0.6,
                        "source": "html",
                    })

        # --- 3. Plain text heuristics (fallback) ---
        page_text = extracted_content.get("text", "")
        if page_text and not candidates:
            for line in page_text.splitlines():
                line = line.strip()
                if not line or len(line) > 120:
                    continue
                lower = line.lower()
                for kw in _CLICK_KEYWORDS:
                    if kw in lower:
                        sel = f"text={line}"
                        candidates.append({
                            "action_type": "click",
                            "selector": sel,
                            "text": line,
                            "parameters": {"selector": sel},
                            "confidence": 0.4,
                            "source": "text",
                        })
                        break

        # Deduplicate by (action_type, text)
        seen: set = set()
        unique: List[Dict[str, Any]] = []
        for c in candidates:
            key = (c["action_type"], c["text"])
            if key not in seen:
                seen.add(key)
                unique.append(c)

        # Sort by confidence descending, cap at 20 candidates
        unique.sort(key=lambda c: c["confidence"], reverse=True)
        return unique[:20]

    # ------------------------------------------------------------------
    # from_task_description
    # ------------------------------------------------------------------

    @staticmethod
    def from_task_description(task: str, page_text: str) -> Dict[str, Any]:
        """
        Match task description keywords against page text to find the most
        likely target and action type.

        Returns a dict with keys:
            action_type  str
            target       str   CSS selector or "" for scroll
            parameters   dict
            confidence   float
            reason       str
        Or an empty dict if the task string is empty.
        """
        if not task:
            return {}

        task_lower = task.lower().strip()
        page_lower = (page_text or "").lower()
        page_lines = [l.strip() for l in (page_text or "").splitlines() if l.strip()]

        # --- Determine intended action type ---
        action_type = "click"
        for verb in _TYPE_VERBS:
            if re.search(r'\b' + re.escape(verb) + r'\b', task_lower):
                action_type = "fill"
                break
        for verb in _SCROLL_VERBS:
            if re.search(r'\b' + re.escape(verb) + r'\b', task_lower):
                action_type = "scroll"
                break

        # Scroll is self-contained; resolve direction and return early
        if action_type == "scroll":
            direction = "up" if re.search(r'\b(?:up|top|back)\b', task_lower) else "down"
            clicks = -3 if direction == "down" else 3
            return {
                "action_type": "scroll",
                "target": "",
                "parameters": {"x": 0, "y": 0, "clicks": clicks},
                "confidence": 0.7,
                "reason": f"Task contains scroll verb; direction={direction}",
            }

        # --- Extract the object noun phrase ---
        object_match = re.search(
            r'(?:click|press|tap|select|open|type|enter|fill|search|'
            r'submit|find|focus|activate)\s+'
            r'(?:the\s+|on\s+|in\s+|into\s+|at\s+)?([a-zA-Z0-9 _\-]{2,50})',
            task_lower, re.IGNORECASE
        )
        target_phrase = object_match.group(1).strip() if object_match else ""

        # Strip filler words
        filler = {
            "the", "a", "an", "button", "field", "input", "link",
            "on", "in", "into", "box", "element",
        }
        target_words = [w for w in target_phrase.split() if w not in filler]
        target_keyword = " ".join(target_words).strip()

        if not target_keyword:
            # Longest meaningful word not in known verb/filler sets
            all_words = [w for w in re.split(r'\W+', task_lower) if len(w) > 3]
            skip = _CLICK_VERBS | _TYPE_VERBS | _SCROLL_VERBS | _SUBMIT_VERBS | filler
            meaningful = [w for w in all_words if w not in skip]
            target_keyword = meaningful[0] if meaningful else (all_words[0] if all_words else "")

        if not target_keyword:
            return {
                "action_type": action_type,
                "target": "",
                "parameters": {},
                "confidence": 0.0,
                "reason": "Could not extract a target keyword from the task description",
            }

        # --- Score page lines to find the best match ---
        action_words = [w for w in re.split(r'\W+', task_lower) if len(w) > 3]
        best_line: Optional[str] = None
        best_score = 0.0

        for line in page_lines:
            line_lower = line.lower()
            if len(line) > 150:
                continue
            matching = sum(1 for w in action_words if w in line_lower)
            if matching == 0:
                continue
            score = matching / max(len(action_words), 1)
            # Boost for button-like lines
            if any(kw in line_lower for kw in _CLICK_KEYWORDS):
                score += 0.25
            # Boost for short labels
            if len(line) < 30:
                score += 0.15
            if score > best_score:
                best_score = score
                best_line = line

        if best_line:
            sel = f"text={best_line}"
            params: Dict[str, Any] = {"selector": sel}
            if action_type == "fill":
                params["text"] = ""
            return {
                "action_type": action_type,
                "target": sel,
                "parameters": params,
                "confidence": min(best_score, 0.9),
                "reason": f"Best page-line match for task keywords (score={best_score:.2f})",
            }

        # --- Direct substring match ---
        if target_keyword in page_lower:
            idx = page_lower.find(target_keyword)
            actual_text = page_text[idx: idx + len(target_keyword)]
            sel = f"text={actual_text}"
            params = {"selector": sel}
            if action_type == "fill":
                params["text"] = ""
            return {
                "action_type": action_type,
                "target": sel,
                "parameters": params,
                "confidence": 0.5,
                "reason": f"Keyword '{target_keyword}' found in page text",
            }

        # --- No match found ---
        sel = f"text={target_keyword}"
        params = {"selector": sel}
        if action_type == "fill":
            params["text"] = ""
        return {
            "action_type": action_type,
            "target": sel,
            "parameters": params,
            "confidence": 0.15,
            "reason": (
                f"Keyword '{target_keyword}' not found on page; "
                "using best-guess selector"
            ),
        }

    # ------------------------------------------------------------------
    # Utility: re-score candidates against a task
    # ------------------------------------------------------------------

    @staticmethod
    def score_candidates(
        candidates: List[Dict[str, Any]],
        task: str,
    ) -> List[Dict[str, Any]]:
        """
        Re-score and sort a list of candidates (from_browser_state output)
        against a task string. Returns list sorted by confidence descending.
        """
        if not task:
            return candidates

        task_lower = task.lower()
        action_words = [w for w in re.findall(r"\b\w+\b", task_lower) if len(w) > 3]

        scored: List[Dict[str, Any]] = []
        for c in candidates:
            label_lower = c.get("text", c.get("label", "")).lower()
            match_count = sum(1 for w in action_words if w in label_lower)
            bonus = match_count * 0.15
            adjusted = min(c.get("confidence", 0.5) + bonus, 1.0)
            scored.append({**c, "confidence": adjusted})

        return sorted(scored, key=lambda x: x["confidence"], reverse=True)
