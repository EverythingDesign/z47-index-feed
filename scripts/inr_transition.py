"""Value-neutral, prospective INR valuation from a frozen transition snapshot."""
import math

EFFECTIVE_DATE = '2026-10-05'
ANCHOR_DATE = '2026-10-02'

def positive(value):
    return isinstance(value, (int, float)) and math.isfinite(value) and value > 0

def valuation(snapshot, prices, fx, share_type):
    if not positive(fx):
        raise RuntimeError('Missing valid USD/INR; retaining last-good feed')
    total = 0.0
    for ticker, holding in snapshot['holdings'].items():
        price = prices.get(ticker)
        if not positive(price) or not positive(holding.get(share_type)):
            raise RuntimeError(f'Incomplete INR valuation: {ticker}')
        total += price * holding[share_type] * (fx if holding['currency'] == 'USD' else 1)
    return total

def level(snapshot, prices, fx, share_type):
    anchor_prices = {k: v['price'] for k, v in snapshot['holdings'].items()}
    anchor_value = valuation(snapshot, anchor_prices, snapshot['usdinr'], share_type)
    anchor_level = snapshot['index_float' if share_type == 'fs' else 'index_mcap']
    if not positive(anchor_level):
        raise RuntimeError('Invalid INR transition anchor')
    return anchor_level * valuation(snapshot, prices, fx, share_type) / anchor_value

def validate(snapshot, tickers):
    if snapshot['anchor_date'] != ANCHOR_DATE or snapshot['effective_date'] != EFFECTIVE_DATE:
        raise RuntimeError('Unexpected INR transition dates')
    if set(snapshot['holdings']) != set(tickers):
        raise RuntimeError('INR transition roster differs: new rebalance required')
    if any(h.get('currency') not in {'USD', 'INR'} for h in snapshot['holdings'].values()):
        raise RuntimeError('Invalid transition currency')
    level(snapshot, {k:v['price'] for k,v in snapshot['holdings'].items()}, snapshot['usdinr'], 'fs')
