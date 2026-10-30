import contextlib
import csv
import io
import json
import sys
import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
sys.path.insert(0, str(ROOT))
import cap_ledger
import build_z47_json as feed

CALENDAR = ['2026-10-23', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30',
            '2026-11-02', '2026-11-03', '2026-11-04', '2026-12-01', '2026-12-02']


def toy_base(price_date='2026-10-23', effective_date='2026-10-26'):
    holdings = {'BIG.NS': {'currency': 'INR', 'fs': 400, 'ts': 500}, 'US': {'currency': 'USD', 'fs': 2, 'ts': 4},
                **{f'S{i}.NS': {'currency': 'INR', 'fs': 10, 'ts': 20} for i in range(10)}}
    prices = {t: 10.0 for t in holdings}
    return cap_ledger.make_reset(effective_date, price_date, 'test', 120.0, 130.0, holdings, prices, 90.0), holdings


class DueResetTests(unittest.TestCase):
    def test_first_session_of_each_later_month(self):
        self.assertEqual(cap_ledger.due_resets('2026-10-26', CALENDAR, []),
                         [('2026-11-02', 'Monthly reset'), ('2026-12-01', 'Monthly reset')])

    def test_no_second_reset_in_the_month_of_the_last_one(self):
        self.assertEqual(cap_ledger.due_resets('2026-11-02', CALENDAR, []), [('2026-12-01', 'Monthly reset')])

    def test_constituent_change_on_a_holiday_moves_to_next_session(self):
        due = cap_ledger.due_resets('2026-10-26', CALENDAR, ['2026-10-26', '2026-10-31', '2026-11-03'])
        self.assertEqual(due, [('2026-11-02', 'Monthly reset + Constituent change'),
                               ('2026-11-03', 'Constituent change'), ('2026-12-01', 'Monthly reset')])


class WalkTests(unittest.TestCase):
    def setUp(self):
        self.base, self.holdings = toy_base()
        self.prices = {d: {t: 10.0 for t in self.holdings} for d in CALENDAR}
        for day in ['2026-10-30', '2026-11-02']:
            self.prices[day]['BIG.NS'] = 12.0
        self.prices['2026-11-03']['BIG.NS'] = 13.0

    def run_walk(self, deferred=()):
        due = dict(cap_ledger.due_resets(self.base['effective_date'], CALENDAR[:9], []))
        return cap_ledger.walk(self.base, CALENDAR[:9], due, self.prices.__getitem__, lambda d: 90.0,
                               lambda entry, kind: self.holdings, deferred)

    def test_reset_caps_and_preserves_level(self):
        self.assertAlmostEqual(self.base['max_weight'], 0.10)
        entry, resets, values = self.run_walk()
        self.assertEqual([r['effective_date'] for r in resets], ['2026-11-02'])
        self.assertEqual(entry['price_date'], '2026-10-30')
        self.assertAlmostEqual(entry['level_fs'], values['2026-10-30'][0])
        self.assertAlmostEqual(entry['level_ts'], values['2026-10-30'][1])
        self.assertAlmostEqual(values['2026-11-02'][0], values['2026-10-30'][0])
        self.assertAlmostEqual(entry['max_weight'], 0.10)
        drifted = cap_ledger.weights(self.base, self.prices['2026-10-30'], 90.0)
        self.assertGreater(drifted['BIG.NS'], 0.10)

    def test_total_mcap_series_is_uncapped(self):
        entry, _, _ = self.run_walk()
        inr = {t: 10.0 * (90.0 if h['currency'] == 'USD' else 1) * h['ts'] for t, h in self.holdings.items()}
        units = {t: entry['holdings'][t]['units_ts'] for t in inr}
        self.assertAlmostEqual(units['BIG.NS'] / units['S0.NS'], 500 / 20)

    def test_deferred_reset_waits_and_values_continue(self):
        entry, resets, values = self.run_walk(deferred=('2026-11-02',))
        self.assertEqual(resets, [])
        self.assertIs(entry, self.base)
        self.assertEqual(len(values), 8)


class LiveLedgerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ledger = cap_ledger.load(ROOT / 'data' / 'rebalances' / 'cap-ledger.json')
        cls.history = {r['date']: r for r in csv.DictReader((ROOT / 'z47_history.csv').read_text().splitlines())}

    def test_every_reset_is_capped_and_matches_published_history(self):
        for entry in self.ledger:
            self.assertLessEqual(entry['max_weight'], 0.10 + 1e-12)
            self.assertAlmostEqual(float(self.history[entry['price_date']]['z47_float']), entry['level_fs'], places=5)

    def test_staged_26_october_snapshot_replays(self):
        inputs = json.loads((ROOT / 'data' / 'cap-review' / 'inputs.json').read_text())
        last = self.ledger[-1]
        on_or_before = lambda series: series[max(d for d in series if d <= '2026-10-26')]
        prices = {t: on_or_before(inputs['prices'][t.replace('.NS', '')]) for t in last['holdings']}
        level = cap_ledger.level(last, prices, inputs['prices']['USDINR=X']['2026-10-26'], 'fs')
        self.assertAlmostEqual(level, 126.621265, places=6)

    def test_roster_and_shares_match_the_builder(self):
        source = (ROOT / 'build_z47_json.py').read_text()
        last = self.ledger[-1]
        self.assertIn('ZETWERK.NS', last['holdings'])
        self.assertNotIn('TURTLEMINT.NS', last['holdings'])
        for ticker, holding in last['holdings'].items():
            self.assertIn(f'"{ticker}":{{"fs":{holding["fs"]},"ts":{holding["ts"]}}}', source)

    def test_history_before_restatement_is_unchanged(self):
        observed = json.loads((ROOT / 'data' / 'cap-review' / 'observed-feed.json').read_text())
        for row in observed['history']:
            if row['date'] <= '2026-06-16':
                self.assertAlmostEqual(float(self.history[row['date']]['z47_float']), row['z47'], places=6)


class BuildTests(unittest.TestCase):
    """Full offline builds across the 2 Nov monthly reset."""

    def build(self, now, prices, n500_prev=None):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.dir = Path(tmp.name)
        holdings = {feed.yf_ticker(c): {'currency': 'INR' if c['exchange'] == 'NSE' else 'USD',
                                        **feed.SHARE_DATA[feed.yf_ticker(c)]} for c in feed.COMPANIES}
        base = cap_ledger.make_reset('2026-10-26', '2026-10-23', 'test', 125.0, 130.0, holdings,
                                     {tk: 100.0 for tk in holdings}, 90.0)
        cap_ledger.save(self.dir / 'ledger.json', [base])
        (self.dir / 'history.csv').write_text('date,z47_float,z47_mcap,n500_indexed,n500_abs\n'
                                              '2026-09-30,130,131,112,21749\n2026-10-23,125.0,130.0,110,21360\n')
        days = sorted(prices)
        fetched = {tk: ({'regularMarketPrice': prices[days[-1]].get(tk, 100.0), '_prev': 100.0},
                        [(d, prices[d].get(tk, 100.0)) for d in days]) for tk in holdings}
        fetched[feed.N500_YF] = ({'regularMarketPrice': 21500.0, '_prev': n500_prev},
                                 [(d, 21500.0) for d in days])
        fetched['INR=X'] = ({}, [(d, 90.0) for d in days])

        class Clock(datetime):
            @classmethod
            def now(cls, tz=None):
                return cls(*now, tzinfo=tz)
        with patch.multiple(feed, HIST_CSV=str(self.dir / 'history.csv'), OUT_JSON=str(self.dir / 'out.json'),
                            CAP_LEDGER=str(self.dir / 'ledger.json'), MONTHLY_JSON=str(self.dir / 'monthly.json'),
                            EVENTS_JSON=str(self.dir / 'events.json'), USE_YF=True, datetime=Clock), \
             patch.object(feed, 'fetch_all_yf', return_value=fetched), \
             patch.object(feed, 'fetch_table_live', return_value={}), \
             patch.object(feed, 'fetch_usdinr', return_value={'value': 90.0}), \
             patch.object(sys, 'argv', ['build_z47_json.py', '--write-history']), \
             contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            feed.main()
        return (json.loads((self.dir / 'out.json').read_text()), cap_ledger.load(self.dir / 'ledger.json'),
                list(csv.DictReader((self.dir / 'history.csv').read_text().splitlines())))

    def test_first_session_of_month_resets_at_previous_close(self):
        surge = {'ETERNAL.NS': 130.0}
        prices = {'2026-10-23': {}, '2026-10-30': surge, '2026-11-02': surge}
        out, ledger, rows = self.build((2026, 11, 2, 16, 15), prices, n500_prev=21400.0)
        self.assertEqual([e['effective_date'] for e in ledger], ['2026-10-26', '2026-11-02'])
        reset = ledger[-1]
        self.assertEqual(reset['price_date'], '2026-10-30')
        self.assertTrue(reset['convention'].startswith('Monthly reset'))
        self.assertAlmostEqual(reset['max_weight'], 0.10)
        closes = {r['date']: float(r['z47_float']) for r in rows}
        self.assertAlmostEqual(closes['2026-10-30'], round(reset['level_fs'], 6))
        # Unchanged prices across the reset: the level carries over exactly.
        self.assertAlmostEqual(closes['2026-11-02'], closes['2026-10-30'], places=6)
        eternal = next(c for c in out['constituents'] if c['ticker'] == 'ETERNAL')
        self.assertAlmostEqual(eternal['index_weight_pct'], 10, places=4)
        self.assertEqual(out['meta']['last_cap_reset']['effective_date'], '2026-11-02')
        monthly = json.loads((self.dir / 'monthly.json').read_text())
        october = next(m for m in monthly if m['month'] == '2026-10')
        self.assertEqual((october['status'], october['end_price_date']), ('complete', '2026-10-30'))

    def test_reset_waits_when_today_is_a_holiday(self):
        prices = {'2026-10-23': {}, '2026-10-30': {'ETERNAL.NS': 130.0}, '2026-11-02': {'ETERNAL.NS': 130.0}}
        _, ledger, _ = self.build((2026, 11, 2, 16, 15), prices, n500_prev=21500.0)
        self.assertEqual([e['effective_date'] for e in ledger], ['2026-10-26'])
        # The next run, after a real session, applies it on the first session of the month.
        prices['2026-11-03'] = {'ETERNAL.NS': 131.0}
        _, ledger, _ = self.build((2026, 11, 3, 16, 15), prices, n500_prev=21400.0)
        self.assertEqual(ledger[-1]['effective_date'], '2026-11-02')


if __name__ == '__main__':
    unittest.main()
