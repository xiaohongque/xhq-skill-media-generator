#!/usr/bin/env node
/**
 * run_task.js — Submit an xhq generation task and poll until completion.
 *
 * Public, agent-agnostic helper for the "model-capabilities" skill.
 * Calls the standard REST API (no SDK, no session):
 *   - POST   {XHQ_API_BASE}/api/v1/generate   -> { taskId, generatorTaskId, provider }
 *   - GET    {XHQ_API_BASE}/api/v1/tasks/:taskId -> { status, result: { videos, images, audios }, ... }
 *
 * Usage:
 *   node run_task.js --provider <provider> --params '<json>' [--params-file path.json]
 *                   [--poll-interval 15000] [--max-poll-time 3600000]
 *
 * Environment (see references/auth.md):
 *   XHQ_API_BASE   optional; backend base, no /1.1. Defaults to https://app.xiaohongque.com
 *   XHQ_API_KEY    required; Bearer API key (sk_…)
 *
 * Exit code 0 on success (prints final result JSON to stdout), non-zero on error.
 */

'use strict';
const fs = require('fs');

// Statuses that mean "stop polling".
const TERMINAL = new Set([
  'succeeded', 'completed', 'success', 'done', 'ready',
  'failed', 'error', 'cancelled', 'canceled', 'aborted',
  'rejected', 'expired', 'dead', 'timeout', 'partial',
]);
const FAILURE = new Set(['failed', 'error', 'cancelled', 'canceled', 'aborted', 'rejected', 'expired', 'dead', 'timeout']);

function fail(msg) {
  console.error('[run_task] ' + msg);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { provider: null, params: null, paramsFile: null, pollInterval: 15000, maxPollTime: 3600000 };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--provider') args.provider = argv[++i];
    else if (a === '--params') args.params = argv[++i];
    else if (a === '--params-file') args.paramsFile = argv[++i];
    else if (a === '--poll-interval') args.pollInterval = parseInt(argv[++i], 10);
    else if (a === '--max-poll-time') args.maxPollTime = parseInt(argv[++i], 10);
    else if (a === '--help' || a === '-h') {
      console.log('Usage: node run_task.js --provider <p> --params \'{...}\' [--params-file f.json]');
      console.log('       [--poll-interval ms] [--max-poll-time ms]');
      process.exit(0);
    } else fail('Unknown argument: ' + a);
  }
  if (!args.provider) fail('--provider is required');
  if (args.params && args.paramsFile) fail('Use either --params or --params-file, not both');
  if (!args.params && !args.paramsFile) fail('Provide --params <json> or --params-file <path>');
  let params;
  try {
    params = args.params ? JSON.parse(args.params) : JSON.parse(fs.readFileSync(args.paramsFile, 'utf8'));
  } catch (e) {
    fail('Failed to parse params JSON: ' + e.message);
  }
  if (typeof params !== 'object' || Array.isArray(params)) fail('--params must be a JSON object');
  return { provider: args.provider, params, pollInterval: args.pollInterval, maxPollTime: args.maxPollTime };
}

async function apiFetch(method, path, body) {
  const base = process.env.XHQ_API_BASE || 'https://app.xiaohongque.com';
  const apiKey = process.env.XHQ_API_KEY;
  if (!apiKey) fail('XHQ_API_KEY env var is not set (your sk_… key; see references/auth.md)');

  const url = `${base.replace(/\/$/, '')}${path}`;
  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try { data = await res.json(); } catch (e) { /* non-JSON */ }

  if (!res.ok) {
    const err = (data && (data.message || data.error)) || `HTTP ${res.status}`;
    const code = (data && data.code) || res.status;
    fail(`${method} ${path} failed: [${code}] ${err}`);
  }
  return data;
}

async function main() {
  const { provider, params, pollInterval, maxPollTime } = parseArgs(process.argv);

  console.error(`[run_task] Submitting provider=${provider} ...`);
  const submit = await apiFetch('POST', '/api/v1/generate', { provider, ...params });
  const taskId = submit && submit.taskId;
  if (!taskId) fail('/api/v1/generate did not return a taskId: ' + JSON.stringify(submit));
  console.error(`[run_task] taskId=${taskId} generatorTaskId=${submit.generatorTaskId} provider=${submit.provider}`);

  const start = Date.now();
  let lastStatus = null;
  while (Date.now() - start < maxPollTime) {
    await new Promise((r) => setTimeout(r, pollInterval));
    const status = await apiFetch('GET', `/api/v1/tasks/${taskId}`);
    lastStatus = status.status;
    const norm = (status.status || '').toLowerCase();
    if (TERMINAL.has(norm)) {
      if (FAILURE.has(norm)) {
        fail(`Task ${taskId} ended with status=${status.status}: ${status.error || 'unknown error'}`);
      }
      // success / partial
      console.log(JSON.stringify({ taskId, status: status.status, result: status.result }, null, 2));
      return;
    }
    console.error(`[run_task] status=${status.status} progress=${status.progress != null ? status.progress : ''}`);
  }
  fail(`Task ${taskId} did not finish within ${maxPollTime}ms (last status: ${lastStatus})`);
}

main().catch((e) => fail(e && e.stack ? e.stack : String(e)));
