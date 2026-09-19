Goal: fix @allternit/runtime packaging bug (dist layout mismatch vs package.json main)
Just did: removed tsconfig paths/baseUrl (root cause of inflated rootDir), added prepare build script, rebuilt dist, verified all gates
Next: commit, PR, merge
Open questions: none — the 3 runtime integration suites stay excluded (test APIs that never existed / need unbuilt lawlayer)
