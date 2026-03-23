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
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(shareUrl)}&bgcolor=121214&color=a78bfa&margin=10`
    : "";

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent
        className="sm:max-w-xl p-0 overflow-hidden border border-white/5 bg-zinc-950/90 backdrop-blur-xl shadow-2xl"
      >
        {/* Gradient Header */}
        <div className="relative overflow-hidden px-8 pt-8 pb-6 border-b border-white/5 bg-gradient-to-br from-violet-600/10 via-transparent to-transparent">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Globe className="h-24 w-24 text-violet-500 -mr-6 -mt-6" />
          </div>
          <DialogHeader className="relative z-10">
            <DialogTitle className="flex items-center gap-3 text-2xl font-bold tracking-tight">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-400">
                <Link2 className="h-5 w-5" />
              </div>
              Share Securely
            </DialogTitle>
            <p className="text-sm text-zinc-400 mt-2 truncate max-w-md">
              Configuring sharing options for <span className="text-zinc-200 font-medium">{displayFileName}</span>
            </p>
          </DialogHeader>
        </div>

        <div className="px-8 py-6 space-y-6 max-h-[75vh] overflow-y-auto no-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-violet-500/20 animate-ping" />
                <div className="h-12 w-12 rounded-xl border border-violet-500/30 bg-zinc-900 flex items-center justify-center relative shadow-lg">
                   <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
                </div>
              </div>
              <p className="text-sm font-medium text-zinc-300 animate-pulse">
                Securing your share link...
              </p>
            </div>
          ) : shareUrl ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* URL Display Card */}
              <div className="space-y-3">
                <Label className="text-xs font-semibold uppercase tracking-widest text-zinc-500 ml-1">
                  Public Share Link
                </Label>
                <div className="group relative">
                  <div className="flex items-center gap-2 rounded-2xl border border-white/5 bg-zinc-900/50 p-1.5 transition-all duration-300 focus-within:border-violet-500/50 focus-within:ring-2 focus-within:ring-violet-500/10">
                    <div className="pl-3 py-2 flex items-center min-w-0 flex-1">
                       < Globe className="h-4 w-4 text-zinc-500 mr-3 shrink-0" />
                       <input
                        value={shareUrl}
                        readOnly
                        className="w-full bg-transparent text-sm font-mono text-zinc-300 outline-none select-all"
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                      />
                    </div>
                    <Button
                      size="sm"
                      onClick={copyToClipboard}
                      className={`h-9 rounded-xl px-4 font-medium transition-all duration-300 ${copied ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-600/20'}`}
                    >
                      {copied ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <div className="flex items-center gap-2">
                           <Copy className="h-3.5 w-3.5" />
                           <span>Copy</span>
                        </div>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => window.open(shareUrl, "_blank")}
                    className="h-8 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/5 text-zinc-300 text-xs px-3"
                  >
                    <ExternalLink className="mr-1.5 h-3 w-3" />
                    Preview
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowQR(!showQR)}
                    className={`h-8 rounded-lg border border-white/5 text-zinc-300 text-xs px-3 transition-colors ${showQR ? 'bg-violet-500/10 border-violet-500/20 text-violet-400' : 'bg-zinc-900 hover:bg-zinc-800'}`}
                  >
                    <QrCode className="mr-1.5 h-3 w-3" />
                    QR Code
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={copyEmbedCode}
                    className="h-8 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/5 text-zinc-300 text-xs px-3"
                  >
                    <Eye className="mr-1.5 h-3 w-3" />
                    Embed
                  </Button>
                </div>
              </div>

              {showQR && (
                <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-zinc-900/80 border border-white/5 animate-in zoom-in-95 duration-200">
                  <div className="bg-white p-2 rounded-xl shadow-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrUrl} alt="QR Code" className="w-40 h-40" />
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-4 uppercase tracking-tighter">Scan to open on mobile</p>
                </div>
              )}

              <Separator className="bg-white/5" />

              {/* Security Settings Section */}
              <div className="space-y-4">
                 <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs font-semibold uppercase tracking-widest text-zinc-500 ml-1">
                      Link Security
                    </Label>
                    <Badge variant="outline" className="text-[10px] uppercase font-bold text-violet-400 border-violet-400/20 bg-violet-400/5">
                       Advanced
                    </Badge>
                 </div>

                {/* Settings Grid */}
                <div className="grid gap-3">
                  {/* Password Protection */}
                  <div className={`p-4 rounded-2xl border transition-all duration-300 ${passwordEnabled ? 'bg-zinc-900/50 border-amber-500/30 ring-1 ring-amber-500/10' : 'bg-zinc-900/30 border-white/5'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${passwordEnabled ? 'bg-amber-500/10 text-amber-500' : 'bg-zinc-800 text-zinc-500'}`}>
                          <Lock className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-zinc-200">Password Lock</p>
                          <p className="text-xs text-zinc-500">Require credentials for access</p>
                        </div>
                      </div>
                      <Switch checked={passwordEnabled} onCheckedChange={setPasswordEnabled} />
                    </div>
                    {passwordEnabled && (
                      <div className="mt-3 relative animate-in slide-in-from-top-2 duration-200">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Create access password"
                          value={passwordValue}
                          onChange={(e) => setPasswordValue(e.target.value)}
                          className="bg-zinc-950 border-white/10 text-sm h-10 pr-10 rounded-xl"
                        />
                        <button 
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                           {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Expiration Setting */}
                    <div className={`p-4 rounded-2xl border transition-all duration-300 ${expirationEnabled ? 'bg-zinc-900/50 border-blue-500/30 ring-1 ring-blue-500/10' : 'bg-zinc-900/30 border-white/5'}`}>
                      <div className="flex items-center justify-between mb-3">
                         <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${expirationEnabled ? 'bg-blue-500/10 text-blue-500' : 'bg-zinc-800 text-zinc-501'}`}>
                          <Clock className="h-4 w-4" />
                        </div>
                        <Switch checked={expirationEnabled} onCheckedChange={setExpirationEnabled} />
                      </div>
                      <p className="text-sm font-medium text-zinc-200">Expiration</p>
                      {expirationEnabled ? (
                        <select
                          value={expirationHours}
                          onChange={(e) => setExpirationHours(e.target.value)}
                          className="mt-2 w-full bg-zinc-950 border border-white/10 rounded-lg text-xs p-1.5 text-zinc-300 outline-none"
                        >
                          <option value="1">1 Hour</option>
                          <option value="6">6 Hours</option>
                          <option value="24">1 Day</option>
                          <option value="168">7 Days</option>
                        </select>
                      ) : (
                        <p className="text-[10px] text-zinc-500 mt-1">Never expires</p>
                      )}
                    </div>

                    {/* Download Limit Setting */}
                    <div className={`p-4 rounded-2xl border transition-all duration-300 ${downloadLimitEnabled ? 'bg-zinc-900/50 border-emerald-500/30 ring-1 ring-emerald-500/10' : 'bg-zinc-900/30 border-white/5'}`}>
                      <div className="flex items-center justify-between mb-3">
                         <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${downloadLimitEnabled ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-800 text-zinc-501'}`}>
                          <Download className="h-4 w-4" />
                        </div>
                        <Switch checked={downloadLimitEnabled} onCheckedChange={setDownloadLimitEnabled} />
                      </div>
                      <p className="text-sm font-medium text-zinc-200">Limit</p>
                      {downloadLimitEnabled ? (
                        <Input
                          type="number"
                          value={downloadLimitValue}
                          onChange={(e) => setDownloadLimitValue(e.target.value)}
                          className="mt-2 h-7 bg-zinc-950 border-white/10 text-xs px-2 rounded-lg"
                        />
                      ) : (
                        <p className="text-[10px] text-zinc-500 mt-1">Unlimited</p>
                      )}
                    </div>
                  </div>
                </div>

                <Button
                  onClick={saveSettings}
                  disabled={savingSettings}
                  className="w-full h-11 bg-zinc-100 hover:bg-white text-zinc-950 font-bold rounded-2xl transition-all duration-300 shadow-xl shadow-white/5 mt-2"
                >
                  {savingSettings ? <Loader2 className="animate-spin h-5 w-5" /> : "Apply Security Policy"}
                </Button>
              </div>

              <div className="flex items-center justify-between pt-2">
                 <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={regenerateLink}
                      className="text-zinc-500 hover:text-white text-[10px] font-bold uppercase tracking-widest gap-2"
                    >
                      <RefreshCw size={12} />
                      Regenerate
                    </Button>
                 </div>
                 <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={removeShareLink}
                    disabled={removing}
                    className="text-zinc-600 hover:text-red-400 text-[10px] font-bold uppercase tracking-widest gap-2"
                  >
                    {removing ? <Loader2 className="animate-spin" size={12} /> : <Trash2 size={12} />}
                    Disable Link
                  </Button>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
      </DialogContent>
    </Dialog>
  );
}
