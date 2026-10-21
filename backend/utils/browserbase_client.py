"""
Browserbase client: web search, page fetch, and one real-browser session per request.

Used by populator/block_resource_finder.py for block resource discovery.
Never logs the API key, request headers, or the session connect URL (which
embeds a credential).
"""

import logging
import re
import threading
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, List, Optional

import requests
from bs4 import BeautifulSoup

from config import BROWSERBASE_API_KEY

logger = logging.getLogger(__name__)

BB_API = "https://api.browserbase.com/v1"
BLOCKED_MARKERS = ("client challenge", "enable javascript", "access denied",
                   "are you a robot", "just a moment", "verify you are human")


def is_configured() -> bool:
    return bool(BROWSERBASE_API_KEY)


def _headers() -> Dict[str, str]:
    return {"X-BB-API-Key": BROWSERBASE_API_KEY or "", "Content-Type": "application/json"}


def search(query: str, num_results: int = 6, timeout: int = 30) -> List[Dict[str, str]]:
    """Browserbase Search. Returns [{url, title}]; [] on any failure."""
    if not is_configured():
        return []
    try:
        r = requests.post(f"{BB_API}/search", headers=_headers(),
                          json={"query": query, "numResults": num_results}, timeout=timeout)
        r.raise_for_status()
        return [{"url": x["url"], "title": (x.get("title") or "").strip()}
                for x in r.json().get("results", []) if x.get("url")][:num_results]
    except Exception as e:  # never include request headers in the log
        logger.warning("Browserbase search failed (%s) for query %r", type(e).__name__, query[:80])
        return []


def fetch_html(url: str, timeout: int = 25) -> str:
    """Browserbase Fetch (plain HTTP via their proxy). Returns HTML, or '' on failure/non-HTML."""
    if not is_configured():
        return ""
    try:
        r = requests.post(f"{BB_API}/fetch", headers=_headers(), json={"url": url}, timeout=timeout)
        d = r.json()
        if "html" not in (d.get("contentType") or "html").lower():
            return ""
        return d.get("content") or ""
    except Exception as e:
        logger.info("Browserbase fetch failed (%s) for %s", type(e).__name__, url[:100])
        return ""


def html_to_text(html: str, limit: int = 6000) -> str:
    if not html:
        return ""
    soup = BeautifulSoup(html, "html.parser")
    for t in soup(["script", "style", "nav", "footer", "header", "noscript", "aside", "form"]):
        t.decompose()
    main = soup.find("article") or soup.find("main") or soup
    return re.sub(r"\s+", " ", main.get_text(" ")).strip()[:limit]


def looks_blocked(html: str) -> bool:
    """True when a fetched page is empty, thin, or a bot-challenge page."""
    text = html_to_text(html)
    return len(text) < 600 or any(b in text.lower()[:400] for b in BLOCKED_MARKERS)


class BrowserPool:
    """At most ONE real Browserbase browser session for one request (the account
    allows only 3 concurrent sessions). Playwright's sync API is thread-bound, so
    every browser action runs on a single dedicated worker thread. The session is
    created lazily on first use; if it can't be created, render() returns {} and
    callers continue with fetch-only results."""

    def __init__(self, max_pages: int = 6, page_timeout_ms: int = 20000):
        self._exec = ThreadPoolExecutor(max_workers=1, thread_name_prefix="bb-browser")
        self._lock = threading.Lock()
        self._budget = max_pages
        self._page_timeout_ms = page_timeout_ms
        self._pw = None
        self._browser = None
        self._page = None
        self._failed = False

    def _open(self) -> bool:
        if self._failed or not is_configured():
            return False
        if self._page:
            return True
        try:
            from playwright.sync_api import sync_playwright
            proj = requests.get(f"{BB_API}/projects", headers=_headers(), timeout=20).json()[0]["id"]
            r = requests.post(f"{BB_API}/sessions", headers=_headers(), json={"projectId": proj}, timeout=30)
            r.raise_for_status()
            connect_url = r.json()["connectUrl"]  # contains a credential: never log it
            self._pw = sync_playwright().start()
            self._browser = self._pw.chromium.connect_over_cdp(connect_url)
            ctx = self._browser.contexts[0] if self._browser.contexts else self._browser.new_context()
            self._page = ctx.pages[0] if ctx.pages else ctx.new_page()
            logger.info("Browserbase browser session started")
            return True
        except Exception as e:
            self._failed = True
            logger.warning("Browserbase session unavailable (%s); continuing with fetch-only", type(e).__name__)
            self._teardown()
            return False

    def _render(self, urls: List[str]) -> Dict[str, str]:
        out: Dict[str, str] = {}
        if not urls or not self._open():
            return out
        for u in urls:
            if self._budget <= 0:
                break
            self._budget -= 1
            try:
                self._page.goto(u, wait_until="domcontentloaded", timeout=self._page_timeout_ms)
                self._page.wait_for_timeout(1500)
                out[u] = self._page.content()
            except Exception as e:
                logger.info("Browser render failed (%s) for %s", type(e).__name__, u[:100])
        return out

    def render(self, urls: List[str]) -> Dict[str, str]:
        """Render pages in the shared session; returns {url: html} for the ones that worked."""
        try:
            return self._exec.submit(self._render, urls).result()
        except Exception as e:
            logger.warning("Browser render error (%s)", type(e).__name__)
            return {}

    def _teardown(self):
        for fn in (lambda: self._browser and self._browser.close(),
                   lambda: self._pw and self._pw.stop()):
            try:
                fn()
            except Exception:
                pass
        self._browser = self._pw = self._page = None

    def close(self):
        try:
            self._exec.submit(self._teardown).result(timeout=20)
        except Exception:
            pass
        self._exec.shutdown(wait=False)

    def __enter__(self):
        return self

    def __exit__(self, *a):
        self.close()
