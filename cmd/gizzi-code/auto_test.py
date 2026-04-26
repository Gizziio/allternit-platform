#!/usr/bin/env python3
import pexpect
import sys
import time

# Start gizzi-code
child = pexpect.spawn(
    "bun", 
    ["run", "--conditions=browser", "./src/cli/main.ts", "ses_311b7be49ffedE2BLlbAbxvIOE"],
    cwd="/Users/macbook/Desktop/allternit-workspace/allternit/cmd/gizzi-code",
    timeout=30
)

# Log output
child.logfile = sys.stdout.buffer

print("[AUTO TEST] Waiting for TUI to load...")
time.sleep(5)

print("[AUTO TEST] Sending test message...")
child.sendline("test message for debugging")

time.sleep(2)

print("[AUTO TEST] Waiting for error or response...")
try:
    child.expect("TextNodeRenderable only accepts", timeout=10)
    print("\n[AUTO TEST] ERROR CAUGHT!")
except pexpect.TIMEOUT:
    print("\n[AUTO TEST] No error within timeout")
except pexpect.EOF:
    print("\n[AUTO TEST] Process ended")

child.close()
