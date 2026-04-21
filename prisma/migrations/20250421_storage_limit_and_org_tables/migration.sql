-- Migration: Create missing organization tables
-- Storage limit update already applied

-- Create Organization table
CREATE TABLE IF NOT EXISTS "Organization" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    "avatarUrl" TEXT,
    description TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create OrgMember table (without FK first to avoid circular issues)
CREATE TABLE IF NOT EXISTS "OrgMember" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'MEMBER',
    title TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("orgId", "userId")
);

-- Create OrgInvite table
CREATE TABLE IF NOT EXISTS "OrgInvite" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "orgId" TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'MEMBER',
    token TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    "invitedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create OrgDomain table
CREATE TABLE IF NOT EXISTS "OrgDomain" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "orgId" TEXT NOT NULL,
    domain TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'PENDING',
    "verificationKey" TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    "mxVerified" BOOLEAN NOT NULL DEFAULT false,
    "spfVerified" BOOLEAN NOT NULL DEFAULT false,
    "dkimVerified" BOOLEAN NOT NULL DEFAULT false,
    "dmarcVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastCheckedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create UserGroup table
CREATE TABLE IF NOT EXISTS "UserGroup" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "orgId" TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT NOT NULL DEFAULT '#6366f1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("orgId", name)
);

-- Create GroupMember table
CREATE TABLE IF NOT EXISTS "GroupMember" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canSend" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("groupId", "userId")
);

-- Create GroupMailbox table
CREATE TABLE IF NOT EXISTS "GroupMailbox" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "orgId" TEXT NOT NULL,
    "groupId" TEXT UNIQUE,
    address TEXT NOT NULL UNIQUE,
    "displayName" TEXT,
    "autoReply" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create GroupMailFolder table
CREATE TABLE IF NOT EXISTS "GroupMailFolder" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    "groupMailboxId" TEXT NOT NULL,
    UNIQUE("groupMailboxId", type)
);

-- Create GroupEmail table
CREATE TABLE IF NOT EXISTS "GroupEmail" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "messageId" TEXT UNIQUE,
    "fromAddress" TEXT NOT NULL,
    "fromName" TEXT,
    "toAddresses" JSONB NOT NULL,
    "ccAddresses" JSONB,
    "bccAddresses" JSONB,
    subject TEXT NOT NULL DEFAULT '(No Subject)',
    "bodyText" TEXT,
    "bodyHtml" TEXT,
    "groupMailboxId" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isStarred" BOOLEAN NOT NULL DEFAULT false,
    "assignedToId" TEXT,
    "internalNote" TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    headers JSONB,
    "inReplyTo" TEXT,
    references JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create Ticket table
CREATE TABLE IF NOT EXISTS "Ticket" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "orgId" TEXT NOT NULL,
    number INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'OPEN',
    priority TEXT NOT NULL DEFAULT 'MEDIUM',
    "creatorId" TEXT NOT NULL,
    "assigneeId" TEXT,
    tags JSONB,
    "emailId" TEXT,
    "dueDate" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("orgId", number)
);

-- Create TicketMessage table
CREATE TABLE IF NOT EXISTS "TicketMessage" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    content TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create ImapCredential table
CREATE TABLE IF NOT EXISTS "ImapCredential" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    label TEXT NOT NULL DEFAULT 'App Password',
    "passwordHash" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "OrgMember_orgId_idx" ON "OrgMember"("orgId");
CREATE INDEX IF NOT EXISTS "OrgMember_userId_idx" ON "OrgMember"("userId");
CREATE INDEX IF NOT EXISTS "OrgInvite_orgId_idx" ON "OrgInvite"("orgId");
CREATE INDEX IF NOT EXISTS "OrgInvite_token_idx" ON "OrgInvite"(token);
CREATE INDEX IF NOT EXISTS "OrgInvite_email_idx" ON "OrgInvite"(email);
CREATE INDEX IF NOT EXISTS "OrgDomain_orgId_idx" ON "OrgDomain"("orgId");
CREATE INDEX IF NOT EXISTS "OrgDomain_domain_idx" ON "OrgDomain"(domain);
CREATE INDEX IF NOT EXISTS "UserGroup_orgId_idx" ON "UserGroup"("orgId");
CREATE INDEX IF NOT EXISTS "GroupMember_groupId_idx" ON "GroupMember"("groupId");
CREATE INDEX IF NOT EXISTS "GroupMember_userId_idx" ON "GroupMember"("userId");
CREATE INDEX IF NOT EXISTS "GroupMailbox_orgId_idx" ON "GroupMailbox"("orgId");
CREATE INDEX IF NOT EXISTS "GroupMailbox_address_idx" ON "GroupMailbox"(address);
CREATE INDEX IF NOT EXISTS "GroupMailFolder_groupMailboxId_idx" ON "GroupMailFolder"("groupMailboxId");
CREATE INDEX IF NOT EXISTS "GroupEmail_groupMailboxId_idx" ON "GroupEmail"("groupMailboxId");
CREATE INDEX IF NOT EXISTS "GroupEmail_folderId_idx" ON "GroupEmail"("folderId");
CREATE INDEX IF NOT EXISTS "GroupEmail_assignedToId_idx" ON "GroupEmail"("assignedToId");
CREATE INDEX IF NOT EXISTS "GroupEmail_receivedAt_idx" ON "GroupEmail"("receivedAt");
CREATE INDEX IF NOT EXISTS "GroupEmail_status_idx" ON "GroupEmail"(status);
CREATE INDEX IF NOT EXISTS "Ticket_orgId_idx" ON "Ticket"("orgId");
CREATE INDEX IF NOT EXISTS "Ticket_creatorId_idx" ON "Ticket"("creatorId");
CREATE INDEX IF NOT EXISTS "Ticket_assigneeId_idx" ON "Ticket"("assigneeId");
CREATE INDEX IF NOT EXISTS "Ticket_status_idx" ON "Ticket"(status);
CREATE INDEX IF NOT EXISTS "Ticket_priority_idx" ON "Ticket"(priority);
CREATE INDEX IF NOT EXISTS "TicketMessage_ticketId_idx" ON "TicketMessage"("ticketId");
CREATE INDEX IF NOT EXISTS "TicketMessage_authorId_idx" ON "TicketMessage"("authorId");
CREATE INDEX IF NOT EXISTS "ImapCredential_userId_idx" ON "ImapCredential"("userId");

-- Add foreign key constraints separately
ALTER TABLE "OrgMember" ADD CONSTRAINT "OrgMember_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"(id) ON DELETE CASCADE;
ALTER TABLE "OrgMember" ADD CONSTRAINT "OrgMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE;
ALTER TABLE "OrgInvite" ADD CONSTRAINT "OrgInvite_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"(id) ON DELETE CASCADE;
ALTER TABLE "OrgInvite" ADD CONSTRAINT "OrgInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"(id) ON DELETE CASCADE;
ALTER TABLE "OrgDomain" ADD CONSTRAINT "OrgDomain_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"(id) ON DELETE CASCADE;
ALTER TABLE "UserGroup" ADD CONSTRAINT "UserGroup_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"(id) ON DELETE CASCADE;
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "UserGroup"(id) ON DELETE CASCADE;
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE;
ALTER TABLE "GroupMailbox" ADD CONSTRAINT "GroupMailbox_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"(id) ON DELETE CASCADE;
ALTER TABLE "GroupMailbox" ADD CONSTRAINT "GroupMailbox_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "UserGroup"(id) ON DELETE CASCADE;
ALTER TABLE "GroupMailFolder" ADD CONSTRAINT "GroupMailFolder_groupMailboxId_fkey" FOREIGN KEY ("groupMailboxId") REFERENCES "GroupMailbox"(id) ON DELETE CASCADE;
ALTER TABLE "GroupEmail" ADD CONSTRAINT "GroupEmail_groupMailboxId_fkey" FOREIGN KEY ("groupMailboxId") REFERENCES "GroupMailbox"(id) ON DELETE CASCADE;
ALTER TABLE "GroupEmail" ADD CONSTRAINT "GroupEmail_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "GroupMailFolder"(id) ON DELETE CASCADE;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"(id) ON DELETE CASCADE;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"(id) ON DELETE CASCADE;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"(id) ON DELETE CASCADE;
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"(id) ON DELETE CASCADE;
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"(id) ON DELETE CASCADE;
ALTER TABLE "ImapCredential" ADD CONSTRAINT "ImapCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE;
