import { c as create_ssr_component, v as validate_component } from "../../../chunks/ssr.js";
import { W as WebVM, t as tryPlausible } from "../../../chunks/WebVM.js";
const diskImageUrl = "wss://disks.webvm.io/alpine_20251007.ext2";
const diskImageType = "cloud";
const printIntro = false;
const needsDisplay = true;
const cmd = "/sbin/init";
const args = [];
const opts = {
  // User id
  uid: 0,
  // Group id
  gid: 0
};
const configObj = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  args,
  cmd,
  diskImageType,
  diskImageUrl,
  needsDisplay,
  opts,
  printIntro
}, Symbol.toStringTag, { value: "Module" }));
const Page = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  function handleProcessCreated(processCount) {
    if (processCount == 1) {
      tryPlausible("Alpine init");
    }
  }
  return `${validate_component(WebVM, "WebVM").$$render(
    $$result,
    {
      configObj,
      processCallback: handleProcessCreated,
      cacheId: "blocks_alpine"
    },
    {},
    {
      default: () => {
        return `<p data-svelte-h="svelte-1gn20u4">Looking for something different? Try the classic <a class="underline" href="/" target="_blank">Debian Linux</a> terminal-based WebVM</p>`;
      }
    }
  )}`;
});
export {
  Page as default
};
