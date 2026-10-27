import { NextResponse } from "next/server";

type Platform = "facebook" | "instagram";
type Mode = "business" | "demand";
type TavilyItem = { title?: string; url?: string; content?: string; published_date?: string };
type Lead = {
  id: string; title: string; url: string; platform: Platform; mode: Mode;
  country: string; category: string; snippet: string; reportedDate: string | null;
  dateStatus: "reported_recent" | "unknown" | "not_applicable";
};

const COUNTRIES = ["USA", "UK", "Canada", "Bangladesh"] as const;
const CATEGORIES = ["Restaurants & Cafes", "Clothing & Fashion", "Beauty Salons", "Real Estate", "Other"] as const;
const TERMS = ["Web developer", "Website development", "React / Next.js", "Freelance developer", "Website redesign", "E-commerce website", "WordPress developer", "Shopify developer"] as const;

function normalizeSocialUrl(raw: string, platform: Platform, mode: Mode): string | null {
  try {
    const url = new URL(raw);
    if (!["https:", "http:"].includes(url.protocol)) return null;
    const host = url.hostname.toLowerCase();
    const allowed = platform === "facebook"
      ? ["facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com"]
      : ["instagram.com", "www.instagram.com"];
    if (!allowed.includes(host)) return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length === 0) return null;
    const first = parts[0].toLowerCase();
    const excluded = new Set(["login", "accounts", "explore", "search", "help", "about", "privacy", "terms", "policies", "share", "sharer", "dialog", "plugins", "stories", "reels", "reel"]);
    if (excluded.has(first)) return null;
    if (mode === "demand") {
      if (platform === "facebook") {
        const postPath = first === "posts" || first === "permalink.php" || first === "story.php" || first === "photo.php" || first === "watch" || first === "reel" || (parts.length >= 3 && ["posts", "videos"].includes(parts[1].toLowerCase())) || (first === "groups" && parts.length >= 4 && parts[2].toLowerCase() === "permalink");
        if (!postPath) return null;
      } else if (!(first === "p" && parts.length >= 2)) return null;
    } else {
      if (platform === "instagram") {
        if (parts.length !== 1 || ["p", "tv", "tags", "directory"].includes(first)) return null;
      } else {
        if (["groups", "events", "marketplace", "posts", "photos", "videos", "watch", "profile.php", "permalink.php", "story.php", "photo.php"].includes(first)) return null;
        if (parts.length !== 1) return null;
      }
    }
    // Keep only public stable post identifiers, never personal/contact query parameters.
    if (platform === "facebook" && ["permalink.php", "story.php", "photo.php", "profile.php"].includes(first)) {
      if (mode === "business") return null;
      const clean = new URL(`https://www.facebook.com/${first}`);
      for (const key of ["story_fbid", "id", "fbid", "v"]) {
        const value = url.searchParams.get(key);
        if (value && /^[\w-]{1,100}$/.test(value)) clean.searchParams.set(key, value);
      }
      if (![...clean.searchParams].length) return null;
      return clean.toString();
    }
    return `https://${host}${url.pathname.replace(/\/+$/, "")}`;
  } catch { return null; }
}

function relevantDemand(title: string, snippet: string): boolean {
  const text = `${title} ${snippet}`.toLowerCase();
  const needs = /\b(looking for|need(?:ing)?|seeking|hiring|wanted|searching for|require(?:d)?|recommend (?:a|me)|can anyone recommend|anyone know|looking to hire)\b|খুঁজছি|প্রয়োজন|দরকার|হায়ার|নিয়োগ/i;
  const skills = /\b(web\s*develop|website|web\s*design|wordpress|shopify|react|next\.?js|front.?end|full.?stack|e.?commerce|developer|programmer)\b|ওয়েব|ওয়েব|ডেভেলপার|ওয়েবসাইট|ওয়েবসাইট/i;
  const obviousAds = /\b(we offer|our services|we provide|hire us|book our service|apply now|course enrollment|training program)\b/i;
  return needs.test(text) && skills.test(text) && !(obviousAds.test(title) && !needs.test(title));
}

function relevantBusiness(title: string, snippet: string, category: string): boolean {
  const text = `${title} ${snippet}`;
  const junk = /\b(meta for business|facebook for business|small business week|restaurants? for sale|businesses? for sale|american express|amex|support local businesses|restaurant directory|best restaurants|top 10|industry news|how to|marketing tips)\b/i;
  if (junk.test(title)) return false;
  const patterns: Record<string, RegExp> = {
    "Restaurants & Cafes": /restaurant|cafe|café|coffee shop|bistro|eatery|bakery|রেস্টুরেন্ট|ক্যাফে/i,
    "Clothing & Fashion": /clothing|fashion|boutique|apparel|garment|dress|পোশাক|বুটিক/i,
    "Beauty Salons": /salon|beauty|spa|barber|hair studio|parlour|পার্লার|সেলুন/i,
    "Real Estate": /real estate|realtor|property|estate agent|প্রপার্টি|রিয়েল এস্টেট/i,
    Other: /business|shop|store|services|studio|company|boutique|local/i,
  };
  return patterns[category]?.test(text) ?? false;
}

export async function GET(request: Request) {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return NextResponse.json({ success: false, error: "TAVILY_API_KEY missing on server" }, { status: 500 });
  const params = new URL(request.url).searchParams;
  const mode = params.get("mode") ?? "demand";
  const platform = params.get("platform") ?? "both";
  const country = params.get("country") ?? "USA";
  const category = params.get("category") ?? "Restaurants & Cafes";
  const term = params.get("term") ?? "Web developer";
  const period = params.get("period") ?? "7";
  const invalid = [
    !["demand", "business"].includes(mode) && `mode=${mode}`,
    !["both", "facebook", "instagram"].includes(platform) && `platform=${platform}`,
    !COUNTRIES.includes(country as typeof COUNTRIES[number]) && `country=${country}`,
    mode === "business" && !CATEGORIES.includes(category as typeof CATEGORIES[number]) && `category=${category}`,
    mode === "demand" && !TERMS.includes(term as typeof TERMS[number]) && `term=${term}`,
    mode === "demand" && !["7", "30"].includes(period) && `period=${period}`,
  ].filter(Boolean);
  if (invalid.length) return NextResponse.json({ success: false, error: `Invalid filters: ${invalid.join(", ")}` }, { status: 400 });

  const selectedMode = mode as Mode;
  const platforms: Platform[] = platform === "both" ? ["facebook", "instagram"] : [platform as Platform];
  const leads = new Map<string, Lead>();
  const warnings: string[] = [];
  const diag = { requests: platforms.length, fetched: 0, validUrls: 0, irrelevantFiltered: 0, oldExcluded: 0, dateUnknown: 0, duplicates: 0, returned: 0 };
  const days = Number(period);
  const now = Date.now();
  const locationQuery: Record<string, string> = { USA: "United States", UK: "United Kingdom", Canada: "Canada", Bangladesh: "Bangladesh" };

  const tasks = platforms.map(async (p) => {
    const domain = p === "facebook" ? "facebook.com" : "instagram.com";
    const searchQuery = selectedMode === "demand"
      ? `site:${domain} "${term}" ("looking for" OR "need" OR "hiring" OR "seeking") ${locationQuery[country]}`
      : `site:${domain} "${category === "Other" ? "local business" : category}" "${locationQuery[country]}" (official OR shop OR restaurant OR salon OR boutique)`;
    try {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, search_depth: "basic", topic: "general", max_results: 15, include_domains: [domain], ...(selectedMode === "demand" ? { time_range: days === 7 ? "week" : "month" } : {}) }),
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(18000)]), cache: "no-store",
      });
      if (!response.ok) throw new Error(`Tavily HTTP ${response.status}: ${(await response.text()).slice(0, 150)}`);
      const json: { results?: TavilyItem[] } = await response.json();
      const results = Array.isArray(json.results) ? json.results : [];
      diag.fetched += results.length;
      for (const result of results) {
        const title = result.title?.trim(); const rawUrl = result.url?.trim();
        if (!title || !rawUrl) { diag.irrelevantFiltered++; continue; }
        const url = normalizeSocialUrl(rawUrl, p, selectedMode);
        if (!url) { diag.irrelevantFiltered++; continue; }
        diag.validUrls++;
        const snippet = typeof result.content === "string" ? result.content.slice(0, 700) : "";
        if (selectedMode === "demand" ? !relevantDemand(title, snippet) : !relevantBusiness(title, snippet, category)) { diag.irrelevantFiltered++; continue; }
        let reportedDate: string | null = null;
        let dateStatus: Lead["dateStatus"] = selectedMode === "business" ? "not_applicable" : "unknown";
        if (selectedMode === "demand") {
          const time = result.published_date ? Date.parse(result.published_date) : NaN;
          if (Number.isFinite(time)) {
            if (time > now + 86_400_000 || time < now - days * 86_400_000) { diag.oldExcluded++; continue; }
            reportedDate = result.published_date ?? null;
            dateStatus = "reported_recent";
          } else diag.dateUnknown++;
          // Exclude clearly historical titles, but don't misrepresent search-engine dates as verified post dates.
          if (/\b(201[0-9]|202[0-5])\b/.test(title)) { diag.oldExcluded++; continue; }
        }
        const id = `${selectedMode}:${url}`;
        if (leads.has(id)) { diag.duplicates++; continue; }
        leads.set(id, { id, title: title.slice(0, 220), url, platform: p, mode: selectedMode, country, category: selectedMode === "business" ? category : "", snippet, reportedDate, dateStatus });
      }
    } catch (error) { warnings.push(`${p}: ${error instanceof Error ? error.message : "Search error"}`); }
  });
  await Promise.all(tasks);
  const output = [...leads.values()].sort((a, b) => (a.dateStatus === "reported_recent" ? -1 : 0) - (b.dateStatus === "reported_recent" ? -1 : 0));
  diag.returned = output.length;
  return NextResponse.json({ success: warnings.length < platforms.length, leads: output, diagnostics: diag, warnings, note: "Search-engine candidates only. Hiring intentions, real post dates, business identity and locations require manual verification." });
}
