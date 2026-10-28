"use client";
import DashboardShell from "./DashboardShell";
import OverviewView from "./OverviewView";
import JobsView from "./JobsView";
import AgenciesView from "./AgenciesView";
import LinkedInView from "./LinkedInView";
import SocialView from "./SocialView";
import SavedLeadsView from "./SavedLeadsView";
export type WorkspaceView = "overview" | "jobs" | "agencies" | "linkedin" | "social" | "saved";
export default function ClientWorkspace({view}:{view:WorkspaceView}){return <DashboardShell>{view === "overview" ? <OverviewView /> : view === "jobs" ? <JobsView /> : view === "agencies" ? <AgenciesView /> : view === "linkedin" ? <LinkedInView /> : view === "social" ? <SocialView /> : view === "saved" ? <SavedLeadsView /> : null}</DashboardShell>;}
