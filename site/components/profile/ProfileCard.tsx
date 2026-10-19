"use client";
/* eslint-disable @next/next/no-img-element -- avatar/cover previews are blob: URLs, which next/image can't load */

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { uploadProfileImage } from '@/lib/upload-client';
import { errorMessage } from '@/lib/utils';
import { PROFILE_UPDATED_EVENT } from '@/lib/data/profile-shape';
import { checkProfileFields, profileSaveError, PROFILE_IMAGE_MAX_BYTES } from '@/lib/profile-fields';
import type { ChangeEvent } from 'react';
import type { Database } from '@/lib/database.types';
import type { Profile, ProfileLink } from '@/lib/types';
import Image from 'next/image';
import DeleteAccount from '@/components/profile/DeleteAccount';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { fieldClasses } from '@/components/ui/input';
import { 
  Link as LinkIcon,
  Mail
} from 'lucide-react';

import { 
  SiBehance,
  SiDribbble,
  SiFigma,
  SiFramer,
  SiGithub,
  SiInstagram,
  SiLinkedin,
  SiX,
  SiPinterest,
} from 'react-icons/si';

// Icon mapping for popular platforms using Lucide React and Font Awesome
const LINK_ICONS = {
  instagram: SiInstagram,
  twitter: SiX,
  github: SiGithub,
  linkedin: SiLinkedin,
  dribbble: SiDribbble,
  figma: SiFigma,
  framer: SiFramer,
  behance: SiBehance,
  pinterest: SiPinterest,
  generic: LinkIcon,
};

function getLinkIcon(url: string | undefined) {
  if (!url) return LINK_ICONS.generic;
  const u = url.toLowerCase();
  if (u.includes('instagram.com')) return LINK_ICONS.instagram;
  if (u.includes('twitter.com') || u.includes('x.com')) return LINK_ICONS.twitter;
  if (u.includes('github.com')) return LINK_ICONS.github;
  if (u.includes('linkedin.com')) return LINK_ICONS.linkedin;
  if (u.includes('dribbble.com')) return LINK_ICONS.dribbble;
  if (u.includes('figma.com')) return LINK_ICONS.figma;
  if (u.includes('framer.com')) return LINK_ICONS.framer;
  if (u.includes('behance.net')) return LINK_ICONS.behance;
  if (u.includes('pinterest.com')) return LINK_ICONS.pinterest;
  return LINK_ICONS.generic;
}

export default function ProfileCard({ user, isCurrentUser }: { user: Profile; isCurrentUser: boolean }) {
  const router = useRouter();
  const initialLinks = user.links;

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name || '');
  const [bio, setBio] = useState(user.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url && !user.avatar_url.includes('undefined') ? user.avatar_url : '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [coverUrl, setCoverUrl] = useState(user.cover_url && !user.cover_url.includes('undefined') ? user.cover_url : '');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [links, setLinks] = useState<ProfileLink[]>(initialLinks);
  const [emailContact, setEmailContact] = useState(user.contact_email || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverFileInputRef = useRef<HTMLInputElement>(null);

  // Handle avatar file selection
  const handleAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file && file.size > PROFILE_IMAGE_MAX_BYTES) {
      setError('Images must be under 5 MB.');
    } else if (file) {
      setError(null);
      setAvatarFile(file);
      setAvatarUrl(URL.createObjectURL(file));
    }
  };

  // Handle cover file selection
  const handleCoverChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file && file.size > PROFILE_IMAGE_MAX_BYTES) {
      setError('Images must be under 5 MB.');
    } else if (file) {
      setError(null);
      setCoverFile(file);
      setCoverUrl(URL.createObjectURL(file));
    }
  };

  // Add a new link
  const addLink = () => {
    if (Array.isArray(links) ? links.length < 5 : true) {
      setLinks([...links, { name: '', url: '' }]);
    }
  };

  // Remove a link
  const removeLink = (index: number) => {
    setLinks(links.filter((_, i) => i !== index));
  };

  // Update a link
  const updateLink = (index: number, field: keyof ProfileLink, value: string) => {
    const newLinks = [...links];
    newLinks[index] = { ...newLinks[index], [field]: value };
    setLinks(newLinks);
  };

  // Save profile changes
  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    
    try {
      // Same rules as the database's checks, with messages a person can act on.
      const checked = checkProfileFields({ links, contactEmail: emailContact });
      if ('error' in checked) throw new Error(checked.error);
      setLinks(checked.links);

      // Images go straight to R2 under keys the server derives from your id
      // and the file's hash; the profile row only stores the key.
      const updateData: Database['public']['Tables']['profiles']['Update'] = {
        display_name: name.trim() || null,
        bio: bio.trim() || null,
        links: checked.links,
        contact_email: checked.contactEmail,
      };
      if (avatarFile) updateData.avatar_key = await uploadProfileImage(avatarFile);
      else if (!avatarUrl && user.avatar_key) updateData.avatar_key = null;
      if (coverFile) updateData.cover_key = await uploadProfileImage(coverFile);
      else if (!coverUrl && user.cover_key) updateData.cover_key = null;

      const supabase = createClient();
      const { error: updateError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);
      if (updateError) throw updateError;

      // Removed or replaced images: delete the old files (the server checks
      // they're yours and no longer used).
      const unused = [
        'avatar_key' in updateData ? user.avatar_key : null,
        'cover_key' in updateData ? user.cover_key : null,
      ].filter((k): k is string => Boolean(k));
      if (unused.length) {
        await fetch('/api/uploads/profile-image', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keys: unused }),
        }).catch(() => {});
      }

      setEditing(false);
      setAvatarFile(null);
      setCoverFile(null);
      window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT));
      router.refresh();
    } catch (err) {
      setError(profileSaveError(errorMessage(err)));
    } finally {
      setIsSaving(false);
    }
  };

  // Cancel editing
  const handleCancel = () => {
    setEditing(false);
    setName(user.name || '');
    setBio(user.bio || '');
    setAvatarUrl(user.avatar_url || '');
    setAvatarFile(null);
    setCoverUrl(user.cover_url || '');
    setCoverFile(null);
    setLinks(initialLinks);
    setEmailContact(user.contact_email || '');
    setError(null);
  };

  return (
    <div className="bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 shadow-lg overflow-hidden hover:bg-white/10 transition-all duration-300">
      {/* Cover Photo */}
      <div className="relative h-32 bg-gradient-to-r from-white/10 to-white/5">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt="Cover"
            className="w-full h-full object-cover"
          />
        ) : (
          // No cover yet: a quiet dusk sky rather than a placeholder icon.
          <div className="w-full h-full bg-gradient-to-b from-[#1d2740] via-[#3a3550] to-[#6b4f4f]" aria-hidden />
        )}
        {editing && isCurrentUser && coverUrl && (
          <button
            className="absolute top-2 right-12 bg-white/30 border border-white/40 rounded-full p-2 hover:bg-white/60 transition"
            onClick={() => { setCoverFile(null); setCoverUrl(''); }}
            type="button"
            aria-label="Remove cover photo"
            title="Remove cover photo"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}
        {editing && isCurrentUser && (
          <button
            className="absolute top-2 right-2 bg-white/30 border border-white/40 rounded-full p-2 hover:bg-white/60 transition"
            onClick={() => coverFileInputRef.current?.click()}
            type="button"
            aria-label="Change cover photo"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19.5 3 21l1.5-4L16.5 3.5z" />
            </svg>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              ref={coverFileInputRef}
              onChange={handleCoverChange}
            />
          </button>
        )}
      </div>

      <div className="p-6 flex flex-col items-center gap-4">
        {/* Avatar */}
        <div className="relative -mt-16">
          {avatarUrl && !avatarUrl.includes('undefined') ? (
            <img
              src={avatarUrl}
              alt={name}
              className="w-20 h-20 rounded-full border-4 border-white/20 object-cover shadow-lg hover:scale-105 transition-transform duration-300 bg-white/10"
            />
          ) : (
            <div className="w-20 h-20 rounded-full border-4 border-white/20 bg-white/10 shadow-lg flex items-center justify-center">
              <svg className="w-8 h-8 text-white/50" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
            </div>
          )}
          {editing && isCurrentUser && avatarUrl && (
            <button
              className="absolute bottom-0 left-0 bg-white/30 border border-white/40 rounded-full p-1 hover:bg-white/60 transition"
              onClick={() => { setAvatarFile(null); setAvatarUrl(''); }}
              type="button"
              aria-label="Remove avatar"
              title="Remove avatar"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
            </button>
          )}
          {editing && isCurrentUser && (
            <button
              className="absolute bottom-0 right-0 bg-white/30 border border-white/40 rounded-full p-1 hover:bg-white/60 transition"
              onClick={() => fileInputRef.current?.click()}
              type="button"
              aria-label="Change avatar"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19.5 3 21l1.5-4L16.5 3.5z" />
              </svg>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                ref={fileInputRef}
                onChange={handleAvatarChange}
              />
            </button>
          )}
        </div>

        {/* Profile fields */}
        <div className="text-center mt-2 w-full">
          {editing && isCurrentUser ? (
            <div className="flex flex-col gap-4 items-center">
              {/* Name Field */}
              <div className="w-full">
                <label className="block text-white/70 text-sm font-medium mb-2 text-left">
                  Full Name
                </label>
                <input
                  className={`${fieldClasses} py-2.5`}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Enter your full name"
                  maxLength={60}
                />
              </div>

              {/* Bio Field */}
              <div className="w-full">
                <label className="block text-white/70 text-sm font-medium mb-2 text-left">
                  Bio
                </label>
                <textarea
                  className={`${fieldClasses} py-2.5 resize-none`}
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="Tell us about yourself..."
                  rows={3}
                  maxLength={200}
                />
                <div className="text-right text-white/40 text-xs mt-1">
                  {bio.length}/200
                </div>
              </div>
              
              {/* Links Management */}
              <div className="w-full">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-white/70 text-sm font-medium">Links</label>
                  <button
                    type="button"
                    onClick={addLink}
                    disabled={Array.isArray(links) ? links.length >= 5 : true}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full border border-white/20 text-xs font-medium transition-colors duration-200 ${
                      Array.isArray(links) && links.length >= 5
                        ? 'bg-white/5 text-white/30 cursor-not-allowed'
                        : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M12 4v16m8-8H4" />
                    </svg>
                    Add Link
                  </button>
                </div>
                
                {(!Array.isArray(links) || links.length === 0) ? (
                  <div className="text-center py-6 text-white/40 text-sm border border-dashed border-white/20 rounded-lg">
                    <LinkIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    No links added yet
                  </div>
                ) : (
                  <div className="space-y-3">
                    {links.map((link, index) => {
                      const IconComponent = getLinkIcon(link.url);
                      return (
                        <div key={index} className="bg-white/5 rounded-lg p-3 border border-white/10">
                          <div className="flex items-start gap-3">
                            <div className="flex-1 space-y-2">
                              <input
                                className={`${fieldClasses} h-10 py-2`}
                                value={link.name}
                                onChange={e => updateLink(index, 'name', e.target.value)}
                                placeholder="Link name (e.g., Twitter, Portfolio)"
                                maxLength={30}
                              />
                              <input
                                className={`${fieldClasses} h-10 py-2`}
                                value={link.url}
                                onChange={e => updateLink(index, 'url', e.target.value)}
                                placeholder="https://example.com"
                                maxLength={300}
                                type="url"
                                inputMode="url"
                              />
                            </div>
                            <div className="flex flex-col items-center gap-2">
                              <div className="p-2 rounded-lg bg-white/10">
                                <IconComponent className="w-4 h-4 text-white/70" />
                              </div>
                              <button
                                type="button"
                                onClick={() => removeLink(index)}
                                className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 transition-colors duration-200"
                                title="Remove link"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                  <path d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Email Contact Field */}
              <div className="w-full">
                <label className="block text-white/70 text-sm font-medium mb-2 text-left">
                  Contact Email <span className="text-white/40 text-xs">(optional)</span>
                </label>
                <p className="text-white/40 text-xs mb-2 text-left">Shown publicly on your profile.</p>
                <input
                  className={`${fieldClasses} py-2.5`}
                  value={emailContact}
                  onChange={e => setEmailContact(e.target.value)}
                  placeholder="your@email.com"
                  maxLength={100}
                  type="email"
                  autoComplete="email"
                />
              </div>
            </div>
          ) : (
            <>
              {/* No display name (older accounts): the username is the heading. */}
              {user.name?.trim() ? (
                <>
                  <div className="text-xl font-serif font-bold text-white drop-shadow-sm">{user.name}</div>
                  <div className="text-white/70 font-mono text-sm">@{user.username}</div>
                </>
              ) : (
                <div className="text-white font-mono">@{user.username}</div>
              )}
              {user.bio && (
                <div className="mt-3 text-white/80 text-sm leading-relaxed max-w-xs mx-auto drop-shadow-sm">
                  {user.bio}
                </div>
              )}
              {Array.isArray(user.links) && user.links.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2 justify-center">
                  {user.links.map((link, index) => {
                    const IconComponent = getLinkIcon(link.url);
                    return (
                      <a
                        key={index}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all duration-200 text-sm group"
                      >
                        <IconComponent className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" />
                        {link.name}
                      </a>
                    );
                  })}
                </div>
              )}
              {user.contact_email && (
                <div className="mt-4 flex items-center justify-center gap-2 text-white/70 text-sm">
                  <Mail className="w-4 h-4" />
                  <a href={`mailto:${user.contact_email}`} className="hover:underline">{user.contact_email}</a>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* New creators start with an empty profile: invite them to fill it in. */}
      {isCurrentUser && !editing && !user.avatar_url && !user.bio && (
        <Notice className="mx-6 mb-4">
          <p>Add a photo and a short bio so people know who&apos;s behind your packs.</p>
        </Notice>
      )}

      {/* Error message */}
      {error && <div className="px-6 pb-4 text-red-400 text-xs">{error}</div>}
      
      {/* Action buttons */}
      <div className="px-6 pb-6 flex gap-2">
        {editing && isCurrentUser ? (
          <>
            <Button className="flex-1" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save'}
            </Button>
            <Button variant="secondary" className="flex-1" onClick={handleCancel} disabled={isSaving}>
              Cancel
            </Button>
          </>
        ) : (
          isCurrentUser && (
            <Button variant="secondary" className="w-full" onClick={() => setEditing(true)}>
              Edit Profile
            </Button>
          )
        )}
      </div>

      {editing && isCurrentUser && <DeleteAccount username={user.username} />}
    </div>
  );
}
