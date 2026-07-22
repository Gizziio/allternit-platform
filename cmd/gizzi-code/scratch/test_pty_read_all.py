import pty
import os
import time
import select
import sys
import fcntl
import termios
import struct

master, slave = pty.openpty()

# Set PTY size to 80 cols, 24 rows
fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack('HHHH', 24, 80, 0, 0))

pid = os.fork()
if pid == 0:
    os.setsid()
    os.dup2(slave, 0)
    os.dup2(slave, 1)
    os.dup2(slave, 2)
    os.close(master)
    os.close(slave)
    os.environ['TERM'] = 'xterm-256color'
    os.execv('/opt/homebrew/bin/gizzi-code', ['gizzi-code'])
else:
    os.close(slave)
    time.sleep(2)
    
    print("\n=== PTY READ AT 2 SECONDS (WITH TIOCSWINSZ) ===")
    r, _, _ = select.select([master], [], [], 3.0)
    if master in r:
        data = os.read(master, 4096)
        print("RECEIVED BYTES:", repr(data))
    else:
        print("NO DATA RECEIVED ON PTY MASTER AT 2 SECONDS!")

    os.kill(pid, 9)
