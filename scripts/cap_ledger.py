"""Capped-index rebalance ledger: frozen resets plus the rule that adds new ones.

Index owner (23 Oct 2026): each constituent is capped at 10% of the free-float
index, reset on the first trading day of every month and at every constituent
change, priced at the previous session's close. Weights drift with prices
between resets. The total-market-cap series stays uncapped; it only resets its
units so that constituent changes are value-neutral.

Every reset freezes its prices, FX rate, share counts and units, so a later
provider revision can never move published history.
"""
import json
import math

from capped_index import capped_weights

CAP = 0.10


def positive(value):
    return isinstance(value, (int, float)) and math.isfinite(value) and value > 0


def load(path):
    with open(path) as source:
        ledger = json.load(source)
    if not ledger:
        raise RuntimeError('Empty cap ledger; retaining last-good feed')
    return ledger


def save(path, ledger):
    with open(path, 'w') as out:
        json.dump(ledger, out, indent=2, allow_nan=False)
        out.write('\n')


def level(entry, prices, fx, basis):
    """Index level for `entry`'s units; basis 'fs' (capped) or 'ts' (total mcap)."""
    if not positive(fx):
        raise RuntimeError('Missing valid USD/INR; retaining last-good feed')
    total = []
    for ticker, holding in entry['holdings'].items():
        price = prices.get(ticker)
        if not positive(price):
            raise RuntimeError(f'Missing price for active holding {ticker}; retaining last-good feed')
        total.append(holding['units_' + basis] * price * (fx if holding['currency'] == 'USD' else 1))
    return math.fsum(total)


def weights(entry, prices, fx):
    """Current free-float weights, drifted from the last reset."""
    value = level(entry, prices, fx, 'fs')
    return {ticker: holding['units_fs'] * prices[ticker] * (fx if holding['currency'] == 'USD' else 1) / value
            for ticker, holding in entry['holdings'].items()}


def make_reset(effective_date, price_date, convention, level_fs, level_ts, holdings, prices, fx):
    """New units from `holdings` ({ticker: {currency, fs, ts}}) at `price_date` closes.

    `level_ts` is None only for audit entries restated before the ledger existed.
    """
    if not (positive(level_fs) and (level_ts is None or positive(level_ts)) and positive(fx)):
        raise RuntimeError(f'Invalid reset inputs for {effective_date}')
    inr = {}
    for ticker, holding in holdings.items():
        price = prices.get(ticker)
        if not (positive(price) and positive(holding.get('fs')) and positive(holding.get('ts'))):
            raise RuntimeError(f'Incomplete reset data for {ticker} on {effective_date}; retaining last-good feed')
        inr[ticker] = price * (fx if holding['currency'] == 'USD' else 1)
    capped = capped_weights({t: inr[t] * h['fs'] for t, h in holdings.items()}, CAP)
    total = capped_weights({t: inr[t] * h['ts'] for t, h in holdings.items()}, 1.0)
    return {
        'effective_date': effective_date,
        'price_date': price_date,
        'convention': convention,
        'level_fs': level_fs,
        'level_ts': level_ts,
        'usdinr': fx,
        'max_weight': max(capped.values()),
        'holdings': {t: {'currency': h['currency'], 'fs': h['fs'], 'ts': h['ts'], 'price': prices[t],
                         'weight': capped[t], 'units_fs': level_fs * capped[t] / inr[t],
                         'units_ts': level_ts * total[t] / inr[t] if level_ts else None}
                     for t, h in sorted(holdings.items())},
    }


def walk(base, calendar, due, prices_on, fx_on, holdings_for, deferred=()):
    """Value every session after `base`'s price date, adding the resets in `due`.

    prices_on(day) -> {ticker: close}; fx_on(day) -> USD/INR;
    holdings_for(entry, convention) -> {ticker: {currency, fs, ts}} for a new reset.
    Resets on `deferred` days wait for a later run (e.g. today on an NSE holiday).
    Returns (latest entry, new resets, {day: (capped level, total-mcap level)}).
    """
    entry, new_resets, values = base, [], {}
    prev = base['price_date']
    for day in [d for d in calendar if d > base['price_date']]:
        if day in due and day not in deferred:
            closes, fx = prices_on(prev), fx_on(prev)
            entry = make_reset(day, prev, f'{due[day]}; previous NSE session close',
                               level(entry, closes, fx, 'fs'), level(entry, closes, fx, 'ts'),
                               holdings_for(entry, due[day]), closes, fx)
            entry['valuation'] = 'INR'
            new_resets.append(entry)
        prices, fx = prices_on(day), fx_on(day)
        values[day] = (level(entry, prices, fx, 'fs'), level(entry, prices, fx, 'ts'))
        prev = day
    return entry, new_resets, values


def due_resets(after, calendar, change_dates):
    """Reset dates after the effective date `after`, in order, with their convention.

    Monthly: the first calendar session of each month later than `after`'s month.
    Constituent change: the first calendar session on or after each change date.
    """
    sessions = [d for d in calendar if d > after]
    due = {}
    for month in sorted({d[:7] for d in sessions if d[:7] > after[:7]}):
        due[min(d for d in sessions if d[:7] == month)] = ['Monthly reset']
    for change in sorted(change_dates):
        if change <= after:
            continue
        session = next((d for d in sessions if d >= change), None)
        if session:
            due.setdefault(session, []).append('Constituent change')
    return [(day, ' + '.join(kinds)) for day, kinds in sorted(due.items())]
