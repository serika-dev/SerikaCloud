import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const toggleAdminSchema = z.object({
  isAdmin: z.boolean(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });

  if (!admin?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  // Prevent self-demotion
  if (id === session.user.id) {
    return NextResponse.json(
      { error: "Cannot modify your own admin status" },
      { status: 400 }
    );
  }

  const body = await req.json();
  const validation = toggleAdminSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0].message },
      { status: 400 }
    );
  }

  const { isAdmin } = validation.data;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, isAdmin: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await prisma.user.update({
    where: { id },
    data: { isAdmin },
  });

  return NextResponse.json({
    success: true,
    message: `${user.email} is now ${isAdmin ? "an admin" : "a regular user"}.`,
    user: { ...user, isAdmin },
  });
}
