import contextlib
import csv
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from datetime import datetime

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
sys.path.insert(0, str(ROOT))
import build_z47_json as feed
import build_company_hero as hero
import build_company_chart as chart


class RebalanceTests(unittest.TestCase):
    def test_anchor_uses_earlier_close_without_lookahead(self):
        self.assertEqual(feed.ffill_on_calendar([('2026-09-16', 100), ('2026-09-18', 110)], ['2026-09-17', '2026-09-18']), {'2026-09-17': 100, '2026-09-18': 110})
        self.assertEqual(feed.ffill_on_calendar([('2026-09-18', 110)], ['2026-09-17']), {})

    def test_rosters_agree_and_keep_47(self):
        tickers = {c['ticker'] for c in feed.COMPANIES}
        self.assertEqual(len(tickers), 47)
        self.assertEqual(tickers, {c['ticker'] for c in hero.COMPANIES})
        self.assertIn('RENTOMOJO', tickers)
        self.assertNotIn('MEDIASSIST', tickers)
        self.assertNotIn('UNIECOM', tickers)
        counts = {s: sum(c['sector'] == s for c in feed.COMPANIES) for s in feed.SECTOR_ORDER}
        self.assertEqual(sorted(counts.values()), [7, 8, 11, 21])

    def test_new_listing_has_no_full_period_return(self):
        series = [('2026-09-17', 500), ('2026-09-18', 525)]
        for days in [30, 90, 180, 365]:
            self.assertIsNone(feed.ret_from_series(525, series, '2026-09-18', days=days))
        self.assertIsNone(feed.ret_from_series(525, series, '2026-09-18', ytd=True))
        self.assertAlmostEqual(feed.ret_from_series(525, [('2026-08-01', 480), ('2026-08-19', 500)], '2026-09-18', days=30), 5)

    def test_retired_company_not_refreshed(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(chart, 'OUT_DIR', Path(tmp)):
            for ticker in ['RENTOMOJO', 'MEDIASSIST', 'UNIECOM']:
                (Path(tmp) / f'{ticker.lower()}.json').write_text(json.dumps({'ticker': ticker}))
            self.assertEqual([x['ticker'] for x in chart.load_company_meta()], ['RENTOMOJO'])

    def run_build(self, missing_anchor=False):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        out, hist = Path(tmp.name) / 'out.json', Path(tmp.name) / 'history.csv'
        original = 'date,z47_float,z47_mcap,n500_indexed,n500_abs\n2026-09-16,140,138,115,22331.16\n2026-09-17,141.599965,139.274314,116.6659,22654.65\n'
        hist.write_text(original)
        out.write_text('{"last_good":true}')
        series = [('2026-01-01', 90), ('2026-09-17', 100), ('2026-09-18', 110)]
        fetched = {feed.yf_ticker(c): ({'regularMarketPrice': 110, '_prev': 100}, series) for c in feed.COMPANIES}
        fetched[feed.N500_YF] = ({'regularMarketPrice': 23000}, [('2026-09-17', 22654.65), ('2026-09-18', 23000)])
        anchor = Path(tmp.name) / 'anchor.json'
        prices = {tk: {'price': 100} for tk in fetched if tk != feed.N500_YF}
        if missing_anchor:
            prices.pop('RENTOMOJO.NS')
        anchor.write_text(json.dumps({'anchor_date': '2026-09-17', 'prices': prices}))
        if missing_anchor:
            fetched['RENTOMOJO.NS'] = ({'regularMarketPrice': 110}, [('2026-09-18', 110)])
        class Clock(datetime):
            @classmethod
            def now(cls, tz=None):
                return cls(2026, 9, 18, 16, 15, tzinfo=tz)
        with patch.multiple(feed, HIST_CSV=str(hist), OUT_JSON=str(out), REBALANCE_PRICE_FILE=str(anchor), USE_YF=True, datetime=Clock), \
             patch.object(feed, 'fetch_all_yf', return_value=fetched), \
             patch.object(feed, 'fetch_table_live', return_value={}), \
             patch.object(feed, 'fetch_usdinr', return_value={'value': 90}), \
             patch.object(sys, 'argv', ['build_z47_json.py', '--write-history']), \
             contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            if missing_anchor:
                with self.assertRaisesRegex(RuntimeError, 'Incomplete rebalance'):
                    feed.main()
                self.assertEqual(json.loads(out.read_text()), {'last_good': True})
                self.assertEqual(hist.read_text(), original)
                return
            feed.main()
        result = json.loads(out.read_text())
        self.assertEqual(result['meta']['constituents_priced'], 47)
        self.assertEqual(result['index']['value'], round(141.599965 * 1.1, 2))
        self.assertEqual(result['index']['value_mcap'], round(139.274314 * 1.1, 2))
        self.assertEqual(result['index']['daily_pct'], 10)
        # The saved pre-swap close survives byte-for-byte, including its precision.
        self.assertTrue(hist.read_text().startswith(original))

    def test_value_neutral_anchor_and_preserved_history(self):
        self.run_build()

    def test_missing_ipo_anchor_never_publishes_46_name_index(self):
        self.run_build(missing_anchor=True)


if __name__ == '__main__':
    unittest.main()
