#!/usr/bin/env python3
"""
build_company_chart.py — Screener price / PE chart series for company pages.

Writes data/companies/{slug}-chart.json with period slices:
  1M, 6M, 1Y, 3Y, 5Y, 10Y, Max

Each period has: price, dma50, dma200, volume, pe (lists of [date, value]).

NASDAQ (FRSH/MMYT): Yahoo price+volume only; DMA computed; PE omitted.

Run:  python3 scripts/build_company_chart.py
      python3 scripts/build_company_chart.py --only MEDPLUS,SWIGGY
"""
from __future__ import annotations

import argparse
import json
import os
import random
import ssl
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
OUT_DIR = ROOT / "data" / "companies"

CTX = ssl._create_unverified_context()
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)
SCREENER_SESSION = os.environ.get("SCREENER_SESSIONID", "").strip()
IST = ZoneInfo("Asia/Kolkata")

PERIOD_DAYS = {
    "1M": 30,
    "6M": 180,
    "1Y": 365,
    "3Y": 1095,
    "5Y": 1825,
    "10Y": 3652,
    "Max": 10000,
}


def _http_get(url: str) -> bytes:
    headers = {
        "User-Agent": UA,
        "Accept": "application/json,text/html",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.screener.in/",
    }
    if SCREENER_SESSION:
        headers["Cookie"] = f"sessionid={SCREENER_SESSION}"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=45, context=CTX) as r:
        return r.read()


def _f(v):
    if v is None or v == "":
        return None
    try:
        return float(str(v).replace(",", "").replace("%", "").strip())
    except ValueError:
        return None


def fetch_screener_chart(company_id: str, q: str, days: int) -> dict:
    url = (
        f"https://www.screener.in/api/company/{company_id}/chart/"
        f"?q={urllib.parse.quote(q)}&days={days}&consolidated=true"
    )
    return json.loads(_http_get(url).decode("utf-8", "replace"))


def datasets_to_map(payload: dict) -> dict:
    out = {}
    for ds in payload.get("datasets") or []:
        metric = (ds.get("metric") or "").strip()
        key = {
            "Price": "price",
            "DMA50": "dma50",
            "DMA200": "dma200",
            "Volume": "volume",
            "Price to Earning": "pe",
            "EPS": "eps",
        }.get(metric)
        if not key:
            continue
        pts = []
        for row in ds.get("values") or []:
            if not row or len(row) < 2:
                continue
            val = _f(row[1])
            if val is None:
                continue
            pts.append([row[0], val])
        out[key] = pts
    return out


def slice_from(series: dict, days: int) -> dict:
    if days >= 10000:
        return {k: list(v) for k, v in series.items()}
    cutoff = (datetime.now(IST).date() - timedelta(days=days)).isoformat()
    out = {}
    for k, pts in series.items():
        out[k] = [p for p in pts if p[0] >= cutoff]
    return out


def pick_source(daily: dict, long: dict, days: int) -> dict:
    src = daily if days <= 365 else long
    return slice_from(src, days)


def build_periods(daily, long, daily_pe, long_pe) -> dict:
    periods = {}
    for name, days in PERIOD_DAYS.items():
        price_pack = pick_source(daily, long, days)
        pe_pack = pick_source(daily_pe, long_pe, days)
        periods[name] = {
            "price": price_pack.get("price") or [],
            "dma50": price_pack.get("dma50") or [],
            "dma200": price_pack.get("dma200") or [],
            "volume": price_pack.get("volume") or [],
            "pe": pe_pack.get("pe") or [],
        }
    return periods


def yahoo_price_series(ticker: str, exchange: str) -> dict:
    try:
        import yfinance as yf  # type: ignore
    except ImportError:
        return {}
    sym = ticker if exchange == "NASDAQ" else f"{ticker}.NS"
    try:
        hist = yf.Ticker(sym).history(period="max", auto_adjust=True)
    except Exception:
        return {}
    if hist is None or hist.empty:
        return {}
    price, volume, closes = [], [], []
    for idx, row in hist.iterrows():
        d = idx.date().isoformat()
        c = float(row["Close"]) if row["Close"] == row["Close"] else None
        v = float(row["Volume"]) if row["Volume"] == row["Volume"] else None
        if c is None:
            continue
        price.append([d, round(c, 2)])
        closes.append(c)
        volume.append([d, int(v) if v is not None else 0])

    def dma(window: int):
        out = []
        for i, (d, _) in enumerate(price):
            if i + 1 < window:
                continue
            avg = sum(closes[i + 1 - window : i + 1]) / window
            out.append([d, round(avg, 2)])
        return out

    return {
        "price": price,
        "volume": volume,
        "dma50": dma(50),
        "dma200": dma(200),
    }


def load_company_meta() -> list:
    rows = []
    for p in sorted(OUT_DIR.glob("*.json")):
        if p.name.startswith("_") or p.name.endswith("-chart.json"):
            continue
        d = json.loads(p.read_text())
        rows.append(
            {
                "slug": d.get("slug") or p.stem,
                "ticker": d.get("ticker") or p.stem.upper(),
                "exchange": d.get("exchange") or "NSE",
                "screener_id": d.get("screener_id"),
                "name": d.get("name"),
            }
        )
    return rows


def build_one(meta: dict, retries: int = 3) -> dict:
    slug = meta["slug"]
    ticker = meta["ticker"]
    out = {
        "slug": slug,
        "ticker": ticker,
        "exchange": meta["exchange"],
        "name": meta.get("name"),
        "screener_id": meta.get("screener_id"),
    }
    daily, long, daily_pe, long_pe = {}, {}, {}, {}
    cid = str(meta.get("screener_id") or "").strip()
    if cid and meta["exchange"] != "NASDAQ":
        for attempt in range(1, retries + 1):
            try:
                daily = datasets_to_map(
                    fetch_screener_chart(cid, "Price-DMA50-DMA200-Volume", 365)
                )
                long = datasets_to_map(
                    fetch_screener_chart(cid, "Price-DMA50-DMA200-Volume", 10000)
                )
                try:
                    daily_pe = datasets_to_map(
                        fetch_screener_chart(cid, "Price to Earning", 365)
                    )
                except Exception:
                    daily_pe = {}
                try:
                    long_pe = datasets_to_map(
                        fetch_screener_chart(cid, "Price to Earning", 10000)
                    )
                except Exception:
                    long_pe = {}
                if daily.get("price") or long.get("price"):
                    break
            except Exception as e:
                out["error"] = str(e)
                time.sleep(1.2 * attempt + random.random())
    else:
        yb = yahoo_price_series(ticker, meta["exchange"])
        daily = slice_from(yb, 365)
        long = yb
        out["source"] = "yahoo"

    if not out.get("source"):
        out["source"] = "screener"

    out["periods"] = build_periods(daily, long, daily_pe, long_pe)
    now = datetime.now(IST)
    out["generated_at"] = now.isoformat()
    out["generated_at_ist"] = now.strftime("%d %b %Y, %H:%M IST")
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    ap.add_argument("--sleep", type=float, default=0.55)
    args = ap.parse_args()

    only = {t.strip().upper() for t in args.only.split(",") if t.strip()}
    metas = load_company_meta()
    if only:
        metas = [m for m in metas if m["ticker"] in only or m["slug"].upper() in only]

    if not metas:
        print("No company metas found in data/companies — run build_company_hero.py first")
        return 1

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    ok = 0
    for i, m in enumerate(metas, 1):
        row = build_one(m)
        path = OUT_DIR / f"{row['slug']}-chart.json"
        path.write_text(json.dumps(row, ensure_ascii=False) + "\n")
        p1 = len((row.get("periods") or {}).get("1Y", {}).get("price") or [])
        pe = len((row.get("periods") or {}).get("1Y", {}).get("pe") or [])
        status = "ok" if p1 else "empty"
        if p1:
            ok += 1
        print(
            f"[{i}/{len(metas)}] {row['ticker']:12} {status} "
            f"1Y_price={p1} 1Y_pe={pe} src={row.get('source')}"
        )
        time.sleep(args.sleep + random.random() * 0.35)

    print(f"Wrote {len(metas)} chart files → {OUT_DIR} ({ok} with price)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
