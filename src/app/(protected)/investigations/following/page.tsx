import { notFound } from 'next/navigation';
import { Header } from '@/components/ui/Header';
import { isCanaryEnabled } from '@/lib/canary';
import { FollowingClient } from './FollowingClient';

export default function FollowingPage() {
  if (!isCanaryEnabled()) notFound();
  return <><Header /><FollowingClient /></>;
}
