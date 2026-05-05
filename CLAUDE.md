# CLAUDE.md — Moxible project guidance

This file orients Claude Code (claude.ai/code) when working in this repo. Read it first in every new session.

## What Moxible is

Moxible is a public, generic Proxmox-as-Code starter for homelabbers. It bundles:

- **Ansible** playbooks + roles for provisioning, patching, monitoring Proxmox VMs/LXCs
- **A SvelteKit web UI** (`web/`) that wraps the playbooks behind a click-to-deploy flow
- **A first-run wizard** that asks the user once for everything (PVE host, SSH key, network, storage, identity, auth) and writes a single shared `/data/config.yml` that both the web app and the ansible CLI read

Goal: someone clones the repo, `docker compose up`, opens the page, walks the wizard, deploys a VM. No env vars, no hand-edited inventory, no SSH key plumbing on the host.

## How Moxible came to exist

Moxible is a **fork-and-generalize** of two directories from a private homelab repo at `~/lab/proxmox` (codename `khazad-dum`):

- `khazad-dum/ansible/` → `moxible/ansible/`
- `khazad-dum/web/deployer/` → `moxible/web/`

The private repo had real, useful infrastructure code shot through with one homelab's specifics (IPs `10.1.10.x`, hostnames `pve`/`argonpi`, user `dillon`, SSH key path `~/.ssh/id_ed25519_pve`, dotfiles URL `awall451/dotfiles`, gantry/Caddy reverse-proxy assumption, `.claude/.critical-vmid` coupling, etc.). This repo is the public, parameterized version of that code.

**The private repo `~/lab/proxmox` (khazad-dum) stays as-is and parallel during the build.** No active migration of khazad-dum is happening. The user will cut over once Moxible is workable. **Do not push Moxible-related changes back into khazad-dum.**

## The plan

Full plan with every file change, wizard step, and config schema lives at:

```
~/.claude/plans/i-m-really-starting-to-twinkling-snowglobe.md
```

Read it before suggesting architectural changes. It is the source of truth for what Moxible should become.

## Locked decisions

- **Repo name:** `moxible`
- **License:** Apache-2.0 (patent grant + standard for infra tooling)
- **Container image:** Published to GHCR on tag (free for public images). Workflow lives in `.github/workflows/` (not yet created — Phase 7).
- **Stubs dropped from first release:** `pbs.yml`, `jenkins.yml`, `monitoring.yml` (incomplete). Re-add when real.
- **SSH key strategy:** Wizard generates an ed25519 keypair *inside the container*, stores in `/data/keys/`. **Never** mount the host's `~/.ssh/` into the container.
- **Config flow:** Single shared file `/data/config.yml`. Web app reads via typed loader; ansible reads via `vars_files` in `group_vars/all.yml` + a wizard-rendered `inventory.yml`.

## Architecture (target)

```
container starts
  ↓
docker-entrypoint.sh: mkdir -p /data/{keys,runs}, chmod 700 /data/keys
  ↓
SvelteKit boots, hooks.server.ts chain: setupGate → authHandle → corsHandle → resolve
  ↓
setupGate checks /data/config.yml
  ↓                                    ↓
not found / setup_complete=false      setup_complete=true
  ↓                                    ↓
302 → /setup wizard                   normal app
  ↓                                    ↓
8 steps:                              GET / → deploy form
  1. connection (keygen + SSH test)   POST /api/deploy → runner.ts spawns
  2. network (probe ip route)           ansible-playbook with extra-vars from
  3. storage (pvesm status)             config + form, streams events back via SSE
  4. template (qm list)
  5. identity                          ansible-playbook (CLI, inside container)
  6. protection (qm list)              also reads /data/config.yml via group_vars,
  7. auth                              uses /data/keys/ for SSH
  8. review → save
  ↓
write /data/config.yml + render ansible/inventory.yml from inventory.yml.tmpl
  ↓
setup_complete=true → redirect to /
```

## Repo layout (current state — Phase 1)

```
moxible/
├── README.md                  # written
├── LICENSE                    # Apache-2.0
├── CLAUDE.md                  # this file
├── .gitignore
├── ansible/                   # copied from khazad-dum, parameterized in Phase 1.5
│   ├── ansible.cfg            # ✓ adds roles_path = roles
│   ├── requirements.yml
│   ├── inventory.yml          # ✓ env-var lookups for PVE_HOST/USER/BASTION/SSH_KEY_PATH
│   ├── group_vars/all.yml     # ✓ generic managed_marker
│   ├── host_vars/pve.yml      # ✓ generic
│   ├── playbooks/
│   │   ├── ping.yml           # ✓ generic
│   │   ├── patch.yml          # ✓ generic
│   │   ├── node_exporter.yml  # ✓ generic
│   │   ├── destroy-vm.yml     # ✓ critical_vmids from CRITICAL_VMIDS env (Phase 2+ from config.yml)
│   │   ├── create-vm.yml                  # ✓ env-var fallback for SUBNET_PREFIX/GATEWAY/BRIDGE/STORAGE
│   │   ├── create-vm-from-template.yml    # ✓ env-var fallback for all knobs incl. CLOUD_USER, DOTFILES_URL
│   │   ├── build-cloud-template.yml       # ✓ env-var fallback for TEMPLATE_VMID, VM_STORAGE
│   │   └── templates/cloudinit-userdata.yaml.j2  # ✓ dotfiles bootstrap conditional on non-empty url
│   ├── roles/node_exporter/    # ✓ author field generic
│   └── README.md               # ✓ references SUBNET_PREFIX, env-var connection model
└── web/                        # copied from khazad-dum/web/deployer/, parameterized in Phase 1.5
    ├── Dockerfile              # ✓ ANSIBLE_DIR=/repo/ansible (baked), no proxmox-deployer.localhost
    ├── docker-compose.yml      # ✓ single ./data:/data mount, no host ~/.ssh, no gantry labels
    ├── docker-entrypoint.sh    # ✓ provisions /data/{keys,runs} only — no host SSH copy
    ├── ansible-callbacks/jsonl_events.py  # ✓ CLOUD_USER, DEFAULT_IDENTITY_FILE, PVE_BASTION from env
    ├── src/
    │   ├── hooks.server.ts     # ✓ ALLOWED_ORIGINS env-driven; no .localhost hardcoded
    │   ├── lib/
    │   │   ├── server/
    │   │   │   ├── runner.ts            # ✓ SUBNET_PREFIX/CLOUD_USER from env, generic defaults
    │   │   │   ├── pveQuery.ts          # ✓ env-driven, ProxyJump conditional on PVE_BASTION
    │   │   │   ├── ansibleParser.ts     # ✓ renderSshConfig takes user/identityFile/bastion opts
    │   │   │   ├── criticalVmids.ts     # ✓ reads CRITICAL_VMIDS env (Phase 2+ from config.yml)
    │   │   │   ├── paths.ts             # ✓ ANSIBLE_DIR/DATA_DIR/KEYS_DIR/CONFIG_PATH from env
    │   │   │   ├── jobs.ts              # ✓ generic
    │   │   │   ├── sse.ts               # ✓ generic
    │   │   │   └── templates.ts         # ✓ TEMPLATE_VMID env-driven (Phase 3 swaps for qm probe)
    │   │   ├── schemas/deploy.ts        # ✓ ANY_IP regex; subnet-aware regex lands Phase 2+
    │   │   └── components/
    │   │       ├── DeployForm.svelte    # ✓ generic IP placeholders, dotfiles URL placeholder
    │   │       ├── PubkeyInput.svelte   # ✓ /home/{cloudUser}/ via prop
    │   │       └── VmidPicker.svelte    # ✓ no subnet hardcoded in selection display
    │   └── routes/             # ✓ +page.svelte uses subnet_prefix placeholder
    ├── tests/
    └── README.md               # ✓ moxible-flavored env-var bring-up
```

Phase 1.5 complete: every ⚠ replaced with env-var fallback or generic
default. Phase 2+ swaps these env vars for the wizard-written
`/data/config.yml` without changing any of the call sites.

## Phase progress

Tracked in the task list (use `TaskList` to see current state):

| Phase | Status | Description |
|---|---|---|
| 1 | done | Skeleton: copy ansible/ + web/, LICENSE, README, CLAUDE.md, .gitignore, init git |
| 1.5 | done | Mechanical extraction: every ⚠ replaced with env-var fallback. CLI works with `PVE_HOST=… ansible-playbook …`. Container starts without host `~/.ssh`. |
| 2 | done | Shared config: zod schema (`web/src/lib/schemas/config.ts`), loader (`web/src/lib/server/config.ts`), `setupGate.ts` wired through `hooks.server.ts`, `ansible/inventory.yml.tmpl`, shared `ansible/tasks/load_config.yml` pulled into every playbook's `pre_tasks` (used `include_vars` not `vars_files` — the latter is play-level only and hard-fails if `/data/config.yml` is missing). Stub `routes/setup/+page.svelte` so the gate's redirect resolves. Pre-wizard CLI still works via env-var fallbacks. |
| 3 | pending | Wizard backend: `keygen.ts`, `pveProbe.ts`, `api/setup/{probe,keygen,save}/+server.ts` |
| 4 | pending | Wizard frontend: `routes/setup/{connection,network,storage,template,identity,protection,auth,review}/`, shared draft state |
| 5 | pending | Auth modes (none / shared_token / basic), argon2id hashing, hooks.server.ts chain |
| 6 | pending | Settings page (re-edit config post-setup) |
| 7 | pending | Docs (README quickstart, screenshots, security warnings) + GHCR publish workflow |
| 8 | pending | E2E test on clean state, fix bugs |

Total estimate: 19-29 hr.

## Critical conventions

These come from khazad-dum and stay true in Moxible. Apply them when extending playbooks:

- **No clicks.** Every persistent change goes through Ansible (or, after Phase 4, through the wizard which writes config the playbooks consume). The PVE web UI is for emergencies only.
- **VMID == last IP octet** for real guests in the configured subnet (vmid `200..254` → `<subnet_prefix>.<vmid>`). Templates and special objects live in vmid 9000+ and have no IP.
- **Snapshot-then-mutate.** Any playbook that touches a guest takes a `qm snapshot` named `preupgrade-<iso8601>` before changes. See `ansible/playbooks/patch.yml` for the canonical pattern.
- **Backups never on the system disk.** Default to a separate storage pool (`backup_storage` in config); never `local`.
- **Half-built VM hazard.** The create playbook gates every `qm clone`/`qm set`/`qm start` task with `when: not vm_exists[item.vmid]`. If the playbook dies after `qm clone` but before all `qm set` calls (container OOM, host reboot), the VM exists with template defaults and **re-running skips every fix step**. Recovery: destroy + redeploy, or finish manually on pve. Do **not** "fix forward" by re-running.
- **Concurrency mutex in the web runner.** `runner.ts` enforces single-job-at-a-time. The VMID auto-scan is racy across concurrent runs; serialization is the cheap safe path.
- **Custom callback plugin (`web/ansible-callbacks/jsonl_events.py`)** implements both `v2_runner_on_ok` and `v2_runner_item_on_ok`. For `loop:` tasks the per-iteration `_result.msg` only appears in `item_on_ok`; relying on `runner_on_ok` alone yields the loop wrapper and misses the actual debug message. The "Show next steps" debug task is what the parser uses to extract `vmid`/`ip`/`name` for the SSH snippet — if you ever rename it, update `NEXT_STEPS_RE` in **both** `web/src/lib/server/ansibleParser.ts` and `web/ansible-callbacks/jsonl_events.py`.
- **SSE controller race.** `web/src/lib/server/sse.ts` must always implement `cancel()` on the underlying source AND wrap `enqueue` in try/catch that flips a `closed` flag. Browser navigation cancels the EventSource which calls SvelteKit's stream `cancel()`; without our cleanup, subsequent ticks throw `ERR_INVALID_STATE` and crash the Node process — taking the in-flight ansible child with it.
- **Don't bake secrets into the image.** No keys, no tokens. Everything secret lives in the bind-mounted `./data/` volume.

## Don'ts

- **Don't mount the host's `~/.ssh` into the container.** Moxible's whole security model is that the container generates its own key in `/data/keys/`. Re-adding the host SSH mount reintroduces the SSH-perms gotcha + key-reuse risk that Moxible fixes.
- **Don't reintroduce khazad-dum specifics.** No `dillon`, `argonpi`, `pve`, `10.1.10.x`, `awall451`, `id_ed25519_pve`, `proxmox-deployer.localhost`, or `.claude/.critical-vmid` paths in committed code. All of these become wizard inputs or default to generic values (e.g. `cloud_user: admin`).
- **Don't ship the `pbs.yml` / `jenkins.yml` / `monitoring.yml` stubs** until they actually do something useful. Better to have fewer working playbooks than many broken ones.
- **Don't use `terraform apply` against a live host until import-then-zero-drift is proven.** (Moxible doesn't ship terraform yet — this guidance is for the future.)
- **Don't expose the web UI to the WAN without a reverse-proxy with auth in front.** Even after Phase 5 lands `shared_token` and `basic` auth, the keys it holds give root on Proxmox. LAN-only is the only safe default.
- **Don't push to `main` with `--force`** under any circumstances. Branch protection should be enabled on the GitHub side once a CI workflow exists.
- **Don't edit `~/lab/proxmox` (khazad-dum) from this repo's session.** The two repos are parallel until cutover.

## Where things are

- **Plan:** `~/.claude/plans/i-m-really-starting-to-twinkling-snowglobe.md` (full design)
- **Source repo (private, parallel):** `~/lab/proxmox/` — khazad-dum
- **This repo:** `~/lab/moxible/`
- **Web UI design notes inherited from khazad-dum:** `web/README.md` (operator guide — needs rewrite for Moxible context; placeholder until Phase 7)
- **Ansible mental model:** `ansible/README.md` (Terraform-user's primer — generic enough, may need light edits)
- **Custom callback plugin:** `web/ansible-callbacks/jsonl_events.py` (docstring explains the contract with the parser)
- **Memory:** `~/.claude/projects/-home-dillon-lab-moxible/memory/` (will exist once first session writes there)

## How to test the wizard end-to-end (when Phase 8 arrives)

```bash
# Start clean — wipe persisted state, force first-run
rm -rf ./data
docker compose up -d --build

# Open http://localhost:4080 — should redirect to /setup
# Walk wizard with a real PVE host
# After save: navigate to / and submit a deploy

# Verify CLI path works against the same config:
docker compose exec web bash
cd /repo/ansible && ansible-playbook playbooks/ping.yml
# Should succeed using /data/keys/id_ed25519_pve and the wizard-rendered inventory

# Verify protection works:
ansible-playbook playbooks/destroy-vm.yml -e vmid=<critical-vmid>
# Should fail at the protection check
```

## When stuck

If something in here contradicts current code state, **trust the code**. This file should be updated. CLAUDE.md is documentation and decays; `git log` and the actual files are authoritative.

If the plan needs to change, update both this file's "Locked decisions" section AND the plan file at `~/.claude/plans/i-m-really-starting-to-twinkling-snowglobe.md` so future sessions stay coherent.
