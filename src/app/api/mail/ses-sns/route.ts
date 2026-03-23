import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { simpleParser } from "mailparser";
import { prisma } from "@/lib/db";

// SNS webhook handler for SES notifications
// SES can notify via SNS when emails arrive in S3

const s3 = new S3Client({
  region: process.env.AWS_SES_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY || "",
  },
});

interface SNSMessage {
  Type?: string;
  Message?: string;
  MessageId?: string;
  TopicArn?: string;
  Subject?: string;
  Timestamp?: string;
  SignatureVersion?: string;
  Signature?: string;
  SigningCertURL?: string;
  SubscribeURL?: string;
  UnsubscribeURL?: string;
}

interface SESNotification {
  eventType?: string;
  mail?: {
    timestamp?: string;
    source?: string;
    messageId?: string;
    destination?: string[];
    headersTruncated?: boolean;
    headers?: { name: string; value: string }[];
    commonHeaders?: {
      from?: string[];
      to?: string[];
      messageId?: string;
      subject?: string;
      date?: string;
    };
  };
  receipt?: {
    timestamp?: string;
    processingTimeMillis?: number;
    recipients?: string[];
    spamVerdict?: { status?: string };
    virusVerdict?: { status?: string };
    spfVerdict?: { status?: string };
    dkimVerdict?: { status?: string };
    dmarcVerdict?: { status?: string };
    action?: {
      type?: string;
      topicArn?: string;
      bucketName?: string;
      objectKey?: string;
      objectKeyPrefix?: string;
    };
  };
}

async function processS3Email(bucketName: string, objectKey: string) {
  // Download the raw email from S3
  const getCmd = new GetObjectCommand({
    Bucket: bucketName,
    Key: objectKey,
  });
  const obj = await s3.send(getCmd);
  const body = await obj.Body?.transformToByteArray();
  if (!body) throw new Error("Empty S3 object");

  // Parse the email
  const parsed = await simpleParser(Buffer.from(body));

  const fromValue = parsed.from as any;
  const fromAddress: string = fromValue?.value?.[0]?.address || fromValue?.text || "unknown";
  const fromName = fromValue?.value?.[0]?.name || null;
  const toValue = parsed.to;
  const toAddresses = toValue && 'value' in toValue && Array.isArray(toValue.value)
    ? toValue.value.map((v: { address?: string }) => v.address).filter((a): a is string => !!a)
    : [];
  const ccValue = parsed.cc;
  const ccAddresses = ccValue && 'value' in ccValue && Array.isArray(ccValue.value)
    ? ccValue.value.map((v: { address?: string }) => v.address).filter((a): a is string => !!a)
    : [];
  const subject = parsed.subject || "(No Subject)";
  const text = parsed.text || null;
  const html = parsed.html || null;
  const messageId = parsed.messageId || null;
  const inReplyTo = parsed.inReplyTo || null;
  const references = Array.isArray(parsed.references)
    ? parsed.references.join(", ")
    : parsed.references || null;

  let delivered = 0;
  const deliveries = [];

  // Try to deliver to each recipient
  for (const recipient of toAddresses) {
    const lowerRecipient = recipient.toLowerCase();

    // Find mailbox by primary address or alias
    let mailbox = await prisma.mailbox.findUnique({
      where: { address: lowerRecipient },
      include: { folders: true },
    });

    if (!mailbox) {
      const alias = await prisma.emailAlias.findUnique({
        where: { address: lowerRecipient },
        include: { mailbox: { include: { folders: true } } },
      });
      if (alias) mailbox = alias.mailbox;
    }

    if (!mailbox) {
      deliveries.push({ recipient, status: "no_mailbox" });
      continue;
    }

    const inboxFolder = mailbox.folders.find((f) => f.type === "inbox");
    if (!inboxFolder) {
      deliveries.push({ recipient, status: "no_inbox" });
      continue;
    }

    // Check if email already exists (by messageId)
    if (messageId) {
      const existing = await prisma.email.findFirst({
        where: { messageId, mailboxId: mailbox.id },
      });
      if (existing) {
        deliveries.push({ recipient, status: "duplicate" });
        continue;
      }
    }

    await prisma.email.create({
      data: {
        messageId,
        fromAddress: fromAddress || "unknown",
        fromName,
        toAddresses,
        ccAddresses,
        subject: subject || "(No Subject)",
        bodyText: text,
        bodyHtml: html,
        mailboxId: mailbox.id,
        folderId: inboxFolder.id,
        inReplyTo: inReplyTo || undefined,
        references: references || undefined,
        headers: undefined,
      } as any,
    });

    delivered++;
    deliveries.push({ recipient, status: "delivered", mailbox: mailbox.address });
  }

  return { delivered, deliveries, parsed };
}

// POST /api/mail/ses-sns - Handle SES SNS notifications
export async function POST(req: NextRequest) {
  try {
    const snsMessage: SNSMessage = await req.json();

    // Handle SNS subscription confirmation
    if (snsMessage.Type === "SubscriptionConfirmation") {
      console.log("SNS Subscription Confirmation received:", snsMessage.SubscribeURL);
      // You could auto-confirm by fetching the URL, but that's security-sensitive
      // Better to log it and confirm manually or via separate admin endpoint
      return NextResponse.json({
        success: true,
        message: "Subscription confirmation received. Confirm manually for security.",
        subscribeURL: snsMessage.SubscribeURL,
      });
    }

    // Handle unsubscribe (shouldn't happen for SES)
    if (snsMessage.Type === "UnsubscribeConfirmation") {
      return NextResponse.json({ success: true, message: "Unsubscribe received" });
    }

    // Process SES notification
    if (snsMessage.Type === "Notification" && snsMessage.Message) {
      const sesNotification: SESNotification = JSON.parse(snsMessage.Message);

      // Only process receive events
      if (sesNotification.eventType !== "Receive") {
        return NextResponse.json({
          success: true,
          message: `Ignored event type: ${sesNotification.eventType}`,
        });
      }

      const action = sesNotification.receipt?.action;
      if (!action || action.type !== "S3") {
        return NextResponse.json({
          error: "No S3 action in notification",
        }, { status: 400 });
      }

      const bucketName = action.bucketName;
      const objectKey = action.objectKey;

      if (!bucketName || !objectKey) {
        return NextResponse.json({
          error: "Missing S3 bucket or object key",
        }, { status: 400 });
      }

      // Process the email
      const { delivered, deliveries } = await processS3Email(bucketName, objectKey);

      // Optionally delete from S3 after processing
      const deleteAfter = process.env.SES_S3_DELETE_AFTER_PROCESS === "true";
      if (deleteAfter && delivered > 0) {
        try {
          const delCmd = new DeleteObjectCommand({
            Bucket: bucketName,
            Key: objectKey,
          });
          await s3.send(delCmd);
        } catch (err) {
          console.error("Failed to delete S3 object:", err);
        }
      }

      return NextResponse.json({
        success: true,
        delivered,
        deliveries,
        bucket: bucketName,
        key: objectKey,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Unknown message type",
      type: snsMessage.Type,
    });
  } catch (error: any) {
    console.error("SES SNS handler error:", error);
    return NextResponse.json(
      { error: "Failed to process notification", details: error.message },
      { status: 500 }
    );
  }
}
