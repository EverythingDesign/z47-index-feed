import json, math, pathlib, sys, unittest
ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from inr_transition import level, validate

class INRTests(unittest.TestCase):
    def setUp(self):
        self.s = json.loads((ROOT/'data/rebalances/2026-10-05-inr.json').read_text())
        self.prices = {k:h['price'] for k,h in self.s['holdings'].items()}

    def test_transition_does_not_change_published_level(self):
        for field, key in [('fs','index_float'),('ts','index_mcap')]:
            self.assertAlmostEqual(level(self.s,self.prices,self.s['usdinr'],field),self.s[key],places=10)

    def test_only_dollar_holdings_respond_to_fx(self):
        fx=self.s['usdinr']; value=level(self.s,self.prices,fx*1.1,'fs')
        usd=sum(h['price']*h['fs']*fx for h in self.s['holdings'].values() if h['currency']=='USD')
        inr=sum(h['price']*h['fs'] for h in self.s['holdings'].values() if h['currency']=='INR')
        self.assertAlmostEqual(value/self.s['index_float']-1, .1*usd/(usd+inr),places=10)

    def test_uniform_price_return_and_both_index_series(self):
        for field,key in [('fs','index_float'),('ts','index_mcap')]:
            value=level(self.s,{k:v*1.05 for k,v in self.prices.items()},self.s['usdinr'],field)
            self.assertAlmostEqual(value,self.s[key]*1.05,places=9)

    def test_bad_fx_missing_price_and_changed_roster_fail_closed(self):
        for fx in [None,0,-1,math.nan,math.inf]:
            with self.assertRaises(RuntimeError):level(self.s,self.prices,fx,'fs')
        prices=dict(self.prices);prices.pop('MMYT')
        with self.assertRaises(RuntimeError):level(self.s,prices,96,'fs')
        with self.assertRaises(RuntimeError):validate(self.s,['MMYT'])


if __name__=='__main__':unittest.main()
