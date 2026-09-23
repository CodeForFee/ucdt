---
id: T-011
title: godkit-map for ucdt/
owner: claude-opus-5
scope: .agent/MAP.md, .agent/graph.json
exit: MAP.md exists, covers apps/web, apps/gateway, services/climate, infra; not STALE
phase: done
blocked:
created: 2026-09-23T1617Z
sprint: S-001
issue: 7
---

## Plan
Run after the wave-1 merge (godkit-map).

## Execute
`godkit` CLI is not installed on this machine, so scan/save were done by a one-shot script (not committed) that writes the same three files in the same order: graph.json, MAP.md generated from it, meta.json last with the sha. File-level nodes for every file with logic; directory nodes for homogeneous groups (web services/hooks/types/components/stores, shadcn ui, messages, features placeholders). Absolute paths never enter the graph.
- godkit: directory nodes for the web shared groups — split into file nodes when wave 2 gives them real logic.

## Review
Reading the gateway for the map surfaced B-013 (shared Redis connection in subscriber mode) — fixed separately in #21 before the map was cut.

## Test
```
build script asserts: every file node is git-tracked, every directory node has tracked files,
every edge endpoint exists, layers cover all nodes exactly
-> mapped: 56 nodes, 65 edges, 9 layers, 8 tour steps @ 3b07ec2
```

## Handoff
Refresh after wave 2: T-006/T-007 add the ingest, worker and FastAPI layers; T-008/T-009 replace the features placeholder node.
