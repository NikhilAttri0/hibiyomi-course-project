'use client';

import dynamic from 'next/dynamic';

const Landing = dynamic(() => import('@/components/yoisho/Landing'), {
  ssr: false,
  loading: () => <div className="min-h-screen bg-canvas" />,
});

export default function HomePage() {
  return <Landing />;
}
