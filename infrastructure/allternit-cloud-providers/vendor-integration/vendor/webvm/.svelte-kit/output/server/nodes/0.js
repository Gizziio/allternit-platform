import * as server from '../entries/pages/_layout.server.js';

export const index = 0;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/fallbacks/layout.svelte.js')).default;
export { server };
export const server_id = "src/routes/+layout.server.js";
export const imports = ["_app/immutable/nodes/0.DMBmjjAc.js","_app/immutable/chunks/Bo03LDfb.js","_app/immutable/chunks/DJStFLsK.js"];
export const stylesheets = [];
export const fonts = [];
