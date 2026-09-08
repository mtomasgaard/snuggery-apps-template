// A scheduler that does not depend on GitHub's `schedule:` trigger.
//
// GitHub documents `schedule:` as best-effort: "If the load is sufficiently
// high enough, some queued jobs may be dropped." In September 2026 that meant
// whole days with no scheduled run at all, on three repositories, while
// workflow_dispatch and push ran fine. So this Worker runs on Cloudflare's
// Cron Trigger instead and asks GitHub to run the workflow — the same
// workflow, unchanged; only the alarm clock moves.
//
// Paste this into a new Worker in the Cloudflare dashboard (no CLI needed),
// then under Settings add:
//
//   Variables
//     GITHUB_REPO   mtomasgaard/snuggery-apps
//     WORKFLOWS     weather-refresh.yml            (comma-separated for more)
//   Secrets
//     GITHUB_TOKEN  a fine-grained token, THIS REPOSITORY ONLY, permission
//                   "Actions: Write" and nothing else. It cannot read the
//                   repository's files, so a leak lets somebody trigger a
//                   refresh and nothing more.
//   Triggers → Cron Triggers
//     7 * * * *                                     (hourly, at 7 past, UTC)
//
// Nothing here is Snuggery-specific: it is one POST per workflow.

export default {
  async scheduled(controller, env, ctx) {
    const repo = (env.GITHUB_REPO || "").trim();
    const workflows = (env.WORKFLOWS || "")
      .split(",")
      .map((w) => w.trim())
      .filter(Boolean);

    if (!repo || workflows.length === 0 || !env.GITHUB_TOKEN) {
      console.error("missing GITHUB_REPO, WORKFLOWS or GITHUB_TOKEN");
      return;
    }

    for (const workflow of workflows) {
      const url = `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`;
      let status;
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.GITHUB_TOKEN}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
            // GitHub rejects requests without one, and Workers do not add it.
            "User-Agent": "snuggery-scheduler",
          },
          body: JSON.stringify({ ref: env.GITHUB_REF || "main" }),
        });
        status = res.status;
      } catch (e) {
        status = `network error: ${e && e.message}`;
      }
      // 204 is success. 404 almost always means the token cannot see the
      // repository — GitHub hides a private repo's existence rather than
      // saying "unauthorised" — so check the token before the address.
      console.log(`${repo} ${workflow} → ${status}`);
    }
  },
};
