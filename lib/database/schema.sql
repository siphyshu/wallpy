-- Wallpy Site Database Schema
-- This file contains all the table definitions for the Wallpy wallpaper pack website

-- Users table for authentication and user profiles
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  bio TEXT,
  cover_url TEXT,
  links JSONB DEFAULT '[]'::jsonb,
  email_contact TEXT,
  role TEXT DEFAULT 'user', -- 'admin', 'moderator', 'user'
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Main packs table for wallpaper packs
CREATE TABLE packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  
  -- Attribution
  is_original BOOLEAN NOT NULL DEFAULT FALSE,
  author_name TEXT,
  author_url TEXT,
  
  -- Upload & moderation
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,

  -- Media
  preview_image_url TEXT,
  blurhash TEXT,
  zip_file_url TEXT NOT NULL,
  
  -- Metadata
  tags TEXT[], -- optional
  download_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Pack images for multiple images per pack
CREATE TABLE pack_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id UUID REFERENCES packs(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  blurhash TEXT,
  sort_order INTEGER DEFAULT 0
);

-- Download tracking
CREATE TABLE downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id UUID REFERENCES packs(id) ON DELETE CASCADE,
  downloaded_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID REFERENCES users(id), -- nullable
  ip_address TEXT,
  user_agent TEXT,
  referer TEXT
);

-- Moderation log for audit trail
CREATE TABLE moderation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id UUID REFERENCES packs(id) ON DELETE CASCADE,
  reviewed_by UUID REFERENCES users(id),
  action TEXT NOT NULL, -- 'approve', 'reject', 'edit', etc.
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for better performance
CREATE INDEX idx_packs_slug ON packs(slug);
CREATE INDEX idx_packs_status ON packs(status);
CREATE INDEX idx_packs_published ON packs(is_published);
CREATE INDEX idx_packs_created_at ON packs(created_at);
CREATE INDEX idx_packs_download_count ON packs(download_count);
CREATE INDEX idx_packs_tags ON packs USING GIN(tags);

CREATE INDEX idx_pack_images_pack_id ON pack_images(pack_id);
CREATE INDEX idx_pack_images_sort_order ON pack_images(sort_order);

CREATE INDEX idx_downloads_pack_id ON downloads(pack_id);
CREATE INDEX idx_downloads_downloaded_at ON downloads(downloaded_at);
CREATE INDEX idx_downloads_user_id ON downloads(user_id);

CREATE INDEX idx_moderation_log_pack_id ON moderation_log(pack_id);
CREATE INDEX idx_moderation_log_reviewed_by ON moderation_log(reviewed_by);
CREATE INDEX idx_moderation_log_created_at ON moderation_log(created_at);

-- Row Level Security (RLS) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pack_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_log ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile and public profiles
CREATE POLICY "Users can view public profiles" ON users
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Packs are publicly readable when published and approved
CREATE POLICY "Public packs are viewable" ON packs
  FOR SELECT USING (is_published = true AND status = 'approved');

-- Users can create packs
CREATE POLICY "Users can create packs" ON packs
  FOR INSERT WITH CHECK (auth.uid() = uploaded_by);

-- Users can update their own packs
CREATE POLICY "Users can update own packs" ON packs
  FOR UPDATE USING (auth.uid() = uploaded_by);

-- Moderators and admins can moderate packs
CREATE POLICY "Moderators can moderate packs" ON packs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'moderator')
    )
  );

-- Pack images are publicly readable
CREATE POLICY "Pack images are viewable" ON pack_images
  FOR SELECT USING (true);

-- Downloads are publicly insertable (for tracking)
CREATE POLICY "Downloads can be tracked" ON downloads
  FOR INSERT WITH CHECK (true);

-- Moderation log is readable by moderators and admins
CREATE POLICY "Moderators can view moderation log" ON moderation_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'moderator')
    )
  );

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_packs_updated_at 
    BEFORE UPDATE ON packs 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Function to increment download count
CREATE OR REPLACE FUNCTION increment_download_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE packs 
    SET download_count = download_count + 1 
    WHERE id = NEW.pack_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically increment download count
CREATE TRIGGER increment_pack_download_count
    AFTER INSERT ON downloads
    FOR EACH ROW
    EXECUTE FUNCTION increment_download_count();