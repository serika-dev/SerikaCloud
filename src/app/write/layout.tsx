import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata = {
  title: "SerikaDocs — Documents",
  description: "Create and edit documents with SerikaDocs",
};

export default async function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-[#050505] text-zinc-950 dark:text-white selection:bg-blue-500/30 dark:selection:bg-blue-500/40 selection:text-zinc-900 dark:selection:text-white">
      {children}
    </div>
  );
}
