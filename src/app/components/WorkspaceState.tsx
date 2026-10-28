"use client";
import { createContext, useContext, type ReactNode, useEffect, useRef, useState } from "react";
import { ArrowRight, Bookmark, Briefcase, BriefcaseBusiness, Building2, Check, Code2, Globe, Play, Search, Share2, Sparkle, Square } from "lucide-react";


type Job = { id: string; title: string; company: string; location: string; description: string; url: string; publishedAt: string | null; score: number; matchedSkills: string[]; source: string; eligible: boolean; level: string; experienceStatus: string; locationCategory: string; isFresh: boolean; freshnessStatus: string; jobType: string[] };
type SourceDiagnostic = { source: string; status: "success" | "empty" | "failed"; fetched: number; invalid: number; filteredOut: number; matched: number; duplicates: number; error?: string };
type AgencySourceStats = { source: string; status: "success" | "partial" | "failed" | "empty" | "skipped"; fetched: number; matched: number; duplicates: number; filtered: number; warnings: string[] };
type Agency = { slug?: string; name?: string; website?: string; profile_url?: string; rating?: number; total_reviews?: number; services?: string[]; industries?: string[]; tagline?: string; team_size?: string; description?: string; location?: { city?: string; country?: string } | string };
type AgencySignal = { name: string; website: string; status: string; evidence: string[]; checkedUrls: string[]; hiringSignal: boolean; contractSignal: boolean; priorityScore: number };
type AgencySignalResult = Omit<AgencySignal, "priorityScore">;
type AgencySignalResponse = { success: boolean; checked: number; results: AgencySignalResult[]; error?: string };
type AgencyResponse = { success: boolean; totalFound: number; agencies: Agency[]; warnings?: string[]; error?: string; sourceStats?: AgencySourceStats[] };
export type ApplicationStatus =
  | "Not Applied"
  | "Applied"
  | "Interview"
  | "Rejected"
  | "Offer";

export type AgencyApplicationStatus =
  | "No message"
  | "Messaged"
  | "Reply"
  | "Rejected"
  | "Not reply"
  | "Follow up"
  | "confirm";

const JOBS_STORAGE_KEY = "ai-client-hunter-saved-jobs";
const STATUSES_STORAGE_KEY = "ai-client-hunter-application-statuses";
const AGENCIES_STORAGE_KEY = "ai-client-hunter-saved-agencies";
const SIGNALS_STORAGE_KEY = "ai-client-hunter-agency-signals";
const AGENCY_STATUSES_STORAGE_KEY = "ai-client-hunter-agency-statuses";


export const FEATURES = ["Jobs", "Agencies", "Social Platforms", "Real Opportunities"] as const;
type Tint = "violet" | "blue" | "teal" | "amber";



export const TINT_STYLES: Record<
  Tint,
  { iconBox: string; icon: string; wave: string; waveStroke: string }
> = {
  violet: {
    iconBox: "bg-[#1d1b3c]/80",
    icon: "text-purple-400",
    wave: "text-purple-500 drop-shadow-[0_0_6px_rgba(168,85,247,0.5)]",
    waveStroke: "#c084fc",
  },
  blue: {
    iconBox: "bg-[#0e244d]/90",
    icon: "text-blue-400",
    wave: "text-blue-500 drop-shadow-[0_0_6px_rgba(59,130,246,0.5)]",
    waveStroke: "#60a5fa",
  },
  teal: {
    iconBox: "bg-[#0c2e35]/90",
    icon: "text-teal-400",
    wave: "text-cyan-500 drop-shadow-[0_0_6px_rgba(34,211,238,0.5)]",
    waveStroke: "#2dd4bf",
  },
  amber: {
    iconBox: "bg-[#2b1f15]/80",
    icon: "text-amber-400",
    wave: "text-amber-500 drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]",
    waveStroke: "#fbbf24",
  },
};

export const TILES = [
  {
    name: "Jobs",
    icon: Briefcase,
    iconColor: "text-[#7dd3fc]",
  },
  {
    name: "Agencies",
    icon: Building2,
    iconColor: "text-[#7dd3fc]",
  },
  {
    name: "LinkedIn",
    icon: BriefcaseBusiness,
    iconColor: "text-white",
  },
  {
    name: "Social Media",
    icon: Share2,
    iconColor: "text-[#e879f9]",
  },
] as const;


export function getAgencyKey(agency: Agency): string {
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
export function getPriorityLabel(score: number) { return score >= 60 ? "High Priority" : score >= 30 ? "Medium Priority" : "Low Priority"; }

export const panel = "rounded-2xl border border-[#263650] bg-[#101c32] p-5";
export const action = "rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40";
export const primary = `${action} bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-500 hover:to-violet-500`;
export const secondary = `${action} border border-[#354765] bg-[#15253f] text-slate-200 hover:border-violet-500`;
export const select = "rounded-lg border border-[#344765] bg-[#192941] px-3 py-2 text-sm text-white";

export type WorkspaceView = "overview" | "jobs" | "agencies" | "linkedin" | "social" | "saved";
export function useWorkspaceState(){

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


  
const STATS: {
  label: string;
  value: number;
  info: string;
  icon: typeof Briefcase;
  tint: Tint;
}[] = [
  {
    label: "Matching Jobs",
    value: jobs.length,
    info: "Jobs matched to your skills",
    icon: Briefcase,
    tint: "violet",
  },
  {
    label: "Saved Jobs",
    value: savedJobs.length,
    info: "Opportunities you saved",
    icon: Bookmark,
    tint: "blue",
  },
  {
    label: "Discovered Agencies",
    value: agencies.length,
    info: "Agencies found from public sources",
    icon: Building2,
    tint: "teal",
  },
  {
    label: "Saved Agencies",
    value: savedAgencies.length,
    info: "Agency leads you saved",
    icon: Bookmark,
    tint: "amber",
  },
];
return { running, setRunning, jobs, setJobs, message, setMessage, totalFetched, setTotalFetched, error, setError, controllerRef, sourceDiagnostics, setSourceDiagnostics, savedJobs, setSavedJobs, applicationStatuses, setApplicationStatuses, showSavedOnly, setShowSavedOnly, storageReady, setStorageReady, agencySourceStats, setAgencySourceStats, agencyApplicationStatuses, setAgencyApplicationStatuses, agencyStatusReady, setAgencyStatusReady, checkingAllSignals, setCheckingAllSignals, agencies, setAgencies, agencyRunning, setAgencyRunning, agencyMessage, setAgencyMessage, agencyError, setAgencyError, savedAgencies, setSavedAgencies, agencySignals, setAgencySignals, showSavedAgencies, setShowSavedAgencies, agencyStorageReady, setAgencyStorageReady, checkingAgencyKeys, setCheckingAgencyKeys, agencyControllerRef, saveJob, removeSavedJob, updateApplicationStatus, visibleJobs, toggleSavedAgency, updateAgencyApplicationStatus, startAgencySearch, stopAgencySearch, checkAllAgencySignals, checkAgencySignal, displayedAgencies, startScan, stopScan, sharedAgencies, STATS };
}
export type WorkspaceState=ReturnType<typeof useWorkspaceState>;
const WorkspaceContext=createContext<WorkspaceState|null>(null);
export function WorkspaceProvider({children}:{children:ReactNode}){ const value=useWorkspaceState(); return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>; }
export function useWorkspace(){const context=useContext(WorkspaceContext);if(!context)throw Error("WorkspaceProvider is missing in src/app/layout.tsx");return context;}
