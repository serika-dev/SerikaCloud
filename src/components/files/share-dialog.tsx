"use client";

import * as React from "react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Copy,
  Check,
  ExternalLink,
  Loader2,
  Trash2,
  Link2,
  Globe,
  Lock,
  RefreshCw,
  Download,
  Clock,
  Eye,
  EyeOff,
  Shield,
  QrCode,
} from "lucide-react";
import { toast } from "sonner";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileId: string;
  fileName: string;
}

export function ShareDialog({
  open,
  onOpenChange,
  fileId,
  fileName,
}: ShareDialogProps) {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareId, setShareId] = useState<string | null>(null);
  const [reused, setReused] = useState(false);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [hasPassword, setHasPassword] = useState(false);
  const [maxDownloads, setMaxDownloads] = useState<number | null>(null);
  const [downloadCount, setDownloadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [showQR, setShowQR] = useState(false);

  // Settings panel
  const [passwordEnabled, setPasswordEnabled] = useState(false);
  const [passwordValue, setPasswordValue] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [expirationEnabled, setExpirationEnabled] = useState(false);
  const [expirationHours, setExpirationHours] = useState("24");
  const [downloadLimitEnabled, setDownloadLimitEnabled] = useState(false);
  const [downloadLimitValue, setDownloadLimitValue] = useState("100");
  const [savingSettings, setSavingSettings] = useState(false);

  const [activeFileId, setActiveFileId] = useState(fileId);
  const [activeFileName, setActiveFileName] = useState(fileName);

  if (fileId && fileId !== activeFileId) setActiveFileId(fileId);
  if (fileName && fileName !== activeFileName) setActiveFileName(fileName);

  const displayFileId = fileId || activeFileId;
  const displayFileName = fileName || activeFileName;

  const createShareLink = React.useCallback(async () => {
    if (!displayFileId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: displayFileId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create share link");
      }

      const data = await res.json();
      setShareUrl(data.url);
      setShareId(data.id);
      setReused(!!data.reused);
      setCreatedAt(data.createdAt || null);
      setHasPassword(!!data.hasPassword);
      setMaxDownloads(data.maxDownloads ?? null);
      setDownloadCount(data.downloadCount ?? 0);
      setPasswordEnabled(!!data.hasPassword);
      setDownloadLimitEnabled(!!data.maxDownloads);
      if (data.maxDownloads) setDownloadLimitValue(String(data.maxDownloads));
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create share link"
      );
    } finally {
      setLoading(false);
    }
  }, [displayFileId]);

  React.useEffect(() => {
    if (open && !shareUrl && !loading) {
      createShareLink();
    }
  }, [open, shareUrl, loading, createShareLink]);

  const copyToClipboard = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("Link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const copyEmbedCode = async () => {
    if (!shareUrl) return;
    const embed = `<a href="${shareUrl}" target="_blank" rel="noopener noreferrer">${displayFileName}</a>`;
    await navigator.clipboard.writeText(embed);
    setCopiedEmbed(true);
    toast.success("Embed code copied");
    setTimeout(() => setCopiedEmbed(false), 2000);
  };

  const saveSettings = async () => {
    if (!shareId) return;
    setSavingSettings(true);
    try {
      const payload: any = {};
      if (passwordEnabled && passwordValue) {
        payload.password = passwordValue;
      } else if (!passwordEnabled) {
        payload.removePassword = true;
      }
      if (downloadLimitEnabled) {
        payload.maxDownloads = Number(downloadLimitValue) || null;
      } else {
        payload.maxDownloads = null;
      }
      if (expirationEnabled) {
        payload.expiresIn = Number(expirationHours) * 3600;
      } else {
        payload.expiresIn = null;
      }

      const res = await fetch("/api/share", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: shareId, ...payload }),
      });

      if (!res.ok) throw new Error();
      const data = await res.json();
      setHasPassword(!!data.hasPassword);
      setMaxDownloads(data.maxDownloads ?? null);
      setDownloadCount(data.downloadCount ?? 0);
      setPasswordValue("");
      toast.success("Share settings updated");
    } catch {
      toast.error("Failed to update settings");
    } finally {
      setSavingSettings(false);
    }
  };

  const removeShareLink = async () => {
    if (!shareId) return;
    setRemoving(true);
    try {
      const res = await fetch(`/api/share?id=${shareId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to remove share link");
      toast.success("Share link removed");
      resetState();
      onOpenChange(false);
    } catch {
      toast.error("Failed to remove share link");
    } finally {
      setRemoving(false);
    }
  };

  const regenerateLink = async () => {
    if (!shareId) return;
    try {
      await fetch(`/api/share?id=${shareId}`, { method: "DELETE" });
    } catch {}
    resetState();
  };

  const resetState = () => {
    setShareUrl(null);
    setShareId(null);
    setReused(false);
    setCreatedAt(null);
    setHasPassword(false);
    setMaxDownloads(null);
    setDownloadCount(0);
    setPasswordEnabled(false);
    setPasswordValue("");
    setDownloadLimitEnabled(false);
    setExpirationEnabled(false);
    setShowQR(false);
  };

  const handleOpen = (isOpen: boolean) => {
    if (!isOpen) {
      setTimeout(resetState, 300);
    }
    onOpenChange(isOpen);
  };

  const qrUrl = shareUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shareUrl)}&bgcolor=0a0a0a&color=a78bfa`
    : "";

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent
        className="sm:max-w-xl p-0 overflow-hidden border-0"
        style={{ maxWidth: "min(95vw, 36rem)" }}
      >
        {/* Gradient header */}
        <div className="relative bg-gradient-to-br from-violet-600/20 via-indigo-600/15 to-purple-700/10 px-6 pt-6 pb-4">
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
          <DialogHeader className="relative">
            <DialogTitle className="flex items-center gap-2.5 text-lg">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600/20 border border-violet-500/20">
                <Link2 className="h-4 w-4 text-violet-400" />
              </div>
              Share File
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-1.5 truncate pr-8">
              {displayFileName}
            </p>
          </DialogHeader>
        </div>

        <div className="px-6 pb-6 space-y-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-violet-500/20 animate-ping" />
                <Loader2 className="h-8 w-8 animate-spin text-violet-400 relative" />
              </div>
              <p className="text-sm text-muted-foreground">
                Generating share link...
              </p>
            </div>
          ) : shareUrl ? (
            <div className="space-y-5">
              {/* Status row */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant="outline"
                  className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 gap-1"
                >
                  <Globe className="h-3 w-3" />
                  Active
                </Badge>
                {hasPassword && (
                  <Badge
                    variant="outline"
                    className="bg-amber-500/10 text-amber-500 border-amber-500/20 gap-1"
                  >
                    <Lock className="h-3 w-3" />
                    Password
                  </Badge>
                )}
                {maxDownloads && (
                  <Badge
                    variant="outline"
                    className="bg-blue-500/10 text-blue-500 border-blue-500/20 gap-1"
                  >
                    <Download className="h-3 w-3" />
                    {downloadCount}/{maxDownloads}
                  </Badge>
                )}
                {reused && (
                  <Badge variant="outline" className="text-muted-foreground gap-1 text-xs">
                    Existing link
                  </Badge>
                )}
              </div>

              {/* URL bar */}
              <div className="relative group">
                <div className="flex items-center rounded-xl border bg-muted/30 transition-colors focus-within:border-violet-500/50 focus-within:bg-muted/50">
                  <div className="flex items-center justify-center w-10 shrink-0">
                    <Link2 className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <input
                    value={shareUrl}
                    readOnly
                    className="flex-1 bg-transparent py-2.5 pr-2 text-xs font-mono outline-none text-foreground/80 select-all"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyToClipboard}
                    className="shrink-0 mr-1 h-8 px-3 rounded-lg"
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    <span className="ml-1.5 text-xs">
                      {copied ? "Copied!" : "Copy"}
                    </span>
                  </Button>
                </div>
              </div>

              {/* Quick actions */}
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(shareUrl, "_blank")}
                  className="h-9 text-xs"
                >
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Open
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyEmbedCode}
                  className="h-9 text-xs"
                >
                  {copiedEmbed ? (
                    <Check className="mr-1.5 h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Embed
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowQR(!showQR)}
                  className={`h-9 text-xs ${showQR ? "border-violet-500/40 bg-violet-500/10" : ""}`}
                >
                  <QrCode className="mr-1.5 h-3.5 w-3.5" />
                  QR
                </Button>
              </div>

              {/* QR Code panel */}
              {showQR && (
                <div className="flex justify-center py-3 rounded-xl bg-muted/30 border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrUrl}
                    alt="QR Code"
                    className="rounded-lg"
                    width={160}
                    height={160}
                  />
                </div>
              )}

              <Separator className="opacity-50" />

              {/* Settings section */}
              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5" />
                  Link Settings
                </p>

                {/* Password protection */}
                <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/20 border px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 shrink-0">
                      <Lock className="h-4 w-4 text-amber-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Password</p>
                      <p className="text-xs text-muted-foreground">
                        {hasPassword
                          ? "Password protection active"
                          : "Require password to access"}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={passwordEnabled}
                    onCheckedChange={setPasswordEnabled}
                  />
                </div>
                {passwordEnabled && (
                  <div className="pl-4">
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder={
                          hasPassword
                            ? "Enter new password to change"
                            : "Set a password"
                        }
                        value={passwordValue}
                        onChange={(e) => setPasswordValue(e.target.value)}
                        className="pr-10 text-sm"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                        onClick={() => setShowPassword(!showPassword)}
                        type="button"
                      >
                        {showPassword ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Expiration */}
                <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/20 border px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 shrink-0">
                      <Clock className="h-4 w-4 text-blue-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Expiration</p>
                      <p className="text-xs text-muted-foreground">
                        Auto-expire after time period
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={expirationEnabled}
                    onCheckedChange={setExpirationEnabled}
                  />
                </div>
                {expirationEnabled && (
                  <div className="pl-4 flex items-center gap-2">
                    <select
                      value={expirationHours}
                      onChange={(e) => setExpirationHours(e.target.value)}
                      className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="1">1 hour</option>
                      <option value="6">6 hours</option>
                      <option value="24">24 hours</option>
                      <option value="72">3 days</option>
                      <option value="168">7 days</option>
                      <option value="720">30 days</option>
                    </select>
                  </div>
                )}

                {/* Download limit */}
                <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/20 border px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 shrink-0">
                      <Download className="h-4 w-4 text-indigo-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Download Limit</p>
                      <p className="text-xs text-muted-foreground">
                        {downloadCount > 0
                          ? `${downloadCount} downloads so far`
                          : "Limit total number of downloads"}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={downloadLimitEnabled}
                    onCheckedChange={setDownloadLimitEnabled}
                  />
                </div>
                {downloadLimitEnabled && (
                  <div className="pl-4">
                    <Input
                      type="number"
                      min={1}
                      placeholder="Max downloads"
                      value={downloadLimitValue}
                      onChange={(e) => setDownloadLimitValue(e.target.value)}
                      className="w-32 text-sm"
                    />
                  </div>
                )}

                {/* Save settings button */}
                <Button
                  size="sm"
                  onClick={saveSettings}
                  disabled={savingSettings}
                  className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-lg shadow-violet-500/20 h-9"
                >
                  {savingSettings ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  Save Settings
                </Button>
              </div>

              <Separator className="opacity-50" />

              {/* Footer info + danger zone */}
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  {createdAt && (
                    <span>
                      Created{" "}
                      {new Date(createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={regenerateLink}
                    className="h-8 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <RefreshCw className="mr-1 h-3.5 w-3.5" />
                    New Link
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={removeShareLink}
                    disabled={removing}
                    className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    {removing ? (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                    )}
                    Remove
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
