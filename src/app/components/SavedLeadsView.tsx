"use client";

import { useEffect, useState } from "react";
import { useWorkspace } from "./WorkspaceState";

type Tab = "jobs" | "linkedin" | "agencies" | "socialPosts" | "socialPages";
type UnknownRecord = Record<string, unknown>;
type SocialLead = {
  id: string;
  title: string;
  url: string;
  platform: string;
  mode: "demand" | "business";
  country?: string;
  category?: string;
  snippet?: string;
  reportedDate?: string | null;
  dateStatus?: string;
  status?: string;
  notes?: string;
};
const SOCIAL_STORAGE_KEY = "ai-hunter-social-leads-v1";
function readSocialLeads(): SocialLead[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(SOCIAL_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is SocialLead => {
      const item = recordOf(value);
      return item !== null && typeof item.id === "string" && typeof item.url === "string" &&
        (item.mode === "demand" || item.mode === "business");
    });
  } catch { return []; }
}

type LinkedInLead = { key: string; title: string; company: string; description: string; url: string; sourceKey: string };

function recordOf(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord : null;
}
function stringOf(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }
function getField(item: UnknownRecord, fields: string[]): string {
  for (const field of fields) {
    const result = stringOf(item[field]);
    if (result) return result;
  }
  return "";
}
function extractCandidates(input: unknown): UnknownRecord[] {
  if (Array.isArray(input)) return input.map(recordOf).filter((x): x is UnknownRecord => x !== null);
  const obj = recordOf(input);
  if (!obj) return [];
  for (const field of ["savedPosts", "savedLeads", "savedJobs", "posts", "leads", "items", "results", "data"]) {
    if (Array.isArray(obj[field])) return extractCandidates(obj[field]);
  }
  // Some stores use an object keyed by post IDs.
  return Object.values(obj).map(recordOf).filter((x): x is UnknownRecord => x !== null);
}
function readLinkedInLeads(): LinkedInLead[] {
  if (typeof window === "undefined") return [];
  const found = new Map<string, LinkedInLead>();
  for (let index = 0; index < window.localStorage.length; index++) {
    const storageKey = window.localStorage.key(index);
    if (!storageKey || !/linkedin/i.test(storageKey) || !/(save|lead|job|post)/i.test(storageKey)) continue;
    try {
      const parsed: unknown = JSON.parse(window.localStorage.getItem(storageKey) || "null");
      for (const item of extractCandidates(parsed)) {
        const url = getField(item, ["url", "postUrl", "post_url", "linkedinUrl", "linkedin_url", "link", "originalUrl", "original_url"]);
        const title = getField(item, ["title", "jobTitle", "job_title", "headline", "position", "role"]);
        const company = getField(item, ["company", "companyName", "company_name", "author", "organization"]);
        const description = getField(item, ["description", "text", "content", "snippet", "body", "summary"]);
        const rawId = getField(item, ["id", "postId", "post_id", "urn"]);
        // Do not display miscellaneous unrelated stored records.
        if (!url && !rawId) continue;
        if (url && !/linkedin\.com/i.test(url) && !/linkedin/i.test(storageKey)) continue;
        const key = url || rawId;
        found.set(key, {
          key,
          title: title || "LinkedIn saved opportunity",
          company: company || "Company not specified",
          description,
          url,
          sourceKey: storageKey,
        });
      }
    } catch { /* Ignore malformed localStorage values. */ }
  }
  return Array.from(found.values());
}

export default function SavedLeadsView() {
  const { savedJobs, savedAgencies } = useWorkspace();
  const [tab, setTab] = useState<Tab>("jobs");
  const [linkedInLeads, setLinkedInLeads] = useState<LinkedInLead[]>([]);
  const [socialLeads, setSocialLeads] = useState<SocialLead[]>([]);
  const socialPosts = socialLeads.filter(lead => lead.mode === "demand");
  const socialPages = socialLeads.filter(lead => lead.mode === "business");

  useEffect(() => {
    const refresh = () => {
      setLinkedInLeads(readLinkedInLeads());
      setSocialLeads(readSocialLeads());
    };
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  return (
    <section className="space-y-6 text-white">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-400">Your Workspace</p>
        <h1 className="mt-2 text-3xl font-bold">Saved Leads</h1>
        <p className="mt-2 text-sm text-slate-400">All saved job opportunities, LinkedIn posts, social hiring posts, business pages and agencies.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {([
          { id: "jobs", label: "Saved Jobs", value: savedJobs.length, hint: "Jobicy · Arbeitnow · Remotive" },
          { id: "linkedin", label: "Saved LinkedIn Posts", value: linkedInLeads.length, hint: "LinkedIn hiring opportunities" },
          { id: "agencies", label: "Saved Agencies", value: savedAgencies.length, hint: "Prospective client agencies" },
          { id: "socialPosts", label: "Saved Social Media Posts", value: socialPosts.length, hint: "Facebook & Instagram hiring posts" },
          { id: "socialPages", label: "Saved Social Media Pages", value: socialPages.length, hint: "Facebook & Instagram business pages" },
        ] as const).map(card => (
          <button key={card.id} type="button" onClick={() => setTab(card.id)}
            className={`rounded-2xl border p-5 text-left transition hover:border-violet-400 ${tab === card.id ? "border-violet-500 bg-violet-950/25" : "border-[#263650] bg-[#101c32]"}`}>
            <p className="text-sm text-slate-300">{card.label}</p>
            <p className="mt-2 text-4xl font-bold">{card.value}</p>
            <p className="mt-3 text-xs text-slate-400">{card.hint}</p>
            <p className="mt-3 text-xs font-semibold text-violet-300">View saved items →</p>
          </button>
        ))}
      </div>

      {tab === "jobs" && <div className="space-y-4">
        <h2 className="text-xl font-bold">Saved Jobs ({savedJobs.length})</h2>
        {savedJobs.length === 0 ? <Empty message="No saved jobs yet. Save a job from Job Opportunities." /> :
          <div className="grid gap-4 xl:grid-cols-2">{savedJobs.map(job => <article key={job.id} className="rounded-2xl border border-[#263650] bg-[#101c32] p-5">
            <p className="text-xs text-violet-300">{job.source} · {job.location}</p>
            <h3 className="mt-2 text-lg font-bold">{job.title}</h3>
            <p className="mt-1 text-sm text-slate-300">{job.company}</p>
            <p className="mt-3 text-xs text-emerald-300">Match Score: {job.score}</p>
            <div className="mt-3 flex flex-wrap gap-2">{job.matchedSkills?.slice(0, 5).map(skill => <span key={skill} className="rounded-lg border border-slate-700 px-2 py-1 text-xs">{skill}</span>)}</div>
            {job.url && <a href={job.url} target="_blank" rel="noopener noreferrer" className="mt-5 inline-block rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold hover:bg-violet-500">View original job ↗</a>}
          </article>)}</div>}
      </div>}

      {tab === "linkedin" && <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold">Saved LinkedIn Posts ({linkedInLeads.length})</h2>
          <button type="button" onClick={() => setLinkedInLeads(readLinkedInLeads())} className="rounded-lg border border-slate-600 px-3 py-2 text-sm hover:border-violet-400">Refresh saved posts</button>
        </div>
        {linkedInLeads.length === 0 ? <Empty message="No LinkedIn saved posts were found in the browser's LinkedIn-related localStorage. If LinkedIn Discovery shows saved items, its storage key or data structure needs to be matched." /> :
          <div className="grid gap-4 xl:grid-cols-2">{linkedInLeads.map(lead => <article key={lead.key} className="min-w-0 rounded-2xl border border-[#263650] bg-[#101c32] p-5">
            <p className="text-xs font-semibold text-sky-300">LinkedIn · Saved post</p>
            <h3 className="mt-2 break-words text-lg font-bold">{lead.title}</h3>
            <p className="mt-1 text-sm text-slate-300">{lead.company}</p>
            {lead.description && <p className="mt-3 line-clamp-5 break-words text-sm leading-6 text-slate-400">{lead.description}</p>}
            {lead.url && <a href={lead.url} target="_blank" rel="noopener noreferrer" className="mt-5 inline-block rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold hover:bg-sky-600">Open LinkedIn post ↗</a>}
          </article>)}</div>}
      </div>}

      {(tab === "socialPosts" || tab === "socialPages") && <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold">{tab === "socialPosts" ? "Saved Social Media Posts" : "Saved Social Media Pages"} ({tab === "socialPosts" ? socialPosts.length : socialPages.length})</h2>
          <button type="button" onClick={() => setSocialLeads(readSocialLeads())} className="rounded-lg border border-slate-600 px-3 py-2 text-sm hover:border-violet-400">Refresh saved social leads</button>
        </div>
        {(tab === "socialPosts" ? socialPosts : socialPages).length === 0 ?
          <Empty message={`No saved social media ${tab === "socialPosts" ? "posts" : "pages"} found. Save them from Social Discovery first.`} /> :
          <div className="grid gap-4 xl:grid-cols-2">
            {(tab === "socialPosts" ? socialPosts : socialPages).map(lead => <article key={lead.id} className="min-w-0 rounded-2xl border border-[#263650] bg-[#101c32] p-5">
              <p className="text-xs font-semibold uppercase text-cyan-300">{lead.platform} · {lead.mode === "business" ? "Business page" : "Hiring post"}</p>
              <h3 className="mt-2 break-words text-lg font-bold">{lead.title || "Untitled saved lead"}</h3>
              <p className="mt-2 text-xs text-slate-400">{[lead.country, lead.category].filter(Boolean).join(" · ")}</p>
              {lead.snippet && <p className="mt-3 line-clamp-5 break-words text-sm leading-6 text-slate-300">{lead.snippet}</p>}
              {lead.status && <p className="mt-3 text-xs text-violet-300">Status: {lead.status}</p>}
              {lead.notes && <p className="mt-2 break-words text-xs text-slate-400">Notes: {lead.notes}</p>}
              {lead.mode === "demand" && <p className="mt-3 text-xs text-amber-300">Post date and hiring intent should be verified on the original platform.</p>}
              {lead.mode === "business" && <p className="mt-3 text-xs text-amber-300">Business activity and website status are not independently verified.</p>}
              <a href={lead.url} target="_blank" rel="noopener noreferrer" className="mt-5 inline-block rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold hover:bg-cyan-600">Open original {lead.mode === "business" ? "page" : "post"} ↗</a>
            </article>)}
          </div>}
      </div>}

      {tab === "agencies" && <div className="space-y-4">
        <h2 className="text-xl font-bold">Saved Agencies ({savedAgencies.length})</h2>
        {savedAgencies.length === 0 ? <Empty message="No saved agencies yet." /> :
          <div className="grid gap-4 xl:grid-cols-2">{savedAgencies.map((agency, index) => <article key={agency.slug || agency.website || index} className="rounded-2xl border border-[#263650] bg-[#101c32] p-5">
            <h3 className="text-lg font-bold">{agency.name || "Unnamed Agency"}</h3>
            <p className="mt-2 text-sm text-slate-400">{typeof agency.location === "string" ? agency.location : [agency.location?.city, agency.location?.country].filter(Boolean).join(", ") || "Location not specified"}</p>
            {agency.tagline && <p className="mt-3 text-sm text-slate-300">{agency.tagline}</p>}
            <div className="mt-4 flex flex-wrap gap-2">{agency.website && <a href={agency.website} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-violet-600 px-4 py-2 text-sm">Website ↗</a>}{agency.profile_url && <a href={agency.profile_url} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-slate-600 px-4 py-2 text-sm">Source ↗</a>}</div>
          </article>)}</div>}
      </div>}
    </section>
  );
}

function Empty({ message }: { message: string }) {
  return <div className="rounded-2xl border border-[#263650] bg-[#101c32] p-8 text-center text-sm text-slate-400">{message}</div>;
}
