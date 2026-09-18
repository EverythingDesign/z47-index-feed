import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
from types import SimpleNamespace
from datetime import datetime

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
import build_company_hero as hero
import build_company_chart as chart
F=Path(__file__).parent/'fixtures'
def source(name): return (F/(name+'-source.html')).read_text()

class CompanyFixes(unittest.TestCase):
    def test_google_search_is_not_a_company_website(self):
        out=hero.parse_screener_hero('<a href="http://www.google.co.in/search?gfns=1&amp;q=Rentomojo"><i class="icon-link"></i></a>')
        self.assertFalse(out.get('website'))

    def test_current_website_markup(self):
        self.assertEqual(hero.parse_screener_hero(source('wakefit'))['website'],'http://www.wakefit.co')

    def test_website_attribute_order_and_entities(self):
        out=hero.parse_screener_hero('<a target="_blank" href="https://example.com/?a=1&amp;b=2"><i class="other icon-link"></i></a>')
        self.assertEqual(out['website'],'https://example.com/?a=1&b=2')

    def test_annual_period_preserved_and_ttm_future_excluded(self):
        html='<section id="profit-loss"><table><tr><th></th><th>Dec 2025</th><th>Mar 2026</th><th>TTM</th><th>Mar 2099</th></tr><tr><td>Sales</td><td>1</td><td>2</td><td>3</td><td>4</td></tr></table></section>'
        pl=hero.parse_screener_pl(html)
        self.assertEqual(pl['periods'],['Dec 2025','Mar 2026'])
        self.assertEqual(pl['rows'][0]['values'],['1','2'])

    def test_fivestar_basis_fallback_does_not_mix_ratios(self):
        out=hero.select_financials(source('fivestar'),source('fivestar-consolidated'),'FIVESTAR')
        self.assertFalse(out['pl']['consolidated'])
        self.assertEqual((out['roce'],out['roe']),(14.8,16.1))
        self.assertEqual(out['pe'],hero.parse_screener_hero(source('fivestar'))['pe'])

    def test_blank_consolidated_pe_stays_blank(self):
        out=hero.select_financials(source('firstcry-standalone'),source('firstcry'),'FIRSTCRY')
        self.assertTrue(out['pl']['consolidated'])
        self.assertIsNone(out['pe'])

    def test_empty_consolidated_uses_standalone(self):
        out=hero.select_financials(source('wakefit'),source('wakefit-consolidated'),'WAKEFIT')
        self.assertFalse(out['pl']['consolidated'])
        self.assertEqual(out['pl']['periods'][-1],'Mar 2026')

    def test_all_45_fy26_columns_match_audit_source_cells(self):
        expected=json.loads((F/'fy26-expected.json').read_text())
        self.assertEqual(len(expected),45)
        for slug,ex in expected.items():
            d=json.loads((ROOT/f'data/companies/{slug}.json').read_text())
            self.assertTrue(d.get('website'),slug)
            i=d['pl']['periods'].index('Mar 2026')
            rows={r['label'].replace('+','').strip():r for r in d['pl']['rows']}
            for r in ex['rows']:
                actual=rows[r['label'].replace('+','').strip()]['values'][i]
                # Screener can alternate the sign of rounded zero percentages.
                normalize=lambda v: '0%' if v in ('0%','-0%','+0%') else v
                self.assertEqual(normalize(actual),normalize(r['value']),(slug,r['label']))

    def test_failed_refresh_retains_history_and_original_timestamp(self):
        old={'generated_at':'2026-08-07','periods':{'Max':{'price':[['2026-08-07',127.76]]}}}
        out=chart.retain_last_good({'error':'HTTP 429','rate_limited':True,'periods':{}},old)
        self.assertEqual(out['periods'],old['periods'])
        self.assertEqual(out['generated_at'],old['generated_at'])
        self.assertEqual(out['data_as_of'],'2026-08-07')
        self.assertEqual(out['refresh_status'],'cached')

    def test_successful_refresh_removes_old_error(self):
        date=datetime.now(chart.IST).date().isoformat()
        out=chart.retain_last_good({'periods':{'Max':{'price':[[date,155]]}}},{'error':'old failure'})
        self.assertEqual(out['refresh_status'],'ok')
        self.assertNotIn('error',out)

    def test_partial_refresh_keeps_long_history(self):
        date=datetime.now(chart.IST).date().isoformat()
        old={'periods':{'Max':{'price':[['2026-08-07',127.76]]}}}
        new={'periods':{'1M':{'price':[[date,155]]},'Max':{'price':[]}}}
        out=chart.retain_last_good(new,old)
        self.assertEqual(out['periods']['Max'],old['periods']['Max'])
        self.assertEqual(out['refresh_status'],'partial')
        self.assertEqual(new['periods']['Max']['price'],[])

    def test_nasdaq_builder_keeps_unavailable_financial_schema(self):
        provider=SimpleNamespace(nasdaq_live=lambda *a, **k: {'price':12.73}, usd_inr_rate=lambda:95)
        with patch.dict(sys.modules, {'stockanalysis_nasdaq':provider}), patch.object(hero,'yahoo_fallback',return_value={}):
            result=hero.scrape_nasdaq_hero({'ticker':'FRSH'},{'slug':'frsh'})
        self.assertEqual(result['price'],12.73)
        for key in ['pl','growth','shareholding']:
            self.assertIn(key,result)
            self.assertIsNone(result[key])

    def test_nasdaq_does_not_include_indian_financials(self):
        for slug in ['mmyt','frsh']:
            d=json.loads((ROOT/f'data/companies/{slug}.json').read_text())
            self.assertIsNone(d['pl']);self.assertIsNone(d['growth']);self.assertIsNone(d['shareholding'])

if __name__=='__main__': unittest.main()
