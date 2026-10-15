import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request) {
  try {
    // Check authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in to create a pack.' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const {
      title,
      slug,
      description,
      pack_type,
      is_original,
      author_name,
      author_url,
      tags,
      preview_image_url,
      blurhash,
      zip_file_url,
    } = body;

    // Validate required fields
    if (!title || !slug || !pack_type || !zip_file_url) {
      return NextResponse.json(
        { error: 'Missing required fields: title, slug, pack_type, zip_file_url' },
        { status: 400 }
      );
    }

    // Validate pack_type
    const validPackTypes = ['daypack', 'weekpack', 'album'];
    if (!validPackTypes.includes(pack_type)) {
      return NextResponse.json(
        { error: 'Invalid pack_type. Must be one of: daypack, weekpack, album' },
        { status: 400 }
      );
    }

    // Check if slug already exists
    const { data: existingPack } = await supabase
      .from('packs')
      .select('id')
      .eq('slug', slug)
      .single();

    if (existingPack) {
      return NextResponse.json(
        { error: 'A pack with this slug already exists. Please choose a different title.' },
        { status: 409 }
      );
    }

    // Parse tags (comma-separated string to array)
    const tagsArray = tags
      ? tags.split(',').map(t => t.trim()).filter(t => t.length > 0)
      : [];

    // Create the pack record
    const { data: pack, error: insertError } = await supabase
      .from('packs')
      .insert({
        title,
        slug,
        description: description || null,
        pack_type,
        is_original: is_original ?? true,
        author_name: author_name || null,
        author_url: author_url || null,
        tags: tagsArray,
        preview_image_url: preview_image_url || null,
        blurhash: blurhash || null,
        zip_file_url,
        uploaded_by: user.id,
        status: 'pending',
        is_published: false,
        download_count: 0,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to create pack: ' + insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      pack,
    });

  } catch (error) {
    console.error('Create pack error:', error);
    return NextResponse.json(
      { error: 'Failed to create pack' },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const pack_type = searchParams.get('pack_type');
    const published_only = searchParams.get('published') !== 'false';
    const search = searchParams.get('search');
    const tag = searchParams.get('tag');
    const slug = searchParams.get('slug');

    let query = supabase
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
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (published_only) {
      query = query.eq('is_published', true);
    }

    if (pack_type && ['daypack', 'weekpack', 'album'].includes(pack_type)) {
      query = query.eq('pack_type', pack_type);
    }

    // Search in title and description
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Filter by tag (tags is an array column)
    if (tag) {
      query = query.contains('tags', [tag]);
    }

    // Filter by slug (for duplicate checking)
    if (slug) {
      query = query.eq('slug', slug);
    }

    const { data: packs, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch packs' },
        { status: 500 }
      );
    }

    return NextResponse.json({ packs });

  } catch (error) {
    console.error('Fetch packs error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch packs' },
      { status: 500 }
    );
  }
}

