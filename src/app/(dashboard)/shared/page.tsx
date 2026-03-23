"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Link2,
  ExternalLink,
  Trash2,
  Copy,
  Check,
  Lock,
  Download,
  Clock,
  Globe,
} from "lucide-react";
import { format } from "date-fns";
import { formatBytes } from "@/lib/utils";
import { toast } from "sonner";

interface ShareLinkData {
  id: string;
  shortId: string;
  expiresAt: string | null;
  createdAt: string;
  hasPassword: boolean;
  maxDownloads: number | null;
  downloadCount: number;
  file: {
    name: string;
    mimeType: string;
    size: string;
  };
}

export default function SharedPage() {
  const [links, setLinks] = useState<ShareLinkData[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchLinks = async () => {
    try {
      const res = await fetch("/api/share");
      if (res.ok) {
        const data = await res.json();
        setLinks(data.shareLinks);
      }
    } catch {
      toast.error("Failed to load shared links");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLinks();
  }, []);

  const copyLink = async (shortId: string, fileName: string) => {
    const url = `${window.location.origin}/share/${shortId}/${encodeURIComponent(fileName)}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(shortId);
    toast.success("Link copied");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const deleteLink = async (linkId: string) => {
    try {
      const res = await fetch(`/api/share?id=${linkId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setLinks((prev) => prev.filter((l) => l.id !== linkId));
      toast.success("Share link removed");
    } catch {
      toast.error("Failed to remove share link");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600/10 via-indigo-600/10 to-transparent p-6 sm:p-8 border border-muted-foreground/10">
        <div className="absolute right-0 top-0 -mt-16 -mr-16 bg-gradient-to-br from-indigo-500/20 to-purple-600/20 w-64 h-64 rounded-full blur-3xl" />
        <div className="relative">
          <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Shared Links
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            Manage your public file sharing links &middot;{" "}
            {links.length} {links.length === 1 ? "link" : "links"} total
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : links.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 border mb-4">
            <Link2 className="h-8 w-8 opacity-40" />
          </div>
          <p className="font-medium text-lg">No shared files</p>
          <p className="text-sm mt-1">
            Share a file to generate a public link
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {links.map((link) => {
            const isExpired =
              link.expiresAt && new Date(link.expiresAt) < new Date();
            const isLimitReached =
              link.maxDownloads && link.downloadCount >= link.maxDownloads;

            return (
              <Card
                key={link.id}
                className={`group transition-all duration-200 hover:shadow-md hover:border-primary/20 ${
                  isExpired || isLimitReached ? "opacity-60" : ""
                }`}
              >
                <CardContent className="flex items-center gap-4 py-4">
                  {/* Icon */}
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl shrink-0 ${
                      isExpired || isLimitReached
                        ? "bg-destructive/10"
                        : "bg-gradient-to-br from-violet-500/15 to-indigo-500/15 border border-violet-500/10"
                    }`}
                  >
                    <Link2
                      className={`h-5 w-5 ${
                        isExpired || isLimitReached
                          ? "text-destructive/60"
                          : "text-violet-500"
                      }`}
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{link.file.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                      <span>{formatBytes(Number(link.file.size))}</span>
                      <span className="text-muted-foreground/40">•</span>
                      <span>
                        {format(new Date(link.createdAt), "MMM d, yyyy")}
                      </span>
                      {isExpired && (
                        <>
                          <span className="text-muted-foreground/40">•</span>
                          <Badge
                            variant="destructive"
                            className="text-[10px] px-1.5 py-0 h-4"
                          >
                            Expired
                          </Badge>
                        </>
                      )}
                      {isLimitReached && !isExpired && (
                        <>
                          <span className="text-muted-foreground/40">•</span>
                          <Badge
                            variant="destructive"
                            className="text-[10px] px-1.5 py-0 h-4"
                          >
                            Limit Reached
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Status badges */}
                  <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                    {!isExpired && !isLimitReached && (
                      <Badge
                        variant="outline"
                        className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px] px-1.5 py-0 h-5 gap-1"
                      >
                        <Globe className="h-2.5 w-2.5" />
                        Active
                      </Badge>
                    )}
                    {link.hasPassword && (
                      <Badge
                        variant="outline"
                        className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[10px] px-1.5 py-0 h-5 gap-1"
                      >
                        <Lock className="h-2.5 w-2.5" />
                      </Badge>
                    )}
                    {link.maxDownloads && (
                      <Badge
                        variant="outline"
                        className="bg-blue-500/10 text-blue-500 border-blue-500/20 text-[10px] px-1.5 py-0 h-5 gap-1"
                      >
                        <Download className="h-2.5 w-2.5" />
                        {link.downloadCount}/{link.maxDownloads}
                      </Badge>
                    )}
                    {link.expiresAt && !isExpired && (
                      <Badge
                        variant="outline"
                        className="bg-blue-500/10 text-blue-500 border-blue-500/20 text-[10px] px-1.5 py-0 h-5 gap-1"
                      >
                        <Clock className="h-2.5 w-2.5" />
                      </Badge>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => copyLink(link.shortId, link.file.name)}
                    >
                      {copiedId === link.shortId ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() =>
                        window.open(
                          `/share/${link.shortId}/${encodeURIComponent(link.file.name)}`,
                          "_blank"
                        )
                      }
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => deleteLink(link.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
