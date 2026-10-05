import contextlib, io, json, math, pathlib, sys, unittest, tempfile
from datetime import datetime
from unittest.mock import patch
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

    def test_full_build_preserves_history_and_applies_fx(self):
        sys.path.insert(0,str(ROOT))
        import build_z47_json as feed
        with tempfile.TemporaryDirectory() as tmp:
            hist=pathlib.Path(tmp)/'history.csv';out=pathlib.Path(tmp)/'out.json'
            original=''.join(line for line in (ROOT/'z47_history.csv').read_text().splitlines(keepends=True) if line.startswith('date,') or line[:10] <= '2026-10-02');hist.write_text(original)
            fx=self.s['usdinr']*1.1
            fetched={k:({'regularMarketPrice':p,'_prev':p},[('2026-10-02',p),('2026-10-05',p)]) for k,p in self.prices.items()}
            fetched[feed.N500_YF]=({'regularMarketPrice':22232.15},[('2026-10-02',22232.15),('2026-10-05',22232.15)])
            fetched['INR=X']=({},[('2026-10-02',self.s['usdinr']),('2026-10-05',fx)])
            class Clock(datetime):
                @classmethod
                def now(cls,tz=None):return cls(2026,10,5,16,15,tzinfo=tz)
            with patch.multiple(feed,HIST_CSV=str(hist),OUT_JSON=str(out),USE_YF=True,datetime=Clock), patch.object(feed,'fetch_all_yf',return_value=fetched), patch.object(feed,'fetch_table_live',return_value={}), patch.object(feed,'fetch_usdinr',return_value={'value':fx}), patch.object(sys,'argv',['build_z47_json.py','--write-history']), contextlib.redirect_stdout(io.StringIO()),contextlib.redirect_stderr(io.StringIO()):
                feed.main()
                result=json.loads(out.read_text())
                self.assertEqual(result['index']['value'],round(level(self.s,self.prices,fx,'fs'),2))
                self.assertTrue(hist.read_text().startswith(original))
                self.assertEqual(result['meta']['index_currency'],'INR')
                saved=out.read_text()
                with patch.object(feed,'fetch_usdinr',return_value=None):
                    with self.assertRaisesRegex(RuntimeError,'USD/INR'):feed.main()
                self.assertEqual(out.read_text(),saved)

if __name__=='__main__':unittest.main()
