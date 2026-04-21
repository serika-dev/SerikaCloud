"use client";

import { useState } from "react";
import { Users, HardDrive, FileImage, Share2, LayoutDashboard, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserManagement } from "./user-management";

interface AdminStats {
  userCount: number;
  fileCount: number;
  shareLinkCount: number;
  totalBytes: number;
}

interface AdminPanelProps {
  initialStats: AdminStats;
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function Overview({ stats }: { stats: AdminStats }) {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-[#0a0a0a] border border-zinc-200 dark:border-[#1a1a1a] p-6 relative overflow-hidden group shadow-sm">
          <div className="absolute top-0 right-0 p-4 opacity-5 dark:opacity-10 group-hover:opacity-10 dark:group-hover:opacity-20 transition-opacity">
            <Users className="w-24 h-24 text-violet-600 dark:text-[#8b5cf6]" />
          </div>
          <div className="relative z-10">
            <h3 className="text-violet-600 dark:text-[#8b5cf6] font-bold uppercase tracking-wider text-xs mb-2">Total Users</h3>
            <p className="text-4xl font-black text-zinc-900 dark:text-white">{stats.userCount.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0a0a0a] border border-zinc-200 dark:border-[#1a1a1a] p-6 relative overflow-hidden group shadow-sm">
          <div className="absolute top-0 right-0 p-4 opacity-5 dark:opacity-10 group-hover:opacity-10 dark:group-hover:opacity-20 transition-opacity">
            <HardDrive className="w-24 h-24 text-violet-600 dark:text-[#8b5cf6]" />
          </div>
          <div className="relative z-10">
            <h3 className="text-violet-600 dark:text-[#8b5cf6] font-bold uppercase tracking-wider text-xs mb-2">Storage In Use</h3>
            <p className="text-4xl font-black text-zinc-900 dark:text-white">{formatBytes(stats.totalBytes)}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0a0a0a] border border-zinc-200 dark:border-[#1a1a1a] p-6 relative overflow-hidden group shadow-sm">
          <div className="absolute top-0 right-0 p-4 opacity-5 dark:opacity-10 group-hover:opacity-10 dark:group-hover:opacity-20 transition-opacity">
            <FileImage className="w-24 h-24 text-violet-600 dark:text-[#8b5cf6]" />
          </div>
          <div className="relative z-10">
            <h3 className="text-violet-600 dark:text-[#8b5cf6] font-bold uppercase tracking-wider text-xs mb-2">Total Files</h3>
            <p className="text-4xl font-black text-zinc-900 dark:text-white">{stats.fileCount.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0a0a0a] border border-zinc-200 dark:border-[#1a1a1a] p-6 relative overflow-hidden group shadow-sm">
          <div className="absolute top-0 right-0 p-4 opacity-5 dark:opacity-10 group-hover:opacity-10 dark:group-hover:opacity-20 transition-opacity">
            <Share2 className="w-24 h-24 text-violet-600 dark:text-[#8b5cf6]" />
          </div>
          <div className="relative z-10">
            <h3 className="text-violet-600 dark:text-[#8b5cf6] font-bold uppercase tracking-wider text-xs mb-2">Active Share Links</h3>
            <p className="text-4xl font-black text-zinc-900 dark:text-white">{stats.shareLinkCount.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#0a0a0a] border border-zinc-200 dark:border-[#1a1a1a] p-8 shadow-sm relative overflow-hidden">
         <h3 className="text-xl font-bold uppercase tracking-tight mb-4 text-zinc-900 dark:text-white">System Health</h3>
         <div className="flex items-center gap-4 text-sm font-medium z-10 relative">
           <div className="flex h-3 w-3 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
           <span className="text-zinc-600 dark:text-white/60">PostgreSQL Database Connected Successfully</span>
         </div>
         <div className="absolute top-0 left-0 w-2 h-full bg-green-500/20" />
      </div>
    </div>
  );
}

export function AdminPanel({ initialStats }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "users">("overview");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-black uppercase tracking-tighter">
          <span className="text-zinc-900 dark:text-white">Admin </span>
          <span className="text-violet-600 dark:text-[#8b5cf6]">Panel</span>
        </h2>
        <p className="text-sm text-zinc-500 dark:text-white/40 mt-1 font-medium">
          System administration and user management
        </p>
      </div>

      <div className="flex gap-2 border-b border-zinc-200 dark:border-[#1a1a1a]">
        <Button
          variant="ghost"
          className={`rounded-none border-b-2 px-4 py-2 font-semibold tracking-wide ${
            activeTab === "overview"
              ? "border-violet-600 text-violet-600 dark:border-[#8b5cf6] dark:text-[#8b5cf6]"
              : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
          onClick={() => setActiveTab("overview")}
        >
          <LayoutDashboard className="h-4 w-4 mr-2" />
          Overview
        </Button>
        <Button
          variant="ghost"
          className={`rounded-none border-b-2 px-4 py-2 font-semibold tracking-wide ${
            activeTab === "users"
              ? "border-violet-600 text-violet-600 dark:border-[#8b5cf6] dark:text-[#8b5cf6]"
              : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
          onClick={() => setActiveTab("users")}
        >
          <UserCog className="h-4 w-4 mr-2" />
          User Management
        </Button>
      </div>

      {activeTab === "overview" && <Overview stats={initialStats} />}
      {activeTab === "users" && <UserManagement />}
    </div>
  );
}
