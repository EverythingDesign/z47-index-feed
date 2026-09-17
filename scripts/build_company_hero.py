#!/usr/bin/env python3
"""
build_company_hero.py — scrape Screener.in hero fields for each Z47 constituent.

Writes data/companies/{slug}.json (+ data/companies/_index.json).

Fields: about, website/BSE/NSE links, mcap_cr, price, high, low, pe, roce, roe,
P&L (completed annual periods since 2020), growth cards, shareholding (quarterly + yearly).

P&L and ratios use the same basis: consolidated when usable, otherwise standalone.
NASDAQ names (MMYT, FRSH) use StockAnalysis.com; Yahoo fills any remaining gaps.

Run:  python3 scripts/build_company_hero.py
      python3 scripts/build_company_hero.py --only SBICARD,TBOTEK
"""
from __future__ import annotations

import argparse
import json
import os
import random
import re
import ssl
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime
from html import unescape
from html.parser import HTMLParser
import calendar
from pathlib import Path
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
OUT_DIR = ROOT / "data" / "companies"

# Keep in sync with build_z47_json.COMPANIES tickers
COMPANIES = [
    {"name": "Eternal (Zomato)", "ticker": "ETERNAL", "exchange": "NSE"},
    {"name": "Groww", "ticker": "GROWW", "exchange": "NSE"},
    {"name": "Swiggy", "ticker": "SWIGGY", "exchange": "NSE"},
    {"name": "Info Edge (Naukri)", "ticker": "NAUKRI", "exchange": "NSE"},
    {"name": "Lenskart", "ticker": "LENSKART", "exchange": "NSE"},
    {"name": "Paytm", "ticker": "PAYTM", "exchange": "NSE"},
    {"name": "Turtlemint", "ticker": "TURTLEMINT", "exchange": "NSE"},
    {"name": "Nykaa", "ticker": "NYKAA", "exchange": "NSE"},
    {"name": "PolicyBazaar", "ticker": "POLICYBZR", "exchange": "NSE"},
    {"name": "Meesho", "ticker": "MEESHO", "exchange": "NSE"},
    {"name": "MakeMyTrip", "ticker": "MMYT", "exchange": "NASDAQ"},
    {"name": "Angel One", "ticker": "ANGELONE", "exchange": "NSE"},
    {"name": "PhysicsWallah", "ticker": "PWL", "exchange": "NSE"},
    {"name": "Delhivery", "ticker": "DELHIVERY", "exchange": "NSE"},
    {"name": "Go Digit Insurance", "ticker": "GODIGIT", "exchange": "NSE"},
    {"name": "Ather Energy", "ticker": "ATHERENERG", "exchange": "NSE"},
    {"name": "Pine Labs", "ticker": "PINELABS", "exchange": "NSE"},
    {"name": "Freshworks", "ticker": "FRSH", "exchange": "NASDAQ"},
    {"name": "Urban Company", "ticker": "URBANCO", "exchange": "NSE"},
    {"name": "TBO Tek", "ticker": "TBOTEK", "exchange": "NSE"},
    {"name": "FirstCry", "ticker": "FIRSTCRY", "exchange": "NSE"},
    {"name": "Aptus Value Housing", "ticker": "APTUS", "exchange": "NSE"},
    {"name": "Ola Electric", "ticker": "OLAELEC", "exchange": "NSE"},
    {"name": "IndiaMart", "ticker": "INDIAMART", "exchange": "NSE"},
    {"name": "Five-Star Business Finance", "ticker": "FIVESTAR", "exchange": "NSE"},
    {"name": "CarTrade", "ticker": "CARTRADE", "exchange": "NSE"},
    {"name": "Affle (Affle 3i)", "ticker": "AFFLE", "exchange": "NSE"},
    {"name": "BlackBuck", "ticker": "BLACKBUCK", "exchange": "NSE"},
    {"name": "Nazara Technologies", "ticker": "NAZARA", "exchange": "NSE"},
    {"name": "MedPlus Health", "ticker": "MEDPLUS", "exchange": "NSE"},
    {"name": "Ixigo", "ticker": "IXIGO", "exchange": "NSE"},
    {"name": "Honasa (Mamaearth)", "ticker": "HONASA", "exchange": "NSE"},
    {"name": "Amagi Media Labs", "ticker": "AMAGI", "exchange": "NSE"},
    {"name": "Awfis Space Solutions", "ticker": "AWFIS", "exchange": "NSE"},
    {"name": "RateGain", "ticker": "RATEGAIN", "exchange": "NSE"},
    {"name": "MapmyIndia", "ticker": "MAPMYINDIA", "exchange": "NSE"},
    {"name": "BlueStone", "ticker": "BLUESTONE", "exchange": "NSE"},
    {"name": "Shadowfax", "ticker": "SHADOWFAX", "exchange": "NSE"},
    {"name": "Wakefit", "ticker": "WAKEFIT", "exchange": "NSE"},
    {"name": "Aye Finance", "ticker": "AYE", "exchange": "NSE"},
    {"name": "E2E Networks", "ticker": "E2E", "exchange": "NSE"},
    {"name": "Capillary Technologies", "ticker": "CAPILLARY", "exchange": "NSE"},
    {"name": "Medi Assist", "ticker": "MEDIASSIST", "exchange": "NSE"},
    {"name": "Kissht (OnEMI Technology)", "ticker": "KISSHT", "exchange": "NSE"},
    {"name": "Fractal Analytics", "ticker": "FRACTAL", "exchange": "NSE"},
    {"name": "Shiprocket", "ticker": "SHIPROCKET", "exchange": "NSE"},
    {"name": "Milky Mist", "ticker": "MILKYMIST", "exchange": "NSE"},
]

CTX = ssl._create_unverified_context()
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)
SCREENER_SESSION = os.environ.get("SCREENER_SESSIONID", "").strip()
IST = ZoneInfo("Asia/Kolkata")


def slugify(ticker: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", ticker.lower()).strip("-")


def _http_get(url: str) -> str:
    headers = {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.screener.in/",
    }
    if SCREENER_SESSION:
        headers["Cookie"] = f"sessionid={SCREENER_SESSION}"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=30, context=CTX) as r:
        return r.read().decode("utf-8", errors="ignore")


def _f(s: str | None) -> float | None:
    if s is None or s == "":
        return None
    try:
        return float(str(s).replace(",", "").replace("%", "").strip())
    except ValueError:
        return None


def parse_screener_hero(html: str) -> dict:
    out: dict = {}
    block = re.search(r'id="top-ratios"[^>]*>([\s\S]*?)</ul>', html)
    ratios: dict[str, list[str]] = {}
    if block:
        for li in re.findall(r"<li[^>]*>([\s\S]*?)</li>", block.group(1)):
            name_m = re.search(r'class="name">\s*([^<]+?)\s*<', li)
            nums = [
                x.replace(",", "").strip()
                for x in re.findall(r'class="number">\s*([^<]*?)\s*<', li)
                if x.strip()
            ]
            if name_m:
                ratios[name_m.group(1).strip()] = nums

    def first(key: str) -> float | None:
        vals = ratios.get(key) or []
        return _f(vals[0]) if vals else None

    out["mcap_cr"] = first("Market Cap")
    out["price"] = first("Current Price")
    hl = ratios.get("High / Low") or []
    out["high"] = _f(hl[0]) if len(hl) > 0 else None
    out["low"] = _f(hl[1]) if len(hl) > 1 else None
    out["pe"] = first("Stock P/E")
    out["roce"] = first("ROCE")
    out["roe"] = first("ROE")

    about_m = re.search(
        r'<div class="sub show-more-box about[^"]*"[^>]*>\s*<p>([\s\S]*?)</p>',
        html,
    )
    if about_m:
        out["about"] = re.sub(r"<[^>]+>", "", about_m.group(1)).strip()

    class WebsiteParser(HTMLParser):
        def __init__(self):
            super().__init__()
            self.href = None
            self.website = None

        def handle_starttag(self, tag, attrs):
            attrs = dict(attrs)
            if tag == "a":
                self.href = attrs.get("href")
            if tag == "i" and "icon-link" in attrs.get("class", "").split():
                if self.href and urllib.parse.urlparse(self.href).scheme in {"http", "https"}:
                    self.website = self.href

        def handle_endtag(self, tag):
            if tag == "a":
                self.href = None

    links = WebsiteParser()
    links.feed(html)
    if links.website:
        out["website"] = unescape(links.website)
        out["website_label"] = urllib.parse.urlparse(out["website"]).netloc.removeprefix("www.")

    bse_m = re.search(r"BSE:\s*(\d+)", html)
    bse_href = re.search(r'href="(https://www\.bseindia\.com/[^"]+)"', html)
    if bse_m:
        out["bse_code"] = bse_m.group(1)
    if bse_href:
        out["bse_url"] = bse_href.group(1)

    nse_m = re.search(r"NSE:\s*([A-Z0-9]+)", html)
    nse_href = re.search(r'href="(https://www\.nseindia\.com/[^"]+)"', html)
    if nse_m:
        out["nse_symbol"] = nse_m.group(1)
    if nse_href:
        out["nse_url"] = nse_href.group(1)

    cid = re.search(r'data-company-id="(\d+)"', html)
    if cid:
        out["screener_id"] = cid.group(1)

    out["ratios_ok"] = sum(
        1
        for k in ("mcap_cr", "price", "pe", "roce", "roe", "high")
        if out.get(k) is not None
    )
    return out


def parse_screener_daily_pct(html: str) -> float | None:
    """Day change % from Screener header (up/down pill near price)."""
    m = re.search(
        r"font-size-18[^>]*>.*?font-size-12\s+(up|down)[^>]*>.*?([\d.]+)%",
        html,
        re.S | re.I,
    )
    if not m:
        return None
    try:
        pct = float(m.group(2))
        return -pct if m.group(1).lower() == "down" else pct
    except ValueError:
        return None


PL_YEAR_FROM = 2020



def parse_screener_pl(html: str) -> dict | None:
    """Completed annual periods since 2020; preserve the source fiscal month, exclude TTM."""
    sec = re.search(
        r'id="profit-loss"[\s\S]*?(?=<section|id="balancesheet"|id="cash-flow"|id="ratios"|$)',
        html,
        re.I,
    )
    if not sec:
        return None
    table = re.search(r"<table[\s\S]*?</table>", sec.group(0))
    if not table:
        return None
    rows = re.findall(r"<tr[^>]*>([\s\S]*?)</tr>", table.group(0))
    if not rows:
        return None

    def cells(tr: str) -> list[str]:
        return [
            re.sub(
                r"\s+",
                " ",
                re.sub(r"<[^>]+>", "", c)
                .replace("\xa0", " ")
                .replace("&nbsp;", " ")
                .strip(),
            )
            for c in re.findall(r"<t[dh][^>]*>([\s\S]*?)</t[dh]>", tr)
        ]

    header = cells(rows[0])
    periods_all = header[1:]
    idxs: list[int] = []
    periods: list[str] = []
    for i, p in enumerate(periods_all):
        try:
            period_date = datetime.strptime(p, "%b %Y").date()
        except ValueError:
            continue
        period_end = period_date.replace(day=calendar.monthrange(period_date.year, period_date.month)[1])
        if period_date.year >= PL_YEAR_FROM and period_end <= datetime.now(IST).date():
            idxs.append(i)
            periods.append(p)
    if not periods:
        return None

    out_rows = []
    for tr in rows[1:]:
        cs = cells(tr)
        if not cs or not cs[0]:
            continue
        label = cs[0].replace("+", "").strip()
        if not label:
            continue
        vals = cs[1:]
        selected = [vals[i] if i < len(vals) else "" for i in idxs]
        key = re.sub(r"[^a-z0-9]+", "_", label.lower()).strip("_")
        out_rows.append({"key": key, "label": label, "values": selected})

    if not out_rows:
        return None
    return {
        "unit": "Rs. Crores",
        "consolidated": True,
        "periods": periods,
        "rows": out_rows,
    }


GROWTH_TITLES = {
    "Compounded Sales Growth": "sales",
    "Compounded Profit Growth": "profit",
    "Stock Price CAGR": "stock",
    "Return on Equity": "roe",
}

GROWTH_PERIOD_KEYS = {
    "10 Years": "10y",
    "5 Years": "5y",
    "3 Years": "3y",
    "TTM": "ttm",
    "1 Year": "1y",
    "Last Year": "last",
}


def parse_screener_growth(html: str) -> dict | None:
    """Four Screener ranges-table cards (sales / profit / stock / ROE)."""
    cards: list[dict] = []
    for m in re.finditer(
        r'<table[^>]*class="[^"]*ranges-table[^"]*"[^>]*>([\s\S]*?)</table>',
        html,
        re.I,
    ):
        block = m.group(1)
        th = re.search(r"<th[^>]*>([\s\S]*?)</th>", block)
        if not th:
            continue
        title = re.sub(r"<[^>]+>", "", th.group(1)).strip()
        key = GROWTH_TITLES.get(title)
        if not key:
            continue
        rows: list[dict] = []
        for tr in re.findall(r"<tr[^>]*>([\s\S]*?)</tr>", block)[1:]:
            cells = [
                re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", c)).strip()
                for c in re.findall(r"<t[dh][^>]*>([\s\S]*?)</t[dh]>", tr)
            ]
            if len(cells) < 2:
                continue
            label = cells[0].rstrip(":").strip()
            period = GROWTH_PERIOD_KEYS.get(label)
            if not period:
                continue
            raw = cells[1].strip()
            # Screener uses bare "%" when unavailable
            if raw in ("", "%"):
                val = None
            else:
                val = _f(raw)
            rows.append(
                {
                    "key": period,
                    "label": label + ":",
                    "value": val,
                }
            )
        if rows:
            cards.append({"key": key, "title": title, "rows": rows})

    if not cards:
        return None
    return {"cards": cards}


def _clean_cell(s: str) -> str:
    return (
        re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", s))
        .replace("\xa0", " ")
        .replace("&nbsp;", " ")
        .strip()
    )


def _parse_shp_table(table_html: str) -> dict | None:
    rows = re.findall(r"<tr[^>]*>([\s\S]*?)</tr>", table_html)
    if not rows:
        return None

    def cells(tr: str) -> list[str]:
        return [_clean_cell(c) for c in re.findall(r"<t[dh][^>]*>([\s\S]*?)</t[dh]>", tr)]

    header = cells(rows[0])
    periods = [p for p in header[1:] if p]
    if not periods:
        return None

    out_rows = []
    for tr in rows[1:]:
        cs = cells(tr)
        if not cs or not cs[0]:
            continue
        label = cs[0].replace("+", "").strip()
        if not label:
            continue
        key = re.sub(r"[^a-z0-9]+", "_", label.lower()).strip("_")
        out_rows.append({"key": key, "label": label, "values": cs[1 : 1 + len(periods)]})

    if not out_rows:
        return None
    return {"periods": periods, "rows": out_rows}


def parse_screener_shareholding(html: str) -> dict | None:
    """Top-level quarterly + yearly shareholding (no nested expanders)."""
    out: dict = {}
    for kind in ("quarterly", "yearly"):
        # Must use <div id=… — Screener buttons reuse data-tab-id="…-shp"
        m = re.search(rf'<div\s+id="{kind}-shp"[^>]*>', html, re.I)
        if not m:
            continue
        chunk = html[m.end() : m.end() + 12000]
        table = re.search(r"<table[\s\S]*?</table>", chunk)
        if not table:
            continue
        parsed = _parse_shp_table(table.group(0))
        if parsed:
            out[kind] = parsed
    return out or None


def yahoo_fallback(ticker: str, exchange: str) -> dict:
    """PE / 52w high-low / about / website when Screener is thin."""
    out: dict = {}
    try:
        import yfinance as yf  # type: ignore
    except ImportError:
        return out
    sym = ticker if exchange == "NASDAQ" else f"{ticker}.NS"
    try:
        info = yf.Ticker(sym).info or {}
    except Exception:
        return out
    out["pe"] = info.get("trailingPE")
    out["high"] = info.get("fiftyTwoWeekHigh")
    out["low"] = info.get("fiftyTwoWeekLow")
    out["price"] = info.get("currentPrice") or info.get("regularMarketPrice")
    if info.get("website"):
        out["website"] = info["website"]
        host = urllib.parse.urlparse(info["website"]).netloc.replace("www.", "")
        out["website_label"] = host
    if info.get("longBusinessSummary"):
        out["about"] = info["longBusinessSummary"]
    mcap = info.get("marketCap")
    if isinstance(mcap, (int, float)):
        if exchange == "NASDAQ":
            try:
                from stockanalysis_nasdaq import usd_inr_rate

                out["mcap_cr"] = round(float(mcap) * usd_inr_rate() / 1e7, 1)
            except Exception:
                pass
        else:
            out["mcap_cr"] = round(mcap / 1e7, 1)  # INR → Cr
    out["source_yahoo"] = True
    return out


def scrape_nasdaq_hero(c: dict, row: dict) -> dict:
    """MMYT/FRSH: StockAnalysis live + Yahoo gap-fill. No Screener 404s."""
    ticker = c["ticker"]
    sa_url = f"https://stockanalysis.com/stocks/{ticker.lower()}/"
    # Financial statements are unavailable from these quote providers.
    row.update({"pl": None, "growth": None, "shareholding": None})
    row["screener_url"] = sa_url
    row["stockanalysis_url"] = sa_url
    try:
        from stockanalysis_nasdaq import nasdaq_live, usd_inr_rate

        sa = nasdaq_live(ticker, usd_to_inr=usd_inr_rate())
    except Exception:
        sa = {}
    for k in ("price", "daily_pct", "pe", "high", "low", "mcap_cr", "mcap_usd"):
        if sa.get(k) is not None:
            row[k] = sa[k]
    if sa.get("stockanalysis_url"):
        row["stockanalysis_url"] = sa["stockanalysis_url"]
    yb = yahoo_fallback(ticker, "NASDAQ")
    for k, v in yb.items():
        if k == "source_yahoo":
            continue
        if row.get(k) is None and v is not None:
            row[k] = v
    if row.get("about") is None and sa.get("about"):
        row["about"] = re.sub(r"\s*\[\s*Read more\s*\]\s*$", "", sa["about"], flags=re.I).strip()
    row["ratios_ok"] = sum(
        1 for k in ("mcap_cr", "price", "pe", "high") if row.get(k) is not None
    )
    row["screener_consolidated"] = False
    now = datetime.now(IST)
    row["generated_at"] = now.isoformat()
    row["generated_at_ist"] = now.strftime("%d %b %Y, %H:%M IST")
    row["source"] = "stockanalysis" if sa.get("price") is not None else "screener+yahoo"
    return row


def select_financials(standalone_html: str, consolidated_html: str, ticker: str) -> dict:
    """Choose usable consolidated statements, otherwise standalone, as one coherent set."""
    pl = parse_screener_pl(consolidated_html)
    consolidated = bool(pl and pl.get("rows"))
    selected = consolidated_html if consolidated else standalone_html
    if not consolidated:
        pl = parse_screener_pl(standalone_html)
    basis = "consolidated" if consolidated else "standalone"
    source = f"https://www.screener.in/company/{urllib.parse.quote(ticker)}/" + ("consolidated/" if consolidated else "")
    hero = parse_screener_hero(selected)
    out = {k: hero.get(k) for k in ("pe", "roce", "roe")}
    out.update(screener_consolidated=consolidated, financial_basis=basis,
               financial_source_url=source, ratios_source_url=source)
    if pl:
        pl.update(consolidated=consolidated, source_url=source)
    out["pl"] = pl
    out["growth"] = parse_screener_growth(selected)
    out["shareholding"] = parse_screener_shareholding(selected)
    return out


def scrape_company(c: dict, retries: int = 3) -> dict:
    ticker = c["ticker"]
    slug = slugify(ticker)
    # Callers: CLI + .github/workflows/refresh-z47-feed.yml; writes data/companies/{slug}.json
    row = {
        "slug": slug,
        "ticker": ticker,
        "name": c["name"],
        "exchange": c["exchange"],
        "screener_url": f"https://www.screener.in/company/{ticker}/",
    }
    if c["exchange"] == "NASDAQ":
        return scrape_nasdaq_hero(c, row)
    parsed: dict = {}
    html = ""

    # Hero ratios from standalone (Screener default). Consolidated differs
    # (e.g. MILKYMIST PE 324 vs 113) and caused client-visible drift.
    for attempt in range(1, retries + 1):
        try:
            html = _http_get(
                f"https://www.screener.in/company/{urllib.parse.quote(ticker)}/"
            )
            parsed = parse_screener_hero(html)
            if parsed.get("ratios_ok", 0) >= 4 or parsed.get("about"):
                break
        except Exception as e:
            parsed = {"error": str(e)}
            html = ""
        time.sleep(1.0 * attempt + random.random())

    row.update({k: v for k, v in parsed.items() if k != "ratios_ok"})
    row["ratios_ok"] = parsed.get("ratios_ok", 0)
    if html:
        dp = parse_screener_daily_pct(html)
        if dp is not None:
            row["daily_pct"] = dp
    row["screener_consolidated"] = False

    consolidated_html = ""
    for attempt in range(1, retries + 1):
        try:
            consolidated_html = _http_get(
                f"https://www.screener.in/company/{urllib.parse.quote(ticker)}/consolidated/"
            )
            break
        except Exception:
            if attempt < retries:
                time.sleep(2 * attempt + random.random())
    row.update(select_financials(html, consolidated_html, ticker))

    # Manual overrides (Screener sometimes has google.co.in; Girish PE blanks)
    WEBSITE_OVERRIDES = {
        "SHIPROCKET": ("https://www.shiprocket.in/", "shiprocket.in"),
        "MILKYMIST": ("https://www.milkymist.com/", "milkymist.com"),
    }
    if ticker in WEBSITE_OVERRIDES:
        row["website"], row["website_label"] = WEBSITE_OVERRIDES[ticker]
    if ticker in {"SHIPROCKET", "TURTLEMINT"}:
        row["pe"] = None
        row["pe_blank"] = True
    if ticker == "SHIPROCKET":
        row["hide_about"] = True
        row.pop("about", None)

    now = datetime.now(IST)
    row["generated_at"] = now.isoformat()
    row["generated_at_ist"] = now.strftime("%d %b %Y, %H:%M IST")
    row["source"] = "screener"
    return row


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="", help="Comma-separated tickers")
    ap.add_argument("--sleep", type=float, default=0.8)
    args = ap.parse_args()

    only = {t.strip().upper() for t in args.only.split(",") if t.strip()}
    companies = [c for c in COMPANIES if not only or c["ticker"] in only]

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    index = []
    ok = 0
    for i, c in enumerate(companies, 1):
        row = scrape_company(c)
        path = OUT_DIR / f"{row['slug']}.json"
        path.write_text(json.dumps(row, indent=2, ensure_ascii=False) + "\n")
        index.append(
            {
                "slug": row["slug"],
                "ticker": row["ticker"],
                "name": row["name"],
                "ratios_ok": row.get("ratios_ok", 0),
                "source": row.get("source"),
            }
        )
        status = "ok" if row.get("ratios_ok", 0) >= 4 else "thin"
        if status == "ok":
            ok += 1
        pl_n = len((row.get("pl") or {}).get("rows") or [])
        g_n = len((row.get("growth") or {}).get("cards") or [])
        sh = row.get("shareholding") or {}
        sh_n = len((sh.get("quarterly") or {}).get("periods") or [])
        print(
            f"[{i}/{len(companies)}] {row['ticker']:12} {status} "
            f"pe={row.get('pe')} roce={row.get('roce')} roe={row.get('roe')} "
            f"hl={row.get('high')}/{row.get('low')} pl_rows={pl_n} growth={g_n} shp_q={sh_n}"
        )
        time.sleep(args.sleep + random.random() * 0.4)

    (OUT_DIR / "_index.json").write_text(
        json.dumps(
            {
                "generated_at_ist": datetime.now(IST).strftime("%d %b %Y, %H:%M IST"),
                "count": len(index),
                "ok": ok,
                "companies": index,
            },
            indent=2,
        )
        + "\n"
    )
    print(f"Wrote {len(index)} files → {OUT_DIR} ({ok} with full ratios)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
