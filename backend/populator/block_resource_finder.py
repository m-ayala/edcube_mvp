"""
Block resource discovery (Browserbase).

For ONE lesson block (content, worksheet or activity) find articles, images and
videos that fit what that block teaches or has students do. Replaces the
YouTube / Google Custom Search path for "Links & Resources" generation.

Public entry point: find_block_resources(...)  (synchronous; run it in an executor).

Flow: one LLM call plans the three groups -> Browserbase Search -> Browserbase
Fetch (one real browser session for blocked/thin pages) -> LLM scoring (articles,
videos) and vision verification (images). Every returned link is a real page that
was actually returned by search; nothing is invented. Output is a starting point
for teacher review.

All prompts live in populator/block_resource_prompts.py (see its "where to look" note).
Videos are filtered here: length cap, YouTube age restriction, grade-appropriateness,
language, and relevance.
"""

import base64
import io
import json
import logging
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import parse_qs, urljoin, urlparse

import requests
from bs4 import BeautifulSoup

from config import YOUTUBE_API_KEY
from populator import block_resource_prompts as prompts
from utils import browserbase_client as bb
from utils.llm_handler import call_openai

logger = logging.getLogger(__name__)

MAX_ARTICLES, MAX_IMAGES, MAX_VIDEOS = 4, 6, 3
MAX_IMAGE_SUBJECTS = 3
MIN_TEXT_SCORE = 6          # articles / videos below this are dropped
MIN_IMAGE_SCORE = 7         # vision-verified images below this are dropped
TIME_BUDGET_S = 75          # soft cap: later stages are skipped once exceeded
MAX_VIDEO_MINUTES = 15      # longest video offered; a shorter block lowers the cap to its own length
MIN_VIDEO_MINUTES = 3       # the cap never drops below this, even for very short blocks

UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/126 Safari/537.36"}

# Source preferences (PRD: free content first, source-verified). Matching is by
# hostname suffix / substring; these only rank, they never invent anything.
PAID_OR_MARKETPLACE = ("teacherspayteachers.com", "skillshare.com", "study.com", "coursehero.com",
                       "udemy.com", "chegg.com", "scribd.com", "outschool.com", "masterclass.com",
                       "teacherspayteachers", "etsy.com", "amazon.", "ebay.", "coursera.org")
OPEN_IMAGE_SOURCES = ("wikimedia.org", "wikipedia.org", "commons.", "metmuseum.org", "si.edu",
                      "loc.gov", "britishmuseum.org", "vam.ac.uk", "nga.gov", "artic.edu",
                      "europeana.eu", "rijksmuseum.nl", "clevelandart.org", "getty.edu",
                      "nypl.org", "archive.org", "nasa.gov", "britannica.com", ".museum", ".edu", ".gov")
LOW_IMAGE_SOURCES = ("1stdibs.com", "pinterest.", "etsy.com", "ebay.", "amazon.", "alamy.com",
                     "shutterstock.com", "gettyimages.", "istockphoto.com", "depositphotos.com",
                     "dreamstime.com", "adobe.com", "redbubble.com", "fineartamerica.com",
                     "pixels.com", "walmart.com", "wayfair.com", "123rf.com", "stock.adobe.com",
                     "facebook.com", "instagram.com", "tiktok.com")
VIDEO_HOSTS = ("youtube.com", "youtu.be", "vimeo.com")


# ----------------------------------------------------------------------------
# small helpers
# ----------------------------------------------------------------------------

def _host(url: str) -> str:
    return (urlparse(url).netloc or "").lower().removeprefix("www.")


def _matches(url: str, needles: Tuple[str, ...]) -> bool:
    h = _host(url)
    return any(n in h for n in needles)


_TRACKING = re.compile(r"^(utm_.*|srsltid|xstg|gclid|fbclid|ref|source)$", re.I)


def _clean_url(url: str) -> str:
    """Drop fragments, tracking params and a trailing slash so the same page dedupes."""
    u = urlparse(url)
    q = "&".join(f"{k}={v}" for k, vs in parse_qs(u.query).items() if not _TRACKING.match(k) for v in vs)
    path = u.path.rstrip("/") or "/"
    return f"{u.scheme}://{u.netloc}{path}" + (f"?{q}" if q else "")


def _llm(prompt: str, system: str, temperature: float = 0, images: Optional[List[str]] = None) -> Optional[Dict]:
    """call_openai that never raises."""
    try:
        return call_openai(prompt, system, temperature=temperature, images=images)
    except Exception as e:
        logger.warning("LLM call failed in resource finder (%s)", type(e).__name__)
        return None


def _as_text(block_content: Any, limit: int = 6000) -> str:
    if block_content is None:
        return ""
    if not isinstance(block_content, str):
        try:
            block_content = json.dumps(block_content, ensure_ascii=False)
        except Exception:
            block_content = str(block_content)
    return block_content[:limit]


def _clean_title(title: str, url: str) -> str:
    """The page's own title, minus the ' | Site Name' / ' - Site Name' tail."""
    t = re.sub(r"\s+", " ", (title or "")).strip()
    t = re.sub(r"\s*https?://\S+$", "", t)  # some search titles end with the site URL
    parts = re.split(r"\s[|–—\-·•]\s", t)
    if len(parts) > 1:
        # drop trailing segments that are short (site names) as long as a real title remains
        while len(parts) > 1 and len(parts[-1]) <= 30 and len(" - ".join(parts[:-1])) >= 12:
            parts.pop()
        t = " - ".join(parts)
    if len(t) > 110:
        t = t[:107].rsplit(" ", 1)[0] + "..."
    return t or _host(url)


def _round_robin(buckets: List[List[Dict]], limit: int) -> List[Dict]:
    buckets = [list(b) for b in buckets]
    out, i = [], 0
    while len(out) < limit and any(buckets):
        b = buckets[i % len(buckets)]
        if b:
            out.append(b.pop(0))
        i += 1
    return out


def _search_many(queries: List[str], n: int) -> List[Dict]:
    """Run queries in parallel; return unique results in query order."""
    queries = [q for q in queries if q and q.strip()]
    if not queries:
        return []
    with ThreadPoolExecutor(len(queries)) as ex:
        batches = list(ex.map(lambda q: bb.search(q, n), queries))
    seen, out = set(), []
    for q, batch in zip(queries, batches):
        for r in batch:
            cu = _clean_url(r["url"])
            if cu not in seen:
                seen.add(cu)
                out.append({**r, "url": cu, "query": q})
    return out


def _load_pages(urls: List[str], pool: bb.BrowserPool, allow_browser: bool = True, max_retry: int = 4) -> Dict[str, str]:
    """Fetch HTML for urls in parallel; re-read blocked/thin pages in the shared real browser."""
    if not urls:
        return {}
    with ThreadPoolExecutor(min(8, len(urls))) as ex:
        pages = dict(zip(urls, ex.map(bb.fetch_html, urls)))
    if allow_browser:
        retry = [u for u, h in pages.items() if bb.looks_blocked(h) and not u.lower().endswith(".pdf")]
        if retry:
            for u, h in pool.render(retry[:max_retry]).items():
                if len(h) > len(pages.get(u, "")):
                    pages[u] = h
    return pages


# ----------------------------------------------------------------------------
# 1. Plan
# ----------------------------------------------------------------------------

def _plan(ctx: Dict) -> Optional[Dict]:
    r = _llm(prompts.build_plan_prompt(ctx["block_text"], ctx["block_type"], ctx["grade"], MAX_IMAGE_SUBJECTS),
             prompts.PLAN_SYSTEM, temperature=0.2)
    return r if isinstance(r, dict) else None


# ----------------------------------------------------------------------------
# 2. Articles and videos (text scoring)
# ----------------------------------------------------------------------------

def _judge_text(ctx: Dict, plan: Dict, item: Dict, group: str) -> Dict:
    r = _llm(prompts.build_text_judge_prompt(
                 ctx["block_text"], plan.get("essence", ctx["block_title"]), plan.get("needs", ""), ctx["grade"],
                 group, item["title"], item["url"], item["text"], item.get("video_info"), ctx["block_type"]),
             prompts.TEXT_JUDGE_SYSTEM)
    score = 0
    reason = ""
    appropriate = language_ok = True
    if r:
        try:
            score = int(r.get("score", 0))
        except (TypeError, ValueError):
            score = 0
        reason = str(r.get("reason", ""))[:160]
        if group == "videos":
            # Missing answers count as "no": a video is only offered when it was judged suitable.
            appropriate = r.get("appropriate") is True
            language_ok = r.get("language_ok") is not False
    raw = score
    if _matches(item["url"], PAID_OR_MARKETPLACE):
        score -= 2  # free content first
    return {**item, "score": score, "raw_score": raw, "reason": reason,
            "appropriate": appropriate, "language_ok": language_ok}


def _video_url(url: str) -> Optional[str]:
    """Canonical watch URL for YouTube / Vimeo videos, None for anything else."""
    u = urlparse(url)
    h = _host(url)
    if h in ("youtube.com", "m.youtube.com") and u.path == "/watch":
        v = parse_qs(u.query).get("v", [""])[0]
        return f"https://www.youtube.com/watch?v={v}" if v else None
    if h == "youtu.be" and len(u.path) > 1:
        return f"https://www.youtube.com/watch?v={u.path[1:].split('/')[0]}"
    m = re.search(r"/(\d{5,})", u.path)
    if h in ("vimeo.com", "player.vimeo.com") and m:
        return "https://vimeo.com/" + m.group(1)
    return None


def _video_meta(url: str) -> Optional[Dict[str, Any]]:
    """Title, channel (and length for Vimeo) via the public oEmbed endpoint. None if the
    video does not exist / is private, which also verifies the link is real."""
    ep = ("https://vimeo.com/api/oembed.json" if "vimeo.com" in url else "https://www.youtube.com/oembed")
    try:
        r = requests.get(ep, params={"url": url, "format": "json"}, headers=UA, timeout=10)
        if r.status_code != 200:
            return None
        d = r.json()
        secs = d.get("duration")
        return {"title": (d.get("title") or "").strip(), "author": (d.get("author_name") or "").strip(),
                "minutes": round(secs / 60, 1) if isinstance(secs, (int, float)) else None,
                "age_restricted": False, "description": (d.get("description") or "")[:600], "language": ""}
    except Exception:
        return None


def _iso_minutes(iso: str) -> Optional[float]:
    m = re.fullmatch(r"P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", iso or "")
    if not m:
        return None
    d, h, mi, s = (int(x or 0) for x in m.groups())
    return round(d * 1440 + h * 60 + mi + s / 60, 1)


def _youtube_details(video_ids: List[str]) -> Optional[Dict[str, Dict[str, Any]]]:
    """Length, age restriction, description, language and privacy from the YouTube Data API
    (1 quota unit per call). Returns None if the API is unavailable, so callers can fall back
    to oEmbed; videos missing from the result do not exist or are private."""
    if not YOUTUBE_API_KEY or not video_ids:
        return None
    try:
        r = requests.get("https://www.googleapis.com/youtube/v3/videos",
                         params={"part": "snippet,contentDetails,status", "id": ",".join(video_ids[:50]),
                                 "key": YOUTUBE_API_KEY}, timeout=10)
        if r.status_code != 200:
            logger.warning("YouTube details unavailable (HTTP %s); videos checked without length", r.status_code)
            return None
        out = {}
        for it in r.json().get("items", []):
            sn, cd, st = it.get("snippet", {}), it.get("contentDetails", {}), it.get("status", {})
            out[it["id"]] = {
                "title": (sn.get("title") or "").strip(),
                "author": (sn.get("channelTitle") or "").strip(),
                "minutes": _iso_minutes(cd.get("duration", "")),
                "age_restricted": (cd.get("contentRating") or {}).get("ytRating") == "ytAgeRestricted",
                "public": st.get("privacyStatus") == "public",
                "description": (sn.get("description") or "")[:600],
                "language": sn.get("defaultAudioLanguage") or sn.get("defaultLanguage") or "",
            }
        return out
    except Exception as e:
        logger.warning("YouTube details failed (%s); videos checked without length", type(e).__name__)
        return None


def _video_cap(ctx: Dict) -> float:
    """Longest video to offer: MAX_VIDEO_MINUTES, or the block's own length if shorter."""
    mins = ctx.get("duration_minutes")
    if isinstance(mins, (int, float)) and mins > 0:
        return max(MIN_VIDEO_MINUTES, min(MAX_VIDEO_MINUTES, mins))
    return MAX_VIDEO_MINUTES


def _article_group(ctx: Dict, plan: Dict, pool: bb.BrowserPool, deadline: float) -> List[Dict]:
    queries = []
    for a in (plan.get("articles") or [])[:3]:
        q = a.get("query") if isinstance(a, dict) else str(a)
        if q:
            queries.append(q)
    items = [i for i in _search_many(queries, 6)
             if not _matches(i["url"], VIDEO_HOSTS) and not _matches(i["url"], ("pinterest.",))][:14]
    if not items or time.monotonic() > deadline:
        return []
    pages = _load_pages([i["url"] for i in items], pool)
    for i in items:
        i["text"] = bb.html_to_text(pages.get(i["url"], "")) or i["title"]
    if time.monotonic() > deadline:
        return []
    with ThreadPoolExecutor(8) as ex:
        judged = list(ex.map(lambda i: _judge_text(ctx, plan, i, "articles"), items))
    logger.debug("article scores: %s", [(j["score"], j["raw_score"], j["title"][:40]) for j in judged])
    judged = [j for j in judged if j["score"] >= MIN_TEXT_SCORE]
    judged.sort(key=lambda j: -j["score"])
    # one per site first (variety), then fill remaining slots with a second page from the same site
    picked, rest, hosts = [], [], set()
    for j in judged:
        (rest if _host(j["url"]) in hosts else picked).append(j)
        hosts.add(_host(j["url"]))
    return [{"url": j["url"], "label": _clean_title(j["title"], j["url"]),
             "type": "article", "reason": j["reason"]} for j in (picked + rest)[:MAX_ARTICLES]]


def _video_group(ctx: Dict, plan: Dict, deadline: float) -> List[Dict]:
    base = [q for q in (plan.get("videos") or [])[:2] if isinstance(q, str) and q.strip()]
    queries = [f"{q} youtube video" for q in base] + [f"{q} site:youtube.com" for q in base[:1]]
    seen, items = set(), []
    for r in _search_many(queries, 6):
        canon = _video_url(r["url"])
        if canon and canon not in seen:
            seen.add(canon)
            items.append({**r, "url": canon})
    items = items[:8]
    if not items or time.monotonic() > deadline:
        return []

    # Metadata: YouTube Data API (length, age restriction, description), oEmbed otherwise.
    yt_ids = [parse_qs(urlparse(i["url"]).query).get("v", [""])[0] for i in items if "youtube.com" in i["url"]]
    yt = _youtube_details([v for v in yt_ids if v])
    metas: List[Optional[Dict[str, Any]]] = []
    need_oembed = []
    for idx, i in enumerate(items):
        if "youtube.com" in i["url"] and yt is not None:
            d = yt.get(parse_qs(urlparse(i["url"]).query).get("v", [""])[0])
            metas.append(d if d and d.get("public") else None)
        else:
            metas.append(None)
            need_oembed.append(idx)
    if need_oembed:
        with ThreadPoolExecutor(min(8, len(need_oembed))) as ex:
            for idx, m in zip(need_oembed, ex.map(lambda k: _video_meta(items[k]["url"]), need_oembed)):
                metas[idx] = m

    # Hard filters before any scoring: must exist, not age-restricted, not longer than the cap.
    cap = _video_cap(ctx)
    kept, dropped = [], {"missing": 0, "age_restricted": 0, "too_long": 0}
    for i, m in zip(items, metas):
        if not m:
            dropped["missing"] += 1
        elif m.get("age_restricted"):
            dropped["age_restricted"] += 1
        elif m.get("minutes") is not None and m["minutes"] > cap:
            dropped["too_long"] += 1
        else:
            length = f"{m['minutes']:g} min" if m.get("minutes") is not None else "unknown"
            info = (f"Channel: {m['author']}. Length: {length}. Audio language: {m.get('language') or 'unknown'}. "
                    f"Description: {m.get('description') or '(none)'}")
            kept.append({**i, "title": m["title"] or i["title"], "minutes": m.get("minutes"),
                         "text": f"Video title: {m['title'] or i['title']}.", "video_info": info})
    logger.info("Videos: %d found, %d kept for scoring (cap %g min); dropped %s",
                len(items), len(kept), cap, dropped)
    if not kept:
        return []
    with ThreadPoolExecutor(8) as ex:
        judged = list(ex.map(lambda i: _judge_text(ctx, plan, i, "videos"), kept))
    logger.debug("video scores: %s",
                 [(j["score"], j["appropriate"], j["language_ok"], j["title"][:50]) for j in judged])
    judged = [j for j in judged if j["score"] >= MIN_TEXT_SCORE and j["appropriate"] and j["language_ok"]]
    judged.sort(key=lambda j: -j["score"])
    return [{"url": j["url"], "label": _clean_title(re.sub(r"\s-\sYouTube$", "", j["title"]), j["url"]),
             "type": "video", "reason": j["reason"]} for j in judged[:MAX_VIDEOS]]


# ----------------------------------------------------------------------------
# 3. Images
# ----------------------------------------------------------------------------

SKIP_IMG = re.compile(r"logo|icon|sprite|avatar|badge|banner|placeholder|pixel|\.svg|\.gif|data:|favicon|thumbnail_small", re.I)
DIRECT_IMG = re.compile(r"\.(jpe?g|png|webp)(\?|$)", re.I)


def _image_key(url: str) -> str:
    """Same picture at different sizes (Wikimedia /thumb/.../800px-X.jpg) -> same key."""
    u = url.split("?")[0]
    if "/thumb/" in u:
        u = u.split("/thumb/")[-1].rsplit("/", 1)[0]
    else:
        u = re.sub(r"[-_]\d{2,4}x\d{2,4}(?=\.\w+$)", "", u)
    return u.lower()


def _source_rank(url: str) -> int:
    """0 = open/museum, 1 = neutral, 2 = store / social / stock."""
    if _matches(url, LOW_IMAGE_SOURCES):
        return 2
    if _matches(url, OPEN_IMAGE_SOURCES):
        return 0
    return 1


def _image_candidates(page_url: str, html: str, subject: str, limit: int = 4) -> List[Dict]:
    soup = BeautifulSoup(html, "html.parser")
    words = re.findall(r"[a-z]{4,}", subject.lower())
    cands = []
    for m in soup.select('meta[property="og:image"], meta[name="twitter:image"]'):
        if m.get("content"):
            cands.append((3, urljoin(page_url, m["content"]), ""))
    for img in soup.find_all("img"):
        src = img.get("src") or img.get("data-src") or ""
        if img.get("srcset"):
            src = img["srcset"].split(",")[-1].strip().split(" ")[0]
        if not src or SKIP_IMG.search(src):
            continue
        try:
            if int(re.sub(r"\D", "", str(img.get("width") or "999")) or 999) < 250:
                continue
        except ValueError:
            pass
        alt = ((img.get("alt") or "") + " " + src).lower()
        cands.append((sum(w in alt for w in words), urljoin(page_url, src), img.get("alt") or ""))
    cands.sort(key=lambda c: -c[0])
    seen, out = set(), []
    for _, u, alt in cands:
        if u.startswith("http") and not SKIP_IMG.search(u) and u not in seen:
            seen.add(u)
            out.append({"image_url": u, "alt": alt, "source_page": page_url})
    return out[:limit]


def _ahash(img) -> int:
    px = list(img.convert("L").resize((8, 8)).getdata())
    avg = sum(px) / 64
    return sum(1 << i for i, p in enumerate(px) if p > avg)


def _download(url: str) -> Optional[Tuple[str, int]]:
    """Download, shrink to <=768px, return (jpeg data URL, perceptual hash) or None."""
    try:
        from PIL import Image
        for attempt in range(2):
            r = requests.get(url, headers=UA, timeout=12)
            if r.status_code not in (429, 503):
                break
            time.sleep(1.5)  # polite retry for rate-limited hosts (Wikimedia)
        if r.status_code != 200:
            logger.debug("image download HTTP %s for %s", r.status_code, url[:90])
        ct = r.headers.get("Content-Type", "")
        if r.status_code != 200 or not ct.startswith("image/") or "svg" in ct or not (15_000 < len(r.content) < 8_000_000):
            return None
        img = Image.open(io.BytesIO(r.content))
        if min(img.size) < 200:
            return None
        h = _ahash(img)
        img = img.convert("RGB")
        img.thumbnail((768, 768))
        buf = io.BytesIO()
        img.save(buf, "JPEG", quality=82)
        return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode(), h
    except Exception:
        return None


_DL_SLOTS = threading.BoundedSemaphore(5)


def _judge_image(ctx: Dict, subject: str, c: Dict) -> Dict:
    with _DL_SLOTS:
        dl = _download(c["image_url"])
    if not dl:
        logger.debug("image not usable: %s", c["image_url"][:100])
        return {**c, "score": 0, "caption": ""}
    data, h = dl
    r = _llm(prompts.build_image_judge_prompt(subject, ctx["grade"]), prompts.IMAGE_JUDGE_SYSTEM, images=[data])
    try:
        score = int((r or {}).get("score", 0))
    except (TypeError, ValueError):
        score = 0
    return {**c, "score": score, "caption": str((r or {}).get("caption", ""))[:160], "hash": h}


def _image_subject(ctx: Dict, spec: Dict, pool: bb.BrowserPool, deadline: float,
                   max_candidates: int = 10) -> List[Dict]:
    subject, query = spec["subject"], spec["query"]
    hits = _search_many([query, f"{query} wikimedia commons"], 5)
    if not hits:
        return []
    hits.sort(key=lambda h: _source_rank(h["url"]))  # stable: open sources first
    # a URL ending in .jpg is a picture, unless it is a wiki "File:" description page
    direct = [h for h in hits if DIRECT_IMG.search(h["url"]) and "/wiki/" not in h["url"]]
    # specific pages (e.g. Commons "File:" pages) before category/landing pages
    page_hits = sorted([h for h in hits if h not in direct],
                       key=lambda h: (_source_rank(h["url"]), "/File:" not in h["url"], "Category:" in h["url"]))[:8]
    cands = [{"image_url": h["url"], "alt": h["title"], "source_page": h["url"]} for h in direct]
    pages = _load_pages([h["url"] for h in page_hits], pool, max_retry=2)
    per_page = []
    for h in page_hits:  # already ordered open-sources-first
        if pages.get(h["url"]):
            per_page.append(_image_candidates(h["url"], pages[h["url"]], subject, limit=4))
    cands += _round_robin(per_page, 40)  # interleave pages so one page can't crowd out the rest
    seen, uniq = set(), []
    for c in cands:
        k = _image_key(c["image_url"])
        if k not in seen:
            seen.add(k)
            uniq.append(c)
    uniq = uniq[:max_candidates]
    if not uniq or time.monotonic() > deadline:
        return []
    with ThreadPoolExecutor(8) as ex:
        judged = list(ex.map(lambda c: _judge_image(ctx, subject, c), uniq))
    logger.debug("image scores for %r: %s", subject, [(c["score"], c.get("caption", "")[:40]) for c in judged])
    good = [{**c, "subject": subject, "why": spec.get("why", ""), "rank": _source_rank(c["source_page"])}
            for c in judged if c["score"] >= MIN_IMAGE_SCORE]
    good.sort(key=lambda c: (c["rank"] >= 2, -c["score"], c["rank"]))
    return good


def _image_group(ctx: Dict, plan: Dict, pool: bb.BrowserPool, deadline: float) -> List[Dict]:
    g = prompts.guidance_for(ctx["block_type"])
    max_subjects = int(g.get("max_image_subjects", MAX_IMAGE_SUBJECTS))
    per_subject_cap = int(g.get("images_per_subject", 2))
    specs = [s for s in (plan.get("images") or []) if isinstance(s, dict) and s.get("subject") and s.get("query")]
    specs = specs[:max_subjects]
    if not specs:
        return []
    # Many subjects (e.g. every item on a matching worksheet) -> check fewer candidates each.
    cands_each = 10 if len(specs) <= 3 else 6
    with ThreadPoolExecutor(len(specs)) as ex:
        per_subject = list(ex.map(lambda s: _image_subject(ctx, s, pool, deadline, cands_each), specs))
    # Dedupe across subjects (same file/URL, or visually the same picture), round-robin by subject.
    keys: set = set()
    hashes: List[int] = []
    buckets: List[List[Dict]] = []
    for cands in per_subject:
        kept = []
        for c in cands:
            k = _image_key(c["image_url"])
            if k in keys or any(bin(c.get("hash", 0) ^ h).count("1") <= 5 for h in hashes):
                continue
            keys.add(k)
            hashes.append(c.get("hash", 0))
            kept.append(c)
        buckets.append(kept[:per_subject_cap])  # e.g. 2 each for 3 subjects, 1 each for 6 worksheet items
    chosen = _round_robin(buckets, MAX_IMAGES)
    return [{"url": c["source_page"], "label": c["subject"], "type": "image",
             "imageUrl": c["image_url"], "caption": c["caption"], "reason": c["why"]} for c in chosen]


# ----------------------------------------------------------------------------
# Public API
# ----------------------------------------------------------------------------

def find_block_resources(block_title: str, block_type: str, block_content: Any,
                         topic_title: str = "", topic_description: str = "",
                         subject: str = "", topic: str = "", grade_level: str = "",
                         block_subtype: str = "", block_duration_minutes: Optional[float] = None
                         ) -> Dict[str, List[Dict]]:
    """Find articles, images and videos for one lesson block using Browserbase.

    Synchronous (blocks for up to ~1 minute); call it from an executor. Never
    raises: on any failure returns whatever was found, possibly {"links": []}.

    Returns {"links": [...]} where each link is
      {"url", "label", "type": "article"|"image"|"video", "reason"?}
    Image links also carry "imageUrl" (direct picture) and "caption"; their "url"
    is the page the picture came from. Up to 4 articles, 6 images, 3 videos.
    """
    t0 = time.monotonic()
    try:
        if not bb.is_configured():
            logger.warning("BROWSERBASE_API_KEY not set; no resources found")
            return {"links": []}
        header = [f"TITLE: {block_title}", f"TYPE: {block_type}"]
        for label, val in (("SUBTYPE", block_subtype),
                           ("LENGTH", f"{block_duration_minutes:g} minutes" if block_duration_minutes else ""),
                           ("SUBJECT", subject), ("TOPIC", topic or topic_title),
                           ("TOPIC DESCRIPTION", topic_description)):
            if val:
                header.append(f"{label}: {val}")
        ctx = {"block_title": block_title or "", "block_type": block_type or "",
               "grade": (grade_level or "").strip(),
               "duration_minutes": block_duration_minutes,
               "block_text": "\n".join(header) + "\n" + _as_text(block_content)}
        plan = _plan(ctx)
        if not plan:
            return {"links": []}
        logger.info("Resource plan for %r: %d article queries, %d image subjects, %d video queries",
                    block_title, len(plan.get("articles") or []), len(plan.get("images") or []),
                    len(plan.get("videos") or []))
        deadline = t0 + TIME_BUDGET_S
        results: Dict[str, List[Dict]] = {"articles": [], "images": [], "videos": []}
        with bb.BrowserPool() as pool:
            def run(name, fn):
                try:
                    results[name] = fn()
                except Exception as e:
                    logger.warning("Resource group %s failed (%s)", name, type(e).__name__)
            with ThreadPoolExecutor(3) as ex:
                futs = [ex.submit(run, "articles", lambda: _article_group(ctx, plan, pool, deadline)),
                        ex.submit(run, "images", lambda: _image_group(ctx, plan, pool, deadline)),
                        ex.submit(run, "videos", lambda: _video_group(ctx, plan, deadline))]
                for f in futs:
                    f.result()
        links = results["articles"] + results["images"] + results["videos"]
        logger.info("Resource discovery for %r done in %.0fs: %d articles, %d images, %d videos",
                    block_title, time.monotonic() - t0, len(results["articles"]),
                    len(results["images"]), len(results["videos"]))
        return {"links": links}
    except Exception as e:
        logger.error("Resource discovery failed (%s)", type(e).__name__)
        return {"links": []}
