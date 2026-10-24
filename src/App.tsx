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
import { useTheme } from './useTheme';
import ThemeToggle from './ThemeToggle';

const STATUS_COLORS = {
  passed: '#3ddc97',
  failed: '#f2706d',
  broken: '#f0a531',
  skipped: '#6b7280',
};

const LINE_COLORS = ['#3dffc7', '#7dd3fc', '#f472b6', '#a3e635', '#fb923c'];
const STALE_MS = 14 * 24 * 60 * 60 * 1000;
const CHART_HEIGHT = 320;

const REPO_LABELS: Record<string, string> = {
  CSharpSeleniumProject: 'C# Selenium',
  CypressProject: 'Cypress',
  JavaSeleniumProject: 'Java Selenium',
  PlaywrightProject: 'Playwright',
  PythonSeleniumProject: 'Python Selenium',
};

function passRate(s: RepoSummary): number {
  return s.total > 0 ? Math.round((s.passed / s.total) * 100) : 0;
}

function repoLabel(repo: string): string {
  return REPO_LABELS[repo] ?? repo.replace(/Project$/, '');
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function dayTs(day: string): number {
  return new Date(`${day}T00:00:00Z`).getTime();
}

function fmtTs(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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

function isStale(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() >= STALE_MS;
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

/** Newest nonzero summary per repo — never surface empty Allure shells as "latest". */
function latestHealthyByRepo(summaries: RepoSummary[]): RepoSummary[] {
  const map = new Map<string, RepoSummary>();
  for (const s of summaries) {
    if (s.total <= 0) continue;
    const prev = map.get(s.repo);
    if (!prev || new Date(s.timestamp).getTime() > new Date(prev.timestamp).getTime()) {
      map.set(s.repo, s);
    }
  }
  return Array.from(map.values()).sort((a, b) => a.repo.localeCompare(b.repo));
}

function App() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const AXIS_TICK = { fill: isDark ? '#8b95a8' : '#5a6578', fontSize: 12 };
  const GRID_STROKE = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const TOOLTIP_STYLE = {
    background: isDark ? '#12161f' : '#ffffff',
    border: `1px solid ${isDark ? 'rgba(61,255,199,0.28)' : 'rgba(15,159,122,0.28)'}`,
    borderRadius: 12,
    fontSize: 13,
    color: isDark ? '#e8eaed' : '#12151c',
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['summaries'],
    queryFn: fetchSummaries,
    staleTime: 30_000,
  });

  const summaries = useMemo(() => data ?? [], [data]);

  const latestByRepo = useMemo(() => latestHealthyByRepo(summaries), [summaries]);

  const freshRepos = useMemo(
    () => latestByRepo.filter((s) => !isStale(s.timestamp)),
    [latestByRepo],
  );
  const staleCount = latestByRepo.length - freshRepos.length;
  const kpiSource = freshRepos.length > 0 ? freshRepos : latestByRepo;
  const kpiScope = freshRepos.length > 0 ? 'fresh' : 'stale-fallback';

  const kpis = useMemo(() => {
    const total = kpiSource.reduce((n, s) => n + s.total, 0);
    const passed = kpiSource.reduce((n, s) => n + s.passed, 0);
    const failing = kpiSource.reduce((n, s) => n + s.failed + s.broken, 0);
    return {
      total,
      passRate: total > 0 ? Math.round((passed / total) * 100) : 0,
      failing,
      repos: kpiSource.length,
    };
  }, [kpiSource]);

  const latestTimestamp = useMemo(
    () =>
      latestByRepo.reduce<string | null>(
        (max, s) => (!max || s.timestamp > max ? s.timestamp : max),
        null,
      ),
    [latestByRepo],
  );

  const chartData = latestByRepo.map((s) => ({
    repo: repoLabel(s.repo),
    passed: s.passed,
    failed: s.failed,
    broken: s.broken,
    skipped: s.skipped,
  }));

  const trendData = useMemo(() => {
    const byDayRepo = new Map<string, Map<string, RepoSummary>>();

    for (const s of summaries) {
      if (s.total <= 0) continue;

      const day = dayKey(s.timestamp);
      if (!byDayRepo.has(day)) byDayRepo.set(day, new Map());

      const repoRuns = byDayRepo.get(day)!;
      const prev = repoRuns.get(s.repo);
      if (!prev || new Date(s.timestamp).getTime() > new Date(prev.timestamp).getTime()) {
        repoRuns.set(s.repo, s);
      }
    }

    const sorted = Array.from(byDayRepo.entries()).sort(([a], [b]) => a.localeCompare(b));
    const latestTs = sorted.length > 0 ? dayTs(sorted[sorted.length - 1][0]) : 0;
    const cutoff = latestTs - 30 * 24 * 60 * 60 * 1000;

    return sorted
      .filter(([day]) => dayTs(day) >= cutoff)
      .map(([day, repoRuns]) => {
        const point: Record<string, string | number> = { ts: dayTs(day), day };
        for (const [repo, summary] of repoRuns) point[repo] = passRate(summary);
        return point;
      });
  }, [summaries]);

  const trendRepos = useMemo(
    () => latestByRepo.map((s) => s.repo),
    [latestByRepo],
  );

  return (
    <div className="app">
      <ThemeToggle />
      <header className="header">
        <div className="brand">
          <div className="brand-mark">DS</div>
          <div>
            <h1>QA Portfolio Dashboard</h1>
            <p>Latest healthy CI evidence — empty Allure shells excluded</p>
          </div>
        </div>
        <div className="header-right">
          <a className="back-link" href="https://dsolisp.github.io">
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
          {staleCount > 0 && (
            <div className={`freshness-banner${kpiScope === 'stale-fallback' ? ' is-warn' : ''}`}>
              {kpiScope === 'fresh'
                ? `KPIs use ${freshRepos.length} report${freshRepos.length === 1 ? '' : 's'} from the last 14 days. ${staleCount} stack${staleCount === 1 ? '' : 's'} still show older healthy runs below.`
                : `No reports newer than 14 days — KPIs fall back to the latest healthy (nonzero) runs. Reactivate nightlies to refresh.`}
            </div>
          )}

          <section className="kpis" aria-label="Key metrics from latest healthy reports">
            <div className="kpi">
              <div className="kpi-label">Total tests</div>
              <div className="kpi-value">{kpis.total}</div>
              <div className="kpi-hint">
                {kpiScope === 'fresh' ? 'Fresh reports' : 'Latest healthy'}
              </div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Pass rate</div>
              <div className="kpi-value pass">{kpis.passRate}%</div>
              <div className="kpi-hint">Weighted · nonzero only</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Failing / broken</div>
              <div className={`kpi-value${kpis.failing > 0 ? ' fail' : ''}`}>{kpis.failing}</div>
              <div className="kpi-hint">Same scope as KPIs</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Repositories</div>
              <div className="kpi-value">{kpis.repos}</div>
              <div className="kpi-hint">With healthy reports</div>
            </div>
          </section>

          <h2 className="section-title">Latest healthy run per repo</h2>
          <section className="cards">
            {latestByRepo.map((s) => {
              const rate = passRate(s);
              const stale = isStale(s.timestamp);
              return (
                <div className={`card${stale ? ' is-stale' : ''}`} key={s.repo}>
                  <div className="card-top">
                    <div className="card-repo">{repoLabel(s.repo)}</div>
                    <span className={`verdict ${verdictOf(rate).cls}`}>
                      Verdict: {verdictOf(rate).label}
                    </span>
                    <div className="card-rate" style={{ color: rateColor(rate) }}>
                      {rate}%
                    </div>
                  </div>
                  <div className="card-meta">
                    {timeAgo(s.timestamp)} · {new Date(s.timestamp).toLocaleString()} · run{' '}
                    {s.run_id}
                    {stale && <span className="stale-pill">stale nightly</span>}
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
              <div className="chart-frame">
                <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={0}>
                  <BarChart data={chartData} barSize={42} margin={{ top: 8, right: 10, left: -8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                    <XAxis dataKey="repo" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={0} />
                    <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
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
              <div className="chart-frame">
                <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={0}>
                  <LineChart data={trendData} margin={{ top: 8, right: 18, left: -8, bottom: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                    <XAxis
                      dataKey="ts"
                      type="number"
                      scale="time"
                      domain={['auto', 'auto']}
                      tick={AXIS_TICK}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={40}
                      tickFormatter={(ts: number) => fmtTs(ts)}
                    />
                    <YAxis domain={[0, 100]} unit="%" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      labelFormatter={(ts) => fmtTs(Number(ts))}
                      formatter={(value, name) => [`${value}%`, repoLabel(String(name))]}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                    {trendRepos.map((repo, i) => (
                      <Line
                        key={repo}
                        dataKey={repo}
                        name={repoLabel(repo)}
                        type="monotone"
                        stroke={LINE_COLORS[i % LINE_COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 2 }}
                        activeDot={{ r: 5 }}
                        connectNulls={true}
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
