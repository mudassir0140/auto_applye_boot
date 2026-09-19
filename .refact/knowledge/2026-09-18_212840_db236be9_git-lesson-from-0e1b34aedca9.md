---
id: 1fe6ccd3-0304-44b0-af52-a2334761c280
title: Git lesson from 0e1b34aedca9
tags:
- git
- lesson
created: 2026-09-18
updated: 2026-09-19
filenames:
- package-lock.json
- package.json
links: []
kind: lesson
status: proposed
superseded_by: null
deprecated_at: null
review_after: 2026-09-19
source_chat_id: null
created_at: 2026-09-18T16:28:40.046679+00:00
summary: null
description: null
entities: []
related_files: []
related_entities: []
content_hash: a8bac6bd1436db8f7269858448ecff0a49881eb8db75edc7f8f1d9601e7ffe0e
source_tool: buddy_memory_lifecycle:git
source_confidence: 0.8600000143051147
source_trajectory_id: null
source_message_range: null
source_commit: 0e1b34aedca95fca8d28b6ec50b5e8a50723b193
topic: null
last_used_at: null
use_count: 0
last_injected_at: null
dismissed_count: 0
source_content_hash: a8bac6bd1436db8f7269858448ecff0a49881eb8db75edc7f8f1d9601e7ffe0e
review_needed: true
occurrences: 0
---

Git lesson from 0e1b34aedca9

Source commit: 0e1b34aedca9
Paths: package-lock.json, package.json
Summary: Fix: Add @swc/helpers dependency and reinstall node_modules Root cause was broken node_modules state and missing @swc/helpers dependency causing cascade of 1K+ build errors. Fixed by: - Adding @swc/helpers@^0.5.0 to dependencies - Cleaning and reinstalling dependencies - Verifying dev server and production build pass A