import { prisma } from "@/lib/db";
import { Users, HardDrive, FileImage, Share2 } from "lucide-react";

export async function AdminPanel() {
  const userCount = await prisma.user.count();
  const fileCount = await prisma.file.count();
  const shareLinkCount = await prisma.shareLink.count();

  const totalStorageAggregation = await prisma.file.aggregate({
    _sum: {
      size: true,
    },
  });

  const totalBytes = Number(totalStorageAggregation._sum.size || 0);
  const tbInUse = (totalBytes / (1024 * 1024 * 1024 * 1024)).toFixed(2);
  const gbInUse = (totalBytes / (1024 * 1024 * 1024)).toFixed(2);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-black uppercase tracking-tighter">
          <span className="text-zinc-900 dark:text-white">Admin </span>
          <span className="text-violet-600 dark:text-[#8b5cf6]">Panel</span>
        </h2>
        <p className="text-sm text-zinc-500 dark:text-white/40 mt-1 font-medium">
          System Overview and Statistics
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-[#0a0a0a] border border-zinc-200 dark:border-[#1a1a1a] p-6 relative overflow-hidden group shadow-sm">
          <div className="absolute top-0 right-0 p-4 opacity-5 dark:opacity-10 group-hover:opacity-10 dark:group-hover:opacity-20 transition-opacity">
            <Users className="w-24 h-24 text-violet-600 dark:text-[#8b5cf6]" />
          </div>
          <div className="relative z-10">
            <h3 className="text-violet-600 dark:text-[#8b5cf6] font-bold uppercase tracking-wider text-xs mb-2">Total Users</h3>
            <p className="text-4xl font-black text-zinc-900 dark:text-white">{userCount.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0a0a0a] border border-zinc-200 dark:border-[#1a1a1a] p-6 relative overflow-hidden group shadow-sm">
          <div className="absolute top-0 right-0 p-4 opacity-5 dark:opacity-10 group-hover:opacity-10 dark:group-hover:opacity-20 transition-opacity">
            <HardDrive className="w-24 h-24 text-violet-600 dark:text-[#8b5cf6]" />
          </div>
          <div className="relative z-10">
            <h3 className="text-violet-600 dark:text-[#8b5cf6] font-bold uppercase tracking-wider text-xs mb-2">Storage In Use</h3>
            <p className="text-4xl font-black text-zinc-900 dark:text-white">{formatBytes(totalBytes)}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0a0a0a] border border-zinc-200 dark:border-[#1a1a1a] p-6 relative overflow-hidden group shadow-sm">
          <div className="absolute top-0 right-0 p-4 opacity-5 dark:opacity-10 group-hover:opacity-10 dark:group-hover:opacity-20 transition-opacity">
            <FileImage className="w-24 h-24 text-violet-600 dark:text-[#8b5cf6]" />
          </div>
          <div className="relative z-10">
            <h3 className="text-violet-600 dark:text-[#8b5cf6] font-bold uppercase tracking-wider text-xs mb-2">Total Files</h3>
            <p className="text-4xl font-black text-zinc-900 dark:text-white">{fileCount.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0a0a0a] border border-zinc-200 dark:border-[#1a1a1a] p-6 relative overflow-hidden group shadow-sm">
          <div className="absolute top-0 right-0 p-4 opacity-5 dark:opacity-10 group-hover:opacity-10 dark:group-hover:opacity-20 transition-opacity">
            <Share2 className="w-24 h-24 text-violet-600 dark:text-[#8b5cf6]" />
          </div>
          <div className="relative z-10">
            <h3 className="text-violet-600 dark:text-[#8b5cf6] font-bold uppercase tracking-wider text-xs mb-2">Active Share Links</h3>
            <p className="text-4xl font-black text-zinc-900 dark:text-white">{shareLinkCount.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#0a0a0a] border border-zinc-200 dark:border-[#1a1a1a] p-8 mt-12 shadow-sm relative overflow-hidden">
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
