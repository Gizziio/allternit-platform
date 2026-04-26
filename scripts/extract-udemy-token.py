#!/usr/bin/env python3
"""
Extract Udemy access_token from Chrome cookies on macOS.
Uses pycookiecheat which handles Chrome's encrypted cookies correctly.
"""

import sys
import os

# Use the venv where pycookiecheat is installed
VENV_PYTHON = "/tmp/udemy-venv/bin/python3"

if os.path.exists(VENV_PYTHON):
    import subprocess
    result = subprocess.run(
        [VENV_PYTHON, "-c",
         "from pycookiecheat import chrome_cookies; "
         "token = chrome_cookies('https://www.udemy.com').get('access_token', ''); "
         "print(token)"],
        capture_output=True, text=True
    )
    token = result.stdout.strip()
    if token:
        print(token)
        sys.exit(0)
    else:
        print("No access_token found. Make sure you are logged in to Udemy in Chrome.", file=sys.stderr)
        sys.exit(1)
else:
    print("pycookiecheat not installed. Run: python3 -m venv /tmp/udemy-venv && /tmp/udemy-venv/bin/pip install pycookiecheat", file=sys.stderr)
    sys.exit(1)
