# Setting Up Background Agents for PRs and Automation

This guide covers ways to run automated “agent” tasks that suggest features, add tests, do code reviews, refactor, improve docs, work on branches, and open (and optionally merge) pull requests.

---

## What You Want the Agents to Do

| Task | Typical trigger | Who does the work |
|------|-----------------|-------------------|
| Suggest features | Issue / label / schedule | Agent proposes in issue or branch |
| Add unit tests | PR opened, or schedule | Agent opens PR with new tests |
| Code review | PR opened/updated | Agent posts review comments |
| Suggest refactorings | PR or issue | Agent comments or opens PR |
| Optimize architecture | Issue / label | Agent opens PR |
| Improve documentation | Schedule / label | Agent opens PR |
| **Create branch + PR** | Issue, label, or schedule | Agent commits → pushes → opens PR |
| **Merge code** | After approval / checks | Agent or auto-merge via GitHub API |

---

## Approach 1: GitHub Copilot Coding Agent (Easiest, Paid)

**What it is:** GitHub’s built-in coding agent. You assign **issues** to Copilot; it plans, codes, runs tests, and opens **draft PRs**. You review and merge.

**Setup:**

1. Ensure the repo has **GitHub Copilot** with **Coding Agent** (Copilot Pro, Pro+, Business, or Enterprise).
2. Create **issues** for each kind of work (e.g. “Add unit tests for `src/loader`”, “Improve README”).
3. **Assign the issue to GitHub Copilot** (or use Copilot Chat / CLI and ask it to work on the issue).
4. The agent runs on GitHub’s infrastructure, creates a branch, pushes commits, and opens a draft PR.
5. **Merge:** You (or your branch protection rules) merge after review. The agent does not merge by default.

**Pros:** No extra infra, good context from issues/PRs, session logs.  
**Cons:** Requires Copilot subscription; merge is still manual unless you use branch rules.

**Docs:** [GitHub Copilot coding agent](https://docs.github.com/en/copilot/using-github-copilot/coding-agent), [Create a PR](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/create-a-pr).

---

## Approach 2: Third-Party Bots (Sweep, CodeRabbit, etc.)

**Idea:** Install a GitHub App or service. Trigger agents via **issues**, **labels**, or **PR events**. They create branches/PRs or post reviews.

### Sweep (AI that implements changes and opens PRs)

- **Trigger:** Comment on an issue (e.g. “Sweep: add unit tests for the BOS loader”) or label.
- **Behavior:** Creates a branch, makes changes, opens a PR. Can self-host via [sweep-hearth](https://github.com/sweepai/sweep-hearth).
- **Merge:** You merge the PR, or you give a bot token and use auto-merge when checks pass.

### CodeRabbit / similar (AI code review)

- **Trigger:** When a PR is opened or updated.
- **Behavior:** Posts review comments (and sometimes suggestions). Does not create PRs by default.
- **Merge:** Your normal process; these tools don’t merge.

**Pros:** Little code to write; good for “review on every PR” or “do this when I open an issue”.  
**Cons:** Depends on third-party; merge is usually manual or via your auto-merge settings.

---

## Approach 3: GitHub Actions + LLM API (Custom, Full Control)

**Idea:** A workflow runs on a **schedule** or on **workflow_dispatch** (or issue labels via `issue_comment`). It:

1. Checks out the repo.
2. Creates a branch (e.g. `agent/docs-YYYYMMDD`).
3. Calls an LLM API (OpenAI, Anthropic, etc.) with repo context and a **task prompt** (e.g. “Add unit tests for …”, “Improve README”).
4. Applies the model’s suggested edits (e.g. via a script that parses the API response and edits files).
5. Commits, pushes, and opens a PR using the GitHub API or `gh pr create`.
6. Optionally: after checks pass and (if you want) approval, another step or workflow **merges** the PR using `gh pr merge` or the GitHub API.

**Pros:** You own the logic, triggers, and prompts; one workflow per “agent task” (tests, docs, refactor).  
**Cons:** You must write and maintain the workflow and the script that turns LLM output into file changes.

**Merge:** Use a **Personal Access Token (PAT)** or **GitHub App** token with `repo` (and optionally `workflow`) scope. The same token can push the branch and later call `gh pr merge`. To let agents merge without human approval, you either:

- Use a branch that does **not** require reviews (e.g. `agent/*`), or  
- Rely on “auto-merge when CI passes” and have the workflow merge once the PR is ready.

Example (conceptual) for “agent merges its own PR when checks pass”:

- In the same workflow (or a follow-up): `gh pr merge --auto` or call [Merge a pull request](https://docs.github.com/en/rest/pulls/pulls#merge-a-pull-request) API.

---

## Approach 4: Multiple “Agent Tasks” as Separate Workflows

You can run **different** agent behaviors from different workflows:

| Workflow file | Trigger | Task |
|---------------|---------|------|
| `agent-unit-tests.yml` | Weekly schedule or `workflow_dispatch` | Create branch, add tests, open PR |
| `agent-docs.yml` | Weekly or on label `agent:docs` | Improve docs, open PR |
| `agent-review.yml` | `pull_request` | Post AI review comments (no new branch) |
| `agent-refactor.yml` | `workflow_dispatch` or label | Propose refactor in a PR |

Each can use the same or different LLM prompts and the same token for push/PR/merge.

---

## Letting Agents Merge Code

To have an agent (or a workflow) **merge** PRs:

1. **Token:** Create a **Fine-grained PAT** or **GitHub App** with:
   - Contents: Read and write  
   - Pull requests: Read and write  
   - (If using GHA to merge) Workflows: Read and write (only if the merge is in a workflow)

2. **Store it:** Put the token in **GitHub Secrets** (e.g. `AGENT_GITHUB_TOKEN`).

3. **Who can merge:**
   - **Option A – No required review for agent branches:** In **Settings → Branches**, add a rule for `main`/`develop` that “Require a pull request before merging” but add an exception for branches matching `agent/*` (if your GitHub plan supports it), or use a separate branch that doesn’t require review and merge from that.
   - **Option B – Auto-merge when green:** Enable “Allow auto-merge” in the repo. The workflow opens the PR and sets auto-merge; when CI passes (and optional review is in place), GitHub merges. The “agent” doesn’t need to call the merge API itself.

4. **In the workflow:** Use the token to push and create the PR; for explicit merge, add a step:
   ```yaml
   - run: gh pr merge --auto
     env:
       GH_TOKEN: ${{ secrets.AGENT_GITHUB_TOKEN }}
   ```
   (after the PR is created and you’re ready to enable auto-merge).

---

## Recommended Path for This Repo

- **Quick start (no code):** Use **GitHub Copilot Coding Agent** (if you have a subscription). Create issues for “add tests”, “improve docs”, etc., assign to Copilot, and let it open draft PRs. You merge.
- **Code review on every PR:** Add a **PR review bot** (e.g. Continue, CodeRabbit, or Qodo) via a workflow or GitHub App; keep merge manual or with your current rules.
- **Custom “background agents” that open and optionally merge PRs:** Add one or more **GitHub Actions** (see `.github/workflows/agent-example.yml` in this repo) that run on schedule or `workflow_dispatch`, use an LLM API to generate changes, then create branch → commit → push → open PR → (optional) enable auto-merge or merge when safe.

### Starter workflow in this repo

- **File:** [`.github/workflows/agent-example.yml`](../.github/workflows/agent-example.yml)
- **Trigger:** Run manually from the Actions tab (“Agent (example – docs/tests/refactor)”) with a task choice, or uncomment the `schedule` to run weekly.
- **Required secret:** `AGENT_GITHUB_TOKEN` (PAT or GitHub App token with `contents: write`, `pull-requests: write`).
- **What it does:** Creates a branch `agent/<task>-<date>`, runs a placeholder “task” (replace with your LLM script), runs `npm run build`, then pushes and opens a PR against `develop`. Optional step at the end can enable auto-merge.

Replace the “Agent task (placeholder)” step with your own script that calls an LLM API and applies edits to the repo; see comments in the workflow file.
