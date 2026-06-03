# `mkdir` and `create` in the same tool batch can race

**Symptom:** Eight `create` tool calls in a single response, all targeting
files under `.copilot/skills/<name>/SKILL.md`, fail with
`Parent directory does not exist` — even though a `mkdir -p .copilot/skills/<name>`
call was included in the same batch.

**Root cause:** Tools batched into one model response are executed in parallel.
The `mkdir` and the `create` calls run concurrently, so a `create` can fire
before its parent `mkdir` completes. The tool framework does NOT order them
by dependency.

**Fix:** Serialize directory-creation: run the `mkdir` call alone first, wait
for it to complete (use `sync` mode if available), THEN issue the `create`
calls in the next batch. Example flow:

```
# Turn 1 — only mkdir
bash: mkdir -p .copilot/skills/{a,b,c,d}

# Turn 2 — now safe to create in parallel
create .copilot/skills/a/SKILL.md
create .copilot/skills/b/SKILL.md
create .copilot/skills/c/SKILL.md
create .copilot/skills/d/SKILL.md
```

If the `mkdir` is the only operation in a batch, the next batch is guaranteed
to see the directories.

**Prevention:**
- When creating multiple files under a new directory hierarchy, always issue
  the `mkdir -p` in its own batch first.
- The same rule applies to `git add` / `git commit` sequences: don't mix
  staging and committing in one batch.

**First observed:** 2026-06-03 session, while scaffolding the agent harness
skills directory.
