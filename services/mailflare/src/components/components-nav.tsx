
import Link from "next/link";
import type { DragEvent } from "react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { getMessageDragData } from "@/lib/messages/drag-utils";
import { useCompose } from "./compose/compose-context";
import type { NavLink } from "./components-nav-types";

export function NavItem({ link }:{ link: NavLink }) {
  const pathname = usePathname();
  const { openComposer } = useCompose();
  const [dragOver, setDragOver] = useState(false);

  if (!link.href) {
    return <span className="flex-1" />;
  }

  const Icon = link.icon;
  if (!Icon) return null;
  const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
  const classes = cn(
    "flex h-9 items-center gap-3 rounded-r-full text-sm font-medium text-neutral-700 transition-colors hover:bg-blue-50",
    active && "bg-blue-100 text-blue-900",
    dragOver && "bg-blue-50 text-blue-900 ring-1 ring-blue-200",
    link.primary &&
      "mb-3 h-12 w-fit rounded-2xl bg-blue-100 px-5 text-blue-950 shadow-sm hover:bg-blue-200",
  );
  const dropProps = link.onMessageDrop
    ? {
        onDragOver: (event: DragEvent) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          setDragOver(true);
        },
        onDragLeave: () => setDragOver(false),
        onDrop: (event: DragEvent) => {
          const payload = getMessageDragData(event.dataTransfer);
          setDragOver(false);
          if (!payload) return;
          event.preventDefault();
          link.onMessageDrop?.(payload.messageIds);
        },
      }
    : {};

  if (link.href === "/compose") {
    return (
      <button
        type="button"
        onClick={openComposer}
        className={classes}
        {...dropProps}
      >
        <Icon className="h-4 w-4" />
        <span className="flex-1">{link.label}</span>
        {typeof link.count === "number" && link.count > 0 && (
          <span className="ml-auto mr-3 rounded-full px-2 py-0.5 text-sm font-semibold text-neutral-700">
            {link.count > 99 ? "99+" : link.count}
          </span>
        )}
      </button>
    );
  }

  return (
    <Link
      href={link.href}
      className={cn("-ml-3 pl-6", classes)}
      {...dropProps}
    >
      <Icon className="h-4 w-4" />
      <span className="flex-1">{link.label}</span>
      {typeof link.count === "number" && link.count > 0 && (
        <span className="ml-auto mr-3 rounded-full px-2 py-0.5 text-sm font-semibold text-neutral-700">
          {link.count > 99 ? "99+" : link.count}
        </span>
      )}
    </Link>
  );
}
