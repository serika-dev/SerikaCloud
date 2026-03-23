import { NextResponse } from "next/server";
import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { simpleParser } from "mailparser";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

const s3 = new S3Client({
  region: process.env.AWS_SES_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY || "",
  },
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const report: Record<string, any> = {};

  // 1. Config check
  report.config = {
    SES_S3_BUCKET_NAME: process.env.SES_S3_BUCKET_NAME || "NOT SET",
    SES_S3_PREFIX: process.env.SES_S3_PREFIX || "(empty = root)",
    AWS_SES_REGION: process.env.AWS_SES_REGION || "NOT SET",
    AWS_SES_ACCESS_KEY_ID: process.env.AWS_SES_ACCESS_KEY_ID ? "SET" : "NOT SET",
    AWS_SES_SECRET_ACCESS_KEY: process.env.AWS_SES_SECRET_ACCESS_KEY ? "SET" : "NOT SET",
    MAIL_DOMAIN: process.env.MAIL_DOMAIN || "NOT SET",
  };

  // 2. DB: all mailboxes for this user
  try {
    const mailboxes = await prisma.mailbox.findMany({
      where: { userId: session.user.id },
      include: {
        aliases: true,
        folders: { select: { id: true, type: true, name: true } },
      },
    });
    report.mailboxes = mailboxes.map((m) => ({
      id: m.id,
      address: m.address,
      isPrimary: m.isPrimary,
      folders: m.folders.map((f) => f.type),
      aliases: m.aliases.map((a) => a.address),
    }));
  } catch (e: any) {
    report.mailboxes = { error: e.message };
  }

  // 3. S3 bucket contents
  const bucketName = process.env.SES_S3_BUCKET_NAME;
  const prefix = process.env.SES_S3_PREFIX || "";

  if (!bucketName) {
    report.s3 = { error: "SES_S3_BUCKET_NAME not configured" };
  } else {
    try {
      const listCmd = new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: prefix,
        MaxKeys: 20,
      });
      const listResult = await s3.send(listCmd);
      report.s3 = {
        bucket: bucketName,
        prefix: prefix || "(root)",
        objectCount: listResult.Contents?.length ?? 0,
        objects: (listResult.Contents || []).map((o) => ({
          key: o.Key,
          size: o.Size,
          lastModified: o.LastModified,
        })),
      };

      // 4. Try to parse the first non-setup email
      const firstEmail = (listResult.Contents || []).find((o) => {
        const name = o.Key?.split("/").pop() || "";
        return !name.startsWith("AMAZON_SES_SETUP_NOTIFICATION") &&
          !name.endsWith(".json") && !name.endsWith(".txt") && !o.Key?.endsWith("/");
      });

      if (firstEmail?.Key) {
        try {
          const getCmd = new GetObjectCommand({ Bucket: bucketName, Key: firstEmail.Key });
          const obj = await s3.send(getCmd);
          const body = await obj.Body?.transformToByteArray();
          if (body) {
            const parsed = await simpleParser(Buffer.from(body));
            const fromValue = parsed.from as any;
            const toValue = parsed.to as any;
            const toAddresses: string[] = toValue?.value?.map((v: any) => v?.address).filter(Boolean) || [];

            report.sampleEmail = {
              key: firstEmail.Key,
              from: fromValue?.value?.[0]?.address || fromValue?.text,
              to: toAddresses,
              subject: parsed.subject,
              messageId: parsed.messageId,
            };

            // Check if any recipient matches a mailbox
            report.deliverySimulation = [];
            for (const addr of toAddresses) {
              const lower = addr.toLowerCase();
              const mailbox = await prisma.mailbox.findUnique({ where: { address: lower } });
              const alias = !mailbox
                ? await prisma.emailAlias.findUnique({
                    where: { address: lower },
                    include: { mailbox: true },
                  })
                : null;

              report.deliverySimulation.push({
                recipient: addr,
                foundMailbox: !!mailbox,
                foundAlias: !!alias,
                wouldDeliver: !!(mailbox || alias),
                matchedAddress: mailbox?.address || alias?.mailbox?.address || null,
              });
            }
          }
        } catch (e: any) {
          report.sampleEmail = { error: e.message, key: firstEmail.Key };
        }
      } else {
        report.sampleEmail = "No processable email found in bucket";
      }
    } catch (e: any) {
      report.s3 = { error: e.message, stack: e.stack?.split("\n")[0] };
    }
  }

  // 5. All mailboxes in DB
  try {
    const allMailboxes = await prisma.mailbox.findMany({
      select: { address: true, isPrimary: true },
    });
    report.allMailboxAddresses = allMailboxes.map((m) => m.address);
  } catch (e: any) {
    report.allMailboxAddresses = { error: e.message };
  }

  // 6. Wider S3 scan — list ALL objects regardless of prefix
  if (bucketName) {
    try {
      const allObjects = await s3.send(new ListObjectsV2Command({ Bucket: bucketName, MaxKeys: 50 }));
      report.s3AllObjects = (allObjects.Contents || []).map((o) => ({
        key: o.Key,
        size: o.Size,
        lastModified: o.LastModified,
      }));
    } catch (e: any) {
      report.s3AllObjects = { error: e.message };
    }
  }

  return NextResponse.json(report, { status: 200 });
}
