export class CommandBar {
  constructor(private mount: HTMLElement, private handlers: { onSubmit: (text: string) => void }) {
    this.render();
  }

  private render(): void {
    this.mount.replaceChildren();

    const wrap = document.createElement("div");
    wrap.className = "ax-cmd";

    const input = document.createElement("input");
    input.placeholder = "Type intent (e.g., 'search cats' or 'note hello')";
    input.className = "ax-cmd-input";

    const btn = document.createElement("button");
    btn.textContent = "Run";
    btn.className = "ax-cmd-btn";

    const submit = () => {
      const v = input.value.trim();
      if (!v) return;
      input.value = "";
      this.handlers.onSubmit(v);
    };

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });
    btn.onclick = submit;

    wrap.appendChild(input);
    wrap.appendChild(btn);
    this.mount.appendChild(wrap);

    const style = document.getElementById("ax-cmd-style");
    if (!style) {
      const s = document.createElement("style");
      s.id = "ax-cmd-style";
      s.textContent = `
        .ax-cmd{ display:flex; gap:8px; align-items:center; width:100%; }
        .ax-cmd-input{ flex:1; border:1px solid #e6e6e6; border-radius:10px; padding:10px 12px; font-family: ui-sans-serif, system-ui; }
        .ax-cmd-btn{ border:1px solid #111; background:#111; color:#fff; border-radius:10px; padding:10px 12px; font-family: ui-sans-serif, system-ui; cursor:pointer; }
      `;
      document.head.appendChild(s);
    }
  }
}
