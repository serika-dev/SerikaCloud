"use client";

import { SessionProvider } from "next-auth/react";
import { Sidebar } from "./sidebar";
import { useEffect, useState } from "react";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [user, setUser] = useState<{
    name: string;
    email: string;
    storageUsed: number;
    storageLimit: number;
    isAdmin?: boolean;
  } | null>(null);

  const fetchUser = async () => {
    try {
      const res = await fetch("/api/user");
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      }
    } catch (e) {
      console.error("Failed to fetch user", e);
    }
  };

  useEffect(() => {
    fetchUser();

    // Refresh user data periodically to keep storage info updated
    const interval = setInterval(fetchUser, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <SessionProvider>
      <div className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-[#050505] text-zinc-950 dark:text-white selection:bg-violet-500/30 dark:selection:bg-[#8b5cf6] selection:text-zinc-900 dark:selection:text-white">
        <Sidebar user={user} />
        <main className="flex-1 overflow-auto">
          <div className="container max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
            {children}
          </div>
        </main>
      </div>
    </SessionProvider>
  );
}
