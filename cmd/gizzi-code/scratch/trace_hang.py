import subprocess
import time
import os
import signal

proc = subprocess.Popen(['/opt/homebrew/bin/gizzi-code'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

time.sleep(3)

if proc.poll() is None:
    print("Process is running (hanging)...")
    # Send SIGQUIT (Ctrl+\) to generate a thread/stack dump if supported, or SIGINT
    proc.send_signal(signal.SIGINT)
    stdout, stderr = proc.communicate(timeout=5)
    print("STDOUT:", stdout)
    print("STDERR:", stderr)
else:
    print("Process exited with code:", proc.poll())
    stdout, stderr = proc.communicate()
    print("STDOUT:", stdout)
    print("STDERR:", stderr)
