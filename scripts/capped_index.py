"""Deterministic capped portfolio math. No network, fitted offsets or daily recapping."""
import math

def positive(value):
    return isinstance(value, (int, float)) and math.isfinite(value) and value > 0

def capped_weights(values, cap=0.10):
    if not positive(cap) or cap > 1 or not values or not all(positive(v) for v in values.values()):
        raise ValueError('Every holding needs a finite positive valuation and a valid cap')
    if len(values) * cap < 1 - 1e-12:
        raise ValueError('Too few constituents to satisfy the weight cap')
    weights, remaining = {}, dict(values)
    while remaining:
        budget = 1 - math.fsum(weights.values())
        total = math.fsum(remaining.values())
        over = [key for key, value in remaining.items() if budget * value / total > cap + 1e-12]
        if not over:
            weights.update({key: budget * value / total for key, value in remaining.items()})
            break
        for key in over:
            weights[key] = cap
            del remaining[key]
    if abs(math.fsum(weights.values()) - 1) > 1e-10 or max(weights.values()) > cap + 1e-10:
        raise ArithmeticError('Invalid capped portfolio')
    return weights

def rebalance(level, holdings, prices, fx=1, cap=0.10, share_key='fs'):
    if not positive(level) or not positive(fx) or set(holdings) != set(prices):
        raise ValueError('Rebalance needs a positive level, FX rate and a price for every holding')
    valuations = {}
    effective_prices = {}
    for ticker, holding in holdings.items():
        price = prices[ticker]
        shares = holding.get(share_key)
        if not positive(price) or not positive(shares):
            raise ValueError(f'Missing valid price/shares for {ticker}')
        effective_prices[ticker] = price * (fx if holding['currency'] == 'USD' else 1)
        valuations[ticker] = effective_prices[ticker] * shares
    weights = capped_weights(valuations, cap)
    units = {ticker:level * weights[ticker] / effective_prices[ticker] for ticker in holdings}
    return units, weights

def portfolio_value(units, holdings, prices, fx=1):
    if not positive(fx):
        raise ValueError('Missing valid FX rate')
    values = []
    for ticker, units_held in units.items():
        if not positive(prices.get(ticker)):
            raise ValueError(f'Missing price for active holding {ticker}')
        values.append(units_held * prices[ticker] * (fx if holdings[ticker]['currency'] == 'USD' else 1))
    return math.fsum(values)
