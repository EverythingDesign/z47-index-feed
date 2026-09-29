# INR valuation and snapshot freshness — 29 September 2026

US holdings previously contributed dollar prices directly to an otherwise rupee-valued portfolio. From 29 September, both the free-float and total-cap index calculations convert USD holdings with dated USD/INR.

This is a prospective methodology correction, not a restatement of historical returns. All published history through 28 September remains unchanged. The frozen transition portfolio in `data/rebalances/2026-09-29-inr.json` uses the 28 September company-chart snapshots and the published main-feed FX snapshot. These are dated observations, not a claim that the US quotes were final closes. Each holding records its source-generation time. The free-float and total-cap levels at that exact portfolio are fixed to the previously published 136.689968 and 137.344142; prices and FX changes after the transition drive subsequent returns. The transition introduces no artificial index jump.

The frozen snapshot also records the current shares/units. A future constituent change must supply a new transition/rebalance configuration; a roster mismatch aborts rather than silently valuing the wrong basket. Invalid FX, missing FX history, or missing valuation prices abort before any feed write. The ordinary market-cap table no longer falls back to an invented USD/INR of 90.

The 10% constituent cap is not part of this change. The existing index remains uncapped. The user asked where that claim appears, rather than authorizing a new capped methodology.

The public page now describes scheduled snapshots, shows the full fetched date/time, and marks snapshots over two hours old. It does not promise that all underlying quotes share the fetch timestamp or that an open page streams data. The status re-evaluates every minute. Refreshing the page retrieves the latest available feed.

The workflow adds 22:15 UTC Monday–Friday (03:45 IST the next day), after the US close in both EST and EDT. It refreshes the index table plus company hero/chart data. Existing Indian-session schedules remain. GitHub/provider delays remain possible and are disclosed in the page copy.

August Insights financial content is intentionally unchanged. Separate authorized copy fixes correct Info Edge's listing year to 2006 and describe Atomberg's ₹450 crore fresh issue plus OFS of up to 76.5 million shares, with total size undisclosed.

Tests cover transition neutrality, FX affecting USD holdings only, proportional price moves, both index series, missing inputs, full-build history preservation, and retention of the last good output on FX failure. Existing Rentomojo-rebalance tests remain applicable before the transition date.
