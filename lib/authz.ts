import type { UserRole } from '@prisma/client';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { can, type Capability } from '@/lib/permissions';

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  image?: string | null;
};

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden: your role cannot perform this action') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) return null;
  return session.user as SessionUser;
}

export function requireRole(user: SessionUser, ...roles: UserRole[]) {
  if (!roles.includes(user.role)) {
    throw new ForbiddenError();
  }
}

export async function requireAuth(...roles: UserRole[]) {
  const user = await getSessionUser();

  // A session can disappear while a page is open (logout in another tab,
  // expiry, cookie removal). Redirect instead of throwing an uncaught server
  // action error that crashes the current UI.
  if (!user) redirect('/login');

  if (roles.length) requireRole(user, ...roles);
  return user;
}

/**
 * Server-side authorization gate. Every server action and protected page should
 * go through this rather than comparing role strings inline.
 */
export async function requireCapability(...capabilities: Capability[]) {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const allowed = capabilities.some((capability) => can(user.role, capability));
  if (!allowed) throw new ForbiddenError();
  return user;
}

export function safeUser(user: {
  id: string;
  name: string;
  role: UserRole;
  email: string;
  avatarUrl?: string | null;
}) {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    email: user.email,
    avatarUrl: user.avatarUrl ?? null,
  };
}
