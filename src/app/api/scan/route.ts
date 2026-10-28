import { NextResponse } from "next/server";

type SourceName = "Jobicy" | "Arbeitnow" | "Remotive";
type JobicyJob = {
  id?: string | number;
  url?: string;
  jobTitle?: string;
  companyName?: string;
  jobGeo?: string;
  jobType?: string[];
  jobDescription?: string;
  jobExcerpt?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  publishedAt?: string | null;
  pubDate?: string | null;
  source?: SourceName;
};
type SourceDiagnostic = {
  source: SourceName;
  status: "success" | "empty" | "failed";
  fetched: number;
  invalid: number;
  filteredOut: number;
  matched: number;
  duplicates: number;
  error?: string;
};
type ProcessedJob = {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  publishedAt: string | null;
  jobType: string[];
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  score: number;
  matchedSkills: string[];
  source: SourceName;
  eligible: boolean;
  level: string;
  experienceStatus: string;
  locationCategory: "Worldwide Remote" | "Region Restricted" | "Location Unclear";
  isFresh: boolean;
  freshnessStatus: string;
};

const SOURCES: SourceName[] = ["Jobicy", "Arbeitnow", "Remotive"];
const SOURCE_TIMEOUT_MS = 12000;
const SKILLS = [
  { name: "Next.js", pattern: /\bnext\s*\.?\s*js\b|\bnextjs\b/i },
  { name: "React", pattern: /\breact(?:\.js)?\b/i },
  { name: "Tailwind CSS", pattern: /\btailwind(?:\s+css)?\b/i },
  { name: "NestJS", pattern: /\bnest\s*\.?\s*js\b|\bnestjs\b/i },
  { name: "PostgreSQL", pattern: /\bpostgres(?:ql)?\b/i },
  { name: "TypeScript", pattern: /\btypescript\b/i },
  { name: "Full-Stack", pattern: /\bfull[\s-]?stack\b/i },
  { name: "Frontend", pattern: /\bfront[\s-]?end\b/i },
  { name: "Backend", pattern: /\bback[\s-]?end\b/i },
  { name: "REST API", pattern: /\brest(?:ful)?\s+api\b/i },
  { name: "eCommerce", pattern: /\be[\s-]?commerce\b/i },
];

function diagnostic(source: SourceName): SourceDiagnostic {
  return { source, status: "failed", fetched: 0, invalid: 0, filteredOut: 0, matched: 0, duplicates: 0 };
}
function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}
function array(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function text(value: string): string {
  return value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&").replace(/&hellip;/gi, "...")
    .replace(/&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ").trim();
}
function clean(job: JobicyJob, source: SourceName): JobicyJob {
  return {
    ...job, jobTitle: job.jobTitle?.trim(),
    companyName: job.companyName?.trim() || "Company not specified",
    jobDescription: text(job.jobDescription ?? ""),
    jobExcerpt: text(job.jobExcerpt ?? ""), source,
  };
}
function normalizeUrl(value?: string): string {
  if (!value) return "";
  try {
    const url = new URL(value);
    url.hash = "";
    for (const name of [...url.searchParams.keys()]) {
      if (/^(utm_|ref$|source$|fbclid$|gclid$)/i.test(name)) url.searchParams.delete(name);
    }
    return url.href.replace(/\/+$/, "").toLowerCase();
  } catch { return value.trim().replace(/\/+$/, "").toLowerCase(); }
}
function jobKey(job: ProcessedJob): string {
  const url = normalizeUrl(job.url);
  return url ? `url:${url}` : `job:${job.title.toLowerCase().trim()}|${job.company.toLowerCase().trim()}`;
}
function locationCategory(job: JobicyJob): ProcessedJob["locationCategory"] {
  const combined = [job.jobGeo, job.jobTitle, job.jobExcerpt, job.jobDescription].filter(Boolean).join(" ");
  const restricted = [
    /\bremote (?:within|only in)\s+[a-z\s-]+/i,
    /\bonly within\s+[a-z\s-]+/i,
    /\bmust (?:be based|reside) in\s+[a-z\s-]+/i,
    /\b(?:us|usa|uk|canada|europe|eu|poland|australia)\s+(?:only|residents only)\b/i,
    /\b(?:only|exclusively) (?:in|for) (?:the )?(?:us|usa|uk|canada|eu|europe)\b/i,
  ];
  if (restricted.some(re => re.test(combined))) return "Region Restricted";
  const global = [
    /\b(?:remote worldwide|worldwide remote|open to applicants worldwide|applicants worldwide)\b/i,
    /\b(?:work from|remote from) anywhere(?: in the world)?\b/i,
    /\b(?:any country|all countries|worldwide)\b/i,
  ];
  return global.some(re => re.test(combined)) ? "Worldwide Remote" : "Location Unclear";
}
function freshness(date?: string | null): Pick<ProcessedJob, "isFresh" | "freshnessStatus"> {
  if (!date) return { isFresh: false, freshnessStatus: "Date unavailable" };
  const value = new Date(date).getTime();
  if (!Number.isFinite(value)) return { isFresh: false, freshnessStatus: "Invalid date" };
  const days = (Date.now() - value) / 86400000;
  if (days < -1) return { isFresh: false, freshnessStatus: "Future date — verify" };
  if (days <= 7) return { isFresh: true, freshnessStatus: "Posted within 7 days" };
  return { isFresh: false, freshnessStatus: "Older than 7 days" };
}
function scoreJob(job: JobicyJob) {
  const title = job.jobTitle ?? "";
  const description = text([job.jobExcerpt, job.jobDescription].filter(Boolean).join(" "));
  const matchedSkills = SKILLS.filter(skill => skill.pattern.test(`${title} ${description}`)).map(skill => skill.name);
  const titleMatches = SKILLS.filter(skill => skill.pattern.test(title));
  const seniorTitle = /\b(senior|sr\.?|staff|principal|director|manager|architect|head of|vice president)\b/i.test(title);
  const leadTitle = /\b(lead|tech lead|team lead|engineering manager)\b/i.test(title);
  const relevantTitle = /\b(developer|engineer|programmer|front[\s-]?end|back[\s-]?end|full[\s-]?stack|react|next\s*\.?\s*js|nextjs|nestjs|api)\b/i.test(title);
  const entryTitle = /\b(junior|jr\.?|entry[\s-]?level|graduate|trainee|intern|internship)\b/i.test(title);
  const intermediate = /\b(developer|engineer|programmer)\b/i.test(title);
  const requirementText = description.split(/[.!?\n;]+/).filter(sentence =>
    /\b(experience|experienced|years?|yrs?|minimum|required|qualification|at least)\b/i.test(sentence)
  ).join(" ");
  const yearsFound: number[] = [];
  const patterns = [
    /(\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/gi,
    /(\d+(?:\.\d+)?)\s*\+\s*(?:years?|yrs?)/gi,
    /\b(?:minimum|min\.?|at least)\s+(?:of\s+)?(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/gi,
    /(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\s+(?:of\s+)?experience\b/gi,
  ];
  for (const [index, pattern] of patterns.entries()) {
    for (const match of requirementText.matchAll(pattern)) {
      const candidate = Number(index === 0 ? match[2] : match[1]);
      if (Number.isFinite(candidate)) yearsFound.push(candidate);
    }
  }
  const years = yearsFound.length ? Math.max(...yearsFound) : null;
  const eligible = relevantTitle && !seniorTitle && !leadTitle && (years === null || years <= 2);
  let score = Math.min(titleMatches.length * 15, 45) + Math.min(matchedSkills.length * 5, 30);
  if (entryTitle) score += 20;
  else if (intermediate) score += 10;
  if (years !== null && years <= 2) score += 10;
  return {
    score: Math.min(100, score), matchedSkills, eligible,
    level: !eligible ? "Excluded" : entryTitle ? "Entry-Level" : intermediate ? "Potential Intermediate" : "Unclassified",
    experienceStatus: years === null ? "Not clearly specified" : years <= 2 ? `Up to ${years} years detected` : `${years}+ years may be required`,
  };
}
function processJob(job: JobicyJob): ProcessedJob {
  const publishedAt = job.publishedAt ?? job.pubDate ?? null;
  return {
    id: String(job.id ?? job.url ?? ""), title: job.jobTitle ?? "",
    company: job.companyName ?? "Company not specified",
    location: job.jobGeo || "Location not specified",
    description: job.jobExcerpt || "Open the original listing for the full description.",
    url: job.url ?? "", publishedAt, jobType: job.jobType ?? [],
    salaryMin: job.salaryMin ?? null, salaryMax: job.salaryMax ?? null,
    salaryCurrency: job.salaryCurrency ?? null,
    source: job.source ?? "Jobicy", locationCategory: locationCategory(job),
    ...scoreJob(job), ...freshness(publishedAt),
  };
}
async function fetchJson(url: string, requestSignal: AbortSignal): Promise<unknown> {
  // Each source has its own timeout: a slow source cannot cancel the other two.
  const signal = AbortSignal.any([requestSignal, AbortSignal.timeout(SOURCE_TIMEOUT_MS)]);
  const response = await fetch(url, {
    signal, cache: "no-store", headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
async function collect(source: SourceName, signal: AbortSignal, d: SourceDiagnostic): Promise<JobicyJob[]> {
  try {
    let results: JobicyJob[] = [];
    if (source === "Jobicy") {
      // Jobicy's currently documented API endpoint (the older /api/v2/remote-jobs is legacy).
      const raw = record(await fetchJson("https://jobicy.com/api/jobs?count=100&industry=engineering", signal));
      if (raw.success === false || !Array.isArray(raw.jobs)) throw new Error("Unexpected Jobicy response format");
      results = (raw.jobs as JobicyJob[]).map(job => clean(job, source));
    } else if (source === "Arbeitnow") {
      const raw = record(await fetchJson("https://www.arbeitnow.com/api/job-board-api", signal));
      if (!Array.isArray(raw.data)) throw new Error("Unexpected Arbeitnow response format");
      results = array(raw.data).map(item => {
        const job = record(item);
        const description = text(String(job.description ?? ""));
        return clean({
          id: `arbeitnow-${String(job.slug ?? job.url ?? "")}`,
          url: typeof job.url === "string" ? job.url : undefined,
          jobTitle: typeof job.title === "string" ? job.title : undefined,
          companyName: typeof job.company_name === "string" ? job.company_name : undefined,
          jobGeo: typeof job.location === "string" ? job.location : job.remote === true ? "Remote" : "",
          jobType: Array.isArray(job.job_types) ? job.job_types.filter((v): v is string => typeof v === "string") : [],
          jobDescription: description, jobExcerpt: description.slice(0, 900),
          pubDate: typeof job.created_at === "number" ? new Date(job.created_at * 1000).toISOString() : null,
        }, source);
      });
    } else {
      const raw = record(await fetchJson("https://remotive.com/api/remote-jobs?category=software-dev&limit=200", signal));
      if (!Array.isArray(raw.jobs)) throw new Error("Unexpected Remotive response format");
      results = array(raw.jobs).map(item => {
        const job = record(item);
        const description = text(String(job.description ?? ""));
        return clean({
          id: `remotive-${String(job.id ?? "")}`,
          url: typeof job.url === "string" ? job.url : undefined,
          jobTitle: typeof job.title === "string" ? job.title : undefined,
          companyName: typeof job.company_name === "string" ? job.company_name : undefined,
          jobGeo: typeof job.candidate_required_location === "string" ? job.candidate_required_location : "Remote",
          jobType: typeof job.job_type === "string" ? [job.job_type] : [],
          jobDescription: description, jobExcerpt: description.slice(0, 1200),
          pubDate: typeof job.publication_date === "string" ? job.publication_date : null,
        }, source);
      });
    }
    d.fetched = results.length;
    d.status = results.length ? "success" : "empty";
    return results;
  } catch (error) {
    d.status = "failed";
    d.error = error instanceof Error
      ? error.name === "TimeoutError" ? "Source timed out after 12 seconds" : error.message
      : "Request failed";
    return [];
  }
}

export async function GET(request: Request) {
  const diagnostics = Object.fromEntries(SOURCES.map(source => [source, diagnostic(source)])) as Record<SourceName, SourceDiagnostic>;
  try {
    const sourceResults = await Promise.all(SOURCES.map(source => collect(source, request.signal, diagnostics[source])));
    if (request.signal.aborted) return NextResponse.json({ success: false, error: "Scan cancelled" }, { status: 408 });
    const groups: Record<SourceName, ProcessedJob[]> = { Jobicy: [], Arbeitnow: [], Remotive: [] };
    for (const job of sourceResults.flat()) {
      const source = job.source ?? "Jobicy";
      if (!job.jobTitle?.trim() || !job.url?.trim()) {
        diagnostics[source].invalid++;
        continue;
      }
      try {
        const processed = processJob(job);
        const qualifies = processed.eligible && processed.score >= 20 && processed.isFresh && processed.locationCategory !== "Region Restricted";
        if (qualifies) groups[source].push(processed);
        else diagnostics[source].filteredOut++;
      } catch (error) {
        diagnostics[source].invalid++;
        console.warn(`Invalid ${source} job record:`, error);
      }
    }
    const jobs: ProcessedJob[] = [];
    const seen = new Set<string>();
    for (const source of SOURCES) {
      for (const job of groups[source]) {
        const key = jobKey(job);
        if (seen.has(key)) diagnostics[source].duplicates++;
        else { seen.add(key); jobs.push(job); diagnostics[source].matched++; }
      }
    }
    jobs.sort((a, b) => b.score - a.score);
    const failed = SOURCES.filter(source => diagnostics[source].status === "failed");
    if (failed.length === SOURCES.length) {
      return NextResponse.json({
        success: false,
        error: "All job sources failed. Check sourceDiagnostics for the individual API errors.",
        sourceDiagnostics: SOURCES.map(source => diagnostics[source]),
      }, { status: 503 });
    }
    return NextResponse.json({
      success: true,
      source: "Jobicy, Arbeitnow, Remotive",
      fetchedAt: new Date().toISOString(),
      totalFetched: SOURCES.reduce((sum, source) => sum + diagnostics[source].fetched, 0),
      matchedCount: jobs.length,
      sourceDiagnostics: SOURCES.map(source => diagnostics[source]),
      jobs,
      note: failed.length
        ? `Partial scan: ${failed.join(", ")} could not be fetched. Other sources were processed.`
        : "All sources responded. Listings filtered by skills, experience, freshness and geographic restrictions.",
    });
  } catch (error) {
    console.error("Unexpected job scan error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unexpected job scan error",
      sourceDiagnostics: SOURCES.map(source => diagnostics[source]),
    }, { status: 500 });
  }
}
