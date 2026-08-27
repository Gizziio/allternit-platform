import packageJson from "../../package.json";

export function SidebarFooter() {
  return (
    <p className="px-3 pt-3 text-xs text-neutral-400">
      Powered by{" "}
      <a href={`https://mailflare.co/?ref=app&v=${packageJson.version}`} target="_blank">
        Mailflare v{packageJson.version}
      </a>
    </p>
  );
}
