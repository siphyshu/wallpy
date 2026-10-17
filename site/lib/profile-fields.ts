// Profile form checks, mirroring the database's (public.is_http_url,
// public.valid_links and the contact_email check), so mistakes get a clear
// message before the save instead of a constraint error after it.
import type { ProfileLink } from '@/lib/types';

export const PROFILE_IMAGE_MAX_BYTES = 5 * 1024 * 1024; // as /api/uploads/profile-image

const HTTP_URL = /^https?:\/\/[^\s/$.?#][^\s]*$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** "example.com/me" -> "https://example.com/me"; leaves http(s) URLs alone. */
export function normalizeUrl(url: string): string {
  const u = url.trim();
  if (!u || /^https?:\/\//i.test(u)) return u;
  return /^[a-z][a-z0-9+.-]*:/i.test(u) ? u : `https://${u}`; // other schemes fail the check below
}

export function isHttpUrl(url: string): boolean {
  return HTTP_URL.test(url) && url.length <= 300;
}

type Checked = { links: ProfileLink[]; contactEmail: string | null } | { error: string };

export function checkProfileFields({ links, contactEmail }: { links: ProfileLink[]; contactEmail: string }): Checked {
  const out: ProfileLink[] = [];
  for (const link of links) {
    const name = link.name.trim();
    const url = normalizeUrl(link.url);
    if (!name && !url) continue; // an empty row: ignore it
    if (!url) return { error: `Add a URL for the link “${name}”.` };
    if (!name) return { error: `Give the link ${url} a name.` };
    if (name.length > 40) return { error: `Link names can be at most 40 characters (“${name}”).` };
    if (!isHttpUrl(url)) return { error: `“${link.url.trim()}” isn't a web address (it should start with https://).` };
    out.push({ name, url });
  }
  if (out.length > 10) return { error: 'At most 10 links.' };

  const email = contactEmail.trim();
  if (email && (!EMAIL.test(email) || email.length > 254)) {
    return { error: `“${email}” isn't an email address.` };
  }
  return { links: out, contactEmail: email || null };
}

/** The message shown when saving fails. */
export function profileSaveError(message: string): string {
  // The form checks should catch these first; this covers anything they miss.
  if (/violates check constraint/i.test(message)) {
    return "Couldn't save your profile: one of the fields isn't in a format we accept.";
  }
  return `Couldn't save your profile: ${message}`;
}
