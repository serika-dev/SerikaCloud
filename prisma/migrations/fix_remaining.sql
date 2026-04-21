-- Create remaining tables without FKs first

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
