import type { RepoSummary } from './types';

export async function fetchSummaries(): Promise<RepoSummary[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/summaries.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load summaries.json: ${res.status}`);
  const data = (await res.json()) as RepoSummary[];
  return Array.isArray(data) ? data : [];
}

