# Role: `node_exporter`

Installs Prometheus's `node_exporter` (host metrics agent) and runs it as a systemd service. Idempotent: re-running upgrades the binary only when `node_exporter_version` changes.

## What it does, step by step

1. Ensures the unprivileged `prometheus` system user exists.
2. Checks the version of any existing `node_exporter` binary.
3. If absent or wrong version: downloads the official tarball from GitHub releases, extracts the binary, places it at `/usr/local/bin/node_exporter`, and notifies the restart handler.
4. Renders the systemd unit at `/etc/systemd/system/node_exporter.service`.
5. Reloads systemd, enables, and starts the service.

The handler restarts the service only if step 3 or 4 reported `changed`.

## Variables (override in group_vars/host_vars/-e)

| Var | Default | Meaning |
|---|---|---|
| `node_exporter_version` | `1.8.2` | Upstream release. Pin per-environment. |
| `node_exporter_arch` | `amd64` | Or `arm64` for the bastion. |
| `node_exporter_user` | `prometheus` | Service account. |
| `node_exporter_listen_address` | `0.0.0.0:9100` | Bind address. |
| `node_exporter_textfile_dir` | `/var/lib/node_exporter/textfile_collector` | For custom metrics. |
| `node_exporter_extra_args` | `""` | Extra flags appended to ExecStart. |

## Usage

```yaml
# In a playbook:
- hosts: monitored
  become: true
  roles:
    - node_exporter
```

Or run the bundled play:

```bash
ansible-playbook playbooks/node_exporter.yml --check --diff
ansible-playbook playbooks/node_exporter.yml
```

## Why it's a teaching role

It's the smallest realistic example that hits every Ansible pattern:

- **Variables** with sensible defaults
- **Conditional task** (`when:`) on Linux distribution detection
- **`register:` + `failed_when:`** to safely run a `command` task
- **`get_url`** for a deterministic download
- **`unarchive`** with extraction filtering
- **A Jinja2 template** rendered by `template:`
- **`notify:` → handler** for restart-on-change
- **`tags:`** so the user can run subsets

Read `tasks/main.yml` linearly and you've seen 80% of how Ansible roles look in the wild.
