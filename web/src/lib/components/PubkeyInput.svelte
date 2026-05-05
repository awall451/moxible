<script lang="ts">
  let { value = $bindable<string>('') }: { value?: string } = $props();

  let fingerprint = $state<string | null>(null);
  let parseError = $state<string | null>(null);

  function compute() {
    const trimmed = value.trim();
    if (!trimmed) {
      fingerprint = null;
      parseError = null;
      return;
    }
    const parts = trimmed.split(/\s+/);
    if (parts.length < 2 || !/^(ssh-ed25519|ssh-rsa|ecdsa-sha2-\S+)$/.test(parts[0])) {
      parseError = 'unrecognized key type';
      fingerprint = null;
      return;
    }
    parseError = null;
    fingerprint = `${parts[0]} ${parts[1].slice(0, 12)}…${parts[1].slice(-8)}`;
  }

  $effect(() => {
    void value;
    compute();
  });
</script>

<div>
  <label class="block text-sm text-zinc-300 mb-1" for="pubkey">SSH public key</label>
  <textarea
    id="pubkey"
    rows="3"
    autocomplete="off"
    spellcheck="false"
    placeholder="ssh-ed25519 AAAA... user@host"
    class="w-full mono text-xs bg-zinc-900 border border-zinc-800 rounded px-3 py-2 focus:border-cyan-500 focus:outline-none"
    bind:value
  ></textarea>
  {#if parseError}
    <div class="text-xs text-red-400 mt-1">{parseError}</div>
  {:else if fingerprint}
    <div class="text-xs text-emerald-400 mt-1 mono">{fingerprint}</div>
  {:else}
    <div class="text-xs text-zinc-500 mt-1">
      paste your public key. it will be added to /home/dillon/.ssh/authorized_keys on the new VM.
    </div>
  {/if}
</div>
