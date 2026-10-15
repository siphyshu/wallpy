# Authentication System

This document describes the authentication system implemented for the Wallpy website using Supabase Auth.

## Overview

The authentication system uses Supabase Auth for user management and includes:

- User registration and login
- Password reset functionality
- Protected routes
- User profile management
- Direct Supabase client integration

## Components

### Login Form (`components/auth/login-form.jsx`)

Features:
- Email and password authentication
- Error handling with specific error messages
- Loading states
- Automatic redirect if already authenticated
- Support for redirect URLs

### Sign Up Form (`components/auth/sign-up-form.jsx`)

Features:
- User registration with email, password, name, and username
- Password confirmation
- Validation (password length, matching passwords)
- Server-side profile creation
- Email confirmation flow

### Protected Route (`components/auth/ProtectedRoute.jsx`)

A wrapper component that:
- Checks if user is authenticated
- Redirects to login if not authenticated
- Shows loading state while checking auth
- Preserves the original URL for redirect after login

### Navigation Bar (`components/NavBar.jsx`)

Features:
- Displays user authentication status
- Shows user name/email when logged in
- Provides sign in/out functionality
- Conditional upload link for authenticated users

## API Routes

### POST `/api/auth/signup`

Handles user registration:
- Creates Supabase auth user
- Creates user profile in database
- Returns success/error response

## Database Schema

The `users` table stores user profiles with fields:
- `id`: UUID (matches Supabase auth user ID)
- `username`: Unique username
- `email`: User's email address
- `name`: Full name
- `avatar_url`: Profile picture URL
- `cover_url`: Cover photo URL
- `bio`: User biography
- `links`: JSONB array of user links with name and URL
- `role`: User role (user, moderator, admin)
- `is_verified`: Verification status
- `created_at`: Account creation timestamp

## Error Handling

The system provides specific error messages for common scenarios:

- Invalid credentials
- Email not confirmed
- User already exists
- Password requirements not met
- Too many login attempts

## Security Features

- Row Level Security (RLS) policies in database
- Server-side session validation
- Protected API routes
- Secure password handling
- CSRF protection via Supabase

## Usage Examples

### Protecting a Route

```jsx
import ProtectedRoute from '@/components/auth/ProtectedRoute';

export default function UploadPage() {
  return (
    <ProtectedRoute>
      <div>Upload content here</div>
    </ProtectedRoute>
  );
}
```

### Using Direct Supabase Auth

```jsx
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

function MyComponent() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user || null);
      } catch (error) {
        console.error('Error getting initial session:', error);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user || null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <div>Please log in</div>;
  }
  
  return (
    <div>
      <p>Welcome, {user.user_metadata?.name || user.email}!</p>
      <button onClick={handleSignOut}>Sign Out</button>
    </div>
  );
}
```

## Testing

Visit `/test-auth` to see the current authentication state and user information.

## Environment Variables

Required environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key 