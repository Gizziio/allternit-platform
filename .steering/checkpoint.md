Goal: forward runtimeId from renderer through preload + IPC into the fabric-session BrowserWindow URL (?runtime=)
Just did: edited surfaces/allternit-desktop/src/main/unified-main.ts (openFabricSessionWindow takes runtimeId, sets ?runtime=) and src/preload/index.ts (openRemoteControl/openFabricSession accept + forward runtimeId); tsc --noEmit clean; release-preflight 52/0
Next: commit, push, PR, merge
Open questions: none
