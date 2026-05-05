<script lang="ts">
  import { onMount } from 'svelte';
  import type { VmidReport } from '$lib/server/pveQuery';

  let { value = $bindable<number | null>(null) }: { value?: number | null } = $props();

  let report = $state<VmidReport | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);

  async function load(force = false) {
    loading = true;
    error = null;
    try {
      const res = await fetch('/api/vmids' + (force ? '?force=1' : ''));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      report = await res.json();
    } catch (e) {
      error = e instanceof Error ? e.message : 'fetch failed';
    } finally {
      loading = false;
    }
  }

  onMount(() => void load());
</script>

<div class="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
  <div class="flex items-center justify-between mb-2">
    <div class="text-sm text-zinc-300">VMID picker</div>
    <button
      type="button"
      class="text-xs text-zinc-400 hover:text-cyan-400"
      onclick={() => load(true)}
      disabled={loading}
    >
      {loading ? 'loading…' : 'refresh'}
    </button>
  </div>

  {#if error}
    <div class="text-xs text-red-400">error: {error}</div>
  {:else if !report}
    <div class="text-xs text-zinc-500">loading…</div>
  {:else if report.stale}
    <div class="text-xs text-amber-400">pve unreachable: {report.error ?? 'unknown'}</div>
  {:else}
    <div class="text-xs text-zinc-400 mb-2">
      next free: <span class="mono text-emerald-400">{report.next ?? 'none'}</span>
      &middot; range {report.range[0]}..{report.range[1]}
    </div>
    <div class="grid grid-cols-11 gap-1">
      {#each Array.from({ length: report.range[1] - report.range[0] + 1 }, (_, i) => report.range[0] + i) as vmid}
        {@const taken = report.taken.find((t) => t.vmid === vmid)}
        {@const isCritical = taken?.critical ?? false}
        {@const isFree = !taken}
        <button
          type="button"
          disabled={!isFree || isCritical}
          onclick={() => (value = value === vmid ? null : vmid)}
          title={taken ? `${taken.name}${isCritical ? ' (critical)' : ''}` : 'free'}
          class="mono text-[10px] py-1 rounded
            {value === vmid ? 'ring-2 ring-cyan-400' : ''}
            {isCritical ? 'bg-red-900/40 text-red-300 cursor-not-allowed' : ''}
            {!isFree && !isCritical ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : ''}
            {isFree ? 'bg-emerald-900/30 text-emerald-300 hover:bg-emerald-800/50' : ''}"
        >{vmid}</button>
      {/each}
    </div>
    <div class="text-xs text-zinc-500 mt-2">
      <span class="text-emerald-400">●</span> free
      <span class="text-zinc-500 ml-3">●</span> taken
      <span class="text-red-400 ml-3">●</span> critical
      {#if value != null}
        <span class="ml-3">selected: <span class="mono text-cyan-400">{value}</span></span>
      {/if}
    </div>
  {/if}
</div>
