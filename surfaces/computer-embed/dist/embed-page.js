export function mountEmbedPage(search = window.location.search) {
    const params = new URLSearchParams(search);
    const el = document.createElement("allternit-computer");
    for (const name of ["src", "host", "computer", "token", "hosts", "label"]) {
        const value = params.get(name);
        if (value)
            el.setAttribute(name, value);
    }
    document.body.appendChild(el);
}
if (typeof window !== "undefined" && typeof document !== "undefined") {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => mountEmbedPage());
    }
    else {
        mountEmbedPage();
    }
}
//# sourceMappingURL=embed-page.js.map