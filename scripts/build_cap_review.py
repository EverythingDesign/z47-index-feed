"""Build a review-only restatement and Zetwerk swap from frozen, dated inputs.

This does not replace z47_index.json or published history. The share-count basis
is explicitly provisional pending the index owner's quarterly-float decision.
"""
from pathlib import Path
import bisect
import calendar
import copy
import csv
import json
import sys
from datetime import date, timedelta
from capped_index import capped_weights, portfolio_value, rebalance

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'data'/'cap-review'
ANCHOR = '2026-06-16'

def dump(name, data):
    (OUT/name).write_text(json.dumps(data, indent=2, allow_nan=False)+'\n')

def main():
    validating = '--validate-uncapped' in sys.argv
    cap = 1.0 if validating else 0.10
    data=json.loads((OUT/'inputs.json').read_text())
    source=json.loads((OUT/'observed-feed.json').read_text())
    series=data['prices']
    keys={k:sorted(v) for k,v in series.items()}
    def price(ticker, day):
        available=keys.get(ticker,[])
        i=bisect.bisect_right(available,day)-1
        if i<0: raise ValueError(f'No known price for {ticker} on/before {day}')
        return series[ticker][available[i]]
    def quotes(holdings, day): return {t:price(t,day) for t in holdings}
    def fx(day): return price('USDINR=X',day)
    original={r['date']:r for r in source['history']}
    if ANCHOR not in original: raise ValueError('Missing preserved June anchor')
    cutoff=min(source['meta']['data_as_of'],max(keys['ETERNAL']))
    if validating: cutoff=min(cutoff,'2026-10-23')
    days=[d for d in keys['ETERNAL'] if ANCHOR<=d<=cutoff]
    regimes={r['date']:r['holdings'] for r in data['regimes']}
    zetwerk=data['zetwerk']
    if not all(isinstance(zetwerk.get(k),(int,float)) and zetwerk[k]>0 for k in ('floatShares','sharesOutstanding')):
        raise ValueError('Zetwerk needs verified float and total shares')
    new=copy.deepcopy(regimes['2026-10-05'])
    removed=new.pop('TURTLEMINT')
    new['ZETWERK']={'name':'Zetwerk','ticker':'ZETWERK','exchange':'NSE','sector':'B2B','num':removed['num'],
                    'fs':zetwerk['floatShares'],'ts':zetwerk['sharesOutstanding'],'currency':'INR',
                    'float_pct':100*zetwerk['floatShares']/zetwerk['sharesOutstanding']}
    regimes['2026-10-26']=new
    # Index owner (23 Oct): reset to the cap on the first trading day of every
    # month and at every constituent change.
    monthly_resets={min(d for d in days if d[:7]==m) for m in {d[:7] for d in days if d>ANCHOR}}
    monthly_resets={d for d in monthly_resets if d[:7]>ANCHOR[:7]}
    reset_dates=monthly_resets|set(regimes)
    holdings=regimes[ANCHOR]
    level=float(original[ANCHOR]['z47'])
    units,weights=rebalance(level,holdings,quotes(holdings,ANCHOR),cap=cap)
    ledger=[]
    def log_reset(effective, priced_at, level, weights, convention):
        ledger.append({'effective_date':effective,'price_date':priced_at,'index_level_before_and_after':level,
            'convention':convention,'count':len(weights),'weights_sum':sum(weights.values()),
            'max_weight':max(weights.values()),'weights':weights,
            'shares':{t:{'fs':h['fs'],'ts':h['ts']} for t,h in holdings.items()}})
    log_reset(ANCHOR,ANCHOR,level,weights,'Initial capped continuation of preserved June history')
    history=[copy.deepcopy(r) for r in source['history'] if r['date']<=ANCHOR]
    previous=ANCHOR
    for day in days:
        if day<=ANCHOR: continue
        if day=='2026-09-29':
            # Preserve the existing prospective currency convention. Convert the
            # capped portfolio's US holdings with a value-neutral divisor change;
            # this is not a scheduled cap reset. Oct 1 then caps INR valuations.
            old=portfolio_value(units,holdings,quotes(holdings,previous))
            converted=portfolio_value(units,holdings,quotes(holdings,previous),fx(previous))
            units={t:u*old/converted for t,u in units.items()}
        use_fx=day>='2026-09-29'
        if day in reset_dates and day!='2026-08-20':
            level=portfolio_value(units,holdings,quotes(holdings,previous),fx(previous) if use_fx else 1)
            holdings=regimes.get(day,holdings)
            units,weights=rebalance(level,holdings,quotes(holdings,previous),fx(previous) if use_fx else 1,cap=cap)
            log_reset(day,previous,level,weights,('Monthly reset' if day in monthly_resets else 'Constituent change')+'; previous available NSE session close; versioned shares')
        level=portfolio_value(units,holdings,quotes(holdings,day),fx(day) if use_fx else 1)
        if day=='2026-08-20':
            # Three IPO entrants have no Aug 19 traded close. The saved August
            # event explicitly changed the basket at the Aug 20 close.
            holdings=regimes[day]
            units,weights=rebalance(level,holdings,quotes(holdings,day),cap=cap)
            log_reset(day,day,level,weights,'After Aug 20 close, matching the saved IPO-swap event')
        if day not in original: raise ValueError(f'Missing dated benchmark on {day}')
        history.append({'date':day,'z47':round(level,8),'nifty500':original[day]['nifty500']})
        previous=day
    if validating:
        comparisons=[{'date':r['date'],'replayed':r['z47'],'published':original[r['date']]['z47'],
                      'difference':r['z47']-original[r['date']]['z47']} for r in history if r['date']>ANCHOR]
        dump('uncapped-replay-validation.json',comparisons)
        print(json.dumps({'max_absolute_difference':max(abs(r['difference']) for r in comparisons),
                          'latest':comparisons[-1], 'largest':sorted(comparisons,key=lambda r:abs(r['difference']),reverse=True)[:5]},indent=2))
        return
    def at(day):
        rows=[r for r in history if r['date']<=day]
        if not rows: raise ValueError(f'No history at {day}')
        return rows[-1]
    end=at(cutoff)
    def ret(key,start): return (end[key]/at(start)[key]-1)*100
    returns={key:round(ret('z47',(date.fromisoformat(cutoff)-timedelta(days=n)).isoformat()),2)
             for key,n in [('1M',30),('3M',90),('6M',180),('1Y',365)]}
    returns['YTD']=round(ret('z47',str(date.fromisoformat(cutoff).year-1)+'-12-31'),2)
    returns['since_base']=round((end['z47']/history[0]['z47']-1)*100,2)
    current_fx=fx(cutoff) if cutoff>='2026-09-29' else 1
    weight_now={t:units[t]*price(t,cutoff)*(current_fx if holdings[t]['currency']=='USD' else 1)/level for t in holdings}
    monthly=[]
    for month in [6,7,8,9,10]:
        start=date(2026,month,1)-timedelta(days=1)
        finish=min(date(2026,month,calendar.monthrange(2026,month)[1]),date.fromisoformat(cutoff))
        if finish<=start: continue
        a,b=at(start.isoformat()),at(finish.isoformat())
        zr=(b['z47']/a['z47']-1)*100;nr=(b['nifty500']/a['nifty500']-1)*100
        monthly.append({'month':f'2026-{month:02d}','status':'month_to_date' if finish.day<calendar.monthrange(2026,month)[1] else 'complete',
            'start_price_date':a['date'],'end_price_date':b['date'],'z47_level':round(b['z47'],6),
            'z47_month_return_pct':round(zr,4),'nifty_month_return_pct':round(nr,4),'excess_return_pp':round(zr-nr,4),
            'z47_since_base_pct':round(b['z47']-100,4),'nifty_since_base_pct':round(b['nifty500']-100,4),
            'previously_published_z47_level':original.get(b['date'],{}).get('z47')})
    feed=copy.deepcopy(source)
    feed['history']=history
    feed['index'].update(value=round(level,2),returns=returns,daily_pct=round((history[-1]['z47']/history[-2]['z47']-1)*100,2))
    benchmark_returns={key:round(ret('nifty500',(date.fromisoformat(cutoff)-timedelta(days=n)).isoformat()),2)
             for key,n in [('1M',30),('3M',90),('6M',180),('1Y',365)]}
    benchmark_returns['YTD']=round(ret('nifty500',str(date.fromisoformat(cutoff).year-1)+'-12-31'),2)
    benchmark_returns['since_base']=round((end['nifty500']/history[0]['nifty500']-1)*100,2)
    feed['benchmark'].update(returns=benchmark_returns,indexed=end['nifty500'])
    feed['index']['value_mcap']=None  # No approval to redefine the second index.
    feed['meta'].update(data_as_of=cutoff,cap_review_status='provisional',weight_cap_pct=10,
        cap_applies='first trading day of each month and every constituent change; weights drift between resets',
        cap_share_basis=data['assumption'],price_inputs_fetched_at=data['fetched_at'],
        cap_restatement_start='2026-06-17',cap_review_not_for_publication=True)
    feed['meta']['methodology_flags'] += [data['assumption'],
        'Review only: capped continuation from June 16; no fitted residual adjustment.',
        'Existing mixed-currency basis retained through Sep 28, prospective INR transition Sep 29.',
        'Cap resets on the first trading day of each month and at every constituent change.',
        'August IPO swap is after Aug 20 close; other resets use previous available NSE close.',
        'Secondary total-market-cap series is intentionally unavailable pending methodology decision.']
    if cutoff>='2026-10-26':
        profile=json.loads((ROOT/'data/companies/zetwerk.json').read_text())
        first=min(keys['ZETWERK']);current=profile['price'];market_cap=profile['mcap_cr']
        row={'name':'Zetwerk','ticker':'ZETWERK','exchange':'NSE','sector':'B2B','slug':'zetwerk',
             'detail_url':'/z47-forty-seven/zetwerk','price':current,'daily_pct':profile.get('daily_pct'),
             'mcap_cr':market_cap,'mcap_mn':market_cap*10,'mcap_usd_mn':market_cap*10/feed['meta']['usdinr']['value'],
             'float_pct':new['ZETWERK']['float_pct'],'ret_1m':None,'ret_3m':None,'ret_6m':None,'ret_1y':None,'ret_ytd':None,
             'since_pct':round((current/price('ZETWERK',first)-1)*100,2),'index_weight_pct':weight_now['ZETWERK']*100}
        feed['constituents']=[row if c['ticker']=='TURTLEMINT' else c for c in feed['constituents']]
        feed['events'].append({'effective_date':'2026-10-26','event_type':'swap','removed':'TURTLEMINT','added':'ZETWERK',
            'reason':'Proposed staging replacement; B2B; previous-session close and iterative 10% cap.'})
    for row in feed['constituents']:
        row['index_weight_pct']=round(100*weight_now[row['ticker']],6)
    # Membership-sensitive output is rebuilt so a removed company cannot survive in movers.
    for period,field in [('1M','ret_1m'),('3M','ret_3m'),('6M','ret_6m'),('1Y','ret_1y'),('YTD','ret_ytd'),('SINCE','since_pct')]:
        rows=[{**c,'ret':c[field],'ret_1m':c[field]} for c in feed['constituents'] if isinstance(c.get(field),(float,int))]
        rows.sort(key=lambda c:c['ret'],reverse=True)
        feed['movers_by_period'][period]={'gainers':rows[:5],'losers':list(reversed(rows))[:5]}
    feed['movers']=feed['movers_by_period']['1M']
    total=sum(c['mcap_mn'] for c in feed['constituents'])
    for sector in feed['sectors']:
        members=[c for c in feed['constituents'] if c['sector']==sector['name']]
        valid=[c for c in members if c.get('ret_1m') is not None]
        sector.update(count=len(members),weight_pct=round(sum(c['mcap_mn'] for c in members)/total*100,1),
            index_weight_pct=round(sum(c['index_weight_pct'] for c in members),6),
            avg_ret_1m=round(sum(c['ret_1m'] for c in valid)/len(valid),2) if valid else None,
            top_mover={'name':max(valid,key=lambda c:c['ret_1m'])['name'],'ret_1m':max(c['ret_1m'] for c in valid)} if valid else None)
    assert len(feed['constituents'])==47
    assert abs(sum(weight_now.values())-1)<1e-9
    assert [r for r in history if r['date']<=ANCHOR]==[r for r in source['history'] if r['date']<=ANCHOR]
    dump('staging-feed.json',feed)
    dump('rebalance-weights.json',ledger)
    dump('monthly-takeaways.json',monthly)
    with (OUT/'monthly-takeaways.csv').open('w',newline='') as f:
        w=csv.DictWriter(f,fieldnames=list(monthly[0]));w.writeheader();w.writerows(monthly)
    with (OUT/'corrected-history.csv').open('w',newline='') as f:
        w=csv.DictWriter(f,fieldnames=['date','z47','nifty500']);w.writeheader();w.writerows(history)
    summary={'status':'PROVISIONAL — quarterly share refresh decision outstanding','as_of':cutoff,
        'source_feed_level':source['index']['value'],'capped_staging_level':round(level,6),
        'difference_pct':round((level/source['index']['value']-1)*100,6),
        'top_weights':sorted(weight_now.items(),key=lambda x:x[1],reverse=True)[:8],
        'sector_counts':{s['name']:s['count'] for s in feed['sectors']},
        'reset_dates':[r['effective_date'] for r in ledger],
        'assumptions':feed['meta']['methodology_flags'][-6:]}
    dump('summary.json',summary)
    print(json.dumps(summary,indent=2))

if __name__=='__main__': main()
