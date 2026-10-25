
import { NextResponse } from "next/server";

type JobicyJob = {
  id?: number | string;
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
  source?: string;
};

type RemotiveJob = {
  id: number;
  title: string;
  company_name: string;
  url: string;
  description?: string;
  job_type?: string;
  publication_date?: string;
  candidate_required_location?: string;
  salary?: string;
};

type ArbeitnowJob = {
  slug?: string;
  title?: string;
  company_name?: string;
  location?: string;
  description?: string;
  url?: string;
  job_types?: string[];
  created_at?: number;
  remote?: boolean;
};

type SourceName = "Jobicy" | "Arbeitnow" | "Remotive";

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
  locationCategory:
    | "Worldwide Remote"
    | "Region Restricted"
    | "Location Unclear";
  isFresh: boolean;
  freshnessStatus: string;
};

const SOURCE_NAMES: SourceName[] = [
  "Jobicy",
  "Arbeitnow",
  "Remotive",
];

function createDiagnostic(
  source: SourceName
): SourceDiagnostic {
  return {
    source,
    status: "failed",
    fetched: 0,
    invalid: 0,
    filteredOut: 0,
    matched: 0,
    duplicates: 0,
  };
}

const CANONICAL_SKILLS: {
  name: string;
  pattern: RegExp;
}[] = [
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

function normalizeText(value: string): string {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&hellip;/gi, "...")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeJobUrl(value?: string): string {
  if (!value) return "";

  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";

    return url.href.replace(/\/+$/, "").toLowerCase();
  } catch {
    return value.trim().replace(/\/+$/, "").toLowerCase();
  }
}

function getJobKey(job: {
  url: string;
  title: string;
  company: string;
}): string {
  const url = normalizeJobUrl(job.url);

  if (url) return `url:${url}`;

  return `job:${job.title.toLowerCase().trim()}|${job.company
    .toLowerCase()
    .trim()}`;
}

function classifyLocation(
  job: JobicyJob
): ProcessedJob["locationCategory"] {
  const text = [
    job.jobTitle,
    job.jobGeo,
    job.jobExcerpt,
    job.jobDescription,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/&hellip;/g, " ");

  const restrictedPatterns = [
    /\bremote within\s+[a-z\s-]+/i,
    /\bremote only in\s+[a-z\s-]+/i,
    /\bonly within\s+[a-z\s-]+/i,
    /\bmust be based in\s+[a-z\s-]+/i,
    /\bmust reside in\s+[a-z\s-]+/i,
    /\bremote\s*[-–—]\s*(?:us|usa|uk|canada|poland|australia)\s+only\b/i,
    /\b(?:100%\s*)?remote within poland\b/i,
  ];

  if (
    restrictedPatterns.some((pattern) => pattern.test(text))
  ) {
    return "Region Restricted";
  }

  const worldwidePatterns = [
    /\bopen to applicants worldwide\b/i,
    /\bapplicants worldwide\b/i,
    /\bworldwide applicants\b/i,
    /\bremote worldwide\b/i,
    /\bworldwide remote\b/i,
    /\bremote[\s-]+anywhere in the world\b/i,
    /\bwork from anywhere in the world\b/i,
    /\bopen to applicants from any country\b/i,
    /\bapplicants from all countries\b/i,
  ];

  if (worldwidePatterns.some((pattern) => pattern.test(text))) {
    return "Worldwide Remote";
  }

  return "Location Unclear";
}

function getJobFreshness(publishedAt?: string | null) {
  if (!publishedAt) {
    return {
      isFresh: false,
      freshnessStatus: "Date unavailable",
    };
  }

  const publishedDate = new Date(publishedAt);

  if (Number.isNaN(publishedDate.getTime())) {
    return {
      isFresh: false,
      freshnessStatus: "Invalid date",
    };
  }

  const ageInDays =
    (Date.now() - publishedDate.getTime()) /
    (1000 * 60 * 60 * 24);

  if (ageInDays < 0) {
    return {
      isFresh: false,
      freshnessStatus: "Future date — verify",
    };
  }

  if (ageInDays <= 7) {
    return {
      isFresh: true,
      freshnessStatus: "Posted within 7 days",
    };
  }

  return {
    isFresh: false,
    freshnessStatus: "Older than 7 days",
  };
}

function scoreJob(job: JobicyJob) {
  const title = job.jobTitle ?? "";
  const description = normalizeText(
    [job.jobExcerpt, job.jobDescription]
      .filter(Boolean)
      .join(" ")
  );

  const fullText = `${title} ${description}`;

  const matchedSkills = CANONICAL_SKILLS
    .filter((skill) => skill.pattern.test(fullText))
    .map((skill) => skill.name);

  const seniorTitle =
    /\b(senior|sr\.?|staff|principal|director|manager|architect|head of|vice president)\b/i.test(
      title
    );

  const leadershipTitle =
    /\b(lead|tech lead|team lead|engineering manager)\b/i.test(
      title
    );

  const sentences = description
    .split(/[.!?\n;]+/)
    .filter(Boolean);

  const requirementText = sentences
    .filter((sentence) =>
      /\b(experience|experienced|years?|yrs?|minimum|required|qualification|qualifications|at least)\b/i.test(
        sentence
      )
    )
    .join(" ");

  let maxRequiredYears: number | null = null;

  const rangePattern =
    /(\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/gi;

  for (const match of requirementText.matchAll(rangePattern)) {
    const maximum = Number(match[2]);

    if (
      Number.isFinite(maximum) &&
      (maxRequiredYears === null || maximum > maxRequiredYears)
    ) {
      maxRequiredYears = maximum;
    }
  }

  const minimumPatterns = [
    /(\d+(?:\.\d+)?)\s*\+\s*(?:years?|yrs?)/gi,
    /\b(?:minimum|min\.?|at least)\s+(?:of\s+)?(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/gi,
  ];

  for (const pattern of minimumPatterns) {
    for (const match of requirementText.matchAll(pattern)) {
      const years = Number(match[1]);

      if (
        Number.isFinite(years) &&
        (maxRequiredYears === null || years > maxRequiredYears)
      ) {
        maxRequiredYears = years;
      }
    }
  }

  const experiencePattern =
    /(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\s+(?:of\s+)?experience\b/gi;

  for (const match of requirementText.matchAll(experiencePattern)) {
    const years = Number(match[1]);

    if (
      Number.isFinite(years) &&
      (maxRequiredYears === null || years > maxRequiredYears)
    ) {
      maxRequiredYears = years;
    }
  }

  const explicitlyTooExperienced =
    maxRequiredYears !== null && maxRequiredYears > 2;

  const explicitEntryLevel =
    /\b(junior|jr\.?|entry[\s-]?level|graduate|trainee|intern|internship)\b/i.test(
      title
    );

  const intermediateTitle =
    /\b(developer|engineer|programmer)\b/i.test(title);

  const relevantTitle =
    /\b(developer|engineer|programmer|frontend|front[\s-]?end|backend|back[\s-]?end|full[\s-]?stack|react|next\s*\.?\s*js|nextjs|nestjs|api)\b/i.test(
      title
    );

  const eligible =
    relevantTitle &&
    !seniorTitle &&
    !leadershipTitle &&
    !explicitlyTooExperienced;

  const titleMatches = CANONICAL_SKILLS.filter((skill) =>
    skill.pattern.test(title)
  );

  let score = 0;

  score += Math.min(titleMatches.length * 15, 45);
  score += Math.min(matchedSkills.length * 5, 30);

  if (explicitEntryLevel) {
    score += 20;
  } else if (intermediateTitle) {
    score += 10;
  }

  if (maxRequiredYears !== null && maxRequiredYears <= 2) {
    score += 10;
  }

  score = Math.max(0, Math.min(100, score));

  const level = !eligible
    ? "Excluded"
    : explicitEntryLevel
      ? "Entry-Level"
      : intermediateTitle
        ? "Potential Intermediate"
        : "Unclassified";

  const experienceStatus =
    maxRequiredYears === null
      ? "Not clearly specified"
      : maxRequiredYears <= 2
        ? `Up to ${maxRequiredYears} years detected`
        : `${maxRequiredYears}+ years may be required`;

  return {
    score,
    matchedSkills,
    eligible,
    level,
    experienceStatus,
  };
}

function normalizeJob(
  job: JobicyJob,
  source: SourceName
): JobicyJob {
  return {
    ...job,
    jobTitle: job.jobTitle?.trim(),
    companyName: job.companyName?.trim() || "Company not specified",
    jobDescription: normalizeText(job.jobDescription ?? ""),
    jobExcerpt: normalizeText(job.jobExcerpt ?? ""),
    source,
  };
}

function toProcessedJob(job: JobicyJob): ProcessedJob {
  const {
    score,
    matchedSkills,
    eligible,
    level,
    experienceStatus,
  } = scoreJob(job);

  const locationCategory = classifyLocation(job);

  const publishedAt = job.publishedAt ?? job.pubDate ?? null;

  const { isFresh, freshnessStatus } =
    getJobFreshness(publishedAt);

  return {
    id: String(job.id ?? job.url),
    title: job.jobTitle ?? "",
    company: job.companyName ?? "Company not specified",
    location: job.jobGeo ?? "Location not specified",
    description:
      job.jobExcerpt ||
      "Open the original listing for the full description.",
    url: job.url ?? "",
    publishedAt,
    jobType: job.jobType ?? [],
    salaryMin: job.salaryMin ?? null,
    salaryMax: job.salaryMax ?? null,
    salaryCurrency: job.salaryCurrency ?? null,
    score,
    matchedSkills,
    source: (job.source ?? "Jobicy") as SourceName,
    eligible,
    level,
    experienceStatus,
    locationCategory,
    isFresh,
    freshnessStatus,
  };
}

async function fetchJson(
  url: string,
  signal: AbortSignal
): Promise<unknown> {
  const response = await fetch(url, {
    signal,
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

async function fetchJobicy(
  signal: AbortSignal,
  diagnostic: SourceDiagnostic
): Promise<JobicyJob[]> {
  const url = new URL("https://jobicy.com/api/v2/remote-jobs");

  url.searchParams.set("count", "100");
  url.searchParams.set("industry", "engineering");

  try {
    const raw = await fetchJson(url.toString(), signal);
    const data = asRecord(raw);

    if (data.success === false || !Array.isArray(data.jobs)) {
      throw new Error("Unexpected response format from Jobicy");
    }

    const items = data.jobs as JobicyJob[];

    diagnostic.fetched = items.length;
    diagnostic.status = items.length > 0 ? "success" : "empty";

    return items.map((job) => normalizeJob(job, "Jobicy"));
  } catch (error) {
    if (signal.aborted) throw error;

    diagnostic.status = "failed";
    diagnostic.error =
      error instanceof Error ? error.message : "Request failed";

    return [];
  }
}

async function fetchArbeitnow(
  signal: AbortSignal,
  diagnostic: SourceDiagnostic
): Promise<JobicyJob[]> {
  try {
    const raw = await fetchJson(
      "https://www.arbeitnow.com/api/job-board-api",
      signal
    );

    const data = asRecord(raw);
    const items = asArray(data.data) as ArbeitnowJob[];

    diagnostic.fetched = items.length;
    diagnostic.status = items.length > 0 ? "success" : "empty";

    return items.map((job) => {
      const description = normalizeText(job.description ?? "");

      return normalizeJob(
        {
          id: `arbeitnow-${job.slug ?? job.url ?? ""}`,
          url: job.url,
          jobTitle: job.title,
          companyName: job.company_name ?? "Company not specified",
          jobGeo: job.location ?? (job.remote ? "Remote" : ""),
          jobType: job.job_types ?? [],
          jobDescription: description,
          jobExcerpt: description.slice(0, 900),
          pubDate:
            typeof job.created_at === "number"
              ? new Date(job.created_at * 1000).toISOString()
              : null,
        },
        "Arbeitnow"
      );
    });
  } catch (error) {
    if (signal.aborted) throw error;

    diagnostic.status = "failed";
    diagnostic.error =
      error instanceof Error ? error.message : "Request failed";

    return [];
  }
}

async function fetchRemotive(
  signal: AbortSignal,
  diagnostic: SourceDiagnostic
): Promise<JobicyJob[]> {
  const url = new URL("https://remotive.com/api/remote-jobs");

  url.searchParams.set("category", "software-dev");
  url.searchParams.set("limit", "200");

  try {
    const raw = await fetchJson(url.toString(), signal);
    const data = asRecord(raw);
    const items = asArray(data.jobs) as RemotiveJob[];

    diagnostic.fetched = items.length;
    diagnostic.status = items.length > 0 ? "success" : "empty";

    return items.map((job) => {
      const description = normalizeText(job.description ?? "");
      const location = job.candidate_required_location ?? "";

      return normalizeJob(
        {
          id: `remotive-${job.id}`,
          url: job.url,
          jobTitle: job.title,
          companyName: job.company_name || "Company not specified",
          jobGeo: /worldwide/i.test(location)
            ? "Remote worldwide"
            : location || "Remote",
          jobType: job.job_type ? [job.job_type] : [],
          jobDescription: description,
          jobExcerpt: description.slice(0, 1200),
          pubDate: job.publication_date ?? null,
        },
        "Remotive"
      );
    });
  } catch (error) {
    if (signal.aborted) throw error;

    diagnostic.status = "failed";
    diagnostic.error =
      error instanceof Error ? error.message : "Request failed";

    return [];
  }
}

export async function GET(request: Request) {
  const diagnostics = Object.fromEntries(
    SOURCE_NAMES.map((source) => [
      source,
      createDiagnostic(source),
    ])
  ) as Record<SourceName, SourceDiagnostic>;

  try {
    const timeoutSignal = AbortSignal.timeout(25000);

    const signal = AbortSignal.any([
      request.signal,
      timeoutSignal,
    ]);

    const sourceResults = await Promise.all([
      fetchJobicy(signal, diagnostics.Jobicy),
      fetchArbeitnow(signal, diagnostics.Arbeitnow),
      fetchRemotive(signal, diagnostics.Remotive),
    ]);

    if (request.signal.aborted) {
      return NextResponse.json(
        { success: false, error: "Scan cancelled" },
        { status: 408 }
      );
    }

    const sourceJobs: JobicyJob[] = sourceResults.flat();

    const processedBySource: Record<SourceName, ProcessedJob[]> = {
      Jobicy: [],
      Arbeitnow: [],
      Remotive: [],
    };

    for (const job of sourceJobs) {
      const source = job.source as SourceName;

      if (!job.jobTitle?.trim() || !job.url?.trim()) {
        diagnostics[source].invalid++;
        continue;
      }

      const processed = toProcessedJob(job);

      const passesFilters =
        processed.eligible &&
        processed.score >= 20 &&
        processed.isFresh &&
        processed.locationCategory !== "Region Restricted";

      if (!passesFilters) {
        diagnostics[source].filteredOut++;
        continue;
      }

      processedBySource[source].push(processed);
    }

    // Process in a fixed order so cross-source duplicates
    // are attributed consistently to the later source.
    const uniqueJobs: ProcessedJob[] = [];
    const seenKeys = new Set<string>();

    for (const source of SOURCE_NAMES) {
      const candidates = processedBySource[source];

      for (const job of candidates) {
        const key = getJobKey(job);

        if (seenKeys.has(key)) {
          diagnostics[source].duplicates++;
          continue;
        }

        seenKeys.add(key);
        uniqueJobs.push(job);
        diagnostics[source].matched++;
      }
    }

    uniqueJobs.sort((a, b) => b.score - a.score);

    return NextResponse.json({
      success: true,
      source: "Jobicy, Arbeitnow, Remotive",
      fetchedAt: new Date().toISOString(),
      totalFetched: SOURCE_NAMES.reduce(
        (sum, source) => sum + diagnostics[source].fetched,
        0
      ),
      matchedCount: uniqueJobs.length,
      sourceDiagnostics: SOURCE_NAMES.map(
        (source) => diagnostics[source]
      ),
      jobs: uniqueJobs,
      note:
        "Filtered-out counts include invalid records separately. " +
        "Duplicates are counted among jobs that pass the filters. " +
        "A matched job is a unique listing that passes all filters.",
    });
  } catch (error) {
    if (request.signal.aborted) {
      return NextResponse.json(
        { success: false, error: "Scan cancelled" },
        { status: 408 }
      );
    }

    console.error("Job scan failed:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          "Unable to complete job scan. Check your connection and try again.",
        sourceDiagnostics: SOURCE_NAMES.map(
          (source) => diagnostics[source]
        ),
      },
      { status: 500 }
    );
  }
}
