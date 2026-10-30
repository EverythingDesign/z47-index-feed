"""One-time go-live of the capped index (index owner approval, 26 Oct 2026).

Builds data/rebalances/cap-ledger.json from the reviewed restatement in
data/cap-review/, writes the capped values into z47_history.csv from 17 Jun to
the last reset's price date, and records the Turtlemint -> Zetwerk swap event.
Rows after that date are dropped; the next build_z47_json.py run recomputes them.

Run once from the repo root:  python3 scripts/migrate_cap_ledger.py
"""
import bisect
import csv
import json
import math
from pathlib import Path

import cap_ledger

ROOT = Path(__file__).resolve().parents[1]
REVIEW = ROOT / 'data' / 'cap-review'
HIST_CSV = ROOT / 'z47_history.csv'
EVENTS = ROOT / 'constituent_events.json'
INR_FROM = '2026-09-29'
RESTATE_FROM = '2026-06-17'
SWAP = {'effective_date': '2026-10-26', 'event_type': 'swap', 'removed': 'TURTLEMINT', 'added': 'ZETWERK',
        'reason': 'Zetwerk replaces Turtlemint; B2B. Capped reset at the 2026-10-23 close; prior history preserved.',
        'anchor_date': '2026-10-23'}


def main():
    inputs = json.loads((REVIEW / 'inputs.json').read_text())
    resets = json.loads((REVIEW / 'rebalance-weights.json').read_text())
    corrected = {r['date']: float(r['z47']) for r in csv.DictReader((REVIEW / 'corrected-history.csv').open())}
    series = inputs['prices']
    days = {t: sorted(v) for t, v in series.items()}

    def price(ticker, day):
        i = bisect.bisect_right(days[ticker], day) - 1
        if i < 0:
            raise ValueError(f'No price for {ticker} on/before {day}')
        return series[ticker][days[ticker][i]]

    currency = {'ZETWERK': 'INR'}
    for regime in inputs['regimes']:
        currency.update({t: h['currency'] for t, h in regime['holdings'].items()})

    def yf(ticker):
        return ticker if currency[ticker] == 'USD' else ticker + '.NS'

    with HIST_CSV.open(newline='') as source:
        rows = list(csv.DictReader(source))
    published = {r['date']: r for r in rows}

    ledger = []
    for i, reset in enumerate(resets):
        latest = i == len(resets) - 1
        priced_at = reset['price_date']
        fx = price('USDINR=X', priced_at) if reset['effective_date'] >= INR_FROM else 1
        holdings = {yf(t): {'currency': currency[t], **shares} for t, shares in reset['shares'].items()}
        prices = {yf(t): price(t, priced_at) for t in reset['shares']}
        level_ts = float(published[priced_at]['z47_mcap']) if latest else None
        entry = cap_ledger.make_reset(reset['effective_date'], priced_at, reset['convention'],
                                      reset['index_level_before_and_after'], level_ts, holdings, prices, fx)
        entry['valuation'] = 'INR' if fx != 1 else 'legacy_mixed_currency'
        for t, w in reset['weights'].items():
            if abs(entry['holdings'][yf(t)]['weight'] - w) > 1e-12:
                raise ArithmeticError(f'{priced_at} {t}: weight differs from the reviewed restatement')
        if abs(cap_ledger.level(entry, prices, fx, 'fs') - entry['level_fs']) > 1e-9 * entry['level_fs']:
            raise ArithmeticError(f'{priced_at}: units do not reproduce the reset level')
        if abs(corrected[priced_at] - entry['level_fs']) > 1e-6:
            raise ArithmeticError(f'{priced_at}: reset level differs from the corrected history')
        ledger.append(entry)

    # The staged 26 Oct snapshot (12:44 IST prices) must replay from the frozen units.
    last = ledger[-1]
    replay = cap_ledger.level(last, {t: price(t.replace('.NS', ''), '2026-10-26') for t in last['holdings']},
                              price('USDINR=X', '2026-10-26'), 'fs')
    if abs(replay - corrected['2026-10-26']) > 1e-6:
        raise ArithmeticError(f'26 Oct replay {replay} differs from the staged {corrected["2026-10-26"]}')

    anchor = last['price_date']
    restated = [d for d in published if RESTATE_FROM <= d <= anchor]
    expected = [d for d in corrected if RESTATE_FROM <= d <= anchor]
    missing = sorted(set(expected) - set(restated))
    if missing:
        raise ValueError(f'Restated sessions missing from published history: {missing}')
    # The restatement runs on NSE sessions only. Published rows on NSE holidays
    # (flat NIFTY 500, e.g. 2 Oct) have no restated value and are dropped.
    dates = [r['date'] for r in rows]
    holidays = sorted(set(restated) - set(expected))
    for day in holidays:
        before = published[dates[dates.index(day) - 1]]
        if published[day]['n500_indexed'] != before['n500_indexed']:
            raise ValueError(f'{day} is not in the restatement but NIFTY 500 traded')
    rows = [r for r in rows if r['date'] not in holidays]
    for row in rows:
        if row['date'] < RESTATE_FROM and abs(float(row['z47_float']) - corrected.get(row['date'], float(row['z47_float']))) > 1e-6:
            raise ValueError(f'Pre-restatement history changed on {row["date"]}')
        if RESTATE_FROM <= row['date'] <= anchor:
            row['z47_float'] = f'{corrected[row["date"]]:.6f}'
    rows = [r for r in rows if r['date'] <= anchor]
    with HIST_CSV.open('w', newline='') as out:
        writer = csv.DictWriter(out, fieldnames=['date', 'z47_float', 'z47_mcap', 'n500_indexed', 'n500_abs'])
        writer.writeheader()
        writer.writerows(rows)

    cap_ledger.save(ROOT / 'data' / 'rebalances' / 'cap-ledger.json', ledger)

    events = json.loads(EVENTS.read_text())
    if not any(e.get('effective_date') == SWAP['effective_date'] for e in events):
        events.append({**SWAP, 'anchor_z47_float': round(last['level_fs'], 6),
                       'anchor_z47_mcap': round(last['level_ts'], 6)})
        EVENTS.write_text(json.dumps(events, indent=2) + '\n')

    print(f'ledger: {len(ledger)} resets, latest {last["effective_date"]} priced {anchor} '
          f'level {last["level_fs"]:.6f} / mcap {last["level_ts"]:.6f}; 26 Oct replay {replay:.6f}')
    print(f'history: {len(expected)} rows restated, NSE-holiday rows dropped {holidays}, '
          f'rows after {anchor} dropped for recomputation')


if __name__ == '__main__':
    main()
