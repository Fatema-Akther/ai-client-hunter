"use client";
import { useWorkspace, FEATURES, TINT_STYLES, TILES } from "./WorkspaceState";
import { ArrowRight, Check, Code2, Globe, Search, Sparkle } from "lucide-react";

export default function OverviewView(){
const { jobs, agencies, STATS } = useWorkspace();
return ((<>
   <section
      id="overview"
      className="relative isolate overflow-hidden rounded-3xl border border-indigo-500/20 bg-[#050821] px-6 py-6 shadow-[0_20px_70px_rgba(0,0,0,0.5)] sm:px-10 "
    >
      {/* ---------- Ambient glows ---------- */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {/* deep indigo glow behind text */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_18%_50%,rgba(76,29,149,0.28),transparent_55%)]" />
        {/* center-right diagonal light beam (cyan → royal blue) */}
        <div className="absolute -top-32 left-1/2 h-[220%] w-[38%] rotate-[28deg] bg-[linear-gradient(to_bottom,rgba(56,189,248,0.16),rgba(37,99,235,0.05)_55%,transparent)] blur-2xl" />
        {/* bottom-right violet glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_88%_90%,rgba(217,70,239,0.18),transparent_50%)]" />
      </div>

{/* ---------- Sweeping wireframe wave (decorative graphic, not an icon) ---------- */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-[45%] opacity-80 md:block"
      >
        <svg viewBox="0 0 900 220" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
          <defs>
            <linearGradient id="wave" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#7c3aed" stopOpacity="0.25" />
              <stop offset="0.55" stopColor="#38bdf8" stopOpacity="0.7" />
              <stop offset="1" stopColor="#22d3ee" stopOpacity="0.9" />
            </linearGradient>
          </defs>
          {Array.from({ length: 30 }, (_, i) => {
            const t = i / 29;
            const y = 205 - t * 130;
            return (
              <path
                key={`w-${i}`}
                d={`M -20 ${y + 25} C 200 ${y + 10} 320 ${y - 70 + t * 18} 470 ${y - 55} S 720 ${y - 12} 920 ${y - 85}`}
                fill="none"
                stroke="url(#wave)"
                strokeWidth="1"
                opacity={0.2 + t * 0.6}
              />
            );
          })}
          <circle cx="330" cy="150" r="2" fill="#38bdf8" opacity="0.9" />
          <circle cx="520" cy="120" r="1.6" fill="#22d3ee" opacity="0.8" />
          <circle cx="700" cy="95" r="2" fill="#818cf8" opacity="0.7" />
          <circle cx="240" cy="175" r="1.4" fill="#38bdf8" opacity="0.6" />
        </svg>
      </div>

{/* ---------- Sparkles ---------- */}
      <Sparkle
        aria-hidden="true"
        className="absolute right-[30%] top-[12%] hidden h-5 w-5 fill-[#7dd3fc] text-[#7dd3fc] md:block"
      />
      <Sparkle
        aria-hidden="true"
        className="absolute right-[18%] top-[26%] hidden h-3.5 w-3.5 fill-[#60a5fa] text-[#60a5fa] opacity-80 md:block"
      />

{/* ---------- Content ---------- */}
      <div className="relative z-10 grid items-center gap-10 lg:grid-cols-[42%_58%] lg:px-2">
        {/* ===== LEFT: text & controls ===== */}
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#c084fc] sm:text-xs">
            Personal Automation Workspace
          </p>

<h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            <span className="text-white">AI </span>
            <span className="bg-gradient-to-r from-[#38bdf8] to-[#2563eb] bg-clip-text text-transparent">Client </span>
            <span className="bg-gradient-to-r from-[#c084fc] to-[#a855f7] bg-clip-text text-transparent">Hunter</span>
          </h1>

<p className="mt-4 max-w-[420px] text-sm leading-6 text-[#94a3b8] sm:text-base sm:leading-7">
            Find relevant web development opportunities across jobs, agencies and social platforms.
          </p>

{/* Buttons */}
        

{/* Feature list */}
          <ul className="mt-9 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-[#94a3b8]">
            {FEATURES.map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#38bdf8]/90">
                  <Check className="h-2.5 w-2.5 text-[#0b1730]" strokeWidth={3} />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

{/* ===== RIGHT: glassmorphic composition ===== */}
        <div className="relative mx-auto hidden h-[400px] w-full max-w-[560px] md:block" aria-hidden="true">
          {/* Faint wireframe window — decorative background depth */}
          <div className="absolute -right-2 -top-2 h-20 w-36 rotate-2 rounded-xl border border-blue-400/15 bg-white/[0.02]" />

{/* Card 2: "Automate Your Search" — floats above, no contact */}
          <div className="absolute right-2 top-2 z-20 flex -rotate-2 items-center gap-3 rounded-2xl border border-fuchsia-400/30 bg-[#1e1145]/70 px-4 py-3 shadow-[0_10px_40px_rgba(0,0,0,0.4)] backdrop-blur-md">
            <Sparkle className="h-5 w-5 shrink-0 fill-[#e879f9] text-[#e879f9]" />
            <p className="text-sm font-bold leading-tight text-white">
              Automate
              <br />
              Your Search
            </p>
          </div>

{/* Floating </> button */}
          <div className="absolute left-0 top-32 z-20 flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-400/40 bg-[#0b1230]/70 text-xs font-bold text-white shadow-[0_0_18px_rgba(34,211,238,0.25)] backdrop-blur-md">
            <Code2 className="h-5 w-5 text-[#7dd3fc]" />
          </div>

{/* Card 1: main "Find Opportunities" window */}
          <div className="absolute left-[12%] top-14 z-10 w-[80%] rotate-1 rounded-2xl border border-cyan-400/25 bg-[#0a1028]/80 p-4 shadow-[inset_1px_1px_0_rgba(125,211,252,0.25),0_24px_60px_rgba(0,0,0,0.45)] backdrop-blur-md">
            {/* traffic lights */}
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
            </div>
            <p className="mt-2 text-sm font-semibold text-white">Find Opportunities</p>

{/* search bar */}
            <div className="mt-2.5 flex items-center gap-2 rounded-full bg-[#060a1d] px-3 py-1.5">
              <Search className="h-3.5 w-3.5 text-[#7dd3fc]" strokeWidth={1.8} />
              <span className="text-[11px] text-[#64748b]">Search opportunities...</span>
            </div>

{/* 4 tiles */}
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              {TILES.map(({ name, icon: Icon, iconColor }) => (
                <div key={name} className="flex items-center gap-2.5 rounded-lg bg-[#0d1735] px-3 py-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#13214d]">
                    <Icon className={`h-4 w-4 ${iconColor}`} strokeWidth={1.6} />
                  </span>
                  <span className="truncate text-[12px] font-medium text-[#cbd5e1]">{name}</span>
                </div>
              ))}
            </div>
          </div>

{/* Floating globe button */}
          <div className="absolute bottom-24 left-[16%] z-20 flex h-11 w-11 items-center justify-center rounded-full border border-blue-400/40 bg-[#0b1230]/70 shadow-[0_0_18px_rgba(59,130,246,0.3)] backdrop-blur-md">
            <Globe className="h-5 w-5 text-white" strokeWidth={1.3} />
          </div>

{/* Card 3: "Grow Your Client Base" */}
          <div className="absolute bottom-0 right-0 z-30 w-[46%] rotate-1 rounded-2xl border border-cyan-300/50 bg-[#070d24]/85 p-4 shadow-[0_0_30px_rgba(34,211,238,0.18)] backdrop-blur-md">
            <p className="text-[11px] text-[#7dd3fc]">Grow Your</p>
            <p className="text-sm font-bold text-white">Client Base</p>

{/* growth chart graphic */}
            <svg viewBox="0 0 160 70" className="mt-2 h-14 w-full">
              <defs>
                <linearGradient id="bar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#22d3ee" stopOpacity="0.9" />
                  <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
                </linearGradient>
              </defs>
              <rect x="6" y="48" width="10" height="20" rx="2" fill="url(#bar)" />
              <rect x="40" y="38" width="10" height="30" rx="2" fill="url(#bar)" />
              <rect x="74" y="28" width="10" height="40" rx="2" fill="url(#bar)" />
              <rect x="108" y="18" width="10" height="50" rx="2" fill="url(#bar)" />
              <path d="M10 55 L45 42 L80 30 L115 14" fill="none" stroke="#22d3ee" strokeWidth="2.2" strokeLinecap="round" />
              <path d="M115 14 l10 -4 -3 10" fill="none" stroke="#22d3ee" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>
    </section>
        <section
      aria-label="Opportunity statistics"
      className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4"
    >
      {STATS.map(({ label, value, info, icon: Icon, tint }) => {
        const t = TINT_STYLES[tint];
        return (
          <article
            key={label}
            className="relative flex h-48 flex-col justify-between overflow-hidden rounded-2xl border border-slate-800/60 bg-[#090d1a]/85 p-6 shadow-[0_8px_25px_rgba(0,0,0,0.25)] backdrop-blur-md transition-colors hover:border-slate-700/80"
          >
            {/* Icon + text */}
            <div className="flex items-start gap-5">
              <div
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${t.iconBox}`}
                aria-hidden="true"
              >
                <Icon className={`h-6 w-6 ${t.icon}`} strokeWidth={1.8} />
              </div>
              <div className="min-w-0">
                <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {label}
                </h2>
                <p className="mt-1 text-4xl font-extrabold leading-none text-white">
                  {value}
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-400">{info}</p>
              </div>
            </div>

{/* Bottom decorative row: glowing wave + circle button */}
            <div className="absolute bottom-4 left-6 right-6 flex items-center justify-between">
              <svg
                aria-hidden="true"
                viewBox="0 0 120 30"
                fill="none"
                className={`h-8 w-[60%] ${t.wave}`}
              >
                <path
                  d="M0 20 Q15 5 30 20 T60 20 T90 20 T120 20"
                  stroke={t.waveStroke}
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>

<button
                type="button"
                aria-label={`View ${label}`}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-800/80 bg-slate-950/40 text-slate-400 transition-colors hover:border-slate-600 hover:text-white"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </article>
        );
      })}
    </section>

    

    <section
  aria-label="Workspace information"
  className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
>
  {[
    {
      title: "Your Stack",
      value: "Next.js · Tailwind",
      desc: "Technologies you work with",
      kind: "stack",
      iconBg: "bg-[#13396a]",
      iconColor: "text-[#72c8ff]",
      art: "react",
    },
    {
      title: "Backend",
      value: "NestJS · PostgreSQL",
      desc: "Backend skills and tools",
      kind: "backend",
      iconBg: "bg-[#13396a]",
      iconColor: "text-[#72c8ff]",
      art: "nestjs",
    },
    {
      title: "Target Markets",
      value: "Bangladesh + Global",
      desc: "Focus regions for opportunities",
      kind: "market",
      iconBg: "bg-[#06535d]",
      iconColor: "text-[#2ee6da]",
      art: "earth",
    },
    {
      title: "Source API",
      value: "Jobicy Arbeitnow Remotive ",
      desc: "Primary job data source",
      kind: "source",
      iconBg: "bg-[#13396a]",
      iconColor: "text-[#a8d8ff]",
      art: "server",
    },
  ].map((item) => (
    <div
      key={item.title}
      className="group relative overflow-hidden rounded-2xl border border-[#1f4673] bg-[#0b1d37] px-5 py-5 shadow-[0_8px_30px_rgba(0,0,0,0.18)] transition-all duration-300 hover:-translate-y-1 hover:border-[#2c639d]"
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left side */}
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <div
            className={`flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-2xl ${item.iconBg} ${item.iconColor}`}
          >
            {item.kind === "stack" && (
              <span className="text-[28px] font-extrabold tracking-tighter">
                {"</>"}
              </span>
            )}

            {item.kind === "backend" && (
              <svg
                viewBox="0 0 24 24"
                className="h-9 w-9 fill-none stroke-current stroke-[1.8]"
              >
                <ellipse cx="12" cy="5" rx="7" ry="2.8" />
                <path d="M5 5v5c0 1.6 3.1 2.8 7 2.8s7-1.2 7-2.8V5" />
                <path d="M5 10v5c0 1.6 3.1 2.8 7 2.8s7-1.2 7-2.8v-5" />
                <path d="M5 15v4c0 1.6 3.1 2.8 7 2.8s7-1.2 7-2.8v-4" />
              </svg>
            )}

            {item.kind === "market" && (
              <svg
                viewBox="0 0 24 24"
                className="h-8 w-8 fill-none stroke-current stroke-[1.7]"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3c3.5 3.5 3.5 14.5 0 18M12 3c-3.5 3.5-3.5 14.5 0 18" />
                <path d="M5.5 7.5h13M5.5 16.5h13" />
              </svg>
            )}

            {item.kind === "source" && (
              <svg
                viewBox="0 0 24 24"
                className="h-8 w-8 fill-none stroke-current stroke-[2]"
              >
                <path
                  d="M10 13a4.5 4.5 0 006.4 0l2.6-2.6a4.5 4.5 0 00-6.4-6.4L10.8 5.8"
                  strokeLinecap="round"
                />
                <path
                  d="M14 11a4.5 4.5 0 00-6.4 0L5 13.6A4.5 4.5 0 1011.4 20l1.8-1.8"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm text-[#a7bdd8]">{item.title}</p>
            <p className="mt-3 text-[15px] font-bold leading-6 text-white">
              {item.value}
            </p>
            <p className="mt-2 text-[13px] leading-6 text-[#9fb3cd]">
              {item.desc}
            </p>
          </div>
        </div>

        {/* Right artwork */}
        <div className="shrink-0 self-start pt-1">
          {item.art === "react" && (
            <svg
              viewBox="0 0 100 100"
              className="h-[72px] w-[72px] opacity-95"
            >
              <g fill="none" stroke="#08a8ff" strokeWidth="2.5">
                <ellipse cx="50" cy="50" rx="34" ry="13" />
                <ellipse
                  cx="50"
                  cy="50"
                  rx="34"
                  ry="13"
                  transform="rotate(60 50 50)"
                />
                <ellipse
                  cx="50"
                  cy="50"
                  rx="34"
                  ry="13"
                  transform="rotate(120 50 50)"
                />
              </g>
              <circle cx="50" cy="50" r="5.5" fill="#38bdf8" />
            </svg>
          )}

          {item.art === "nestjs" && (
            <svg viewBox="0 0 80 80" className="h-[68px] w-[68px]">
              <path
                d="M39 8c13 8 22 18 22 31 0 16-11 28-27 31 7-6 10-12 9-20-5 6-11 8-18 7 7-5 10-11 9-18-5 3-10 3-15 1 2-8 8-13 16-16-3-4-4-8-2-12 2 1 4 3 6 6z"
                fill="#f21854"
              />
              <path
                d="M39 28c7 5 10 12 8 18-3-3-6-5-10-5 4-4 5-8 2-13z"
                fill="#ff4f78"
              />
            </svg>
          )}

          {item.art === "earth" && (
            <div className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_25%,#5ea2ff,#17458f_68%,#0a1b38)] shadow-[inset_-10px_-8px_18px_rgba(0,0,0,0.38),0_0_18px_rgba(59,130,246,0.16)]">
              <svg
                viewBox="0 0 80 80"
                className="h-[70px] w-[70px] fill-none stroke-[#8fbcf0]/50 stroke-[1]"
              >
                <circle cx="40" cy="40" r="33" />
                <ellipse cx="40" cy="40" rx="16" ry="33" />
                <path d="M7 40h66M14 24h52M14 56h52" />
              </svg>
            </div>
          )}

          {item.art === "server" && (
            <svg viewBox="0 0 90 90" className="h-[72px] w-[72px]">
              <ellipse cx="45" cy="16" rx="26" ry="8" fill="#4098ff" />
              <path d="M19 16v46c0 5 11.5 9 26 9s26-4 26-9V16" fill="#123d86" />
              <path
                d="M19 30c0 5 11.5 9 26 9s26-4 26-9M19 44c0 5 11.5 9 26 9s26-4 26-9"
                fill="none"
                stroke="#56a8ff"
                strokeWidth="2"
              />
              <ellipse cx="45" cy="16" rx="26" ry="8" fill="#4aa1ff" />
            </svg>
          )}
        </div>
      </div>
    </div>
  ))}
</section>


{/* =========================
    HOW IT WORKS
========================== */}
<section
  aria-label="How It Works"
  className="relative mt-5 overflow-hidden rounded-2xl border border-[#1c365a] bg-[#08172e] px-5 py-6 shadow-[0_12px_35px_rgba(0,0,0,0.22)] sm:px-7"
>
  {/* Background glow */}
  <div
    aria-hidden="true"
    className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_85%_15%,rgba(76,29,149,0.12),transparent_40%)]"
  />

  {/* Decorative star */}
  <div
    aria-hidden="true"
    className="absolute right-[10%] top-5 h-1 w-1 rounded-full bg-violet-400 shadow-[0_0_10px_3px_rgba(139,92,246,0.6)]"
  />

  <div className="relative z-10">
    <h2 className="text-lg font-bold text-white">
      How It Works
    </h2>

    <div className="mt-2 h-[3px] w-10 rounded-full bg-gradient-to-r from-fuchsia-500 to-blue-600" />

    <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {[
        {
          number: "1",
          title: "Scan Jobs",
          desc: "Search and find relevant web development job opportunities from multiple sources.",
          art: "search",
        },
        {
          number: "2",
          title: "Discover Agencies",
          desc: "Find potential clients from agency directories and public sources.",
          art: "agency",
        },
        {
          number: "3",
          title: "Explore Social",
          desc: "Discover hiring signals on LinkedIn and other social platforms.",
          art: "social",
        },
        {
          number: "4",
          title: "Save & Track",
          desc: "Save interesting leads and track your outreach progress in one place.",
          art: "saved",
        },
      ].map((step) => (
        <div
          key={step.number}
          className="group relative flex min-h-[112px] items-start gap-3"
        >
          {/* Step number */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#315d9a] to-[#152e56] text-xs font-bold text-white">
            {step.number}
          </div>

          {/* Text, reserving room for artwork */}
          <div className="min-w-0 flex-1 pr-[76px]">
            <h3 className="text-[13px] font-semibold leading-5 text-white">
              {step.title}
            </h3>

            <p className="mt-2 text-[11px] leading-[1.7] text-[#a7b9d4]">
              {step.desc}
            </p>
          </div>

          {/* Illustration */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-0 top-0 flex h-[92px] w-[74px] items-center justify-center transition-transform duration-300 group-hover:-translate-y-1"
          >
            {step.art === "search" && (
              <svg viewBox="0 0 90 110" className="h-full w-full">
                <defs>
                  <linearGradient id="howSearch" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#35217e" />
                    <stop offset="1" stopColor="#0a1d54" />
                  </linearGradient>
                </defs>
                <g transform="translate(10 13) skewY(-9)">
                  <rect width="64" height="78" rx="8" fill="url(#howSearch)" stroke="#5144bf" />
                  <rect x="8" y="10" width="45" height="9" rx="3" fill="#673aef" />
                  <rect x="8" y="29" width="30" height="5" rx="2" fill="#243f8a" />
                  <rect x="8" y="41" width="38" height="5" rx="2" fill="#243f8a" />
                  <rect x="8" y="53" width="27" height="5" rx="2" fill="#243f8a" />
                </g>
                <rect x="46" y="41" width="35" height="38" rx="8" fill="#6d28d9" stroke="#a855f7" />
                <circle cx="61" cy="57" r="7" fill="none" stroke="white" strokeWidth="2" />
                <path d="M66 63l6 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            )}

            {step.art === "agency" && (
              <svg viewBox="0 0 90 110" className="h-full w-full">
                <defs>
                  <linearGradient id="howBuilding" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#7136ee" />
                    <stop offset="1" stopColor="#122557" />
                  </linearGradient>
                </defs>
                <rect x="14" y="30" width="38" height="61" rx="5" fill="url(#howBuilding)" stroke="#4731b9" />
                <rect x="43" y="44" width="31" height="47" rx="4" fill="#292080" stroke="#4c39c1" />
                {Array.from({ length: 3 }, (_, r) =>
                  Array.from({ length: 2 }, (_, c) => (
                    <rect
                      key={`${r}-${c}`}
                      x={22 + c * 14}
                      y={42 + r * 15}
                      width="7"
                      height="9"
                      rx="1.5"
                      fill="#8161fa"
                    />
                  ))
                )}
                {Array.from({ length: 3 }, (_, r) => (
                  <rect key={r} x="52" y={54 + r * 12} width="7" height="6" rx="1" fill="#6550d9" />
                ))}
                <rect x="40" y="8" width="23" height="25" rx="7" fill="#5125ae" />
                <path d="M51.5 13v14M44.5 20h14" stroke="#fb70b8" strokeWidth="3" strokeLinecap="round" />
                <ellipse cx="44" cy="95" rx="37" ry="5" fill="#17235b" opacity=".65" />
              </svg>
            )}

            {step.art === "social" && (
              <svg viewBox="0 0 90 110" className="h-full w-full">
                <g transform="translate(17 12) skewY(-6)">
                  <rect width="61" height="80" rx="7" fill="#102759" stroke="#3155ae" />
                  <rect x="9" y="12" width="42" height="8" rx="2" fill="#2551ae" />
                  <rect x="9" y="30" width="42" height="14" rx="3" fill="#1f3c8f" />
                  <rect x="9" y="52" width="42" height="16" rx="3" fill="#3425ae" />
                </g>
                <rect x="3" y="35" width="29" height="29" rx="6" fill="#0866bb" />
                <text x="17.5" y="56" textAnchor="middle" fill="white" fontSize="20" fontWeight="bold">
                  in
                </text>
                <rect x="37" y="64" width="34" height="19" rx="4" fill="#5638ed" />
                <path d="M44 70h18M44 76h12" stroke="#b8aaff" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}

            {step.art === "saved" && (
              <svg viewBox="0 0 90 110" className="h-full w-full">
                <g transform="translate(11 12) skewY(-6)">
                  <rect width="64" height="82" rx="7" fill="#112453" stroke="#3a45a0" />
                  <rect x="9" y="12" width="45" height="10" rx="2" fill="#5136c7" />
                  {[36, 52, 68].map((y) => (
                    <g key={y}>
                      <rect x="9" y={y - 6} width="7" height="7" rx="1.5" fill="#694def" />
                      <path d={`M22 ${y - 3}h29M22 ${y + 2}h20`} stroke="#385ba4" strokeWidth="2.5" strokeLinecap="round" />
                    </g>
                  ))}
                </g>
                <rect x="50" y="2" width="32" height="39" rx="7" fill="#4234de" stroke="#947cff" />
                <path d="M60 11h12v20l-6-4-6 4z" fill="#785aff" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        </div>
      ))}
    </div>
  </div>
</section>




      </>));
}
