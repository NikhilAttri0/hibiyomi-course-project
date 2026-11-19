'use client';

import dynamic from 'next/dynamic';
import { Splash } from '@/components/yoisho/auth/Guard';
import Guard from '@/components/yoisho/auth/Guard';

const View = dynamic(() => import('@/components/yoisho/staff/TeacherDashboard'), { ssr: false, loading: () => <Splash /> });

export default function Page() {
  return (
    <Guard roles={['teacher', 'admin']}>
      <View />
    </Guard>
  );
}
