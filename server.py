#!/usr/bin/env python3
"""
Simple HTTP server to serve the Bird Game locally
"""
import http.server
import socketserver
import webbrowser
import os
import sys

PORT = 3000

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

def start_server():
    # Change to the game directory
    game_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(game_dir)
    
    # Create server
    with socketserver.TCPServer(("", PORT), CustomHTTPRequestHandler) as httpd:
        print(f"🐦 Bird Game Server starting...")
        print(f"📍 Serving at: http://localhost:{PORT}")
        print(f"📁 Directory: {game_dir}")
        print(f"🎮 Open http://localhost:{PORT} in your browser to play!")
        print(f"⏹️  Press Ctrl+C to stop the server")
        
        try:
            # Try to open browser automatically
            webbrowser.open(f'http://localhost:{PORT}')
        except:
            pass
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print(f"\n🛑 Server stopped.")
            sys.exit(0)

if __name__ == "__main__":
    start_server()
