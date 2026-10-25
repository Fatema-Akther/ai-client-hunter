
import { NextResponse } from "next/server";

type SearchResult = {
  title?: string;
  url?: string;
  published_date?: string;
};

type Lead = {
  title: string;
  url: string;
  publishedAt: string | null;
  freshness: "recent" | "date_unknown";
};

export async function GET(request: Request) {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: "Tavily API key missing" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);

  const keyword = (
    searchParams.get("q") || ""
  ).trim().slice(0, 100);

  if (!keyword) {
    return NextResponse.json(
      { success: false, error: "Enter search keywords" },
      { status: 400 }
    );
  }

  const queries = [
    `site:linkedin.com/posts/ ${keyword} hiring`,
    `site:linkedin.com/posts/ ${keyword} freelance contract`,
  ];

  const leads = new Map<string, Lead>();
  const warnings: string[] = [];

  const diagnostics = {
    fetched: 0,
    validLinkedInPosts: 0,
    recent: 0,
    dateUnknown: 0,
    oldFiltered: 0,
    invalidFiltered: 0,
  };

  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;

  for (const query of queries) {
    try {
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
            time_range: "week",
            include_domains: ["linkedin.com"],
          }),
          signal: AbortSignal.timeout(20000),
          cache: "no-store",
        }
      );

      if (!response.ok) {
        const detail = await response.text();

        throw new Error(
          `Tavily HTTP ${response.status}: ${detail.slice(0, 200)}`
        );
      }

      const data: {
        results?: SearchResult[];
      } = await response.json();

      const results = data.results ?? [];

      diagnostics.fetched += results.length;

      for (const item of results) {
        if (!item.title || !item.url) {
          diagnostics.invalidFiltered++;
          continue;
        }

        try {
          const url = new URL(item.url);
          const host = url.hostname.toLowerCase();

          if (
            !["linkedin.com", "www.linkedin.com"].includes(host)
          ) {
            diagnostics.invalidFiltered++;
            continue;
          }

          const path = url.pathname;

          if (
            !path.startsWith("/posts/") &&
            !path.startsWith("/feed/update/")
          ) {
            diagnostics.invalidFiltered++;
            continue;
          }

          diagnostics.validLinkedInPosts++;

          const publishedAt = item.published_date || null;

          let freshness: Lead["freshness"] = "date_unknown";

          if (publishedAt) {
            const publishedTime = new Date(publishedAt).getTime();

            if (Number.isFinite(publishedTime)) {
              if (
                publishedTime < now - sevenDays ||
                publishedTime > now
              ) {
                diagnostics.oldFiltered++;
                continue;
              }

              freshness = "recent";
            }
          }

          const cleanUrl = url.origin + url.pathname;

          leads.set(cleanUrl, {
            title: item.title.slice(0, 220),
            url: cleanUrl,
            publishedAt,
            freshness,
          });
        } catch {
          diagnostics.invalidFiltered++;
        }
      }
    } catch (error) {
      warnings.push(
        error instanceof Error
          ? error.message
          : "Search request failed"
      );
    }
  }

  const posts = [...leads.values()];

  diagnostics.recent = posts.filter(
    (post) => post.freshness === "recent"
  ).length;

  diagnostics.dateUnknown = posts.filter(
    (post) => post.freshness === "date_unknown"
  ).length;

  posts.sort((a, b) => {
    if (a.freshness === "recent" && b.freshness !== "recent") {
      return -1;
    }

    if (b.freshness === "recent" && a.freshness !== "recent") {
      return 1;
    }

    return 0;
  });

  return NextResponse.json({
    success: warnings.length < queries.length,
    totalFound: posts.length,
    posts,
    diagnostics,
    warnings,
    note:
      "Date unknown results require manual verification. " +
      "Search date filters do not guarantee actual post age.",
  });
}
