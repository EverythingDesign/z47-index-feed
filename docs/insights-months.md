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

On selection, the newly visible month fades in and moves upward 8px over 260ms. Initial load has no animation. A new selection cancels the previous animation; reduced-motion preferences disable it. No delayed callbacks can restore a stale month.

Verified in isolated Chrome with the published four-month markup: switching, animation, rapid changes, reduced motion, accessible name/focus, and mobile fit. Desktop and mobile screenshots were visually inspected. Native popup keyboard selection could not be automated in headless macOS Chrome; the standard native select behavior is retained. Run `NODE_PATH=/tmp/z47-insights-test/node_modules node tests/test_insights_months_browser.cjs` with Playwright and Chrome installed.

Replace the previous complete Insights snippet in Webflow and publish. The styling update is not installed by a GitHub push.

The newest available month is labeled `September 2026 - Latest` (month/year update automatically). Older options retain their month/year only. The desktop control is widened to fit the label.
