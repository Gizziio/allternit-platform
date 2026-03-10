import http.server
import socketserver
import json

PORT = 3016

class MockHandler(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path == "/api/v1/rails/gate/autoland":
            content_length = int(self.headers['Content-Length'])
            post_data = json.loads(self.rfile.read(content_length))
            wih_id = post_data.get("wih_id", "unknown")
            dry_run = post_data.get("dry_run", False)
            
            response = {
                "result": {
                    "success": not dry_run,
                    "dry_run": dry_run,
                    "impact": {
                        "added": ["src/autoland_demo.rs", "docs/AUTOLAND.md"],
                        "modified": ["src/lib.rs"],
                        "deleted": []
                    },
                    "backup_dir": f".a2r/backups/{wih_id}_1709856000" if not dry_run else None
                }
            }
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(response).encode())

    def do_GET(self):
        if "/proof_of_work" in self.path:
            response = {
                "events": [
                    {"timestamp": "2026-03-08T12:00:00Z", "type": "terminal.output", "payload": {"message": "Running tests..."}},
                    {"timestamp": "2026-03-08T12:00:05Z", "type": "terminal.output", "payload": {"message": "All tests PASSED."}},
                    {"timestamp": "2026-03-08T12:00:10Z", "type": "agent.thought", "payload": {"message": "Implementation complete. Requesting land."}}
                ]
            }
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(response).encode())

with socketserver.TCPServer(("", PORT), MockHandler) as httpd:
    print(f"Mock API serving at port {PORT}")
    httpd.serve_forever()
