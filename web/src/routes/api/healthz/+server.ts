import { json } from '@sveltejs/kit';
import { spawn } from 'node:child_process';
import { ANSIBLE_DIR } from '$lib/server/paths';

let cachedSyntaxOk: boolean | null = null;
let cachedAnsibleVersion: string | null = null;

async function runCmd(cmd: string, args: string[], cwd?: string): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (b) => (stdout += b.toString()));
    child.stderr.on('data', (b) => (stderr += b.toString()));
    child.on('error', () => resolve({ code: -1, stdout, stderr }));
    child.on('close', (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });
}

export async function GET() {
  if (cachedAnsibleVersion === null) {
    const v = await runCmd('ansible-playbook', ['--version']);
    cachedAnsibleVersion = v.code === 0 ? v.stdout.split('\n')[0] : 'unavailable';
  }
  if (cachedSyntaxOk === null) {
    const r = await runCmd(
      'ansible-playbook',
      ['--syntax-check', 'playbooks/create-vm-from-template.yml'],
      ANSIBLE_DIR
    );
    cachedSyntaxOk = r.code === 0;
  }
  return json({
    ok: true,
    ansibleVersion: cachedAnsibleVersion,
    playbookSyntaxOk: cachedSyntaxOk
  });
}
