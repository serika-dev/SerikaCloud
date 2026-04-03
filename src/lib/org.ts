import { prisma } from "@/lib/db";
import { OrgRole } from "@prisma/client";

/**
 * Check if a user is a member of an org and return their membership.
 * Optionally require a minimum role level.
 */
export async function getOrgMembership(userId: string, orgId: string) {
  return prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId } },
    include: { org: true },
  });
}

/**
 * Check if user has at least the given role in the org.
 * OWNER > ADMIN > MEMBER
 */
const ROLE_HIERARCHY: Record<OrgRole, number> = {
  OWNER: 3,
  ADMIN: 2,
  MEMBER: 1,
};

export function hasMinRole(userRole: OrgRole, requiredRole: OrgRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Require the user to be at least `minRole` in the org.
 * Returns the membership or null if insufficient.
 */
export async function requireOrgRole(
  userId: string,
  orgId: string,
  minRole: OrgRole
) {
  const membership = await getOrgMembership(userId, orgId);
  if (!membership) return null;
  if (!hasMinRole(membership.role, minRole)) return null;
  return membership;
}

/**
 * Get the next ticket number for an org.
 */
export async function getNextTicketNumber(orgId: string): Promise<number> {
  const last = await prisma.ticket.findFirst({
    where: { orgId },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  return (last?.number || 0) + 1;
}
