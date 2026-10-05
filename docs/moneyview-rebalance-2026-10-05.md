# Moneyview rebalance — 5 October 2026

Moneyview replaces Awfis effective 5 October 2026, as instructed by the user. The index remains at 47 companies. Moneyview is Fintech / Financial Services: sector counts are Consumer 21, Financial Services 12, SaaS / AI 8, B2B 6.

## Valuation and continuity

The last published pre-change history row is 2 October 2026: free-float index 132.696481 and total-cap index 135.443643. These levels and all earlier history are preserved. The anchor is a saved snapshot date, not a claim that NSE traded on 2 October. Existing holdings use the last published snapshot prices and share counts from the existing INR methodology. Moneyview uses its last available pre-effective-date Screener chart close, 53.88 on 1 October. USD/INR is 96.3 from the saved feed. Frozen inputs are in `data/rebalances/2026-10-05-inr.json`.

New-basket valuation at the anchor maps exactly to the old published index levels; subsequent changes reflect the new basket. Currency methodology remains INR from 29 September. No historical Moneyview returns are invented. Existing market-cap classification thresholds remain unchanged.

Moneyview shares retrieved from Yahoo Finance MONEYVIEW.NS quote info on 5 October 2026: 142,535,580 float shares and 1,760,231,268 total shares; displayed float 8.10%. Exact counts are used for weighting. Company financial data is from https://www.screener.in/company/MONEYVIEW/consolidated/ .

Webflow CMS removal of Awfis is handled by the user. Historical Awfis company files are retained; its scheduled company refresh is removed. Performance and constituent tabs consume the root `z47_index.json` feed.
