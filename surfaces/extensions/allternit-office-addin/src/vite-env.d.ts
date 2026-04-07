/// <reference types="vite/client" />

// Make the Office.js global namespaces available throughout the add-in source
// without needing to import them. @types/office-js declares Excel, Word,
// PowerPoint, Office, and OfficeExtension as ambient globals, but TypeScript
// only picks them up in files that are transitively included in the compilation.
// This file is included via "include": ["src"] in tsconfig.json and pulls in
// the full @types/office-js ambient declarations for every file in the project.
/// <reference types="office-js" />

// OfficeRuntime is the separate runtime SDK (auth, storage) not included in
// @types/office-js. Declare a minimal ambient type for the storage API we use.
declare namespace OfficeRuntime {
  const storage: {
    getItem(key: string): Promise<string | null>
    setItem(key: string, value: string): Promise<void>
    removeItem(key: string): Promise<void>
  }
}
