"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, BriefcaseBusiness, Building2, CircleDot, Radar, Bookmark, Sparkles, Menu, X, Zap } from "lucide-react";

const links = [
  { href: "/", icon: LayoutDashboard, text: "Overview" },
  { href: "/jobs", icon: BriefcaseBusiness, text: "Job Opportunities" },
  { href: "/agencies", icon: Building2, text: "Agencies" },
  { href: "/linkedin", icon: CircleDot, text: "LinkedIn Discovery" },
  { href: "/social-discovery", icon: Radar, text: "Social Discovery" },
  { href: "/saved-leads", icon: Bookmark, text: "Saved Leads" },
];

export default function DashboardShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  return (
    <main className="min-h-screen bg-[#071120] text-slate-100">
      <header className="sticky top-0 z-40 flex h-[73px] items-center justify-between border-b border-[#22344e] bg-[#09172b]/95 px-6 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => setMenuOpen(v => !v)} aria-label="Toggle navigation" className="rounded-lg border border-slate-700 p-2 lg:hidden">{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
          <div className="flex h-11 w-11 items-center justify-center rounded-[15px] bg-gradient-to-br from-violet-600 to-fuchsia-500 shadow-[0_9px_24px_rgba(114,34,239,.35)]"><Sparkles size={24} className="fill-white text-white" /></div>
          <span className="text-xl font-bold tracking-tight text-white">AI Client Hunter</span>
        </div>
        <div className="hidden items-center gap-3 text-xs text-[#a6b5cd] sm:flex"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> Personal Workspace <span className="text-[#506481]">•</span> Search · Verify · Connect</div>
      </header>

      <div className="flex min-h-[calc(100vh-73px)]">
        {menuOpen && <button type="button" aria-label="Close menu" className="fixed inset-0 z-20 bg-black/60 lg:hidden" onClick={() => setMenuOpen(false)} />}
        <aside className={`${menuOpen ? "translate-x-0" : "-translate-x-full"} fixed bottom-0 left-0 top-[73px] z-30 flex w-[246px] shrink-0 flex-col border-r border-[#1d304a] bg-[#0b1a30] px-[14px] py-7 transition-transform lg:sticky lg:top-[73px] lg:h-[calc(100vh-73px)] lg:translate-x-0`}>
          <p className="mb-4 px-[13px] text-[11px] font-semibold uppercase tracking-[.20em] text-[#7896bf]">Workspace</p>
          <nav className="space-y-1.5">
            {links.map(link => {
              const Icon = link.icon;
              const active = pathname === link.href;
              return <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)} aria-current={active ? "page" : undefined} className={`flex min-h-[49px] items-center gap-3 rounded-xl px-4 text-[13px] font-medium transition ${active ? "bg-gradient-to-r from-[#5423c0] to-[#6a20c3] text-white shadow-[0_5px_22px_rgba(87,30,210,.18)]" : "text-[#d0def0] hover:bg-[#172943] hover:text-white"}`}><Icon size={18} strokeWidth={1.8} /><span>{link.text}</span></Link>;
            })}
          </nav>
          <div className="mt-10 rounded-xl border border-[#243c5b] bg-[#10223d] px-4 py-4 lg:mt-auto"><div className="flex items-center gap-2"><Zap size={18} className="fill-violet-400 text-violet-400" /><p className="text-sm font-semibold text-white">Find opportunities</p></div><p className="mt-3 text-xs leading-5 text-[#a8bddb]">Discover public leads, verify facts, and track your outreach.</p></div>
        </aside>
        <div className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-[1680px] px-4 py-[27px] sm:px-6 lg:px-[28px]">
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}
