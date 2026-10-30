"""A Screener refusal (HTTP 429) must not blank a company page that had figures."""
import contextlib
import io
import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_company_hero as hero

FIXTURES = ROOT / "tests" / "fixtures" / "company-429"
# Real records: Zetwerk on 26 Oct 2026 (good) and after the 30 Oct 10:29 IST run (Screener 429).
GOOD = json.loads((FIXTURES / "zetwerk-good.json").read_text())
BLANK = json.loads((FIXTURES / "zetwerk-blank.json").read_text())


class RetainLastGoodTests(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.dir)
        self.path = self.dir / "zetwerk.json"

    def saved(self, record):
        self.path.write_text(json.dumps(record))

    def test_refusal_keeps_the_last_good_figures(self):
        self.saved(GOOD)
        row = hero.retain_last_good(BLANK, self.path)
        self.assertEqual((row["price"], row["mcap_cr"], row["ratios_ok"]), (141.0, 23923.0, 5))
        self.assertEqual(row["pl"], GOOD["pl"])
        # The page's "as of" date stays the date of the figures, not the failed attempt.
        self.assertEqual(row["generated_at_ist"], "26 Oct 2026, 12:44 IST")
        self.assertEqual(row["refresh_status"], "cached")
        self.assertEqual(row["refresh_error"], "HTTP Error 429: Too Many Requests")
        self.assertEqual(row["last_attempt_at"], BLANK["generated_at"])

    def test_a_good_refresh_replaces_a_kept_record(self):
        self.saved({**GOOD, "refresh_status": "cached", "refresh_error": "HTTP Error 429: Too Many Requests"})
        fresh = {**GOOD, "price": 160.75, "generated_at_ist": "30 Oct 2026, 16:20 IST"}
        row = hero.retain_last_good(fresh, self.path)
        self.assertIs(row, fresh)
        self.assertNotIn("refresh_error", row)

    def test_nothing_to_keep(self):
        self.assertIs(hero.retain_last_good(BLANK, self.path), BLANK)  # no file yet
        self.saved(BLANK)
        self.assertIs(hero.retain_last_good(BLANK, self.path), BLANK)  # file is blank too

    def test_repeated_refusals_keep_the_same_figures(self):
        self.saved(GOOD)
        once = hero.retain_last_good(BLANK, self.path)
        self.saved(once)
        twice = hero.retain_last_good({**BLANK, "generated_at": "2026-10-31T03:50:00+05:30"}, self.path)
        self.assertEqual(twice["price"], 141.0)
        self.assertEqual(twice["last_attempt_at"], "2026-10-31T03:50:00+05:30")

    def test_blank_detection(self):
        self.assertTrue(hero.refresh_failed(BLANK))
        self.assertFalse(hero.refresh_failed(GOOD))
        self.assertTrue(hero.refresh_failed({"ratios_ok": 0, "price": None}))
        self.assertFalse(hero.refresh_failed({"ratios_ok": 2, "price": 100.0}))  # thin, not blank


class FullRunTests(unittest.TestCase):
    def test_a_refused_company_keeps_its_page_and_is_flagged_in_the_index(self):
        out = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, out)
        (out / "zetwerk.json").write_text(json.dumps(GOOD))
        zetwerk = [c for c in hero.COMPANIES if c["ticker"] == "ZETWERK"]
        with mock.patch.object(hero, "OUT_DIR", out), mock.patch.object(hero, "COMPANIES", zetwerk), \
             mock.patch.object(hero, "scrape_company", return_value=dict(BLANK)), mock.patch.object(hero.time, "sleep"), \
             mock.patch.object(sys, "argv", ["build_company_hero.py"]), contextlib.redirect_stdout(io.StringIO()):
            hero.main()
        page = json.loads((out / "zetwerk.json").read_text())
        self.assertEqual(page["price"], 141.0)
        index = json.loads((out / "_index.json").read_text())
        entry = index["companies"][0]
        self.assertEqual((entry["ratios_ok"], entry["refresh_error"]), (5, "HTTP Error 429: Too Many Requests"))
        self.assertEqual(entry["generated_at_ist"], "26 Oct 2026, 12:44 IST")


if __name__ == "__main__":
    unittest.main()
