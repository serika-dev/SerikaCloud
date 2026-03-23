import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata = {
  title: "SerikaMail — Email",
  description: "Your email powered by SerikaMail",
};

export default async function MailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-[#050505] text-zinc-950 dark:text-white selection:bg-emerald-500/30 dark:selection:bg-emerald-500/40 selection:text-zinc-900 dark:selection:text-white">
      {children}
    </div>
  );
}
