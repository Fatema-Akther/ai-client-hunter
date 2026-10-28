"use client";
import { useWorkspace } from "./WorkspaceState";
import SocialDiscovery from "./SocialDiscovery";

export default function SocialView(){
const { agencies, sharedAgencies } = useWorkspace();
return (<div id="social-discovery" className="scroll-mt-24"><SocialDiscovery agencies={sharedAgencies} /></div>);
}
