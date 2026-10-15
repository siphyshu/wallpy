import { createClient } from '@/lib/supabase/server'

// ============================================================================
// READ OPERATIONS
// ============================================================================

/**
 * Get download statistics for a pack
 */
export async function getPackDownloadStats(packId) {
  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('downloads')
      .select('id, downloaded_at')
      .eq('pack_id', packId)
      .order('downloaded_at', { ascending: false })
    
    if (error) {
      console.error('Error fetching pack download stats:', error)
      throw new Error('Failed to fetch download stats')
    }
    
    return {
      totalDownloads: data.length,
      recentDownloads: data.slice(0, 10), // Last 10 downloads
      downloads: data
    }
  } catch (error) {
    console.error('getPackDownloadStats error:', error)
    return { totalDownloads: 0, recentDownloads: [], downloads: [] }
  }
}

/**
 * Get download statistics for all packs
 */
export async function getAllDownloadStats() {
  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('downloads')
      .select(`
        id,
        pack_id,
        downloaded_at,
        user_id,
        ip_address
      `)
      .order('downloaded_at', { ascending: false })
    
    if (error) {
      console.error('Error fetching all download stats:', error)
      throw new Error('Failed to fetch download stats')
    }
    
    // Group by pack
    const statsByPack = data.reduce((acc, download) => {
      if (!acc[download.pack_id]) {
        acc[download.pack_id] = []
      }
      acc[download.pack_id].push(download)
      return acc
    }, {})
    
    return statsByPack
  } catch (error) {
    console.error('getAllDownloadStats error:', error)
    return {}
  }
}

/**
 * Get recent downloads
 */
export async function getRecentDownloads(limit = 20) {
  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('downloads')
      .select(`
        id,
        pack_id,
        downloaded_at,
        user_id,
        ip_address,
        user_agent,
        referer,
        packs!inner (
          id,
          title,
          slug
        )
      `)
      .order('downloaded_at', { ascending: false })
      .limit(limit)
    
    if (error) {
      console.error('Error fetching recent downloads:', error)
      throw new Error('Failed to fetch recent downloads')
    }
    
    return data || []
  } catch (error) {
    console.error('getRecentDownloads error:', error)
    return []
  }
}

// ============================================================================
// WRITE OPERATIONS
// ============================================================================

/**
 * Record a download
 */
export async function recordDownload(downloadData) {
  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('downloads')
      .insert(downloadData)
      .select()
      .single()
    
    if (error) {
      console.error('Error recording download:', error)
      throw new Error('Failed to record download')
    }
    
    return data
  } catch (error) {
    console.error('recordDownload error:', error)
    throw error
  }
}

/**
 * Record a download with request information
 */
export async function recordDownloadFromRequest(packId, request) {
  try {
    const userAgent = request.headers.get('user-agent') || null
    const referer = request.headers.get('referer') || null
    
    // Get client IP (this is a simplified version)
    const forwarded = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const ipAddress = forwarded?.split(',')[0] || realIp || 'unknown'
    
    const downloadData = {
      pack_id: packId,
      ip_address: ipAddress,
      user_agent: userAgent,
      referer: referer
    }
    
    return await recordDownload(downloadData)
  } catch (error) {
    console.error('recordDownloadFromRequest error:', error)
    throw error
  }
}

// ============================================================================
// ANALYTICS FUNCTIONS
// ============================================================================

/**
 * Get download analytics for a date range
 */
export async function getDownloadAnalytics(startDate, endDate) {
  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('downloads')
      .select(`
        id,
        pack_id,
        downloaded_at,
        packs!inner (
          id,
          title,
          slug
        )
      `)
      .gte('downloaded_at', startDate)
      .lte('downloaded_at', endDate)
      .order('downloaded_at', { ascending: false })
    
    if (error) {
      console.error('Error fetching download analytics:', error)
      throw new Error('Failed to fetch download analytics')
    }
    
    // Group by date
    const analyticsByDate = data.reduce((acc, download) => {
      const date = download.downloaded_at.split('T')[0]
      if (!acc[date]) {
        acc[date] = []
      }
      acc[date].push(download)
      return acc
    }, {})
    
    return analyticsByDate
  } catch (error) {
    console.error('getDownloadAnalytics error:', error)
    return {}
  }
}

/**
 * Get top downloaded packs
 */
export async function getTopDownloadedPacks(limit = 10) {
  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('packs')
      .select(`
        id,
        title,
        slug,
        download_count,
        created_at
      `)
      .eq('is_published', true)
      .order('download_count', { ascending: false })
      .limit(limit)
    
    if (error) {
      console.error('Error fetching top downloaded packs:', error)
      throw new Error('Failed to fetch top downloaded packs')
    }
    
    return data || []
  } catch (error) {
    console.error('getTopDownloadedPacks error:', error)
    return []
  }
} 