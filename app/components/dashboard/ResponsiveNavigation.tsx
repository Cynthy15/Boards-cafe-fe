"use client";

import { useId, useState, type ReactNode } from "react";

/** Collapses navigation into an accessible dropdown below its sidebar breakpoint. */
export default function ResponsiveNavigation({ children, label = "Navigation", breakpoint = "lg", main = false }: {
  children: ReactNode;
  main?: boolean;
  label?: string;
  breakpoint?: "md" | "lg";
}) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <div className={`responsive-navigation responsive-navigation--${breakpoint} ${main ? "responsive-navigation--main" : ""}`} data-open={open}>
      <button
        type="button"
        className="responsive-navigation-toggle"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <span>{label}</span><span aria-hidden="true">{open ? "▴" : "▾"}</span>
      </button>
      <div id={id} className="responsive-navigation-list" onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
          (event.currentTarget.previousElementSibling as HTMLButtonElement | null)?.focus();
        }
      }} onClick={(event) => {
        if ((event.target as HTMLElement).closest("a")) setOpen(false);
      }}>
        {children}
      </div>
    </div>
  );
}
