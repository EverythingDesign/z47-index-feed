# Monthly Insights selector

Install `staging/embeds/09-insights-months-embed.html` once by appending it to the Index page's **Before </body>** custom code. Preserve existing scripts. Publish staging and verify before publishing production.

The published structure inspected on 6 October 2026 contains an empty `.insights-tab-dropdown` and one September 2026 `.tab-pane-wrapper` inside `.insights-tab-wrap`. The selector therefore initially offers September only. No historical content is generated or invented.

For each month, add a unique attribute to the individual monthly section (currently `.tab-pane-wrap.monthly-insights` inside the shared `.tab-pane-wrapper`) such as `data-insights-month="2026-09"` or `data-insights-month="2026-08"`. Keep the newest section visible in Designer and apply `.hide` to older sections to avoid showing all months before JavaScript initializes. Use a four-digit year and two-digit month. If the attribute is absent, the first heading can identify the month (for example `MONTHLY TAKEAWAY · SEP 2026`). An explicitly invalid attribute or duplicate month prevents initialization and leaves authored content untouched.

The script creates an accessible native select, sorts months newest first, selects the newest available snapshot, and switches visibility without requests or reloads. It does not change any snapshot text or financial values. It does not modify Performance or Constituents. When adding a month, remove live `data-z47` bindings from copied Insights figures so live scripts cannot overwrite editorial snapshots.

Source: `staging/js/09-insights-months.js`. The install embed includes an identical inline copy plus scoped CSS; no CDN pin is required. Keep those copies synchronized when editing.

Validation: `NODE_PATH=/tmp/z47-insights-test/node_modules node tests/test_insights_months.cjs /tmp/z47-insights-current.html` (jsdom installed separately). Tests cover the published HTML and synthetic archive cases. Browser visual, keyboard, and mobile verification remains necessary after Webflow installation.

Webflow installation was not performed: the connector rejected `get_page_script` under workspace tool constraints. GitHub and local files alone do not publish this feature.

## Nested sections correction

The later published page includes September, August, July, and June inside one shared `.tab-pane-wrapper`. Explicit `[data-insights-month]` sections now take precedence over the legacy wrapper fallback. Verified switching each of the four months against that published markup. Replace the previously installed snippet; do not append a second copy.

## Dropdown styling and motion

The control uses a cream background, orange left edge and SVG chevron, hover/focus states, and full width on small screens. The options popup remains the native browser/OS picker. CSS source is `staging/css/09-insights-months.css`; both CSS and JS are included in the install embed.

On selection, the current month fades out and moves upward 6px over 160ms. Then the selected month fades in from 10px below over 380ms, while the shared monthly container smoothly adjusts its height. Initial load has no animation. New selections cancel the prior sequence, and revision checks prevent stale content from returning. Reduced-motion preferences disable the sequence. Temporary height animations and overflow styles are cleaned up after completion or interruption.

Verified in isolated Chrome with the published four-month markup: switching, outgoing/incoming animation, container height animation and cleanup, rapid changes, reduced motion, accessible name/focus, and mobile fit. Desktop and mobile screenshots were visually inspected. Native popup keyboard selection could not be automated in headless macOS Chrome; the standard native select behavior is retained. Run `NODE_PATH=/tmp/z47-insights-test/node_modules node tests/test_insights_months_browser.cjs` with Playwright and Chrome installed.

Replace the previous complete Insights snippet in Webflow and publish. The styling update is not installed by a GitHub push.

The newest available month is labeled `September 2026 - Latest` (month/year update automatically). Older options retain their month/year only. The desktop control is widened to fit the label.

Removed the dark offset focus outline from the month selector. Focus uses an orange border; keyboard focus adds a darker orange border and cream highlight.

## Shared sticky heading and month selector

The snippet builds one toolbar from the existing monthly heading markup and moves the existing dropdown slot into it. The current month title appears on the left, with the selector aligned to the right container edge. At narrow widths they stack, with a full-width selector. Original monthly headers remain in the document but are hidden once the shared toolbar is successfully created. Month content and attributes remain unchanged in Webflow.

The toolbar stays outside the animated monthly container. It updates when the selected month becomes visible and sticks immediately beneath the existing desktop tab navigation or mobile tab dropdown. It stops at the end of the Insights wrapper and disappears when another top-level tab is selected. The site's main navigation is not changed; any fixed/sticky occupied navigation height is included in offsets.

ResizeObserver and scroll/resize measurements maintain the offsets. The Webflow tab content's overflow is visible only while Insights is active, allowing native sticky positioning. The existing mobile tab menu's negative layout compensation is recalculated on resize to avoid a blank gap, and both tab controls receive appropriate stacking order. No new attributes or manual Designer restructuring is required.

Browser validation against staging covered desktop right alignment, sticky stacking, switching months while scrolled, outgoing/incoming animations, height cleanup, end-of-section release, responsive fit, a fresh mobile load, the mobile tab menu, and switching to Constituents. Preview screenshots show candidate code in an isolated browser, not published changes. Replace the previous complete snippet in Page Settings > Before </body> and publish staging to install it.

## Preserve spacing in other tabs

The initial sticky version overrode the shared desktop content margin to zero across all tabs, removing Webflow's authored 24px gap above Performance, Constituents, and Methodology. The desktop override now applies only while Insights is active. Mobile retains the existing collapsed-menu compensation across tabs. On a mobile-to-desktop resize, the legacy mobile script's negative inline margin is removed so the authored desktop spacing can apply. Regression checks cover all four tabs, returning from Insights, and viewport changes.
