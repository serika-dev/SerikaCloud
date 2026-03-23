import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata = {
  title: "SerikaPresent — Presentations",
  description: "Create stunning presentations with SerikaPresent",
};

export default async function PresentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-[#050505] text-zinc-950 dark:text-white selection:bg-orange-500/30 dark:selection:bg-orange-500/40 selection:text-zinc-900 dark:selection:text-white">
      {children}
    </div>
  );
}
