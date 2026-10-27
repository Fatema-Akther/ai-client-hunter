"use client";

import { useEffect, useRef, useState } from "react";
import DashboardShell from "./DashboardShell";
import LinkedInHiring from "./LinkedInHiring";
import SocialDiscovery from "./SocialDiscovery";

type Job = { id: string; title: string; company: string; location: string; description: string; url: string; publishedAt: string | null; score: number; matchedSkills: string[]; source: string; eligible: boolean; level: string; experienceStatus: string; locationCategory: string; isFresh: boolean; freshnessStatus: string; jobType: string[] };
type SourceDiagnostic = { source: string; status: "success" | "empty" | "failed"; fetched: number; invalid: number; filteredOut: number; matched: number; duplicates: number; error?: string };
type AgencySourceStats = { source: string; status: "success" | "partial" | "failed" | "empty" | "skipped"; fetched: number; matched: number; duplicates: number; filtered: number; warnings: string[] };
type Agency = { slug?: string; name?: string; website?: string; profile_url?: string; rating?: number; total_reviews?: number; services?: string[]; industries?: string[]; tagline?: string; team_size?: string; description?: string; location?: { city?: string; country?: string } | string };
type AgencySignal = { name: string; website: string; status: string; evidence: string[]; checkedUrls: string[]; hiringSignal: boolean; contractSignal: boolean; priorityScore: number };
type AgencySignalResult = Omit<AgencySignal, "priorityScore">;
type AgencySignalResponse = { success: boolean; checked: number; results: AgencySignalResult[]; error?: string };
type AgencyResponse = { success: boolean; totalFound: number; agencies: Agency[]; warnings?: string[]; error?: string; sourceStats?: AgencySourceStats[] };
type ApplicationStatus = "Not Applied" | "Applied" | "Interview" | "Rejected" | "Offer";
type AgencyApplicationStatus = "No message" | "Messaged" | "Reply" | "Rejected" | "Not reply" | "Follow up" | "confirm";

const JOBS_STORAGE_KEY = "ai-client-hunter-saved-jobs";
const STATUSES_STORAGE_KEY = "ai-client-hunter-application-statuses";
const AGENCIES_STORAGE_KEY = "ai-client-hunter-saved-agencies";
const SIGNALS_STORAGE_KEY = "ai-client-hunter-agency-signals";
const AGENCY_STATUSES_STORAGE_KEY = "ai-client-hunter-agency-statuses";

function getAgencyKey(agency: Agency): string {
  for (const candidate of [agency.website, agency.profile_url]) {
    if (!candidate) continue;
    try {
      const url = new URL(/^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`);
      return url.hostname.toLowerCase().replace(/^www\./, "");
    } catch { /* fall back to next identifier */ }
  }
  return agency.slug?.toLowerCase().trim() || agency.name?.toLowerCase().trim().replace(/\s+/g, " ") || "";
}

function deduplicateAgencies(agencies: Agency[]): Agency[] {
  const unique = new Map<string, Agency>();
  for (const agency of agencies) {
    const key = getAgencyKey(agency);
    if (!key) continue;
    const existing = unique.get(key);
    unique.set(key, existing ? { ...existing, ...agency, services: [...new Set([...(existing.services ?? []), ...(agency.services ?? [])])], industries: [...new Set([...(existing.industries ?? []), ...(agency.industries ?? [])])] } : agency);
  }
  return [...unique.values()];
}

function calculatePriorityScore(agency: Agency, signal: AgencySignalResult): number {
  const services = [...(agency.services ?? []), ...(agency.industries ?? []), agency.tagline ?? "", agency.description ?? ""].join(" ");
  const serviceMatch = /\b(web development|software development|e-?commerce|frontend|backend|react|next\.?js|wordpress|shopify|full[\s-]?stack)\b/i.test(services);
  return Math.min(100, (signal.hiringSignal ? 40 : 0) + (signal.contractSignal ? 30 : 0) + (serviceMatch ? 15 : 0) + ((agency.rating ?? 0) >= 4 ? 10 : 0) + ((agency.total_reviews ?? 0) >= 10 ? 5 : 0));
}
function getPriorityLabel(score: number) { return score >= 60 ? "High Priority" : score >= 30 ? "Medium Priority" : "Low Priority"; }

const panel = "rounded-2xl border border-[#263650] bg-[#101c32] p-5";
const action = "rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40";
const primary = `${action} bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-500 hover:to-violet-500`;
const secondary = `${action} border border-[#354765] bg-[#15253f] text-slate-200 hover:border-violet-500`;
const select = "rounded-lg border border-[#344765] bg-[#192941] px-3 py-2 text-sm text-white";

export type WorkspaceView = "overview" | "jobs" | "agencies" | "linkedin" | "social" | "saved";

export default function ClientWorkspace({ view }: { view: WorkspaceView }) {
  const [running, setRunning] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [message, setMessage] = useState("Scanner বন্ধ। Start Scan চাপলে বাস্তব Job খোঁজা হবে।");
  const [totalFetched, setTotalFetched] = useState(0);
  const [error, setError] = useState("");
  const controllerRef = useRef<AbortController | null>(null);
  const [sourceDiagnostics, setSourceDiagnostics] = useState<SourceDiagnostic[]>([]);
  const [savedJobs, setSavedJobs] = useState<Job[]>([]);
  const [applicationStatuses, setApplicationStatuses] = useState<Record<string, ApplicationStatus>>({});
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [agencySourceStats, setAgencySourceStats] = useState<AgencySourceStats[]>([]);
  const [agencyApplicationStatuses, setAgencyApplicationStatuses] = useState<Record<string, AgencyApplicationStatus>>({});
  const [agencyStatusReady, setAgencyStatusReady] = useState(false);
  const [checkingAllSignals, setCheckingAllSignals] = useState(false);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [agencyRunning, setAgencyRunning] = useState(false);
  const [agencyMessage, setAgencyMessage] = useState("Agency search বন্ধ। Start Search চাপো।");
  const [agencyError, setAgencyError] = useState("");
  const [savedAgencies, setSavedAgencies] = useState<Agency[]>([]);
  const [agencySignals, setAgencySignals] = useState<Record<string, AgencySignal>>({});
  const [showSavedAgencies, setShowSavedAgencies] = useState(false);
  const [agencyStorageReady, setAgencyStorageReady] = useState(false);
  const [checkingAgencyKeys, setCheckingAgencyKeys] = useState<string[]>([]);
  const agencyControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      const data = localStorage.getItem(AGENCY_STATUSES_STORAGE_KEY);
      if (data) { const parsed: unknown = JSON.parse(data); if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) setAgencyApplicationStatuses(parsed as Record<string, AgencyApplicationStatus>); }
    } catch { console.error("Could not load agency statuses."); }
    finally { setAgencyStatusReady(true); }
  }, []);
  useEffect(() => { if (agencyStatusReady) try { localStorage.setItem(AGENCY_STATUSES_STORAGE_KEY, JSON.stringify(agencyApplicationStatuses)); } catch { console.error("Could not save agency statuses."); } }, [agencyApplicationStatuses, agencyStatusReady]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(JOBS_STORAGE_KEY);
      const statuses = localStorage.getItem(STATUSES_STORAGE_KEY);
      if (saved) { const parsed: unknown = JSON.parse(saved); if (Array.isArray(parsed)) setSavedJobs(parsed as Job[]); }
      if (statuses) { const parsed: unknown = JSON.parse(statuses); if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) setApplicationStatuses(parsed as Record<string, ApplicationStatus>); }
    } catch { console.error("Could not load saved jobs."); }
    finally { setStorageReady(true); }
  }, []);
  useEffect(() => { if (!storageReady) return; try { localStorage.setItem(JOBS_STORAGE_KEY, JSON.stringify(savedJobs)); localStorage.setItem(STATUSES_STORAGE_KEY, JSON.stringify(applicationStatuses)); } catch { console.error("Could not save job tracking data."); } }, [savedJobs, applicationStatuses, storageReady]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(AGENCIES_STORAGE_KEY);
      const signals = localStorage.getItem(SIGNALS_STORAGE_KEY);
      if (saved) { const parsed: unknown = JSON.parse(saved); if (Array.isArray(parsed)) setSavedAgencies(deduplicateAgencies(parsed as Agency[])); }
      if (signals) { const parsed: unknown = JSON.parse(signals); if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) setAgencySignals(parsed as Record<string, AgencySignal>); }
    } catch { console.error("Could not load saved agency data."); }
    finally { setAgencyStorageReady(true); }
  }, []);
  useEffect(() => { if (!agencyStorageReady) return; try { localStorage.setItem(AGENCIES_STORAGE_KEY, JSON.stringify(savedAgencies)); localStorage.setItem(SIGNALS_STORAGE_KEY, JSON.stringify(agencySignals)); } catch { console.error("Could not save agency data."); } }, [savedAgencies, agencySignals, agencyStorageReady]);

  function saveJob(job: Job) { setSavedJobs(current => current.some(item => item.id === job.id) ? current : [...current, job]); }
  function removeSavedJob(jobId: string) { setSavedJobs(current => current.filter(job => job.id !== jobId)); }
  function updateApplicationStatus(jobId: string, status: ApplicationStatus) { setApplicationStatuses(current => ({ ...current, [jobId]: status })); }
  const visibleJobs = showSavedOnly ? savedJobs : jobs;
  function toggleSavedAgency(agency: Agency) { const key = getAgencyKey(agency); if (!key) return; setSavedAgencies(current => current.some(item => getAgencyKey(item) === key) ? current.filter(item => getAgencyKey(item) !== key) : [...current, agency]); }
  function updateAgencyApplicationStatus(key: string, status: AgencyApplicationStatus) { setAgencyApplicationStatuses(current => ({ ...current, [key]: status })); }

  async function startAgencySearch() {
    if (agencyControllerRef.current) return;
    const controller = new AbortController(); agencyControllerRef.current = controller;
    setAgencyRunning(true); setAgencyError(""); setAgencyMessage("Agency খোঁজা হচ্ছে...");
    try {
      const response = await fetch("/api/agency-discovery", { cache: "no-store", signal: controller.signal });
      const data: AgencyResponse = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Agency search ব্যর্থ হয়েছে।");
      if (controller.signal.aborted) return;
      const unique = deduplicateAgencies(data.agencies ?? []);
      setAgencies(unique); setAgencySourceStats(data.sourceStats ?? []);
      setAgencyMessage(`Search সম্পন্ন। ${unique.length}টি unique Agency পাওয়া গেছে।`);
      if (data.warnings?.length) setAgencyError(`${data.warnings.length}টি search query-তে সমস্যা হয়েছে। সব Public Source-এর ফল পাওয়া নাও যেতে পারে।`);
    } catch (err) {
      if (controller.signal.aborted) setAgencyMessage("Agency search বন্ধ করা হয়েছে।");
      else { setAgencyError(err instanceof Error ? err.message : "অজানা Error"); setAgencyMessage("Search সম্পন্ন করা যায়নি।"); }
    } finally { if (agencyControllerRef.current === controller) { agencyControllerRef.current = null; setAgencyRunning(false); } }
  }
  function stopAgencySearch() { const controller = agencyControllerRef.current; if (!controller) return; controller.abort(); agencyControllerRef.current = null; setAgencyRunning(false); setAgencyMessage("Agency search বন্ধ করা হয়েছে।"); }

  async function checkAllAgencySignals() {
    if (checkingAllSignals || !agencies.length) return;
    setCheckingAllSignals(true); setAgencyError(""); setCheckingAgencyKeys(agencies.map(getAgencyKey).filter(Boolean));
    let checkedCount = 0;
    try {
      for (let i = 0; i < agencies.length; i += 10) {
        const batch = agencies.slice(i, i + 10);
        setAgencyMessage(`Checking signals: ${checkedCount}/${agencies.length} agencies...`);
        const response = await fetch("/api/agency-signals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agencies: batch.map(a => ({ name: a.name, website: a.website })) }) });
        const data: AgencySignalResponse = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || "Signal check failed.");
        const updates: Record<string, AgencySignal> = {};
        for (const result of data.results ?? []) {
          const key = getAgencyKey({ name: result.name, website: result.website });
          const agency = batch.find(item => getAgencyKey(item) === key);
          if (agency && key) updates[key] = { ...result, priorityScore: calculatePriorityScore(agency, result) };
        }
        setAgencySignals(current => ({ ...current, ...updates }));
        checkedCount += batch.length;
        setAgencyMessage(`Signal Check progress: ${Math.min(checkedCount, agencies.length)}/${agencies.length} agencies processed.`);
      }
      setAgencyMessage(`Signal Check সম্পন্ন। ${agencies.length}টি Agency process করা হয়েছে।`);
    } catch (err) { setAgencyError(err instanceof Error ? err.message : "Signal check failed."); setAgencyMessage(`Signal Check আংশিক সম্পন্ন: ${checkedCount}/${agencies.length} processed.`); }
    finally { setCheckingAllSignals(false); setCheckingAgencyKeys([]); }
  }

  async function checkAgencySignal(agency: Agency) {
    const key = getAgencyKey(agency);
    if (!agency.website) { setAgencyError(`${agency.name ?? "এই Agency"}-র Website পাওয়া যায়নি।`); return; }
    if (checkingAgencyKeys.includes(key)) return;
    setCheckingAgencyKeys(current => [...current, key]); setAgencyError("");
    setAgencyMessage(`${agency.name ?? "Agency"}-র Hiring ও Contract Signal যাচাই হচ্ছে...`);
    try {
      const response = await fetch("/api/agency-signals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agencies: [{ name: agency.name, website: agency.website }] }) });
      const data: AgencySignalResponse = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Signal check ব্যর্থ হয়েছে।");
      const result = data.results?.[0]; if (!result) throw new Error("কোনো Signal result পাওয়া যায়নি।");
      const priorityScore = calculatePriorityScore(agency, result);
      setAgencySignals(current => ({ ...current, [key]: { ...result, priorityScore } }));
      setAgencyMessage(`${agency.name ?? "Agency"}-র Signal Check সম্পন্ন। Priority Score: ${priorityScore}/100`);
    } catch (err) { setAgencyError(err instanceof Error ? err.message : "Signal check ব্যর্থ হয়েছে।"); setAgencyMessage("Signal Check সম্পন্ন করা যায়নি।"); }
    finally { setCheckingAgencyKeys(current => current.filter(item => item !== key)); }
  }

  const displayedAgencies = showSavedAgencies ? savedAgencies : agencies;

  async function startScan() {
    if (controllerRef.current) return;
    const controller = new AbortController(); controllerRef.current = controller;
    setRunning(true); setError(""); setMessage("Jobicy থেকে বাস্তব Job সংগ্রহ করা হচ্ছে...");
    try {
      const response = await fetch("/api/scan", { method: "GET", cache: "no-store", signal: controller.signal });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Job সংগ্রহ করা যায়নি।");
      if (controller.signal.aborted) return;
      setJobs(data.jobs); setTotalFetched(data.totalFetched); setSourceDiagnostics(data.sourceDiagnostics ?? []);
      setMessage(`Scan সম্পন্ন। ${data.matchedCount}টি matching Job পাওয়া গেছে।`);
    } catch (err) {
      if (controller.signal.aborted) setMessage("Scan বন্ধ করা হয়েছে।");
      else { setError(err instanceof Error ? err.message : "অজানা Error হয়েছে।"); setMessage("Job সংগ্রহ করা যায়নি।"); }
    } finally { if (controllerRef.current === controller) { controllerRef.current = null; setRunning(false); } }
  }
  function stopScan() { const controller = controllerRef.current; if (!controller) return; controller.abort(); controllerRef.current = null; setRunning(false); setMessage("Scan বন্ধ করা হয়েছে।"); }

  const sharedAgencies = deduplicateAgencies([...agencies, ...savedAgencies]);

  return (
    <DashboardShell>
      {view === "overview" && (<>
      <header id="overview" className="scroll-mt-24 flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-400">Personal automation workspace</p><h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">AI Client Hunter</h1><p className="mt-2 text-sm text-slate-400">Find relevant web development opportunities across jobs, agencies and social platforms.</p></div>
        <div className="flex gap-2"><button onClick={startScan} disabled={running} className={primary}>{running ? "Scanning..." : "Start Scan"}</button><button onClick={stopScan} disabled={!running} className={secondary}>Stop</button></div>
      </header>

      <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[["Matching Jobs", jobs.length], ["Saved Jobs", savedJobs.length], ["Discovered Agencies", agencies.length], ["Saved Agencies", savedAgencies.length]].map(([label, value]) => <div key={label} className={panel}><p className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</p><p className="mt-3 text-3xl font-bold text-white">{value}</p></div>)}
      </section>
      <section className={`${panel} mt-5`}><div className="flex items-center gap-3"><span className={`h-2.5 w-2.5 rounded-full ${running ? "bg-emerald-400" : "bg-slate-500"}`} /><h2 className="font-semibold">Job Scanner: {running ? "Running" : "Stopped"}</h2></div><p className="mt-3 text-sm text-slate-400">{message}</p>{error && <p className="mt-2 text-sm text-red-400">{error}</p>}</section>

      </>)}
      {view === "jobs" && (<>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-bold">Job Opportunities</h1><div className="flex gap-2"><button onClick={startScan} disabled={running} className={primary}>{running ? "Scanning..." : "Start Scan"}</button><button onClick={stopScan} disabled={!running} className={secondary}>Stop</button></div></div><p className="mb-4 text-sm text-slate-400">{message}</p>{error && <p className="mb-4 text-sm text-red-400">{error}</p>}
      <section id="job-opportunities" className="mt-12 scroll-mt-24">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-indigo-400">Job Discovery</p><h2 className="mt-1 text-2xl font-bold">Job Opportunities</h2><p className="mt-2 text-sm text-slate-400">{jobs.length} matching jobs · {totalFetched} fetched from sources</p></div><div className="flex flex-wrap gap-2"><button onClick={() => setShowSavedOnly(false)} className={!showSavedOnly ? primary : secondary}>All Jobs ({jobs.length})</button><button onClick={() => setShowSavedOnly(true)} className={showSavedOnly ? primary : secondary}>My Saved Jobs ({savedJobs.length})</button><a href="https://jobs.bdjobs.com/jobsearch-cache.asp" target="_blank" rel="noopener noreferrer" className={secondary}>Bangladesh Jobs ↗</a></div></div>
        {sourceDiagnostics.length > 0 && <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{sourceDiagnostics.map(d => <article key={d.source} className={panel}><div className="flex items-center justify-between"><h3 className="font-semibold">{d.source}</h3><span className={`rounded-full px-2 py-1 text-xs ${d.status === "success" ? "bg-emerald-950 text-emerald-300" : d.status === "empty" ? "bg-amber-950 text-amber-300" : "bg-rose-950 text-rose-300"}`}>{d.status.toUpperCase()}</span></div><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><p>Fetched <b>{d.fetched}</b></p><p>Matched <b className="text-emerald-300">{d.matched}</b></p><p>Filtered <b>{d.filteredOut}</b></p><p>Duplicates <b>{d.duplicates}</b></p><p>Invalid <b>{d.invalid}</b></p></div>{d.error && <p className="mt-3 text-xs text-rose-300">{d.error}</p>}</article>)}</div>}
        {visibleJobs.length === 0 ? <div className={`${panel} mt-5 text-center text-slate-400`}>{showSavedOnly ? "No saved jobs to display" : "No jobs loaded yet. Press Start Scan."}</div> : <div className="mt-5 grid gap-4 xl:grid-cols-2">{visibleJobs.map(job => <article key={job.id} className={panel}><div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="text-xs text-indigo-300">{job.source} · {job.location}</p><h3 className="mt-2 text-lg font-semibold">{job.title}</h3><p className="mt-1 text-sm text-slate-400">{job.company}</p></div><div className="shrink-0 rounded-xl bg-[#192941] p-3 text-center"><p className="text-xl font-bold text-emerald-300">{job.score}</p><p className="text-[10px] text-slate-400">Match Score</p></div></div><div className="mt-4 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-indigo-900/40 px-2 py-1 text-indigo-200">{job.level}</span><span className="rounded-full bg-slate-800 px-2 py-1">{job.experienceStatus}</span><span className="rounded-full bg-slate-800 px-2 py-1">{job.locationCategory}</span><span className="rounded-full bg-slate-800 px-2 py-1">{job.freshnessStatus}</span></div><p className="mt-4 text-sm leading-6 text-slate-300">{job.description}</p><div className="mt-4 flex flex-wrap gap-2">{job.matchedSkills.slice(0, 8).map(skill => <span key={skill} className="rounded-lg border border-slate-700 px-2 py-1 text-xs">{skill}</span>)}</div>{job.publishedAt && <p className="mt-3 text-xs text-slate-500">Published: {new Date(job.publishedAt).toLocaleDateString()}</p>}<div className="mt-5 flex flex-wrap gap-2"><button onClick={() => savedJobs.some(item => item.id === job.id) ? removeSavedJob(job.id) : saveJob(job)} className={secondary}>{savedJobs.some(item => item.id === job.id) ? "Remove Saved" : "Save Job"}</button><select value={applicationStatuses[job.id] ?? "Not Applied"} onChange={e => updateApplicationStatus(job.id, e.target.value as ApplicationStatus)} className={select}>{["Not Applied", "Applied", "Interview", "Rejected", "Offer"].map(s => <option key={s}>{s}</option>)}</select><a href={job.url} target="_blank" rel="noopener noreferrer" className={primary}>View Original ↗</a></div>{job.jobType?.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{job.jobType.map(type => <span key={type} className="rounded-full bg-purple-950 px-3 py-1 text-xs text-purple-300">{type.replace(/_/g, " ")}</span>)}</div>}</article>)}</div>}
      </section>

      </>)}
      {view === "agencies" && (<>
      <section id="agency-discovery" className="mt-12 scroll-mt-24 border-t border-[#273750] pt-10">
        <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-indigo-400">Agency Prospecting</p><h2 className="mt-1 text-2xl font-bold">Agency Client Discovery</h2><p className="mt-2 text-sm text-slate-400">{agencies.length} unique agencies found · {savedAgencies.length} saved leads</p></div><div className="flex gap-2"><button onClick={startAgencySearch} disabled={agencyRunning} className={primary}>{agencyRunning ? "Searching..." : "Start Search"}</button><button onClick={stopAgencySearch} disabled={!agencyRunning} className={secondary}>Stop</button></div></div>
        <div className={`${panel} mt-5`}><p className="font-semibold">Agency Scanner: {agencyRunning ? "Running" : "Stopped"}</p><p className="mt-2 text-sm text-slate-400">{agencyMessage}</p>{agencyError && <p className="mt-2 text-sm text-amber-300">{agencyError}</p>}</div>
        {agencySourceStats.length > 0 && <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{agencySourceStats.map(d => <article key={d.source} className={panel}><div className="flex items-center justify-between"><h3 className="font-bold">{d.source}</h3><span className="rounded-full bg-slate-800 px-3 py-1 text-xs">{d.status.toUpperCase()}</span></div><div className="mt-5 grid grid-cols-2 gap-3 text-sm"><p>Candidates <b>{d.fetched}</b></p><p>Unique <b className="text-emerald-300">{d.matched}</b></p><p>Duplicates <b>{d.duplicates}</b></p><p>Filtered <b>{d.filtered}</b></p></div>{d.warnings.map((w, i) => <p key={i} className="mt-2 break-words text-xs text-amber-300">{w}</p>)}</article>)}</div>}
        <div className="mt-5 flex flex-wrap gap-2"><button onClick={() => setShowSavedAgencies(false)} className={!showSavedAgencies ? primary : secondary}>All Agencies ({agencies.length})</button><button onClick={() => setShowSavedAgencies(true)} className={showSavedAgencies ? primary : secondary}>Saved Leads ({savedAgencies.length})</button><button onClick={checkAllAgencySignals} disabled={checkingAllSignals || agencyRunning || !agencies.length} className={secondary}>{checkingAllSignals ? "Checking All Agencies..." : "Check All Signals"}</button></div>
        {displayedAgencies.length === 0 ? <div className={`${panel} mt-5 text-center text-slate-400`}>{showSavedAgencies ? "কোনো Saved Lead নেই।" : "Start Search চাপলে Agency-র তথ্য এখানে দেখা যাবে।"}</div> : <div className="mt-5 grid gap-4 xl:grid-cols-2">{displayedAgencies.map(agency => {
          const key = getAgencyKey(agency); const signal = agencySignals[key]; const isSaved = savedAgencies.some(x => getAgencyKey(x) === key); const isChecking = checkingAgencyKeys.includes(key);
          const location = typeof agency.location === "string" ? agency.location : [agency.location?.city, agency.location?.country].filter(Boolean).join(", ");
          return <article key={key} className={panel}><h3 className="text-lg font-bold">{agency.name || "Unnamed Agency"}</h3><p className="mt-2 text-sm text-slate-400">{location || "Location not specified"}</p>{agency.tagline && <p className="mt-3 text-sm text-slate-300">{agency.tagline}</p>}{agency.rating != null && <p className="mt-3 text-sm text-amber-300">Rating: {agency.rating}{agency.total_reviews != null ? ` (${agency.total_reviews} reviews)` : ""}</p>}<div className="mt-3 flex flex-wrap gap-2">{[...new Set([...(agency.services ?? []), ...(agency.industries ?? [])])].slice(0, 8).map(item => <span key={item} className="rounded-lg border border-slate-700 px-2 py-1 text-xs">{item}</span>)}</div>
          <div className="mt-4 rounded-xl border border-[#354765] bg-[#14223b] p-4"><div className="flex justify-between gap-3"><p className="font-semibold">Priority Score</p><span className="font-bold text-violet-300">{signal ? `${signal.priorityScore}/100` : "Not checked"}</span></div>{signal && <p className="mt-1 text-xs text-slate-400">{getPriorityLabel(signal.priorityScore)}</p>}<p className="mt-3 text-sm">Hiring: {!signal ? "Not checked" : signal.hiringSignal ? "Potential signal found" : "No clear signal"}</p><p className="mt-1 text-sm">Contract Support: {!signal ? "Not checked" : signal.contractSignal ? "Potential signal found" : "No clear signal"}</p>{signal?.status && <p className="mt-2 text-xs text-slate-400">Status: {signal.status}</p>}{signal?.evidence?.map((e, i) => <p key={i} className="mt-2 break-words text-xs text-cyan-300">{e}</p>)}{signal?.checkedUrls?.length ? <p className="mt-2 text-xs text-slate-500">{signal.checkedUrls.length} public pages checked</p> : null}<button onClick={() => checkAgencySignal(agency)} disabled={isChecking || agencyRunning} className={`${secondary} mt-4`}>{isChecking ? "Checking..." : signal ? "Check Again" : "Check Hiring / Contract"}</button></div>
          <div className="mt-5 flex flex-wrap gap-2">{agency.website && <a href={agency.website} target="_blank" rel="noopener noreferrer" className={primary}>Visit Website ↗</a>}{agency.profile_url && <a href={agency.profile_url} target="_blank" rel="noopener noreferrer" className={secondary}>Source Profile ↗</a>}<button onClick={() => toggleSavedAgency(agency)} className={secondary}>{isSaved ? "Remove Saved" : "Save Lead"}</button><select value={agencyApplicationStatuses[key] ?? "No message"} onChange={e => updateAgencyApplicationStatus(key, e.target.value as AgencyApplicationStatus)} className={select} aria-label={`Agency contact status for ${agency.name ?? "Agency"}`}>{["No message", "Messaged", "Reply", "Rejected", "Not reply", "Follow up", "confirm"].map(s => <option key={s} value={s}>{s === "confirm" ? "Confirm" : s}</option>)}</select></div></article>;
        })}</div>}
        <p className="mt-4 text-xs text-slate-500">Agency directory data provided by <a href="https://www.pickanagency.com/" className="underline" target="_blank" rel="noopener noreferrer">Pick an Agency</a>. Public-page keyword matches are potential leads, not verified job openings.</p>
      </section>

      </>)}
      {view === "linkedin" && <div id="linkedin-discovery" className="scroll-mt-24"><LinkedInHiring agencies={sharedAgencies} /></div>}
      {view === "social" && <div id="social-discovery" className="scroll-mt-24"><SocialDiscovery agencies={sharedAgencies} /></div>}
      {view === "saved" && <section className="space-y-5"><h1 className="text-3xl font-bold">Saved Leads</h1><p className="text-slate-400">Your saved jobs, agencies and social leads are stored by their existing sections in this browser.</p><div className="grid gap-4 md:grid-cols-3"><a href="/jobs" className={`${panel} hover:border-violet-500`}>Saved Jobs: <strong>{savedJobs.length}</strong> →</a><a href="/agencies" className={`${panel} hover:border-violet-500`}>Saved Agencies: <strong>{savedAgencies.length}</strong> →</a><a href="/social-discovery" className={`${panel} hover:border-violet-500`}>Social saved leads →</a></div></section>}
      <footer className="mt-12 border-t border-[#273750] pt-5 text-sm text-slate-500">AI Client Hunter · Manual Start / Stop</footer>
    </DashboardShell>
  );
}
