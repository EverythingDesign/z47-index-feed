#!/usr/bin/env python3
"""
build_z47_json.py — Z47'47 index feed builder.

Produces z47_index.json: the single data file the FortySeven landing page reads.
Pure standard library — NO yfinance / pandas — so the GitHub Action that runs this
on a schedule needs zero dependencies and won't break on Python version bumps.

DATA SOURCE OF TRUTH: github.com/GirishZ47/z47-dashboard (companies.py,
calc_index_extension.py, constituent_events.json, z47_history.csv). The constants
below are mirrored from that repo as of the **16 Jun 2026 rebalance**. Re-sync them
whenever the repo changes (especially after a constituent rebalance).

Methodology (mirrors calc_index_extension.py, the authoritative model):
  - index_value(t) = ( Σ price_i(t) × free_float_shares_i ) / DIVISOR
  - DIVISOR derived from a fixed ANCHOR (last published value) so the live series
    stays continuous with z47_history.csv.
  - z47_mcap uses total shares instead of free-float shares.
  - Benchmark = NIFTY 500 (^CRSLDX), rebased to 100 on 2024-01-02 (base 19418.40).
  - Prices from Yahoo Finance public v8 chart endpoint.

KNOWN METHODOLOGY ITEM (replicated faithfully so the public number matches Z47's
dashboard — not silently "fixed"):
  - MMYT & FRSH are priced in USD but summed as if INR (no FX conversion).
Any constituent change requires re-deriving the divisor — update ANCHOR_* below
to the last good point under the new basket, and re-sync COMPANIES / SHARE_DATA.

Run:  python3 build_z47_json.py            # writes z47_index.json
      python3 build_z47_json.py --write-history   # also upserts today's row into z47_history.csv
"""
from __future__ import annotations

import csv
import json
import os
import random
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone, time as _time

HERE        = os.path.dirname(os.path.abspath(__file__))
HIST_CSV    = os.path.join(HERE, "z47_history.csv")
EVENTS_JSON = os.path.join(HERE, "constituent_events.json")
OUT_JSON    = os.path.join(HERE, "z47_index.json")

IST = timezone(timedelta(hours=5, minutes=30))

# ── Methodology constants (NIFTY 500 benchmark) ─────────────────────────────
N500_BASE = 19418.40            # ^CRSLDX on 2024-01-02 (index = 100)
N500_YF   = "^CRSLDX"
BASE_DATE = "2024-01-02"        # rebase date (z47 = 100)

# Divisor anchor — last authoritative point from the repo's z47_history.csv
# (post-16-Jun-2026 rebalance, 47-name basket). z47_float == z47_mcap there.
ANCHOR_DATE      = "2026-06-16"
ANCHOR_Z47_FLOAT = 119.996558
ANCHOR_Z47_MCAP  = 119.996558

# ── Constituents (mirrored from repo companies.py, 16 Jun 2026 rebalance) ───
# Counts: Consumer 19 | Fintech 13 | SaaS/AI 9 | B2B 6 = 47
COMPANIES = [
    {"num":1,  "name":"Eternal (Zomato)",            "ticker":"ETERNAL",    "exchange":"NSE",    "sector":"Consumer / Consumer Tech",    "float_pct":74.43},
    {"num":2,  "name":"Groww",                        "ticker":"GROWW",      "exchange":"NSE",    "sector":"Fintech / Financial Services","float_pct":9.71},
    {"num":3,  "name":"Swiggy",                       "ticker":"SWIGGY",     "exchange":"NSE",    "sector":"Consumer / Consumer Tech",    "float_pct":49.57},
    {"num":4,  "name":"Info Edge (Naukri)",           "ticker":"NAUKRI",     "exchange":"NSE",    "sector":"Consumer / Consumer Tech",    "float_pct":58.77},
    {"num":5,  "name":"Lenskart",                     "ticker":"LENSKART",   "exchange":"NSE",    "sector":"Consumer / Consumer Tech",    "float_pct":16.81},
    {"num":6,  "name":"Paytm",                        "ticker":"PAYTM",      "exchange":"NSE",    "sector":"Fintech / Financial Services","float_pct":65.52},
    {"num":7,  "name":"SBI Cards",                    "ticker":"SBICARD",    "exchange":"NSE",    "sector":"Fintech / Financial Services","float_pct":31.42},
    {"num":8,  "name":"Nykaa",                        "ticker":"NYKAA",      "exchange":"NSE",    "sector":"Consumer / Consumer Tech",    "float_pct":47.63},
    {"num":9,  "name":"PolicyBazaar",                 "ticker":"POLICYBZR",  "exchange":"NSE",    "sector":"Fintech / Financial Services","float_pct":73.43},
    {"num":10, "name":"Meesho",                       "ticker":"MEESHO",     "exchange":"NSE",    "sector":"Consumer / Consumer Tech",    "float_pct":6.22},
    {"num":11, "name":"MakeMyTrip",                   "ticker":"MMYT",       "exchange":"NASDAQ", "sector":"Consumer / Consumer Tech",    "float_pct":25.74},
    {"num":12, "name":"Angel One",                    "ticker":"ANGELONE",   "exchange":"NSE",    "sector":"Fintech / Financial Services","float_pct":53.55},
    {"num":13, "name":"PhysicsWallah",                "ticker":"PWL",        "exchange":"NSE",    "sector":"Consumer / Consumer Tech",    "float_pct":16.12},
    {"num":14, "name":"Delhivery",                    "ticker":"DELHIVERY",  "exchange":"NSE",    "sector":"B2B",                         "float_pct":74.39},
    {"num":15, "name":"Go Digit Insurance",           "ticker":"GODIGIT",    "exchange":"NSE",    "sector":"Fintech / Financial Services","float_pct":25.96},
    {"num":16, "name":"Ather Energy",                 "ticker":"ATHERENERG", "exchange":"NSE",    "sector":"Consumer / Consumer Tech",    "float_pct":49.83},
    {"num":17, "name":"Pine Labs",                    "ticker":"PINELABS",   "exchange":"NSE",    "sector":"Fintech / Financial Services","float_pct":15.37},
    {"num":18, "name":"Freshworks",                   "ticker":"FRSH",       "exchange":"NASDAQ", "sector":"SaaS / AI",                   "float_pct":79.18},
    {"num":19, "name":"Urban Company",                "ticker":"URBANCO",    "exchange":"NSE",    "sector":"Consumer / Consumer Tech",    "float_pct":21.81},
    {"num":20, "name":"TBO Tek",                      "ticker":"TBOTEK",     "exchange":"NSE",    "sector":"B2B",                         "float_pct":31.36},
    {"num":21, "name":"FirstCry",                     "ticker":"FIRSTCRY",   "exchange":"NSE",    "sector":"Consumer / Consumer Tech",    "float_pct":42.29},
    {"num":22, "name":"Aptus Value Housing",          "ticker":"APTUS",      "exchange":"NSE",    "sector":"Fintech / Financial Services","float_pct":70.54},
    {"num":23, "name":"Ola Electric",                 "ticker":"OLAELEC",    "exchange":"NSE",    "sector":"Consumer / Consumer Tech",    "float_pct":45.42},
    {"num":24, "name":"IndiaMart",                    "ticker":"INDIAMART",  "exchange":"NSE",    "sector":"B2B",                         "float_pct":50.77},
    {"num":25, "name":"Five-Star Business Finance",   "ticker":"FIVESTAR",   "exchange":"NSE",    "sector":"Fintech / Financial Services","float_pct":65.56},
    {"num":26, "name":"CarTrade",                     "ticker":"CARTRADE",   "exchange":"NSE",    "sector":"Consumer / Consumer Tech",    "float_pct":87.96},
    {"num":27, "name":"Affle (Affle 3i)",             "ticker":"AFFLE",      "exchange":"NSE",    "sector":"SaaS / AI",                   "float_pct":43.69},
    {"num":28, "name":"BlackBuck",                    "ticker":"BLACKBUCK",  "exchange":"NSE",    "sector":"B2B",                         "float_pct":57.32},
    {"num":29, "name":"Nazara Technologies",          "ticker":"NAZARA",     "exchange":"NSE",    "sector":"Consumer / Consumer Tech",    "float_pct":61.16},
    {"num":30, "name":"MedPlus Health",               "ticker":"MEDPLUS",    "exchange":"NSE",    "sector":"Consumer / Consumer Tech",    "float_pct":59.66},
    {"num":31, "name":"Ixigo",                        "ticker":"IXIGO",      "exchange":"NSE",    "sector":"Consumer / Consumer Tech",    "float_pct":48.82},
    {"num":32, "name":"Honasa (Mamaearth)",           "ticker":"HONASA",     "exchange":"NSE",    "sector":"Consumer / Consumer Tech",    "float_pct":41.66},
    {"num":33, "name":"Amagi Media Labs",             "ticker":"AMAGI",      "exchange":"NSE",    "sector":"SaaS / AI",                   "float_pct":20.99},
    {"num":34, "name":"Awfis Space Solutions",        "ticker":"AWFIS",      "exchange":"NSE",    "sector":"B2B",                         "float_pct":41.80},
    {"num":35, "name":"RateGain",                     "ticker":"RATEGAIN",   "exchange":"NSE",    "sector":"SaaS / AI",                   "float_pct":51.41},
    {"num":36, "name":"MapmyIndia",                   "ticker":"MAPMYINDIA", "exchange":"NSE",    "sector":"SaaS / AI",                   "float_pct":31.56},
    {"num":37, "name":"BlueStone",                    "ticker":"BLUESTONE",  "exchange":"NSE",    "sector":"Consumer / Consumer Tech",    "float_pct":36.14},
    {"num":38, "name":"Shadowfax",                    "ticker":"SHADOWFAX",  "exchange":"NSE",    "sector":"B2B",                         "float_pct":20.86},
    {"num":39, "name":"Wakefit",                      "ticker":"WAKEFIT",    "exchange":"NSE",    "sector":"Consumer / Consumer Tech",    "float_pct":20.01},
    {"num":40, "name":"Aye Finance",                  "ticker":"AYE",        "exchange":"NSE",    "sector":"Fintech / Financial Services","float_pct":30.02},
    {"num":41, "name":"E2E Networks",                 "ticker":"E2E",        "exchange":"NSE",    "sector":"SaaS / AI",                   "float_pct":41.93},
    {"num":42, "name":"Capillary Technologies",       "ticker":"CAPILLARY",  "exchange":"NSE",    "sector":"SaaS / AI",                   "float_pct":18.77},
    {"num":43, "name":"Medi Assist",                  "ticker":"MEDIASSIST", "exchange":"NSE",    "sector":"Fintech / Financial Services","float_pct":86.70},
    {"num":44, "name":"Kissht (OnEMI Technology)",    "ticker":"KISSHT",     "exchange":"NSE",    "sector":"Fintech / Financial Services","float_pct":28.31},
    {"num":45, "name":"Fractal Analytics",            "ticker":"FRACTAL",    "exchange":"NSE",    "sector":"SaaS / AI",                   "float_pct":20.25},
    {"num":46, "name":"MobiKwik",                     "ticker":"MOBIKWIK",   "exchange":"NSE",    "sector":"Fintech / Financial Services","float_pct":52.90},
    {"num":47, "name":"Unicommerce",                  "ticker":"UNIECOM",    "exchange":"NSE",    "sector":"SaaS / AI",                   "float_pct":40.00},
]

# Free-float (fs) and total (ts) share counts — mirrored from repo
# calc_index_extension.py (16 Jun 2026 rebalance). All 47 current names present.
SHARE_DATA = {
    "ETERNAL.NS":{"fs":6734074736,"ts":9045099862}, "GROWW.NS":{"fs":1621477822,"ts":16702420288},
    "SWIGGY.NS":{"fs":1289125748,"ts":2600046000},   "NAUKRI.NS":{"fs":309161475,"ts":526023000},
    "LENSKART.NS":{"fs":565841079,"ts":3366560768},  "PAYTM.NS":{"fs":407781184,"ts":622175000},
    "SBICARD.NS":{"fs":299099658,"ts":951792000},    "NYKAA.NS":{"fs":1520677422,"ts":3192618752},
    "POLICYBZR.NS":{"fs":343574545,"ts":467903000},  "MEESHO.NS":{"fs":1599314761,"ts":25706899456},
    "MMYT":{"fs":27719898,"ts":107730000},           "ANGELONE.NS":{"fs":489085864,"ts":913349399},
    "PWL.NS":{"fs":586171279,"ts":3635070720},       "DELHIVERY.NS":{"fs":610426538,"ts":820788000},
    "GODIGIT.NS":{"fs":247723602,"ts":954673000},    "ATHERENERG.NS":{"fs":151339648,"ts":303794000},
    "PINELABS.NS":{"fs":569509650,"ts":3704099840},  "FRSH":{"fs":217622798,"ts":274859000},
    "URBANCO.NS":{"fs":361132700,"ts":1656122368},   "TBOTEK.NS":{"fs":33312523,"ts":106214000},
    "FIRSTCRY.NS":{"fs":234492112,"ts":554638000},   "APTUS.NS":{"fs":351906002,"ts":499079000},
    "OLAELEC.NS":{"fs":1971110364,"ts":4337649152},  "INDIAMART.NS":{"fs":26035016,"ts":51283000},
    "FIVESTAR.NS":{"fs":206257956,"ts":314279000},   "CARTRADE.NS":{"fs":42191046,"ts":47944000},
    "AFFLE.NS":{"fs":61440869,"ts":140640627},       "BLACKBUCK.NS":{"fs":107199016,"ts":186936000},
    "NAZARA.NS":{"fs":232422504,"ts":380021000},     "MEDPLUS.NS":{"fs":69598668,"ts":116684000},
    "IXIGO.NS":{"fs":200525531,"ts":410784000},      "HONASA.NS":{"fs":147594519,"ts":354383000},
    "AMAGI.NS":{"fs":45411824,"ts":216338944},       "AWFIS.NS":{"fs":46888435,"ts":68356000},
    "RATEGAIN.NS":{"fs":59586146,"ts":115918000},    "MAPMYINDIA.NS":{"fs":16997521,"ts":53879000},
    "BLUESTONE.NS":{"fs":84389676,"ts":233579000},   "SHADOWFAX.NS":{"fs":70147756,"ts":336397000},
    "WAKEFIT.NS":{"fs":112357162,"ts":561574000},    "AYE.NS":{"fs":73407776,"ts":244498877},
    "E2E.NS":{"fs":7615660,"ts":18164000},           "CAPILLARY.NS":{"fs":23272278,"ts":123972000},
    "MEDIASSIST.NS":{"fs":64953781,"ts":74951000},   "KISSHT.NS":{"fs":47691894,"ts":168483022},
    "FRACTAL.NS":{"fs":34815148,"ts":171965112},     "MOBIKWIK.NS":{"fs":56136337,"ts":106126000},
    "UNIECOM.NS":{"fs":40196207,"ts":100490000},
}

SECTOR_ORDER = [
    "Consumer / Consumer Tech",
    "Fintech / Financial Services",
    "SaaS / AI",
    "B2B",
]

# ── HTTP / SSL ──────────────────────────────────────────────────────────────
def _ssl_ctx() -> ssl.SSLContext:
    """Robust CA resolution: macOS system bundle -> certifi -> default."""
    for ca in ("/etc/ssl/cert.pem", "/private/etc/ssl/cert.pem"):
        if os.path.exists(ca):
            try:
                return ssl.create_default_context(cafile=ca)
            except Exception:
                pass
    try:
        import certifi  # type: ignore
        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        return ssl.create_default_context()

CTX = _ssl_ctx()


def yf_ticker(c: dict) -> str:
    return c["ticker"] + ".NS" if c["exchange"] == "NSE" else c["ticker"]


YF_HOSTS = ("query1.finance.yahoo.com", "query2.finance.yahoo.com")
# A realistic browser UA + rotating hosts + back-off: Yahoo aggressively
# rate-limits (429) / blocks (401/403) datacenter IPs such as GitHub Actions
# runners. From a home IP a bare "Mozilla/5.0" burst is fine; from a runner it
# isn't — so we look like a browser and retry politely.
YF_UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
         "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")


def fetch_chart(symbol: str, period1: int, period2: int, interval: str = "1d"):
    """Return (meta, [(iso_date, close), ...] sorted ascending) from Yahoo v8.

    Resilient to datacenter rate-limiting: rotates query1/query2 hosts and backs
    off (honouring Retry-After) on 429/401/403/503 before giving up."""
    q = urllib.parse.quote(symbol, safe="")
    path = (f"/v8/finance/chart/{q}"
            f"?period1={period1}&period2={period2}&interval={interval}")
    last_err = None
    for attempt in range(5):
        host = YF_HOSTS[attempt % len(YF_HOSTS)]
        req = urllib.request.Request(
            f"https://{host}{path}",
            headers={"User-Agent": YF_UA,
                     "Accept": "application/json,text/plain,*/*",
                     "Accept-Language": "en-US,en;q=0.9"})
        try:
            with urllib.request.urlopen(req, timeout=25, context=CTX) as r:
                d = json.load(r)
            res = d["chart"]["result"][0]
            meta = res.get("meta", {}) or {}
            ts = res.get("timestamp", []) or []
            quote = (res.get("indicators", {}).get("quote", [{}]) or [{}])[0]
            closes = quote.get("close", []) or []
            series = []
            for t, c in zip(ts, closes):
                if c is None:
                    continue
                iso = datetime.fromtimestamp(t, IST).date().isoformat()
                series.append((iso, float(c)))
            series.sort(key=lambda x: x[0])
            return meta, series
        except urllib.error.HTTPError as e:  # noqa: PERF203
            last_err = e
            if e.code in (429, 401, 403, 503):
                ra = e.headers.get("Retry-After") if e.headers else None
                wait = float(ra) if (ra and ra.isdigit()) else 2 ** attempt
                time.sleep(min(wait, 30) + random.uniform(0, 1.0))
            else:
                time.sleep(1 + random.uniform(0, 1.0))
        except Exception as e:  # noqa: BLE001
            last_err = e
            time.sleep(1 + random.uniform(0, 1.0))
    raise RuntimeError(f"fetch failed for {symbol}: {last_err}")


def fetch_usdinr():
    """USD/INR spot from Yahoo (INR=X) → {value, daily_pct, as_of}, or None on failure."""
    try:
        now = datetime.now(IST)
        p2 = int(now.timestamp())
        p1 = p2 - 14 * 86400
        meta, series = fetch_chart("INR=X", p1, p2, interval="1d")
        val = meta.get("regularMarketPrice")
        if val is None and series:
            val = series[-1][1]
        prev = meta.get("chartPreviousClose") or meta.get("previousClose")
        if (not prev) and len(series) >= 2:
            prev = series[-2][1]
        out = {"value": round(float(val), 2)}
        if prev:
            out["daily_pct"] = round((float(val) - float(prev)) / float(prev) * 100, 2)
        rmt = meta.get("regularMarketTime")
        out["as_of"] = (datetime.fromtimestamp(rmt, IST) if rmt else now).strftime("%H:%M IST")
        return out
    except Exception:
        return None


# ── Helpers ─────────────────────────────────────────────────────────────────
def close_on_or_after(series, target_iso):
    for d, c in series:
        if d >= target_iso:
            return c
    return None


def ffill_on_calendar(series, calendar):
    """Map a ticker's (date,close) series onto a master date calendar, forward-filled."""
    m = dict(series)
    out, last = {}, None
    for d in calendar:
        if d in m:
            last = m[d]
        if last is not None:
            out[d] = last
    return out


def r2(x, n=2):
    return round(x, n) if x is not None else None


def ret_over(pairs, days, today_iso):
    """% return of an indexed/value series over the last `days` calendar days."""
    if not pairs or pairs[-1][1] is None:
        return None
    cut = (datetime.fromisoformat(today_iso).date() - timedelta(days=days)).isoformat()
    base = None
    for d, v in pairs:
        if d >= cut and v is not None:
            base = v
            break
    return round((pairs[-1][1] / base - 1) * 100, 2) if base else None


def main():
    write_history = "--write-history" in sys.argv
    now_ist = datetime.now(IST)
    today_iso = now_ist.date().isoformat()
    # Fetch from base date so we can derive per-constituent "since" returns too.
    period1 = int(datetime(2024, 1, 1, tzinfo=IST).timestamp())
    period2 = int(now_ist.timestamp()) + 86400

    tickers = [yf_ticker(c) for c in COMPANIES]

    # ── Fetch everything concurrently ──────────────────────────────────────
    symbols = tickers + [N500_YF]
    fetched: dict[str, tuple] = {}
    errors: list[str] = []
    # Gentle concurrency (4, not 12): a 48-request burst from a datacenter IP
    # is an instant Yahoo 429. fetch_chart() also backs off per request.
    with ThreadPoolExecutor(max_workers=4) as ex:
        futs = {ex.submit(fetch_chart, s, period1, period2): s for s in symbols}
        for fut in as_completed(futs):
            s = futs[fut]
            try:
                fetched[s] = fut.result()
            except Exception as e:  # noqa: BLE001
                errors.append(f"{s}: {e}")
    for e in errors:
        print("  [warn]", e, file=sys.stderr)

    n500_meta, n500_series = fetched.get(N500_YF, ({}, []))

    # ── Health guard ───────────────────────────────────────────────────────
    # Never overwrite the last-good feed with a half-fetched one. If Yahoo
    # rate-limited the runner (missing constituents or benchmark), abort RED
    # without writing — the page keeps showing the last good data, stale but
    # correct, rather than crashing downstream or publishing a broken index.
    def _priced(tk):
        meta, series = fetched.get(tk, ({}, []))
        return bool(series) or meta.get("regularMarketPrice") is not None
    priced_ok = sum(1 for tk in tickers if _priced(tk))
    bench_ok = bool(n500_series) or n500_meta.get("regularMarketPrice") is not None
    if priced_ok < len(tickers) or not bench_ok:
        print(f"ABORT: incomplete fetch — priced {priced_ok}/{len(tickers)} "
              f"constituents, benchmark={'ok' if bench_ok else 'MISSING'}. "
              f"Keeping last-good feed (not overwriting z47_index.json).",
              file=sys.stderr)
        sys.exit(1)

    # Master trading-day calendar from the benchmark (>= anchor), plus today.
    calendar = sorted({d for d, _ in n500_series if d >= ANCHOR_DATE})
    if calendar and calendar[-1] < today_iso and n500_meta.get("regularMarketPrice"):
        calendar.append(today_iso)

    ff = {tk: ffill_on_calendar(fetched.get(tk, ({}, []))[1], calendar) for tk in tickers}
    one_mo_target = (now_ist.date() - timedelta(days=30)).isoformat()

    # ── Per-constituent live snapshot ──────────────────────────────────────
    constituents = []
    for c in COMPANIES:
        tk = yf_ticker(c)
        meta, series = fetched.get(tk, ({}, []))
        price = meta.get("regularMarketPrice")
        if price is None and series:
            price = series[-1][1]
        prev = meta.get("chartPreviousClose")
        if prev is None and len(series) >= 2:
            prev = series[-2][1]
        daily = (price / prev - 1) * 100 if price and prev else None
        base_1m = close_on_or_after(series, one_mo_target)
        ret_1m = (price / base_1m - 1) * 100 if price and base_1m else None
        # "Since" = since base date for pre-2024 listers, else since listing day
        # (= earliest available close), matching the index base convention.
        since_base = series[0][1] if series else None
        since = (price / since_base - 1) * 100 if price and since_base else None
        sh = SHARE_DATA.get(tk, {})
        ccy = "INR" if c["exchange"] == "NSE" else "USD"
        mcap_mn = price * sh["ts"] / 1e6 if price and sh.get("ts") else None
        constituents.append({
            "num": c["num"], "name": c["name"], "ticker": c["ticker"],
            "exchange": c["exchange"], "sector": c["sector"], "float_pct": c["float_pct"],
            "price": r2(price), "ccy": ccy,
            "daily_pct": r2(daily), "ret_1m": r2(ret_1m), "since_pct": r2(since),
            "mcap_mn": r2(mcap_mn, 1),
        })

    # ── Divisor from the fixed anchor (only tickers usable on the anchor) ───
    usable_f = [tk for tk in tickers if ff[tk].get(ANCHOR_DATE) and SHARE_DATA.get(tk, {}).get("fs")]
    usable_m = [tk for tk in tickers if ff[tk].get(ANCHOR_DATE) and SHARE_DATA.get(tk, {}).get("ts")]
    DIV_F = sum(ff[tk][ANCHOR_DATE] * SHARE_DATA[tk]["fs"] for tk in usable_f) / ANCHOR_Z47_FLOAT
    DIV_M = sum(ff[tk][ANCHOR_DATE] * SHARE_DATA[tk]["ts"] for tk in usable_m) / ANCHOR_Z47_MCAP

    def z47_float_on(day):
        return sum(ff[tk][day] * SHARE_DATA[tk]["fs"] for tk in usable_f if day in ff[tk]) / DIV_F

    def z47_mcap_on(day):
        return sum(ff[tk][day] * SHARE_DATA[tk]["ts"] for tk in usable_m if day in ff[tk]) / DIV_M

    # ── History: keep published CSV up to anchor, recompute anchor+1..today ──
    hist_rows = []
    with open(HIST_CSV, newline="") as f:
        for row in csv.DictReader(f):
            d = row["date"].split(" ")[0].split("T")[0]
            if d <= ANCHOR_DATE:
                hist_rows.append({"date": d,
                                  "z47": float(row["z47_float"]),
                                  "nifty500": float(row["n500_indexed"])})
    n500_map = ffill_on_calendar(n500_series, calendar)
    for day in calendar:
        if day <= ANCHOR_DATE:
            continue
        n_abs = (n500_meta.get("regularMarketPrice") if day == today_iso else None) or n500_map.get(day)
        hist_rows.append({"date": day,
                          "z47": round(z47_float_on(day), 4),
                          "nifty500": round(n_abs / N500_BASE * 100, 4) if n_abs else None})

    # ── Headline values + return summary ───────────────────────────────────
    z47_now      = z47_float_on(today_iso) if today_iso in calendar else hist_rows[-1]["z47"]
    z47_mcap_now = z47_mcap_on(today_iso)  if today_iso in calendar else None
    z47_prev     = z47_float_on(calendar[-2]) if len(calendar) >= 2 else None
    daily_pct    = (z47_now / z47_prev - 1) * 100 if z47_prev else None

    z47_pairs   = [(r["date"], r["z47"]) for r in hist_rows]
    n500_pairs  = [(r["date"], r["nifty500"]) for r in hist_rows]

    def return_block(pairs):
        # YTD = from the first trading day on/after 1 Jan of the current year.
        ytd_cut  = f"{today_iso[:4]}-01-01"
        ytd_base = next((v for d, v in pairs if d >= ytd_cut and v is not None), None)
        last     = pairs[-1][1] if pairs else None
        return {
            "1M": ret_over(pairs, 30, today_iso),
            "3M": ret_over(pairs, 90, today_iso),
            "6M": ret_over(pairs, 180, today_iso),
            "1Y": ret_over(pairs, 365, today_iso),
            "YTD": round((last / ytd_base - 1) * 100, 2) if last and ytd_base else None,
            "since_base": round((pairs[-1][1] / pairs[0][1] - 1) * 100, 2) if pairs and pairs[0][1] else None,
        }

    z47_returns  = return_block(z47_pairs)
    n500_returns = return_block(n500_pairs)
    n500_now     = n500_meta.get("regularMarketPrice")
    n500_indexed_now = n500_now / N500_BASE * 100 if n500_now else None

    # ── Movers (by 1-month return) ─────────────────────────────────────────
    ranked = sorted([c for c in constituents if c["ret_1m"] is not None],
                    key=lambda c: c["ret_1m"], reverse=True)
    mv = lambda c: {"name": c["name"], "ticker": c["ticker"], "sector": c["sector"], "ret_1m": c["ret_1m"]}
    movers = {"gainers": [mv(c) for c in ranked[:5]], "losers": [mv(c) for c in ranked[-5:][::-1]]}

    # ── Sectors (count + mcap weight + avg 1M + top mover) ─────────────────
    total_mcap = sum(c["mcap_mn"] for c in constituents if c["mcap_mn"]) or 1
    sectors = []
    for name in SECTOR_ORDER:
        members = [c for c in constituents if c["sector"] == name]
        rets = [c["ret_1m"] for c in members if c["ret_1m"] is not None]
        wt = sum(c["mcap_mn"] for c in members if c["mcap_mn"])
        top = max(members, key=lambda c: c["ret_1m"] if c["ret_1m"] is not None else -1e9) if members else None
        sectors.append({
            "name": name, "count": len(members),
            "weight_pct": r2(wt / total_mcap * 100, 1),
            "avg_ret_1m": r2(sum(rets) / len(rets)) if rets else None,
            "top_mover": {"name": top["name"], "ret_1m": top["ret_1m"]} if top else None,
        })

    try:
        with open(EVENTS_JSON) as f:
            events = json.load(f)
    except Exception:
        events = []

    market_open = (now_ist.weekday() < 5 and _time(9, 15) <= now_ist.time() <= _time(15, 35))

    usdinr = fetch_usdinr()

    out = {
        "meta": {
            "generated_at": now_ist.isoformat(timespec="seconds"),
            "generated_at_ist": now_ist.strftime("%d %b %Y, %H:%M IST"),
            "market_open": market_open,
            "usdinr": usdinr,
            "base_date": BASE_DATE, "anchor_date": ANCHOR_DATE,
            "benchmark": "NIFTY 500",
            "constituents_priced": len(usable_f),
            "source": "Yahoo Finance (delayed) — public landing feed",
            "data_source_of_truth": "github.com/GirishZ47/z47-dashboard (16 Jun 2026 rebalance)",
            "methodology_flags": [
                "MMYT & FRSH summed in USD without FX conversion — existing model quirk.",
            ],
        },
        "index": {
            "value": r2(z47_now), "value_mcap": r2(z47_mcap_now),
            "daily_pct": r2(daily_pct), "returns": z47_returns,
        },
        "benchmark": {
            "name": "NIFTY 500", "value": r2(n500_now),
            "indexed": r2(n500_indexed_now), "returns": n500_returns,
        },
        "history": hist_rows,
        "constituents": constituents,
        "movers": movers,
        "sectors": sectors,
        "events": events,
    }

    with open(OUT_JSON, "w") as f:
        json.dump(out, f, indent=2)

    # ── Optionally persist today's row into the CSV (upsert by date) ────────
    if write_history and today_iso in calendar:
        rows = []
        fieldnames = ["date", "z47_float", "z47_mcap", "n500_indexed", "n500_abs"]
        with open(HIST_CSV, newline="") as f:
            for row in csv.DictReader(f):
                d = row["date"].split(" ")[0].split("T")[0]
                if d != today_iso:
                    rows.append(row)
        rows.append({
            "date": today_iso,
            "z47_float": round(z47_now, 6),
            "z47_mcap": round(z47_mcap_now, 6) if z47_mcap_now else "",
            "n500_indexed": round(n500_indexed_now, 4) if n500_indexed_now else "",
            "n500_abs": round(n500_now, 2) if n500_now else "",
        })
        with open(HIST_CSV, "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=fieldnames)
            w.writeheader()
            for row in rows:
                w.writerow({k: row.get(k, "") for k in fieldnames})
        print(f"  upserted {today_iso} into z47_history.csv")

    # ── Console summary ─────────────────────────────────────────────────────
    print(f"Z47'47 = {out['index']['value']}  ({out['index']['daily_pct']:+}% today)  "
          f"returns 1M/YTD/1Y/base = {z47_returns['1M']}/{z47_returns['YTD']}/{z47_returns['1Y']}/{z47_returns['since_base']}%")
    print(f"  NIFTY 500 indexed {out['benchmark']['indexed']}  "
          f"(1M/YTD/1Y/base = {n500_returns['1M']}/{n500_returns['YTD']}/{n500_returns['1Y']}/{n500_returns['since_base']}%)")
    print(f"  priced {len(usable_f)}/47 constituents  |  history points: {len(hist_rows)}")
    print(f"  sectors: " + ", ".join(f"{s['name'].split(' / ')[0]} {s['count']}" for s in sectors))
    if errors:
        print(f"  fetch warnings: {len(errors)} (see stderr)")
    print(f"  wrote {OUT_JSON}")


if __name__ == "__main__":
    main()
