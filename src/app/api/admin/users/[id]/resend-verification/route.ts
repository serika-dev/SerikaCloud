import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { nanoid } from "nanoid";
import { sendVerificationEmail } from "@/lib/email";

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

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, emailVerified: true, verificationToken: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user.emailVerified) {
    return NextResponse.json(
      { error: "User is already verified" },
      { status: 400 }
    );
  }

  const newToken = nanoid(32);

  await prisma.user.update({
    where: { id },
    data: { verificationToken: newToken },
  });

  const baseUrl = new URL(req.url).origin;

  try {
    await sendVerificationEmail(user.email, newToken, baseUrl);
  } catch (emailError) {
    console.error("Failed to send verification email:", emailError);
    return NextResponse.json(
      { error: "Failed to send verification email" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: `Verification email resent to ${user.email}.`,
  });
}
