"use client";
import { useWorkspace } from "./WorkspaceState";
import LinkedInHiring from "./LinkedInHiring";

export default function LinkedInView(){
const { agencies, sharedAgencies } = useWorkspace();
return (<div id="linkedin-discovery" className="scroll-mt-24"><LinkedInHiring agencies={sharedAgencies} /></div>);
}
