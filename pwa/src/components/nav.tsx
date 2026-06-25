import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";

const icon = (path: ReactNode) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-6 w-6"
    aria-hidden="true"
  >
    {path}
  </svg>
);

const ITEMS: { to: string; label: string; icon: ReactNode }[] = [
  { to: "/home", label: "Home", icon: icon(<path d="M3 11.5 12 4l9 7.5M5 10v10h14V10" />) },
  {
    to: "/activities",
    label: "Activities",
    icon: icon(<path d="M3 12h4l2 6 4-14 2 8h6" />),
  },
  {
    to: "/exercises",
    label: "Exercises",
    icon: icon(
      <>
        <path d="M6.5 6.5v11M17.5 6.5v11M4 9v6M20 9v6" />
        <path d="M6.5 12h11" />
      </>,
    ),
  },
  {
    to: "/settings",
    label: "Settings",
    icon: icon(
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
      </>,
    ),
  },
];

export function Nav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-4 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      role="navigation"
      aria-label="Main"
    >
      {ITEMS.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          className={({ isActive }) =>
            "flex min-h-[64px] flex-col items-center justify-center gap-1.5 text-[11px] font-medium tracking-wide transition-colors " +
            (isActive ? "text-accent" : "text-muted")
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={
                  "flex h-7 w-12 items-center justify-center rounded-full transition-colors " +
                  (isActive ? "bg-accent/12" : "")
                }
              >
                {it.icon}
              </span>
              <span>{it.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
