import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireOrgRole } from "@/lib/org";
import { promises as dns } from "dns";

const MAIL_DOMAIN = process.env.MAIL_DOMAIN || "serika.pro";

// GET — List org domains
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgId } = await params;
  const membership = await requireOrgRole(session.user.id, orgId, "MEMBER");
  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const domains = await prisma.orgDomain.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ domains });
}

// POST — Add a new domain (admin+)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgId } = await params;
  const membership = await requireOrgRole(session.user.id, orgId, "ADMIN");
  if (!membership) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { domain } = await req.json();
  if (!domain) {
    return NextResponse.json({ error: "Domain required" }, { status: 400 });
  }

  // Validate domain format
  const cleanDomain = domain.toLowerCase().trim();
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/.test(cleanDomain)) {
    return NextResponse.json({ error: "Invalid domain format" }, { status: 400 });
  }

  // Block platform domains
  const blocked = [MAIL_DOMAIN, "serika.dev", "serika.email", "serika.pro"];
  if (blocked.includes(cleanDomain)) {
    return NextResponse.json({ error: "Cannot add platform domains" }, { status: 400 });
  }

  // Check if domain already claimed
  const existing = await prisma.orgDomain.findUnique({ where: { domain: cleanDomain } });
  if (existing) {
    return NextResponse.json({ error: "Domain already registered" }, { status: 409 });
  }

  const orgDomain = await prisma.orgDomain.create({
    data: {
      orgId,
      domain: cleanDomain,
    },
  });

  return NextResponse.json({
    domain: orgDomain,
    dnsRecords: getDnsInstructions(orgDomain.verificationKey, cleanDomain),
  }, { status: 201 });
}

// PATCH — Verify domain DNS records
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgId } = await params;
  const membership = await requireOrgRole(session.user.id, orgId, "ADMIN");
  if (!membership) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { domainId } = await req.json();
  if (!domainId) {
    return NextResponse.json({ error: "domainId required" }, { status: 400 });
  }

  const domain = await prisma.orgDomain.findUnique({ where: { id: domainId } });
  if (!domain || domain.orgId !== orgId) {
    return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  }

  // Run DNS verification checks
  const results = await verifyDns(domain.domain, domain.verificationKey);

  const allVerified = results.txt && results.mx;
  const newStatus = allVerified ? "ACTIVE" : results.txt ? "VERIFIED" : "PENDING";

  const updated = await prisma.orgDomain.update({
    where: { id: domainId },
    data: {
      status: newStatus as any,
      mxVerified: results.mx,
      spfVerified: results.spf,
      dkimVerified: results.dkim,
      dmarcVerified: results.dmarc,
      lastCheckedAt: new Date(),
      ...(allVerified && !domain.verifiedAt && { verifiedAt: new Date() }),
    },
  });

  return NextResponse.json({
    domain: updated,
    checks: results,
    dnsRecords: getDnsInstructions(domain.verificationKey, domain.domain),
  });
}

// DELETE — Remove domain
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgId } = await params;
  const membership = await requireOrgRole(session.user.id, orgId, "ADMIN");
  if (!membership) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const domainId = searchParams.get("domainId");
  if (!domainId) {
    return NextResponse.json({ error: "domainId required" }, { status: 400 });
  }

  const domain = await prisma.orgDomain.findUnique({ where: { id: domainId } });
  if (!domain || domain.orgId !== orgId) {
    return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  }

  await prisma.orgDomain.delete({ where: { id: domainId } });
  return NextResponse.json({ success: true });
}

// ─── DNS Helpers ────────────────────────────────────────────────────────────

function getDnsInstructions(verificationKey: string, domain: string) {
  return [
    {
      type: "TXT",
      host: `_serika-verify.${domain}`,
      value: `serika-domain-verification=${verificationKey}`,
      purpose: "Domain ownership verification",
    },
    {
      type: "MX",
      host: domain,
      value: `mail.${MAIL_DOMAIN}`,
      priority: 10,
      purpose: "Route incoming email to SerikaMail",
    },
    {
      type: "TXT",
      host: domain,
      value: `v=spf1 include:${MAIL_DOMAIN} ~all`,
      purpose: "SPF — authorize SerikaMail to send on behalf of your domain",
    },
    {
      type: "CNAME",
      host: `serika._domainkey.${domain}`,
      value: `serika._domainkey.${MAIL_DOMAIN}`,
      purpose: "DKIM — email signing verification",
    },
    {
      type: "TXT",
      host: `_dmarc.${domain}`,
      value: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${MAIL_DOMAIN}`,
      purpose: "DMARC — email authentication policy",
    },
  ];
}

async function verifyDns(domain: string, verificationKey: string) {
  const results = { txt: false, mx: false, spf: false, dkim: false, dmarc: false };

  try {
    // Check TXT verification record
    const txtRecords = await dns.resolveTxt(`_serika-verify.${domain}`).catch(() => []);
    const flatTxt = txtRecords.flat();
    results.txt = flatTxt.some((r) => r.includes(`serika-domain-verification=${verificationKey}`));

    // Check MX records
    const mxRecords = await dns.resolveMx(domain).catch(() => []);
    results.mx = mxRecords.some((r) => r.exchange.includes(MAIL_DOMAIN));

    // Check SPF
    const domainTxt = await dns.resolveTxt(domain).catch(() => []);
    const flatDomainTxt = domainTxt.flat();
    results.spf = flatDomainTxt.some((r) => r.includes(MAIL_DOMAIN) && r.includes("v=spf1"));

    // Check DKIM CNAME
    const dkimRecords = await dns.resolveCname(`serika._domainkey.${domain}`).catch(() => []);
    results.dkim = dkimRecords.some((r) => r.includes(MAIL_DOMAIN));

    // Check DMARC
    const dmarcTxt = await dns.resolveTxt(`_dmarc.${domain}`).catch(() => []);
    const flatDmarc = dmarcTxt.flat();
    results.dmarc = flatDmarc.some((r) => r.includes("v=DMARC1"));
  } catch (error) {
    console.error("DNS verification error:", error);
  }

  return results;
}
