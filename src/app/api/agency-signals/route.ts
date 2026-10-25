
import { NextResponse } from "next/server";

type AgencyInput = {
  name?: string;
  website?: string;
};

type SignalResult = {
  name: string;
  website: string;
  status: string;
  evidence: string[];
  checkedUrls: string[];
  hiringSignal: boolean;
  contractSignal: boolean;
};

const PATHS = [
  "/",
  "/careers",
  "/jobs",
  "/work-with-us",
  "/about",
  "/contact",
];

const HIRING_PATTERNS = [
  /\bwe(?:'re| are) hiring\b/i,
  /\bjoin our team\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bcareer opportunities\b/i,
  /\bnow hiring\b/i,
  /\bwe(?:'re| are) looking for\b/i,
  /\bwe(?:'re| are) seeking\b/i,
  /\blooking for developers?\b/i,
  /\blooking for engineers?\b/i,
];

const DEVELOPER_PATTERNS = [
  /\bweb developers?\b/i,
  /\bfrontend developers?\b/i,
  /\bfront-end developers?\b/i,
  /\bbackend developers?\b/i,
  /\bback-end developers?\b/i,
  /\bfull[\s-]?stack developers?\b/i,
  /\bsoftware engineers?\b/i,
  /\breact developers?\b/i,
  /\bnext\.js developers?\b/i,
  /\bfreelance developers?\b/i,
  /\bcontract developers?\b/i,
  /\bindependent contractors?\b/i,
  /\bweb development\b/i,
  /\bsoftware development\b/i,
];

const CONTRACT_PATTERNS = [
  /\bcontract developer\b/i,
  /\bfreelance developer\b/i,
  /\bfreelance development support\b/i,
  /\bcontract development support\b/i,
  /\bstaff augmentation\b/i,
  /\bexternal development team\b/i,
  /\badditional development support\b/i,
  /\badditional development capacity\b/i,
  /\boverflow development(?: work)?\b/i,
  /\bsubcontract(?:or|ing)?\b/i,
  /\bwhite[\s-]?label development\b/i,
  /\blooking for a development partner\b/i,
  /\boutsourc(?:e|ing|ed)\b/i,
  /\bdevelopment support\b/i,
];

function cleanHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&hellip;/gi, "...")
    .replace(/\s+/g, " ")
    .slice(0, 300_000);
}

function isAllowedWebsite(value: string): boolean {
  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" &&
      !!url.hostname &&
      !url.hostname.includes("localhost") &&
      !url.hostname.endsWith(".local") &&
      !url.hostname.startsWith("[") &&
      !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(url.hostname)
    );
  } catch {
    return false;
  }
}

async function inspectAgency(
  agency: AgencyInput,
  request: Request
): Promise<SignalResult> {
  const name = agency.name?.trim() || "Unnamed Agency";
  const website = agency.website?.trim() || "";

  const result: SignalResult = {
    name,
    website,
    status: "Not checked",
    evidence: [],
    checkedUrls: [],
    hiringSignal: false,
    contractSignal: false,
  };

  if (!isAllowedWebsite(website)) {
    result.status = "Invalid or unsupported website";
    return result;
  }

  const base = new URL(website).origin;
  let careersPageFound = false;

 
await Promise.all(
  PATHS.map(async (path) => {
    if (request.signal.aborted) return;

    const target = new URL(path, base);

    try {
      const response = await fetch(target, {
        signal: AbortSignal.any([
          request.signal,
          AbortSignal.timeout(5000),
        ]),
        headers: {
          Accept: "text/html",
          "User-Agent": "AgencyDiscoveryResearchBot/1.0",
        },
        cache: "no-store",
      });

      if (!response.ok) return;

      const contentType =
        response.headers.get("content-type") || "";

      if (!contentType.includes("text/html")) return;

      result.checkedUrls.push(target.href);

      const html = (await response.text()).slice(0, 300_000);
      const text = cleanHtml(html);

      if (
        /^\/(careers?|jobs?|work-with-us)(\/|$)/i.test(path) &&
        text.length > 100
      ) {
        careersPageFound = true;
      }

      const hiringMatches = HIRING_PATTERNS.filter(
        (pattern) => pattern.test(text)
      );

      const developerMatches = DEVELOPER_PATTERNS.filter(
        (pattern) => pattern.test(text)
      );

      const contractMatches = CONTRACT_PATTERNS.filter(
        (pattern) => pattern.test(text)
      );

      const hasDeveloperHiring =
        hiringMatches.length > 0 &&
        developerMatches.length > 0;

      const hasContractSupport = contractMatches.length > 0;

      if (hasDeveloperHiring) {
        result.hiringSignal = true;
      }

      if (hasContractSupport) {
        result.contractSignal = true;
      }

      const evidence = [
        ...(hasDeveloperHiring
          ? hiringMatches.slice(0, 2).map(
              (pattern) => `Hiring phrase: ${pattern.source}`
            )
          : []),

        ...(hasDeveloperHiring
          ? developerMatches.slice(0, 2).map(
              (pattern) => `Developer phrase: ${pattern.source}`
            )
          : []),

        ...contractMatches.slice(0, 3).map(
          (pattern) => `Contract/support phrase: ${pattern.source}`
        ),
      ];

      if (evidence.length > 0) {
        result.evidence.push(
          `${target.href}: ${evidence.join("; ")}`
        );
      }
    } catch {
      // Continue checking other URLs if one page fails.
    }
  })
);


  if (request.signal.aborted) {
    result.status = "Search cancelled";
  } else if (result.hiringSignal && result.contractSignal) {
    result.status = "Hiring and contract/support signals found";
  } else if (result.hiringSignal) {
    result.status = "Potential developer hiring signal";
  } else if (result.contractSignal) {
    result.status = "Potential contract/support signal";
  } else if (careersPageFound) {
    result.status = "Careers page found";
  } else if (result.checkedUrls.length > 0) {
    result.status = "No clear signal";
  } else {
    result.status = "Website could not be checked";
  }

  return result;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!Array.isArray(body.agencies)) {
      return NextResponse.json(
        { success: false, error: "agencies must be an array" },
        { status: 400 }
      );
    }

    if (body.agencies.length > 10) {
      return NextResponse.json(
        {
          success: false,
          error: "Check at most 10 agencies per request.",
        },
        { status: 400 }
      );
    }

  
const agencies = body.agencies as AgencyInput[];

const results = await Promise.all(
  agencies.map((agency) => inspectAgency(agency, request))
);

    return NextResponse.json({
      success: true,
      checked: results.length,
      results,
      note:
        "Public-page keyword matches are potential leads, not verified job openings.",
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request or scan failed." },
      { status: 400 }
    );
  }
}
