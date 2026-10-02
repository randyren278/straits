'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { followKey, getFollowBaseline, parseFollowList } from '@/lib/investigations/story-model';
import type { InvestigationFollow } from '@/lib/investigations/story-model';
import type { ClaimEvaluation, InvestigationRegion, InvestigationWindow } from '@/lib/investigations/claims';
import type { InvestigationEvidence } from '@/lib/investigations/evidence';

const FOLLOW_KEY = 'straits:investigation-follows:v1';

interface Props {
  region: InvestigationRegion;
  window: InvestigationWindow;
  claimText: string;
  evidence: InvestigationEvidence;
  evaluation: ClaimEvaluation;
}

export function SaveFollowActions({ region, window, claimText, evidence, evaluation }: Props) {
  const [annotation, setAnnotation] = useState('');
  const [busy, setBusy] = useState<'save' | 'follow' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [storyHref, setStoryHref] = useState<string | null>(null);
  const [followingSaved, setFollowingSaved] = useState(false);
  const key = useMemo(() => followKey(region, window, claimText), [region, window, claimText]);

  function followQuestion() {
    setError(null);
    setBusy('follow');
    try {
      const existing: InvestigationFollow[] = parseFollowList(localStorage.getItem(FOLLOW_KEY));
      const entry: InvestigationFollow = {
        key,
        region,
        window,
        claimText: claimText.trim(),
        baseline: getFollowBaseline({ evidence, evaluation }),
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(FOLLOW_KEY, JSON.stringify([entry, ...existing.filter((item) => item.key !== key)].slice(0, 50)));
      setFollowingSaved(true);
    } catch {
      setError('This browser could not save the follow list.');
    } finally {
      setBusy(null);
    }
  }

  async function createStory() {
    setError(null);
    setBusy('save');
    setStoryHref(null);
    try {
      const response = await fetch('/api/investigation-stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region, window, claim: claimText, annotation }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Story snapshot could not be saved.');
      setStoryHref(payload.href as string);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Story snapshot could not be saved.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-label="Save or follow this investigation" className="mt-4 border border-gray-800 bg-black p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[9px] font-mono uppercase tracking-widest text-gray-600">Keep this evidence</p>
          <p className="mt-1 text-[10px] text-gray-500">A story saves a server-built snapshot. Following stays in this browser.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy !== null} onClick={followQuestion} className="min-h-9 border border-gray-700 px-3 text-[9px] font-mono uppercase tracking-wider text-gray-300 hover:border-amber-500/50 hover:text-amber-400 disabled:opacity-50">
            {busy === 'follow' ? 'Saving…' : followingSaved ? 'Update follow baseline' : 'Follow question'}
          </button>
          <button type="button" disabled={busy !== null || !claimText.trim()} onClick={createStory} className="min-h-9 border border-amber-500/50 px-3 text-[9px] font-mono uppercase tracking-wider text-amber-400 hover:bg-amber-500/10 disabled:opacity-50">
            {busy === 'save' ? 'Saving…' : 'Create shareable story'}
          </button>
        </div>
      </div>
      <label className="mt-3 block">
        <span className="mb-1 block text-[9px] font-mono uppercase tracking-wider text-gray-600">Optional analyst annotation · max 500 characters</span>
        <textarea value={annotation} onChange={(event) => setAnnotation(event.target.value.slice(0, 500))} rows={2} maxLength={500} className="w-full resize-y border border-gray-800 bg-gray-950 px-2 py-2 text-xs text-gray-300 focus:border-amber-500 focus:outline-none" placeholder="Add context for readers; evidence is rebuilt by the server." />
      </label>
      {storyHref && <p role="status" className="mt-2 text-xs text-amber-400">Snapshot saved. <Link href={storyHref} className="underline underline-offset-2">Open or share the story</Link></p>}
      {followingSaved && <p role="status" className="mt-2 text-xs text-gray-400">Saved on this device. Revisit <Link href="/investigations/following" className="text-amber-400 underline underline-offset-2">Following</Link> to check for material changes.</p>}
      {error && <p role="alert" className="mt-2 text-xs text-red-300">{error}</p>}
    </section>
  );
}
