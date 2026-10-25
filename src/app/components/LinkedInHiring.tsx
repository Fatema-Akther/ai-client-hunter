
"use client";

import { useEffect, useState } from "react";

type Agency = {
  name?: string;
  website?: string;
};

type LinkedInLead = {
  title: string;
  url: string;
  publishedAt: string | null;
  freshness?: "recent" | "date_unknown";
};

type SavedLead = LinkedInLead & {
  agencyKey: string;
};

type SearchResponse = {
  success: boolean;
  posts?: LinkedInLead[];
  warnings?: string[];
  error?: string;
  diagnostics?: {
  fetched: number;
  validLinkedInPosts: number;
  recent: number;
  dateUnknown: number;
  oldFiltered: number;
  invalidFiltered: number;
};
};

const STORAGE_KEY = "ai-hunter-linkedin-leads";

function agencyKey(agency: Agency): string {
  if (!agency.website) return "";

  try {
    const url = new URL(
      /^https?:\/\//i.test(agency.website)
        ? agency.website
        : `https://${agency.website}`
    );

    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

export default function LinkedInHiring({
  agencies,
}: {
  agencies: Agency[];
}) {
  const [keyword, setKeyword] = useState(
    "React Next.js developer"
  );

  const [posts, setPosts] = useState<LinkedInLead[]>([]);
  const [diagnostics, setDiagnostics] = useState<{
  fetched: number;
  validLinkedInPosts: number;
  recent: number;
  dateUnknown: number;
  oldFiltered: number;
  invalidFiltered: number;
} | null>(null);
  const [saved, setSaved] = useState<SavedLead[]>([]);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    try {
      const value = localStorage.getItem(STORAGE_KEY);

      if (value) {
        const parsed: unknown = JSON.parse(value);

        if (Array.isArray(parsed)) {
          setSaved(parsed as SavedLead[]);
        }
      }
    } catch {
      console.error("Could not load LinkedIn leads");
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch {
      console.error("Could not save LinkedIn leads");
    }
  }, [saved, ready]);

  async function searchPosts() {
    if (loading || !keyword.trim()) return;

    setLoading(true);
    setError("");
    setWarnings([]);
    setSavedOnly(false);

    try {
      const response = await fetch(
        `/api/linkedin-hiring?q=${encodeURIComponent(keyword)}`,
        { cache: "no-store" }
      );

      const data: SearchResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
          data.warnings?.join("; ") ||
          "Search failed"
        );
      }

      setPosts(data.posts ?? []);
      setWarnings(data.warnings ?? []);
      setDiagnostics(data.diagnostics ?? null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Search failed"
      );
    } finally {
      setLoading(false);
    }
  }

  function saveLead(post: LinkedInLead) {
    setSaved((current) => {
      if (current.some((item) => item.url === post.url)) {
        return current;
      }

      return [...current, { ...post, agencyKey: "" }];
    });
  }

  function removeLead(url: string) {
    setSaved((current) =>
      current.filter((item) => item.url !== url)
    );
  }

  function matchAgency(url: string, key: string) {
    setSaved((current) =>
      current.map((item) =>
        item.url === url
          ? { ...item, agencyKey: key }
          : item
      )
    );
  }

  const visible = savedOnly ? saved : posts;

  return (
    <section className="mt-12 border-t border-slate-800 pt-8">
      <h2 className="text-2xl font-bold">
        LinkedIn Hiring Discovery
      </h2>

      <p className="mt-2 text-sm text-slate-400">
        Find publicly indexed LinkedIn post links.
        Review each post manually before treating it
        as a hiring or client opportunity.
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        <input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") searchPosts();
          }}
          placeholder="React developer, freelance..."
          className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white"
        />

        <button
          onClick={searchPosts}
          disabled={loading || !keyword.trim()}
          className="rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 disabled:opacity-40"
        >
          {loading ? "Searching..." : "Search LinkedIn Posts"}
        </button>
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-400">{error}</p>
      )}

      {warnings.length > 0 && (
        <p className="mt-3 text-sm text-amber-300">
          {warnings.length} search request warning(s).
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          onClick={() => setSavedOnly(false)}
          className={`rounded-xl px-4 py-2 text-sm ${
            !savedOnly
              ? "bg-cyan-400 text-slate-950"
              : "border border-slate-700"
          }`}
        >
          All Posts ({posts.length})
        </button>

        <button
          onClick={() => setSavedOnly(true)}
          className={`rounded-xl px-4 py-2 text-sm ${
            savedOnly
              ? "bg-cyan-400 text-slate-950"
              : "border border-slate-700"
          }`}
        >
          Saved Leads ({saved.length})
        </button>
      </div>

      
{diagnostics && (
  <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900 p-4">
    <p className="font-semibold text-cyan-300">
      LinkedIn Search Diagnostics
    </p>

    <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
      <p>Fetched: {diagnostics.fetched}</p>
      <p>Valid posts: {diagnostics.validLinkedInPosts}</p>
      <p className="text-green-400">
        Reported recent: {diagnostics.recent}
      </p>
      <p className="text-amber-300">
        Date unknown: {diagnostics.dateUnknown}
      </p>
      <p>Old filtered: {diagnostics.oldFiltered}</p>
      <p>Other filtered: {diagnostics.invalidFiltered}</p>
    </div>
  </div>
)}


      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {visible.map((post) => {
          const savedLead = saved.find(
            (item) => item.url === post.url
          );

          return (
            <article
              key={post.url}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
            >
             

<h3 className="font-semibold">
  {post.title}
</h3>

{post.publishedAt && (
  <p className="mt-2 text-xs text-green-400">
    Reported publication date:{" "}
    {new Date(post.publishedAt).toLocaleDateString()}
  </p>
)}

<p className="mt-2 text-xs text-amber-300">
  Unverified public search result
</p>

              <p className="mt-2 text-xs text-amber-300">
                Unverified public search result
              </p>

              <div className="mt-4 flex flex-wrap gap-3">
                <a
                  href={post.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950"
                >
                  View Original Post ↗
                </a>

                {savedLead ? (
                  <button
                    onClick={() => removeLead(post.url)}
                    className="rounded-lg border border-amber-500 px-4 py-2 text-sm text-amber-300"
                  >
                    Remove Saved
                  </button>
                ) : (
                  <button
                    onClick={() => saveLead(post)}
                    className="rounded-lg border border-green-500 px-4 py-2 text-sm text-green-300"
                  >
                    Save Lead
                  </button>
                )}
              </div>




              {savedLead && (
                <div className="mt-4 rounded-xl border border-slate-700 p-3">
                  <p className="text-sm text-slate-300">
                    Match with Agency
                  </p>

                  <select
                    value={savedLead.agencyKey}
                    onChange={(event) =>
                      matchAgency(
                        post.url,
                        event.target.value
                      )
                    }
                    className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                  >
                    <option value="">
                      No agency matched
                    </option>

                    {agencies.map((agency) => {
                      const key = agencyKey(agency);
                      if (!key) return null;

                      return (
                        <option key={key} value={key}>
                          {agency.name || key}
                        </option>
                      );
                    })}
                  </select>

                  <p className="mt-2 text-xs text-slate-400">
                    Match manually after verifying
                    the company on LinkedIn.
                  </p>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {visible.length === 0 && (
        <p className="mt-5 rounded-xl border border-dashed border-slate-700 p-6 text-center text-slate-400">
          {savedOnly
            ? "No saved LinkedIn leads."
            : "No posts loaded. Search to find public links."}
        </p>
      )}



      <div>React developer
Next.js developer
freelance web developer
web development partner
Shopify developer</div>
    </section>
  );
}
