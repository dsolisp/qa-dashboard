export type RepoSummary = {
  repo: string;
  run_id: string;
  timestamp: string;
  suite: string;
  total: number;
  passed: number;
  failed: number;
  broken: number;
  skipped: number;
  duration_ms: number;
};

