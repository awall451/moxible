# syntax=docker/dockerfile:1.6

# Build context is the repo root. Run from repo root:
#   docker build -f web/Dockerfile .
# or via docker-compose.yml in this directory which sets `context: ..`.

# ---- builder ----------------------------------------------------------------
FROM node:22-bookworm-slim AS builder
WORKDIR /app

COPY web/package.json web/package-lock.json* ./
RUN npm ci

COPY web/ ./
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
      python3-yaml \
      sshpass \
      tini \
      ca-certificates \
      curl \
 && rm -rf /var/lib/apt/lists/*

# install collections used by the playbooks
COPY web/ansible-requirements.yml /tmp/ansible-requirements.yml
RUN ansible-galaxy collection install -r /tmp/ansible-requirements.yml \
      -p /usr/share/ansible/collections \
 && rm /tmp/ansible-requirements.yml

# copy build output + production node_modules
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# custom ansible callback plugin
COPY web/ansible-callbacks /app/ansible-callbacks

# bake the ansible tree into the image (read-only at /repo/ansible)
COPY ansible /repo/ansible

# entrypoint provisions /data/{keys,runs}
COPY web/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENV NODE_ENV=production \
    PORT=4080 \
    HOST=0.0.0.0 \
    BIND_ADDR=0.0.0.0 \
    ANSIBLE_DIR=/repo/ansible \
    DATA_DIR=/data \
    KEYS_DIR=/data/keys \
    ARTIFACTS_DIR=/data/runs \
    ANSIBLE_CONFIG=/repo/ansible/ansible.cfg \
    ANSIBLE_CALLBACK_PLUGINS=/app/ansible-callbacks \
    ANSIBLE_COLLECTIONS_PATH=/usr/share/ansible/collections \
    ALLOWED_ORIGINS=http://localhost:4080

EXPOSE 4080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS http://127.0.0.1:4080/api/healthz || exit 1

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh", "tini", "--"]
CMD ["node", "build/index.js"]
