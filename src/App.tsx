import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fetchSummaries } from './api';
import type { RepoSummary } from './types';

function App() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['summaries'],
    queryFn: fetchSummaries,
    staleTime: 30_000,
  });

  const summaries = data ?? [];

  const latestByRepo = useMemo(() => {
    const map = new Map<string, RepoSummary>();
    for (const s of summaries) {
      const prev = map.get(s.repo);
      if (!prev || new Date(s.timestamp).getTime() > new Date(prev.timestamp).getTime()) {
        map.set(s.repo, s);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.repo.localeCompare(b.repo));
  }, [summaries]);

  const chartData = latestByRepo.map((s) => ({
    repo: s.repo,
    passed: s.passed,
    failed: s.failed,
    broken: s.broken,
    skipped: s.skipped,
    total: s.total,
  }));

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
      <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0 }}>QA Portfolio Dashboard</h1>
          <div style={{ opacity: 0.75, marginTop: 4 }}>
            Executive snapshot across repos (latest run per repo).
          </div>
        </div>
        <div style={{ fontSize: 12, opacity: 0.75 }}>
          Source: R2 metrics → aggregated into <code>/data/summaries.json</code>
        </div>
      </header>

      {isLoading && <p style={{ marginTop: 16 }}>Loading…</p>}
      {error && (
        <p style={{ marginTop: 16, color: '#b00020' }}>
          Failed to load summaries: {String(error)}
        </p>
      )}

      <section style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {latestByRepo.map((s) => (
          <div
            key={s.repo}
            style={{
              border: '1px solid rgba(0,0,0,0.12)',
              borderRadius: 12,
              padding: 12,
              background: 'rgba(255,255,255,0.6)',
            }}
          >
            <div style={{ fontWeight: 700 }}>{s.repo}</div>
            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>
              {new Date(s.timestamp).toLocaleString()} • run {s.run_id}
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div><strong>Total</strong> {s.total}</div>
              <div><strong>Pass</strong> {s.passed}</div>
              <div><strong>Fail</strong> {s.failed}</div>
              <div><strong>Broken</strong> {s.broken}</div>
              <div><strong>Skip</strong> {s.skipped}</div>
            </div>
          </div>
        ))}
      </section>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ margin: '0 0 12px 0' }}>Latest run breakdown</h2>
        <div style={{ width: '100%', height: 360, border: '1px solid rgba(0,0,0,0.12)', borderRadius: 12, padding: 12 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="repo" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="passed" stackId="a" fill="#2e7d32" />
              <Bar dataKey="failed" stackId="a" fill="#c62828" />
              <Bar dataKey="broken" stackId="a" fill="#ef6c00" />
              <Bar dataKey="skipped" stackId="a" fill="#616161" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  )
}

export default App
