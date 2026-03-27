import { createClient } from '@/lib/supabase/client';

/**
 * Sign in with Google OAuth.
 * Redirects the user to Google's consent screen.
 */
export async function signInWithGoogle() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  if (error) {
    console.error('Google sign-in error:', error.message);
    return { error };
  }

  return { data };
}

/**
 * Send a magic link to the user's email.
 */
export async function signInWithMagicLink(email: string) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  if (error) {
    console.error('Magic link error:', error.message);
    return { error };
  }

  return { data };
}

/**
 * Sign out the current user.
 */
export async function signOut() {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('Sign out error:', error.message);
    return { error };
  }

  window.location.href = '/';
  return {};
}

/**
 * Get the current user (client-side). Returns null if not logged in.
 */
export async function getCurrentUser() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}
