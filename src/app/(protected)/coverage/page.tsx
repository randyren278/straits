import { notFound } from 'next/navigation';
import { Header } from '@/components/ui/Header';
import { isCanaryEnabled } from '@/lib/canary';
import { CoverageClient } from './CoverageClient';

export default function CoveragePage() {
  if (!isCanaryEnabled()) notFound();
  return <><Header /><CoverageClient /></>;
}
