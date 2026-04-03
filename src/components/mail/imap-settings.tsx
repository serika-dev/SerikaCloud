"use client";

import { useEffect, useState } from "react";
import {
  ChevronLeft, Key, Plus, Loader2, Copy, Eye, EyeOff,
  Trash2, Shield, Server, Lock, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface ImapCredential {
  id: string;
  label: string;
  lastUsedAt: string | null;
  createdAt: string;
}

interface ConnectionInfo {
  host: string;
  port: number;
  security: string;
  username: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecurity: string;
}

interface ImapSettingsProps {
  onBack: () => void;
}

export function ImapSettings({ onBack }: ImapSettingsProps) {
  const [credentials, setCredentials] = useState<ImapCredential[]>([]);
  const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    fetch("/api/mail/imap")
      .then((r) => r.json())
      .then((data) => {
        setCredentials(data.credentials || []);
        setConnectionInfo(data.connectionInfo || null);
      })
      .finally(() => setLoading(false));
  }, []);

  const createAppPassword = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/mail/imap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newLabel.trim() || "App Password" }),
      });
      if (res.ok) {
        const data = await res.json();
        setCredentials((prev) => [data.credential, ...prev]);
        setNewPassword(data.password);
        setNewLabel("");
        setShowPassword(true);
        toast.success("App password created! Copy it now — it won't be shown again.");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to create");
      }
    } finally { setCreating(false); }
  };

  const revokeCredential = async (id: string) => {
    await fetch(`/api/mail/imap?id=${id}`, { method: "DELETE" });
    setCredentials((prev) => prev.filter((c) => c.id !== id));
    toast.success("App password revoked");
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-200 dark:border-[#1a1a1a]">
        <Button variant="ghost" size="icon-sm" onClick={onBack}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Server className="h-5 w-5 text-purple-500" />
        <div>
          <h2 className="text-lg font-bold">IMAP / SMTP Access</h2>
          <p className="text-xs text-muted-foreground">Connect external mail clients like Thunderbird, Outlook, Apple Mail</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 max-w-2xl space-y-8">
        {/* Connection Info */}
        {connectionInfo && (
          <section>
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
              <Lock className="h-3.5 w-3.5 text-emerald-500" />
              Connection Settings
            </h3>
            <div className="rounded-xl border border-zinc-200 dark:border-[#1a1a1a] bg-zinc-50 dark:bg-[#0d0d0d] overflow-hidden">
              <div className="p-4 space-y-3">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Incoming Mail (IMAP)</p>
                {[
                  { label: "Server", value: connectionInfo.host },
                  { label: "Port", value: String(connectionInfo.port) },
                  { label: "Security", value: connectionInfo.security },
                  { label: "Username", value: connectionInfo.username },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{row.label}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono text-foreground">{row.value}</span>
                      <button onClick={() => copyToClipboard(row.value, row.label)} className="text-muted-foreground hover:text-foreground">
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-zinc-200 dark:border-[#1a1a1a] p-4 space-y-3">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Outgoing Mail (SMTP)</p>
                {[
                  { label: "Server", value: connectionInfo.smtpHost },
                  { label: "Port", value: String(connectionInfo.smtpPort) },
                  { label: "Security", value: connectionInfo.smtpSecurity },
                  { label: "Username", value: connectionInfo.username },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{row.label}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono text-foreground">{row.value}</span>
                      <button onClick={() => copyToClipboard(row.value, row.label)} className="text-muted-foreground hover:text-foreground">
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-zinc-200 dark:border-[#1a1a1a] p-3 bg-amber-50/50 dark:bg-amber-900/5">
                <p className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  Use an App Password (below) instead of your account password
                </p>
              </div>
            </div>
          </section>
        )}

        {/* New Password Result */}
        {newPassword && (
          <section>
            <div className="rounded-xl border-2 border-purple-400 dark:border-purple-600 bg-purple-50 dark:bg-purple-900/10 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-bold text-purple-700 dark:text-purple-400">Your New App Password</span>
              </div>
              <div className="flex items-center gap-2 bg-white dark:bg-[#0a0a0a] rounded-lg px-3 py-2 border border-purple-200 dark:border-purple-800">
                <code className="flex-1 text-lg font-mono font-bold tracking-wider text-foreground">
                  {showPassword ? newPassword : "••••-••••-••••-••••"}
                </code>
                <button onClick={() => setShowPassword(!showPassword)} className="text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <button onClick={() => copyToClipboard(newPassword, "Password")} className="text-purple-500 hover:text-purple-400">
                  <Copy className="h-4 w-4" />
                </button>
              </div>
              <p className="text-[10px] text-purple-600 dark:text-purple-400 font-medium flex items-center gap-1">
                <Shield className="h-3 w-3" />
                Copy this now. It will never be shown again.
              </p>
              <Button onClick={() => setNewPassword(null)} variant="ghost" size="sm" className="text-purple-600">
                I've copied it — dismiss
              </Button>
            </div>
          </section>
        )}

        {/* Generate App Password */}
        <section>
          <h3 className="text-sm font-bold mb-2">App Passwords</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Generate secure passwords for external mail clients. Each client should have its own password.
          </p>
          <div className="flex items-center gap-2 mb-4">
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Label (e.g. Thunderbird, iPhone)"
              className="h-9 flex-1"
              onKeyDown={(e) => { if (e.key === "Enter") createAppPassword(); }}
            />
            <Button onClick={createAppPassword} disabled={creating} size="sm" className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white h-9">
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Generate
            </Button>
          </div>

          {/* Existing credentials */}
          {credentials.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-6 text-center">
              <Key className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground">No app passwords yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {credentials.map((cred) => (
                <div key={cred.id} className="flex items-center justify-between rounded-lg border border-zinc-200 dark:border-[#1a1a1a] bg-white dark:bg-[#111] px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Key className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{cred.label}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Created {new Date(cred.createdAt).toLocaleDateString()}
                        {cred.lastUsedAt && ` · Last used ${new Date(cred.lastUsedAt).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon-sm" onClick={() => revokeCredential(cred.id)} className="text-red-500/60 hover:text-red-500 hover:bg-red-500/10">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
