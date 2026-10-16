import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { serverEnv } from '@/lib/env';

// Proof that a user uploaded a blob rather than just naming its hash.
//
// Presign hands out a ticket signing (hash, user, issue time, and the object's
// last-modified time at that moment, 0 if it didn't exist). Confirm accepts a
// claim only if the ticket is genuine, for this user and blob, unexpired, AND
// R2 now reports a strictly newer write. The PUT is hash-pinned, so it only
// succeeds with the exact bytes: a newer write means this user has the file.
// Only R2's own timestamps are compared, so server clock skew doesn't matter.

const TTL_MS = 15 * 60_000;

function sign(sha256: string, userId: string, issuedAt: number, previous: number): string {
  return createHmac('sha256', serverEnv.uploadTicketSecret())
    .update(`${sha256}:${userId}:${issuedAt}:${previous}`)
    .digest('hex');
}

/** `previous`: the object's last-modified time now (ms), or 0 if it doesn't exist. */
export function issueTicket(sha256: string, userId: string, previous: number): string {
  const issuedAt = Date.now();
  return `${issuedAt}.${previous}.${sign(sha256, userId, issuedAt, previous)}`;
}

export function ticketProvesUpload(ticket: string, sha256: string, userId: string, lastModified: Date | undefined): boolean {
  const [issued, prev, mac] = ticket.split('.');
  const issuedAt = Number(issued);
  const previous = Number(prev);
  if (!Number.isFinite(issuedAt) || !Number.isFinite(previous) || !mac || !lastModified) return false;
  const expected = Buffer.from(sign(sha256, userId, issuedAt, previous), 'hex');
  const given = Buffer.from(mac, 'hex');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return false;
  if (Date.now() - issuedAt > TTL_MS) return false;
  return lastModified.getTime() > previous;
}
