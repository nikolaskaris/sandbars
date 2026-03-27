'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { signInWithGoogle, signInWithMagicLink, getCurrentUser } from '@/lib/auth';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { ArrowLeft, Mail } from 'lucide-react';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

export default function LoginPageWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-6 w-6 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    }>
      <LoginPage />
    </Suspense>
  );
}

function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Redirect if already logged in
  useEffect(() => {
    getCurrentUser().then((user) => {
      if (user) {
        router.replace('/');
      } else {
        setCheckingAuth(false);
      }
    });
  }, [router]);

  // Check for auth_error in URL
  useEffect(() => {
    if (searchParams.get('auth_error') === 'true') {
      setError('Sign-in failed. Please try again.');
    }
  }, [searchParams]);

  // Auto-dismiss error after 5 seconds
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(timer);
  }, [error]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleGoogleSignIn = useCallback(async () => {
    setGoogleLoading(true);
    setError(null);
    const result = await signInWithGoogle();
    if (result.error) {
      setError('Failed to sign in with Google. Please try again.');
      setGoogleLoading(false);
    }
  }, []);

  const handleMagicLink = useCallback(async () => {
    setEmailError('');
    if (!email || !email.includes('@') || !email.includes('.')) {
      setEmailError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    setError(null);
    const result = await signInWithMagicLink(email);
    if (result.error) {
      setError('Failed to send magic link. Please try again.');
      setLoading(false);
    } else {
      setMagicLinkSent(true);
      setLoading(false);
      setResendCooldown(30);
    }
  }, [email]);

  const handleResend = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await signInWithMagicLink(email);
    if (result.error) {
      setError('Failed to resend. Please try again.');
    } else {
      setResendCooldown(30);
    }
    setLoading(false);
  }, [email]);

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-6 w-6 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  const anyLoading = loading || googleLoading;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      {/* Back to map */}
      <div className="w-full max-w-[400px] mb-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to map
        </Link>
      </div>

      <Card variant="elevated" padding="spacious" className="w-full max-w-[400px]">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-xl font-medium text-text-primary mb-1">Sandbars</h1>
          <p className="text-sm text-text-secondary">
            Sign in to sync your favorites and preferences
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-4 px-3 py-2 rounded bg-error/10 text-error text-sm flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-2 text-error/60 hover:text-error"
            >
              &times;
            </button>
          </div>
        )}

        {magicLinkSent ? (
          /* ─── Magic Link Sent State ─── */
          <div className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mb-4">
              <Mail className="h-6 w-6 text-accent" />
            </div>
            <h2 className="text-lg font-medium text-text-primary mb-1">Check your inbox</h2>
            <p className="text-sm text-text-secondary mb-1">
              We sent a sign-in link to
            </p>
            <p className="text-sm font-medium text-text-primary mb-4">{email}</p>
            <p className="text-sm text-text-tertiary mb-6">
              Click the link in the email to sign in. You can close this page.
            </p>
            <div className="flex flex-col gap-2">
              <Button
                variant="secondary"
                size="md"
                loading={loading}
                disabled={resendCooldown > 0}
                onClick={handleResend}
                className="w-full"
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend'}
              </Button>
              <button
                onClick={() => {
                  setMagicLinkSent(false);
                  setEmail('');
                }}
                className="text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                Use a different email
              </button>
            </div>
          </div>
        ) : (
          /* ─── Sign In Options ─── */
          <>
            {/* Google OAuth */}
            <button
              onClick={handleGoogleSignIn}
              disabled={anyLoading}
              className={[
                'w-full h-12 rounded flex items-center justify-center gap-3',
                'bg-white border border-border hover:bg-surface-secondary',
                'text-text-primary font-medium text-base',
                'transition-all duration-150 ease-out active:scale-98',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                'disabled:opacity-40 disabled:pointer-events-none',
              ].join(' ')}
            >
              {googleLoading ? (
                <div className="h-4 w-4 border-2 border-text-secondary border-t-transparent rounded-full animate-spin" />
              ) : (
                <GoogleIcon />
              )}
              Continue with Google
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 my-5">
              <hr className="flex-1 border-border" />
              <span className="text-sm text-text-tertiary">or</span>
              <hr className="flex-1 border-border" />
            </div>

            {/* Magic Link */}
            <div className="flex flex-col gap-3">
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError('');
                }}
                error={emailError}
                disabled={anyLoading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleMagicLink();
                }}
              />
              <Button
                variant="primary"
                size="lg"
                loading={loading}
                disabled={anyLoading}
                onClick={handleMagicLink}
                className="w-full h-12"
              >
                Send magic link
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
