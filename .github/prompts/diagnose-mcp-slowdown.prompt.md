---
name: Diagnose MCP Slowness
description: "Use when the MCP chat is slow or repeatedly shows the same confirmation, status, or execution message."
argument-hint: "Describe the slow behavior, repeated message, and exact steps to reproduce it"
agent: "agent"
---
Investigate and fix the MCP chat issue described below.

Observed behavior:
${input:observedBehavior:Describe what is slow or what message repeats}

Reproduction steps:
${input:reproductionSteps:List the exact user actions that reproduce it}

Follow this workflow:
1. Inspect the smallest relevant request, tool-call, confirmation, and response-rendering paths before editing.
2. Trace the complete path from the user action to the visible message. Determine whether the delay or repetition comes from the browser, API route, LLM loop, MCP gateway, OAuth request, or tool implementation.
3. Use existing logs, timing fields, tests, and nearby call sites as evidence. Do not assume that a repeated UI message means the MCP tool ran repeatedly.
4. State one falsifiable root-cause hypothesis and one focused check that could disprove it.
5. Make the smallest code change that fixes the root cause. Do not refactor unrelated code or change the user-facing behavior beyond what is needed.
6. Add or update a focused regression test when the repository has an appropriate test surface.
7. Run the narrowest useful validation first, then any directly relevant broader test.

Requirements:
- Preserve existing APIs, authentication, confirmation safeguards, and tool semantics.
- Never bypass confirmation for operations that modify network state.
- Avoid adding arbitrary retries, sleeps, or timeout increases as a substitute for diagnosis.
- If the issue cannot be reproduced, explain the evidence gap and add targeted diagnostics only when they are low-risk and minimal.
- Report changed files, root cause, validation commands, and any remaining uncertainty.
- Explain the internal flow in plain language for a reader who does not know MCP, including what the browser, chat API, LLM, gateway, and tool each do.

Expected response format:

### Root cause
Explain the specific cause and the evidence supporting it.

### Fix
Summarize only the focused changes made.

### Internal flow
Describe the request as numbered, plain-language steps from user action to final display.

### Validation
List the commands run and their results.

### Remaining uncertainty
Mention only unresolved risks or reproduction gaps.
