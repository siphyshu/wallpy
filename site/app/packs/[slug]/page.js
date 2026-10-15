import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import Footer from '@/components/footer';
import { createClient } from '@/lib/supabase/server';
import PackImageGallery from '@/components/packs/PackImageGallery';
import toml from '@iarna/toml';

export default async function WallpackPage({ params }) {
  const { slug } = await params;
  const supabase = await createClient();

  // Fetch pack by slug
  const { data: pack, error } = await supabase
    .from('packs')
    .select(`
      *,
      uploaded_by_user:users!packs_uploaded_by_fkey (
        id,
        username,
        name,
        avatar_url
      )
    `)
    .eq('slug', slug)
    .single();

  if (error || !pack) {
    notFound();
  }

  // Check if user can view this pack
  const { data: { user } } = await supabase.auth.getUser();
  const isOwner = user && pack.uploaded_by === user.id;
  const canView = pack.is_published || isOwner;

  if (!canView) {
    notFound();
  }

  // Get author info
  const authorName = pack.is_original 
    ? (pack.uploaded_by_user?.name || pack.uploaded_by_user?.username || 'Unknown')
    : (pack.author_name || 'Unknown');
  const authorUrl = pack.is_original
    ? (pack.uploaded_by_user?.username ? `/profile/${pack.uploaded_by_user.username}` : '#')
    : (pack.author_url || '#');
  const authorAvatar = pack.is_original
    ? (pack.uploaded_by_user?.avatar_url || '/artists/anon.png')
    : '/artists/anon.png';

  // Fetch schedule.toml to get all images
  let allImages = [];
  const previewImage = pack.preview_image_url || '/wallpapers/default.jpg';
  
  try {
    // Construct S3 URL for schedule.toml from zip_file_url
    // zip_file_url format: https://bucket.s3.region.amazonaws.com/slug/slug.zip
    // schedule.toml should be at: https://bucket.s3.region.amazonaws.com/slug/schedule.toml
    let scheduleUrl = null;
    if (pack.zip_file_url) {
      scheduleUrl = pack.zip_file_url.replace(/\/[^/]+\.zip$/, '/schedule.toml');
    }
    
    if (scheduleUrl) {
      const scheduleResponse = await fetch(scheduleUrl, { 
        cache: 'no-store',
        next: { revalidate: 0 }
      });
      
      if (scheduleResponse.ok) {
        const scheduleText = await scheduleResponse.text();
        const scheduleData = toml.parse(scheduleText);
        
        // Extract all images based on pack type
        if (pack.pack_type === 'daypack' && scheduleData.timeblocks) {
          Object.values(scheduleData.timeblocks).forEach(block => {
            if (block.images && Array.isArray(block.images)) {
              allImages.push(...block.images);
            }
          });
        } else if (pack.pack_type === 'weekpack' && scheduleData.days) {
          Object.values(scheduleData.days).forEach(day => {
            if (day.images && Array.isArray(day.images)) {
              allImages.push(...day.images);
            }
          });
        } else if (pack.pack_type === 'album' && scheduleData.album) {
          if (scheduleData.album.images && Array.isArray(scheduleData.album.images)) {
            allImages.push(...scheduleData.album.images);
          }
        }
        
        // Remove duplicates and construct full URLs
        const uniqueImages = [...new Set(allImages)];
        const baseUrl = scheduleUrl.replace('/schedule.toml', '/full/');
        allImages = uniqueImages.map(img => `${baseUrl}${img}`);
      }
    }
  } catch (err) {
    console.warn('Failed to fetch schedule.toml:', err);
    // Fallback to preview image only
    allImages = [previewImage];
  }
  
  // If no images found, use preview
  if (allImages.length === 0) {
    allImages = [previewImage];
  }

  // Format tags
  const tags = Array.isArray(pack.tags) ? pack.tags : [];

  // Get pack type display name
  const getPackTypeName = (type) => {
    switch (type) {
      case 'daypack': return 'Daypack';
      case 'weekpack': return 'Weekpack';
      case 'album': return 'Album';
      default: return 'Wallpack';
    }
  };

  return (
    <div className="min-h-screen bg-background/80 text-white mt-20">
      <div className="max-w-7xl mx-auto px-6 py-24">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Pack wallpapers preview */}
          <PackImageGallery images={allImages} />

          {/* Pack Info */}
          <div className="md:w-1/3">
            <div className="flex flex-col items-start">
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-4xl font-serif">{pack.title}</h1>
                <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-medium">
                  {getPackTypeName(pack.pack_type)}
                </span>
              </div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-white/80 text-sm">by</span>
                <div className="relative w-6 h-6 rounded-full overflow-hidden border border-white/20">
                  <Image
                    src={authorAvatar}
                    alt={authorName}
                    fill
                    className="object-cover"
                    unoptimized={authorAvatar.startsWith('http')}
                  />
                </div>
                {pack.is_original ? (
                  <Link
                    href={authorUrl}
                    className="text-white/80 hover:text-white transition-colors text-sm"
                  >
                    {authorName}
                  </Link>
                ) : (
                  <a
                    href={authorUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/80 hover:text-white transition-colors text-sm"
                  >
                    {authorName}
                  </a>
                )}
              </div>
            </div>
            
            {pack.description && (
              <p className="prose text-white/80 mb-4">{pack.description}</p>
            )}
            
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {tags.map((tag, index) => (
                  <span key={index} className="px-2 py-1 bg-white/10 rounded-full text-sm">
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center gap-4 mb-4 text-sm text-white/60">
              <div className="flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                <span>{pack.download_count || 0} downloads</span>
              </div>
            </div>

            <div className="flex flex-col mt-8 gap-2">
              <button className="flex-1 px-4 py-2 bg-white text-black rounded-lg hover:bg-white/90 transition-colors">
                Install with Wallpy
              </button>
              {pack.zip_file_url && (
                <a
                  href={pack.zip_file_url}
                  download
                  className="flex-1 px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors text-white/80 text-center"
                >
                  Download ZIP
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
