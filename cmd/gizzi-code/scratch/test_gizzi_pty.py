import pty
import os
import time
import select
import sys

master, slave = pty.openpty()

pid = os.fork()
if pid == 0:
    # Child process: attach slave as tty
    os.setsid()
    os.dup2(slave, 0)
    os.dup2(slave, 1)
    os.dup2(slave, 2)
    os.close(master)
    os.close(slave)
    os.execv('/opt/homebrew/bin/gizzi-code', ['gizzi-code'])
else:
    os.close(slave)
    output = []
    start_time = time.time()
    
    # Read output for up to 10 seconds
    while time.time() - start_time < 10:
        r, _, _ = select.select([master], [], [], 0.5)
        if master in r:
            try:
                data = os.read(master, 1024)
                if not data:
                    break
                text = data.decode('utf-8', errors='ignore')
                output.append(text)
                sys.stdout.write(text)
                sys.stdout.flush()
            except OSError:
                break

    print("\n--- END OF PTY READ ---")
