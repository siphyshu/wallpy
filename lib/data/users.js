import { createClient } from '@/lib/supabase/server';

// ============================================================================
// READ OPERATIONS
// ============================================================================

/**
 * Get user by ID
 */
export async function getUserById(id) {
  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('users')
      .select(`*`)
      .eq('id', id)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        return null // No user found
      }
      console.error('Error fetching user by ID:', error)
      throw new Error('Failed to fetch user')
    }
    
    return data
  } catch (error) {
    console.error('getUserById error:', error)
    return null
  }
}

/**
 * Get user by username
 */
export async function getUserByUsername(username) {
  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        return null // No user found
      }
      console.error('Error fetching user by username:', error)
      throw new Error('Failed to fetch user')
    }
    
    return data
  } catch (error) {
    console.error('getUserByUsername error:', error)
    return null
  }
}

/**
 * Get current authenticated user (server-side)
 */
export async function getCurrentUser() {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      return null
    }
    
    // Get the user profile from our users table
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select(`*`)
      .eq('id', user.id)
      .single()
    
    if (profileError) {
      console.error('Error fetching user profile:', profileError)
      return null
    }
    
    return profile
  } catch (error) {
    console.error('getCurrentUser error:', error)
    return null
  }
}

// ============================================================================
// WRITE OPERATIONS
// ============================================================================

/**
 * Create a new user
 */
export async function createUser(userData) {
  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('users')
      .insert(userData)
      .select()
      .single()
    
    if (error) {
      console.error('Error creating user:', error)
      throw new Error('Failed to create user')
    }
    
    return data
  } catch (error) {
    console.error('createUser error:', error)
    throw error
  }
}

/**
 * Update user profile (server-side)
 */
export async function updateUserProfile(userId, updates) {
  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single()
    
    if (error) {
      console.error('Error updating user profile:', error)
      throw error
    }
    
    return data
  } catch (error) {
    console.error('updateUserProfile error:', error)
    throw error
  }
}

/**
 * Delete user
 */
export async function deleteUser(id) {
  try {
    const supabase = await createClient()
    
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id)
    
    if (error) {
      console.error('Error deleting user:', error)
      throw new Error('Failed to delete user')
    }
    
    return true
  } catch (error) {
    console.error('deleteUser error:', error)
    throw error
  }
}

// ============================================================================
// AUTHENTICATION HELPERS
// ============================================================================

/**
 * Sign up a new user
 */
export async function signUp(email, password, userData = {}) {
  try {
    const supabase = await createClient()
    
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    })
    
    if (authError) {
      console.error('Auth signup error:', authError)
      throw new Error('Failed to create account')
    }
    
    if (authData.user) {
      // Create user profile
      const profileData = {
        id: authData.user.id,
        email: authData.user.email,
        ...userData
      }
      
      await createUser(profileData)
    }
    
    return authData
  } catch (error) {
    console.error('signUp error:', error)
    throw error
  }
}

/**
 * Sign in user
 */
export async function signIn(email, password) {
  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    
    if (error) {
      console.error('Auth signin error:', error)
      throw new Error('Failed to sign in')
    }
    
    return data
  } catch (error) {
    console.error('signIn error:', error)
    throw error
  }
}

/**
 * Sign out user
 */
export async function signOut() {
  try {
    const supabase = await createClient()
    
    const { error } = await supabase.auth.signOut()
    
    if (error) {
      console.error('Auth signout error:', error)
      throw new Error('Failed to sign out')
    }
    
    return true
  } catch (error) {
    console.error('signOut error:', error)
    throw error
  }
}

 