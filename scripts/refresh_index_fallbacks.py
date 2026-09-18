"""Refresh the page's offline snapshots from an already validated index feed."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def main():
    data = json.loads((ROOT / 'z47_index.json').read_text())
    if len(data['constituents']) != 47 or data['meta']['constituents_priced'] != 47:
        raise ValueError('Refusing to snapshot an incomplete index')
    snapshots = [
        ('01-performance.js', 'Z47_FALLBACK', data),
        ('02-sector-pie.js', 'FALLBACK', data['sectors']),
        ('03-constituents-table.js', 'FALLBACK', data['constituents']),
    ]
    for filename, variable, snapshot in snapshots:
        path = ROOT / 'staging' / 'js' / filename
        script = path.read_text()
        assignment = '  var ' + variable + ' = ' + json.dumps(snapshot, separators=(',', ':'), ensure_ascii=True) + ';'
        script, count = re.subn(r'^  var ' + variable + r' = .*?;[ \t]*$', lambda m: assignment, script, count=1, flags=re.M | re.S)
        if count != 1:
            raise ValueError(f'Could not locate {variable} in {filename}')
        path.write_text(script)
    print('Updated three fallback snapshots from', data['meta']['generated_at_ist'])

if __name__ == '__main__':
    main()
