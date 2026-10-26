# Z47 staging handoff — 26 October 2026

The staged feed is `data/cap-review/staging-feed.json`. It includes the proposed
Turtlemint → Zetwerk swap effective 26 October, classified as B2B, and a capped
restatement beginning 17 June. The production feed and scheduled builder are
unchanged. This is a frozen review dataset, not an automatically refreshed feed.

**The calculation is provisional.** The quarterly free-float share refresh basis
has not been confirmed. It uses the historical share counts
saved with each constituent swap. The index owner must confirm that basis or supply dated
quarterly inputs before these figures become official.

## Numbers supplied

- Staged index snapshot, 26 October: **126.674606** (display: **126.7**).
- Observed uncapped feed at the comparison snapshot: **131.25**.
- The review document's approximately 130.0 for 21 October was illustrative.
  This reconstruction gives **129.221751** for that date under the assumptions below.
- `data/cap-review/monthly-takeaways.csv` contains June–September completed
  monthly results and October month-to-date results, with explicit start/end dates.
- `data/cap-review/corrected-history.csv` contains the restated series.
- `data/cap-review/rebalance-weights.json` records the shares, exact weights,
  valuation dates and continuity levels at every reset.
- `data/cap-review/uncapped-replay-validation.json` compares a control replay to
  published history. Its largest difference is **0.059471 points**; 23 October
  differs by **0.013864 points**. No fitted offset was applied to the capped series.

26 October is an intraday observation. The source feed was generated at
12:44 IST. Historical price inputs and their retrieval times are frozen in
`inputs.json`; the different source requests are not an exchange-synchronised tick.

## Calculation conventions

1. History through 16 June is preserved exactly. The June close initializes
   capped portfolio units. Every later daily level values those fixed units.
2. Iterative 10% caps apply at quarterly and constituent-change resets. Excess
   weight is redistributed proportionally and any newly over-limit name is capped
   in turn. Between resets, weights drift; a weight above 10% is not automatically an error.
3. Quarterly resets: 1 July and 1 October, using previous available NSE closes.
4. The 20 August IPO swap uses the 20 August close, consistent with its saved
   event record. The new stocks have no traded 19 August close. This differs from
   the review text's generalisation that all swaps use the previous close.
5. Rentomojo, Moneyview and Zetwerk use previous available NSE closes. The
   Moneyview pricing date is 1 October; 2 October was not an NSE trading session.
6. The existing currency transition is retained: legacy mixed-currency treatment
   through 28 September, then dated USD/INR valuations from 29 September with a
   value-neutral scale adjustment. The currency transition is not a cap reset.
7. Staging uses the recorded share counts at quarterly resets. No historical
   float updates are invented. The secondary total-market-cap series is unavailable
   in this review feed because its methodology decision is still outstanding.
8. Monthly returns use the previous month-end close through the selected month-end
   close. October is explicitly month to date. This also corrects the earlier
   August first-trading-day comparison convention. Index and benchmark use the same dates.
9. The staged 26 October Zetwerk swap is value-neutral at the 23 October close.
   Yahoo reports 132,050,134 float shares and 1,694,254,778 total shares; these are
   retrieval-date inputs and should be checked by the index owner before publication.
10. Zetwerk has only two available price sessions in the retrieved sources.
    1M/3M/6M/1Y/YTD returns remain unavailable. No missing period is displayed as zero.

The active basket remains 47 names: Consumer 21, Financial Services 11,
SaaS/AI 8, B2B 7. Composition counts, market-cap shares and actual capped index
weights remain separate quantities in the feed.

## Zetwerk: exact Webflow CMS entry

The live **Screener Companies** schema was read on 26 October. Create a new
item with these values; Zetwerk does not currently exist in this collection.

| CMS field | Value |
|---|---|
| Name | Zetwerk |
| Slug | zetwerk |
| Company Name | Zetwerk |
| Ticker | ZETWERK |
| Exchange | NSE |
| Website Link | https://www.zetwerk.com/ |
| Bulk and Block Trades | Leave empty until there is verified trade commentary |
| Bulk and Block trades Switch | Off |
| About | Zetwerk is a technology-enabled B2B manufacturing company that combines a network of suppliers with its own manufacturing facilities. It serves customers in energy, electronics, capital goods, aerospace and defence in India and international markets. |

**There is no sector, logo, Screener URL or financial-metrics field in this
collection. No new CMS fields are needed.** B2B and the consolidated Screener
source are configured in the data feed. The data files for the company page are
`data/companies/zetwerk.json` and `data/companies/zetwerk-chart.json`.

The resulting URL is `/z47-forty-seven/zetwerk`. Keep Turtlemint's existing
record while reviewing the swap; avoid renaming its historical company page to
Zetwerk. Its old URL can continue to support historical links even when the
current index feed no longer includes it.

Sources: https://www.screener.in/company/ZETWERK/consolidated/ and Yahoo Finance
`ZETWERK.NS`. The official website fallback is saved because the Screener parser
did not return a direct company-website URL.

## Staging links and loading mask

1. Put `staging/embeds/00-STAGING-HEAD.html` in the staging page's
   **Head code**. It must load before body markup to prevent the first-frame flash.
   It includes the numeric mask and review-branch feed URLs. For the mask alone,
   `00-numeric-loading-HEAD.html` has no staging URL configuration.
2. The head snippet sets `window.Z47_FEED_URL`, `window.Z47_MONTHLY_URL` and
   `window.__Z47_FEED_BASE` to this review branch. Change those if hosting elsewhere.
3. Update the script URLs to the versions in this branch: `01-performance.js`,
   `03-constituents-table.js`, and any sector/cap/month-bars scripts in use.
   They all honour `window.Z47_FEED_URL`. Old pinned scripts do not.
4. Use this branch's `04-company-page.js` and point the company-page data base URL at this review branch to preview Zetwerk's
   generated company files. Publishing the CMS item alone cannot create those feeds.
5. Add `staging/js/10-insights-numbers.js` after the existing Insights script.
   It fills the monthly cards and index-return paragraphs from the dated monthly
   data, updates dates, and hides the duplicate August monthly-return sentence.
   The CSV is the matching review sheet. Other editorial/fundamental claims remain
   as authored and are outside this index-weight calculation.

The mask covers all four summary cards, chart/hero percentages, return-summary
cells and the FX time. Placeholders stay hidden until each value is written from
validated data. A failed request or missing performance script produces an em dash,
not `129.1`, `+3.0%`, `NaN` or an invented zero. The chart keeps its existing
loading/error message. The benchmark difference is labelled in percentage points.

## Verification

Twelve Python tests cover cap redistribution, a second name reaching the cap,
value continuity, drift, FX effects, input failures, basket counts, preserved
history, missing IPO return periods, monthly arithmetic and the uncapped control.
Node tests check actual performance initialization and numeric loading states.
The public page's real markup was tested locally with a delayed response, a valid
response, and HTTP 503. All 20 card/return-summary values show em dashes on failure.

Reproduce the offline calculations:

```sh
python3 scripts/build_cap_review.py --validate-uncapped
python3 scripts/build_cap_review.py
python3 scripts/refresh_index_fallbacks.py --feed data/cap-review/staging-feed.json
python3 -m unittest discover -s tests -p 'test_cap*.py'
node tests/test_numeric_loading.cjs
node tests/test_performance_loader.cjs
```

This review branch is not ready to merge into the production workflow. After
the index owner settles the historical share basis and secondary-index choice, the approved
rebalance snapshots and recurrence rules must be wired into the scheduled builder,
and the staged restatement reviewed before replacing published history.
