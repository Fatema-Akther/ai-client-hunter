import { NextResponse } from "next/server";

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
  location?: { city?: string; country?: string } | string;
  sources?: string[];
};

type JsonRecord = Record<string, unknown>;

const PICK_QUERIES = [
  "web development agency",
  "software development agency",
  "ecommerce development agency",
  "Shopify development agency",
  "WordPress development agency",
  "React development agency",
  "Next.js development agency",
  "full stack development agency",
  "custom web application development",
  "frontend development agency",
  "backend development agency",
  "mobile app development agency",
  "digital agency web development",
  "white label web development",
  "Bangladesh web development agency",
  "India web development agency",
];

const WEB_QUERIES = [
  '"web development agency" "contact"',
  '"software development company" "web development"',
  '"Shopify development agency" OR "WordPress development agency"',
  '"white label web development" OR "development partner"',
];

const EXCLUDED_HOSTS = [
  "linkedin.com",
  "facebook.com",
  "instagram.com",
  "youtube.com",
  "x.com",
  "clutch.co",
  "goodfirms.co",
  "designrush.com",
  "sortlist.com",
  "upcity.com",
  "crunchbase.com",
  "wikipedia.org",
  "tavily.com",
  "agentdata.run",
  "pickanagency.com",
];

function record(value: unknown): JsonRecord {
  return value && typeof value === "object"
    ? (value as JsonRecord)
    : {};
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is string => typeof item === "string"
      )
    : [];
}

function normalizeWebsite(value?: string): string {
  if (!value) return "";

  try {
    const input = /^https?:\/\//i.test(value)
      ? value
      : `https://${value}`;

    const url = new URL(input);

    if (
      !["http:", "https:"].includes(url.protocol) ||
      !url.hostname.includes(".") ||
      url.username ||
      url.password
    ) {
      return "";
    }

    return url.origin;
  } catch {
    return "";
  }
}

function domainOf(value?: string): string {
  const website = normalizeWebsite(value);
  if (!website) return "";

  return new URL(website).hostname
    .toLowerCase()
    .replace(/^www\./, "");
}

function isExcludedHost(host: string): boolean {
  return EXCLUDED_HOSTS.some(
    (excluded) =>
      host === excluded || host.endsWith(`.${excluded}`)
  );
}

function normalizeLocation(value: unknown): Agency["location"] {
  if (typeof value === "string") return value;

  const item = record(value);
  const city = stringValue(item.city);
  const country = stringValue(item.country);

  if (city || country) {
    return [city, country].filter(Boolean).join(", ");
  }

  return undefined;
}

function makeAgency(
  value: unknown,
  source: string
): Agency | null {
  const item = record(value);
  const company = record(item.company);

  const name =
    stringValue(item.name) ||
    stringValue(item.company_name) ||
    stringValue(company.name) ||
    stringValue(item.title);

  const rawWebsite =
    stringValue(item.website) ||
    stringValue(item.domain) ||
    stringValue(item.website_url) ||
    stringValue(company.domain) ||
    stringValue(company.website);

  const website = normalizeWebsite(rawWebsite);

  // Do not treat search-result directories or social profiles
  // as the agency's own website.
  const host = domainOf(website);

  if (!name || !website || !host || isExcludedHost(host)) {
    return null;
  }

  const rawProfile =
    stringValue(item.profile_url) ||
    stringValue(item.source_url) ||
    stringValue(item.url);

  const profileUrl = normalizeWebsite(rawProfile);

  const ratingValue = Number(item.rating);
  const reviewsValue = Number(
    item.total_reviews ?? item.review_count
  );

  return {
    name,
    website,
    profile_url:
      profileUrl && domainOf(profileUrl) !== host
        ? profileUrl
        : undefined,
    slug: stringValue(item.slug) || undefined,
    rating: Number.isFinite(ratingValue)
      ? ratingValue
      : undefined,
    total_reviews: Number.isFinite(reviewsValue)
      ? reviewsValue
      : undefined,
    services: stringArray(item.services),
    industries: stringArray(item.industries),
    tagline:
      stringValue(item.tagline) ||
      stringValue(item.description) ||
      stringValue(item.content) ||
      undefined,
    description:
      stringValue(item.description) ||
      stringValue(item.content) ||
      undefined,
    location: normalizeLocation(item.location),
    sources: [source],
  };
}

function extractList(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;

  const item = record(data);

  for (const key of [
    "results",
    "companies",
    "agencies",
    "items",
    "data",
  ]) {
    if (Array.isArray(item[key])) {
      return item[key] as unknown[];
    }
  }

  return [];
}

async function fetchJson(
  url: string,
  headers: Record<string, string> = {},
  timeoutMs = 12000
): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      ...headers,
    },
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

async function fetchPickAnAgency(
  warnings: string[]
): Promise<Agency[]> {
  const results: Agency[] = [];

  // Use four concurrent requests to avoid excessive pressure
  // on the directory API.
  for (let i = 0; i < PICK_QUERIES.length; i += 4) {
    const batch = PICK_QUERIES.slice(i, i + 4);

    const responses = await Promise.allSettled(
      batch.map(async (query) => {
        const url = new URL(
          "https://www.pickanagency.com/api/v1/search"
        );

        url.searchParams.set("q", query);
        url.searchParams.set("limit", "10");

        const data = await fetchJson(url.toString());

        const root = record(data);

        if (root.success === false) {
          throw new Error("Source returned unsuccessful response");
        }

        const list = extractList(data);

        if (list.length === 0) {
          throw new Error("Unexpected or empty response format");
        }

        return list
          .map((item) => makeAgency(item, "Pick an Agency"))
          .filter((item): item is Agency => item !== null);
      })
    );

    for (const response of responses) {
      if (response.status === "fulfilled") {
        results.push(...response.value);
      } else {
        warnings.push(
          `Pick an Agency: ${response.reason instanceof Error
            ? response.reason.message
            : "Request failed"}`
        );
      }
    }
  }

  return results;
}



async function fetchAgentData(
  warnings: string[],
  discoveredAgencies: Agency[]
): Promise<Agency[]> {
  const apiKey = process.env.AGENTDATA_API_KEY;

  if (!apiKey) {
    warnings.push("AgentData skipped: API key missing");
    return [];
  }

  const results: Agency[] = [];

  const domains = [
    ...new Set(
      discoveredAgencies
        .map((agency) => domainOf(agency.website))
        .filter(Boolean)
    ),
  ].slice(0, 10);

  for (const domain of domains) {
    try {
      const url = new URL(
        "https://agentdata.run/api/v1/lookup"
      );

      url.searchParams.set("domain", domain);

      const data = record(
        await fetchJson(
          url.toString(),
          {
            Authorization: `Bearer ${apiKey}`,
          },
          25000
        )
      );

      const company = record(data.company);

      const original = discoveredAgencies.find(
        (agency) => domainOf(agency.website) === domain
      );

      const name =
        stringValue(company.name) ||
        original?.name ||
        domain;

      results.push({
        ...original,
        name,
        website: `https://${domain}`,
        description:
          stringValue(company.description) ||
          original?.description,
        sources: [
          ...new Set([
            ...(original?.sources ?? []),
            "AgentData",
          ]),
        ],
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown error";

      warnings.push(
        `AgentData: ${domain} - ${message}`
      );
    }
  }

  return results;
}



async function fetchTavily(
  warnings: string[]
): Promise<Agency[]> {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    warnings.push("Tavily skipped: add TAVILY_API_KEY to .env.local");
    return [];
  }

  

  // Search requests are sent with POST.
  // Kept separate from the GET-based directory APIs.
  const actualResponses = await Promise.allSettled(
    WEB_QUERIES.map(async (query) => {
      const response = await fetch(
        "https://api.tavily.com/search",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query,
            search_depth: "basic",
            max_results: 10,
            topic: "general",
          }),
          cache: "no-store",
          signal: AbortSignal.timeout(20000),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = record(await response.json());
      const list = Array.isArray(data.results)
        ? data.results
        : [];

      return list
        .map((result: unknown) => {
          const item = record(result);
          const title = stringValue(item.title);
          const url = stringValue(item.url);
          const content = stringValue(item.content);

          if (!url || !title) return null;

          // Require a likely agency-related search result.
          if (
            !/development agency|software company|web design|digital agency|development partner|white.?label/i.test(
              `${title} ${content}`
            )
          ) {
            return null;
          }

          return makeAgency(
            {
              name: title,
              website: url,
              description: content,
              source_url: url,
            },
            "Tavily"
          );
        })
        .filter((item): item is Agency => item !== null);
    })
  );

  const agencies: Agency[] = [];

  for (const response of actualResponses) {
    if (response.status === "fulfilled") {
      agencies.push(...response.value);
    } else {
      warnings.push(
        `Tavily: ${response.reason instanceof Error
          ? response.reason.message
          : "Request failed"}`
      );
    }
  }

  return agencies;
}

function deduplicateAgencies(
  agencies: Agency[]
): Agency[] {
  const unique = new Map<string, Agency>();

  for (const agency of agencies) {
    const key =
      domainOf(agency.website) ||
      domainOf(agency.profile_url) ||
      (agency.name ?? "").toLowerCase().trim();

    if (!key) continue;

    const existing = unique.get(key);

    if (!existing) {
      unique.set(key, agency);
      continue;
    }

    unique.set(key, {
      ...existing,
      ...agency,
      sources: [
        ...new Set([
          ...(existing.sources ?? []),
          ...(agency.sources ?? []),
        ]),
      ],
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

export async function GET(request: Request) {
  const warnings: string[] = [];

  try {
    if (request.signal.aborted) {
      return NextResponse.json(
        { success: false, error: "Search cancelled" },
        { status: 408 }
      );
    }

  
const discoverySources = await Promise.allSettled([
  fetchPickAnAgency(warnings),
  fetchTavily(warnings),
]);

const discoveredAgencies: Agency[] = [];

for (const source of discoverySources) {
  if (source.status === "fulfilled") {
    discoveredAgencies.push(...source.value);
  } else {
    warnings.push(
      source.reason instanceof Error
        ? source.reason.message
        : "Discovery source failed"
    );
  }
}

const agentDataAgencies = await fetchAgentData(
  warnings,
  deduplicateAgencies(discoveredAgencies)
);

const allAgencies: Agency[] = [
  ...discoveredAgencies,
  ...agentDataAgencies,
];


    if (request.signal.aborted) {
      return NextResponse.json(
        { success: false, error: "Search cancelled" },
        { status: 408 }
      );
    }

   


    const agencies = deduplicateAgencies(allAgencies);



    
const sourceNames = ["Pick an Agency", "AgentData", "Tavily"];

const sourceStats = sourceNames.map((source) => {
  const candidates = allAgencies.filter((agency) =>
    agency.sources?.includes(source)
  );

  const uniqueCandidates = deduplicateAgencies(candidates);
  const duplicates = candidates.length - uniqueCandidates.length;

  const sourceWarnings = warnings.filter((warning) =>
    warning.startsWith(`${source}:`) ||
    warning.startsWith(`${source} skipped:`)
  );

  const skipped = sourceWarnings.some((warning) =>
    warning.toLowerCase().includes("skipped:")
  );

  let status: "success" | "partial" | "failed" | "empty" | "skipped";

  if (skipped) {
    status = "skipped";
  } else if (sourceWarnings.length > 0 && candidates.length > 0) {
    status = "partial";
  } else if (sourceWarnings.length > 0) {
    status = "failed";
  } else if (candidates.length === 0) {
    status = "empty";
  } else {
    status = "success";
  }

  return {
    source,
    status,
    fetched: candidates.length,
    matched: uniqueCandidates.length,
    duplicates,
    filtered: 0,
    warnings: sourceWarnings,
  };
});


    return NextResponse.json({
      success: true,
      sources: [
        "Pick an Agency",
        "AgentData",
        "Tavily",
      ],
      activeSources: [
        ...new Set(
          agencies.flatMap((agency) => agency.sources ?? [])
        ),
      ],
      searchedQueries: {
        pickAnAgency: PICK_QUERIES,
        agentData: [
          "web development agency",
          "software development agency",
          "ecommerce development agency",
          "Shopify WordPress development",
        ],
        tavily: WEB_QUERIES,
      },
     sourceStats,
totalFetched: allAgencies.length,
totalFound: agencies.length,
agencies,
      warnings,
      note:
        "Agency candidates are deduplicated by domain. " +
        "Search results are not guaranteed to be verified agencies.",
    });
  } catch (error) {
    console.error("Agency discovery failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to discover agencies.",
        warnings,
      },
      { status: 500 }
    );
  }
}
