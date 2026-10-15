"use client";

import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { PUBLIC_USER_COLUMNS } from '@/lib/data/user-columns';
import { generatePresignedUrl } from '@/app/profile/[username]/actions';
import Image from 'next/image';
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

function getLinkIcon(url) {
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

export default function ProfileCard({ user, isCurrentUser }) {
  // Ensure links is always an array
  let initialLinks = [];
  if (Array.isArray(user.links)) {
    initialLinks = user.links;
  } else if (typeof user.links === 'string') {
    try {
      const parsed = JSON.parse(user.links);
      if (Array.isArray(parsed)) initialLinks = parsed;
    } catch (e) {
      initialLinks = [];
    }
  } else {
    initialLinks = [];
  }

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name || '');
  const [bio, setBio] = useState(user.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url && !user.avatar_url.includes('undefined') ? user.avatar_url : '');
  const [avatarFile, setAvatarFile] = useState(null);
  const [coverUrl, setCoverUrl] = useState(user.cover_url && !user.cover_url.includes('undefined') ? user.cover_url : '');
  const [coverFile, setCoverFile] = useState(null);
  const [links, setLinks] = useState(initialLinks);
  const [emailContact, setEmailContact] = useState(user.email_contact || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef();
  const coverFileInputRef = useRef();

  // Handle avatar file selection
  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      setAvatarUrl(URL.createObjectURL(file));
    }
  };

  // Handle cover file selection
  const handleCoverChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setCoverFile(file);
      setCoverUrl(URL.createObjectURL(file));
    }
  };

  // Upload file to S3 and return the public URL
  async function uploadToS3(file, folder) {
    try {
      console.log(`Starting upload for ${folder}:`, file.name);
      const randomId = Math.random().toString(36).substring(2, 15);
      const ext = file.name.split('.').pop();
      const filename = `${folder}/${randomId}_${Date.now()}.${ext}`;
      console.log('Generated filename:', filename);
      
      const { presignedUrl, publicUrl, success } = await generatePresignedUrl(filename, file.type);
      
      if (!success) {
        console.error('Failed to generate presigned URL');
        setError('Failed to generate upload URL');
        return null;
      }
      
      console.log('Uploading to S3...');
      const response = await fetch(presignedUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });
      
      if (!response.ok) {
        console.error('S3 upload failed:', response.status, response.statusText);
        setError(`Failed to upload ${folder.slice(0, -1)}.`);
        return null;
      }

      console.log('S3 upload successful');
      return publicUrl;
    } catch (err) {
      console.error(`Error uploading ${folder}:`, err);
      setError(`Failed to upload ${folder.slice(0, -1)}.`);
      return null;
    }
  }

  // Add a new link
  const addLink = () => {
    if (Array.isArray(links) ? links.length < 5 : true) {
      setLinks([...links, { name: '', url: '' }]);
    }
  };

  // Remove a link
  const removeLink = (index) => {
    setLinks(links.filter((_, i) => i !== index));
  };

  // Update a link
  const updateLink = (index, field, value) => {
    const newLinks = [...links];
    newLinks[index] = { ...newLinks[index], [field]: value };
    setLinks(newLinks);
  };

  // Save profile changes
  const handleSave = async () => {
    console.log('Starting save process...');
    setIsSaving(true);
    setError(null);
    
    try {
      let uploadedAvatarUrl = avatarUrl;
      let uploadedCoverUrl = coverUrl;

      // Upload avatar if changed
      if (avatarFile) {
        console.log('Uploading avatar...');
        uploadedAvatarUrl = await uploadToS3(avatarFile, 'avatars');
        if (!uploadedAvatarUrl) {
          throw new Error('Avatar upload failed');
        }
      }

      // Upload cover if changed
      if (coverFile) {
        console.log('Uploading cover...');
        uploadedCoverUrl = await uploadToS3(coverFile, 'covers');
        if (!uploadedCoverUrl) {
          throw new Error('Cover upload failed');
        }
      }

      // Filter out empty links
      const validLinks = links.filter(link => link.name.trim() && link.url.trim());
      console.log('Valid links:', validLinks);

      console.log('Updating database...');
      const supabase = createClient();
      
      const updateData = {
        name,
        bio,
        avatar_url: uploadedAvatarUrl,
        cover_url: uploadedCoverUrl,
        links: validLinks,
        email_contact: emailContact.trim() || null,
      };
      
      console.log('Update data:', updateData);
      
      const { data, error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', user.id)
        .select(PUBLIC_USER_COLUMNS);
        
      if (updateError) {
        console.error('Database update error:', updateError);
        throw updateError;
      }
      
      console.log('Database update successful:', data);
      setEditing(false);
      window.location.reload();
    } catch (err) {
      console.error('Save error:', err);
      setError(`Failed to update profile: ${err.message}`);
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
    setEmailContact(user.email_contact || '');
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
          <div className="w-full h-full bg-gradient-to-r from-white/10 to-white/5 flex items-center justify-center">
            <svg className="w-8 h-8 text-white/30" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
            </svg>
          </div>
        )}
        {editing && isCurrentUser && (
          <button
            className="absolute top-2 right-2 bg-white/30 border border-white/40 rounded-full p-2 hover:bg-white/60 transition"
            onClick={() => coverFileInputRef.current.click()}
            type="button"
            aria-label="Change cover photo"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19.5 3 21l1.5-4L16.5 3.5z" />
            </svg>
            <input
              type="file"
              accept="image/*"
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
          {editing && isCurrentUser && (
            <button
              className="absolute bottom-0 right-0 bg-white/30 border border-white/40 rounded-full p-1 hover:bg-white/60 transition"
              onClick={() => fileInputRef.current.click()}
              type="button"
              aria-label="Change avatar"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19.5 3 21l1.5-4L16.5 3.5z" />
              </svg>
              <input
                type="file"
                accept="image/*"
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
                  className="w-full rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 p-3 focus:outline-none focus:ring-2 focus:ring-blue-300/40 transition shadow-sm"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Enter your full name"
                  maxLength={50}
                />
              </div>

              {/* Bio Field */}
              <div className="w-full">
                <label className="block text-white/70 text-sm font-medium mb-2 text-left">
                  Bio
                </label>
                <textarea
                  className="w-full rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 p-3 focus:outline-none focus:ring-2 focus:ring-blue-300/40 transition shadow-sm resize-none"
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
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-200 ${
                      Array.isArray(links) && links.length >= 5 
                        ? 'bg-gray-500/20 text-gray-400 cursor-not-allowed' 
                        : 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 hover:text-blue-300'
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
                                className="w-full rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-300/40 transition shadow-sm text-sm"
                                value={link.name}
                                onChange={e => updateLink(index, 'name', e.target.value)}
                                placeholder="Link name (e.g., Twitter, Portfolio)"
                                maxLength={30}
                              />
                              <input
                                className="w-full rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-300/40 transition shadow-sm text-sm"
                                value={link.url}
                                onChange={e => updateLink(index, 'url', e.target.value)}
                                placeholder="https://example.com"
                                maxLength={100}
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
                <input
                  className="w-full rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 p-3 focus:outline-none focus:ring-2 focus:ring-blue-300/40 transition shadow-sm"
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
              <div className="text-xl font-serif font-bold text-white drop-shadow-sm">{user.name}</div>
              <div className="text-white/70 font-mono text-sm">@{user.username}</div>
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
              {user.email_contact && (
                <div className="mt-4 flex items-center justify-center gap-2 text-white/70 text-sm">
                  <Mail className="w-4 h-4" />
                  <a href={`mailto:${user.email_contact}`} className="hover:underline">{user.email_contact}</a>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && <div className="px-6 pb-4 text-red-400 text-xs">{error}</div>}
      
      {/* Action buttons */}
      <div className="px-6 pb-6 flex gap-2">
        {editing && isCurrentUser ? (
          <>
            <button
              className="flex-1 px-6 py-2 rounded-full bg-white text-gray-900 text-sm font-medium border border-white/20 backdrop-blur-sm transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 shadow disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              className="flex-1 px-6 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm font-medium border border-white/20 backdrop-blur-sm transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 shadow"
              onClick={handleCancel}
              disabled={isSaving}
            >
              Cancel
            </button>
          </>
        ) : (
          isCurrentUser && (
            <button
              className="w-full px-6 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm font-medium border border-white/20 backdrop-blur-sm transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 shadow"
              onClick={() => setEditing(true)}
            >
              Edit Profile
            </button>
          )
        )}
      </div>
    </div>
  );
} 