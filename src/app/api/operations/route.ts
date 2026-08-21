import { NextResponse } from 'next/server';
import { getLatestPipelineRuns } from '@/lib/db/pipeline-runs';
import { getRiskScoreFreshness } from '@/lib/db/operations';

/**
 * Protected operational snapshot for the intelligence pipeline.
 *
 * The deployment auth proxy protects this route when production auth is
 * configured. Intentionally omits worker hostnames and raw exception text so it
 * is still safe in zero-config demo mode.
 */
export async function GET() {
  try {
    const [runs, riskScores] = await Promise.all([
      getLatestPipelineRuns(),
      getRiskScoreFreshness(),
    ]);

    const pipelineRuns = runs.map(({ jobName, status, startedAt, finishedAt, durationMs }) => ({
      jobName,
      status,
      startedAt,
      finishedAt,
      durationMs,
    }));
    const failedJobs = pipelineRuns.filter((run) => run.status === 'failed').length;
    const staleRiskScores = riskScores.staleScores > 0;
    const status = failedJobs > 0 || staleRiskScores ? 'degraded' : 'ok';

    return NextResponse.json(
      {
        status,
        pipelineRuns,
        riskScores,
        timestamp: new Date().toISOString(),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('[operations] diagnostics query failed', error);
    return NextResponse.json(
      {
        status: 'unavailable',
        pipelineRuns: [],
        riskScores: null,
        timestamp: new Date().toISOString(),
      },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  }
}
