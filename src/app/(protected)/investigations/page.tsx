import { notFound } from 'next/navigation';
import { Header } from '@/components/ui/Header';
import { InvestigationsClient } from './InvestigationsClient';
import { isCanaryEnabled } from '@/lib/canary';

export default function InvestigationsPage() {
  if (!isCanaryEnabled()) notFound();

  return <><Header /><InvestigationsClient /></>;
}
