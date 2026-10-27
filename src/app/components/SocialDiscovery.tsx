"use client";

import { useEffect, useState } from "react";

type Agency = { name?: string; website?: string };
type Mode = "business" | "demand";
type WebsiteStatus = "unknown" | "not_found" | "verified_no_website" | "website_exists";
type Lead = { id: string; title: string; url: string; platform: "facebook" | "instagram"; mode: Mode; country: string; category: string; snippet?: string; reportedDate: string | null; dateStatus: "reported_recent" | "unknown" | "not_applicable"; websiteStatus?: WebsiteStatus };
type Status = "New" | "Reviewed" | "Contacted" | "Replied" | "Closed";
type SavedLead = Lead & { agencyKey: string; status: Status; notes: string };
type Diagnostic = { requests: number; fetched: number; validUrls: number; irrelevantFiltered: number; oldExcluded: number; dateUnknown: number; duplicates: number; returned: number };
type Result = { success: boolean; leads?: Lead[]; diagnostics?: Diagnostic; warnings?: string[]; error?: string };
type AIAnalysis = { classification: string; priority: string; reason: string; suggestedAction: string };

const KEY = "ai-hunter-social-leads-v1"; // Preserve existing saved leads.
const COUNTRIES = ["USA", "UK", "Canada", "Bangladesh"];
const CATEGORIES = ["Restaurants & Cafes", "Clothing & Fashion", "Beauty Salons", "Real Estate", "Other"];
const TERMS = ["Web developer", "Website development", "React / Next.js", "Freelance developer", "Website redesign", "E-commerce website", "WordPress developer", "Shopify developer"];

function agencyKey(agency: Agency): string {
  if (!agency.website) return "";
  try { return new URL(/^https?:\/\//i.test(agency.website) ? agency.website : `https://${agency.website}`).hostname.toLowerCase().replace(/^www\./, ""); }
  catch { return ""; }
}

function Panel({ mode, saved, setSaved, options, aiResults, analyzingId, analyze, save, update, exportCsv }: {
  mode: Mode;
  saved: SavedLead[];
  setSaved: React.Dispatch<React.SetStateAction<SavedLead[]>>;
  options: [string, Agency][];
  aiResults: Record<string, AIAnalysis>;
  analyzingId: string | null;
  analyze: (lead: Lead) => Promise<void>;
  save: (lead: Lead) => void;
  update: (id: string, patch: Partial<SavedLead>) => void;
  exportCsv: (mode: Mode) => void;
}) {
    const [platform, setPlatform] = useState("both");
    const [country, setCountry] = useState("USA");
    const [category, setCategory] = useState(CATEGORIES[0]);
    const [term, setTerm] = useState(TERMS[0]);
    const [period, setPeriod] = useState("7");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [warnings, setWarnings] = useState<string[]>([]);
    const [results, setResults] = useState<Lead[]>([]);
    const [diagnostics, setDiagnostics] = useState<Diagnostic | null>(null);
    const [viewSaved, setViewSaved] = useState(false);
    const selected = viewSaved ? saved.filter(x => x.mode === mode) : results;
    const savedCount = saved.filter(x => x.mode === mode).length;
    const selectClass = "mt-1 w-full rounded-lg border border-[#31415b] bg-[#202d44] px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400";
    async function search() {
      if (loading) return;
      setLoading(true); setError(""); setWarnings([]); setResults([]); setDiagnostics(null); setViewSaved(false);
      const params = new URLSearchParams({ mode, platform, country, ...(mode === "business" ? { category } : { term, period }) });
      try {
        const response = await fetch(`/api/social-discovery?${params.toString()}`, { cache: "no-store" });
        const data: Result = await response.json();
        setWarnings(data.warnings ?? []); setDiagnostics(data.diagnostics ?? null);
        if (!response.ok || !data.success) throw new Error(data.error ?? "Search failed");
        setResults((data.leads ?? []).filter(x => x.mode === mode));
      } catch (err) { setError(err instanceof Error ? err.message : "Search failed"); }
      finally { setLoading(false); }
    }
    const hiring = mode === "demand";
    const accent = hiring ? "violet" : "emerald";
    const frame = hiring ? "border-violet-600/40" : "border-emerald-600/40";
    const action = hiring ? "bg-gradient-to-r from-violet-600 to-indigo-500 hover:from-violet-500 hover:to-indigo-400" : "bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400";
    return (
      <section id={hiring ? "hiring-posts" : "business-pages"} className={`min-w-0 overflow-hidden rounded-2xl border ${frame} bg-[#101a30] shadow-[0_10px_38px_rgba(0,0,0,0.18)]`}>
        <div className={`border-b ${hiring ? "border-violet-800/30 bg-violet-950/30" : "border-emerald-800/30 bg-emerald-950/20"} p-5`}>
          <div className="flex items-start gap-3">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl ${hiring ? "bg-violet-600" : "bg-emerald-500 text-slate-950"}`}>{hiring ? "◈" : "▣"}</div>
            <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{hiring ? "01 / Opportunity Finder" : "02 / Business Finder"}</p>
              <h2 className="mt-1 text-xl font-bold text-white">{hiring ? "Developer Hiring Posts" : "Small Business Pages"}</h2>
              <p className="mt-1 text-xs leading-5 text-slate-400">{hiring ? "Find indexed public posts asking for a website or developer." : "Find indexed small-business profiles. Check whether they have a website."}</p>
            </div>
          </div>
        </div>
        <div className="grid gap-3 border-b border-[#25334a] p-4 sm:grid-cols-2">
          <label className="text-xs font-medium text-slate-300">Platform<select className={selectClass} value={platform} onChange={e => setPlatform(e.target.value)}><option value="both">Facebook + Instagram</option><option value="facebook">Facebook only</option><option value="instagram">Instagram only</option></select></label>
          <label className="text-xs font-medium text-slate-300">Country<select className={selectClass} value={country} onChange={e => setCountry(e.target.value)}>{COUNTRIES.map(x => <option key={x}>{x}</option>)}</select></label>
          {hiring ? (<>
            <label className="text-xs font-medium text-slate-300">Developer keyword<select className={selectClass} value={term} onChange={e => setTerm(e.target.value)}>{TERMS.map(x => <option key={x}>{x}</option>)}</select></label>
            <label className="text-xs font-medium text-slate-300">Search window<select className={selectClass} value={period} onChange={e => setPeriod(e.target.value)}><option value="7">7 days (search hint)</option><option value="30">30 days (search hint)</option></select></label>
          </>) : <>
            <label className="text-xs font-medium text-slate-300">Business category<select className={selectClass} value={category} onChange={e => setCategory(e.target.value)}>{CATEGORIES.map(x => <option key={x}>{x}</option>)}</select></label>
            <div className="rounded-xl border border-amber-700/30 bg-amber-950/20 px-3 py-2 text-xs text-amber-200"><span className="font-semibold">Website priority</span><p className="mt-1 text-amber-100/70">Verify website status manually; missing data ≠ no website.</p></div>
          </>}
          <button onClick={search} disabled={loading} className={`rounded-xl px-5 py-3 text-sm font-semibold text-white transition disabled:opacity-40 sm:col-span-2 ${action}`}>{loading ? "Searching..." : hiring ? "⌕  Search Hiring Posts" : "⌕  Search Business Pages"}</button>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-[#25334a] px-4 py-3">
          <button onClick={() => setViewSaved(false)} className={`rounded-lg px-3 py-2 text-xs font-medium ${!viewSaved ? hiring ? "bg-violet-600 text-white" : "bg-emerald-600 text-white" : "border border-[#30405e] text-slate-300"}`}>Results ({results.length})</button>
          <button id={hiring ? undefined : "saved-leads"} onClick={() => setViewSaved(true)} className={`rounded-lg px-3 py-2 text-xs font-medium ${viewSaved ? hiring ? "bg-violet-600 text-white" : "bg-emerald-600 text-white" : "border border-[#30405e] text-slate-300"}`}>Saved ({savedCount})</button>
          <button onClick={() => exportCsv(mode)} disabled={!savedCount} className="ml-auto rounded-lg border border-[#30405e] px-3 py-2 text-xs text-slate-300 disabled:opacity-40">Export CSV ↓</button>
        </div>
        {error && <p className="mx-4 mt-3 rounded-lg border border-red-900/70 bg-red-950/40 p-3 text-xs text-red-300">{error}</p>}
        {warnings.map((warning, i) => <p key={i} className="mx-4 mt-2 break-words text-xs text-amber-300">{warning}</p>)}
        {diagnostics && <div className="mx-4 mt-3 flex flex-wrap gap-x-3 gap-y-1 rounded-lg border border-[#2b3b55] bg-[#0b1629] p-3 text-[11px] text-slate-400"><span>API: {diagnostics.requests}</span><span>Fetched: {diagnostics.fetched}</span><span>Valid: {diagnostics.validUrls}</span><span>Excluded: {diagnostics.irrelevantFiltered}</span><span>Old: {diagnostics.oldExcluded}</span><span>Unknown dates: {diagnostics.dateUnknown}</span><span>Shown: {diagnostics.returned}</span></div>}
        <div className="space-y-3 p-3 sm:p-4">
          {selected.map(lead => {
            const item = saved.find(x => x.id === lead.id);
            const websiteStatus = item?.websiteStatus ?? lead.websiteStatus ?? "unknown";
            return <article key={lead.id} className="rounded-xl border border-[#293b57] bg-[#0c182b] p-4 transition hover:border-[#526684]">
              <div className="flex flex-wrap items-center gap-2 text-[11px]"><span className={`rounded-md px-2 py-1 font-semibold ${lead.platform === "facebook" ? "bg-blue-600/20 text-blue-300" : "bg-pink-600/20 text-pink-300"}`}>{lead.platform === "facebook" ? "f  Facebook" : "◎ Instagram"}</span><span className="text-slate-500">{lead.country}</span>{!hiring && <span className="rounded-md bg-indigo-600/20 px-2 py-1 text-indigo-200">{lead.category}</span>}</div>
              <h3 className="mt-3 break-words text-sm font-semibold leading-6 text-white">{lead.title}</h3>
              {lead.snippet && <p className="mt-1 line-clamp-3 text-xs leading-5 text-slate-400">{lead.snippet.slice(0, 280)}</p>}
              {hiring ? <p className="mt-2 text-[11px] text-amber-300">{lead.dateStatus === "reported_recent" ? `Search-reported: ${lead.reportedDate} (unverified)` : "Post date unknown · verify original post"}</p> : <p className={`mt-2 text-[11px] ${websiteStatus === "verified_no_website" ? "text-emerald-300" : websiteStatus === "website_exists" ? "text-amber-300" : "text-slate-400"}`}>{websiteStatus === "verified_no_website" ? "No Website — manually verified" : websiteStatus === "website_exists" ? "Website exists — lower outreach priority" : websiteStatus === "not_found" ? "Website not found — verification required" : "Website status unknown · verify manually"}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={lead.url} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-[#40516b] px-3 py-2 text-xs font-medium text-slate-200 hover:bg-[#26364e]">View {hiring ? "Post" : "Page"} ↗</a>
                {!item ? <button onClick={() => save(lead)} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500">＋ Save Lead</button> : <button onClick={() => setSaved(current => current.filter(x => x.id !== lead.id))} className="rounded-lg border border-amber-700 px-3 py-2 text-xs text-amber-300">Remove Saved</button>}
                <button onClick={() => analyze(lead)} disabled={analyzingId !== null} className="rounded-lg border border-violet-600/70 bg-violet-950/25 px-3 py-2 text-xs font-medium text-violet-200 disabled:opacity-40">✧ {analyzingId === lead.id ? "Analyzing..." : "Analyze with Gemini"}</button>
              </div>
              {aiResults[lead.id] && <div className="mt-4 rounded-lg border border-violet-700/40 bg-violet-950/20 p-3 text-xs"><p className="font-semibold text-violet-300">AI analysis · unverified</p><p className="mt-1">Type: {aiResults[lead.id].classification} · Priority: {aiResults[lead.id].priority}</p><p className="mt-2 text-slate-300">{aiResults[lead.id].reason}</p><p className="mt-1 text-cyan-300">Next: {aiResults[lead.id].suggestedAction}</p></div>}
              {item && <div className="mt-4 grid gap-3 border-t border-[#2a3850] pt-3 sm:grid-cols-2">
                <label className="text-xs text-slate-300">Match with agency<select className={selectClass} value={item.agencyKey} onChange={e => update(item.id, { agencyKey: e.target.value })}><option value="">No verified match</option>{options.map(([key, a]) => <option key={key} value={key}>{a.name || key}</option>)}</select></label>
                <label className="text-xs text-slate-300">Contact status<select className={selectClass} value={item.status} onChange={e => update(item.id, { status: e.target.value as Status })}>{["New", "Reviewed", "Contacted", "Replied", "Closed"].map(s => <option key={s}>{s}</option>)}</select></label>
                <label className="text-xs text-slate-300 sm:col-span-2">Notes<textarea className={selectClass} value={item.notes} rows={2} maxLength={1000} onChange={e => update(item.id, { notes: e.target.value })} placeholder="Verification, public business contact, follow-up..." /></label>
              </div>}
            </article>;
          })}
          {selected.length === 0 && <div className="rounded-xl border border-dashed border-[#344461] px-4 py-12 text-center text-sm text-slate-400">{viewSaved ? "No saved leads in this section." : "No matching candidates yet. Search to find public indexed links."}</div>}
        </div>
      </section>

    );
  }

export default function SocialDiscovery({ agencies }: { agencies: Agency[] }) {
  const [saved, setSaved] = useState<SavedLead[]>([]);
  const [ready, setReady] = useState(false);
  const [aiResults, setAiResults] = useState<Record<string, AIAnalysis>>({});
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [aiError, setAiError] = useState("");

  useEffect(() => {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
      if (Array.isArray(value)) setSaved(value.filter((v): v is SavedLead => v && typeof v.id === "string" && typeof v.url === "string").map(v => ({ ...v, status: v.status ?? "New", notes: v.notes ?? "", agencyKey: v.agencyKey ?? "" })));
    } catch { /* Keep the page usable when storage is corrupt. */ }
    setReady(true);
  }, []);
  useEffect(() => { if (ready) { try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch { /* storage might be unavailable */ } } }, [saved, ready]);
  const options = [...new Map(agencies.map(a => [agencyKey(a), a] as const).filter(([k]) => Boolean(k))).entries()];

  function save(lead: Lead) { setSaved(current => current.some(x => x.id === lead.id) ? current : [...current, { ...lead, agencyKey: "", status: "New", notes: "" }]); }
  function update(id: string, patch: Partial<SavedLead>) { setSaved(current => current.map(x => x.id === id ? { ...x, ...patch } : x)); }
  function exportCsv(mode: Mode) {
    const columns = ["Platform", "Mode", "Title", "URL", "Country", "Category", "Date Status", "Reported Date", "Agency", "Status", "Notes"];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/^[=+@-]/, "'$&").replace(/"/g, '""')}"`;
    const rows = saved.filter(x => x.mode === mode).map(x => [x.platform, x.mode, x.title, x.url, x.country, x.category, x.dateStatus, x.reportedDate, x.agencyKey, x.status, x.notes]);
    const csv = [columns, ...rows].map(row => row.map(esc).join(",")).join("\r\n");
    const blobUrl = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = blobUrl; anchor.download = `${mode}-social-leads.csv`; document.body.appendChild(anchor); anchor.click(); anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 500);
  }
  async function analyze(lead: Lead) {
    if (analyzingId) return;
    setAnalyzingId(lead.id); setAiError("");
    try {
      const response = await fetch("/api/gemini-analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: lead.title, platform: lead.platform, mode: lead.mode, reportedDate: lead.reportedDate }) });
      const data: { success?: boolean; analysis?: AIAnalysis; error?: string } = await response.json();
      if (!response.ok || !data.success || !data.analysis) throw new Error(data.error ?? "Gemini analysis failed");
      setAiResults(current => ({ ...current, [lead.id]: data.analysis! }));
    } catch (error) { setAiError(error instanceof Error ? error.message : "Gemini analysis failed"); }
    finally { setAnalyzingId(null); }
  }


  const panelProps = { saved, setSaved, options, aiResults, analyzingId, analyze, save, update, exportCsv };
  return <section id="social-discovery" className="mt-12 scroll-mt-24">
    <div className="mb-6"><p className="text-xs font-bold uppercase tracking-[0.17em] text-violet-300">Lead Generation Workspace</p><h2 className="mt-2 text-3xl font-extrabold tracking-tight text-white">Social Discovery</h2><p className="mt-2 text-sm text-slate-400">Find developer opportunities and small-business pages across Facebook & Instagram.</p></div>
    {aiError && <p className="mt-4 rounded-lg border border-red-900 p-3 text-sm text-red-400">Gemini: {aiError}</p>}
    <div className="grid grid-cols-1 items-start gap-4 2xl:grid-cols-2 xl:gap-5"><Panel mode="demand" {...panelProps} /><Panel mode="business" {...panelProps} /></div>
    <p className="mt-5 text-xs text-slate-500">Only search-indexed public links. No Meta scraping. Saved leads remain in this browser. Existing saved leads use the same storage key; use CSV backup before editing or clearing browser data.</p>
  </section>;
}
