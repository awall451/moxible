<script lang="ts">
  import { goto } from '$app/navigation';
  import PubkeyInput from './PubkeyInput.svelte';
  import VmidPicker from './VmidPicker.svelte';

  type Template = { vmid: number; label: string; default?: boolean };

  let templates = $state<Template[]>([]);
  let name = $state('ubuntu-app1');
  let cores = $state(2);
  let memoryGb = $state(4);
  let diskGb = $state(20);
  let templateVmid = $state(9000);
  let sshPubkey = $state('');

  let advancedOpen = $state(false);
  let vmidOverride = $state<number | null>(null);
  let ipOverride = $state('');
  let dnsOverride = $state('');
  let gatewayOverride = $state('');
  let dotfilesUrl = $state('');
  let dryRun = $state(false);

  let submitting = $state(false);
  let submitError = $state<string | null>(null);

  $effect(() => {
    void fetch('/api/templates')
      .then((r) => r.json())
      .then((t: Template[]) => {
        templates = t;
        const def = t.find((x) => x.default) ?? t[0];
        if (def) templateVmid = def.vmid;
      })
      .catch(() => undefined);
  });

  async function submit() {
    submitError = null;
    submitting = true;
    try {
      const body = {
        name: name.toLowerCase().trim(),
        cores,
        memoryGb,
        diskGb,
        templateVmid,
        sshPubkey: sshPubkey.trim(),
        advanced: {
          vmidOverride: vmidOverride ?? null,
          ipOverride: ipOverride.trim() || null,
          dnsOverride: dnsOverride.trim() || null,
          gatewayOverride: gatewayOverride.trim() || null,
          dotfilesUrl: dotfilesUrl.trim() || null,
          dryRun
        }
      };
      const res = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) {
        submitError = data?.error
          ? `${data.error}${data.message ? ': ' + data.message : ''}`
          : `HTTP ${res.status}`;
        return;
      }
      await goto(`/runs/${data.jobId}`);
    } catch (err) {
      submitError = err instanceof Error ? err.message : 'submit failed';
    } finally {
      submitting = false;
    }
  }
</script>

<form
  class="space-y-5"
  onsubmit={(e) => {
    e.preventDefault();
    void submit();
  }}
>
  <section class="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
    <h2 class="text-lg font-medium text-zinc-200">Basic</h2>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label for="name" class="block text-sm text-zinc-300 mb-1">Name</label>
        <input
          id="name"
          type="text"
          required
          minlength="2"
          maxlength="31"
          pattern="[a-z][a-z0-9-]+"
          class="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 mono text-sm focus:border-cyan-500 focus:outline-none"
          bind:value={name}
        />
        <div class="text-xs text-zinc-500 mt-1">hostname-safe; vm name + cloud-init hostname</div>
      </div>

      <div>
        <label for="template" class="block text-sm text-zinc-300 mb-1">OS template</label>
        <select
          id="template"
          class="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none"
          bind:value={templateVmid}
        >
          {#each templates as t}
            <option value={t.vmid}>{t.label} (vmid {t.vmid})</option>
          {/each}
        </select>
      </div>
    </div>

    <div class="grid grid-cols-3 gap-4">
      <div>
        <label for="cores" class="block text-sm text-zinc-300 mb-1">Cores</label>
        <input
          id="cores"
          type="number"
          min="1"
          max="16"
          class="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 mono text-sm focus:border-cyan-500 focus:outline-none"
          bind:value={cores}
        />
      </div>
      <div>
        <label for="memory" class="block text-sm text-zinc-300 mb-1">Memory (GB)</label>
        <input
          id="memory"
          type="number"
          min="1"
          max="64"
          class="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 mono text-sm focus:border-cyan-500 focus:outline-none"
          bind:value={memoryGb}
        />
      </div>
      <div>
        <label for="disk" class="block text-sm text-zinc-300 mb-1">Disk (GB)</label>
        <input
          id="disk"
          type="number"
          min="8"
          max="500"
          class="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 mono text-sm focus:border-cyan-500 focus:outline-none"
          bind:value={diskGb}
        />
      </div>
    </div>

    <PubkeyInput bind:value={sshPubkey} />
  </section>

  <section class="rounded-lg border border-zinc-800 bg-zinc-900/40">
    <button
      type="button"
      class="w-full text-left px-5 py-3 flex justify-between items-center text-zinc-300 hover:bg-zinc-900/80"
      onclick={() => (advancedOpen = !advancedOpen)}
    >
      <span class="font-medium">Advanced</span>
      <span class="text-zinc-500 text-xs">{advancedOpen ? 'hide' : 'show'}</span>
    </button>

    {#if advancedOpen}
      <div class="px-5 pb-5 space-y-4 border-t border-zinc-800 pt-4">
        <VmidPicker bind:value={vmidOverride} />

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="ip" class="block text-sm text-zinc-300 mb-1">IP override</label>
            <input
              id="ip"
              type="text"
              placeholder="10.1.10.207"
              class="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 mono text-sm focus:border-cyan-500 focus:outline-none"
              bind:value={ipOverride}
            />
            <div class="text-xs text-zinc-500 mt-1">defaults to 10.1.10.&lt;vmid&gt;</div>
          </div>
          <div>
            <label for="gw" class="block text-sm text-zinc-300 mb-1">Gateway override</label>
            <input
              id="gw"
              type="text"
              placeholder="10.1.10.1"
              class="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 mono text-sm focus:border-cyan-500 focus:outline-none"
              bind:value={gatewayOverride}
            />
          </div>
          <div>
            <label for="dns" class="block text-sm text-zinc-300 mb-1">DNS override</label>
            <input
              id="dns"
              type="text"
              placeholder="1.1.1.1 8.8.8.8"
              class="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 mono text-sm focus:border-cyan-500 focus:outline-none"
              bind:value={dnsOverride}
            />
          </div>
          <div>
            <label for="dotfiles" class="block text-sm text-zinc-300 mb-1">Dotfiles repo URL</label>
            <input
              id="dotfiles"
              type="url"
              placeholder="https://github.com/awall451/dotfiles.git"
              class="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 mono text-sm focus:border-cyan-500 focus:outline-none"
              bind:value={dotfilesUrl}
            />
          </div>
        </div>

        <label class="flex items-center gap-2 text-sm text-zinc-300">
          <input type="checkbox" bind:checked={dryRun} class="accent-cyan-500" />
          Dry run (--check, no changes on pve)
        </label>
      </div>
    {/if}
  </section>

  {#if submitError}
    <div class="rounded border border-red-700/60 bg-red-950/30 text-red-300 px-4 py-2 text-sm">
      {submitError}
    </div>
  {/if}

  <button
    type="submit"
    disabled={submitting || !sshPubkey.trim()}
    class="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded px-4 py-3 disabled:bg-zinc-700"
  >
    {submitting ? 'submitting…' : dryRun ? 'Run dry-run' : 'Deploy VM'}
  </button>
</form>
