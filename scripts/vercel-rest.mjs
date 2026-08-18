#!/usr/bin/env node
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const API = 'https://api.vercel.com';
const TOKEN = process.env.VERCEL_TOKEN || '';
const TEAM_ID = process.env.VERCEL_TEAM_ID || '';
const PROJECT_ID = process.env.VERCEL_PROJECT_ID || '';
const PROJECT_NAME = process.env.VERCEL_PROJECT_NAME || 'flow-student';
const DISABLE_AUTH = process.env.VERCEL_DISABLE_AUTH !== 'false';
const STATUS_FILE = process.env.VERCEL_STATUS_FILE || '';
const command = process.argv[2] || 'deploy';

async function writeStatus(payload) {
  if (!STATUS_FILE) return;
  const status = {
    ...payload,
    projectName: PROJECT_NAME,
    generatedAt: new Date().toISOString(),
    commitSha: process.env.GITHUB_SHA || null,
  };
  await writeFile(STATUS_FILE, `${JSON.stringify(status, null, 2)}\n`, 'utf8');
}

if (!TOKEN) {
  console.error('VERCEL_TOKEN is required.');
  await writeStatus({ ok: false, error: 'VERCEL_TOKEN is required.' });
  process.exit(2);
}

function withScope(endpoint) {
  if (!TEAM_ID) return endpoint;
  return `${endpoint}${endpoint.includes('?') ? '&' : '?'}teamId=${encodeURIComponent(TEAM_ID)}`;
}

async function request(endpoint, options = {}) {
  const response = await fetch(`${API}${withScope(endpoint)}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!response.ok) {
    const err = new Error(`${options.method || 'GET'} ${endpoint} -> ${response.status}: ${data?.error?.message || data?.message || text}`);
    err.status = response.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function getProject() {
  const idOrName = PROJECT_ID || PROJECT_NAME;
  try {
    return await request(`/v9/projects/${encodeURIComponent(idOrName)}`);
  } catch (error) {
    if (error.status !== 404 || PROJECT_ID) throw error;
    return null;
  }
}

async function ensureProject() {
  let project = await getProject();
  if (!project) {
    project = await request('/v11/projects', {
      method: 'POST',
      body: JSON.stringify({
        name: PROJECT_NAME,
        framework: null,
        publicSource: true,
        ssoProtection: null,
      }),
    });
    console.log(`Created Vercel project ${project.name} (${project.id})`);
  }

  if (DISABLE_AUTH) {
    try {
      project = await request(`/v9/projects/${encodeURIComponent(project.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ ssoProtection: null }),
      });
      console.log('Vercel Authentication is disabled for this project.');
    } catch (error) {
      if (project?.ssoProtection) throw error;
      console.warn(`Could not re-apply ssoProtection=null, continuing because the project was not reported protected: ${error.message}`);
    }
  }
  return project;
}

const TEXT_EXTENSIONS = new Set(['.html','.css','.js','.mjs','.json','.xml','.txt','.svg','.webmanifest']);
const EXCLUDED_DIRS = new Set(['.git','.github','node_modules','scripts','.devcontainer','__pycache__']);
const EXCLUDED_FILES = new Set(['MONETIZATION_LAB.md','README.md','LICENSE','requirements.txt','streamlit_app.py','.python-version','.gitignore','VERCEL_REST.md','vercel-deployment.json']);

async function collectFiles(root = process.cwd(), dir = '.') {
  const entries = await readdir(path.join(root, dir), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const rel = path.posix.join(dir === '.' ? '' : dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      files.push(...await collectFiles(root, rel));
      continue;
    }
    if (!entry.isFile() || EXCLUDED_FILES.has(entry.name)) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!TEXT_EXTENSIONS.has(ext)) continue;
    const data = await readFile(path.join(root, rel), 'utf8');
    files.push({ file: rel.replaceAll('\\','/'), data });
  }
  return files;
}

async function waitForDeployment(id) {
  for (let i = 0; i < 90; i += 1) {
    const deployment = await request(`/v13/deployments/${encodeURIComponent(id)}`);
    const state = deployment.readyState || deployment.state;
    process.stdout.write(`\rDeployment ${id}: ${state || 'UNKNOWN'}   `);
    if (state === 'READY') { process.stdout.write('\n'); return deployment; }
    if (['ERROR','CANCELED'].includes(state)) throw new Error(`Deployment ended as ${state}`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error('Timed out waiting for Vercel deployment.');
}

async function deploy() {
  const project = await ensureProject();
  const files = await collectFiles();
  if (!files.some((f) => f.file === 'index.html')) throw new Error('index.html not found in deployment files.');
  console.log(`Deploying ${files.length} text assets to ${project.name}...`);
  const deployment = await request('/v13/deployments', {
    method: 'POST',
    body: JSON.stringify({
      name: project.name,
      project: project.id,
      target: 'production',
      files,
      meta: { source: 'flow-vercel-rest', commitSha: process.env.GITHUB_SHA || '' },
    }),
  });
  const ready = await waitForDeployment(deployment.id);
  const url = ready.alias?.[0] || ready.url || deployment.url;
  const result = {
    ok: true,
    projectId: project.id,
    deploymentId: ready.id,
    url: url ? `https://${url.replace(/^https?:\/\//,'')}` : null,
    readyState: ready.readyState || ready.state || 'READY',
    ssoProtection: project.ssoProtection ?? null,
  };
  await writeStatus(result);
  console.log(JSON.stringify(result, null, 2));
  return result;
}

async function status() {
  const project = await getProject();
  if (!project) throw new Error(`Project ${PROJECT_ID || PROJECT_NAME} not found.`);
  const deployments = await request(`/v6/deployments?projectId=${encodeURIComponent(project.id)}&limit=5`);
  const result = {
    project: { id: project.id, name: project.name, ssoProtection: project.ssoProtection ?? null },
    deployments: deployments.deployments || [],
  };
  console.log(JSON.stringify(result, null, 2));
  return result;
}

try {
  if (command === 'deploy') await deploy();
  else if (command === 'status') await status();
  else if (command === 'project') console.log(JSON.stringify(await ensureProject(), null, 2));
  else throw new Error(`Unknown command: ${command}`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Vercel REST module failed: ${message}`);
  try { await writeStatus({ ok: false, error: message }); } catch (statusError) { console.error(`Could not write status file: ${statusError.message}`); }
  process.exit(1);
}
