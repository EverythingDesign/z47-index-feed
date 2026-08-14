#!/usr/bin/env python3
"""StockAnalysis.com live fields for NASDAQ names only (MMYT, FRSH).

Used by Live Prices (z47_index.json) and company hero pages.
Yahoo remains the fallback if StockAnalysis is blocked or incomplete.
"""
from __future__ import annotations

import json
import re
import ssl
import urllib.request

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
CTX = ssl._create_unverified_context()
NASDAQ_TICKERS = frozenset({"MMYT", "FRSH"})
BASE = "https://stockanalysis.com"


def _http_get(url: str, accept: str = "text/html,application/xhtml+xml") -> bytes:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": UA,
            "Accept": accept,
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": f"{BASE}/",
        },
    )
    with urllib.request.urlopen(req, timeout=30, context=CTX) as r:
        return r.read()


def _f(s) -> float | None:
    if s is None or s == "" or s == "n/a":
        return None
    try:
        return float(str(s).replace(",", "").replace("%", "").strip())
    except (TypeError, ValueError):
        return None


def parse_abbrev(s: str | None) -> float | None:
    """5.67B → 5.67e9, 94.06M → 9.406e7."""
    if not s:
        return None
    tok = str(s).strip().split()[0].replace(",", "").upper()
    m = re.match(r"^([+-]?\d+(?:\.\d+)?)([KMBT])?$", tok)
    if not m:
        return None
    n = float(m.group(1))
    mul = {None: 1.0, "K": 1e3, "M": 1e6, "B": 1e9, "T": 1e12}[m.group(2)]
    return n * mul


def usd_inr_rate(fallback: float = 90.0) -> float:
    try:
        import yfinance as yf  # type: ignore

        v = getattr(yf.Ticker("INR=X").fast_info, "last_price", None)
        if v and float(v) > 1:
            return float(v)
    except Exception:
        pass
    return fallback


def fetch_quote(ticker: str) -> dict:
    """Real-time quote JSON: price, daily %, 52w high/low."""
    t = ticker.upper()
    raw = _http_get(
        f"{BASE}/api/quotes/s/{t}",
        accept="application/json",
    )
    payload = json.loads(raw.decode("utf-8", "replace"))
    data = payload.get("data") or {}
    out: dict = {}
    if data.get("p") is not None:
        out["price"] = float(data["p"])
    if data.get("cp") is not None:
        out["daily_pct"] = float(data["cp"])
    if data.get("h52") is not None:
        out["high"] = float(data["h52"])
    if data.get("l52") is not None:
        out["low"] = float(data["l52"])
    return out


def parse_overview_html(html: str) -> dict:
    out: dict = {}
    m = re.search(
        r"font-bold[^>]*>\s*([0-9]+(?:\.[0-9]+)?)\s*</div>"
        r"[\s\S]{0,500}?\(([+-]?\d+(?:\.\d+)?)%\)",
        html,
    )
    if m:
        out["price"] = float(m.group(1))
        out["daily_pct"] = float(m.group(2))

    tds = re.findall(r"<td[^>]*>([\s\S]*?)</td>", html)
    texts: list[str] = []
    for td in tds:
        txt = re.sub(r"<[^>]+>", " ", td)
        txt = re.sub(r"\s+", " ", txt).strip()
        if txt:
            texts.append(txt)
    labels: dict[str, str] = {}
    for i in range(0, len(texts) - 1, 2):
        labels[texts[i]] = texts[i + 1]

    if labels.get("Market Cap"):
        out["mcap_usd"] = parse_abbrev(labels["Market Cap"])
    if labels.get("PE Ratio"):
        out["pe"] = _f(labels["PE Ratio"])
    if labels.get("Shares Out"):
        out["shares_out"] = parse_abbrev(labels["Shares Out"])
    rng = labels.get("52-Week Range") or ""
    hm = re.match(r"([0-9.]+)\s*-\s*([0-9.]+)", rng)
    if hm:
        out["low"] = float(hm.group(1))
        out["high"] = float(hm.group(2))

    about = re.search(
        r"<h2[^>]*>\s*About\s+\w+\s*</h2>\s*<p>([\s\S]*?)</p>",
        html,
        re.I,
    )
    if about:
        out["about"] = re.sub(r"<[^>]+>", "", about.group(1)).strip()
    return out


def fetch_overview(ticker: str) -> dict:
    t = ticker.lower()
    html = _http_get(f"{BASE}/stocks/{t}/").decode("utf-8", "replace")
    return parse_overview_html(html)


def nasdaq_live(ticker: str, usd_to_inr: float | None = None) -> dict:
    """Live snapshot for MMYT/FRSH. Empty dict on total failure."""
    t = ticker.upper()
    if t not in NASDAQ_TICKERS:
        return {}
    out: dict = {}
    try:
        out.update(fetch_overview(t))
    except Exception:
        pass
    if out.get("price") is None or out.get("mcap_usd") is None:
        try:
            q = fetch_quote(t)
            for k, v in q.items():
                if out.get(k) is None and v is not None:
                    out[k] = v
        except Exception:
            pass
    if out.get("mcap_usd") is None and out.get("price") and out.get("shares_out"):
        out["mcap_usd"] = out["price"] * out["shares_out"]

    fx = usd_to_inr if usd_to_inr and usd_to_inr > 1 else None
    if fx and out.get("mcap_usd"):
        out["mcap_mn"] = round(out["mcap_usd"] * fx / 1e6, 1)  # ₹ millions
        out["mcap_cr"] = round(out["mcap_usd"] * fx / 1e7, 1)  # ₹ crores
    if out:
        out["source"] = "NASDAQ (StockAnalysis USD×INR)"
        out["stockanalysis_url"] = f"{BASE}/stocks/{t.lower()}/"
    return out
