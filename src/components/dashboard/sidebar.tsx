"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Shield,
  Globe,
  Activity,
  Menu,
  X,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/validators", label: "Validators", icon: Shield },
  { href: "/dashboard/endpoints", label: "Endpoints", icon: Globe },
  { href: "/dashboard/network", label: "Network", icon: Activity },
];

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const navContent = (
    <>
      <div className="flex items-center gap-2.5 px-6 py-5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-soft-violet/20">
          <Eye className="size-4 text-soft-violet" />
        </div>
        <h2 className="font-display text-lg font-bold text-soft-violet">
          Panoptes
        </h2>
      </div>
      <nav className="mt-2 space-y-1 px-3">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                active
                  ? "bg-soft-violet/15 text-soft-violet shadow-sm"
                  : "text-dusty-lavender/70 hover:bg-deep-iris/15 hover:text-dusty-lavender"
              )}
            >
              <item.icon
                className={cn(
                  "size-4 shrink-0 transition-colors",
                  active
                    ? "text-soft-violet"
                    : "text-dusty-lavender/40 group-hover:text-dusty-lavender/70"
                )}
              />
              {item.label}
              {active && (
                <span className="ml-auto size-1.5 rounded-full bg-soft-violet" />
              )}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-slate-DEFAULT/10 px-4 py-4">
        <p className="text-[10px] font-medium uppercase tracking-wider text-dusty-lavender/30">
          Chain Intelligence
        </p>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <div className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center gap-3 border-b border-slate-DEFAULT/20 bg-slate-dark/95 px-4 backdrop-blur-sm lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="flex size-9 items-center justify-center rounded-lg text-dusty-lavender hover:bg-deep-iris/20"
        >
          <Menu className="size-5" />
        </button>
        <div className="flex items-center gap-2">
          <Eye className="size-4 text-soft-violet" />
          <span className="font-display text-sm font-bold text-soft-violet">
            Panoptes
          </span>
        </div>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-full w-64 flex-col border-r border-slate-DEFAULT/20 bg-midnight-plum transition-transform duration-300 lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute right-3 top-4 flex size-8 items-center justify-center rounded-lg text-dusty-lavender/70 hover:bg-deep-iris/20"
        >
          <X className="size-4" />
        </button>
        {navContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-DEFAULT/20 bg-midnight-plum lg:flex">
        {navContent}
      </aside>
    </>
  );
}
