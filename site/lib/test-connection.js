import { createClient } from '@/lib/supabase/server'

export async function testConnection() {
  try {
    const supabase = await createClient()
    
    // Test a simple query
    const { data, error } = await supabase
      .from('packs')
      .select('id, title')
      .limit(1)
    
    if (error) {
      console.error('Database connection error:', error)
      return { success: false, error: error.message }
    }
    
    console.log('Database connection successful!')
    console.log('Sample data:', data)
    
    return { success: true, data }
  } catch (error) {
    console.error('Connection test failed:', error)
    return { success: false, error: error.message }
  }
} 