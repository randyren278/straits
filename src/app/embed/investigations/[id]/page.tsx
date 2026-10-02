import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isCanaryEnabled } from '@/lib/canary';
import { getInvestigationStory } from '@/lib/investigations/story-store';
import { isValidStoryId } from '@/lib/investigations/story-model';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const REGIONS = { hormuz: 'STRAIT OF HORMUZ', suez: 'SUEZ CANAL', babel_mandeb: 'BAB EL-MANDEB', gulf_of_aden: 'GULF OF ADEN' } as const;

export default async function InvestigationStoryEmbed({ params }: { params: Promise<{ id: string }> }) {
  if (!isCanaryEnabled()) notFound();
  const { id } = await params;
  if (!isValidStoryId(id)) notFound();
  const story = await getInvestigationStory(id).catch(() => null);
  if (!story) notFound();
  const { snapshot } = story;
  const status = snapshot.evaluation.status === 'no_clear_reduction' ? 'below signal threshold' : snapshot.evaluation.status.replaceAll('_', ' ');
  return <main className="min-h-screen bg-black p-4 font-mono text-white">
      <article className="mx-auto max-w-2xl border border-amber-500/30 bg-gray-950 p-4 sm:p-5">
        <p className="text-[9px] uppercase tracking-[0.2em] text-amber-500">Straits · evidence snapshot · {REGIONS[snapshot.region]}</p>
        <h1 className="mt-3 text-base leading-6 text-gray-100">{snapshot.evaluation.headline}</h1>
        <p className="mt-2 text-xs leading-5 text-gray-400">{snapshot.evaluation.observedQuantity}</p>
        <div className="mt-4 grid grid-cols-2 gap-2 border-y border-gray-800 py-3 text-[10px] text-gray-500">
          <p>Assessment <span className="text-gray-300">{status}</span></p>
          <p>Window <span className="text-gray-300">{snapshot.window}</span></p>
          <p>Contacts <span className="text-gray-300">{snapshot.evidence.activity.current.contacts.toLocaleString()}</span></p>
          <p>Coverage <span className="text-gray-300">{snapshot.evidence.coverage.quality}</span></p>
        </div>
        <p className="mt-3 text-[10px] leading-4 text-gray-600">Saved {new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(story.createdAt))} UTC. This is an immutable snapshot, not live evidence.</p>
        <Link href={`/investigations/stories/${story.id}`} className="mt-4 inline-block text-[9px] uppercase tracking-wider text-amber-400 underline underline-offset-4">Open full story</Link>
      </article>
    </main>;
}
