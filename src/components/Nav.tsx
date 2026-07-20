"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, LayoutList, BarChart3, Settings as SettingsIcon, BookText } from "lucide-react";

const items = [
  { href: "/", label: "Today", icon: BookText },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/categories", label: "Items", icon: LayoutList },
  { href: "/stats", label: "Stats", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-border px-4 py-6 gap-1">
        <div className="px-2 mb-6">
          <span className="font-display italic text-2xl">Ledger</span>
        </div>
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                active ? "bg-accent-soft text-text font-medium" : "text-text-muted hover:bg-surface-alt"
              }`}
            >
              <Icon size={17} />
              {label}
            </Link>
          );
        })}
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border bg-surface/95 backdrop-blur z-40 pb-[env(safe-area-inset-bottom)]">
        <div className="flex justify-around">
          {items.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-1 py-2.5 px-2 flex-1 text-[11px] transition ${
                  active ? "text-accent" : "text-text-muted"
                }`}
              >
                <Icon size={19} />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
