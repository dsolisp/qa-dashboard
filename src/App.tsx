import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fetchSummaries } from './api';
import type { RepoSummary } from './types';

const STATUS_COLORS = {
  passed: '#3ddc97',
  failed: '#f2706d',
  broken: '#f0a531',
  skipped: '#6b7280',
};

const LINE_COLORS = ['#d4af37', '#7dd3fc', '#f472b6', '#a3e635', '#fb923c'];

const AXIS_TICK = { fill: '#968f81', fontSize: 12 };
const GRID_STROKE = 'rgba(255,255,255,0.06)';
const TOOLTIP_STYLE = {
  background: '#191c25',
  border: '1px solid rgba(212,175,55,0.25)',
  borderRadius: 12,
  fontSize: 13,
  color: '#ebe6da',
};

function passRate(s: RepoSummary): number {
  return s.total > 0 ? Math.round((s.passed / s.total) * 100) : 0;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function rateColor(rate: number): string {
  if (rate >= 90) return STATUS_COLORS.passed;
  if (rate >= 70) return STATUS_COLORS.broken;
  return STATUS_COLORS.failed;
}

function verdictOf(rate: number): { label: string; cls: string } {
  if (rate >= 90) return { label: 'Pass', cls: 'pass' };
  if (rate >= 70) return { label: 'Review', cls: 'review' };
  return { label: 'Fail', cls: 'fail' };
}

function App() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['summaries'],
    queryFn: fetchSummaries,
    staleTime: 30_000,
  });

  const summaries = useMemo(() => data ?? [], [data]);

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

  const kpis = useMemo(() => {
    const total = latestByRepo.reduce((n, s) => n + s.total, 0);
    const passed = latestByRepo.reduce((n, s) => n + s.passed, 0);
    const failing = latestByRepo.reduce((n, s) => n + s.failed + s.broken, 0);
    return {
      total,
      passRate: total > 0 ? Math.round((passed / total) * 100) : 0,
      failing,
      repos: latestByRepo.length,
    };
  }, [latestByRepo]);

  const latestTimestamp = useMemo(
    () =>
      summaries.reduce<string | null>(
        (max, s) => (!max || s.timestamp > max ? s.timestamp : max),
        null,
      ),
    [summaries],
  );

  const chartData = latestByRepo.map((s) => ({
    repo: s.repo,
    passed: s.passed,
    failed: s.failed,
    broken: s.broken,
    skipped: s.skipped,
  }));

  const trendSeries = useMemo(() => {
    const byRepo = new Map<string, { t: number; rate: number }[]>();
    for (const s of summaries) {
      const t = new Date(s.timestamp).getTime();
      if (!byRepo.has(s.repo)) byRepo.set(s.repo, []);
      byRepo.get(s.repo)!.push({ t, rate: passRate(s) });
    }
    for (const points of byRepo.values()) points.sort((a, b) => a.t - b.t);
    return Array.from(byRepo.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [summaries]);

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <div className="brand-mark">⚖</div>
          <div>
            <h1>QA Portfolio Dashboard</h1>
            <p>Cross-stack CI evidence — every run on the record</p>
          </div>
        </div>
        <div className="header-right">
          <a className="back-link" href="https://dsolisp.github.io/">
            ← Portfolio
          </a>
          {latestTimestamp && (
            <div className="updated-pill">
              <span className="pulse-dot" />
              Updated {timeAgo(latestTimestamp)}
            </div>
          )}
        </div>
      </header>

      {isLoading && <div className="state">Loading metrics…</div>}
      {error != null && (
        <div className="state error">Failed to load summaries: {String(error)}</div>
      )}

      {!isLoading && !error && summaries.length === 0 && (
        <div className="state">No runs found yet — trigger a CI run to populate the dashboard.</div>
      )}

      {latestByRepo.length > 0 && (
        <>
          <section className="kpis">
            <div className="kpi">
              <div className="kpi-label">Total tests</div>
              <div className="kpi-value">{kpis.total}</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Pass rate</div>
              <div className="kpi-value pass">{kpis.passRate}%</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Failing / broken</div>
              <div className={`kpi-value${kpis.failing > 0 ? ' fail' : ''}`}>{kpis.failing}</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Repositories</div>
              <div className="kpi-value">{kpis.repos}</div>
            </div>
          </section>

          <h2 className="section-title">Latest run per repo</h2>
          <section className="cards">
            {latestByRepo.map((s) => {
              const rate = passRate(s);
              return (
                <div className="card" key={s.repo}>
                  <div className="card-top">
                    <div className="card-repo">{s.repo}</div>
                    <span className={`verdict ${verdictOf(rate).cls}`}>
                      Verdict: {verdictOf(rate).label}
                    </span>
                    <div className="card-rate" style={{ color: rateColor(rate) }}>
                      {rate}%
                    </div>
                  </div>
                  <div className="card-meta">
                    {new Date(s.timestamp).toLocaleString()} • run {s.run_id}
                  </div>
                  <div className="bar-track">
                    {s.total > 0 && (
                      <>
                        <span className="seg-pass" style={{ width: `${(s.passed / s.total) * 100}%` }} />
                        <span className="seg-fail" style={{ width: `${(s.failed / s.total) * 100}%` }} />
                        <span className="seg-broken" style={{ width: `${(s.broken / s.total) * 100}%` }} />
                        <span className="seg-skip" style={{ width: `${(s.skipped / s.total) * 100}%` }} />
                      </>
                    )}
                  </div>
                  <div className="chips">
                    <span className="chip pass">{s.passed} passed</span>
                    <span className="chip fail">{s.failed} failed</span>
                    <span className="chip broken">{s.broken} broken</span>
                    <span className="chip skip">{s.skipped} skipped</span>
                  </div>
                </div>
              );
            })}
          </section>

          <h2 className="section-title">Analytics</h2>
          <section className="charts">
            <div className="panel">
              <h2>Latest run breakdown</h2>
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barSize={48}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                    <XAxis dataKey="repo" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                    <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                    <Legend wrapperStyle={{ fontSize: 13 }} />
                    <Bar dataKey="passed" stackId="a" fill={STATUS_COLORS.passed} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="failed" stackId="a" fill={STATUS_COLORS.failed} />
                    <Bar dataKey="broken" stackId="a" fill={STATUS_COLORS.broken} />
                    <Bar dataKey="skipped" stackId="a" fill={STATUS_COLORS.skipped} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="panel">
              <h2>Pass rate trend</h2>
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                    <XAxis
                      dataKey="t"
                      type="number"
                      domain={['dataMin', 'dataMax']}
                      scale="time"
                      tick={AXIS_TICK}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(t: number) =>
                        new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                      }
                    />
                    <YAxis domain={[0, 100]} unit="%" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      labelFormatter={(t) => new Date(Number(t)).toLocaleString()}
                      formatter={(value) => [`${value}%`, 'pass rate']}
                    />
                    <Legend wrapperStyle={{ fontSize: 13 }} />
                    {trendSeries.map(([repo, points], i) => (
                      <Line
                        key={repo}
                        data={points}
                        dataKey="rate"
                        name={repo}
                        type="monotone"
                        stroke={LINE_COLORS[i % LINE_COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
        </>
      )}

      <footer className="foot">
        Test architecture standards enforced by{' '}
        <a href="https://github.com/dsolisp/gavel" target="_blank" rel="noreferrer">
          Gavel
        </a>{' '}
        — my open-source QA discipline engine for AI coding agents.
      </footer>
    </div>
  );
}

export default App;
