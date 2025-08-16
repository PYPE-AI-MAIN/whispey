// src/app/auth/callback/page.tsx
'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// Inner component that uses useSearchParams
function CallbackComponent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    const redirect = searchParams.get('redirect');

    if (!token || !redirect) {
      setError('Missing token or redirect URL');
      return;
    }

    const validateToken = async () => {
      try {
        const res = await fetch(`/api/validate-sso-token?token=${token}`);
        const data = await res.json();

        if (res.ok && data.valid) {
          // Token valid, redirect
          router.replace(redirect);
        } else {
          setError(data.detail || 'Invalid token');
        }
      } catch (err) {
        setError('Something went wrong while validating the token');
      }
    };

    validateToken();
  }, [searchParams, router]);

  if (error) {
    return <div style={{ padding: '2rem', color: 'red' }}>SSO Error: {error}</div>;
  }

  return <div style={{ padding: '2rem' }}>Validating, please wait...</div>;
}

// Default export with Suspense boundary
export default function CallbackPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem' }}>Loading...</div>}>
      <CallbackComponent />
    </Suspense>
  );
}