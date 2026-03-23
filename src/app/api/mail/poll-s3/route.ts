import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { simpleParser } from "mailparser";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// SES stores emails in S3 as raw .eml files
// This endpoint polls S3 and processes them into the database

const s3 = new S3Client({
  region: process.env.AWS_SES_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY || "",
  },
});

const BUCKET_NAME = process.env.SES_S3_BUCKET_NAME;
const PREFIX = process.env.SES_S3_PREFIX || "";

async function processEmailFromS3(key: string) {
  if (!BUCKET_NAME) throw new Error("SES_S3_BUCKET_NAME not configured");

  // Download the raw email from S3
  const getCmd = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });
  const obj = await s3.send(getCmd);
  const body = await obj.Body?.transformToByteArray();
  if (!body) throw new Error("Empty S3 object");

  // Parse the email
  const parsed = await simpleParser(Buffer.from(body));

  const fromValue = parsed.from as any;
  const fromAddress = fromValue?.value?.[0]?.address || fromValue?.text || "unknown";
  const fromName = fromValue?.value?.[0]?.name || null;
  const toValue = parsed.to as any;
  const toAddresses = toValue?.value?.map((v: any) => v?.address).filter(Boolean) as string[] || [];
  const ccValue = parsed.cc as any;
  const ccAddresses = ccValue?.value?.map((v: any) => v?.address).filter(Boolean) as string[] || [];
  const subject = parsed.subject || "(No Subject)";
  const text = parsed.text || null;
  const html = parsed.html || null;
  const messageId = parsed.messageId || null;
  const inReplyTo = parsed.inReplyTo || null;
  const references = Array.isArray(parsed.references)
    ? parsed.references.join(", ")
    : parsed.references || null;

  let delivered = 0;

  // Try to deliver to each recipient
  for (const recipient of toAddresses) {
    // Find mailbox by primary address or alias
    let mailbox = await prisma.mailbox.findUnique({
      where: { address: recipient.toLowerCase() },
      include: { folders: true },
    });

    if (!mailbox) {
      const alias = await prisma.emailAlias.findUnique({
        where: { address: recipient.toLowerCase() },
        include: { mailbox: { include: { folders: true } } },
      });
      if (alias) mailbox = alias.mailbox;
    }

    if (!mailbox) continue;

    const inboxFolder = mailbox.folders.find((f) => f.type === "inbox");
    if (!inboxFolder) continue;

    // Check if email already exists (by messageId)
    if (messageId) {
      const existing = await prisma.email.findFirst({
        where: { messageId, mailboxId: mailbox.id },
      });
      if (existing) continue;
    }

    await prisma.email.create({
      data: {
        messageId,
        fromAddress,
        fromName,
        toAddresses,
        ccAddresses,
        subject,
        bodyText: text,
        bodyHtml: html,
        mailboxId: mailbox.id,
        folderId: inboxFolder.id,
        inReplyTo: (inReplyTo || undefined) as any,
        references: (references || undefined) as any,
        headers: undefined,
      },
    });

    delivered++;
  }

  return { delivered, key };
}

// POST /api/mail/poll-s3 - Poll S3 for new emails
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!BUCKET_NAME) {
    return NextResponse.json(
      { error: "SES_S3_BUCKET_NAME not configured" },
      { status: 500 }
    );
  }

  try {
    const { deleteAfterProcess = true, maxKeys = 50 } = await req.json().catch(() => ({}));

    // List objects in S3
    const listCmd = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: PREFIX,
      MaxKeys: maxKeys,
    });
    const listResult = await s3.send(listCmd);

    if (!listResult.Contents || listResult.Contents.length === 0) {
      return NextResponse.json({ success: true, processed: 0, message: "No new emails" });
    }

    const results = [];
    let totalDelivered = 0;

    for (const obj of listResult.Contents) {
      if (!obj.Key || obj.Key.endsWith("/")) continue;
      // Skip SES setup notification and non-email files
      const keyName = obj.Key.split("/").pop() || "";
      if (keyName.startsWith("AMAZON_SES_SETUP_NOTIFICATION")) continue;
      if (keyName.endsWith(".json") || keyName.endsWith(".txt")) continue;

      try {
        const { delivered, key } = await processEmailFromS3(obj.Key);
        totalDelivered += delivered;
        results.push({ key, delivered, status: "success" });

        // Optionally delete from S3 after processing
        if (deleteAfterProcess && delivered > 0) {
          const delCmd = new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: obj.Key,
          });
          await s3.send(delCmd);
        }
      } catch (err: any) {
        results.push({ key: obj.Key, error: err.message, status: "error" });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      delivered: totalDelivered,
      results,
    });
  } catch (error: any) {
    console.error("S3 poll error:", error);
    return NextResponse.json(
      { error: "Failed to poll S3", details: error.message },
      { status: 500 }
    );
  }
}

// GET /api/mail/poll-s3/status - Check S3 connection
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    configured: !!BUCKET_NAME,
    bucket: BUCKET_NAME,
    prefix: PREFIX,
    region: process.env.AWS_SES_REGION,
  });
}
