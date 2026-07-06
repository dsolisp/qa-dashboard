# QA Portfolio Dashboard

Executive view of the five-stack QA ecosystem: aggregates per-run `summary.json` files from Cloudflare R2 and deploys a static site to **GitHub Pages**.

## Live site (canonical URL)

**https://dsolisp.github.io/qa-dashboard/**

Set this URL in the GitHub repo **About** → Website (optional). For a custom domain later, use GitHub Pages settings and document the CNAME in [ADR-018](../shared-docs/docs/adr/ADR-018-multi-repo-reporting-aggregation.md).

## How it works

1. Consumer repos upload JSON to R2 bucket `qa-portfolio-metrics` (see `scripts/generate_summary_json.js` in each stack and [ADR-018](../shared-docs/docs/adr/ADR-018-multi-repo-reporting-aggregation.md)).
2. This repo’s workflow [`.github/workflows/aggregate.yml`](.github/workflows/aggregate.yml) runs on a schedule (and `workflow_dispatch`): syncs metrics from R2, runs `scripts/build-summaries.mjs`, builds with Vite, publishes `dist/` to `gh-pages`.

## Local development

```bash
corepack enable
pnpm install
pnpm run dev
```

## Build (same as CI)

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm run build
```

Requires `data/raw/` populated (or run aggregate workflow) before `build-summaries` if you want real data in `public/data/summaries.json`.

## Related

- [ADR-018: Multi-Repo Reporting Aggregation](../shared-docs/docs/adr/ADR-018-multi-repo-reporting-aggregation.md)
