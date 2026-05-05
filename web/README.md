# moxible web

Single-container SvelteKit app that wraps the Moxible ansible playbooks behind
a click-to-deploy form. Lives at `web/` in the [moxible](../) repo; the
`ansible/` tree at the repo root is baked into the image at `/repo/ansible`.

> Phase 1.5 status: connection details (PVE host, user, bastion, SSH key,
> network, storage, identity) currently come from env vars set in
> `web/docker-compose.yml`. The first-run wizard (Phase 2+) will replace them
> with `/data/config.yml` collected from the browser. Once the wizard ships,
> the env vars in `docker-compose.yml` become unnecessary.

## Bring-up (Phase 1.5, env-var driven)

From the repo root:

```bash
cd web
docker compose up -d --build
```

The container generates an ed25519 keypair in `./data/keys/` on first run.
Add `./data/keys/id_ed25519_pve.pub` to `root@<pve_host>:~/.ssh/authorized_keys`,
then point the env vars in `docker-compose.yml` at your hypervisor:

| Env var | Purpose | Example |
|---|---|---|
| `PVE_HOST` | Proxmox VE host | `192.0.2.10` |
| `PVE_USER` | SSH user on PVE | `root` |
| `PVE_BASTION` | optional jump host | `bastion` (or empty) |
| `SSH_KEY_PATH` | private key in container | `/data/keys/id_ed25519_pve` |
| `DEFAULT_PUBKEY_PATH` | public key in container | `/data/keys/id_ed25519_pve.pub` |
| `CLOUD_USER` | user created on guest VMs | `admin` |
| `SUBNET_PREFIX` | first three octets | `192.0.2` |
| `NETWORK_GATEWAY` | gateway for guests | `192.0.2.1` |
| `CIDR_PREFIX` | netmask bits | `24` |
| `DNS_SERVERS` | space-separated nameservers | `1.1.1.1 8.8.8.8` |
| `NETWORK_BRIDGE` | PVE bridge | `vmbr0` |
| `VM_STORAGE` | guest disk pool | `local-lvm` |
| `SNIPPETS_STORAGE` | cloud-init snippets pool | `local` |
| `TEMPLATE_VMID` | cloud template VMID | `9000` |
| `CRITICAL_VMIDS` | comma-separated, never destroy | `202,210` |
| `DOTFILES_URL` | optional first-boot bootstrap | `https://github.com/you/dotfiles.git` |

## Verify

```bash
curl http://localhost:4080/api/healthz   # {ok:true, ansibleVersion, playbookSyntaxOk:true}
curl http://localhost:4080/api/vmids     # qm list parsed, free + taken + critical
```

Open `http://localhost:4080` in a browser.

## How it works

The container ships with `ansible-playbook` plus the moxible playbook tree at
`/repo/ansible`. On a deploy submit, the Node server writes `vars.json`
(form input) and `pubkey.pub` to `/data/runs/<jobId>/`, then spawns
`ansible-playbook playbooks/create-vm-from-template.yml --extra-vars @vars.json`.

| Mount | Container path | Purpose |
|---|---|---|
| `./data` | `/data` (rw) | Per-run artifacts, generated SSH keys, wizard config (Phase 2+). |

There is **no** host `~/.ssh` mount. The container generates its own ed25519
key in `/data/keys/` on first start; that key is what reaches PVE.

Live playbook output streams to the browser via SSE. A small custom Ansible
callback plugin (`ansible-callbacks/jsonl_events.py`) emits one JSON event per
task to `/data/runs/<jobId>/events.jsonl`, which the Node server tails and
fans out to subscribers.

## Manual smoke test

1. Open the form at `/`.
2. Fill: name, cores, RAM, disk, paste an SSH public key.
3. Tick **Dry run** for the first attempt. Submit.
4. Browser navigates to `/runs/<jobId>`. Tasks stream live. Status ends
   `succeeded` (vmid will read 0 because `--check` skips the auto-scan).
5. Untick dry-run, submit again. Real VM created. Result block shows the
   SSH snippet.
6. Copy the snippet into `~/.ssh/config`, run `ssh <name>`.

To clean up:

```bash
docker compose exec moxible bash
cd /repo/ansible && ansible-playbook playbooks/destroy-vm.yml -e vmid=<N>
```

## Limits + future work (not in MVP)

- **Single concurrent deploy.** A second submit while one runs returns 409.
  The playbook's VMID auto-scan is racy; serializing avoids the foot-gun.
- **No auth yet.** Trust the LAN. **Do not expose to WAN.** Phase 5 wires up
  `none` / `shared_token` / `basic` modes via `src/hooks.server.ts`.
- **Single OS template.** Only Ubuntu 24.04. Phase 3 swaps
  `src/lib/server/templates.ts` for a real `qm list` probe.
- **No destroy / snapshot UI yet.** Routes reserved as 501.
- **History scan is naive.** `readdir + readJson` per page load. Add an
  index file or SQLite if you accumulate >1000 runs.
