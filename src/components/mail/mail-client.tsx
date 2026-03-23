"use client";

import { useEffect, useState, useCallback } from "react";
import { useTheme } from "next-themes";
import {
  Inbox,
  Send,
  FileEdit,
  Trash2,
  AlertTriangle,
  Archive,
  Star,
  Search,
  RefreshCw,
  Pen,
  Mail,
  ChevronLeft,
  MailOpen,
  Paperclip,
  Reply,
  Forward,
  Check,
  CircleAlert,
  AtSign,
  Loader2,
  Settings,
  Plus,
  X,
  ArchiveIcon,
  AlertOctagon,
  MailCheck,
  MailX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { AppSwitcher } from "@/components/shared/app-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { ComposeDialog } from "./compose-dialog";
import { formatDistanceToNow, format, isToday, isYesterday, isThisYear } from "date-fns";
import { toast } from "sonner";

interface MailFolder {
  id: string;
  name: string;
  type: string;
  icon: string;
  unreadCount: number;
  totalCount: number;
}

interface EmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

interface Email {
  id: string;
  messageId: string | null;
  fromAddress: string;
  fromName: string | null;
  toAddresses: string[];
  ccAddresses: string[] | null;
  subject: string;
  bodyText: string | null;
  bodyHtml: string | null;
  isRead: boolean;
  isStarred: boolean;
  isDraft: boolean;
  receivedAt: string;
  attachments: EmailAttachment[];
}

interface EmailAlias {
  id: string;
  address: string;
}

interface Mailbox {
  id: string;
  address: string;
  isPrimary: boolean;
  aliases?: EmailAlias[];
}

const FOLDER_ICONS: Record<string, React.ComponentType<any>> = {
  inbox: Inbox,
  sent: Send,
  drafts: FileEdit,
  trash: Trash2,
  spam: AlertTriangle,
  archive: Archive,
};

const FOLDER_ORDER = ["inbox", "sent", "drafts", "archive", "spam", "trash"];

function formatEmailDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, "h:mm a");
  if (isYesterday(d)) return "Yesterday";
  if (isThisYear(d)) return format(d, "MMM d");
  return format(d, "MMM d, yyyy");
}

function getInitials(name: string): string {
  return name
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}

function getAvatarColor(str: string): string {
  const colors = [
    "bg-emerald-500", "bg-blue-500", "bg-purple-500", "bg-pink-500",
    "bg-orange-500", "bg-cyan-500", "bg-indigo-500", "bg-rose-500",
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

// ─── Address Setup Screen ────────────────────────────────────────────────────
function MailboxSetup({ onComplete }: { onComplete: () => void }) {
  const [username, setUsername] = useState("");
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const checkAvailability = useCallback(async (name: string) => {
    if (name.length < 3) { setAvailable(null); return; }
    setChecking(true);
    try {
      const res = await fetch("/api/mail", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: name }),
      });
      const data = await res.json();
      setAvailable(data.available);
    } catch { setAvailable(null); }
    finally { setChecking(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      if (username.length >= 3) checkAvailability(username);
    }, 400);
    return () => clearTimeout(t);
  }, [username, checkAvailability]);

  const handleCreate = async () => {
    setCreating(true); setError("");
    try {
      const res = await fetch("/api/mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      if (res.ok) { toast.success("Email address created!"); onComplete(); }
      else { const data = await res.json(); setError(data.error || "Failed to create address"); }
    } catch { setError("Network error"); }
    finally { setCreating(false); }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
            <AtSign className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold">Choose your email address</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Pick a unique username for your @serika.pro email address.
            This is permanent and cannot be changed.
          </p>
        </div>
        <div className="space-y-4">
          <div className="relative">
            <Input
              value={username}
              onChange={(e) => {
                const val = e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, "");
                setUsername(val); setAvailable(null); setError("");
              }}
              placeholder="your.name"
              className="text-lg h-12 pr-32 font-mono"
              autoFocus
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-mono">
              @serika.pro
            </span>
          </div>
          <div className="h-5 flex items-center gap-2">
            {checking && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Checking...
              </span>
            )}
            {!checking && available === true && username.length >= 3 && (
              <span className="text-xs text-purple-500 flex items-center gap-1">
                <Check className="h-3 w-3" /> {username}@serika.pro is available
              </span>
            )}
            {!checking && available === false && (
              <span className="text-xs text-red-500 flex items-center gap-1">
                <CircleAlert className="h-3 w-3" /> This address is already taken
              </span>
            )}
            {error && (
              <span className="text-xs text-red-500 flex items-center gap-1">
                <CircleAlert className="h-3 w-3" /> {error}
              </span>
            )}
          </div>
          <Button
            onClick={handleCreate}
            disabled={!available || creating || username.length < 3}
            className="w-full h-11 bg-purple-600 hover:bg-purple-700 text-white text-base"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
            {creating ? "Creating..." : "Claim this address"}
          </Button>
          <p className="text-[11px] text-muted-foreground text-center">
            3-30 characters. Lowercase letters, numbers, dots, and hyphens only.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Settings Panel ──────────────────────────────────────────────────────────
function SettingsPanel({ mailbox, onClose }: { mailbox: Mailbox; onClose: () => void }) {
  const [aliases, setAliases] = useState<EmailAlias[]>(mailbox.aliases || []);
  const [newAlias, setNewAlias] = useState("");
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/mail/aliases")
      .then((r) => r.json())
      .then((data) => { setAliases(data.aliases || []); })
      .finally(() => setLoading(false));
  }, []);

  const createAlias = async () => {
    const username = newAlias.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
    if (username.length < 3) { toast.error("Alias must be at least 3 characters"); return; }
    setCreating(true);
    try {
      const res = await fetch("/api/mail/aliases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: `${username}@serika.pro` }),
      });
      if (res.ok) {
        const alias = await res.json();
        setAliases((prev) => [...prev, alias]);
        setNewAlias("");
        toast.success("Alias created!");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to create alias");
      }
    } catch { toast.error("Failed to create alias"); }
    finally { setCreating(false); }
  };

  const deleteAlias = async (aliasId: string) => {
    try {
      await fetch(`/api/mail/aliases?id=${aliasId}`, { method: "DELETE" });
      setAliases((prev) => prev.filter((a) => a.id !== aliasId));
      toast.success("Alias deleted");
    } catch { toast.error("Failed to delete alias"); }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-200 dark:border-[#1a1a1a]">
        <Button variant="ghost" size="icon-sm" onClick={onClose} className="md:hidden">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Settings className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-bold">Mail Settings</h2>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-8 max-w-2xl">
        {/* Account info */}
        <section>
          <h3 className="text-sm font-bold text-foreground mb-3">Account</h3>
          <div className="rounded-xl border border-zinc-200 dark:border-[#1a1a1a] bg-zinc-50 dark:bg-[#0d0d0d] p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold text-lg">
                {mailbox.address[0]?.toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold">{mailbox.address}</p>
                <p className="text-xs text-purple-500">Primary address</p>
              </div>
            </div>
          </div>
        </section>

        {/* Aliases */}
        <section>
          <h3 className="text-sm font-bold text-foreground mb-1">Email Aliases</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Create additional @serika.pro addresses that route to your inbox.
          </p>

          <div className="space-y-2">
            {loading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-12 rounded-lg bg-zinc-100 dark:bg-zinc-900 animate-pulse" />
                ))}
              </div>
            ) : aliases.length === 0 ? (
              <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-4 text-center">
                <p className="text-xs text-muted-foreground">No aliases yet</p>
              </div>
            ) : (
              aliases.map((alias) => (
                <div
                  key={alias.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 dark:border-[#1a1a1a] bg-white dark:bg-[#111] px-4 py-3"
                >
                  <div className="flex items-center gap-2.5">
                    <AtSign className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-mono">{alias.address}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => deleteAlias(alias.id)}
                    className="text-red-500 hover:text-red-400 hover:bg-red-500/10"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}

            <div className="flex items-center gap-2 mt-3">
              <div className="relative flex-1">
                <Input
                  value={newAlias}
                  onChange={(e) => setNewAlias(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))}
                  placeholder="new-alias"
                  className="pr-24 font-mono text-sm h-9"
                  onKeyDown={(e) => { if (e.key === "Enter") createAlias(); }}
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">
                  @serika.pro
                </span>
              </div>
              <Button
                onClick={createAlias}
                disabled={creating || newAlias.length < 3}
                size="sm"
                className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white h-9"
              >
                {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Add
              </Button>
            </div>
          </div>
        </section>

        {/* Info */}
        <section>
          <h3 className="text-sm font-bold text-foreground mb-1">About SerikaMail</h3>
          <div className="rounded-xl border border-zinc-200 dark:border-[#1a1a1a] bg-zinc-50 dark:bg-[#0d0d0d] p-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              SerikaMail gives you a professional @serika.pro email address. Emails are sent via AWS SES
              and received via webhook. All aliases route to your primary inbox.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

// ─── Main Mail Client ────────────────────────────────────────────────────────
export function MailClient() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [folders, setFolders] = useState<MailFolder[]>([]);
  const [emails, setEmails] = useState<Email[]>([]);
  const [mailbox, setMailbox] = useState<Mailbox | null>(null);
  const [aliases, setAliases] = useState<EmailAlias[]>([]);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [activeFolder, setActiveFolder] = useState("inbox");
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [replyTo, setReplyTo] = useState<Email | null>(null);
  const [showStarred, setShowStarred] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (showStarred) {
        params.set("starred", "true");
      } else {
        params.set("folder", activeFolder);
      }
      if (search) params.set("search", search);

      const res = await fetch(`/api/mail?${params}`);
      if (res.ok) {
        const data = await res.json();
        if (data.needsSetup) { setNeedsSetup(true); return; }
        setNeedsSetup(false);
        setEmails(data.emails || []);
        setFolders(data.folders || []);
        if (data.mailbox) {
          setMailbox(data.mailbox);
          setAliases(data.mailbox.aliases || []);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [activeFolder, search, showStarred]);

  const pollS3 = useCallback(async () => {
    try {
      await fetch("/api/mail/poll-s3", { method: "POST" });
    } catch {
      // silent - S3 polling failure shouldn't break UI
    }
  }, []);

  // Poll S3 on load, then refresh emails; also poll every 30s
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      await pollS3();
      if (!cancelled) fetchEmails();
    };
    run();
    const interval = setInterval(run, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchEmails(); }, [fetchEmails]);

  const toggleStar = async (emailId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const email = emails.find((em) => em.id === emailId);
    if (!email) return;
    await fetch(`/api/mail/${emailId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isStarred: !email.isStarred }),
    });
    setEmails((prev) => prev.map((em) => em.id === emailId ? { ...em, isStarred: !em.isStarred } : em));
  };

  const moveToFolder = async (emailId: string, folderType: string) => {
    await fetch(`/api/mail/${emailId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderType }),
    });
    setEmails((prev) => prev.filter((em) => em.id !== emailId));
    if (selectedEmail?.id === emailId) { setSelectedEmail(null); setMobileView("list"); }
    toast.success(`Moved to ${folderType}`);
  };

  const deleteEmail = async (emailId: string) => {
    const res = await fetch(`/api/mail/${emailId}`, { method: "DELETE" });
    const data = await res.json();
    setEmails((prev) => prev.filter((em) => em.id !== emailId));
    if (selectedEmail?.id === emailId) { setSelectedEmail(null); setMobileView("list"); }
    toast.success(data.permanent ? "Deleted permanently" : "Moved to Trash");
  };

  const markAsRead = async (email: Email) => {
    if (!email.isRead) {
      await fetch(`/api/mail/${email.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: true }),
      });
      setEmails((prev) => prev.map((em) => em.id === email.id ? { ...em, isRead: true } : em));
    }
  };

  const toggleRead = async (email: Email) => {
    await fetch(`/api/mail/${email.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isRead: !email.isRead }),
    });
    setEmails((prev) => prev.map((em) => em.id === email.id ? { ...em, isRead: !em.isRead } : em));
    toast.success(email.isRead ? "Marked as unread" : "Marked as read");
  };

  const selectEmail = async (email: Email) => {
    setSelectedEmail(email);
    setMobileView("detail");
    await markAsRead(email);
  };

  const handleReply = (email: Email) => { setReplyTo(email); setComposing(true); };

  // Setup screen
  if (needsSetup) {
    return (
      <div className="flex w-full h-full">
        <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-zinc-200 dark:border-[#1a1a1a] bg-zinc-50/80 dark:bg-[#0a0a0a]/80 backdrop-blur-sm">
          <div className="flex items-center gap-2 px-4 py-4">
            <AppSwitcher current="mail" />
            <div className="flex items-center gap-1.5">
              <Mail className="h-4 w-4 text-purple-500" />
              <span className="font-bold text-sm">SerikaMail</span>
            </div>
          </div>
          <div className="flex-1" />
          <div className="px-3 pb-3"><ThemeToggle /></div>
        </aside>
        <MailboxSetup onComplete={fetchEmails} />
      </div>
    );
  }

  // Sort folders
  const sortedFolders = [...folders].sort(
    (a, b) => FOLDER_ORDER.indexOf(a.type) - FOLDER_ORDER.indexOf(b.type)
  );

  const inboxUnread = folders.find((f) => f.type === "inbox")?.unreadCount || 0;

  // Settings view
  if (showSettings && mailbox) {
    return (
      <div className="flex w-full h-full">
        <Sidebar
          folders={sortedFolders}
          activeFolder={activeFolder}
          showStarred={showStarred}
          showSettings={showSettings}
          mailbox={mailbox}
          inboxUnread={inboxUnread}
          onFolderClick={(type) => { setActiveFolder(type); setShowStarred(false); setShowSettings(false); setSelectedEmail(null); }}
          onStarredClick={() => { setShowStarred(true); setShowSettings(false); setSelectedEmail(null); }}
          onSettingsClick={() => setShowSettings(true)}
          onCompose={() => { setReplyTo(null); setComposing(true); }}
        />
        <SettingsPanel mailbox={mailbox} onClose={() => setShowSettings(false)} />
        {composing && (
          <ComposeDialog
            mailboxAddress={mailbox?.address || ""}
            aliases={aliases}
            replyTo={replyTo}
            onClose={() => { setComposing(false); setReplyTo(null); }}
            onSent={() => { setComposing(false); setReplyTo(null); fetchEmails(); }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex w-full h-full">
      {/* Sidebar */}
      <Sidebar
        folders={sortedFolders}
        activeFolder={activeFolder}
        showStarred={showStarred}
        showSettings={false}
        mailbox={mailbox}
        inboxUnread={inboxUnread}
        onFolderClick={(type) => { setActiveFolder(type); setShowStarred(false); setSelectedEmail(null); }}
        onStarredClick={() => { setShowStarred(true); setSelectedEmail(null); }}
        onSettingsClick={() => setShowSettings(true)}
        onCompose={() => { setReplyTo(null); setComposing(true); }}
      />

      {/* Email List */}
      <div
        className={`flex-1 flex flex-col border-r border-zinc-200 dark:border-[#1a1a1a] min-w-0 ${
          mobileView === "detail" ? "hidden md:flex" : "flex"
        }`}
        style={{ maxWidth: selectedEmail ? "420px" : undefined }}
      >
        {/* List Header */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-200 dark:border-[#1a1a1a] bg-white/50 dark:bg-[#0a0a0a]/50 backdrop-blur-sm">
          <div className="md:hidden">
            <AppSwitcher current="mail" />
          </div>
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search emails..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm bg-zinc-100/80 dark:bg-zinc-900/50 border-transparent focus:border-purple-500/30"
            />
          </div>
          <Button variant="ghost" size="icon-sm" onClick={fetchEmails} className="shrink-0 h-8 w-8">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <div className="md:hidden">
            <Button
              variant="ghost" size="sm"
              onClick={() => { setReplyTo(null); setComposing(true); }}
              className="text-purple-500"
            >
              <Pen className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Folder title bar */}
        <div className="px-4 py-2 border-b border-zinc-100 dark:border-[#111] flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            {showStarred ? "Starred" : sortedFolders.find((f) => f.type === activeFolder)?.name || activeFolder}
            {!showStarred && (
              <span className="text-[10px] font-normal normal-case tracking-normal text-muted-foreground/60">
                {sortedFolders.find((f) => f.type === activeFolder)?.totalCount || 0} emails
              </span>
            )}
          </h2>
        </div>

        {/* Email list */}
        <div className="flex-1 overflow-auto">
          {loading && emails.length === 0 ? (
            <div className="space-y-px">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <div className="h-9 w-9 rounded-full bg-zinc-100 dark:bg-zinc-800 animate-pulse shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-24 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
                    <div className="h-3 w-48 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
                    <div className="h-2.5 w-64 bg-zinc-50 dark:bg-zinc-900 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : emails.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <MailOpen className="h-12 w-12 mb-4 opacity-20" />
              <p className="text-sm font-medium">No emails</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {showStarred ? "Star emails to find them here" : `Your ${activeFolder} is empty`}
              </p>
            </div>
          ) : (
            <div>
              {emails.map((email) => (
                <button
                  key={email.id}
                  onClick={() => selectEmail(email)}
                  className={`w-full text-left px-4 py-3 transition-all border-b border-zinc-100/80 dark:border-[#111]/80 hover:bg-zinc-50 dark:hover:bg-zinc-900/40 ${
                    selectedEmail?.id === email.id
                      ? "bg-purple-50/60 dark:bg-purple-500/5 border-l-2 border-l-purple-500"
                      : "border-l-2 border-l-transparent"
                  } ${!email.isRead ? "bg-white dark:bg-[#0d0d0d]" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${getAvatarColor(email.fromAddress)}`}>
                      {getInitials(email.fromName || email.fromAddress)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-sm truncate ${!email.isRead ? "font-bold text-foreground" : "font-medium text-foreground/80"}`}>
                          {email.fromName || email.fromAddress}
                        </span>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                          {formatEmailDate(email.receivedAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {!email.isRead && <div className="h-1.5 w-1.5 rounded-full bg-purple-500 shrink-0" />}
                        <p className={`text-[13px] truncate ${!email.isRead ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                          {email.subject || "(No subject)"}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground/70 truncate mt-0.5 leading-relaxed">
                        {email.bodyText?.slice(0, 120)?.replace(/\n/g, " ") || "No preview available"}
                      </p>
                    </div>
                    <div className="flex flex-col items-center gap-1.5 shrink-0 pt-0.5">
                      <div
                        onClick={(e) => toggleStar(email.id, e)}
                        role="button"
                        tabIndex={0}
                        className="hover:scale-110 transition-transform cursor-pointer p-1"
                      >
                        <Star className={`h-3.5 w-3.5 ${email.isStarred ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30 hover:text-muted-foreground/60"}`} />
                      </div>
                      {email.attachments.length > 0 && <Paperclip className="h-3 w-3 text-muted-foreground/40" />}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Email Detail */}
      {selectedEmail ? (
        <div className={`flex-1 flex flex-col min-w-0 bg-white dark:bg-[#0a0a0a] ${mobileView === "list" ? "hidden md:flex" : "flex"}`}>
          {/* Detail Header */}
          <div className="flex items-center gap-1 px-4 py-2.5 border-b border-zinc-200 dark:border-[#1a1a1a]">
            <Button variant="ghost" size="icon-sm" onClick={() => { setSelectedEmail(null); setMobileView("list"); }} className="md:hidden">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1" />
            <Button variant="ghost" size="icon-sm" onClick={() => toggleRead(selectedEmail)} title={selectedEmail.isRead ? "Mark unread" : "Mark read"}>
              {selectedEmail.isRead ? <MailX className="h-4 w-4" /> : <MailCheck className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => moveToFolder(selectedEmail.id, "archive")} title="Archive">
              <ArchiveIcon className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => moveToFolder(selectedEmail.id, "spam")} title="Spam">
              <AlertOctagon className="h-4 w-4" />
            </Button>
            <Separator orientation="vertical" className="h-4 mx-1" />
            <Button variant="ghost" size="icon-sm" onClick={() => handleReply(selectedEmail)} title="Reply">
              <Reply className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => { setReplyTo(null); setComposing(true); }} title="Forward">
              <Forward className="h-4 w-4" />
            </Button>
            <Separator orientation="vertical" className="h-4 mx-1" />
            <Button variant="ghost" size="icon-sm" onClick={() => deleteEmail(selectedEmail.id)} title="Delete" className="text-red-500 hover:text-red-400 hover:bg-red-500/10">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Email content */}
          <div className="flex-1 overflow-auto">
            <div className="max-w-3xl mx-auto p-6">
              <h1 className="text-xl font-bold mb-5">{selectedEmail.subject || "(No subject)"}</h1>

              <div className="flex items-start gap-3 mb-6">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${getAvatarColor(selectedEmail.fromAddress)}`}>
                  {getInitials(selectedEmail.fromName || selectedEmail.fromAddress)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <p className="font-semibold text-sm">{selectedEmail.fromName || selectedEmail.fromAddress}</p>
                    <p className="text-xs text-muted-foreground">&lt;{selectedEmail.fromAddress}&gt;</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    To: {Array.isArray(selectedEmail.toAddresses) ? selectedEmail.toAddresses.join(", ") : selectedEmail.toAddresses}
                  </p>
                  {selectedEmail.ccAddresses && selectedEmail.ccAddresses.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Cc: {selectedEmail.ccAddresses.join(", ")}
                    </p>
                  )}
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                  {format(new Date(selectedEmail.receivedAt), "MMM d, yyyy 'at' h:mm a")}
                </div>
              </div>

              {selectedEmail.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-5">
                  {selectedEmail.attachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-[#1a1a1a] bg-zinc-50 dark:bg-[#111] px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="truncate max-w-[180px]">{att.filename}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {att.size < 1024 ? `${att.size}B` : att.size < 1048576 ? `${(att.size / 1024).toFixed(1)}KB` : `${(att.size / 1048576).toFixed(1)}MB`}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <Separator className="mb-5" />

              {selectedEmail.bodyHtml ? (
                <div
                  className=""
              >
                <iframe
                  srcDoc={`<!DOCTYPE html><html><head><style>*{box-sizing:border-box;}body{margin:0;padding:16px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;line-height:1.7;background:${isDark ? '#0d0d0d' : '#f5f5f5'};${isDark ? 'filter:invert(1) hue-rotate(180deg);' : ''}}img,video{${isDark ? 'filter:invert(1) hue-rotate(180deg);' : ''}max-width:100%;height:auto;}blockquote{border-left:3px solid #a855f7;margin:8px 0;padding:4px 12px;}table{border-collapse:collapse;max-width:100%;}td,th{padding:4px 8px;}p{margin:0 0 0.75em;}pre,code{padding:2px 5px;border-radius:3px;font-size:12px;}hr{border:none;border-top:1px solid #ccc;}</style></head><body>${selectedEmail.bodyHtml.replace(/`/g, '\`')}</body></html>`}
                  className="w-full rounded-lg border-0"
                  style={{ minHeight: 120, height: 1 }}
                  onLoad={(e) => {
                    const iframe = e.currentTarget;
                    iframe.style.height = iframe.contentDocument?.documentElement.scrollHeight + 'px';
                  }}
                  sandbox="allow-same-origin"
                  title="Email content"
                />
              </div>
              ) : (
                <pre className="text-sm whitespace-pre-wrap font-sans text-foreground leading-relaxed">
                  {selectedEmail.bodyText || "No content"}
                </pre>
              )}

              {/* Quick reply area */}
              <div className="mt-8 pt-4 border-t border-zinc-200 dark:border-[#1a1a1a]">
                <button
                  onClick={() => handleReply(selectedEmail)}
                  className="w-full text-left px-4 py-3 rounded-lg border border-zinc-200 dark:border-[#1a1a1a] text-sm text-muted-foreground hover:border-purple-500/30 hover:bg-purple-50/30 dark:hover:bg-purple-500/5 transition-colors"
                >
                  Click here to reply...
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center text-muted-foreground bg-zinc-50/50 dark:bg-[#060606]">
          <div className="text-center">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-4">
              <Mail className="h-8 w-8 opacity-20" />
            </div>
            <p className="text-sm font-medium">Select an email to read</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Choose from the list on the left</p>
          </div>
        </div>
      )}

      {/* Compose Dialog */}
      {composing && (
        <ComposeDialog
          mailboxAddress={mailbox?.address || ""}
          aliases={aliases}
          replyTo={replyTo}
          onClose={() => { setComposing(false); setReplyTo(null); }}
          onSent={() => { setComposing(false); setReplyTo(null); fetchEmails(); }}
        />
      )}
    </div>
  );
}

// ─── Sidebar Component ───────────────────────────────────────────────────────
function Sidebar({
  folders, activeFolder, showStarred, showSettings, mailbox, inboxUnread,
  onFolderClick, onStarredClick, onSettingsClick, onCompose,
}: {
  folders: MailFolder[];
  activeFolder: string;
  showStarred: boolean;
  showSettings: boolean;
  mailbox: Mailbox | null;
  inboxUnread: number;
  onFolderClick: (type: string) => void;
  onStarredClick: () => void;
  onSettingsClick: () => void;
  onCompose: () => void;
}) {
  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-zinc-200 dark:border-[#1a1a1a] bg-zinc-50/80 dark:bg-[#0a0a0a]">
      <div className="flex items-center gap-2 px-4 py-4">
        <AppSwitcher current="mail" />
        <div className="flex items-center gap-1.5">
          <Mail className="h-4 w-4 text-purple-500" />
          <span className="font-bold text-sm">SerikaMail</span>
        </div>
      </div>

      <div className="px-3 pb-3">
        <Button onClick={onCompose} className="w-full gap-2 bg-purple-600 hover:bg-purple-700 text-white shadow-sm shadow-purple-500/20">
          <Pen className="h-4 w-4" />
          Compose
        </Button>
      </div>

      <Separator className="bg-zinc-200 dark:bg-[#1a1a1a]" />

      <nav className="flex-1 overflow-auto py-2 px-2 space-y-0.5">
        {folders.map((folder) => {
          const Icon = FOLDER_ICONS[folder.type] || Inbox;
          const isActive = !showStarred && !showSettings && activeFolder === folder.type;
          const showBadge = folder.unreadCount > 0 && folder.type === "inbox";
          return (
            <button
              key={folder.id}
              onClick={() => onFolderClick(folder.type)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? "bg-purple-100/60 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400"
                  : "text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate flex-1 text-left">{folder.name}</span>
              {showBadge && (
                <span className="text-[10px] font-bold bg-purple-500 text-white rounded-full h-4.5 min-w-[18px] flex items-center justify-center px-1">
                  {folder.unreadCount}
                </span>
              )}
              {!showBadge && folder.totalCount > 0 && (
                <span className="text-[10px] text-muted-foreground/50">{folder.totalCount}</span>
              )}
            </button>
          );
        })}

        <button
          onClick={onStarredClick}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
            showStarred && !showSettings
              ? "bg-yellow-100/60 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400"
              : "text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
          }`}
        >
          <Star className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">Starred</span>
        </button>
      </nav>

      <div className="px-3 pb-3 space-y-1.5">
        <Separator className="bg-zinc-200 dark:bg-[#1a1a1a]" />
        {mailbox && (
          <div className="px-1 py-1.5">
            <p className="text-[10px] font-mono text-purple-500 truncate">{mailbox.address}</p>
            {mailbox.aliases && mailbox.aliases.length > 0 && (
              <div className="mt-0.5">
                {mailbox.aliases.map((a) => (
                  <p key={a.id} className="text-[10px] font-mono text-muted-foreground/60 truncate">{a.address}</p>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="flex items-center justify-between pt-1">
          <ThemeToggle />
          <Button variant="ghost" size="icon-sm" onClick={onSettingsClick} className={showSettings ? "text-purple-500" : "text-muted-foreground"}>
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
