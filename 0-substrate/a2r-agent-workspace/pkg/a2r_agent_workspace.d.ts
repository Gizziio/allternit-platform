/* tslint:disable */
/* eslint-disable */
/**
* Initialize the WASM module
*/
export function start(): void;
/**
* Standalone policy check function
* @param {any} request_js
* @returns {any}
*/
export function checkPolicy(request_js: any): any;
/**
* Core files that should be present in a valid workspace
* @returns {any}
*/
export function getCoreFiles(): any;
/**
* Workspace API exposed to JavaScript
*/
export class WorkspaceApi {
  free(): void;
/**
* Check if a tool is allowed (placeholder implementation)
* @param {string} tool_id
* @returns {any}
*/
  checkTool(tool_id: string): any;
/**
* Get workspace metadata (placeholder - returns default structure)
* @returns {any}
*/
  getMetadata(): any;
/**
* Validate workspace structure (basic check)
* @param {any} files
* @returns {any}
*/
  validateStructure(files: any): any;
/**
* Create a new workspace API handle
* @param {string} path
*/
  constructor(path: string);
/**
* Boot the workspace (simulated for WASM - in real implementation, 
* the Shell UI would use the HTTP backend to an actual server)
* @returns {Promise<any>}
*/
  boot(): Promise<any>;
/**
* Get the workspace path
*/
  readonly path: string;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_workspaceapi_free: (a: number) => void;
  readonly checkPolicy: (a: number) => number;
  readonly getCoreFiles: () => number;
  readonly workspaceapi_boot: (a: number) => number;
  readonly workspaceapi_checkTool: (a: number, b: number, c: number) => number;
  readonly workspaceapi_getMetadata: (a: number) => number;
  readonly workspaceapi_new: (a: number, b: number) => number;
  readonly workspaceapi_path: (a: number, b: number) => void;
  readonly workspaceapi_validateStructure: (a: number, b: number) => number;
  readonly start: () => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_export_2: WebAssembly.Table;
  readonly _dyn_core__ops__function__FnMut__A____Output___R_as_wasm_bindgen__closure__WasmClosure___describe__invoke__hd9f2a573f74e7684: (a: number, b: number, c: number) => void;
  readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly wasm_bindgen__convert__closures__invoke2_mut__hb2d2efc5eb2aceab: (a: number, b: number, c: number, d: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {SyncInitInput} module
*
* @returns {InitOutput}
*/
export function initSync(module: SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {InitInput | Promise<InitInput>} module_or_path
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: InitInput | Promise<InitInput>): Promise<InitOutput>;
