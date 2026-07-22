import pty
import os
import time
import select
import sys

master, slave = pty.openpty()

pid = os.fork()
if pid == 0:
    os.setsid()
    os.dup2(slave, 0)
    os.dup2(slave, 1)
    os.dup2(slave, 2)
    os.close(master)
    os.close(slave)
    os.execv('/opt/homebrew/bin/gizzi-code', ['gizzi-code'])
else:
    os.close(slave)
    
    # Wait 3 seconds for TUI to mount
    time.sleep(3)
    
    # Send a query followed by Carriage Return \r (raw terminal Enter)
    print("\n--- SENDING USER PROMPT (WITH \\r) TO REPL ---\n")
    os.write(master, b"say hello\r")
    
    start_time = time.time()
    while time.time() - start_time < 15:
        r, _, _ = select.select([master], [], [], 0.5)
        if master in r:
            try:
                data = os.read(master, 2048)
                if not data:
                    break
                text = data.decode('utf-8', errors='ignore')
                sys.stdout.write(text)
                sys.stdout.flush()
            except OSError:
                break

    print("\n--- END OF REPL TEST ---")
