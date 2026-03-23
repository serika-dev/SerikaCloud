"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Cloud,
  Files,
  Share2,
  Settings,
  LogOut,
  Menu,
  X,
  Gauge,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { StorageIndicator } from "@/components/files/storage-indicator";
import { ThemeToggle } from "@/components/theme-toggle";

interface SidebarProps {
  user: {
    name: string;
    email: string;
    storageUsed: number;
    storageLimit: number;
    isAdmin?: boolean;
  } | null;
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const userNavItems = [
    { href: "/", label: "My Files", icon: Files },
    { href: "/recent", label: "Recent Files", icon: Clock },
    { href: "/shared", label: "Shared Links", icon: Share2 },
  ];

  const adminNavItems = [
    { href: "/", label: "Admin Dashboard", icon: Gauge },
  ];

  const navItems = user?.isAdmin ? adminNavItems : userNavItems;

  const NavContent = () => (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-6">
        <Link href="/" className="group inline-block">
          <Image
            src="/Logo.svg"
            alt="SerikaCloud"
            width={160}
            height={45}
            className="h-7 w-auto transition-all duration-300 group-hover:drop-shadow-[0_0_15px_rgba(139,92,246,0.3)]"
            priority
          />
        </Link>
      </div>

      <Separator className="bg-zinc-200 dark:bg-[#1a1a1a]" />

      {/* Navigation */}
      <nav className="flex-1 space-y-1.5 px-3 py-6">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant={isActive ? "secondary" : "ghost"}
                className={`w-full justify-start gap-3 h-11 uppercase tracking-wider font-bold transition-all ${
                  isActive
                    ? "bg-violet-100/50 text-violet-700 hover:bg-violet-100 border-l-2 border-violet-600 rounded-none shadow-[inset_2px_0_0_0_#7c3aed] dark:bg-[#8b5cf6]/10 dark:text-[#8b5cf6] dark:hover:bg-[#8b5cf6]/20 dark:border-l-2 dark:border-[#8b5cf6] dark:shadow-[inset_2px_0_0_0_#8b5cf6]"
                    : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-white/40 dark:hover:text-white dark:hover:bg-white/5 rounded-none border-l-2 border-transparent"
                }`}
                onClick={() => setMobileOpen(false)}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Button>
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="space-y-3 px-4 pb-4">
        {user && !user.isAdmin && (
          <StorageIndicator used={user.storageUsed} limit={user.storageLimit} />
        )}
        <Separator className="bg-zinc-200 dark:bg-[#1a1a1a]" />
        <div className="flex items-center justify-between">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
        {user && (
          <div className="px-1">
            <p className="text-xs font-medium truncate">{user.name}</p>
            <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-3 left-3 z-50 md:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:sticky top-0 left-0 z-40 h-screen w-64 border-r border-zinc-200 dark:border-[#1a1a1a] bg-zinc-50 dark:bg-[#0a0a0a]
          transition-transform duration-200 md:translate-x-0
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <NavContent />
      </aside>
    </>
  );
}
