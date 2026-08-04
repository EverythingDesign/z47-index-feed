# Z47^fortyseven — Thursday Staging Pack

**Live page stays frozen:** https://www.z47.com/z47-forty-seven  
**Staging slug (create in Webflow):** `/z47-forty-seven-staging`  
**Feed:** same GitHub JSON once `build_z47_json.py` is pushed + workflow run

Webflow MCP was unavailable for automated page duplicate in this session — create the staging page manually (2 minutes), then swap custom code.

---

## Step 0 — Staging lock (Webflow Designer)

1. Open site → Pages → **Z47^fortyseven** (`z47-forty-seven`).
2. Duplicate page → rename **Z47^fortyseven (Staging)**.
3. Set slug to `z47-forty-seven-staging`.
4. Keep as **Draft** or publish **only** to Webflow subdomain / staging domain — **do not publish over live custom domain**.
5. On the staging page `<html>` or body, add attribute: `data-z47-staging` (or open with `?z47_staging=1`).
6. Confirm live `/z47-forty-seven` is untouched.

Staging URL (after publish to subdomain):  
`https://<webflow-subdomain>.webflow.io/z47-forty-seven-staging`

---

## Step 1 — Feed (done in repo)

[`build_z47_json.py`](../build_z47_json.py) now emits:

| Field | Source |
|-------|--------|
| NSE `price`, `daily_pct`, `mcap_*` | Screener → BSE fallback |
| MMYT/FRSH `mcap_*` | Yahoo × USD/INR |
| `mcap_mn`, `mcap_cr`, `mcap_usd_mn` | Dual display units |
| `ret_1m/3m/6m/1y/ytd` | Live price vs Yahoo history |
| `movers_by_period` | Gainers/losers per 1M/3M/6M/YTD/1Y |
| `slug`, `detail_url` | Stub links for Friday company pages |

Run locally:

```bash
python3 build_z47_json.py
```

Then push + GitHub Action **Refresh Z47'47 feed**.

---

## Step 2–6 — Paste staging custom code

Replace the four live embed scripts on the **staging page only** with files in [`staging/js/`](js/):

| Order | File | Pointer |
|-------|------|---------|
| 1 | `01-performance.js` | Return Summary period tabs (1M/3M/6M/YTD/1Y) + movers |
| 2 | `02-sector-pie.js` | Pie starts at 12 o’clock (radians fix) |
| 3 | `03-constituents-table.js` | Dual mcap `₹ Cr / $ Mn` + clickable names |
| 4 | `04-one-month-bars.js` | unchanged (month bars) |
| 5 | `05-thursday-overlay.js` | Hide Today/Prices/FX strip + Insights Read More |

Optional Webflow markup for period tabs (if you don’t want the JS-injected bar):

```html
<div data-z47="period-tabs">
  <button data-z47-period="1M">1M</button>
  <button data-z47-period="3M">3M</button>
  <button data-z47-period="6M">6M</button>
  <button data-z47-period="YTD">YTD</button>
  <button data-z47-period="1Y">1Y</button>
</div>
```

Optional dual-mcap header: set header text to `Mkt Cap (₹ Cr / $ Mn)` or use `data-z47-cell="mcap"`.

Company name links go to `/z47-forty-seven/company/{ticker}` (404 until Friday pages).

---

## Pointer 1 — Nav + hero (Designer)

1. On staging, replace page-only navbar with the **site-wide nav** component used on other z47.com pages.
2. Apply Madhavi’s approved hero one-liner (Wed design).
3. Hide/remove Index Today / Prices / USD block (overlay also hides `[data-z47=status-*]`).

---

## Pointer 3 — Move constituents table (Designer)

1. In staging, move the Constituents live-prices section into **Performance**, above the disclaimer.
2. Keep one table; dual mcap is filled by `03-constituents-table.js`.

---

## Pointer 8 — Read More URLs

Update real URLs in `05-thursday-overlay.js` → `NEWS_LINKS` (or set `data-z47-news="zepto|moneyview|razorpay"` on each card).

Current placeholders point at Moneycontrol IPO coverage — replace with Girish’s final links if different.

---

## Thursday QA checklist

- [ ] Live `/z47-forty-seven` unchanged  
- [ ] Staging loads new feed (`meta.source` mentions Screener)  
- [ ] Period tabs switch Z47 / Nifty / gainers / laggards  
- [ ] Table dual mcap matches Screener sample (Swiggy, FirstCry, MedPlus)  
- [ ] Company names are links (stub OK)  
- [ ] Sector pie centred at 12 o’clock  
- [ ] Three IPO Read More links open in new tab  
- [ ] Hero status strip gone on staging  

Share staging link with Madhavi/Girish after QA.
