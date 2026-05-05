# Moxible

**Proxmox-as-Code starter for homelabbers.** Ansible playbooks + a SvelteKit web UI in one container, configured by a first-run wizard. No env vars to puzzle out, no hand-edited inventory files. Same playbooks remain runnable from the CLI for power users.

> **Status: pre-alpha.** Forked from a private homelab repo and being generalized. See [CLAUDE.md](CLAUDE.md) for current state, plan, and what works today.

---

## What you get

- **Web wizard** — point-and-click through PVE host + SSH + network + storage. Pubkey is generated inside the container; you paste it into PVE root once and never deal with key files again.
- **Click-deploy VMs** — pick a template + VMID + hostname, paste a pubkey for the cloud-init user, watch the live ansible event stream, get an `ssh` snippet at the end.
- **Real Ansible underneath** — the UI shells out to vendored playbooks. You can also `ansible-playbook` directly using the same config the wizard wrote.
- **Critical-VMID protection** — mark certain VMIDs as untouchable; destroy/stop ops hard-fail.
- **Ships with a single Docker image** (GHCR, Apache-2.0). Mount one volume, open the page, done.

## Quickstart (placeholder — wizard not yet built)

```bash
git clone https://github.com/<owner>/moxible
cd moxible
docker compose up -d --build
# open http://localhost:4080 → first-run wizard
```

## Security

LAN-only by default. The web app has no auth on the wire today; the wizard's auth step (planned) will let you pick `none`, `shared_token`, or HTTP basic. **Do not expose this to the public internet without a reverse proxy that adds auth in front of it.**

The container holds an SSH private key with root access to your Proxmox host. Treat the `./data` volume like any other secret store.

## License

Apache-2.0. See [LICENSE](LICENSE).
