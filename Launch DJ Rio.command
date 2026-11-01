#!/bin/bash
# Double-click on macOS (or run on Linux) to open the DJ Río site on http://localhost:5287
cd "$(dirname "$0")"
exec python3 serve.py
