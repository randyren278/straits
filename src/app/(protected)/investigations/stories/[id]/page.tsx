import { notFound } from 'next/navigation';
import { Header } from '@/components/ui/Header';
import { StoryViewer } from '@/components/investigations/StoryViewer';
import { isCanaryEnabled } from '@/lib/canary';
import { getInvestigationStory } from '@/lib/investigations/story-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function InvestigationStoryPage({ params }: { params: Promise<{ id: string }> }) {
  if (!isCanaryEnabled()) notFound();
  const { id } = await params;
  const story = await getInvestigationStory(id).catch(() => null);
  if (!story) notFound();
  return <><Header /><StoryViewer story={story} /></>;
}
