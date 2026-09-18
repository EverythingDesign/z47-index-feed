# Rentomojo replaces Medi Assist — 18 September 2026

The current 47-company index replaces MEDIASSIST with RENTOMOJO in slot 43.
Rentomojo is Consumer / Consumer Tech. Counts: Consumer 21, Fintech 11,
SaaS/AI 8, B2B 7. Unicommerce remains outside the index.

## Inputs and continuity

- Effective session: 2026-09-18, as requested by the user (“swap now”).
- Last pre-swap close: 2026-09-17; saved free-float index 141.599965,
  total-cap index 139.274314, taken from the repository history before this change.
- Rentomojo free-float shares: 11,635,261, from Yahoo Finance `floatShares`
  retrieved on 2026-09-18 (`yfinance.Ticker('RENTOMOJO.NS').get_info()`).
  This follows the source used by the existing model, not a new promoter-share proxy.
- Total shares: 104,115,791, the post-offer figure in the SEBI-hosted prospectus
  (subject to final basis of allotment as stated in the prospectus).
- Displayed free float: 11.18%; calculation uses the exact share counts.
- Source: https://www.sebi.gov.in/filings/public-issues/sep-2026/rentomojo-limited-prospectus_104482.html
- PDF: https://www.sebi.gov.in/sebi_data/attachdocs/sep-2026/1789448989389.pdf
- Company financials: https://www.screener.in/company/RENTOMOJO/
- Float input: https://finance.yahoo.com/quote/RENTOMOJO.NS/key-statistics/

`data/rebalances/2026-09-18.json` freezes 47 dated closing prices. Where Yahoo
omitted 17 September, the existing Screener chart JSON supplied that exact day's
close. Each price records its source. No stale 16 September close or later price
is used for the anchor. Frozen closes prevent provider revisions from changing
the divisor on later refreshes. All 704 historical rows through 17 September
are retained exactly. The pre-existing NASDAQ/FX calculation convention is unchanged.

## Data and UI

The workflow's root index builder and its legacy scripts copy are synchronized.
The company hero roster refreshes Rentomojo; the chart builder filters by the
active roster, so retained Medi Assist historical JSON is no longer refreshed.
Targeted hero refreshes retain the complete 47-name manifest.

Rentomojo has two trading days in its first chart refresh. Full-period returns
are null until enough history exists. The price table and movement bars display
N/A, retain the company link, and do not rank it as a zero or since-listing return.
Annual financials and available ratios come from Screener; unavailable shareholding
and quarterly data remain unavailable.

The sector and movement scripts preserve the current Designer embed implementations.
The old offline snapshots are refreshed from the new feed using
`python3 scripts/refresh_index_fallbacks.py`. Four replacement embeds are provided;
their loaders use the updated GitHub scripts. Historical monthly Insights copy
remains historical; the shared performance loader supplies live bound values.

## Verification

- Live data build: 47/47 priced; correct membership and 21/11/8/7 sector counts.
- Six new Python regression tests pass: membership, insufficient IPO history,
  retired company filtering, rebalance continuity, missing-anchor protection,
  and forward-fill without lookahead.
- Node chart regression passes: null row retained, N/A drawn, hover plugin retained,
  correct Rentomojo company-page destination.
- Browser preview of published p2 markup with replacement scripts: Performance,
  Insights, Constituents, sector/cap toggle and Rentomojo N/A row checked.
- Existing suite: 11/12 pass. The Ola Electric FY26 Expenses audit fixture expects
  3,225 while the current saved data contains 3,231. The same failure is present
  on the untouched baseline. This change does not alter that company or fixture.

## Webflow handoff

Site: 678518036ebf6d040622b6b3. Page: Z47 Index Page p2,
6a742988ea190d933b640206, slug `/z47-forty-seven`.

Replace complete contents of these existing HtmlEmbeds:

| Embed class | Element ID | File |
|---|---|---|
| chart-embed (hide) | 5be9a79e-26d0-579d-54f8-90a6ae6cd48f | staging/embeds/01-performance-embed.html |
| live-pricelist-embed (hide) | 4280decc-9e7d-40bf-f4c9-11ff184402a6 | staging/embeds/03-constituents-table-embed.html |
| sector-composition-canvas | 42acdaeb-21f5-43f1-5661-ac98eb534872 | staging/embeds/02-sector-pie-embed.html |
| constituents-embed | c818fcc8-b6f4-d86b-2034-164d8339922d | staging/embeds/04-one-month-bars-embed.html |

The user performs all Webflow edits and publishing. Publish Rentomojo's CMS item
and unpublish Medi Assist into draft; leave Unicommerce in draft. Verify enabled
locales. Keep the existing cap toggle, cap scripts, page header/footer code and
company template. The already prepared Rentomojo IPO Watch copy can remain.
