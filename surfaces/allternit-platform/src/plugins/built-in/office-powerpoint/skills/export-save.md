# Skill: Export and Save

## Trigger
Use this skill when saving, exporting the presentation as a file, or getting document metadata.

## Get Document URL / File Path
```javascript
const url = Office.context.document.url;
// Returns: "https://..." for SharePoint/OneDrive, or a local path for desktop
return { url, filename: url.split("/").pop() ?? "presentation.pptx" };
```

## Export as .pptx Binary (Base64)
```javascript
// Uses the Office File API — not the PowerPoint.run context
function exportPresentation(): Promise<string> {
  return new Promise((resolve, reject) => {
    Office.context.document.getFileAsync(
      Office.FileType.Compressed, // .pptx format
      { sliceSize: 65536 },       // 64KB chunks
      (fileResult) => {
        if (fileResult.status !== Office.AsyncResultStatus.Succeeded) {
          return reject(new Error(fileResult.error.message));
        }

        const file = fileResult.value;
        const slices: number[][] = [];
        let sliceIndex = 0;

        function readNextSlice() {
          file.getSliceAsync(sliceIndex, (sliceResult) => {
            if (sliceResult.status !== Office.AsyncResultStatus.Succeeded) {
              file.closeAsync();
              return reject(new Error(sliceResult.error.message));
            }

            slices.push(Array.from(new Uint8Array(sliceResult.value.data)));
            sliceIndex++;

            if (sliceIndex < file.sliceCount) {
              readNextSlice();
            } else {
              file.closeAsync();
              const combined = new Uint8Array(slices.flat());
              // Convert to base64
              let binary = "";
              combined.forEach(b => { binary += String.fromCharCode(b); });
              resolve(btoa(binary));
            }
          });
        }

        readNextSlice();
      }
    );
  });
}
```

## Trigger Browser Download of Exported File
```javascript
const base64 = await exportPresentation();
const blob = new Blob(
  [Uint8Array.from(atob(base64), c => c.charCodeAt(0))],
  { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" }
);
const link = document.createElement("a");
link.href = URL.createObjectURL(blob);
link.download = "presentation.pptx";
link.click();
URL.revokeObjectURL(link.href);
```

## Notify User to Save Manually
```javascript
// Office add-ins cannot programmatically trigger Ctrl+S.
// Display a message in the task pane instead.
return {
  message: "To save, use Ctrl+S or File → Save in PowerPoint.",
  shortcut: "Ctrl+S",
};
```

## Check If Document Is Read-Only
```javascript
const mode = Office.context.document.mode;
const isReadOnly = mode === Office.DocumentMode.ReadOnly;
return { isReadOnly };
```

## Safety Rules
- Always call `file.closeAsync()` after reading all slices — forgetting this leaks a file handle
- Slice size of 65536 (64KB) is the recommended maximum; larger values may fail on some hosts
- The file export produces the current saved state, not unsaved changes — remind users to save first
- `Office.FileType.Compressed` is the only format available for PowerPoint (.pptx)
- The task pane runs in a browser sandbox — downloads go to the user's browser Downloads folder
