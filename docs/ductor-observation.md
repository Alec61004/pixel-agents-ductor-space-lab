# Ductor Observation Feeds

The Space Lab observation panel renders only explicitly shared evidence. It does not invent code, terminal output, or browser activity from an agent heartbeat.

The normal heartbeat continues to publish status from `.ductor-space-lab/status.json`. It also looks for the optional adjacent `.ductor-space-lab/observation.json`. The observation document is separate so the live bridge can safely rewrite status without overwriting an active screen feed.

Use the opt-in reporter to place an actual, bounded file snapshot in a station feed:

```sh
npm run ductor:observe -- \
  --role Alec \
  --tab code \
  --title "StarshipLab.tsx" \
  --content-file webview-ui/src/ductor/StarshipLab.tsx
```

The reporter accepts only files below the repository root, refuses symlinks and credential-style paths, and rejects content larger than 1,536 characters. It writes atomically to the observation document. The publisher forwards a feed only while both the role report and that feed are fresh; stale or offline roles never retain an old screen.

For terminal or browser activity, an agent runner must first write a deliberately sanitized, non-secret transcript or browser summary to a repository-local temporary file, then invoke the same reporter with `--tab terminal` or `--tab browser`. Browser pixels are intentionally not inferred or screen-scraped by this bridge.
