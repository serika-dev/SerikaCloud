import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FileBrowser } from "@/components/files/file-browser";
import { AdminPanel } from "@/components/admin/admin-panel";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });

  if (user?.isAdmin) {
    const [userCount, fileCount, shareLinkCount, totalStorageAggregation] = await Promise.all([
      prisma.user.count(),
      prisma.file.count(),
      prisma.shareLink.count(),
      prisma.file.aggregate({ _sum: { size: true } }),
    ]);

    const stats = {
      userCount,
      fileCount,
      shareLinkCount,
      totalBytes: Number(totalStorageAggregation._sum.size || 0),
    };

    return <AdminPanel initialStats={stats} />;
  }

  return <FileBrowser folderId={null} />;
}
