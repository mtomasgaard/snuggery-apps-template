# Choosing the clock

Which of these fits is the person's decision — how fresh, which accounts, where a token may live,
whether an agent may be in the loop. Each option below says what it is for and what it costs, with
what was actually measured. Plan it with your agent; nothing here is the one right answer.

## What GitHub's own `schedule:` delivered, measured

On one account, 2026-09-08→09: nine hours before the first scheduled run, then three runs about
2 h 40 m apart with the slots between them dropped, then six hours of nothing — while other
accounts' schedules ran hourly through the same night. Nothing in the configuration was wrong.
*For:* nothing to set up, no other account, no other token. *Against:* a few times a day, when
GitHub chooses; never a time you can promise. The only way to see what you are getting is to look:

    gh api "repos/OWNER/REPO/actions/runs?event=schedule" --jq .total_count

If that is `0` a day later, or the gaps are longer than you can live with, the options below move the
alarm clock somewhere else and keep the workflow exactly as it is.

## The idea

Every option here does one thing: on a schedule, send

    POST https://api.github.com/repos/OWNER/REPO/actions/workflows/FILE.yml/dispatches
    Authorization: Bearer <token>
    Accept:        application/vnd.github+json
    User-Agent:    anything          ← GitHub answers 403 without one
    {"ref":"main"}

GitHub then runs the workflow exactly as if its own schedule had fired. The workflow file does not
change. The Shortcut on the phone does not change. Runs will show a trigger of `workflow_dispatch`
rather than `schedule` — that is the external scheduler's fingerprint, and it is what you now
check for hourly instead of the count above.

No AI agent is involved anywhere in this. It is a clock and a POST.

## The token

Fine-grained, **this repository only**, one permission: **Actions → Read and write**. Nothing
else. GitHub's permissions table lists the dispatch endpoint under *Actions: write* with no
additional permission, so **Contents stays at No access** — a leaked scheduler token lets somebody
trigger a refresh and read nothing. That is narrower than the read-only token already in your
Shortcut.

github.com → Settings → Developer settings → Personal access tokens → Fine-grained tokens →
Generate new token → Repository access: *Only select repositories* → Permissions → Repository →
Actions: *Read and write* → Generate. It is shown once. Give it an expiry and write the date in
the table at the bottom of the main README.

There is no way to avoid storing *some* durable secret somewhere — deploy keys cannot call the
REST API, OIDC only runs outward from a workflow, and a GitHub App still needs a private key held
somewhere. The mitigation is what the fine-grained token already gives you: one repository, one
permission, an expiry.

## Option 1 — cron-job.org: no code, works from a phone

Free, no card, unlimited jobs, running since 2005, a web form. This is the one for somebody who
has never opened a terminal.

1. cron-job.org → **Sign up** → confirm the email it sends.
2. **Create cronjob**. Title: anything. **URL**: the `dispatches` address above, with your
   owner, repository and workflow filename filled in.
3. **Schedule**: every hour. (Pick a minute that is not `:00` — GitHub's own docs say the top of
   the hour is its busiest moment.)
4. **Advanced** → **Request method**: `POST`.
5. **Headers**: add `Authorization` = `Bearer github_pat_…`, and `Accept` =
   `application/vnd.github+json`.
6. **Request body**: `{"ref":"main"}`.
7. **Notifications**: turn on *email on failure*. This is the part a non-programmer can act on
   without understanding what broke.
8. Save, then **Test run**. A `204` means it worked; open the repository's Actions tab and the
   workflow will be running.

Two honest notes. Its FAQ documents how it hashes your *password*; it does not say how it protects
request-header values at rest, which is where your token sits. And it is one person's project
(reliable for two decades, but a project, not a company). The token's narrow scope is what bounds
both.

## Option 2 — a Cloudflare Worker: a developer's choice

Free, no card, five Cron Triggers per account, secrets encrypted, a large infrastructure company.
Set up entirely in the dashboard; no CLI.

1. dash.cloudflare.com → sign up → **Workers & Pages** → **Create** → **Create Worker** → name
   it → **Deploy**.
2. **Edit code** → replace everything with `cloudflare-worker.js` from this folder → **Deploy**.
3. **Settings** → **Variables and Secrets**: add `GITHUB_REPO` (text, `owner/repo`),
   `WORKFLOWS` (text, `weather-refresh.yml` — comma-separate for more), and `GITHUB_TOKEN`
   (**Secret**, the token above).
4. **Settings** → **Triggers** → **Cron Triggers** → add `7 * * * *`.
5. After the next `:07`, **Logs** shows `… → 204`, and the repository's Actions tab shows the run.

Cloudflare's own docs say Cron Triggers ship with no retries and no alerting. If that matters, add
Option 1 as a second, independent trigger: the workflow is idempotent, so two triggers an hour is
harmless, and cron-job.org's failure email is the alerting Cloudflare lacks.

## Checked, and not recommended for this

- **Apple Shortcuts, Time of Day.** No hourly repeat — the trigger offers daily, weekly, monthly,
  so hourly means twenty-four automations built by hand. And community reports, including Apple's
  own developer forums, describe automations not firing on a phone that has sat locked for hours.
  Fine as a nudge at two fixed times a day; not the hourly mechanism.
- **Vercel Hobby cron**: once per day only. **GitLab schedules**: a card is required for shared
  runners. **Cronitor**: the active-request product is paid.
- **Val.town, Deno Deploy, Google Apps Script** all work and are free. Apps Script is the
  browser-only choice if you would rather trust Google than a one-person service; it needs a few
  lines of JavaScript and has a 90-minute daily runtime cap on personal accounts. Val.town's free
  tier has a 15-minute floor.
- **A scheduled AI-agent session.** It works. But a schedule should not need an agent, and this
  page exists so that it does not.
