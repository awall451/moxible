# syntax=docker/dockerfile:1.6

# ---- builder ----------------------------------------------------------------
FROM node:22-bookworm-slim AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build && npm prune --omit=dev

# ---- runtime ----------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ansible \
      openssh-client \
      python3-jmespath \
      sshpass \
      tini \
      ca-certificates \
      curl \
 && rm -rf /var/lib/apt/lists/*

# install collections used by the playbook (community.general, ansible.posix, ansible.utils)
COPY ansible-requirements.yml /tmp/ansible-requirements.yml
RUN ansible-galaxy collection install -r /tmp/ansible-requirements.yml \
      -p /usr/share/ansible/collections \
 && rm /tmp/ansible-requirements.yml

# copy build output + production node_modules
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# custom ansible callback plugin
COPY ansible-callbacks /app/ansible-callbacks

# entrypoint that copies mounted ~/.ssh into a writable, properly-permissioned dir
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENV NODE_ENV=production \
    PORT=4080 \
    HOST=0.0.0.0 \
    BIND_ADDR=0.0.0.0 \
    REPO_ROOT=/repo \
    ARTIFACTS_DIR=/data/runs \
    ANSIBLE_CONFIG=/repo/ansible/ansible.cfg \
    ANSIBLE_CALLBACK_PLUGINS=/app/ansible-callbacks \
    ANSIBLE_COLLECTIONS_PATH=/usr/share/ansible/collections \
    ALLOWED_ORIGINS=http://proxmox-deployer.localhost,http://localhost:4080

EXPOSE 4080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS http://127.0.0.1:4080/api/healthz || exit 1

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh", "tini", "--"]
CMD ["node", "build/index.js"]
