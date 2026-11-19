'use client';

import { Suspense } from 'react';
import SignupForm from '@/components/yoisho/auth/SignupForm';
import { Splash } from '@/components/yoisho/auth/Guard';

export default function Page() {
  return (
    <Suspense fallback={<Splash />}>
      <SignupForm />
    </Suspense>
  );
}
