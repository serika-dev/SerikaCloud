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
  ChevronDown,
  ChevronUp,
  Trash2,
  Key,
  Crown,
  Building2,
  FolderOpen,
  FileCode,
  Clock,
  Edit3,
  Database,
  Plus,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface UserWithStats {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
  storageUsed: number;
  storageLimit: number;
  _count: {
    files: number;
    folders: number;
    documents: number;
    presentations: number;
    mailboxes: number;
    orgMemberships: number;
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
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserWithStats | null>(null);

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

  const toggleExpanded = (userId: string) => {
    setExpandedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

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

  const handleToggleAdmin = async (user: UserWithStats) => {
    setActionLoading(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAdmin: !user.isAdmin }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update admin status");
      }

      const data = await res.json();
      toast.success(data.message);
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update admin status");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setActionLoading(userToDelete.id);
    try {
      const res = await fetch(`/api/admin/users/${userToDelete.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete user");
      }

      toast.success(`User ${userToDelete.email} has been deleted`);
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete user");
    } finally {
      setActionLoading(null);
    }
  };

  const handleIncreaseStorage = async (user: UserWithStats, additionalBytes: number) => {
    setActionLoading(user.id);
    try {
      const newLimit = Number(user.storageLimit) + additionalBytes;
      const res = await fetch(`/api/admin/users/${user.id}/storage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storageLimit: newLimit }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to increase storage");
      }

      const data = await res.json();
      toast.success(data.message);
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to increase storage");
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
                <th className="px-4 py-3 text-left font-semibold text-zinc-600 dark:text-zinc-400 w-8"></th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-600 dark:text-zinc-400">User</th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-600 dark:text-zinc-400">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-600 dark:text-zinc-400">Resources</th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-600 dark:text-zinc-400">Joined</th>
                <th className="px-4 py-3 text-right font-semibold text-zinc-600 dark:text-zinc-400">Quick Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <>
                    <tr
                      key={user.id}
                      className="border-b border-zinc-100 dark:border-[#1a1a1a] last:border-0 hover:bg-zinc-50 dark:hover:bg-[#111] cursor-pointer"
                      onClick={() => toggleExpanded(user.id)}
                    >
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          {expandedUsers.has(user.id) ? (
                            <ChevronUp className="h-4 w-4 text-zinc-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-zinc-400" />
                          )}
                        </Button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                            <User className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                          </div>
                          <div>
                            <div className="font-medium text-zinc-900 dark:text-white flex items-center gap-2">
                              {user.name}
                              {user.isAdmin && (
                                <Crown className="h-3 w-3 text-amber-500" />
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
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleVerify(user.id);
                                }}
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
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleResendVerification(user.id);
                                }}
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
                    {expandedUsers.has(user.id) && (
                      <tr className="bg-zinc-50/50 dark:bg-[#0d0d0d] border-b border-zinc-100 dark:border-[#1a1a1a]">
                        <td colSpan={6} className="px-4 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-3">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                                User Details
                              </h4>
                              <div className="space-y-1 text-xs">
                                <div className="flex justify-between">
                                  <span className="text-zinc-500">User ID:</span>
                                  <span className="font-mono text-zinc-700 dark:text-zinc-300">{user.id.slice(0, 8)}...</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-zinc-500">Storage Limit:</span>
                                  <span className="text-zinc-700 dark:text-zinc-300">{formatBytes(user.storageLimit)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-zinc-500">Last Updated:</span>
                                  <span className="text-zinc-700 dark:text-zinc-300">
                                    {formatDistanceToNow(new Date(user.updatedAt), { addSuffix: true })}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-zinc-500">Organizations:</span>
                                  <span className="text-zinc-700 dark:text-zinc-300">{user._count.orgMemberships}</span>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-3">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                                Resources Breakdown
                              </h4>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                                  <FolderOpen className="h-3 w-3" />
                                  <span>{user._count.folders} folders</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                                  <FileText className="h-3 w-3" />
                                  <span>{user._count.files} files</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                                  <FileCode className="h-3 w-3" />
                                  <span>{user._count.documents} documents</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                                  <Presentation className="h-3 w-3" />
                                  <span>{user._count.presentations} presentations</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                                  <Mailbox className="h-3 w-3" />
                                  <span>{user._count.mailboxes} mailboxes</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                                  <Building2 className="h-3 w-3" />
                                  <span>{user._count.orgMemberships} orgs</span>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-3">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                                Storage Management
                              </h4>
                              <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                  <span className="text-zinc-500">Current Limit:</span>
                                  <span className="font-medium text-zinc-700 dark:text-zinc-300">{formatBytes(user.storageLimit)}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-zinc-500">Used:</span>
                                  <span className="font-medium text-zinc-700 dark:text-zinc-300">{formatBytes(user.storageUsed)}</span>
                                </div>
                                <div className="flex flex-wrap gap-1 pt-1">
                                  {[
                                    { label: "+10GB", bytes: 10 * 1024 * 1024 * 1024 },
                                    { label: "+50GB", bytes: 50 * 1024 * 1024 * 1024 },
                                    { label: "+100GB", bytes: 100 * 1024 * 1024 * 1024 },
                                    { label: "+500GB", bytes: 500 * 1024 * 1024 * 1024 },
                                    { label: "+1TB", bytes: 1024 * 1024 * 1024 * 1024 },
                                  ].map((option) => (
                                    <Button
                                      key={option.label}
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-2 text-xs text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/10"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleIncreaseStorage(user, option.bytes);
                                      }}
                                      disabled={actionLoading === user.id}
                                    >
                                      <Plus className="h-3 w-3 mr-1" />
                                      {option.label}
                                    </Button>
                                  ))}
                                </div>
                              </div>
                            </div>

                            <div className="space-y-3">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                                Admin Actions
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className={`h-8 gap-1 text-xs ${
                                    user.isAdmin
                                      ? "text-amber-600 border-amber-500/20 hover:bg-amber-500/10"
                                      : "text-violet-600 border-violet-500/20 hover:bg-violet-500/10"
                                  }`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleAdmin(user);
                                  }}
                                  disabled={actionLoading === user.id}
                                >
                                  {actionLoading === user.id ? (
                                    <RefreshCw className="h-3 w-3 animate-spin" />
                                  ) : user.isAdmin ? (
                                    <><Shield className="h-3 w-3" /> Remove Admin</>
                                  ) : (
                                    <><Crown className="h-3 w-3" /> Make Admin</>
                                  )}
                                </Button>

                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 gap-1 text-xs text-blue-600 border-blue-500/20 hover:bg-blue-500/10"
                                  onClick={(e) => e.stopPropagation()}
                                  disabled={actionLoading === user.id}
                                >
                                  <Key className="h-3 w-3" />
                                  Reset Password
                                </Button>

                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 gap-1 text-xs text-red-600 border-red-500/20 hover:bg-red-500/10"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setUserToDelete(user);
                                    setDeleteDialogOpen(true);
                                  }}
                                  disabled={actionLoading === user.id}
                                >
                                  <Trash2 className="h-3 w-3" />
                                  Delete User
                                </Button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
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

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{userToDelete?.email}</strong>? This action cannot be undone.
              All user data including files, documents, and emails will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteUser}
              disabled={actionLoading === userToDelete?.id}
            >
              {actionLoading === userToDelete?.id ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
