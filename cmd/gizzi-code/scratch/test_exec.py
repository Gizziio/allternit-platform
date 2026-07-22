import subprocess
import sys

res = subprocess.run(['/opt/homebrew/bin/gizzi-code', '--version'], capture_output=True, text=True)
print("VERSION STDOUT:", res.stdout)
print("VERSION STDERR:", res.stderr)

res2 = subprocess.run(['/opt/homebrew/bin/gizzi-code', 'models'], capture_output=True, text=True)
print("MODELS STDOUT LINE COUNT:", len(res2.stdout.splitlines()))
