import * as universal from '../entries/pages/alpine/_page.js';

export const index = 3;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/alpine/_page.svelte.js')).default;
export { universal };
export const universal_id = "src/routes/alpine/+page.js";
export const imports = ["_app/immutable/nodes/3.4QbR_Bft.js","_app/immutable/chunks/Bo03LDfb.js","_app/immutable/chunks/DJStFLsK.js","_app/immutable/chunks/DTp_M1bc.js","_app/immutable/chunks/CmsKOCeN.js","_app/immutable/chunks/BYzENXOr.js","_app/immutable/chunks/DQGJdaFZ.js"];
export const stylesheets = ["_app/immutable/assets/WebVM.g-BWG2r0.css"];
export const fonts = ["_app/immutable/assets/fa-brands-400.D_cYUPeE.woff2","_app/immutable/assets/fa-brands-400.D1LuMI3I.ttf","_app/immutable/assets/fa-regular-400.BjRzuEpd.woff2","_app/immutable/assets/fa-regular-400.DZaxPHgR.ttf","_app/immutable/assets/fa-solid-900.CTAAxXor.woff2","_app/immutable/assets/fa-solid-900.D0aA9rwL.ttf","_app/immutable/assets/fa-v4compatibility.C9RhG_FT.woff2","_app/immutable/assets/fa-v4compatibility.CCth-dXg.ttf"];
