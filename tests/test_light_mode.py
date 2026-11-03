"""Market-hours runs (--light) value the table from Yahoo prices without calling Screener."""
import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import build_z47_json as feed

PREV = {
    "meta": {"usdinr": {"value": 90.0}},
    "constituents": [
        {"ticker": "ETERNAL", "price": 344.0, "mcap_mn": 3319720.0},
        {"ticker": "MMYT", "price": 100.0, "mcap_mn": 900000.0},
        {"ticker": "SWIGGY", "price": None, "mcap_mn": 800000.0},
    ],
}


def company(ticker):
    return next(c for c in feed.COMPANIES if c["ticker"] == ticker)


class CarriedTableTests(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.dir)
        self.prev = self.dir / "z47_index.json"
        self.prev.write_text(json.dumps(PREV))
        self.pages = self.dir / "companies"
        self.pages.mkdir()

    def carried(self, fetched, fx=90.0):
        with mock.patch.object(feed, "screener_quote") as screener, mock.patch.object(feed, "bse_quote") as bse:
            out = feed.carried_table_live(fetched, fx, prev_path=str(self.prev), companies_dir=str(self.pages))
        screener.assert_not_called()
        bse.assert_not_called()
        return out

    def test_mcap_moves_with_the_yahoo_price(self):
        fetched = {feed.yf_ticker(company("ETERNAL")): ({"regularMarketPrice": 361.2}, [])}
        row = self.carried(fetched)["ETERNAL"]
        self.assertAlmostEqual(row["mcap_mn"], 3319720.0 * 361.2 / 344.0)
        # Price and day % are left to Yahoo in main().
        self.assertIsNone(row["price"])
        self.assertIsNone(row["daily_pct"])

    def test_nse_shares_come_from_the_company_page_first(self):
        # The company page holds Screener's logged-in figures; the last feed may hold a Yahoo fallback.
        (self.pages / "eternal.json").write_text(json.dumps({"price": 340.0, "mcap_cr": 328000.0}))
        fetched = {feed.yf_ticker(company("ETERNAL")): ({"regularMarketPrice": 361.2}, [])}
        row = self.carried(fetched)["ETERNAL"]
        self.assertAlmostEqual(row["mcap_mn"], 3280000.0 * 361.2 / 340.0)
        self.assertEqual(row["source"], "Yahoo price × company page shares")

    def test_nasdaq_mcap_follows_the_dollar_too(self):
        fetched = {feed.yf_ticker(company("MMYT")): ({"regularMarketPrice": 110.0}, [])}
        row = self.carried(fetched, fx=92.0)["MMYT"]
        self.assertAlmostEqual(row["mcap_mn"], 900000.0 * 1.10 * 92.0 / 90.0)

    def test_falls_back_to_the_last_close_and_skips_what_it_cannot_value(self):
        fetched = {feed.yf_ticker(company("ETERNAL")): ({}, [("2026-11-02", 350.0)])}
        out = self.carried(fetched)
        self.assertAlmostEqual(out["ETERNAL"]["mcap_mn"], 3319720.0 * 350.0 / 344.0)
        self.assertNotIn("SWIGGY", out)  # no Yahoo price now (and none in the last feed)
        self.assertNotIn("MMYT", out)    # no Yahoo price now

    def test_no_previous_feed_or_pages(self):
        fetched = {feed.yf_ticker(company("ETERNAL")): ({"regularMarketPrice": 361.2}, [])}
        out = feed.carried_table_live(fetched, 90.0, prev_path=str(self.dir / "missing.json"),
                                      companies_dir=str(self.dir / "missing"))
        self.assertEqual(out, {})


if __name__ == "__main__":
    unittest.main()
