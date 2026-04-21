import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UserManagement } from "@/components/admin/user-management";
import { redirect } from "next/navigation";

export default async function AdminUsersPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });

  if (!user?.isAdmin) {
    redirect("/");
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-black uppercase tracking-tighter">
          <span className="text-zinc-900 dark:text-white">User </span>
          <span className="text-violet-600 dark:text-[#8b5cf6]">Management</span>
        </h2>
        <p className="text-sm text-zinc-500 dark:text-white/40 mt-1 font-medium">
          Manage users, verify accounts, and view user details
        </p>
      </div>

      <UserManagement />
    </div>
  );
}
