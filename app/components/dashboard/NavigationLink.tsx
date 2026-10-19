"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, useTransition, type ComponentProps, type ReactNode } from "react";
import { getActiveRequestCount, subscribeToRequestActivity } from "../../../lib/api-client";

const NavigationContext = createContext<((href: string) => void) | null>(null);
const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function NavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [preparing, setPreparing] = useState(false);
  const requests = useSyncExternalStore(subscribeToRequestActivity, getActiveRequestCount, () => 0);
  const committed = useRef<(() => void) | null>(null);
  const content = useRef<HTMLDivElement>(null);
  const snapshot = useRef<HTMLDivElement>(null);

  useEffect(() => { committed.current?.(); committed.current = null; }, [pathname]);

  function navigate(href: string) {
    if (preparing || href === pathname) return;
    if (content.current && snapshot.current) {
      // A non-interactive visual copy preserves the current screen while the
      // real route mounts and loads. It never handles clicks or submits forms.
      const previous = content.current.cloneNode(true) as HTMLDivElement;
      previous.querySelectorAll("script, [id]").forEach((element) => {
        if (element.tagName === "SCRIPT") element.remove();
        else element.removeAttribute("id");
      });
      previous.style.transform = `translateY(-${window.scrollY}px)`;
      snapshot.current.replaceChildren(previous);
    }
    setPreparing(true);
    const update = async () => {
      try {
        await new Promise<void>((resolve) => {
          const timeout = window.setTimeout(resolve, 20_000);
          committed.current = () => { window.clearTimeout(timeout); resolve(); };
          startTransition(() => router.push(href));
        });
        const deadline = Date.now() + 20_000;
        do {
          await pause(250);
          if (getActiveRequestCount() === 0) break;
        } while (Date.now() < deadline);
        // Let state updates from the last response paint before revealing it.
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      } finally { snapshot.current?.replaceChildren(); setPreparing(false); }
    };
    void update();
  }

  return <NavigationContext.Provider value={navigate}>
    <div ref={content} className="workspace-route-content" inert={preparing} aria-busy={preparing}>{children}</div>
    <div ref={snapshot} className="workspace-route-snapshot" hidden={!preparing} aria-hidden="true" inert />
    {(preparing || pending || requests > 0) && <div className="workspace-loading-indicator" role="status" aria-live="polite"><span className="workspace-spinner" />Loading…</div>}
  </NavigationContext.Provider>;
}

export default function NavigationLink(props: ComponentProps<typeof Link>) {
  const navigate = useContext(NavigationContext);
  return <Link {...props} onNavigate={(event) => {
    props.onNavigate?.(event);
    if (!navigate || typeof props.href !== "string" || props.href.includes("#") || props.href.includes("?")) return;
    event.preventDefault();
    navigate(props.href);
  }} />;
}
