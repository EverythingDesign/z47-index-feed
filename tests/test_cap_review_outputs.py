import json
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
class OutputTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.feed=json.loads((ROOT/'data/cap-review/staging-feed.json').read_text())
        cls.source=json.loads((ROOT/'data/cap-review/observed-feed.json').read_text())
    def test_exact_preservation_before_restatement(self):
        old=[r for r in self.source['history'] if r['date']<='2026-06-16']
        new=[r for r in self.feed['history'] if r['date']<='2026-06-16']
        self.assertEqual(new,old)
    def test_constituents_and_sector_totals(self):
        rows=self.feed['constituents'];tickers=[r['ticker'] for r in rows]
        self.assertEqual(len(rows),47);self.assertEqual(len(set(tickers)),47)
        self.assertIn('ZETWERK',tickers);self.assertNotIn('TURTLEMINT',tickers)
        self.assertEqual(sum(r['count'] for r in self.feed['sectors']),47)
        self.assertAlmostEqual(sum(r['index_weight_pct'] for r in rows),100,places=4)
        self.assertEqual(next(r for r in rows if r['ticker']=='ZETWERK')['sector'],'B2B')
    def test_no_fabricated_new_stock_history(self):
        row=next(r for r in self.feed['constituents'] if r['ticker']=='ZETWERK')
        for field in ['ret_1m','ret_3m','ret_6m','ret_1y','ret_ytd']:self.assertIsNone(row[field])
        for lists in self.feed['movers_by_period'].values():
            for rows in lists.values():self.assertNotIn('TURTLEMINT',[r['ticker'] for r in rows])
    def test_caps_only_at_resets(self):
        ledger=json.loads((ROOT/'data/cap-review/rebalance-weights.json').read_text())
        for row in ledger:
            self.assertEqual(row['count'],47)
            self.assertAlmostEqual(row['weights_sum'],1)
            self.assertLessEqual(row['max_weight'],.1000000001)
    def test_monthly_and_constituent_resets(self):
        ledger=json.loads((ROOT/'data/cap-review/rebalance-weights.json').read_text())
        days=[r['effective_date'] for r in ledger]
        for day in ['2026-07-01','2026-08-03','2026-09-01','2026-10-01']:self.assertIn(day,days)
        for day in ['2026-08-20','2026-09-18','2026-10-05','2026-10-26']:self.assertIn(day,days)
        self.assertIn('each month',self.feed['meta']['cap_applies'])
    def test_uncapped_control_matches_saved_history(self):
        comparisons=json.loads((ROOT/'data/cap-review/uncapped-replay-validation.json').read_text())
        self.assertLess(max(abs(r['difference']) for r in comparisons),.1)
    def test_dates_unique_and_assumptions_disclosed(self):
        days=[r['date'] for r in self.feed['history']]
        self.assertEqual(days,sorted(set(days)))
        self.assertTrue(self.feed['meta']['cap_review_not_for_publication'])
        self.assertEqual(self.feed['meta']['cap_review_status'],'provisional')
    def test_monthly_returns_reconcile(self):
        bydate={r['date']:r for r in self.feed['history']}
        rows=json.loads((ROOT/'data/cap-review/monthly-takeaways.json').read_text())
        for row in rows:
            a=bydate[row['start_price_date']];b=bydate[row['end_price_date']]
            self.assertAlmostEqual(row['z47_month_return_pct'],(b['z47']/a['z47']-1)*100,places=3)
            self.assertAlmostEqual(row['nifty_month_return_pct'],(b['nifty500']/a['nifty500']-1)*100,places=3)

if __name__=='__main__':unittest.main()
