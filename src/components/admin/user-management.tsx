"use client";

import { useState, useEffect, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Search,
  CheckCircle,
  XCircle,
  Mail,
  RefreshCw,
  Shield,
  User,
  HardDrive,
  FileText,
  Presentation,
  Mailbox,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserWithStats {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
  storageUsed: number;
  _count: {
    files: number;
    folders: number;
    documents: number;
    presentations: number;
    mailboxes: number;
  };
}

interface Pagination {
  page: number;
  totalPages: number;
  total: number;
  perPage: number;
}

export function UserManagement() {
  const [users, setUsers] = useState<UserWithStats[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    totalPages: 1,
    total: 0,
    perPage: 20,
  });
  const [search, setSearch] = useState("");
  const [verifiedFilter, setVerifiedFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", pagination.page.toString());
      if (search) params.set("search", search);
      if (verifiedFilter) params.set("verified", verifiedFilter);

      const res = await fetch(`/api/admin/users?${params}`);
      if (!res.ok) throw new Error("Failed to fetch users");

      const data = await res.json();
      setUsers(data.users);
      setPagination(data.pagination);
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, search, verifiedFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleVerify = async (userId: string) => {
    setActionLoading(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/verify`, {
        method: "POST",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to verify user");
      }

      const data = await res.json();
      toast.success(data.message);
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to verify user");
    } finally {
      setActionLoading(null);
    }
  };

  const handleResendVerification = async (userId: string) => {
    setActionLoading(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/resend-verification`, {
        method: "POST",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to resend email");
      }

      const data = await res.json();
      toast.success(data.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resend email");
    } finally {
      setActionLoading(null);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            className="pl-10 bg-white dark:bg-[#0a0a0a] border-zinc-200 dark:border-[#1a1a1a]"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              {verifiedFilter === null && "All Users"}
              {verifiedFilter === "true" && "Verified Only"}
              {verifiedFilter === "false" && "Unverified Only"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setVerifiedFilter(null)}>
              All Users
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setVerifiedFilter("true")}>
              Verified Only
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setVerifiedFilter("false")}>
              Unverified Only
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="bg-white dark:bg-[#0a0a0a] border border-zinc-200 dark:border-[#1a1a1a] rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 dark:bg-[#111] border-b border-zinc-200 dark:border-[#1a1a1a]">
                <th className="px-4 py-3 text-left font-semibold text-zinc-600 dark:text-zinc-400">User</th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-600 dark:text-zinc-400">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-600 dark:text-zinc-400">Resources</th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-600 dark:text-zinc-400">Joined</th>
                <th className="px-4 py-3 text-right font-semibold text-zinc-600 dark:text-zinc-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-zinc-100 dark:border-[#1a1a1a] last:border-0 hover:bg-zinc-50 dark:hover:bg-[#111]"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                          <User className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                        </div>
                        <div>
                          <div className="font-medium text-zinc-900 dark:text-white flex items-center gap-2">
                            {user.name}
                            {user.isAdmin && (
                              <Shield className="h-3 w-3 text-violet-600 dark:text-violet-400" />
                            )}
                          </div>
                          <div className="text-zinc-500 dark:text-zinc-400 text-xs">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {user.emailVerified ? (
                        <Badge
                          variant="outline"
                          className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20"
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Verified
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                        >
                          <XCircle className="h-3 w-3 mr-1" />
                          Unverified
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="flex items-center gap-1 text-zinc-500">
                          <HardDrive className="h-3 w-3" />
                          {formatBytes(user.storageUsed)}
                        </span>
                        <span className="flex items-center gap-1 text-zinc-500">
                          <FileText className="h-3 w-3" />
                          {user._count.files}
                        </span>
                        <span className="flex items-center gap-1 text-zinc-500">
                          <Presentation className="h-3 w-3" />
                          {user._count.presentations}
                        </span>
                        <span className="flex items-center gap-1 text-zinc-500">
                          <Mailbox className="h-3 w-3" />
                          {user._count.mailboxes}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                      {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!user.emailVerified && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1 text-green-600 border-green-500/20 hover:bg-green-500/10"
                              onClick={() => handleVerify(user.id)}
                              disabled={actionLoading === user.id}
                            >
                              {actionLoading === user.id ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : (
                                <CheckCircle className="h-3 w-3" />
                              )}
                              Verify
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1"
                              onClick={() => handleResendVerification(user.id)}
                              disabled={actionLoading === user.id}
                            >
                              {actionLoading === user.id ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : (
                                <Mail className="h-3 w-3" />
                              )}
                              Resend
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-200 dark:border-[#1a1a1a]">
            <div className="text-sm text-zinc-500">
              Showing {(pagination.page - 1) * pagination.perPage + 1} -{" "}
              {Math.min(pagination.page * pagination.perPage, pagination.total)} of{" "}
              {pagination.total} users
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                disabled={pagination.page === 1 || loading}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                disabled={pagination.page === pagination.totalPages || loading}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
