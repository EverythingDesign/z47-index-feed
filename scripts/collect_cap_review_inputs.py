"""Freeze public source data and versioned holdings for the cap staging review."""
from pathlib import Path
import ast
import json
import subprocess
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data' / 'cap-review'

def constants(ref):
    source = subprocess.check_output(['git', 'show', f'{ref}:build_z47_json.py'], cwd=ROOT, text=True)
    values = {}
    for node in ast.parse(source).body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id in ('COMPANIES', 'SHARE_DATA'):
                    values[target.id] = ast.literal_eval(node.value)
    holdings = {}
    for c in values['COMPANIES']:
        symbol = c['ticker'] + ('.NS' if c['exchange'] == 'NSE' else '')
        holdings[c['ticker']] = {**c, **values['SHARE_DATA'][symbol], 'currency': 'INR' if c['exchange'] == 'NSE' else 'USD'}
    return holdings

def main():
    import yfinance as yf
    OUT.mkdir(parents=True, exist_ok=True)
    yf.set_tz_cache_location('/tmp/z47-cap-yfinance-cache')
    regimes = []
    for date, ref in [('2026-06-16', 'e19492e^'), ('2026-08-20', 'e19492e'), ('2026-09-18', '331b3d1'), ('2026-10-05', '8228e5d')]:
        regimes.append({'date': date, 'commit': subprocess.check_output(['git','rev-parse',ref],cwd=ROOT,text=True).strip(), 'holdings': constants(ref)})
    prices, sources = {}, {}
    for path in (ROOT / 'data' / 'companies').glob('*-chart.json'):
        data = json.loads(path.read_text())
        ticker = data.get('ticker')
        rows = {}
        # Longest histories first; more recent short ranges may refresh final closes.
        for period in ['Max', 'MAX', '5Y', '3Y', '1Y', '6M', '1M']:
            for date, value in data.get('periods', {}).get(period, {}).get('price', []):
                if isinstance(value, (int, float)) and value > 0:
                    rows[date[:10]] = float(value)
        if ticker and rows:
            prices[ticker] = rows
            sources[ticker] = {'file': str(path.relative_to(ROOT)), 'source': data.get('source'), 'generated_at': data.get('generated_at')}
    needed = {t for r in regimes for t in r['holdings']}
    for ticker in sorted(needed) + ['USDINR=X', 'ZETWERK']:
        symbol = ticker if ticker in ('USDINR=X', 'MMYT', 'FRSH') else ticker + '.NS'
        hist = yf.Ticker(symbol).history(start='2026-06-01', end='2026-10-27', auto_adjust=False, actions=False)
        rows = {date.strftime('%Y-%m-%d'): float(row['Close']) for date, row in hist.iterrows() if float(row['Close']) > 0}
        if not rows:
            raise RuntimeError(f'No historical prices for {symbol}; cannot calculate a reliable replacement series')
        prices[ticker] = rows
        sources[ticker] = {'source': 'Yahoo Finance unadjusted Close', 'symbol': symbol, 'fetched_at': datetime.now(timezone.utc).isoformat()}
        print(ticker, len(rows), min(rows), max(rows), flush=True)
    info = yf.Ticker('ZETWERK.NS').get_info()
    zetwerk = {k:info.get(k) for k in ['symbol','shortName','longName','floatShares','sharesOutstanding','currency','website','regularMarketPrice','regularMarketTime']}
    payload = {'regimes': regimes, 'prices': prices, 'sources': sources, 'zetwerk': zetwerk,
               'fetched_at': datetime.now(timezone.utc).isoformat(),
               'assumption': 'Use versioned share counts from each historical constituent swap; dated quarterly float refreshes are not supplied.'}
    (OUT/'inputs.json').write_text(json.dumps(payload, indent=2)+'\n')
    print('Saved', OUT/'inputs.json', 'Zetwerk shares:', zetwerk.get('floatShares'), zetwerk.get('sharesOutstanding'))

if __name__ == '__main__':
    main()
