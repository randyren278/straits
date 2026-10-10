import { notFound } from 'next/navigation';
import { Header } from '@/components/ui/Header';
import { isCanaryEnabled } from '@/lib/canary';
import { EncounterIndex } from '@/components/investigations/EncounterIndex';

export default function EncounterIndexPage() {
  if (!isCanaryEnabled()) notFound();
  return <><Header /><EncounterIndex /></>;
}
