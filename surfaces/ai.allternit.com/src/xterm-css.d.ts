// xterm CSS imports — ambient declaration. Must live in a file WITHOUT
// top-level imports/exports: css-modules.d.ts is a module (it augments
// 'react'), so the same declaration there is a no-op augmentation and
// dynamic `import('@xterm/xterm/css/xterm.css')` fails typecheck.
declare module '@xterm/xterm/css/xterm.css' {
  const content: string;
  export default content;
}
