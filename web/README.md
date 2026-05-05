# proxmox-deployer

Single-container SvelteKit web app that wraps `ansible/playbooks/create-vm-from-template.yml` with a form. Lets you deploy a new Ubuntu cloud-init VM on `pve` (10.1.10.150) by clicking, with a user-supplied SSH pubkey baked in. Exposed at **http://proxmox-deployer.localhost** via gantry.

## Bring-up

Requires the user's SSH config + key + the repo at `~/lab/proxmox`.

```bash
cd ~/lab/proxmox/web/deployer
REPO_ROOT=/home/dillon/lab/proxmox docker compose up -d --build
```

Verify:

```bash
curl http://proxmox-deployer.localhost/api/healthz   # {ok:true, ansibleVersion, playbookSyntaxOk:true}
curl http://proxmox-deployer.localhost/api/vmids     # qm list parsed, free + taken + critical
```

Open `http://proxmox-deployer.localhost` in a browser.

## How it works

Container shells out to `ansible-playbook` against the repo mounted at `/repo`. The playbook is the source of truth — this app does not duplicate any of its logic.

| Mount | Container path | Purpose |
|---|---|---|
| `~/.ssh` | `/mnt/ssh-ro` (ro) | Copied at entrypoint to `/root/.ssh` with strict perms (openssh refuses files owned by host uid). |
| `~/lab/proxmox` | `/repo` (ro) | Playbooks, `ansible.cfg`, inventory, snippet template. |
| `./data` | `/data` (rw) | Per-run artifacts: `vars.json`, `pubkey.pub`, `events.jsonl`, `result.json`. |

`~/.ssh/config` must contain `Host argonpi` (the bastion alias) and `Host pve` (or the inventory's IP must be reachable through that ProxyJump). The default repo inventory points at `10.1.10.150` with `ProxyJump=argonpi`, which works as long as the config is mounted.

Live playbook output is streamed to the browser via SSE. A small custom Ansible callback plugin (`ansible-callbacks/jsonl_events.py`) emits one JSON event per task to `/data/runs/<jobId>/events.jsonl`, which the Node server tails and fans out to subscribers.

## Manual smoke test

1. Open the form at `/`.
2. Fill: name, cores, RAM, disk, paste an SSH public key.
3. Tick **Dry run** for the first attempt. Submit.
4. Browser navigates to `/runs/<jobId>`. Tasks stream live. Status ends `succeeded` (vmid will read 0 because `--check` skips the auto-scan).
5. Untick dry-run, submit again. Real VM created. Result block shows the SSH snippet.
6. Copy the snippet into `~/.ssh/config`, run `ssh <name>`.

To clean up:
```bash
cd ~/lab/proxmox/ansible
ansible-playbook playbooks/destroy-vm.yml -e vmid=<N>
```

VMID 202 (nextcloud, critical) is auto-locked in the picker.

## Limits + future work (not in MVP)

- **Single concurrent deploy.** A second submit while one runs returns 409. The playbook's VMID auto-scan is racy; serializing avoids the foot-gun.
- **No auth.** Trust the LAN. **Do not expose to WAN.** When migrated to a permanent VM, plug auth into `src/hooks.server.ts` (a `locals.user` seam already exists).
- **Single OS template.** Only Ubuntu 24.04 (vmid 9000). The `<select>` is already wired; replace `src/lib/server/templates.ts` with a `qm list` parser to make it dynamic.
- **No destroy / snapshot UI yet.** Routes reserved as 501.
- **History scan is naive.** `readdir + readJson` per page load. Add an index file or SQLite if you accumulate >1000 runs.

## Migration to a permanent VM

When this lands on its own VM with a real domain:

1. Set `ALLOWED_ORIGINS` to the real origin (drop the `*.localhost` regex if no longer needed — see `src/hooks.server.ts`).
2. Bind to `127.0.0.1` and front with a real reverse proxy (Caddy / Traefik) doing TLS.
3. Add an `authHandle` in `hooks.server.ts` before the CORS handle. Read a session cookie or OIDC bearer; populate `event.locals.user`.
4. Generate a passphrase-protected SSH key for the deployer to use against pve, separate from the user's personal key.
