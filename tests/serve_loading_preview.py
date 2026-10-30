"""Local-only preview of real public-page markup with delayed/failed fixture feeds."""
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlsplit, parse_qs
import time

ROOT=Path(__file__).resolve().parents[1]
class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs): super().__init__(*args,directory=str(ROOT),**kwargs)
    def do_GET(self):
        url=urlsplit(self.path)
        if url.path=='/__feed':
            mode=parse_qs(url.query).get('mode',['ready'])[0]
            if mode=='loading': time.sleep(12)
            if mode=='error': self.send_error(503,'Fixture: feed unavailable');return
            payload=(ROOT/'data/cap-review/staging-feed.json').read_bytes()
            self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers()
            try:self.wfile.write(payload)
            except BrokenPipeError:pass
            return
        super().do_GET()
if __name__=='__main__': ThreadingHTTPServer(('127.0.0.1',8765),Handler).serve_forever()
