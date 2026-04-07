import { c as create_ssr_component, v as validate_component, b as createEventDispatcher, d as add_attribute, e as escape, f as each, a as subscribe, h as get_store_value } from "./ssr.js";
import "@oddbird/popover-polyfill";
import { w as writable } from "./index.js";
import "html2canvas-pro";
import "@sveltejs/kit/internal";
import "./exports.js";
import "./utils.js";
import "@sveltejs/kit/internal/server";
import "./state.svelte.js";
const css$6 = {
  code: "li.svelte-1lmv0vp{height:1.5rem;margin:0}",
  map: '{"version":3,"file":"Item.svelte","sources":["Item.svelte"],"sourcesContent":["<li>\\n\\t<slot />\\n</li>\\n\\n<style>\\n\\tli {\\n\\t\\theight: 1.5rem;\\n\\t\\tmargin: 0; /* required to override style on cheerpj.com */\\n\\t}\\n</style>\\n"],"names":[],"mappings":"AAKC,iBAAG,CACF,MAAM,CAAE,MAAM,CACd,MAAM,CAAE,CACT"}'
};
const Item = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  $$result.css.add(css$6);
  return `<li class="svelte-1lmv0vp">${slots.default ? slots.default({}) : ``} </li>`;
});
const Tower_svg = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  return `<svg aria-hidden="true" fill="#e62755" viewBox="0 0 43.68 76.21"><path d="m28.6,75.76h-15.51L28.17,0h15.51l-15.08,75.76Z"></path><path d="m0,75.94c6.68-1.36,13.67-1.62,20.46-1.7,6.87.08,13.68.34,20.46,1.7v.2c-10.2.09-30.72.09-40.91,0v-.2h-.01Z"></path></svg>`;
});
const css$5 = {
  code: "a.svelte-1tqfk9x{display:flex;align-items:center;gap:0.75rem;height:100%;color:rgb(168 162 158);background:none;border:0;font:inherit;text-decoration:none;font-weight:600;cursor:pointer}a.svelte-1tqfk9x svg{height:100%}.company-name.svelte-1tqfk9x{color:white;white-space:nowrap}@media(max-width: 768px){.company-name.svelte-1tqfk9x{display:none}}",
  map: '{"version":3,"file":"Logotype.svelte","sources":["Logotype.svelte"],"sourcesContent":["<script>\\n\\timport Item from \\"./Item.svelte\\";\\n\\timport TowerLogo from \\"../logos/tower.svg.svelte\\";\\n<\/script>\\n\\n<Item>\\n\\t<a href=\\"https://leaningtech.com/\\" aria-label=\\"Leaning Technologies\\">\\n\\t\\t<TowerLogo />\\n\\t\\t<span class=\\"company-name\\">Leaning Technologies</span>\\n\\t</a>\\n</Item>\\n\\n<style>\\n\\ta {\\n\\t\\tdisplay: flex;\\n\\t\\talign-items: center;\\n\\t\\tgap: 0.75rem;\\n\\t\\theight: 100%;\\n\\n\\t\\tcolor: rgb(168 162 158);\\n\\t\\tbackground: none;\\n\\t\\tborder: 0;\\n\\t\\tfont: inherit;\\n\\t\\ttext-decoration: none;\\n\\t\\tfont-weight: 600;\\n\\n\\t\\tcursor: pointer;\\n\\t}\\n\\ta :global(svg) {\\n\\t\\theight: 100%;\\n\\t}\\n\\t.company-name {\\n\\t\\tcolor: white;\\n\\t\\twhite-space: nowrap;\\n\\t}\\n\\n\\t@media (max-width: 768px) {\\n\\t\\t.company-name {\\n\\t\\t\\tdisplay: none;\\n\\t\\t}\\n\\t}\\n</style>\\n"],"names":[],"mappings":"AAaC,gBAAE,CACD,OAAO,CAAE,IAAI,CACb,WAAW,CAAE,MAAM,CACnB,GAAG,CAAE,OAAO,CACZ,MAAM,CAAE,IAAI,CAEZ,KAAK,CAAE,IAAI,GAAG,CAAC,GAAG,CAAC,GAAG,CAAC,CACvB,UAAU,CAAE,IAAI,CAChB,MAAM,CAAE,CAAC,CACT,IAAI,CAAE,OAAO,CACb,eAAe,CAAE,IAAI,CACrB,WAAW,CAAE,GAAG,CAEhB,MAAM,CAAE,OACT,CACA,gBAAC,CAAS,GAAK,CACd,MAAM,CAAE,IACT,CACA,4BAAc,CACb,KAAK,CAAE,KAAK,CACZ,WAAW,CAAE,MACd,CAEA,MAAO,YAAY,KAAK,CAAE,CACzB,4BAAc,CACb,OAAO,CAAE,IACV,CACD"}'
};
const Logotype = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  $$result.css.add(css$5);
  return `${validate_component(Item, "Item").$$render($$result, {}, {}, {
    default: () => {
      return `<a href="https://leaningtech.com/" aria-label="Leaning Technologies" class="svelte-1tqfk9x">${validate_component(Tower_svg, "TowerLogo").$$render($$result, {}, {}, {})} <span class="company-name svelte-1tqfk9x" data-svelte-h="svelte-kh3ip0">Leaning Technologies</span></a>`;
    }
  })}`;
});
const css$4 = {
  code: "button.svelte-1624uv2{display:flex;align-items:center;height:100%;color:rgb(168 162 158);background:none;border:0;font:inherit;text-decoration:none;font-weight:600;cursor:pointer}svg.svelte-1624uv2{height:100%}",
  map: '{"version":3,"file":"Dropdown.svelte","sources":["Dropdown.svelte"],"sourcesContent":["<script>\\n\\timport { createEventDispatcher } from \\"svelte\\";\\n\\n\\timport Item from \\"./Item.svelte\\";\\n\\n\\tconst dispatch = createEventDispatcher();\\n\\n\\texport let title;\\n\\texport let popovertarget;\\n<\/script>\\n\\n<Item>\\n\\t<button {popovertarget} on:click={(evt) => dispatch(\\"click\\", evt)}>\\n\\t\\t{title}\\n\\t\\t<svg aria-hidden=\\"true\\" viewBox=\\"0 0 24 24\\">\\n\\t\\t\\t<path\\n\\t\\t\\t\\tstroke=\\"currentColor\\"\\n\\t\\t\\t\\tfill=\\"transparent\\"\\n\\t\\t\\t\\tstroke-linecap=\\"round\\"\\n\\t\\t\\t\\tstroke-linejoin=\\"round\\"\\n\\t\\t\\t\\tstroke-width=\\"2\\"\\n\\t\\t\\t\\td=\\"m8 10 4 4 4-4\\"\\n\\t\\t\\t/>\\n\\t\\t</svg>\\n\\t</button>\\n</Item>\\n\\n<style>\\n\\tbutton {\\n\\t\\tdisplay: flex;\\n\\t\\talign-items: center;\\n\\t\\theight: 100%;\\n\\n\\t\\tcolor: rgb(168 162 158);\\n\\t\\tbackground: none;\\n\\t\\tborder: 0;\\n\\t\\tfont: inherit;\\n\\t\\ttext-decoration: none;\\n\\t\\tfont-weight: 600;\\n\\n\\t\\tcursor: pointer;\\n\\t}\\n\\n\\tsvg {\\n\\t\\theight: 100%;\\n\\t}\\n</style>\\n"],"names":[],"mappings":"AA4BC,qBAAO,CACN,OAAO,CAAE,IAAI,CACb,WAAW,CAAE,MAAM,CACnB,MAAM,CAAE,IAAI,CAEZ,KAAK,CAAE,IAAI,GAAG,CAAC,GAAG,CAAC,GAAG,CAAC,CACvB,UAAU,CAAE,IAAI,CAChB,MAAM,CAAE,CAAC,CACT,IAAI,CAAE,OAAO,CACb,eAAe,CAAE,IAAI,CACrB,WAAW,CAAE,GAAG,CAEhB,MAAM,CAAE,OACT,CAEA,kBAAI,CACH,MAAM,CAAE,IACT"}'
};
const Dropdown = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  createEventDispatcher();
  let { title } = $$props;
  let { popovertarget } = $$props;
  if ($$props.title === void 0 && $$bindings.title && title !== void 0) $$bindings.title(title);
  if ($$props.popovertarget === void 0 && $$bindings.popovertarget && popovertarget !== void 0) $$bindings.popovertarget(popovertarget);
  $$result.css.add(css$4);
  return `${validate_component(Item, "Item").$$render($$result, {}, {}, {
    default: () => {
      return `<button${add_attribute("popovertarget", popovertarget, 0)} class="svelte-1624uv2">${escape(title)} <svg aria-hidden="true" viewBox="0 0 24 24" class="svelte-1624uv2"><path stroke="currentColor" fill="transparent" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m8 10 4 4 4-4"></path></svg></button>`;
    }
  })}`;
});
const css$3 = {
  code: "svg.svelte-1o705yj{color:rgb(168 162 158);height:1rem;margin:0 !important}li.svelte-1o705yj{margin:0 !important}",
  map: '{"version":3,"file":"SocialIcon.svelte","sources":["SocialIcon.svelte"],"sourcesContent":["<script>\\n\\texport let href;\\n\\texport let icon;\\n<\/script>\\n\\n<li>\\n\\t<a {href}>\\n\\t\\t{#if icon == \\"x\\"}\\n\\t\\t\\t<svg\\n\\t\\t\\t\\ttitle=\\"X\\"\\n\\t\\t\\t\\tclass=\\"global-navbar-social-icon\\"\\n\\t\\t\\t\\tviewBox=\\"0 0 1200 1227\\"\\n\\t\\t\\t\\tfill=\\"none\\"\\n\\t\\t\\t>\\n\\t\\t\\t\\t<path\\n\\t\\t\\t\\t\\td=\\"M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.137 519.284H714.163ZM569.165 687.828L521.697 619.934L144.011 79.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1150.3H892.476L569.165 687.854V687.828Z\\"\\n\\t\\t\\t\\t\\tfill=\\"currentColor\\"\\n\\t\\t\\t\\t/>\\n\\t\\t\\t</svg>\\n\\t\\t{:else if icon == \\"discord\\"}\\n\\t\\t\\t<svg class=\\"global-navbar-social-icon\\" viewBox=\\"0 0 127.14 96.36\\">\\n\\t\\t\\t\\t<path\\n\\t\\t\\t\\t\\tfill=\\"currentColor\\"\\n\\t\\t\\t\\t\\td=\\"M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z\\"\\n\\t\\t\\t\\t/>\\n\\t\\t\\t</svg>\\n\\t\\t{/if}\\n\\t</a>\\n</li>\\n\\n<style>\\n\\tsvg {\\n\\t\\tcolor: rgb(168 162 158);\\n\\t\\theight: 1rem;\\n\\t\\tmargin: 0 !important;\\n\\t}\\n\\n\\tli {\\n\\t\\tmargin: 0 !important;\\n\\t}\\n</style>\\n"],"names":[],"mappings":"AA+BC,kBAAI,CACH,KAAK,CAAE,IAAI,GAAG,CAAC,GAAG,CAAC,GAAG,CAAC,CACvB,MAAM,CAAE,IAAI,CACZ,MAAM,CAAE,CAAC,CAAC,UACX,CAEA,iBAAG,CACF,MAAM,CAAE,CAAC,CAAC,UACX"}'
};
const SocialIcon = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { href } = $$props;
  let { icon } = $$props;
  if ($$props.href === void 0 && $$bindings.href && href !== void 0) $$bindings.href(href);
  if ($$props.icon === void 0 && $$bindings.icon && icon !== void 0) $$bindings.icon(icon);
  $$result.css.add(css$3);
  return `<li class="svelte-1o705yj"><a${add_attribute("href", href, 0)}>${icon == "x" ? `<svg title="X" class="global-navbar-social-icon svelte-1o705yj" viewBox="0 0 1200 1227" fill="none"><path d="M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.137 519.284H714.163ZM569.165 687.828L521.697 619.934L144.011 79.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1150.3H892.476L569.165 687.854V687.828Z" fill="currentColor"></path></svg>` : `${icon == "discord" ? `<svg class="global-navbar-social-icon svelte-1o705yj" viewBox="0 0 127.14 96.36"><path fill="currentColor" d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"></path></svg>` : ``}`}</a> </li>`;
});
const css$2 = {
  code: "li.svelte-1ajf2bm{margin:0}a.svelte-1ajf2bm{color:white;text-decoration:none;padding:1rem;border-radius:8px;&:global(:has(svg)) {\n			/* <slot /> */\n			display: grid;\n			grid-template-rows: 1fr 1fr;\n			grid-template-columns: 3rem 1fr;\n			align-items: center;\n			gap: 0.5rem;\n\n			& :global(svg) {\n				grid-row: span 2;\n				width: 80%;\n				height: 100%;\n			}\n		}}span.svelte-1ajf2bm{color:rgb(168 162 158)}",
  map: '{"version":3,"file":"BigIcon.svelte","sources":["BigIcon.svelte"],"sourcesContent":["<script>\\n\\texport let href;\\n\\texport let title;\\n\\texport let description;\\n<\/script>\\n\\n<li>\\n\\t<a {href}>\\n\\t\\t<slot />\\n\\t\\t<b>{title}</b>\\n\\t\\t<span>{description}</span>\\n\\t</a>\\n</li>\\n\\n<style>\\n\\tli {\\n\\t\\tmargin: 0; /* required to override style on cheerpj.com */\\n\\t}\\n\\n\\ta {\\n\\t\\tcolor: white;\\n\\t\\ttext-decoration: none;\\n\\n\\t\\tpadding: 1rem;\\n\\t\\tborder-radius: 8px;\\n\\n\\t\\t&:global(:has(svg)) {\\n\\t\\t\\t/* <slot /> */\\n\\t\\t\\tdisplay: grid;\\n\\t\\t\\tgrid-template-rows: 1fr 1fr;\\n\\t\\t\\tgrid-template-columns: 3rem 1fr;\\n\\t\\t\\talign-items: center;\\n\\t\\t\\tgap: 0.5rem;\\n\\n\\t\\t\\t& :global(svg) {\\n\\t\\t\\t\\tgrid-row: span 2;\\n\\t\\t\\t\\twidth: 80%;\\n\\t\\t\\t\\theight: 100%;\\n\\t\\t\\t}\\n\\t\\t}\\n\\t}\\n\\n\\tspan {\\n\\t\\tcolor: rgb(168 162 158);\\n\\t}\\n</style>\\n"],"names":[],"mappings":"AAeC,iBAAG,CACF,MAAM,CAAE,CACT,CAEA,gBAAE,CACD,KAAK,CAAE,KAAK,CACZ,eAAe,CAAE,IAAI,CAErB,OAAO,CAAE,IAAI,CACb,aAAa,CAAE,GAAG,CAElB,CAAC,QAAQ,SAAS,CAAC,CAAC;AACtB;AACA,GAAG,SAAS,IAAI;AAChB,GAAG,oBAAoB,GAAG,CAAC,GAAG;AAC9B,GAAG,uBAAuB,IAAI,CAAC,GAAG;AAClC,GAAG,aAAa,MAAM;AACtB,GAAG,KAAK,MAAM;;AAEd,GAAG,CAAC,CAAC,QAAQ,GAAG,CAAC,CAAC;AAClB,IAAI,UAAU,IAAI,CAAC,CAAC;AACpB,IAAI,OAAO,GAAG;AACd,IAAI,QAAQ,IAAI;AAChB;AACA,GACC,CAEA,mBAAK,CACJ,KAAK,CAAE,IAAI,GAAG,CAAC,GAAG,CAAC,GAAG,CACvB"}'
};
const BigIcon = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { href } = $$props;
  let { title } = $$props;
  let { description } = $$props;
  if ($$props.href === void 0 && $$bindings.href && href !== void 0) $$bindings.href(href);
  if ($$props.title === void 0 && $$bindings.title && title !== void 0) $$bindings.title(title);
  if ($$props.description === void 0 && $$bindings.description && description !== void 0) $$bindings.description(description);
  $$result.css.add(css$2);
  return `<li class="svelte-1ajf2bm"><a${add_attribute("href", href, 0)} class="svelte-1ajf2bm">${slots.default ? slots.default({}) : ``} <b>${escape(title)}</b> <span class="svelte-1ajf2bm">${escape(description)}</span></a> </li>`;
});
const css$1 = {
  code: "select.svelte-nv5o75{position:absolute;inset:0;width:100%;height:100%;opacity:0}",
  map: '{"version":3,"file":"SelectMenu.svelte","sources":["SelectMenu.svelte"],"sourcesContent":["<script>\\n\\t/** @type {{ [label: string]: { href: string, title: string }[] }} */\\n\\texport let menu;\\n\\n\\tfunction change(evt) {\\n\\t\\tconst title = evt.target.value;\\n\\n\\t\\t// Look up selected item and navigate to it\\n\\t\\tfor (const items of Object.values(menu)) {\\n\\t\\t\\tconst item = items.find((item) => item.title === title);\\n\\n\\t\\t\\tif (item) {\\n\\t\\t\\t\\twindow.location.href = item.href;\\n\\t\\t\\t\\tbreak;\\n\\t\\t\\t}\\n\\t\\t}\\n\\t}\\n<\/script>\\n\\n<select on:change={change}>\\n\\t<option selected disabled>Leaning Technologies</option>\\n\\t{#each Object.entries(menu) as [label, items]}\\n\\t\\t<optgroup {label}>\\n\\t\\t\\t{#each items as { title }}\\n\\t\\t\\t\\t<option>{title}</option>\\n\\t\\t\\t{/each}\\n\\t\\t</optgroup>\\n\\t{/each}\\n</select>\\n\\n<style>\\n\\tselect {\\n\\t\\tposition: absolute; /* NOTE: parent must be relative */\\n\\t\\tinset: 0;\\n\\t\\twidth: 100%;\\n\\t\\theight: 100%;\\n\\t\\topacity: 0; /* keep it clickable */\\n\\t}\\n</style>\\n"],"names":[],"mappings":"AA+BC,oBAAO,CACN,QAAQ,CAAE,QAAQ,CAClB,KAAK,CAAE,CAAC,CACR,KAAK,CAAE,IAAI,CACX,MAAM,CAAE,IAAI,CACZ,OAAO,CAAE,CACV"}'
};
const SelectMenu = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { menu } = $$props;
  if ($$props.menu === void 0 && $$bindings.menu && menu !== void 0) $$bindings.menu(menu);
  $$result.css.add(css$1);
  return `<select class="svelte-nv5o75"><option selected disabled value="Leaning Technologies" data-svelte-h="svelte-1iveerf">Leaning Technologies</option>${each(Object.entries(menu), ([label, items]) => {
    return `<optgroup${add_attribute("label", label, 0)}>${each(items, ({ title }) => {
      return `<option${add_attribute("value", title, 0)}>${escape(title)}</option>`;
    })}</optgroup>`;
  })}</select>`;
});
const Cheerp_svg = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  return `<svg aria-hidden="true" viewBox="0 0 79.37 89.83" fill="#fff"><polygon points="79.37 0 39.69 0 39.69 0 0 0 7.44 80.69 39.69 89.83 39.69 89.83 39.69 89.83 39.69 89.83 39.69 89.83 71.92 80.69" fill="#4fdbd1"></polygon><polygon fill="#56f4ec" points="39.69 6.57 39.69 82.99 39.69 82.99 65.8 75.59 72.16 6.57"></polygon><rect x="23.25" y="21.07" width="32.88" height="9.02"></rect><rect x="35.24" y="9.38" width="8.89" height="32.39"></rect><rect x="23.49" y="58.33" width="32.39" height="8.89"></rect><rect x="35.24" y="46.58" width="8.89" height="32.39"></rect><rect fill="#ebeaea" x="35.24" y="9.38" width="4.45" height="32.39"></rect><rect fill="#ebeaea" x="23.49" y="58.33" width="16.2" height="8.89"></rect><rect fill="#ebeaea" x="35.24" y="46.58" width="4.45" height="32.39"></rect></svg>`;
});
const Cheerpj_svg = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  return `<svg aria-hidden="true" viewBox="0 0 79.37 89.83"><polygon fill="#ff7c00" points="79.37 0 39.69 0 39.69 0 0 0 7.44 80.69 39.69 89.83 39.69 89.83 39.69 89.83 39.69 89.83 39.69 89.83 71.92 80.69"></polygon><path fill="#e2e2e2" d="M44.83,26.26a18.93,18.93,0,0,1,11.75,3.68c.33.26.65.53,1,.81a1.52,1.52,0,0,1,.52,1.61,1.66,1.66,0,0,1-1.3,1.17c-1.86.58-3.76,1.09-5.56,1.83a32.08,32.08,0,0,0-11.7,8.45,29.72,29.72,0,0,1-17.15,9.7,9.34,9.34,0,0,1-1.06.16,1.52,1.52,0,0,1-1.63-1.11,14.71,14.71,0,0,1-.61-6.75,19.3,19.3,0,0,1,7.2-12.21,31.39,31.39,0,0,1,14.93-7c.54-.1,1.09-.17,1.63-.22C43.56,26.32,44.31,26.29,44.83,26.26Z"></path><path fill="#e2e2e2" d="M36.75,65.34c-4.69-.06-8.59-1.14-12-3.83-.29-.24-.57-.49-.85-.74A1.65,1.65,0,0,1,23.28,59a1.77,1.77,0,0,1,1.39-1.23c1.84-.58,3.7-1.12,5.47-1.87A32.68,32.68,0,0,0,41.94,47,29.35,29.35,0,0,1,59.62,36.93a1.65,1.65,0,0,1,2.14,1.4,17.08,17.08,0,0,1-1.93,13.72,25.07,25.07,0,0,1-8.78,8.65,29.78,29.78,0,0,1-11.48,4.37C38.48,65.22,37.38,65.28,36.75,65.34Z"></path><polygon fill="#ff910d" points="39.86 7.62 39.86 84.04 39.86 84.04 66.14 76.64 72.55 7.62"></polygon><path fill="#fff" d="M56.45,30.82c-.32-.28-.66-.55-1-.81a20.48,20.48,0,0,0-12.28-3.68c-.55,0-1.33.06-2.1.12a7.53,7.53,0,0,0-1.05.22c-.28,0,.83.11-.15.16v16.1c3.94-3.21,6.28-5.8,10.63-7.5,1.88-.74,3.54-1.24,5.49-1.82a1.51,1.51,0,0,0,1.18-1.18A1.56,1.56,0,0,0,56.45,30.82Z"></path><path fill="#fff" d="M61,39.52a1.65,1.65,0,0,0-2.14-1.35,29.47,29.47,0,0,0-17.59,9.7c-.5.55-.46,1.08-1.44,1.59V65.14a29.39,29.39,0,0,0,10.55-4.07,24.48,24.48,0,0,0,8.73-8.34A15.87,15.87,0,0,0,61,39.52Z"></path></svg>`;
});
const Cheerpx_svg = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  return `<svg aria-hidden="true" viewBox="0 0 79.37 89.83"><polygon fill="#4b647f" points="79.37 0 39.69 0 39.69 0 0 0 7.44 80.69 39.69 89.83 39.69 89.83 39.69 89.83 39.69 89.83 39.69 89.83 71.92 80.69"></polygon><polygon fill="#6386a5" points="39.69 6.57 39.69 82.99 39.69 82.99 65.8 75.59 72.16 6.57"></polygon><path fill="#e2e2e2" d="M39.52,50.42a7.7,7.7,0,1,1,0-15.4h.17V19.66c-1.16,0-2.31,0-3.46,0a1,1,0,0,0-1.15.95c-.29,1.68-.55,3.36-.79,5.05a.61.61,0,0,1-.45.57c-.72.27-1.42.6-2.13.89a.48.48,0,0,1-.39,0q-1.84-1.41-3.66-2.83c-.88-.7-1.28-.71-2.2.05a34.62,34.62,0,0,0-4.54,4.6c-.57.7-.55,1.05,0,1.76l2.92,3.75a.42.42,0,0,1,0,.52c-.33.73-.65,1.45-.94,2.2a.45.45,0,0,1-.4.33c-1.57.23-3.13.49-4.7.69a1.59,1.59,0,0,0-1.4.89v7.22a1.45,1.45,0,0,0,1.35.9c1.56.2,3.11.44,4.66.67a.53.53,0,0,1,.49.4c.28.77.6,1.53.94,2.27a.56.56,0,0,1-.05.66c-1,1.23-1.93,2.48-2.88,3.73A1.26,1.26,0,0,0,21,56.57,45.34,45.34,0,0,0,25.7,61.3a1.08,1.08,0,0,0,1.67.1c1.34-1,2.67-2,4-3a.48.48,0,0,1,.37,0c.76.3,1.5.63,2.25.92a.39.39,0,0,1,.29.36c.24,1.61.51,3.22.73,4.84a1.42,1.42,0,0,0,.88,1.32h3.79V50.41Z"></path><path fill="#fff" d="M61.39,38.31l-4.88-.73a.5.5,0,0,1-.43-.37q-.45-1.17-1-2.31a.48.48,0,0,1,.05-.59c1-1.24,1.94-2.5,2.9-3.76A1.23,1.23,0,0,0,58,28.9a49.11,49.11,0,0,0-4.68-4.78A1.1,1.1,0,0,0,51.67,24l-4,3a.54.54,0,0,1-.41.06c-.75-.29-1.47-.62-2.22-.91a.4.4,0,0,1-.31-.38c-.25-1.7-.52-3.4-.78-5.09a1.08,1.08,0,0,0-1.19-1.05c-1,0-2,0-3.06,0V35a7.69,7.69,0,0,1,0,15.38V65.79h3.5A1.45,1.45,0,0,0,44,64.54c.24-1.62.5-3.23.73-4.84a.5.5,0,0,1,.35-.45c.74-.29,1.46-.62,2.2-.92a.51.51,0,0,1,.42.05c1.2.92,2.4,1.86,3.6,2.8.9.72,1.32.74,2.23,0a35.07,35.07,0,0,0,4.57-4.63c.56-.69.54-1.05,0-1.76l-2.9-3.72a.49.49,0,0,1-.06-.59c.34-.72.63-1.46,1-2.18a.5.5,0,0,1,.32-.27c1.68-.27,3.37-.53,5.06-.78A1.13,1.13,0,0,0,62.57,46c0-2.11,0-4.23,0-6.34A1.18,1.18,0,0,0,61.39,38.31Z"></path></svg>`;
});
const css = {
  code: ".navbar.svelte-fxjams{background:black;height:2.5rem;border-bottom:1px solid rgb(68 64 60);display:flex;justify-content:space-between}.items.svelte-fxjams{display:flex;height:100%;align-items:center;padding:0 1rem;margin:0;list-style:none;gap:1rem;position:relative}#global-navbar-technology.svelte-fxjams,#global-navbar-resources.svelte-fxjams{position:absolute;background:linear-gradient(to bottom right, black, rgb(28, 25, 23));border:1px solid rgb(41 37 36);border-radius:12px;box-shadow:0 2px 1rem rgba(0, 0, 0, 0.5);padding:1.5rem;& ul {\n			padding: 0;\n			margin: 0;\n			list-style: none;\n\n			display: flex;\n			flex-direction: column;\n			gap: 0.5rem;\n\n			& a {\n				color: white;\n				text-decoration: none;\n\n				padding: 1rem;\n				border-radius: 8px;\n\n				&:has(svg) {\n					display: grid;\n					grid-template-rows: 1fr 1fr;\n					grid-template-columns: 3rem 1fr;\n					align-items: center;\n					gap: 0.5rem;\n\n					& svg {\n						grid-row: span 2;\n						width: 80%;\n						height: 100%;\n					}\n\n					& span {\n						color: rgb(168 162 158);\n					}\n				}\n			}\n		}}#global-navbar-technology.svelte-fxjams{inset:3rem 6rem auto auto}#global-navbar-resources.svelte-fxjams{inset:3rem 3rem auto auto}@media(max-width: 768px){.desktop-only.svelte-fxjams{display:none !important}}@media(min-width: 769px){.mobile-only.svelte-fxjams{display:none !important}}",
  map: '{"version":3,"file":"Nav.svelte","sources":["Nav.svelte"],"sourcesContent":["<script>\\n\\timport \\"@oddbird/popover-polyfill\\"; // https://caniuse.com/mdn-api_htmlelement_popover\\n\\n\\timport LogotypeItem from \\"./items/Logotype.svelte\\";\\n\\timport DropdownItem from \\"./items/Dropdown.svelte\\";\\n\\timport SocialIconItem from \\"./items/SocialIcon.svelte\\";\\n\\n\\timport BigIconItem from \\"./popover/BigIcon.svelte\\";\\n\\n\\timport SelectMenu from \\"./SelectMenu.svelte\\";\\n\\n\\timport CheerpLogo from \\"./logos/cheerp.svg.svelte\\";\\n\\timport CheerpJLogo from \\"./logos/cheerpj.svg.svelte\\";\\n\\timport CheerpXLogo from \\"./logos/cheerpx.svg.svelte\\";\\n\\n\\tconst mobileMenu = {\\n\\t\\tTechnology: [\\n\\t\\t\\t{\\n\\t\\t\\t\\thref: \\"https://cheerp.io/\\",\\n\\t\\t\\t\\ttitle: \\"Cheerp\\",\\n\\t\\t\\t},\\n\\t\\t\\t{\\n\\t\\t\\t\\thref: \\"https://cheerpj.com/\\",\\n\\t\\t\\t\\ttitle: \\"CheerpJ\\",\\n\\t\\t\\t},\\n\\t\\t\\t{\\n\\t\\t\\t\\thref: \\"https://cheerpx.io/\\",\\n\\t\\t\\t\\ttitle: \\"CheerpX\\",\\n\\t\\t\\t},\\n\\t\\t],\\n\\t\\tResources: [\\n\\t\\t\\t{\\n\\t\\t\\t\\thref: \\"https://labs.leaningtech.com/\\",\\n\\t\\t\\t\\ttitle: \\"Developer Hub\\",\\n\\t\\t\\t},\\n\\t\\t\\t{\\n\\t\\t\\t\\thref: \\"https://labs.leaningtech.com/blog\\",\\n\\t\\t\\t\\ttitle: \\"Blog\\",\\n\\t\\t\\t},\\n\\t\\t\\t{\\n\\t\\t\\t\\thref: \\"https://github.com/leaningtech\\",\\n\\t\\t\\t\\ttitle: \\"GitHub\\",\\n\\t\\t\\t},\\n\\t\\t],\\n\\t};\\n<\/script>\\n\\n<nav aria-label=\\"Primary\\" class=\\"navbar\\">\\n\\t<ul class=\\"items\\">\\n\\t\\t<LogotypeItem />\\n\\t</ul>\\n\\t<ul class=\\"items desktop-only\\">\\n\\t\\t<DropdownItem title=\\"Technology\\" popovertarget=\\"global-navbar-technology\\" />\\n\\t\\t<DropdownItem title=\\"Resources\\" popovertarget=\\"global-navbar-resources\\" />\\n\\t\\t<SocialIconItem href=\\"https://discord.leaningtech.com\\" icon=\\"discord\\" />\\n\\t\\t<SocialIconItem href=\\"https://x.com/leaningtech\\" icon=\\"x\\" />\\n\\t</ul>\\n\\t<ul class=\\"items mobile-only\\">\\n\\t\\t<DropdownItem title=\\"Leaning Technologies\\" />\\n\\t\\t<SelectMenu menu={mobileMenu} />\\n\\t</ul>\\n</nav>\\n\\n<nav popover aria-label=\\"Technology\\" id=\\"global-navbar-technology\\">\\n\\t<ul>\\n\\t\\t<BigIconItem\\n\\t\\t\\thref=\\"https://cheerp.io/\\"\\n\\t\\t\\ttitle=\\"Cheerp\\"\\n\\t\\t\\tdescription=\\"C++ to Wasm/JS compiler\\"\\n\\t\\t>\\n\\t\\t\\t<CheerpLogo />\\n\\t\\t</BigIconItem>\\n\\t\\t<BigIconItem\\n\\t\\t\\thref=\\"https://cheerpj.com/\\"\\n\\t\\t\\ttitle=\\"CheerpJ\\"\\n\\t\\t\\tdescription=\\"Java runtime for browsers\\"\\n\\t\\t>\\n\\t\\t\\t<CheerpJLogo />\\n\\t\\t</BigIconItem>\\n\\t\\t<BigIconItem\\n\\t\\t\\thref=\\"https://cheerpx.io/\\"\\n\\t\\t\\ttitle=\\"CheerpX\\"\\n\\t\\t\\tdescription=\\"Virtual machines for the web\\"\\n\\t\\t>\\n\\t\\t\\t<CheerpXLogo />\\n\\t\\t</BigIconItem>\\n\\t</ul>\\n</nav>\\n\\n<nav popover aria-label=\\"Resources\\" id=\\"global-navbar-resources\\">\\n\\t<ul>\\n\\t\\t<li>\\n\\t\\t\\t<a href=\\"https://labs.leaningtech.com/\\"> Developer Hub </a>\\n\\t\\t</li>\\n\\t\\t<li>\\n\\t\\t\\t<a href=\\"https://labs.leaningtech.com/blog\\"> Blog </a>\\n\\t\\t</li>\\n\\t\\t<li>\\n\\t\\t\\t<a href=\\"https://github.com/leaningtech\\"> GitHub </a>\\n\\t\\t</li>\\n\\t</ul>\\n</nav>\\n\\n<style>\\n\\t.navbar {\\n\\t\\tbackground: black;\\n\\t\\theight: 2.5rem;\\n\\t\\tborder-bottom: 1px solid rgb(68 64 60);\\n\\n\\t\\tdisplay: flex;\\n\\t\\tjustify-content: space-between;\\n\\t}\\n\\n\\t.items {\\n\\t\\tdisplay: flex;\\n\\t\\theight: 100%;\\n\\t\\talign-items: center;\\n\\n\\t\\tpadding: 0 1rem;\\n\\t\\tmargin: 0;\\n\\t\\tlist-style: none;\\n\\n\\t\\tgap: 1rem;\\n\\n\\t\\tposition: relative; /* for .select */\\n\\t}\\n\\n\\t#global-navbar-technology,\\n\\t#global-navbar-resources {\\n\\t\\tposition: absolute;\\n\\n\\t\\tbackground: linear-gradient(to bottom right, black, rgb(28, 25, 23));\\n\\t\\tborder: 1px solid rgb(41 37 36);\\n\\t\\tborder-radius: 12px;\\n\\t\\tbox-shadow: 0 2px 1rem rgba(0, 0, 0, 0.5);\\n\\n\\t\\tpadding: 1.5rem;\\n\\n\\t\\t& ul {\\n\\t\\t\\tpadding: 0;\\n\\t\\t\\tmargin: 0;\\n\\t\\t\\tlist-style: none;\\n\\n\\t\\t\\tdisplay: flex;\\n\\t\\t\\tflex-direction: column;\\n\\t\\t\\tgap: 0.5rem;\\n\\n\\t\\t\\t& a {\\n\\t\\t\\t\\tcolor: white;\\n\\t\\t\\t\\ttext-decoration: none;\\n\\n\\t\\t\\t\\tpadding: 1rem;\\n\\t\\t\\t\\tborder-radius: 8px;\\n\\n\\t\\t\\t\\t&:has(svg) {\\n\\t\\t\\t\\t\\tdisplay: grid;\\n\\t\\t\\t\\t\\tgrid-template-rows: 1fr 1fr;\\n\\t\\t\\t\\t\\tgrid-template-columns: 3rem 1fr;\\n\\t\\t\\t\\t\\talign-items: center;\\n\\t\\t\\t\\t\\tgap: 0.5rem;\\n\\n\\t\\t\\t\\t\\t& svg {\\n\\t\\t\\t\\t\\t\\tgrid-row: span 2;\\n\\t\\t\\t\\t\\t\\twidth: 80%;\\n\\t\\t\\t\\t\\t\\theight: 100%;\\n\\t\\t\\t\\t\\t}\\n\\n\\t\\t\\t\\t\\t& span {\\n\\t\\t\\t\\t\\t\\tcolor: rgb(168 162 158);\\n\\t\\t\\t\\t\\t}\\n\\t\\t\\t\\t}\\n\\t\\t\\t}\\n\\t\\t}\\n\\t}\\n\\n\\t#global-navbar-technology {\\n\\t\\tinset: 3rem 6rem auto auto;\\n\\t}\\n\\n\\t#global-navbar-resources {\\n\\t\\tinset: 3rem 3rem auto auto;\\n\\t}\\n\\n\\t@media (max-width: 768px) {\\n\\t\\t.desktop-only {\\n\\t\\t\\tdisplay: none !important;\\n\\t\\t}\\n\\t}\\n\\n\\t@media (min-width: 769px) {\\n\\t\\t.mobile-only {\\n\\t\\t\\tdisplay: none !important;\\n\\t\\t}\\n\\t}\\n</style>\\n"],"names":[],"mappings":"AAwGC,qBAAQ,CACP,UAAU,CAAE,KAAK,CACjB,MAAM,CAAE,MAAM,CACd,aAAa,CAAE,GAAG,CAAC,KAAK,CAAC,IAAI,EAAE,CAAC,EAAE,CAAC,EAAE,CAAC,CAEtC,OAAO,CAAE,IAAI,CACb,eAAe,CAAE,aAClB,CAEA,oBAAO,CACN,OAAO,CAAE,IAAI,CACb,MAAM,CAAE,IAAI,CACZ,WAAW,CAAE,MAAM,CAEnB,OAAO,CAAE,CAAC,CAAC,IAAI,CACf,MAAM,CAAE,CAAC,CACT,UAAU,CAAE,IAAI,CAEhB,GAAG,CAAE,IAAI,CAET,QAAQ,CAAE,QACX,CAEA,uCAAyB,CACzB,sCAAyB,CACxB,QAAQ,CAAE,QAAQ,CAElB,UAAU,CAAE,gBAAgB,EAAE,CAAC,MAAM,CAAC,KAAK,CAAC,CAAC,KAAK,CAAC,CAAC,IAAI,EAAE,CAAC,CAAC,EAAE,CAAC,CAAC,EAAE,CAAC,CAAC,CACpE,MAAM,CAAE,GAAG,CAAC,KAAK,CAAC,IAAI,EAAE,CAAC,EAAE,CAAC,EAAE,CAAC,CAC/B,aAAa,CAAE,IAAI,CACnB,UAAU,CAAE,CAAC,CAAC,GAAG,CAAC,IAAI,CAAC,KAAK,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,GAAG,CAAC,CAEzC,OAAO,CAAE,MAAM,CAEf,CAAC,CAAC,EAAE,CAAC;AACP,GAAG,SAAS,CAAC;AACb,GAAG,QAAQ,CAAC;AACZ,GAAG,YAAY,IAAI;;AAEnB,GAAG,SAAS,IAAI;AAChB,GAAG,gBAAgB,MAAM;AACzB,GAAG,KAAK,MAAM;;AAEd,GAAG,CAAC,CAAC,CAAC,CAAC;AACP,IAAI,OAAO,KAAK;AAChB,IAAI,iBAAiB,IAAI;;AAEzB,IAAI,SAAS,IAAI;AACjB,IAAI,eAAe,GAAG;;AAEtB,IAAI,CAAC,KAAK,GAAG,CAAC,CAAC;AACf,KAAK,SAAS,IAAI;AAClB,KAAK,oBAAoB,GAAG,CAAC,GAAG;AAChC,KAAK,uBAAuB,IAAI,CAAC,GAAG;AACpC,KAAK,aAAa,MAAM;AACxB,KAAK,KAAK,MAAM;;AAEhB,KAAK,CAAC,CAAC,GAAG,CAAC;AACX,MAAM,UAAU,IAAI,CAAC,CAAC;AACtB,MAAM,OAAO,GAAG;AAChB,MAAM,QAAQ,IAAI;AAClB;;AAEA,KAAK,CAAC,CAAC,IAAI,CAAC;AACZ,MAAM,OAAO,IAAI,GAAG,CAAC,GAAG,CAAC,GAAG,CAAC;AAC7B;AACA;AACA;AACA,GACC,CAEA,uCAA0B,CACzB,KAAK,CAAE,IAAI,CAAC,IAAI,CAAC,IAAI,CAAC,IACvB,CAEA,sCAAyB,CACxB,KAAK,CAAE,IAAI,CAAC,IAAI,CAAC,IAAI,CAAC,IACvB,CAEA,MAAO,YAAY,KAAK,CAAE,CACzB,2BAAc,CACb,OAAO,CAAE,IAAI,CAAC,UACf,CACD,CAEA,MAAO,YAAY,KAAK,CAAE,CACzB,0BAAa,CACZ,OAAO,CAAE,IAAI,CAAC,UACf,CACD"}'
};
const Nav = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  const mobileMenu = {
    Technology: [
      {
        href: "https://cheerp.io/",
        title: "Cheerp"
      },
      {
        href: "https://cheerpj.com/",
        title: "CheerpJ"
      },
      {
        href: "https://cheerpx.io/",
        title: "CheerpX"
      }
    ],
    Resources: [
      {
        href: "https://labs.leaningtech.com/",
        title: "Developer Hub"
      },
      {
        href: "https://labs.leaningtech.com/blog",
        title: "Blog"
      },
      {
        href: "https://github.com/leaningtech",
        title: "GitHub"
      }
    ]
  };
  $$result.css.add(css);
  return `<nav aria-label="Primary" class="navbar svelte-fxjams"><ul class="items svelte-fxjams">${validate_component(Logotype, "LogotypeItem").$$render($$result, {}, {}, {})}</ul> <ul class="items desktop-only svelte-fxjams">${validate_component(Dropdown, "DropdownItem").$$render(
    $$result,
    {
      title: "Technology",
      popovertarget: "global-navbar-technology"
    },
    {},
    {}
  )} ${validate_component(Dropdown, "DropdownItem").$$render(
    $$result,
    {
      title: "Resources",
      popovertarget: "global-navbar-resources"
    },
    {},
    {}
  )} ${validate_component(SocialIcon, "SocialIconItem").$$render(
    $$result,
    {
      href: "https://discord.leaningtech.com",
      icon: "discord"
    },
    {},
    {}
  )} ${validate_component(SocialIcon, "SocialIconItem").$$render(
    $$result,
    {
      href: "https://x.com/leaningtech",
      icon: "x"
    },
    {},
    {}
  )}</ul> <ul class="items mobile-only svelte-fxjams">${validate_component(Dropdown, "DropdownItem").$$render($$result, { title: "Leaning Technologies" }, {}, {})} ${validate_component(SelectMenu, "SelectMenu").$$render($$result, { menu: mobileMenu }, {}, {})}</ul></nav> <nav popover aria-label="Technology" id="global-navbar-technology" class="svelte-fxjams"><ul>${validate_component(BigIcon, "BigIconItem").$$render(
    $$result,
    {
      href: "https://cheerp.io/",
      title: "Cheerp",
      description: "C++ to Wasm/JS compiler"
    },
    {},
    {
      default: () => {
        return `${validate_component(Cheerp_svg, "CheerpLogo").$$render($$result, {}, {}, {})}`;
      }
    }
  )} ${validate_component(BigIcon, "BigIconItem").$$render(
    $$result,
    {
      href: "https://cheerpj.com/",
      title: "CheerpJ",
      description: "Java runtime for browsers"
    },
    {},
    {
      default: () => {
        return `${validate_component(Cheerpj_svg, "CheerpJLogo").$$render($$result, {}, {}, {})}`;
      }
    }
  )} ${validate_component(BigIcon, "BigIconItem").$$render(
    $$result,
    {
      href: "https://cheerpx.io/",
      title: "CheerpX",
      description: "Virtual machines for the web"
    },
    {},
    {
      default: () => {
        return `${validate_component(Cheerpx_svg, "CheerpXLogo").$$render($$result, {}, {}, {})}`;
      }
    }
  )}</ul></nav> <nav popover aria-label="Resources" id="global-navbar-resources" class="svelte-fxjams" data-svelte-h="svelte-vu2bz"><ul><li><a href="https://labs.leaningtech.com/">Developer Hub</a></li> <li><a href="https://labs.leaningtech.com/blog">Blog</a></li> <li><a href="https://github.com/leaningtech">GitHub</a></li></ul> </nav>`;
});
const Icon = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let $activity, $$unsubscribe_activity;
  let { icon } = $$props;
  let { info } = $$props;
  let { activity } = $$props;
  $$unsubscribe_activity = subscribe(activity, (value) => $activity = value);
  createEventDispatcher();
  if ($$props.icon === void 0 && $$bindings.icon && icon !== void 0) $$bindings.icon(icon);
  if ($$props.info === void 0 && $$bindings.info && info !== void 0) $$bindings.info(info);
  if ($$props.activity === void 0 && $$bindings.activity && activity !== void 0) $$bindings.activity(activity);
  $$unsubscribe_activity();
  return `<div class="${"p-3 cursor-pointer text-center hover:bg-neutral-600 " + escape(
    $activity ? "text-amber-500 animate-pulse" : "hover:text-gray-100",
    true
  )}" style="animation-duration: 0.5s"><i class="${escape(icon, true) + " fa-xl"}"></i></div>`;
});
new Promise((f, r) => {
});
const cpuActivity = writable(false);
const diskActivity = writable(false);
const aiActivity = writable(false);
function tryPlausible(msg) {
  if (self.plausible)
    plausible(msg);
}
var lastScreenshot = null;
var screenshotCanvas = null;
var screenshotCtx = null;
async function yieldHelper(timeout) {
  return new Promise(function(f2, r2) {
    setTimeout(f2, timeout);
  });
}
async function kmsSendChar(textArea, charStr) {
  textArea.value = "_" + charStr;
  var ke = new KeyboardEvent("keydown");
  textArea.dispatchEvent(ke);
  var ke = new KeyboardEvent("keyup");
  textArea.dispatchEvent(ke);
  await yieldHelper(0);
}
function getKmsInputElement() {
  for (const node of document.body.children) {
    if (node.tagName == "TEXTAREA")
      return node;
  }
  return null;
}
async function handleToolImpl(tool, term) {
  if (tool.command) {
    var sentinel = "# End of AI command";
    var buffer = term.buffer.active;
    var marker = term.registerMarker();
    var startLine = marker.line;
    marker.dispose();
    var ret = new Promise(function(f, r) {
      var callbackDisposer = term.onWriteParsed(function() {
        var curLength = buffer.length;
        var output = "";
        for (var i = startLine + 1; i < curLength; i++) {
          var curLine = buffer.getLine(i).translateToString(true, 0, term.cols);
          if (curLine.indexOf(sentinel) >= 0) {
            callbackDisposer.dispose();
            return f(output);
          }
          output += curLine + "\n";
        }
      });
    });
    term.input(tool.command);
    term.input("\n");
    term.input(sentinel);
    term.input("\n");
    return ret;
  } else if (tool.action) {
    switch (tool.action) {
      case "screenshot": {
        await yieldHelper(3e3);
        var delayCount = 0;
        var display = document.getElementById("display");
        var dc = get_store_value(displayConfig);
        if (screenshotCanvas == null) {
          screenshotCanvas = document.createElement("canvas");
          screenshotCtx = screenshotCanvas.getContext("2d");
        }
        if (screenshotCanvas.width != dc.width || screenshotCanvas.height != dc.height) {
          screenshotCanvas.width = dc.width;
          screenshotCanvas.height = dc.height;
        }
        while (1) {
          screenshotCtx.drawImage(display, 0, 0, display.width, display.height, 0, 0, dc.width, dc.height);
          var dataUrl = screenshotCanvas.toDataURL("image/png");
          if (dataUrl == lastScreenshot) {
            if (delayCount < 3) {
              console.warn("Identical screenshot, rate limiting");
              delayCount++;
              await yieldHelper(5e3);
              continue;
            }
          }
          lastScreenshot = dataUrl;
          dataUrl = dataUrl.substring("data:image/png;base64,".length);
          var imageSrc = { type: "base64", media_type: "image/png", data: dataUrl };
          var contentObj = { type: "image", source: imageSrc };
          return [contentObj];
        }
      }
      case "mouse_move": {
        var coords = tool.coordinate;
        var dc = get_store_value(displayConfig);
        var mouseX = coords[0] / dc.mouseMult;
        var mouseY = coords[1] / dc.mouseMult;
        var display = document.getElementById("display");
        var clientRect = display.getBoundingClientRect();
        var me = new MouseEvent("mousemove", { clientX: mouseX + clientRect.left, clientY: mouseY + clientRect.top });
        display.dispatchEvent(me);
        return null;
      }
      case "left_click": {
        var coords = tool.coordinate;
        var dc = get_store_value(displayConfig);
        var mouseX = coords[0] / dc.mouseMult;
        var mouseY = coords[1] / dc.mouseMult;
        var display = document.getElementById("display");
        var clientRect = display.getBoundingClientRect();
        var me = new MouseEvent("mousedown", { clientX: mouseX + clientRect.left, clientY: mouseY + clientRect.top, button: 0 });
        display.dispatchEvent(me);
        await yieldHelper(60);
        me = new MouseEvent("mouseup", { clientX: mouseX + clientRect.left, clientY: mouseY + clientRect.top, button: 0 });
        display.dispatchEvent(me);
        return null;
      }
      case "right_click": {
        var coords = tool.coordinate;
        var dc = get_store_value(displayConfig);
        var mouseX = coords[0] / dc.mouseMult;
        var mouseY = coords[1] / dc.mouseMult;
        var display = document.getElementById("display");
        var clientRect = display.getBoundingClientRect();
        var me = new MouseEvent("mousedown", { clientX: mouseX + clientRect.left, clientY: mouseY + clientRect.top, button: 2 });
        display.dispatchEvent(me);
        await yieldHelper(60);
        me = new MouseEvent("mouseup", { clientX: mouseX + clientRect.left, clientY: mouseY + clientRect.top, button: 2 });
        display.dispatchEvent(me);
        return null;
      }
      case "type": {
        var str = tool.text;
        return new Promise(async function(f, r) {
          var textArea2 = getKmsInputElement();
          for (var i = 0; i < str.length; i++) {
            await kmsSendChar(textArea2, str[i]);
          }
          f(null);
        });
      }
      case "key": {
        var textArea = getKmsInputElement();
        var key = tool.text;
        var isCtrl = false;
        var isAlt = false;
        var isShift = false;
        while (1) {
          if (key.startsWith("shift+")) {
            isShift = true;
            key = key.substr("shift+".length);
            var ke = new KeyboardEvent("keydown", { keyCode: 16 });
            textArea.dispatchEvent(ke);
            await yieldHelper(0);
            continue;
          } else if (key.startsWith("ctrl+")) {
            isCtrl = true;
            key = key.substr("ctrl+".length);
            var ke = new KeyboardEvent("keydown", { keyCode: 17 });
            textArea.dispatchEvent(ke);
            await yieldHelper(0);
            continue;
          } else if (key.startsWith("alt+")) {
            isAlt = true;
            key = key.substr("alt+".length);
            var ke = new KeyboardEvent("keydown", { keyCode: 18 });
            textArea.dispatchEvent(ke);
            await yieldHelper(0);
            continue;
          }
          break;
        }
        var ret = null;
        if (key.length == 1) {
          await kmsSendChar(textArea, key);
        } else {
          switch (tool.text) {
            case "Return":
              await kmsSendChar(textArea, "\n");
              break;
            case "Escape":
              var ke = new KeyboardEvent("keydown", { keyCode: 27 });
              textArea.dispatchEvent(ke);
              await yieldHelper(0);
              ke = new KeyboardEvent("keyup", { keyCode: 27 });
              textArea.dispatchEvent(ke);
              await yieldHelper(0);
              break;
            default:
              ret = new Error(`Error: Invalid key '${tool.text}'`);
          }
        }
        if (isShift) {
          var ke = new KeyboardEvent("keyup", { keyCode: 16 });
          textArea.dispatchEvent(ke);
          await yieldHelper(0);
        }
        if (isCtrl) {
          var ke = new KeyboardEvent("keyup", { keyCode: 17 });
          textArea.dispatchEvent(ke);
          await yieldHelper(0);
        }
        if (isAlt) {
          var ke = new KeyboardEvent("keyup", { keyCode: 18 });
          textArea.dispatchEvent(ke);
          await yieldHelper(0);
        }
        return ret;
      }
      case "wait": {
        await yieldHelper(tool.duration * 2 * 1e3);
        return null;
      }
    }
    return new Error("Error: Invalid action");
  } else {
    return new Error("Error: Invalid tool syntax");
  }
}
const displayConfig = writable(null);
const SmallButton = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { clickHandler = null } = $$props;
  let { buttonTooltip = null } = $$props;
  let { bgColor = "bg-neutral-700" } = $$props;
  let { hoverColor = "hover:bg-neutral-500" } = $$props;
  let { buttonIcon = null } = $$props;
  if ($$props.clickHandler === void 0 && $$bindings.clickHandler && clickHandler !== void 0) $$bindings.clickHandler(clickHandler);
  if ($$props.buttonTooltip === void 0 && $$bindings.buttonTooltip && buttonTooltip !== void 0) $$bindings.buttonTooltip(buttonTooltip);
  if ($$props.bgColor === void 0 && $$bindings.bgColor && bgColor !== void 0) $$bindings.bgColor(bgColor);
  if ($$props.hoverColor === void 0 && $$bindings.hoverColor && hoverColor !== void 0) $$bindings.hoverColor(hoverColor);
  if ($$props.buttonIcon === void 0 && $$bindings.buttonIcon && buttonIcon !== void 0) $$bindings.buttonIcon(buttonIcon);
  return `<span class="${"inline-block h-7 " + escape(bgColor, true) + " text-sm p-1 rounded-md shadow-md shadow-neutral-900 " + escape(
    clickHandler != null ? `${hoverColor} cursor-pointer` : "",
    true
  )}"${add_attribute("title", buttonTooltip, 0)}><i class="${"w-5 " + escape(buttonIcon, true) + " text-center"}"></i></span>`;
});
const SideBar = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  const icons = [
    {
      icon: "fas fa-info-circle",
      info: "Information",
      activity: null
    },
    {
      icon: "fas fa-wifi",
      info: "Networking",
      activity: null
    },
    {
      icon: "fas fa-microchip",
      info: "CPU",
      activity: cpuActivity
    },
    {
      icon: "fas fa-compact-disc",
      info: "Disk",
      activity: diskActivity
    },
    {
      icon: "fas fa-robot",
      info: "ClaudeAI",
      activity: aiActivity
    },
    null,
    {
      icon: "fas fa-book-open",
      info: "Posts",
      activity: null
    },
    {
      icon: "fab fa-discord",
      info: "Discord",
      activity: null
    },
    {
      icon: "fab fa-github",
      info: "GitHub",
      activity: null
    }
  ];
  let dispatch = createEventDispatcher();
  let activeInfo = null;
  let { sideBarPinned } = $$props;
  function toggleSidebarPin() {
    sideBarPinned = !sideBarPinned;
    dispatch("sidebarPinChange", sideBarPinned);
  }
  let { handleTool } = $$props;
  if ($$props.sideBarPinned === void 0 && $$bindings.sideBarPinned && sideBarPinned !== void 0) $$bindings.sideBarPinned(sideBarPinned);
  if ($$props.handleTool === void 0 && $$bindings.handleTool && handleTool !== void 0) $$bindings.handleTool(handleTool);
  return `<div class="flex flex-row w-14 h-full bg-neutral-700"><div class="flex flex-col shrink-0 w-14 text-gray-300">${each(icons, (i) => {
    return `${i ? `${validate_component(Icon, "Icon").$$render(
      $$result,
      {
        icon: i.icon,
        info: i.info,
        activity: i.activity
      },
      {},
      {}
    )}` : `<div class="grow"></div>`}`;
  })}</div> <div class="${[
    "relative flex flex-col gap-5 shrink-0 w-80 h-full z-10 p-2 bg-neutral-600 text-gray-100 opacity-95",
    "hidden"
  ].join(" ").trim()}"><div class="absolute right-2 top-2">${validate_component(SmallButton, "SmallButton").$$render(
    $$result,
    {
      buttonIcon: "fa-solid fa-thumbtack",
      clickHandler: toggleSidebarPin,
      buttonTooltip: sideBarPinned ? "Unpin Sidebar" : "Pin Sidebar",
      bgColor: sideBarPinned ? "bg-neutral-500" : "bg-neutral-700"
    },
    {},
    {}
  )}</div> ${`${`${`${`${`${`${`${`<p>TODO: ${escape(activeInfo)}</p>`}`}`}`}`}`}`}`} <div class="mt-auto text-sm text-gray-300" data-svelte-h="svelte-1kv7gdc"><div class="pt-1 pb-1"><a href="https://cheerpx.io/" target="_blank"><span>Powered by CheerpX</span> <img src="assets/cheerpx.svg" alt="CheerpX Logo" class="w-6 h-6 inline-block"></a></div> <hr class="border-t border-solid border-gray-300"> <div class="pt-1 pb-1"><a href="https://leaningtech.com/" target="”_blank”">© 2022-2025 Leaning Technologies</a></div></div></div></div>`;
});
const WebVM = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { configObj = null } = $$props;
  let { processCallback = null } = $$props;
  let { cacheId = null } = $$props;
  let { cpuActivityEvents = [] } = $$props;
  let { diskLatencies = [] } = $$props;
  let { activityEventsInterval = 0 } = $$props;
  var term = null;
  var curVT = 0;
  async function handleTool(tool) {
    return await handleToolImpl(tool, term);
  }
  if ($$props.configObj === void 0 && $$bindings.configObj && configObj !== void 0) $$bindings.configObj(configObj);
  if ($$props.processCallback === void 0 && $$bindings.processCallback && processCallback !== void 0) $$bindings.processCallback(processCallback);
  if ($$props.cacheId === void 0 && $$bindings.cacheId && cacheId !== void 0) $$bindings.cacheId(cacheId);
  if ($$props.cpuActivityEvents === void 0 && $$bindings.cpuActivityEvents && cpuActivityEvents !== void 0) $$bindings.cpuActivityEvents(cpuActivityEvents);
  if ($$props.diskLatencies === void 0 && $$bindings.diskLatencies && diskLatencies !== void 0) $$bindings.diskLatencies(diskLatencies);
  if ($$props.activityEventsInterval === void 0 && $$bindings.activityEventsInterval && activityEventsInterval !== void 0) $$bindings.activityEventsInterval(activityEventsInterval);
  return `<main class="relative w-full h-full">${validate_component(Nav, "Nav").$$render($$result, {}, {}, {})} <div class="absolute top-10 bottom-0 left-0 right-0">${validate_component(SideBar, "SideBar").$$render(
    $$result,
    {
      handleTool: !configObj.needsDisplay || curVT == 7 ? handleTool : null
    },
    {},
    {
      default: () => {
        return `${slots.default ? slots.default({}) : ``}`;
      }
    }
  )} ${configObj.needsDisplay ? `<div class="${"absolute top-0 bottom-0 " + escape("left-14", true) + " right-0"}"><canvas class="w-full h-full cursor-none" id="display"></canvas></div>` : ``} <div class="${"absolute top-0 bottom-0 " + escape("left-14", true) + " right-0 p-1 scrollbar"}" id="console"></div></div></main>`;
});
export {
  WebVM as W,
  tryPlausible as t
};
