#!/usr/bin/env python3
"""
build_z47_json.py — Z47'47 index feed builder.

Produces z47_index.json: the single data file the FortySeven landing page reads.

FETCH: yfinance (preferred) with a pure-stdlib urllib fallback. Yahoo now 429s
*unauthenticated* requests broadly (every IP, not just datacenter) — they require
a cookie+crumb session. yfinance performs that handshake automatically, so it
works from any IP including GitHub Actions runners (this is the same library the
source-of-truth dashboard uses, so our numbers match it). If yfinance isn't
importable, we fall back to the bare urllib chart endpoint (works only from IPs
Yahoo still serves unauthenticated). Set Z47_NO_YF=1 to force the stdlib path.

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
  - Prices from Yahoo Finance via yfinance (history) + fast_info (live price /
    previous close), mirroring the source dashboard's fetching.
  - Constituent table Mkt Cap (₹ mn): Screener.in (NSE) → BSE fallback;
    MMYT/FRSH from NASDAQ via Yahoo × USD/INR. Always ₹ millions (cr × 10).
    Optional env SCREENER_SESSIONID if Screener rate-limits the runner.

KNOWN METHODOLOGY ITEM (replicated faithfully so the public number matches Z47's
dashboard — not silently "fixed"):
  - MMYT & FRSH are priced in USD but summed as if INR (no FX conversion) for the
    index value; their *table* mcap is FX-converted to INR mn.
Any constituent change requires re-deriving the divisor — update ANCHOR_* below
to the last good point under the new basket, and re-sync COMPANIES / SHARE_DATA.

Run:  python3 scripts/build_z47_json.py            # writes data/z47_index.json
      python3 scripts/build_z47_json.py --write-history   # also upserts today's row into data/z47_history.csv
"""
from __future__ import annotations

import csv
import json
import os
import random
import re
import ssl
import sys
import time
from collections import Counter
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone, time as _time

HERE        = os.path.dirname(os.path.abspath(__file__))
# GitHub feed: this file is at repo root next to z47_index.json.
# Cursor copy: this file lives in scripts/ and writes data/.
_at_repo_root = os.path.isfile(os.path.join(HERE, "z47_history.csv")) or os.path.isfile(
    os.path.join(HERE, "z47_index.json")
)
if _at_repo_root:
    ROOT = HERE
    DATA_DIR = HERE
    SCRIPTS_DIR = os.path.join(HERE, "scripts")
    HIST_CSV = os.path.join(HERE, "z47_history.csv")
    EVENTS_JSON = os.path.join(HERE, "constituent_events.json")
    OUT_JSON = os.path.join(HERE, "z47_index.json")
else:
    ROOT = os.path.dirname(HERE)
    DATA_DIR = os.path.join(ROOT, "data")
    SCRIPTS_DIR = HERE
    HIST_CSV = os.path.join(DATA_DIR, "z47_history.csv")
    EVENTS_JSON = os.path.join(DATA_DIR, "constituent_events.json")
    OUT_JSON = os.path.join(DATA_DIR, "z47_index.json")
if SCRIPTS_DIR not in sys.path:
    sys.path.insert(0, SCRIPTS_DIR)

IST = timezone(timedelta(hours=5, minutes=30))

# ── Methodology constants (NIFTY 500 benchmark) ─────────────────────────────
N500_BASE = 19418.40            # ^CRSLDX on 2024-01-02 (index = 100)
N500_YF   = "^CRSLDX"
BASE_DATE = "2024-01-02"        # rebase date (z47 = 100)

# Divisor anchor — last authoritative point from the repo's z47_history.csv
# (post-16-Jun-2026 rebalance, 47-name basket). z47_float == z47_mcap there.
ANCHOR_DATE      = "2026-08-20"
ANCHOR_Z47_FLOAT = 142.4588
ANCHOR_Z47_MCAP  = 140.01

# ── Constituents (20 Aug 2026 rebalance) ─────────────────────────────────────
# Counts: Consumer 20 | Fintech 12 | SaaS/AI 8 | B2B 7 = 47
COMPANIES = [
    {"num":1,  "name":"Eternal (Zomato)",            "ticker":"ETERNAL",    "exchange":"NSE",    "sector":"Consumer / Consumer Tech",    "float_pct":74.43},
    {"num":2,  "name":"Groww",                        "ticker":"GROWW",      "exchange":"NSE",    "sector":"Fintech / Financial Services","float_pct":9.71},
    {"num":3,  "name":"Swiggy",                       "ticker":"SWIGGY",     "exchange":"NSE",    "sector":"Consumer / Consumer Tech",    "float_pct":49.57},
    {"num":4,  "name":"Info Edge (Naukri)",           "ticker":"NAUKRI",     "exchange":"NSE",    "sector":"Consumer / Consumer Tech",    "float_pct":58.77},
    {"num":5,  "name":"Lenskart",                     "ticker":"LENSKART",   "exchange":"NSE",    "sector":"Consumer / Consumer Tech",    "float_pct":16.81},
    {"num":6,  "name":"Paytm",                        "ticker":"PAYTM",      "exchange":"NSE",    "sector":"Fintech / Financial Services","float_pct":65.52},
    {"num":7,  "name":"Turtlemint",                   "ticker":"TURTLEMINT", "exchange":"NSE",    "sector":"Fintech / Financial Services","float_pct":38.01},
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
    {"num":46, "name":"Shiprocket",                   "ticker":"SHIPROCKET", "exchange":"NSE",    "sector":"B2B",                         "float_pct":94.78},
    {"num":47, "name":"Milky Mist",                   "ticker":"MILKYMIST",  "exchange":"NSE",    "sector":"Consumer / Consumer Tech",    "float_pct":20.49},
]

# Free-float (fs) and total (ts) share counts — mirrored from repo
# calc_index_extension.py (16 Jun 2026 rebalance). All 47 current names present.
SHARE_DATA = {
    "ETERNAL.NS":{"fs":6734074736,"ts":9045099862}, "GROWW.NS":{"fs":1621477822,"ts":16702420288},
    "SWIGGY.NS":{"fs":1289125748,"ts":2600046000},   "NAUKRI.NS":{"fs":309161475,"ts":526023000},
    "LENSKART.NS":{"fs":565841079,"ts":3366560768},  "PAYTM.NS":{"fs":407781184,"ts":622175000},
    "TURTLEMINT.NS":{"fs":112268281,"ts":295384615}, "NYKAA.NS":{"fs":1520677422,"ts":3192618752},
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
    "FRACTAL.NS":{"fs":34815148,"ts":171965112},     "SHIPROCKET.NS":{"fs":690741270,"ts":728783784},
    "MILKYMIST.NS":{"fs":157740817,"ts":769842932},
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

# ── yfinance probe ──────────────────────────────────────────────────────────
# Preferred fetch path: yfinance does Yahoo's cookie+crumb handshake, so it works
# from any IP (incl. GitHub runners) where bare requests now 429. Falls back to
# the urllib chart endpoint below if yfinance is missing or Z47_NO_YF is set.
try:
    import yfinance as _yf  # type: ignore
    USE_YF = os.environ.get("Z47_NO_YF") != "1"
except Exception:
    _yf = None
    USE_YF = False


def _fi_num(fi, *keys):
    """Read a numeric field from a yfinance fast_info (attr- or dict-style),
    tolerant of version differences. Returns a positive float or None."""
    for k in keys:
        v = None
        try:
            v = getattr(fi, k)
        except Exception:
            v = None
        if v is None:
            try:
                v = fi[k]
            except Exception:
                v = None
        if v is None:
            continue
        try:
            f = float(v)
        except Exception:
            continue
        if f == f and f != 0:  # not NaN, not zero
            return f
    return None


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


def session_asof(now):
    """Most recent NSE trading-session date as of `now` (holidays ignored — a rare
    off-by-a-day on the latest point that self-corrects on the next run).

    Yahoo's daily-history endpoint lags the live quote: right after a close (and in
    the pre-open hours) the just-finished session is still NaN in history while
    fast_info already carries it. So we date the live price by the session calendar,
    not by `today` — otherwise a pre-open live price (= yesterday's close) gets
    mislabelled today, creating a phantom future point and a gap."""
    if now.weekday() < 5 and now.time() >= _time(9, 15):
        d = now                      # weekday, session has opened → today
    else:
        d = now - timedelta(days=1)  # before open / weekend → step back to last weekday
        while d.weekday() >= 5:
            d -= timedelta(days=1)
    return d.date().isoformat()


def fetch_all_yf(symbols, period1, period2, asof_iso):
    """Fetch history + live snapshot for every symbol via yfinance.

    Returns {symbol: (meta, series)} matching fetch_chart()'s shape so the whole
    downstream pipeline is unchanged. `series` is ascending (iso_date, close) with
    the latest bar (dated `asof_iso`) set from the live price; `meta` carries
    regularMarketPrice plus two private fields we use directly: `_prev` (official
    previous close, for the day change) and `_mcap` (Yahoo market cap, for the
    constituent table / sector weights). Closes are UNADJUSTED to stay continuous
    with the published history.
    """
    start = datetime.fromtimestamp(period1, IST).date().isoformat()
    end   = datetime.fromtimestamp(period2, IST).date().isoformat()  # exclusive (already +1d)

    # 1) One batched daily-history download for all symbols.
    df = _yf.download(symbols, start=start, end=end, interval="1d",
                      auto_adjust=False, group_by="ticker", threads=True,
                      progress=False)

    def _series_from_df(sym):
        try:
            sub = df[sym] if len(symbols) > 1 else df
            closes = sub["Close"]
        except Exception:
            return []
        s = []
        for idx, val in closes.items():
            try:
                f = float(val)
            except Exception:
                continue
            if f != f:  # NaN (e.g. today's forming intraday bar)
                continue
            d = idx.date().isoformat() if hasattr(idx, "date") else str(idx)[:10]
            s.append((d, f))
        s.sort(key=lambda x: x[0])
        return s

    out = {}
    for sym in symbols:
        series = _series_from_df(sym)
        if not series:  # per-symbol fallback if the batch missed this ticker
            try:
                h = _yf.Ticker(sym).history(start=start, end=end, interval="1d",
                                            auto_adjust=False)
                for idx, val in h["Close"].items():
                    try:
                        f = float(val)
                    except Exception:
                        continue
                    if f == f:
                        d = idx.date().isoformat() if hasattr(idx, "date") else str(idx)[:10]
                        series.append((d, f))
                series.sort(key=lambda x: x[0])
            except Exception:
                pass

        # Drop any history bar dated on/after the as-of session — we set that point
        # from the live price so series[-1] is the latest value (correctly dated)
        # and series[-2] is the prior close.
        series = [(d, c) for (d, c) in series if d < asof_iso]
        prior_close = series[-1][1] if series else None

        last_price = prev_close = mcap = None
        try:
            fi = _yf.Ticker(sym).fast_info
            last_price = _fi_num(fi, "last_price", "lastPrice")
            prev_close = _fi_num(fi, "previous_close", "previousClose")
            mcap       = _fi_num(fi, "market_cap", "marketCap")
        except Exception:
            pass
        if last_price is None:
            last_price = prior_close          # after-close fallback: history's close
        if prev_close is None:
            prev_close = prior_close
        if last_price is not None:
            series.append((asof_iso, last_price))

        out[sym] = ({
            "regularMarketPrice": last_price,
            "regularMarketTime": int(datetime.now(IST).timestamp()),
            "_prev": prev_close,
            "_mcap": mcap,
        }, series)
    return out


def fetch_usdinr():
    """USD/INR spot from Yahoo (INR=X) → {value, daily_pct, as_of}, or None on failure."""
    if USE_YF:
        try:
            fi = _yf.Ticker("INR=X").fast_info
            val = _fi_num(fi, "last_price", "lastPrice")
            prev = _fi_num(fi, "previous_close", "previousClose")
            if val:
                out = {"value": round(val, 2)}
                if prev:
                    out["daily_pct"] = round((val - prev) / prev * 100, 2)
                out["as_of"] = datetime.now(IST).strftime("%H:%M IST")
                return out
        except Exception:
            pass
    try:
        now = datetime.now(IST)
        p2 = int(now.timestamp())
        p1 = p2 - 14 * 86400
        meta, series = fetch_chart("INR=X", p1, p2, interval="1d")
        today_iso = now.date().isoformat()
        val = meta.get("regularMarketPrice")
        if val is None and series:
            val = series[-1][1]
        # real previous close = last daily close before today (not chartPreviousClose,
        # which over a 14-day range is ~2 weeks old → a wrong "daily" FX change)
        prev = None
        if series:
            prev = series[-2][1] if (series[-1][0] >= today_iso and len(series) >= 2) else series[-1][1]
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


# ── Table mcap: Screener (NSE) → BSE fallback → Yahoo (NASDAQ / last resort) ─
# Page column is always Mkt Cap (₹ mn). Screener/BSE publish ₹ cr → ×10.
SCREENER_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
SCREENER_SESSION = os.environ.get("SCREENER_SESSIONID", "").strip()
_bse_sym_to_scrip: dict[str, str] | None = None


def _http_get(url: str, referer: str | None = None, cookies: str | None = None) -> bytes:
    headers = {
        "User-Agent": SCREENER_UA,
        "Accept": "text/html,application/json,*/*",
        "Accept-Language": "en-US,en;q=0.9",
    }
    if referer:
        headers["Referer"] = referer
    if cookies:
        headers["Cookie"] = cookies
    req = urllib.request.Request(url, headers=headers)
    # Prefer system CA; fall back to unverified if runner/macOS CA is broken.
    try:
        with urllib.request.urlopen(req, timeout=30, context=CTX) as r:
            return r.read()
    except Exception:
        with urllib.request.urlopen(
            req, timeout=30, context=ssl._create_unverified_context()
        ) as r:
            return r.read()


def screener_quote(ticker: str) -> dict:
    """Screener.in live quote: {mcap_cr, price, daily_pct} (any field may be None)."""
    url = f"https://www.screener.in/company/{urllib.parse.quote(ticker)}/"
    cookies = f"sessionid={SCREENER_SESSION}" if SCREENER_SESSION else None
    out: dict = {"mcap_cr": None, "price": None, "daily_pct": None}
    try:
        html = _http_get(url, referer="https://www.screener.in/", cookies=cookies).decode(
            "utf-8", errors="ignore"
        )
    except Exception:
        return out
    m = re.search(
        r'<span class="name">\s*Market Cap\s*</span>.*?'
        r'<span class="number">([\d,]+(?:\.\d+)?)</span>',
        html, re.S | re.I,
    )
    if m:
        try:
            out["mcap_cr"] = float(m.group(1).replace(",", ""))
        except ValueError:
            pass
    # Header: ₹ <price> + up/down <pct>%
    m = re.search(
        r'font-size-18[^>]*>.*?₹\s*([\d,]+(?:\.\d+)?)',
        html, re.S | re.I,
    )
    if m:
        try:
            out["price"] = float(m.group(1).replace(",", ""))
        except ValueError:
            pass
    m = re.search(
        r'font-size-18[^>]*>.*?font-size-12\s+(up|down)[^>]*>.*?([\d.]+)%',
        html, re.S | re.I,
    )
    if m:
        try:
            pct = float(m.group(2))
            out["daily_pct"] = -pct if m.group(1).lower() == "down" else pct
        except ValueError:
            pass
    return out


def screener_mcap_cr(ticker: str) -> float | None:
    """Screener.in Market Cap in ₹ crore, or None."""
    return screener_quote(ticker).get("mcap_cr")


def _bse_map() -> dict[str, str]:
    global _bse_sym_to_scrip
    if _bse_sym_to_scrip is not None:
        return _bse_sym_to_scrip
    url = (
        "https://api.bseindia.com/BseIndiaAPI/api/ListofScripData/w"
        "?Group=&Scripcode=&industry=&segment=Equity&status=Active"
    )
    try:
        data = json.loads(_http_get(url, referer="https://www.bseindia.com/"))
    except Exception:
        _bse_sym_to_scrip = {}
        return _bse_sym_to_scrip
    out: dict[str, str] = {}
    for row in data:
        sid = (row.get("scrip_id") or row.get("SCRIP_ID") or "").strip().upper()
        code = str(row.get("scrip_cd") or row.get("SCRIP_CD") or "")
        if sid and code:
            out[sid] = code
    _bse_sym_to_scrip = out
    return out


def bse_quote(ticker: str) -> dict:
    """BSE live quote: {mcap_cr, price} (daily_pct not available here)."""
    out: dict = {"mcap_cr": None, "price": None, "daily_pct": None}
    scrip = _bse_map().get(ticker.upper())
    if not scrip:
        return out
    try:
        trade = json.loads(
            _http_get(
                f"https://api.bseindia.com/BseIndiaAPI/api/StockTrading/w"
                f"?flag=&quotetype=EQ&scripcode={scrip}",
                referer="https://www.bseindia.com/",
            )
        )
        header = json.loads(
            _http_get(
                f"https://api.bseindia.com/BseIndiaAPI/api/getScripHeaderData/w"
                f"?Debtflag=&scripcode={scrip}&seriesid=",
                referer="https://www.bseindia.com/",
            )
        )
    except Exception:
        return out
    raw = (trade.get("MktCapFull") or "").replace(",", "")
    if raw and raw != "--":
        try:
            out["mcap_cr"] = float(raw)
        except ValueError:
            pass
    lp = header.get("CurrRate", {}).get("LTP") or header.get("Header", {}).get("LTP")
    if lp:
        try:
            out["price"] = float(str(lp).replace(",", ""))
        except ValueError:
            pass
    return out


def bse_mcap_cr(ticker: str) -> float | None:
    """BSE MktCapFull in ₹ crore, or None."""
    return bse_quote(ticker).get("mcap_cr")


def yahoo_fallback_mcap_mn(c, meta, price, sh, usd_to_inr):
    """Last-resort mcap in ₹ mn from Yahoo / price×shares (pre-Screener logic)."""
    yahoo_mn = None
    if meta.get("_mcap"):
        yahoo_mn = meta["_mcap"] / 1e6
        if c["exchange"] != "NSE":
            yahoo_mn *= usd_to_inr
    calc_mn = None
    if price and sh.get("ts"):
        calc_mn = price * sh["ts"] / 1e6
        if c["exchange"] != "NSE":
            calc_mn *= usd_to_inr
    if c["exchange"] != "NSE":
        return yahoo_mn or calc_mn
    if calc_mn and yahoo_mn:
        if yahoo_mn / calc_mn >= 8:
            return yahoo_mn / 10 if yahoo_mn >= 500_000 else yahoo_mn
        if yahoo_mn / calc_mn >= 1.8:
            return calc_mn
        if calc_mn / yahoo_mn >= 8:
            return yahoo_mn
        if calc_mn > yahoo_mn * 1.5:
            return yahoo_mn
        return yahoo_mn
    return yahoo_mn or calc_mn


def fetch_table_live(usd_to_inr: float) -> dict[str, dict]:
    """Fetch table live fields for all 47.

    Returns {ticker: {mcap_mn, price, daily_pct, source}}.
    NSE: Screener (price/day/mcap) → BSE fallback (price/mcap).
    NASDAQ (MMYT/FRSH): StockAnalysis USD × FX; Yahoo fallback.
    """
    out: dict[str, dict] = {}
    print("  fetching table live fields via Screener / BSE / StockAnalysis…", file=sys.stderr)
    for c in COMPANIES:
        t = c["ticker"]
        row: dict = {"mcap_mn": None, "price": None, "daily_pct": None, "source": None}
        if c["exchange"] == "NASDAQ":
            try:
                from stockanalysis_nasdaq import nasdaq_live

                sa = nasdaq_live(t, usd_to_inr=usd_to_inr)
            except Exception:  # noqa: BLE001
                sa = {}
            if sa.get("mcap_mn") or sa.get("price"):
                row["mcap_mn"] = sa.get("mcap_mn")
                row["price"] = sa.get("price")
                row["daily_pct"] = sa.get("daily_pct")
                row["source"] = sa.get("source") or "NASDAQ (StockAnalysis USD×INR)"
            elif USE_YF and _yf is not None:
                try:
                    fi = _yf.Ticker(t).fast_info
                    mcap_usd = _fi_num(fi, "market_cap", "marketCap")
                    if mcap_usd:
                        row["mcap_mn"] = mcap_usd * usd_to_inr / 1e6
                        row["source"] = "NASDAQ (Yahoo USD×INR)"
                    px = _fi_num(fi, "last_price", "lastPrice")
                    if px:
                        row["price"] = px
                except Exception:  # noqa: BLE001
                    pass
        else:
            q = screener_quote(t)
            if q.get("mcap_cr") is not None:
                row["mcap_mn"] = q["mcap_cr"] * 10.0
                row["price"] = q.get("price")
                row["daily_pct"] = q.get("daily_pct")
                row["source"] = "Screener"
            else:
                bq = bse_quote(t)
                if bq.get("mcap_cr") is not None:
                    row["mcap_mn"] = bq["mcap_cr"] * 10.0
                    row["price"] = bq.get("price")
                    row["source"] = "BSE"
            time.sleep(0.30)
        if row["source"] and (row["mcap_mn"] is not None or row["price"] is not None):
            out[t] = row
            extra = ""
            if row["price"] is not None:
                extra += f"  px={row['price']}"
            if row["daily_pct"] is not None:
                extra += f"  d={row['daily_pct']:+.2f}%"
            mcap_s = f"{row['mcap_mn']:>12,.1f}" if row["mcap_mn"] is not None else f"{'—':>12}"
            print(f"    {t:<12} {mcap_s} mn  [{row['source']}]{extra}",
                  file=sys.stderr)
        else:
            print(f"    {t:<12} FAILED — will use Yahoo fallback", file=sys.stderr)
    print(f"  table live: {len(out)}/{len(COMPANIES)} from Screener/BSE/StockAnalysis",
          file=sys.stderr)
    return out


# Back-compat alias used by fetch_mcap_table.py / older call sites
def fetch_table_mcap_mn(usd_to_inr: float) -> dict[str, tuple[float, str]]:
    live = fetch_table_live(usd_to_inr)
    return {t: (v["mcap_mn"], v["source"]) for t, v in live.items() if v.get("mcap_mn") is not None}


def mcap_mn_inr(c, meta, price, sh, usd_to_inr, table_live=None):
    """Market cap in INR millions for the constituent table / sector weights.

    Prefer Screener (NSE) / BSE / NASDAQ overlay; fall back to Yahoo reconciliation.
    Always returns ₹ millions (page column: Mkt Cap (₹ mn)).
    """
    if table_live and c["ticker"] in table_live and table_live[c["ticker"]].get("mcap_mn"):
        return table_live[c["ticker"]]["mcap_mn"]
    # Legacy tuple-shaped overlay from fetch_table_mcap_mn
    if table_live and c["ticker"] in table_live:
        v = table_live[c["ticker"]]
        if isinstance(v, tuple):
            return v[0]
    return yahoo_fallback_mcap_mn(c, meta, price, sh, usd_to_inr)


def company_slug(c: dict) -> str:
    """CMS slug for /z47-forty-seven/{slug} (ticker, matching Screener Companies)."""
    return re.sub(r"[^a-z0-9]+", "-", c["ticker"].lower()).strip("-")


def ret_from_series(price, series, today_iso, days=None, ytd=False):
    """% return from live price vs a historical close on `series`."""
    if price is None or not series:
        return None
    if ytd:
        ytd_cut = f"{today_iso[:4]}-01-01"
        base = close_on_or_after(series, ytd_cut)
    else:
        cut = (datetime.fromisoformat(today_iso).date() - timedelta(days=days)).isoformat()
        base = close_on_or_after(series, cut)
    if not base:
        return None
    return (price / base - 1) * 100


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
    # "today_iso" = the date of the LATEST data point, i.e. the most recent trading
    # session — not the wall-clock date. Before the open (and just after a close,
    # while Yahoo's daily history still lags) the latest price belongs to the prior
    # session; dating it by the calendar avoids a phantom future point. See session_asof().
    today_iso = session_asof(now_ist)
    # Fetch from base date so we can derive per-constituent "since" returns too.
    period1 = int(datetime(2024, 1, 1, tzinfo=IST).timestamp())
    period2 = int(now_ist.timestamp()) + 86400

    tickers = [yf_ticker(c) for c in COMPANIES]

    # ── Fetch everything ───────────────────────────────────────────────────
    symbols = tickers + [N500_YF]
    fetched: dict[str, tuple] = {}
    errors: list[str] = []

    # Preferred: yfinance (authenticated session — works from any IP).
    if USE_YF:
        try:
            print("  fetching via yfinance (cookie+crumb session)…", file=sys.stderr)
            fetched = fetch_all_yf(symbols, period1, period2, today_iso)
        except Exception as e:  # noqa: BLE001
            print(f"  [warn] yfinance path failed ({e}); falling back to urllib",
                  file=sys.stderr)
            fetched = {}

    # Fallback: bare urllib chart endpoint. Gentle concurrency (4, not 12) — a
    # burst from a datacenter IP is an instant 429; fetch_chart() also backs off.
    if not fetched:
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

    # Master NSE trading-day calendar from the CONSTITUENTS, not the benchmark.
    # ^CRSLDX (an index) has occasional NaN bars on Yahoo; using it as the calendar
    # silently dropped real trading days from the WHOLE chart (e.g. 26 Jun, when all
    # 47 stocks traded but ^CRSLDX was missing → a gap vs the source). Build the
    # calendar from the NSE names instead — a day counts only if a majority of them
    # have a bar (excludes stray single bars and the US names' NASDAQ-only dates) —
    # then forward-fill the benchmark onto it. >= anchor only, plus today.
    nse_tickers = [yf_ticker(c) for c in COMPANIES if c["exchange"] == "NSE"]
    _daycount = Counter()
    for tk in nse_tickers:
        for d, _ in fetched.get(tk, ({}, []))[1]:
            if d >= ANCHOR_DATE:
                _daycount[d] += 1
    _thresh = max(1, len(nse_tickers) // 2)
    calendar = sorted(d for d, n in _daycount.items() if n >= _thresh)
    if calendar and calendar[-1] < today_iso and n500_meta.get("regularMarketPrice"):
        calendar.append(today_iso)

    ff = {tk: ffill_on_calendar(fetched.get(tk, ({}, []))[1], calendar) for tk in tickers}

    # USD/INR up front — used to convert the USD names' (MMYT/FRSH) market cap to
    # INR for the table/sector weights, matching the source (which shows all caps in
    # INR mn). NOTE: this is display only; the index VALUE still sums USD prices as
    # INR (the documented model quirk), untouched.
    usdinr = fetch_usdinr()
    usd_to_inr = (usdinr or {}).get("value") or 90.0   # fallback rate if FX fetch fails

    # Table live fields (₹ mn mcap + NSE price/day): Screener → BSE → NASDAQ(Yahoo×FX).
    table_live = fetch_table_live(usd_to_inr)

    # ── Per-constituent live snapshot ──────────────────────────────────────
    constituents = []
    for c in COMPANIES:
        tk = yf_ticker(c)
        meta, series = fetched.get(tk, ({}, []))
        live = table_live.get(c["ticker"], {})
        # Prefer Screener/BSE (NSE) or StockAnalysis (MMYT/FRSH); else Yahoo.
        price = live.get("price")
        if price is None:
            price = meta.get("regularMarketPrice")
        if price is None and series:
            price = series[-1][1]
        # Official previous close from fast_info (matches the source's day change).
        # Fallback to the last daily close before today. (NOT meta.chartPreviousClose:
        # for a 2024-start range that's the pre-2024 close → the multi-year "+109%" day bug.)
        prev = meta.get("_prev")
        if prev is None and series:
            prev = series[-2][1] if (series[-1][0] >= today_iso and len(series) >= 2) else series[-1][1]
        daily = live.get("daily_pct")
        if daily is None:
            daily = (price / prev - 1) * 100 if price and prev else None
        ret_1m = ret_from_series(price, series, today_iso, days=30)
        ret_3m = ret_from_series(price, series, today_iso, days=90)
        ret_6m = ret_from_series(price, series, today_iso, days=180)
        ret_1y = ret_from_series(price, series, today_iso, days=365)
        ret_ytd = ret_from_series(price, series, today_iso, ytd=True)
        # "Since" = since base date for pre-2024 listers, else since listing day
        # (= earliest available close), matching the index base convention.
        since_base = series[0][1] if series else None
        since = (price / since_base - 1) * 100 if price and since_base else None
        sh = SHARE_DATA.get(tk, {})
        ccy = "INR" if c["exchange"] == "NSE" else "USD"
        mcap_mn = mcap_mn_inr(c, meta, price, sh, usd_to_inr, table_live=table_live)
        mcap_cr = (mcap_mn / 10.0) if mcap_mn is not None else None
        mcap_usd_mn = (mcap_mn / usd_to_inr) if mcap_mn is not None and usd_to_inr else None
        constituents.append({
            "num": c["num"], "name": c["name"], "ticker": c["ticker"],
            "slug": company_slug(c),
            "exchange": c["exchange"], "sector": c["sector"], "float_pct": c["float_pct"],
            "price": r2(price), "ccy": ccy,
            "daily_pct": r2(daily),
            "ret_1m": r2(ret_1m), "ret_3m": r2(ret_3m), "ret_6m": r2(ret_6m),
            "ret_1y": r2(ret_1y), "ret_ytd": r2(ret_ytd),
            "since_pct": r2(since),
            "mcap_mn": r2(mcap_mn, 1),       # ₹ millions
            "mcap_cr": r2(mcap_cr, 1),       # ₹ crores  (mn / 10)
            "mcap_usd_mn": r2(mcap_usd_mn, 1),  # USD millions
            "detail_url": f"/z47-forty-seven/{company_slug(c)}",
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

    # ── Movers by period (for Performance tabs 1M/3M/6M/YTD/1Y) ────────────
    PERIOD_RET_KEYS = {
        "1M": "ret_1m", "3M": "ret_3m", "6M": "ret_6m",
        "YTD": "ret_ytd", "1Y": "ret_1y",
    }

    def movers_for(ret_key: str):
        ranked = sorted(
            [c for c in constituents if c.get(ret_key) is not None],
            key=lambda c: c[ret_key], reverse=True,
        )
        mv = lambda c: {
            "name": c["name"], "ticker": c["ticker"], "sector": c["sector"],
            "slug": c["slug"], "detail_url": c["detail_url"],
            "ret": c[ret_key],
            # keep ret_1m key for backward-compatible page JS until tabs ship
            "ret_1m": c[ret_key],
        }
        return {
            "gainers": [mv(c) for c in ranked[:5]],
            "losers": [mv(c) for c in ranked[-5:][::-1]],
        }

    movers_by_period = {period: movers_for(key) for period, key in PERIOD_RET_KEYS.items()}
    movers = movers_by_period["1M"]  # default / backward compatible

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

    out = {
        "meta": {
            "generated_at": now_ist.isoformat(timespec="seconds"),
            "generated_at_ist": now_ist.strftime("%d %b %Y, %H:%M IST"),
            "market_open": market_open,
            "usdinr": usdinr,
            "base_date": BASE_DATE, "anchor_date": ANCHOR_DATE,
            "benchmark": "NIFTY 500",
            "constituents_priced": len(usable_f),
            "source": "Yahoo (index/history) + Screener/BSE (NSE live table) + StockAnalysis×FX (MMYT/FRSH)",
            "data_source_of_truth": "github.com/GirishZ47/z47-dashboard (16 Jun 2026 rebalance)",
            "methodology_flags": [
                "MMYT & FRSH summed in USD without FX conversion — existing model quirk.",
                "NSE table price/day/mcap from Screener (BSE fallback); NASDAQ live = StockAnalysis×USD/INR (Yahoo fallback).",
                "Mkt Cap emitted as mcap_mn (₹ mn), mcap_cr (₹ cr), mcap_usd_mn (USD mn).",
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
        "movers_by_period": movers_by_period,
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
    _dp = out['index']['daily_pct']
    _dp_s = f"{_dp:+}%" if _dp is not None else "n/a"
    print(f"Z47'47 = {out['index']['value']}  ({_dp_s} today)  "
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
