"""Servidor local sin caché para desarrollar: python3 tools/serve.py [puerto]"""
import functools
import http.server
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
handler = functools.partial(NoCache, directory=ROOT)
print(f"How Many Pokémon? en http://localhost:{port}")
http.server.ThreadingHTTPServer(("", port), handler).serve_forever()
