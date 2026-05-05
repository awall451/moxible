# Ansible — a Terraform user's primer

Everything Ansible-related in this repo lives under `ansible/`. This doc explains the mental model, the shape of this directory, and the patterns we'll use. It's written for someone who already groks Terraform but has not used Ansible much.

## TL;DR

Ansible is to **operating systems** what Terraform is to **cloud infrastructure**. Terraform reconciles declared HCL against a provider's API. Ansible reconciles declared YAML against the actual state of a Linux system, over SSH, by running modules.

You're not going to write `apt install nginx`. You're going to write:

```yaml
- name: nginx is installed
  ansible.builtin.apt:
    name: nginx
    state: present
```

…and Ansible will SSH in, check whether nginx is installed, install it if not, and report `ok` or `changed`.

## Mental model — Terraform → Ansible mapping

| Terraform | Ansible | Notes |
|---|---|---|
| `provider "..." {}` | inventory + connection vars | Where to act, how to authenticate. Ansible's "provider" is SSH+Python on the target. |
| Provider docs | Module docs (`ansible.builtin.apt`, `community.general.zfs`, etc.) | Each module = one resource type. There are thousands. |
| `resource "..." "x" {}` | One **task** (a list item under `tasks:`) | Idempotent step. Module-dependent — `apt: state=present` is idempotent; `command: rm -rf foo` is NOT (you write `creates`/`removes` to make it so). |
| Root module | A **playbook** (top-level `*.yml` under `playbooks/`) | Orchestrates plays against host groups. |
| Module (TF) | A **role** (under `roles/<name>/`) | Reusable bundle: tasks + handlers + defaults + templates + files + meta. |
| `var "x" {}` + `var.x` | Variables in `group_vars/`, `host_vars/`, `defaults/main.yml`, `vars/main.yml`, command-line `-e`, etc. | Precedence is a 22-level cake — see the cheat sheet below. |
| `data "..." {}` | **Facts** (gathered automatically), `set_fact`, `register: var` from a task | Facts are everything Ansible learned about the host on connect. |
| `for_each` / `count` | `loop:` on a task | One task, many iterations. |
| `depends_on` | Task ordering (top-to-bottom) + `notify:` → handlers | Ansible runs tasks **in declared order**. No DAG. |
| Provisioners | The default mode (Ansible IS the provisioner) | This is what Ansible was built for. |
| `terraform plan` | `ansible-playbook ... --check --diff` | Dry-run. Module support varies — most builtins respect it. |
| `terraform apply` | `ansible-playbook ...` (no flag) | Actually runs. |
| State file | **There is no state file.** Ansible re-reads system state every run. | This is the biggest mental shift. The system itself is the state store. |
| Drift | "Changed" tasks on a no-op run | If `--check` shows changes when you didn't change YAML, drift exists. |
| Workspaces | Different inventories or `--limit` | Inventory-as-environment. |
| `templatefile()` | **Jinja2** templates in `templates/` rendered by `template` module | Same idea, different engine. |
| Backend | Inventory file(s) — local or dynamic | No remote state because there is no state. |
| Provider auth | `ansible_ssh_*` vars + SSH agent | Reuse the same key + SSH config the rest of this repo uses. |

The biggest things to internalize:
1. **Order matters.** Tasks run top-to-bottom. There's no DAG.
2. **No state file.** Every run reads reality. Idempotence is the property of each module, not a global guarantee.
3. **`--check` is your `terraform plan`.** Always run it before live.
4. **Facts replace data sources.** When you connect, Ansible gathers ~200 facts (`ansible_distribution`, `ansible_memtotal_mb`, network info, etc.) by default.

## Variable precedence — the 5 levels you actually need

The full list has 22 entries. The five that matter 95% of the time, lowest to highest:

1. `roles/<role>/defaults/main.yml` — role authors put fallback defaults here.
2. `inventory.yml` host/group vars (less common pattern in this repo).
3. `group_vars/<group>.yml` — applies to every host in that group.
4. `host_vars/<host>.yml` — applies to one specific host.
5. `--extra-vars` / `-e` on the command line — wins over everything.

Higher number wins. There's also `vars:` blocks inside tasks and `set_fact`, but you can ignore those until you need them.

## Directory layout (this repo)

```
ansible/
├── README.md                  # this file
├── ansible.cfg                # global runtime config (pipelining, fact cache, etc.)
├── inventory.yml              # static inventory: which hosts, which groups
├── requirements.yml           # collections + galaxy roles to install
├── group_vars/
│   └── all.yml                # vars applied to every host
├── host_vars/
│   └── pve.yml                # vars applied only to the pve host
├── playbooks/
│   ├── ping.yml                          # smoke test: "can I reach every host?"
│   ├── node_exporter.yml                 # apply roles/node_exporter to monitored hosts
│   ├── create-vm.yml                     # ISO-based VM creation (interactive install)
│   ├── build-cloud-template.yml          # one-time: build VMID 9000 cloud-init template
│   ├── create-vm-from-template.yml       # clone template, apply cloud-init, boot ready
│   ├── patch.yml                         # rolling apt upgrade
│   └── destroy-vm.yml                    # graceful stop + qm destroy --purge
└── roles/
    └── node_exporter/         # reusable role; first end-to-end example
        ├── README.md
        ├── defaults/main.yml  # default vars (lowest precedence)
        ├── tasks/main.yml     # the actual steps
        ├── handlers/main.yml  # services to restart when notified
        ├── templates/
        │   └── node_exporter.service.j2
        └── meta/main.yml      # role metadata + dependencies
```

## Workflow — how you'll actually use this

```bash
# 0. One-time setup (workstation):
paru -S ansible                                        # or pip install --user ansible
ansible-galaxy install -r ansible/requirements.yml     # install collections

# 1. Smoke test — reach every host?
cd ansible
ansible -i inventory.yml all -m ansible.builtin.ping

# 2. Dry-run a playbook — like `terraform plan`:
ansible-playbook playbooks/node_exporter.yml --check --diff

# 3. Run for real:
ansible-playbook playbooks/node_exporter.yml

# 4. Limit to one host:
ansible-playbook playbooks/patch.yml --limit pve

# 5. Run only tagged tasks:
ansible-playbook playbooks/node_exporter.yml --tags install

# 6. Override a variable for one run:
ansible-playbook playbooks/node_exporter.yml -e node_exporter_version=1.9.0
```

Hook integration: `ansible-playbook --check ...` is auto-allowed by `proxmox-guard.py`. A live `ansible-playbook` (no `--check`) hits the **confirm** tier — you'll be prompted before Claude runs it.

## Provisioning a new VM — two patterns

| Want | Use | What happens |
|---|---|---|
| Hand-install Ubuntu/Debian via the installer in noVNC | `playbooks/create-vm.yml` | Creates VM hardware, attaches install ISO. You boot it, click through the installer. Good for one-off learning or when no cloud image exists. |
| Boot a ready-to-SSH Ubuntu in 30–60 s | `playbooks/build-cloud-template.yml` (once) → `playbooks/create-vm-from-template.yml` (per VM) | First playbook downloads `noble-server-cloudimg-amd64.img`, verifies SHA, imports as VMID 9000 template. Second playbook clones template into a real VMID, applies cloud-init (hostname, static IP, your SSH key), boots. No installer. |

The cloud-init pattern is the right default for any new automation-ready guest. Keep `create-vm.yml` for the cases where you need a graphical or specialized installer (Windows, Rocky, custom distro).

VMID/IP convention: real guests use vmid 200–254 with last-octet IP (`vmid 204 → <subnet_prefix>.204`). Templates and special objects live at vmid 9000+ and have no IP. The subnet prefix is configured via `SUBNET_PREFIX` (Phase 1.5) or the wizard's `network.subnet_prefix` (Phase 2+).

## Conventions used in this repo

- **All inventory hosts connect via env vars** (`PVE_HOST`, `PVE_USER`, `PVE_BASTION`, `SSH_KEY_PATH`) in Phase 1.5; the Phase 2+ wizard renders these into `inventory.yml` from `/data/config.yml` instead. Bastion is opt-in: leave `PVE_BASTION` unset for direct connections.
- **Group membership drives behavior.** A host that joins the `monitored` group gets node_exporter; a host in `auto_patch` gets weekly upgrades. Use groups, not per-host conditionals, where possible.
- **Roles are the unit of reuse.** If a chunk of YAML is going to be applied to more than one playbook or host, lift it into a role.
- **Snapshot before mutate.** Playbooks that change live guests open a `qm snapshot` (or `pct snapshot`) named `preupgrade-<iso8601>` before doing destructive work. See `playbooks/patch.yml`.
- **Variables are typed by convention.** Booleans = `true`/`false`, never `yes`/`no`. Strings quoted. Lists explicit.
- **Failure is loud.** Set `ANSIBLE_STDOUT_CALLBACK=yaml` (already in `ansible.cfg`) so errors are readable.

## How a role is structured (using `node_exporter` as the example)

A role is just a directory tree with conventional names. Ansible auto-loads files from each subdirectory.

| File | Purpose | Like in Terraform… |
|---|---|---|
| `defaults/main.yml` | Default values for variables. Lowest precedence — easy to override. | A module's `variables.tf` defaults. |
| `tasks/main.yml` | The list of tasks to run. The role's body. | A module's `main.tf`. |
| `handlers/main.yml` | Tasks that only run when notified by another task (e.g. "restart service X"). | `lifecycle.replace_triggered_by` plus an explicit step. |
| `templates/*.j2` | Jinja2 templates rendered by the `template:` module. | `templatefile("...", {...})`. |
| `files/*` | Static files copied verbatim by the `copy:` module. | A `local_file` resource's content. |
| `meta/main.yml` | Role metadata (deps, supported platforms, Galaxy info). | A module's `versions.tf`. |
| `vars/main.yml` | Variables that should NOT be easily overridden (high precedence). | Module-internal locals. |

Read `roles/node_exporter/` end-to-end — it's small, fully working, and demonstrates every common pattern (variables, templates, handlers, conditionals on `ansible_distribution`, idempotent download, systemd).

## Common module cheat sheet

| Task | Module | Mini-example |
|---|---|---|
| Install a package | `ansible.builtin.apt` / `dnf` / `package` (auto-picks) | `apt: name=jq state=present` |
| Render a config | `ansible.builtin.template` | `src=foo.j2 dest=/etc/foo` |
| Copy a static file | `ansible.builtin.copy` | `src=foo dest=/etc/foo` |
| Ensure a service runs | `ansible.builtin.systemd_service` | `name=nginx state=started enabled=true` |
| Make a directory | `ansible.builtin.file` | `path=/srv/x state=directory mode=0755` |
| Add a line to a file | `ansible.builtin.lineinfile` | `path=/etc/foo regex=... line=...` |
| Manage a user | `ansible.builtin.user` | `name=prom system=true shell=/bin/false` |
| Run a shell command (escape hatch) | `ansible.builtin.command` (preferred) / `shell` | Add `creates: /path/foo` for idempotence. |
| Conditional task | any module + `when:` | `when: ansible_distribution == "Debian"` |
| Loop | any module + `loop:` | `loop: [foo, bar]` then `{{ item }}` |
| Restart on change | task `notify:` + handler with same name | See `roles/node_exporter`. |

Almost everything else is a more specialized form of these.

## Where to read next

- Official user guide: <https://docs.ansible.com/ansible/latest/user_guide/>
- The `ansible.builtin` module reference: <https://docs.ansible.com/ansible/latest/collections/ansible/builtin/>
- Variable precedence (the full 22): <https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_variables.html#variable-precedence-where-should-i-put-a-variable>
- The `node_exporter` role in this repo — annotated as a learning artifact.
