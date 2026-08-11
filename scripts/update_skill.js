#!/usr/bin/env node
/**
 * update_skill.js — Self-update this skill from the latest GitHub release.
 *
 * Public, agent-agnostic helper. Designed to be run by Codex, Claude, or any
 * other agent to keep the skill itself up to date. It:
 *   1. Queries the GitHub Releases API for the latest release of the repo.
 *   2. Compares the release tag against the local VERSION file (repo root).
 *   3. If a newer release exists (or --force), downloads the release source
 *      archive and extracts it over the skill directory. The archive already
 *      ships its own VERSION file, so the version is updated by extraction —
 *      this script NEVER writes VERSION itself (it is owned by the repo).
 *
 * Dependency-free: uses only Node built-ins (no `tar` binary, no npm packages),
 * so it runs on any agent environment with Node 18+.
 *
 * Usage:
 *   node update_skill.js                          # update to latest if newer
 *   node update_skill.js --check                  # report only, never write
 *   node update_skill.js --force                  # re-install latest even if current
 *   node update_skill.js --dry-run                # show what would happen, no writes
 *   node update_skill.js --repo owner/name        # override the GitHub repo
 *   node update_skill.js --root /path/to/skill    # override the skill directory
 *
 * Exit codes:
 *   0  up to date, or updated successfully
 *   1  error (network, parse, or I/O failure)
 *   2  a newer release exists but --check was used (nothing written)
 */

'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DEFAULT_REPO = 'xiaohongque/xhq-skill-media-generator';
const DEFAULT_ROOT = path.resolve(__dirname, '..');
const DEFAULT_TIMEOUT_MS = 120000; // give up on a stalled network call after 2 min

function fail(msg) {
  console.error('[update_skill] ' + msg);
  process.exit(1);
}

function stripPrefix(v) {
  return v && v.startsWith('v') ? v.slice(1) : v;
}

// semver-ish compare: <0 if a<b, 0 if equal, >0 if a>b.
function compareVersions(a, b) {
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x - y;
  }
  return 0;
}

function readLocalVersion(file) {
  try {
    return stripPrefix(fs.readFileSync(file, 'utf8').trim());
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    fail('Failed to read VERSION file ' + file + ': ' + e.message);
  }
}

function parseArgs(argv) {
  const args = {
    repo: DEFAULT_REPO,
    root: DEFAULT_ROOT,
    check: false,
    force: false,
    dryRun: false,
    timeout: DEFAULT_TIMEOUT_MS,
    help: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--repo') args.repo = argv[++i];
    else if (a === '--root') args.root = path.resolve(argv[++i]);
    else if (a === '--check' || a === '-c') args.check = true;
    else if (a === '--force' || a === '-f') args.force = true;
    else if (a === '--dry-run' || a === '-n') args.dryRun = true;
    else if (a === '--timeout') args.timeout = parseInt(argv[++i], 10);
    else if (a === '--help' || a === '-h') {
      console.log('Usage: node update_skill.js [--check] [--force] [--dry-run]');
      console.log('                               [--repo owner/name] [--root /path]');
      console.log('  (no flags)  update to latest release if a newer one exists');
      console.log('  --check     report only, never write (exit 2 if newer exists)');
      console.log('  --force     re-install the latest release even if already current');
      console.log('  --dry-run   show what would happen, perform no writes');
      console.log('  --timeout   network timeout in ms (default 120000)');
      process.exit(0);
    } else fail('Unknown argument: ' + a);
  }
  if (!/^[\w.-]+\/[\w.-]+$/.test(args.repo)) fail('--repo must be "owner/name"');
  return args;
}

async function fetchLatestRelease(repo, timeoutMs) {
  const url = `https://api.github.com/repos/${repo}/releases/latest`;
  const headers = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'xhq-skill-media-generator/update_skill',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (process.env.GITHUB_TOKEN) headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;

  let res;
  try {
    res = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    if (e.name === 'TimeoutError') fail(`Timed out querying GitHub after ${timeoutMs}ms`);
    fail('Network error querying GitHub: ' + e.message);
  }
  if (res.status === 404) return null; // no published release
  if (!res.ok) fail(`GitHub API ${url} failed: HTTP ${res.status} ${res.statusText}`);
  let data;
  try { data = await res.json(); } catch (e) { fail('Failed to parse GitHub API response: ' + e.message); }
  if (!data || !data.tag_name) fail('GitHub API response missing tag_name');
  return { tag: data.tag_name, version: stripPrefix(data.tag_name) };
}

async function downloadArchive(repo, tag, timeoutMs) {
  // Auto-generated source archive for the tag; always available, no auth needed.
  const url = `https://github.com/${repo}/archive/refs/tags/${tag}.tar.gz`;
  const headers = { 'User-Agent': 'xhq-skill-media-generator/update_skill' };
  if (process.env.GITHUB_TOKEN) headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  let res;
  try {
    res = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    if (e.name === 'TimeoutError') fail(`Timed out downloading archive after ${timeoutMs}ms`);
    fail('Network error downloading archive: ' + e.message);
  }
  if (!res.ok) fail(`Download ${url} failed: HTTP ${res.status} ${res.statusText}`);
  let buf;
  try {
    buf = Buffer.from(await res.arrayBuffer());
  } catch (e) {
    fail('Failed to read downloaded archive: ' + e.message);
  }
  if (buf.length === 0) fail('Downloaded archive is empty');
  return buf;
}

// Read a NUL-terminated string field from a tar header.
function readField(block, offset, length) {
  let end = offset;
  const max = offset + length;
  while (end < max && block[end] !== 0) end++;
  return block.subarray(offset, end).toString('utf8');
}

// Parse a ustar/octal numeric field (leading spaces/zeros allowed, trailing NUL/space).
function readOctal(block, offset, length) {
  const s = readField(block, offset, length).trim();
  if (!s) return 0;
  return parseInt(s, 8) || 0;
}

/**
 * Extract a gzipped tar archive (GitHub source tarball) into `destDir`,
 * stripping the top-level directory component so the archive contents land
 * directly in the skill root. Skips symlinks/hardlinks for safety.
 */
function extractTarball(buffer, destDir) {
  const data = zlib.gunzipSync(buffer);
  const resolvedDest = path.resolve(destDir);
  let offset = 0;
  let longName = null;

  while (offset + 512 <= data.length) {
    const header = data.subarray(offset, offset + 512);
    // Zero block marks end of archive.
    if (header.every((b) => b === 0)) break;

    const name = readField(header, 0, 100);
    const size = readOctal(header, 124, 12);
    const typeflag = String.fromCharCode(header[156]);
    const mode = readOctal(header, 100, 8);

    let entryName = name;
    // ustar prefix field (offset 345, len 155) for long paths.
    if (readField(header, 257, 6).startsWith('ustar')) {
      const prefix = readField(header, 345, 155);
      if (prefix) entryName = prefix + '/' + name;
    }

    offset += 512;
    const fileData = data.subarray(offset, offset + size);
    offset += Math.ceil(size / 512) * 512; // data is padded to 512-byte boundary

    if (typeflag === 'L') { // GNU long name: next header uses this name
      longName = readField(fileData, 0, fileData.length);
      continue;
    }
    if (longName) {
      entryName = longName;
      longName = null;
    }

    if (typeflag !== '0' && typeflag !== '\0' && typeflag !== '' && typeflag !== '5') {
      continue; // skip symlinks, hardlinks, etc.
    }

    // Strip the top-level directory (e.g. "xhq-skill-media-generator-0.9.0/").
    const parts = entryName.split('/').filter(Boolean).slice(1);
    if (parts.length === 0) continue; // the top dir itself
    const rel = parts.join('/');
    const target = path.join(resolvedDest, rel);

    // Guard against path traversal outside the skill root.
    if (path.relative(resolvedDest, target).startsWith('..')) {
      console.error('[update_skill] Skipping unsafe path: ' + entryName);
      continue;
    }

    if (typeflag === '5') {
      fs.mkdirSync(target, { recursive: true });
      continue;
    }

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, fileData);
    // Preserve executable bit if the archive marked it.
    if (mode & 0o111) {
      try { fs.chmodSync(target, 0o755); } catch (e) { /* ignore */ }
    }
  }
}

async function main() {
  const { repo, root, check, force, dryRun, timeout } = parseArgs(process.argv);
  const versionFile = path.join(root, 'VERSION');

  const latest = await fetchLatestRelease(repo, timeout);
  if (latest === null) {
    console.log('[update_skill] No published releases found for ' + repo);
    process.exit(0);
  }
  console.log(`[update_skill] Latest release: ${latest.version}  (tag ${latest.tag}, repo ${repo})`);

  const local = readLocalVersion(versionFile);
  console.log('[update_skill] Local VERSION: ' + (local === null ? '(none)' : local) + '  (' + versionFile + ')');

  const newer = local === null || compareVersions(latest.version, local) > 0;

  if (check) {
    if (newer) {
      console.log('[update_skill] A newer release (' + latest.version + ') is available.');
      process.exit(2);
    }
    console.log('[update_skill] Up to date.');
    process.exit(0);
  }

  if (!newer && !force) {
    console.log('[update_skill] Already up to date.');
    process.exit(0);
  }

  if (dryRun) {
    console.log(`[update_skill] --dry-run: would download ${latest.tag} and extract into ${root}`);
    process.exit(0);
  }

  console.log(`[update_skill] Downloading ${latest.tag} ...`);
  const archive = await downloadArchive(repo, latest.tag, timeout);
  console.log(`[update_skill] Extracting ${archive.length} bytes into ${root} ...`);
  extractTarball(archive, root);
  // VERSION comes from the archive (repo-owned); this script does not write it.
  console.log(`[update_skill] Updated to ${latest.version}.`);
  process.exit(0);
}

main().catch((e) => fail(e && e.stack ? e.stack : String(e)));
