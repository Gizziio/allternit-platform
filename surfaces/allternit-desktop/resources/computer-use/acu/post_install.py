#!/usr/bin/env python3
"""
Post-installation hook for allternit-computer-use.

Automatically runs after pip install to set up browser dependencies.
"""

import sys
import os

# Add the package directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def main():
    """Run post-install setup."""
    try:
        from adapters.browser.setup import post_install
        post_install()
    except ImportError as e:
        print(f"Note: Browser dependencies not available ({e})")
        print("Install with: pip install allternit-computer-use[browser]")
    except Exception as e:
        print(f"Warning: Post-install setup encountered an issue: {e}")
        print("You can manually run setup later with:")
        print("  python -m adapters.browser.setup")


if __name__ == "__main__":
    main()
