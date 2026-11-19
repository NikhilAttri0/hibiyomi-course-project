'use client';

import dynamic from 'next/dynamic';
import { Splash } from '@/components/yoisho/auth/Guard';


const View = dynamic(() => import('@/components/yoisho/StudentApp'), { ssr: false, loading: () => <Splash /> });

export default function Page() {
  return <View />;
}
