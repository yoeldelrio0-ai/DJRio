#!/usr/bin/env python3
"""Serve the DJ Río site on http://localhost:5287 and open it in the browser."""
import functools, http.server, os, socketserver, sys, threading, webbrowser
PORT = int(os.environ.get("RIO_PORT", "5287"))
ROOT = os.path.dirname(os.path.abspath(__file__))
class H(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".webp": "image/webp", ".js": "text/javascript", ".woff2": "font/woff2"}
    def log_message(self, *a): pass
socketserver.ThreadingTCPServer.allow_reuse_address = True
with socketserver.ThreadingTCPServer(("127.0.0.1", PORT), functools.partial(H, directory=ROOT)) as srv:
    url = f"http://localhost:{PORT}/"
    print(f"DJ Río is running at {url}  (Ctrl+C to stop)")
    if "--no-open" not in sys.argv:
        threading.Timer(.6, lambda: webbrowser.open(url)).start()
    try: srv.serve_forever()
    except KeyboardInterrupt: pass
