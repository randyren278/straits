import { notFound } from 'next/navigation';
import { Header } from '@/components/ui/Header';
import { isCanaryEnabled } from '@/lib/canary';
import { EncounterCaseboard } from '@/components/investigations/EncounterCaseboard';

export default async function EncounterCasePage({ params }: { params: Promise<{ imo: string }> }) {
  if (!isCanaryEnabled()) notFound();
  const { imo } = await params;
  if (!/^\d{7}$/.test(imo)) notFound();

  return <><Header /><EncounterCaseboard imo={imo} /></>;
}
