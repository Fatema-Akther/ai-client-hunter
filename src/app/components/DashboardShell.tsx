"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", icon: "◫", text: "Overview" },
  { href: "/jobs", icon: "▤", text: "Job Opportunities" },
  { href: "/agencies", icon: "▥", text: "Agencies" },
  { href: "/linkedin", icon: "◎", text: "LinkedIn Discovery" },
  { href: "/social-discovery", icon: "◉", text: "Social Discovery" },
  { href: "/saved-leads", icon: "◇", text: "Saved Leads" },
];

export default function DashboardShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  return (
    <main className="min-h-screen bg-[#070e1e] text-slate-100">
      <div className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-[#243249] bg-[#091327]/95 px-4 backdrop-blur lg:px-7">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setMenuOpen(v => !v)} aria-label="Toggle navigation" className="rounded-lg border border-slate-700 px-3 py-1.5 text-lg lg:hidden">☰</button>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-xl font-bold shadow-lg shadow-violet-950">✦</span>
          <span className="text-lg font-bold tracking-tight text-white">AI Client Hunter</span>
        </div>
        <div className="hidden items-center gap-2 text-xs text-slate-400 sm:flex"><span className="h-2 w-2 rounded-full bg-emerald-400"/> Personal Workspace <span className="mx-2 text-slate-600">•</span> Search · Verify · Connect</div>
      </div>
      <div className="flex min-h-[calc(100vh-4rem)]">
        {menuOpen && <button className="fixed inset-0 z-20 bg-black/60 lg:hidden" onClick={() => setMenuOpen(false)} aria-label="Close menu"/>}
        <aside className={`${menuOpen ? "translate-x-0" : "-translate-x-full"} fixed bottom-0 left-0 top-16 z-30 w-60 border-r border-[#243249] bg-[#0b1529] p-4 transition-transform lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:translate-x-0`}>
          <div className="mb-4 px-3 pt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Workspace</div>
          <nav className="space-y-1">
            {links.map(link => <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition hover:bg-[#182845] hover:text-white ${pathname === link.href ? "border border-violet-700/60 bg-violet-700/20 text-violet-200" : "text-slate-300"}`}><span className="w-6 text-center text-lg">{link.icon}</span>{link.text}</a>)}
          </nav>
          <div className="mt-10 rounded-xl border border-[#25344f] bg-[#101e34] p-4"><p className="text-sm font-semibold text-white">Find opportunities</p><p className="mt-2 text-xs leading-5 text-slate-400">Discover public leads, verify facts, and track your outreach.</p></div>
        </aside>
        <div className="min-w-0 flex-1"><div className="mx-auto max-w-[1600px] px-4 py-7 sm:px-6 lg:px-8">{children}</div></div>
      </div>
    </main>
  );
}
