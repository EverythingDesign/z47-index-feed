# Capped index (live from 30 Oct 2026)

The index owner approved the method on 26 Oct 2026. The history from 17 Jun 2026 is
restated on this basis; history up to 16 Jun is unchanged.

- Weighting is free-float market cap. Each constituent is capped at **10%**, and any
  excess is redistributed iteratively.
- The cap resets on the **first NSE session of every month** and at **every constituent
  change**, priced at the **previous session's close**. Between resets, weights drift
  with prices, so a constituent can sit above 10% until the next reset.
- `value_mcap` (total market cap) stays uncapped. Its units reset only so that
  constituent changes stay value-neutral.

## Files

| File | Role |
|---|---|
| `data/rebalances/cap-ledger.json` | Every reset with its frozen prices, USD/INR, share counts, weights and units. The last entry is the valuation basis. |
| `z47_history.csv` | Published history. Rows up to the last reset's `price_date` are never recomputed. |
| `monthly-takeaways.json` | Month-end figures for the Insights tab, rebuilt on every run. |
| `scripts/cap_ledger.py` | Reset rule, valuation, and the walk over sessions. |
| `scripts/migrate_cap_ledger.py` | One-time go-live migration from `data/cap-review/` (already applied). |

## What the scheduled build does

`build_z47_json.py --write-history` values every session after the last reset. On the
first session of a new month, or the first session on or after a constituent change's
`effective_date`, it adds a reset to the ledger. It then rewrites the CSV rows after
the last reset, and commits the CSV and the ledger together.

A monthly reset dated today is postponed while NIFTY 500's live price equals its
previous close, which is what an NSE holiday looks like. The next run then applies the
reset on the true first session of the month.

## Constituent change

1. Edit `COMPANIES` and `SHARE_DATA` in `build_z47_json.py` (keep `scripts/build_z47_json.py` identical).
2. Add the event to `constituent_events.json` with its `effective_date`.
3. If the company keeps its page, keep it in `scripts/build_company_hero.py` `COMPANIES`.

The next run resets at the previous session's close. If `COMPANIES` and the ledger
disagree without an event, the build fails and the last good feed stays up. A new
listing with no previous close can't be priced this way, so it needs a
hand-made ledger entry (see the 20 Aug 2026 entry).

## Quarterly free-float refresh

Update the `fs` counts in `SHARE_DATA`. They take effect at the next reset, which is the
next first-of-month. Earlier resets keep the counts they froze.
