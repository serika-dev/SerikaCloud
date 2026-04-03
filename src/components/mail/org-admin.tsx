"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Building2, Users, Globe, UserPlus, Shield, Crown, User,
  ChevronLeft, Plus, X, Loader2, Check, Copy, AlertTriangle,
  RefreshCw, Trash2, Settings, Mail, ExternalLink, CheckCircle2,
  XCircle, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface OrgMember {
  id: string;
  userId: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  title: string | null;
  joinedAt: string;
  user: { id: string; name: string; email: string };
}

interface OrgDomain {
  id: string;
  domain: string;
  status: string;
  verificationKey: string;
  mxVerified: boolean;
  spfVerified: boolean;
  dkimVerified: boolean;
  dmarcVerified: boolean;
  lastCheckedAt: string | null;
  verifiedAt: string | null;
}

interface UserGroup {
  id: string;
  name: string;
  description: string | null;
  color: string;
  members: { id: string; user: { id: string; name: string; email: string } }[];
  mailbox: { id: string; address: string; displayName: string | null } | null;
  _count: { members: number };
}

interface OrgInvite {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  invitedBy: { name: string; email: string };
}

interface GroupMailbox {
  id: string;
  address: string;
  displayName: string | null;
  groupId: string | null;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  avatarUrl: string | null;
  members: OrgMember[];
  domains: OrgDomain[];
  groups: UserGroup[];
  groupMailboxes: GroupMailbox[];
  _count: { tickets: number };
}

interface OrgAdminProps {
  orgId: string;
  onBack: () => void;
}

type Tab = "overview" | "members" | "domains" | "groups" | "mailboxes";

const ROLE_ICONS = { OWNER: Crown, ADMIN: Shield, MEMBER: User };
const ROLE_COLORS = {
  OWNER: "text-amber-500",
  ADMIN: "text-purple-500",
  MEMBER: "text-zinc-400",
};

export function OrgAdmin({ orgId, onBack }: OrgAdminProps) {
  const [org, setOrg] = useState<Organization | null>(null);
  const [myRole, setMyRole] = useState<string>("MEMBER");
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);

  const fetchOrg = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/org/${orgId}`);
      if (res.ok) {
        const data = await res.json();
        setOrg(data.organization);
        setMyRole(data.membership.role);
      }
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { fetchOrg(); }, [fetchOrg]);

  if (loading || !org) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
      </div>
    );
  }

  const isAdmin = myRole === "OWNER" || myRole === "ADMIN";

  const tabs: { id: Tab; label: string; icon: React.ElementType; count?: number }[] = [
    { id: "overview", label: "Overview", icon: Building2 },
    { id: "members", label: "Members", icon: Users, count: org.members.length },
    { id: "domains", label: "Domains", icon: Globe, count: org.domains.length },
    { id: "groups", label: "Groups", icon: Users, count: org.groups.length },
    { id: "mailboxes", label: "Group Mail", icon: Mail, count: org.groupMailboxes.length },
  ];

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-200 dark:border-[#1a1a1a]">
        <Button variant="ghost" size="icon-sm" onClick={onBack}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Building2 className="h-5 w-5 text-purple-500" />
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold truncate">{org.name}</h2>
          <p className="text-xs text-muted-foreground">{org.slug} &middot; {org.members.length} members</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-zinc-100 dark:border-[#111] overflow-x-auto">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                tab === t.id
                  ? "bg-purple-100 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400"
                  : "text-muted-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
              {t.count !== undefined && (
                <span className="ml-1 text-[10px] bg-zinc-200 dark:bg-zinc-700 px-1.5 rounded-full">
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 max-w-3xl">
        {tab === "overview" && <OverviewTab org={org} isAdmin={isAdmin} onRefresh={fetchOrg} />}
        {tab === "members" && <MembersTab org={org} isAdmin={isAdmin} myRole={myRole} onRefresh={fetchOrg} />}
        {tab === "domains" && <DomainsTab org={org} isAdmin={isAdmin} onRefresh={fetchOrg} />}
        {tab === "groups" && <GroupsTab org={org} isAdmin={isAdmin} onRefresh={fetchOrg} />}
        {tab === "mailboxes" && <MailboxesTab org={org} isAdmin={isAdmin} onRefresh={fetchOrg} />}
      </div>
    </div>
  );
}

// ─── Overview Tab ────────────────────────────────────────────────────────────

function OverviewTab({ org, isAdmin, onRefresh }: { org: Organization; isAdmin: boolean; onRefresh: () => void }) {
  const [name, setName] = useState(org.name);
  const [desc, setDesc] = useState(org.description || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/org", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: org.id, name, description: desc }),
      });
      if (res.ok) { toast.success("Saved"); onRefresh(); }
      else toast.error("Failed to save");
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-sm font-bold mb-3">Organization Details</h3>
        <div className="rounded-xl border border-zinc-200 dark:border-[#1a1a1a] bg-zinc-50 dark:bg-[#0d0d0d] p-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!isAdmin} className="h-9" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Slug</label>
            <Input value={org.slug} disabled className="h-9 font-mono text-sm opacity-60" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} disabled={!isAdmin} placeholder="What does this organization do?" className="h-9" />
          </div>
          {isAdmin && (
            <Button onClick={save} disabled={saving} size="sm" className="bg-purple-600 hover:bg-purple-700 text-white">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Save Changes
            </Button>
          )}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-bold mb-3">Quick Stats</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Members", value: org.members.length, icon: Users },
            { label: "Domains", value: org.domains.length, icon: Globe },
            { label: "Groups", value: org.groups.length, icon: Users },
            { label: "Tickets", value: org._count.tickets, icon: AlertTriangle },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-zinc-200 dark:border-[#1a1a1a] bg-zinc-50 dark:bg-[#0d0d0d] p-3 text-center">
              <s.icon className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
              <p className="text-xl font-bold">{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ─── Members Tab ─────────────────────────────────────────────────────────────

function MembersTab({ org, isAdmin, myRole, onRefresh }: { org: Organization; isAdmin: boolean; myRole: string; onRefresh: () => void }) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"MEMBER" | "ADMIN">("MEMBER");
  const [inviting, setInviting] = useState(false);
  const [invites, setInvites] = useState<OrgInvite[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(true);

  useEffect(() => {
    if (!isAdmin) { setLoadingInvites(false); return; }
    fetch(`/api/org/${org.id}/invites`)
      .then((r) => r.json())
      .then((d) => setInvites(d.invites || []))
      .finally(() => setLoadingInvites(false));
  }, [org.id, isAdmin]);

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const res = await fetch(`/api/org/${org.id}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      if (res.ok) {
        const data = await res.json();
        setInvites((prev) => [data.invite, ...prev]);
        setInviteEmail("");
        toast.success("Invite sent!");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to invite");
      }
    } finally { setInviting(false); }
  };

  const removeMember = async (memberId: string) => {
    const res = await fetch(`/api/org/${org.id}/members?memberId=${memberId}`, { method: "DELETE" });
    if (res.ok) { toast.success("Member removed"); onRefresh(); }
    else toast.error("Failed to remove");
  };

  const revokeInvite = async (inviteId: string) => {
    await fetch(`/api/org/${org.id}/invites?inviteId=${inviteId}`, { method: "DELETE" });
    setInvites((prev) => prev.filter((i) => i.id !== inviteId));
    toast.success("Invite revoked");
  };

  return (
    <div className="space-y-6">
      {/* Invite */}
      {isAdmin && (
        <section>
          <h3 className="text-sm font-bold mb-3">Invite Members</h3>
          <div className="flex items-center gap-2">
            <Input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="email@example.com"
              className="h-9 flex-1"
              onKeyDown={(e) => { if (e.key === "Enter") sendInvite(); }}
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as any)}
              className="h-9 rounded-lg border border-zinc-200 dark:border-[#1a1a1a] bg-white dark:bg-[#111] text-sm px-2"
            >
              <option value="MEMBER">Member</option>
              {myRole === "OWNER" && <option value="ADMIN">Admin</option>}
            </select>
            <Button onClick={sendInvite} disabled={inviting} size="sm" className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white h-9">
              {inviting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
              Invite
            </Button>
          </div>
        </section>
      )}

      {/* Pending Invites */}
      {isAdmin && invites.length > 0 && (
        <section>
          <h3 className="text-sm font-bold mb-2">Pending Invites</h3>
          <div className="space-y-1.5">
            {invites.map((invite) => (
              <div key={invite.id} className="flex items-center justify-between rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 px-3 py-2">
                <div>
                  <span className="text-sm font-mono">{invite.email}</span>
                  <span className="text-[10px] ml-2 px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-muted-foreground">{invite.role}</span>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => revokeInvite(invite.id)} className="text-red-500 hover:text-red-400 hover:bg-red-500/10">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Member List */}
      <section>
        <h3 className="text-sm font-bold mb-3">Members ({org.members.length})</h3>
        <div className="space-y-1.5">
          {org.members.map((m) => {
            const RoleIcon = ROLE_ICONS[m.role];
            return (
              <div key={m.id} className="flex items-center gap-3 rounded-lg border border-zinc-200 dark:border-[#1a1a1a] bg-white dark:bg-[#111] px-4 py-3">
                <div className="h-9 w-9 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 font-bold text-sm shrink-0">
                  {m.user.name?.[0]?.toUpperCase() || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold truncate">{m.user.name}</span>
                    <RoleIcon className={`h-3.5 w-3.5 ${ROLE_COLORS[m.role]}`} />
                    <span className="text-[10px] text-muted-foreground">{m.role}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{m.user.email}</p>
                  {m.title && <p className="text-[10px] text-purple-500">{m.title}</p>}
                </div>
                {isAdmin && m.role !== "OWNER" && (
                  <Button variant="ghost" size="icon-sm" onClick={() => removeMember(m.id)} className="text-red-500/60 hover:text-red-500 hover:bg-red-500/10">
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// ─── Domains Tab ─────────────────────────────────────────────────────────────

function DomainsTab({ org, isAdmin, onRefresh }: { org: Organization; isAdmin: boolean; onRefresh: () => void }) {
  const [newDomain, setNewDomain] = useState("");
  const [adding, setAdding] = useState(false);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [dnsRecords, setDnsRecords] = useState<any[] | null>(null);
  const [showDnsFor, setShowDnsFor] = useState<string | null>(null);

  const addDomain = async () => {
    if (!newDomain.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/org/${org.id}/domains`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: newDomain.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setDnsRecords(data.dnsRecords);
        setShowDnsFor(data.domain.id);
        setNewDomain("");
        toast.success("Domain added! Configure DNS records below.");
        onRefresh();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to add domain");
      }
    } finally { setAdding(false); }
  };

  const verifyDomain = async (domainId: string) => {
    setVerifying(domainId);
    try {
      const res = await fetch(`/api/org/${org.id}/domains`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainId }),
      });
      if (res.ok) {
        const data = await res.json();
        setDnsRecords(data.dnsRecords);
        setShowDnsFor(domainId);
        toast.success(`Verification: ${data.domain.status}`);
        onRefresh();
      }
    } finally { setVerifying(null); }
  };

  const removeDomain = async (domainId: string) => {
    await fetch(`/api/org/${org.id}/domains?domainId=${domainId}`, { method: "DELETE" });
    toast.success("Domain removed");
    onRefresh();
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "ACTIVE": return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
      case "VERIFIED": return <Check className="h-3.5 w-3.5 text-blue-500" />;
      case "PENDING": return <Clock className="h-3.5 w-3.5 text-amber-500" />;
      case "FAILED": return <XCircle className="h-3.5 w-3.5 text-red-500" />;
      default: return <Clock className="h-3.5 w-3.5 text-zinc-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {isAdmin && (
        <section>
          <h3 className="text-sm font-bold mb-2">Add Custom Domain</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Use your own domain for org email addresses (e.g. @yourcompany.com)
          </p>
          <div className="flex items-center gap-2">
            <Input
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value.toLowerCase())}
              placeholder="yourcompany.com"
              className="h-9 flex-1 font-mono"
              onKeyDown={(e) => { if (e.key === "Enter") addDomain(); }}
            />
            <Button onClick={addDomain} disabled={adding} size="sm" className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white h-9">
              {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Add Domain
            </Button>
          </div>
        </section>
      )}

      <section>
        <h3 className="text-sm font-bold mb-3">Domains ({org.domains.length})</h3>
        {org.domains.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-6 text-center">
            <Globe className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">No custom domains yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {org.domains.map((d) => (
              <div key={d.id} className="rounded-xl border border-zinc-200 dark:border-[#1a1a1a] bg-white dark:bg-[#111] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    {statusIcon(d.status)}
                    <span className="text-sm font-mono font-semibold">{d.domain}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      d.status === "ACTIVE" ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600" :
                      d.status === "VERIFIED" ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600" :
                      "bg-amber-100 dark:bg-amber-900/30 text-amber-600"
                    }`}>{d.status}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost" size="icon-sm"
                      onClick={() => verifyDomain(d.id)}
                      disabled={verifying === d.id}
                      className="text-purple-500"
                    >
                      {verifying === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      variant="ghost" size="icon-sm"
                      onClick={() => setShowDnsFor(showDnsFor === d.id ? null : d.id)}
                    >
                      <Settings className="h-3.5 w-3.5" />
                    </Button>
                    {isAdmin && (
                      <Button variant="ghost" size="icon-sm" onClick={() => removeDomain(d.id)} className="text-red-500/60 hover:text-red-500">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* DNS verification status */}
                <div className="flex items-center gap-3 px-4 py-2 border-t border-zinc-100 dark:border-[#1a1a1a] bg-zinc-50/50 dark:bg-[#0a0a0a]/50">
                  {[
                    { label: "MX", ok: d.mxVerified },
                    { label: "SPF", ok: d.spfVerified },
                    { label: "DKIM", ok: d.dkimVerified },
                    { label: "DMARC", ok: d.dmarcVerified },
                  ].map((check) => (
                    <span key={check.label} className={`text-[10px] font-medium flex items-center gap-1 ${check.ok ? "text-emerald-500" : "text-zinc-400"}`}>
                      {check.ok ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
                      {check.label}
                    </span>
                  ))}
                </div>

                {/* DNS records */}
                {showDnsFor === d.id && dnsRecords && (
                  <div className="border-t border-zinc-100 dark:border-[#1a1a1a] p-4 space-y-3">
                    <p className="text-xs font-bold text-muted-foreground">Required DNS Records</p>
                    {dnsRecords.map((rec, i) => (
                      <div key={i} className="rounded-lg bg-zinc-100 dark:bg-[#0a0a0a] p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-purple-500">{rec.type} Record</span>
                          <button
                            onClick={() => { navigator.clipboard.writeText(rec.value); toast.success("Copied!"); }}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                        <p className="text-[10px] text-muted-foreground">{rec.purpose}</p>
                        <p className="text-xs font-mono break-all">Host: <span className="text-foreground">{rec.host}</span></p>
                        <p className="text-xs font-mono break-all">Value: <span className="text-foreground">{rec.value}</span></p>
                        {rec.priority !== undefined && (
                          <p className="text-xs font-mono">Priority: <span className="text-foreground">{rec.priority}</span></p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Groups Tab ──────────────────────────────────────────────────────────────

function GroupsTab({ org, isAdmin, onRefresh }: { org: Organization; isAdmin: boolean; onRefresh: () => void }) {
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  const createGroup = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/org/${org.id}/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || null }),
      });
      if (res.ok) {
        setNewName(""); setNewDesc("");
        toast.success("Group created!");
        onRefresh();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to create");
      }
    } finally { setCreating(false); }
  };

  const deleteGroup = async (groupId: string) => {
    await fetch(`/api/org/${org.id}/groups?groupId=${groupId}`, { method: "DELETE" });
    toast.success("Group deleted");
    onRefresh();
  };

  return (
    <div className="space-y-6">
      {isAdmin && (
        <section>
          <h3 className="text-sm font-bold mb-2">Create Group</h3>
          <div className="space-y-2">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Group name (e.g. Engineering)" className="h-9" />
            <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Description (optional)" className="h-9" />
            <Button onClick={createGroup} disabled={creating || !newName.trim()} size="sm" className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white">
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Create Group
            </Button>
          </div>
        </section>
      )}

      <section>
        <h3 className="text-sm font-bold mb-3">Groups ({org.groups.length})</h3>
        {org.groups.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-6 text-center">
            <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">No groups yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {org.groups.map((g) => (
              <div key={g.id} className="rounded-xl border border-zinc-200 dark:border-[#1a1a1a] bg-white dark:bg-[#111] px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: g.color }}>
                      {g.name[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{g.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {g._count.members} members
                        {g.mailbox && <span className="ml-1 text-purple-500"> &middot; {g.mailbox.address}</span>}
                      </p>
                    </div>
                  </div>
                  {isAdmin && (
                    <Button variant="ghost" size="icon-sm" onClick={() => deleteGroup(g.id)} className="text-red-500/60 hover:text-red-500">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                {g.description && (
                  <p className="text-xs text-muted-foreground mt-1.5 pl-[42px]">{g.description}</p>
                )}
                {g.members.length > 0 && (
                  <div className="flex items-center gap-1 mt-2 pl-[42px] flex-wrap">
                    {g.members.slice(0, 8).map((m) => (
                      <span key={m.id} className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-muted-foreground">
                        {m.user.name}
                      </span>
                    ))}
                    {g.members.length > 8 && (
                      <span className="text-[10px] text-muted-foreground">+{g.members.length - 8} more</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Group Mailboxes Tab ─────────────────────────────────────────────────────

function MailboxesTab({ org, isAdmin, onRefresh }: { org: Organization; isAdmin: boolean; onRefresh: () => void }) {
  const [address, setAddress] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [groupId, setGroupId] = useState("");
  const [creating, setCreating] = useState(false);

  const createMailbox = async () => {
    if (!address.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/org/${org.id}/group-mail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: address.trim(),
          displayName: displayName.trim() || null,
          groupId: groupId || null,
        }),
      });
      if (res.ok) {
        setAddress(""); setDisplayName(""); setGroupId("");
        toast.success("Group mailbox created!");
        onRefresh();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to create");
      }
    } finally { setCreating(false); }
  };

  const deleteMailbox = async (mailboxId: string) => {
    await fetch(`/api/org/${org.id}/group-mail?mailboxId=${mailboxId}`, { method: "DELETE" });
    toast.success("Group mailbox deleted");
    onRefresh();
  };

  // Get available domains for the address hint
  const activeDomains = org.domains.filter((d) => d.status === "ACTIVE").map((d) => d.domain);
  const MAIL_DOMAIN = "serika.pro";

  return (
    <div className="space-y-6">
      {isAdmin && (
        <section>
          <h3 className="text-sm font-bold mb-2">Create Group Mailbox</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Shared mailboxes like support@, info@, sales@ — all org members in the linked group can access them.
          </p>
          <div className="space-y-2">
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value.toLowerCase())}
              placeholder={`support@${activeDomains[0] || MAIL_DOMAIN}`}
              className="h-9 font-mono"
            />
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Display name (e.g. Support Team)"
              className="h-9"
            />
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="w-full h-9 rounded-lg border border-zinc-200 dark:border-[#1a1a1a] bg-white dark:bg-[#111] text-sm px-2"
            >
              <option value="">No group (org-wide catch-all)</option>
              {org.groups.map((g) => (
                <option key={g.id} value={g.id} disabled={!!g.mailbox}>
                  {g.name} {g.mailbox ? "(already has mailbox)" : ""}
                </option>
              ))}
            </select>
            <Button onClick={createMailbox} disabled={creating || !address.trim()} size="sm" className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white">
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
              Create Mailbox
            </Button>
          </div>
        </section>
      )}

      <section>
        <h3 className="text-sm font-bold mb-3">Group Mailboxes ({org.groupMailboxes.length})</h3>
        {org.groupMailboxes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-6 text-center">
            <Mail className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">No group mailboxes yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {org.groupMailboxes.map((mb) => {
              const group = org.groups.find((g) => g.id === mb.groupId);
              return (
                <div key={mb.id} className="flex items-center justify-between rounded-xl border border-zinc-200 dark:border-[#1a1a1a] bg-white dark:bg-[#111] px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Mail className="h-4 w-4 text-purple-500" />
                    <div>
                      <p className="text-sm font-mono font-semibold">{mb.address}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {mb.displayName || "No display name"}
                        {group && <span className="ml-1 text-purple-500">&middot; {group.name}</span>}
                        {!group && <span className="ml-1 text-amber-500">&middot; Catch-all</span>}
                      </p>
                    </div>
                  </div>
                  {isAdmin && (
                    <Button variant="ghost" size="icon-sm" onClick={() => deleteMailbox(mb.id)} className="text-red-500/60 hover:text-red-500">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
