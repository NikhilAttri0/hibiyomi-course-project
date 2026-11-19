'use client';

import { Suspense } from 'react';
import LoginForm from '@/components/yoisho/auth/LoginForm';
import { Splash } from '@/components/yoisho/auth/Guard';

export default function Page() {
  return (
    <Suspense fallback={<Splash />}>
      <LoginForm />
    </Suspense>
  );
}
