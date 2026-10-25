
"use client";

import { useEffect, useRef, useState } from "react";
import LinkedInHiring from "./components/LinkedInHiring";

type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  publishedAt: string | null;
  score: number;
  matchedSkills: string[];
  source: string;
  eligible: boolean;
  level: string;
  experienceStatus: string;
  locationCategory: string;
  isFresh: boolean;
  freshnessStatus: string;
  jobType: string[];
};




type SourceDiagnostic = {
  source: string;
  status: "success" | "empty" | "failed";
  fetched: number;
  invalid: number;
  filteredOut: number;
  matched: number;
  duplicates: number;
  error?: string;
};




type AgencySourceStats = {
  source: string;
  status: "success" | "partial" | "failed" | "empty" | "skipped";
  fetched: number;
  matched: number;
  duplicates: number;
  filtered: number;
  warnings: string[];
};


type Agency = {
  slug?: string;
  name?: string;
  website?: string;
  profile_url?: string;
  rating?: number;
  total_reviews?: number;
  services?: string[];
  industries?: string[];
  tagline?: string;
  team_size?: string;
  description?: string;
  location?: {
    city?: string;
    country?: string;
  } | string;
};

type AgencySignal = {
  name: string;
  website: string;
  status: string;
  evidence: string[];
  checkedUrls: string[];
  hiringSignal: boolean;
  contractSignal: boolean;
  priorityScore: number;
};

type AgencySignalResult = Omit<AgencySignal, "priorityScore">;

type AgencySignalResponse = {
  success: boolean;
  checked: number;
  results: AgencySignalResult[];
  error?: string;
};

type AgencyResponse = {
  success: boolean;
  totalFound: number;
  agencies: Agency[];
  warnings?: string[];
  error?: string;

  sourceStats?: AgencySourceStats[];
};

type ApplicationStatus =
  | "Not Applied"
  | "Applied"
  | "Interview"
  | "Rejected"
  | "Offer";



  type AgencyApplicationStatus =
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

const AGENCY_STATUSES_STORAGE_KEY =
  "ai-client-hunter-agency-statuses";

function getAgencyKey(agency: Agency): string {
  if (agency.website) {
    try {
      const value = agency.website.trim();
      const url = new URL(
        /^https?:\/\//i.test(value) ? value : `https://${value}`
      );

      return url.hostname.toLowerCase().replace(/^www\./, "");
    } catch {
      // Try the profile URL or agency name instead.
    }
  }

  if (agency.profile_url) {
    try {
      const url = new URL(agency.profile_url);
      return url.hostname.toLowerCase().replace(/^www\./, "");
    } catch {
      return agency.profile_url.toLowerCase().trim().replace(/\/+$/, "");
    }
  }

  return (
    agency.slug?.toLowerCase().trim() ||
    agency.name?.toLowerCase().trim().replace(/\s+/g, " ") ||
    ""
  );
}

function deduplicateAgencies(agencies: Agency[]): Agency[] {
  const unique = new Map<string, Agency>();

  for (const agency of agencies) {
    const key = getAgencyKey(agency);
    if (!key) continue;

    const existing = unique.get(key);

    if (!existing) {
      unique.set(key, agency);
      continue;
    }

    unique.set(key, {
      ...existing,
      ...agency,
      services: [
        ...new Set([
          ...(existing.services ?? []),
          ...(agency.services ?? []),
        ]),
      ],
      industries: [
        ...new Set([
          ...(existing.industries ?? []),
          ...(agency.industries ?? []),
        ]),
      ],
    });
  }

  return [...unique.values()];
}

function calculatePriorityScore(
  agency: Agency,
  signal: AgencySignalResult
): number {
  const services = [
    ...(agency.services ?? []),
    ...(agency.industries ?? []),
    agency.tagline ?? "",
    agency.description ?? "",
  ].join(" ");

  const serviceMatch =
    /\b(web development|software development|e-?commerce|frontend|backend|react|next\.?js|wordpress|shopify|full[\s-]?stack)\b/i.test(
      services
    );

  return Math.min(
    100,
    (signal.hiringSignal ? 40 : 0) +
      (signal.contractSignal ? 30 : 0) +
      (serviceMatch ? 15 : 0) +
      ((agency.rating ?? 0) >= 4 ? 10 : 0) +
      ((agency.total_reviews ?? 0) >= 10 ? 5 : 0)
  );
}

function getPriorityLabel(score: number): string {
  if (score >= 60) return "High Priority";
  if (score >= 30) return "Medium Priority";
  return "Low Priority";
}

export default function Home() {
  // Job scanner
  const [running, setRunning] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [message, setMessage] = useState(
    "Scanner বন্ধ। Start Scan চাপলে বাস্তব Job খোঁজা হবে।"
  );
  const [totalFetched, setTotalFetched] = useState(0);
  const [error, setError] = useState("");

  const controllerRef = useRef<AbortController | null>(null);

  
const [sourceDiagnostics, setSourceDiagnostics] =
  useState<SourceDiagnostic[]>([]);


  // Saved jobs
  const [savedJobs, setSavedJobs] = useState<Job[]>([]);
  const [applicationStatuses, setApplicationStatuses] =
    useState<Record<string, ApplicationStatus>>({});
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [storageReady, setStorageReady] = useState(false);

  // Agency discovery

const [agencySourceStats, setAgencySourceStats] =
  useState<AgencySourceStats[]>([]);



  const [agencyApplicationStatuses, setAgencyApplicationStatuses] =
  useState<Record<string, AgencyApplicationStatus>>({});

const [agencyStatusReady, setAgencyStatusReady] = useState(false);
const [checkingAllSignals, setCheckingAllSignals] = useState(false);

  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [agencyRunning, setAgencyRunning] = useState(false);
  const [agencyMessage, setAgencyMessage] = useState(
    "Agency search বন্ধ। Start Search চাপো।"
  );
  const [agencyError, setAgencyError] = useState("");
  const [savedAgencies, setSavedAgencies] = useState<Agency[]>([]);
  const [agencySignals, setAgencySignals] = useState<
    Record<string, AgencySignal>
  >({});
  const [showSavedAgencies, setShowSavedAgencies] = useState(false);
  const [agencyStorageReady, setAgencyStorageReady] = useState(false);
  const [checkingAgencyKeys, setCheckingAgencyKeys] = useState<string[]>([]);

  const agencyControllerRef = useRef<AbortController | null>(null);



  // Load agency application statuses.

  // Load agency application statuses.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(
        AGENCY_STATUSES_STORAGE_KEY
      );

      if (saved) {
        const parsed: unknown = JSON.parse(saved);

        if (
          parsed &&
          typeof parsed === "object" &&
          !Array.isArray(parsed)
        ) {
          setAgencyApplicationStatuses(
            parsed as Record<string, AgencyApplicationStatus>
          );
        }
      }
    } catch {
      console.error("Could not load agency statuses.");
    } finally {
      // Loading শেষ না হওয়া পর্যন্ত save করা হবে না।
      setAgencyStatusReady(true);
    }
  }, []);

  // Persist agency application statuses.
  useEffect(() => {
    if (!agencyStatusReady) return;

    try {
      localStorage.setItem(
        AGENCY_STATUSES_STORAGE_KEY,
        JSON.stringify(agencyApplicationStatuses)
      );
    } catch {
      console.error("Could not save agency statuses.");
    }
  }, [agencyApplicationStatuses, agencyStatusReady]);



  // Load saved jobs and application statuses.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(JOBS_STORAGE_KEY);
      const statuses = localStorage.getItem(STATUSES_STORAGE_KEY);

      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) setSavedJobs(parsed as Job[]);
      }

      if (statuses) {
        const parsed: unknown = JSON.parse(statuses);

        if (
          parsed &&
          typeof parsed === "object" &&
          !Array.isArray(parsed)
        ) {
          setApplicationStatuses(
            parsed as Record<string, ApplicationStatus>
          );
        }
      }
    } catch {
      console.error("Could not load saved jobs.");
    } finally {
      setStorageReady(true);
    }
  }, []);

  // Persist saved jobs and statuses.
  useEffect(() => {
    if (!storageReady) return;

    try {
      localStorage.setItem(JOBS_STORAGE_KEY, JSON.stringify(savedJobs));
      localStorage.setItem(
        STATUSES_STORAGE_KEY,
        JSON.stringify(applicationStatuses)
      );
    } catch {
      console.error("Could not save job tracking data.");
    }
  }, [savedJobs, applicationStatuses, storageReady]);

  // Load saved agencies and signal results.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(AGENCIES_STORAGE_KEY);
      const signals = localStorage.getItem(SIGNALS_STORAGE_KEY);

      if (saved) {
        const parsed: unknown = JSON.parse(saved);

        if (Array.isArray(parsed)) {
          setSavedAgencies(
            deduplicateAgencies(parsed as Agency[])
          );
        }
      }

      if (signals) {
        const parsed: unknown = JSON.parse(signals);

        if (
          parsed &&
          typeof parsed === "object" &&
          !Array.isArray(parsed)
        ) {
          setAgencySignals(parsed as Record<string, AgencySignal>);
        }
      }
    } catch {
      console.error("Could not load saved agency data.");
    } finally {
      setAgencyStorageReady(true);
    }
  }, []);

  // Persist agency data.
  useEffect(() => {
    if (!agencyStorageReady) return;

    try {
      localStorage.setItem(
        AGENCIES_STORAGE_KEY,
        JSON.stringify(savedAgencies)
      );

      localStorage.setItem(
        SIGNALS_STORAGE_KEY,
        JSON.stringify(agencySignals)
      );
    } catch {
      console.error("Could not save agency data.");
    }
  }, [savedAgencies, agencySignals, agencyStorageReady]);

  // Job functions
  function saveJob(job: Job) {
    setSavedJobs((current) =>
      current.some((item) => item.id === job.id)
        ? current
        : [...current, job]
    );
  }

  function removeSavedJob(jobId: string) {
    setSavedJobs((current) =>
      current.filter((job) => job.id !== jobId)
    );
  }

  function updateApplicationStatus(
    jobId: string,
    status: ApplicationStatus
  ) {
    setApplicationStatuses((current) => ({
      ...current,
      [jobId]: status,
    }));
  }

  const visibleJobs = showSavedOnly ? savedJobs : jobs;

  // Save or remove an agency.
  function toggleSavedAgency(agency: Agency) {
    const key = getAgencyKey(agency);
    if (!key) return;

    setSavedAgencies((current) =>
      current.some((item) => getAgencyKey(item) === key)
        ? current.filter((item) => getAgencyKey(item) !== key)
        : [...current, agency]
    );
  }

  function updateAgencyApplicationStatus(
  agencyKey: string,
  status: AgencyApplicationStatus
) {
  setAgencyApplicationStatuses((current) => ({
    ...current,
    [agencyKey]: status,
  }));
}

  // Search agencies from the discovery API.
  async function startAgencySearch() {
    if (agencyControllerRef.current) return;

    const controller = new AbortController();
    agencyControllerRef.current = controller;

    setAgencyRunning(true);
    setAgencyError("");
    setAgencyMessage("Agency খোঁজা হচ্ছে...");

    try {
      const response = await fetch("/api/agency-discovery", {
        cache: "no-store",
        signal: controller.signal,
      });

      const data: AgencyResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Agency search ব্যর্থ হয়েছে।"
        );
      }

      if (controller.signal.aborted) return;

      const uniqueAgencies = deduplicateAgencies(data.agencies ?? []);

      setAgencies(uniqueAgencies);
setAgencySourceStats(data.sourceStats ?? []);
      setAgencyMessage(
        `Search সম্পন্ন। ${uniqueAgencies.length}টি unique Agency পাওয়া গেছে।`
      );

      if (data.warnings?.length) {
        setAgencyError(
          `${data.warnings.length}টি search query-তে সমস্যা হয়েছে। সব Public Source-এর ফল পাওয়া নাও যেতে পারে।`
        );
      }
    } catch (err) {
      if (controller.signal.aborted) {
        setAgencyMessage("Agency search বন্ধ করা হয়েছে।");
      } else {
        setAgencyError(
          err instanceof Error ? err.message : "অজানা Error"
        );
        setAgencyMessage("Search সম্পন্ন করা যায়নি।");
      }
    } finally {
      if (agencyControllerRef.current === controller) {
        agencyControllerRef.current = null;
        setAgencyRunning(false);
      }
    }
  }

  function stopAgencySearch() {
    const controller = agencyControllerRef.current;

    if (!controller) return;

    controller.abort();
    agencyControllerRef.current = null;
    setAgencyRunning(false);
    setAgencyMessage("Agency search বন্ধ করা হয়েছে।");
  }




  
async function checkAllAgencySignals() {
  if (checkingAllSignals || agencies.length === 0) return;

  setCheckingAllSignals(true);
  setAgencyError("");

  const keys = agencies.map(getAgencyKey).filter(Boolean);
  setCheckingAgencyKeys(keys);

  let checkedCount = 0;

  try {
    // The backend accepts at most 10 agencies per request.
    for (let i = 0; i < agencies.length; i += 10) {
      const batch = agencies.slice(i, i + 10);

      setAgencyMessage(
        `Checking signals: ${checkedCount}/${agencies.length} agencies...`
      );

      const response = await fetch("/api/agency-signals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agencies: batch.map((agency) => ({
            name: agency.name,
            website: agency.website,
          })),
        }),
      });

      const data: AgencySignalResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Signal check failed."
        );
      }

      const updates: Record<string, AgencySignal> = {};

      for (const result of data.results ?? []) {
        const resultKey = getAgencyKey({
          name: result.name,
          website: result.website,
        });

        const agency = batch.find(
          (item) => getAgencyKey(item) === resultKey
        );

        if (!agency || !resultKey) continue;

        updates[resultKey] = {
          ...result,
          priorityScore: calculatePriorityScore(agency, result),
        };
      }

      setAgencySignals((current) => ({
        ...current,
        ...updates,
      }));

      checkedCount += batch.length;

      setAgencyMessage(
        `Signal Check progress: ${Math.min(
          checkedCount,
          agencies.length
        )}/${agencies.length} agencies processed.`
      );
    }

    setAgencyMessage(
      `Signal Check সম্পন্ন। ${agencies.length}টি Agency process করা হয়েছে।`
    );
  } catch (err) {
    setAgencyError(
      err instanceof Error ? err.message : "Signal check failed."
    );

    setAgencyMessage(
      `Signal Check আংশিক সম্পন্ন: ${checkedCount}/${agencies.length} processed.`
    );
  } finally {
    setCheckingAllSignals(false);
    setCheckingAgencyKeys([]);
  }
}

  // Check hiring and contract-support signals.
  async function checkAgencySignal(agency: Agency) {
    const key = getAgencyKey(agency);

    if (!agency.website) {
      setAgencyError(
        `${agency.name ?? "এই Agency"}-র Website পাওয়া যায়নি।`
      );
      return;
    }

    if (checkingAgencyKeys.includes(key)) return;

    setCheckingAgencyKeys((current) => [...current, key]);
    setAgencyError("");
    setAgencyMessage(
      `${agency.name ?? "Agency"}-র Hiring ও Contract Signal যাচাই হচ্ছে...`
    );

    try {
      const response = await fetch("/api/agency-signals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agencies: [
            {
              name: agency.name,
              website: agency.website,
            },
          ],
        }),
      });

      const data: AgencySignalResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Signal check ব্যর্থ হয়েছে।"
        );
      }

      const result = data.results?.[0];

      if (!result) {
        throw new Error("কোনো Signal result পাওয়া যায়নি।");
      }

      const priorityScore = calculatePriorityScore(agency, result);

      const signal: AgencySignal = {
        ...result,
        priorityScore,
      };

      setAgencySignals((current) => ({
        ...current,
        [key]: signal,
      }));

      setAgencyMessage(
        `${agency.name ?? "Agency"}-র Signal Check সম্পন্ন। Priority Score: ${priorityScore}/100`
      );
    } catch (err) {
      setAgencyError(
        err instanceof Error ? err.message : "Signal check ব্যর্থ হয়েছে।"
      );
      setAgencyMessage("Signal Check সম্পন্ন করা যায়নি।");
    } finally {
      setCheckingAgencyKeys((current) =>
        current.filter((item) => item !== key)
      );
    }
  }

  const displayedAgencies = showSavedAgencies
    ? savedAgencies
    : agencies;

  // Job scanner
  async function startScan() {
    if (controllerRef.current) return;

    const controller = new AbortController();
    controllerRef.current = controller;

    setRunning(true);
    setError("");
    setMessage("Jobicy থেকে বাস্তব Job সংগ্রহ করা হচ্ছে...");

    try {
      const response = await fetch("/api/scan", {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Job সংগ্রহ করা যায়নি।");
      }

      if (controller.signal.aborted) return;

      setJobs(data.jobs);
      setTotalFetched(data.totalFetched);
      setSourceDiagnostics(data.sourceDiagnostics ?? []);
      setMessage(
        `Scan সম্পন্ন। ${data.matchedCount}টি matching Job পাওয়া গেছে।`
      );
    } catch (err) {
      if (controller.signal.aborted) {
        setMessage("Scan বন্ধ করা হয়েছে।");
      } else {
        setError(
          err instanceof Error ? err.message : "অজানা Error হয়েছে।"
        );
        setMessage("Job সংগ্রহ করা যায়নি।");
      }
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setRunning(false);
      }
    }
  }

  function stopScan() {
    const controller = controllerRef.current;
    if (!controller) return;

    controller.abort();
    controllerRef.current = null;
    setRunning(false);
    setMessage("Scan বন্ধ করা হয়েছে।");
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-5 py-10">
        <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm text-cyan-400">
              PERSONAL AUTOMATION WORKSPACE
            </p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
              AI Client Hunter
            </h1>
            <p className="mt-2 text-slate-400">
              Find relevant web development opportunities.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={startScan}
              disabled={running}
              className="rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 disabled:opacity-40"
            >
              {running ? "Scanning..." : "Start Scan"}
            </button>

            <button
              onClick={stopScan}
              disabled={!running}
              className="rounded-xl border border-slate-600 px-5 py-3 font-semibold disabled:opacity-40"
            >
              Stop
            </button>
          </div>
        </header>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center gap-3">
            <span
              className={`h-3 w-3 rounded-full ${
                running ? "bg-green-400" : "bg-slate-500"
              }`}
            />
            <h2 className="font-semibold">
              Scanner: {running ? "Running" : "Stopped"}
            </h2>
          </div>
          <p className="mt-3 text-sm text-slate-400">{message}</p>
          {error && (
            <p className="mt-3 text-sm text-red-400">{error}</p>
          )}
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Your Stack", "Next.js · Tailwind"],
            ["Backend", "NestJS · PostgreSQL"],
            ["Target Markets", "Bangladesh + Global"],
            ["Source", "Jobicy API"],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
            >
              <p className="text-sm text-slate-400">{label}</p>
              <p className="mt-3 font-semibold">{value}</p>
            </div>
          ))}
        </section>

        {/* Job Opportunities */}
        <section className="mt-10">

         <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
  {/* Left: Job Opportunities */}
  <div>
    <h2 className="text-2xl font-bold">
      Job Opportunities
    </h2>

    <p className="mt-3 text-sm text-slate-400">
      {jobs.length} matching jobs · {totalFetched} fetched from source
    </p>
  </div>


          
<section className="mt-8">
  <h2 className="text-2xl font-bold">
      Job Source Analytics
    </h2>

    <p className="mt-2 text-sm text-slate-400">
      API performance and filtering breakdown
    </p>

  <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
    {sourceDiagnostics.map((source) => (
      <article
        key={source.source}
        className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold">{source.source}</h3>

          <span
            className={`rounded-full px-3 py-1 text-xs ${
              source.status === "success"
                ? "bg-green-950 text-green-300"
                : source.status === "empty"
                  ? "bg-amber-950 text-amber-300"
                  : "bg-red-950 text-red-300"
            }`}
          >
            {source.status.toUpperCase()}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-slate-400">Fetched</p>
            <p className="mt-1 text-2xl font-bold">
              {source.fetched}
            </p>
          </div>

          <div>
            <p className="text-sm text-slate-400">Matched</p>
            <p className="mt-1 text-2xl font-bold text-green-300">
              {source.matched}
            </p>
          </div>

          <div>
            <p className="text-sm text-slate-400">Filtered out</p>
            <p className="mt-1 text-xl font-semibold text-amber-300">
              {source.filteredOut}
            </p>
          </div>

          <div>
            <p className="text-sm text-slate-400">Duplicates</p>
            <p className="mt-1 text-xl font-semibold">
              {source.duplicates}
            </p>
          </div>

          <div>
            <p className="text-sm text-slate-400">Invalid</p>
            <p className="mt-1 text-xl font-semibold">
              {source.invalid}
            </p>
          </div>
        </div>

        {source.error && (
          <p className="mt-4 break-words text-sm text-red-300">
            {source.error}
          </p>
        )}
      </article>
    ))}
  </div>
</section>

</div>

          

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => setShowSavedOnly(false)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                !showSavedOnly
                  ? "bg-cyan-400 text-slate-950"
                  : "border border-slate-700 text-white"
              }`}
            >
              All Jobs ({jobs.length})
            </button>

            <button
              onClick={() => setShowSavedOnly(true)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                showSavedOnly
                  ? "bg-cyan-400 text-slate-950"
                  : "border border-slate-700 text-white"
              }`}
            >
              My Saved Jobs ({savedJobs.length})
            </button>

            <a
              href="https://jobs.bdjobs.com/jobsearch-cache.asp"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex rounded-xl border border-cyan-500 px-4 py-3 text-sm font-semibold text-cyan-300"
            >
              Search Bangladesh Jobs ↗
            </a>
          </div>

          {visibleJobs.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-700 p-10 text-center">
              <p className="font-semibold">
                {showSavedOnly
                  ? "No saved jobs to display"
                  : "No jobs loaded yet"}
              </p>
              <p className="mt-2 text-sm text-slate-400">
                {showSavedOnly
                  ? "Scan jobs and save the opportunities you like."
                  : "Press Start Scan to find real listings."}
              </p>
            </div>
          ) : (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {visibleJobs.map((job) => (
                <article
                  key={job.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-cyan-400">
                        {job.source} · {job.location}
                      </p>
                      <h3 className="mt-2 text-lg font-semibold">
                        {job.title}
                      </h3>
                      <p className="mt-1 text-sm text-slate-400">
                        {job.company}
                      </p>
                    </div>
                    <div className="shrink-0 rounded-xl bg-slate-800 px-3 py-2 text-center">
                      <p className="text-xl font-bold text-green-400">
                        {job.score}
                      </p>
                      <p className="text-xs text-slate-400">
                        Match score
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-cyan-950 px-3 py-1 text-xs text-cyan-300">
                      {job.level}
                    </span>
                    <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                      {job.experienceStatus}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs ${
                        job.locationCategory === "Worldwide Remote"
                          ? "bg-green-950 text-green-300"
                          : job.locationCategory === "Region Restricted"
                            ? "bg-amber-950 text-amber-300"
                            : "bg-slate-800 text-slate-300"
                      }`}
                    >
                      {job.locationCategory}
                    </span>
                    <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                      {job.freshnessStatus}
                    </span>
                  </div>

                  <p className="mt-4 text-sm leading-6 text-slate-300">
                    {job.description}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {job.matchedSkills.slice(0, 8).map((skill) => (
                      <span
                        key={skill}
                        className="rounded-full border border-slate-700 px-2 py-1 text-xs text-slate-300"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>

                  {job.publishedAt && (
                    <p className="mt-4 text-xs text-slate-500">
                      Published:{" "}
                      {new Date(job.publishedAt).toLocaleDateString()}
                    </p>
                  )}

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    {savedJobs.some((item) => item.id === job.id) ? (
                      <button
                        onClick={() => removeSavedJob(job.id)}
                        className="rounded-lg border border-amber-500 px-4 py-2 text-sm text-amber-300"
                      >
                        Remove Saved
                      </button>
                    ) : (
                      <button
                        onClick={() => saveJob(job)}
                        className="rounded-lg border border-cyan-500 px-4 py-2 text-sm text-cyan-300"
                      >
                        Save Job
                      </button>
                    )}

                    <select
                      value={applicationStatuses[job.id] ?? "Not Applied"}
                      onChange={(event) =>
                        updateApplicationStatus(
                          job.id,
                          event.target.value as ApplicationStatus
                        )
                      }
                      className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                    >
                      <option value="Not Applied">Not Applied</option>
                      <option value="Applied">Applied</option>
                      <option value="Interview">Interview</option>
                      <option value="Rejected">Rejected</option>
                      <option value="Offer">Offer</option>
                    </select>
                  </div>

                  {job.jobType?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {job.jobType.map((type) => (
                        <span
                          key={type}
                          className="rounded-full bg-purple-950 px-3 py-1 text-xs text-purple-300"
                        >
                          {type.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  )}

                  <a
                    href={job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 inline-flex rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950"
                  >
                    View Original Job ↗
                  </a>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Agency Client Discovery */}
        <section className="mt-12 border-t border-slate-800 pt-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">
                Agency Client Discovery
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                {agencies.length} unique agencies found ·{" "}
                {savedAgencies.length} saved leads
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={startAgencySearch}
                disabled={agencyRunning}
                className="rounded-xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-40"
              >
                {agencyRunning ? "Searching..." : "Start Search"}
              </button>

              <button
                onClick={stopAgencySearch}
                disabled={!agencyRunning}
                className="rounded-xl border border-slate-600 px-4 py-3 disabled:opacity-40"
              >
                Stop
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-4">
            <p className="font-semibold">
              Agency Scanner: {agencyRunning ? "Running" : "Stopped"}
            </p>
            <p className="mt-2 text-sm text-slate-400">
              {agencyMessage}
            </p>
            {agencyError && (
              <p className="mt-2 text-sm text-amber-300">
                {agencyError}
              </p>
            )}


          </div>


          
<section className="mt-6">
  <h2 className="text-2xl font-bold">
    Agency Source Analytics
  </h2>

  <p className="mt-1 text-sm text-slate-400">
    API performance and agency discovery breakdown
  </p>

  <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
    {agencySourceStats.map((source) => (
      <article
        key={source.source}
        className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold">{source.source}</h3>

          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              source.status === "success"
                ? "bg-green-950 text-green-300"
                : source.status === "partial"
                  ? "bg-amber-950 text-amber-300"
                  : source.status === "skipped"
                    ? "bg-slate-700 text-slate-300"
                    : source.status === "empty"
                      ? "bg-yellow-950 text-yellow-300"
                      : "bg-red-950 text-red-300"
            }`}
          >
            {source.status.toUpperCase()}
          </span>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5">
          <div>
            <p className="text-sm text-slate-400">Candidates</p>
            <p className="mt-1 text-2xl font-bold">
              {source.fetched}
            </p>
          </div>

          <div>
            <p className="text-sm text-slate-400">Unique</p>
            <p className="mt-1 text-2xl font-bold text-green-400">
              {source.matched}
            </p>
          </div>

          <div>
            <p className="text-sm text-slate-400">Duplicates</p>
            <p className="mt-1 text-2xl font-bold">
              {source.duplicates}
            </p>
          </div>

          <div>
            <p className="text-sm text-slate-400">
              Filtered
            </p>
            <p className="mt-1 text-2xl font-bold text-amber-300">
              {source.filtered}
            </p>
          </div>
        </div>

        {source.warnings.length > 0 && (
          <div className="mt-5 border-t border-slate-700 pt-3">
            <p className="text-sm font-semibold text-amber-300">
              Source warnings
            </p>

            {source.warnings.map((warning, index) => (
              <p
                key={`${source.source}-${index}`}
                className="mt-2 break-words text-xs leading-5 text-slate-400"
              >
                {warning}
              </p>
            ))}
          </div>
        )}
      </article>
    ))}
  </div>
</section>


          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={() => setShowSavedAgencies(false)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                !showSavedAgencies
                  ? "bg-cyan-400 text-slate-950"
                  : "border border-slate-700 text-white"
              }`}
            >
              All Agencies ({agencies.length})
            </button>

            <button
              onClick={() => setShowSavedAgencies(true)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                showSavedAgencies
                  ? "bg-cyan-400 text-slate-950"
                  : "border border-slate-700 text-white"
              }`}
            >
              Saved Leads ({savedAgencies.length})
            </button>


            
<button
  onClick={checkAllAgencySignals}
  disabled={
    checkingAllSignals ||
    agencyRunning ||
    agencies.length === 0
  }
  className="rounded-xl bg-purple-500 px-4 py-3 font-semibold text-white disabled:opacity-40"
>
  {checkingAllSignals
    ? "Checking All Agencies..."
    : "Check All Signals"}
</button>

          </div>

          {displayedAgencies.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-slate-700 p-8 text-center text-slate-400">
              {showSavedAgencies
                ? "কোনো Saved Lead নেই। Agency খুঁজে Save Lead চাপো।"
                : "Start Search চাপলে Agency-র তথ্য এখানে দেখা যাবে।"}
            </div>
          ) : (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {displayedAgencies.map((agency) => {
                const key = getAgencyKey(agency);
                const signal = agencySignals[key];
                const isSaved = savedAgencies.some(
                  (item) => getAgencyKey(item) === key
                );
                const isChecking = checkingAgencyKeys.includes(key);

                const location =
                  typeof agency.location === "string"
                    ? agency.location
                    : [
                        agency.location?.city,
                        agency.location?.country,
                      ]
                        .filter(Boolean)
                        .join(", ");

                return (
                  <article
                    key={key}
                    className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
                  >
                    <h3 className="text-lg font-bold">
                      {agency.name || "Unnamed Agency"}
                    </h3>

                    <p className="mt-2 text-sm text-slate-400">
                      {location || "Location not specified"}
                    </p>

                    {agency.tagline && (
                      <p className="mt-3 text-sm text-slate-300">
                        {agency.tagline}
                      </p>
                    )}

                    {agency.rating != null && (
                      <p className="mt-3 text-sm text-amber-300">
                        Rating: {agency.rating}
                        {agency.total_reviews != null
                          ? ` (${agency.total_reviews} reviews)`
                          : ""}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2">
                      {[
                        ...new Set([
                          ...(agency.services ?? []),
                          ...(agency.industries ?? []),
                        ]),
                      ]
                        .slice(0, 8)
                        .map((item) => (
                          <span
                            key={item}
                            className="rounded-full border border-slate-700 px-2 py-1 text-xs"
                          >
                            {item}
                          </span>
                        ))}
                    </div>

                    {/* Signal and Priority Panel */}
                    <div className="mt-4 rounded-xl border border-slate-700 bg-slate-800/60 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold">Priority Score</p>
                        <span className="text-lg font-bold text-cyan-300">
                          {signal
                            ? `${signal.priorityScore}/100`
                            : "Not checked"}
                        </span>
                      </div>

                      {signal && (
                        <p className="mt-1 text-sm text-slate-300">
                          {getPriorityLabel(signal.priorityScore)}
                        </p>
                      )}

                      <p className="mt-3 text-sm text-slate-300">
                        Hiring:{" "}
                        {!signal
                          ? "Not checked"
                          : signal.hiringSignal
                            ? "Potential signal found"
                            : "No clear signal"}
                      </p>

                      <p className="mt-1 text-sm text-slate-300">
                        Contract Support:{" "}
                        {!signal
                          ? "Not checked"
                          : signal.contractSignal
                            ? "Potential signal found"
                            : "No clear signal"}
                      </p>

                      {signal?.status && (
                        <p className="mt-2 text-xs text-slate-400">
                          Status: {signal.status}
                        </p>
                      )}

                      {signal?.evidence?.map((item, index) => (
                        <p
                          key={`${key}-evidence-${index}`}
                          className="mt-2 break-words text-xs text-cyan-300"
                        >
                          {item}
                        </p>
                      ))}

                      {signal?.checkedUrls?.length ? (
                        <p className="mt-2 text-xs text-slate-500">
                          {signal.checkedUrls.length} public pages checked
                        </p>
                      ) : null}

                      <button
                        onClick={() => checkAgencySignal(agency)}
                        disabled={isChecking || agencyRunning}
                        className="mt-4 rounded-lg border border-cyan-500 px-4 py-2 text-sm text-cyan-300 disabled:opacity-40"
                      >
                        {isChecking
                          ? "Checking..."
                          : signal
                            ? "Check Again"
                            : "Check Hiring / Contract"}
                      </button>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">


  
                      {agency.website && (
                        <a
                          href={agency.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950"
                        >
                          Visit Website ↗
                        </a>
                      )}

                      {agency.profile_url && (
                        <a
                          href={agency.profile_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg border border-slate-700 px-4 py-2 text-sm"
                        >
                          Source Profile ↗
                        </a>
                      )}

                      <button
                        onClick={() => toggleSavedAgency(agency)}
                        className={`rounded-lg border px-4 py-2 text-sm ${
                          isSaved
                            ? "border-amber-500 text-amber-300"
                            : "border-cyan-500 text-cyan-300"
                        }`}
                      >
                        {isSaved ? "Remove Saved" : "Save Lead"}
                      </button>


  
  <select
    value={agencyApplicationStatuses[key] ?? "No message"}
    onChange={(event) =>
      updateAgencyApplicationStatus(
        key,
        event.target.value as AgencyApplicationStatus
      )
    }
    className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
    aria-label={`Agency contact status for ${
      agency.name ?? "Agency"
    }`}
  >
    <option value="No message">No message</option>
    <option value="Messaged">Messaged</option>
    <option value="Reply">Reply</option>
    <option value="Rejected">Rejected</option>
    <option value="Not reply">Not reply</option>
    <option value="Follow up">Follow up</option>
    <option value="confirm">Confirm</option>
  </select>

                    </div>



                  </article>
                );
              })}

              
            </div>
          )}

          <p className="mt-5 text-xs text-slate-500">
            Agency directory data provided by{" "}
            <a
              href="https://www.pickanagency.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Pick an Agency
            </a>
            . Public-page keyword matches are potential leads, not verified
            job openings.
          </p>
        </section>



        <LinkedInHiring
  agencies={deduplicateAgencies([
    ...agencies,
    ...savedAgencies,
  ])}
/>

        <footer className="mt-12 border-t border-slate-800 pt-5 text-sm text-slate-500">
          AI Client Hunter · Manual Start / Stop
        </footer>
      </div>
    </main>
  );
}
