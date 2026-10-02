import { redirect } from 'next/navigation';
import { isCanaryEnabled } from '@/lib/canary';

export default function Home() {
  redirect(isCanaryEnabled() ? '/investigations' : '/dashboard');
}
