<script lang="ts">
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();

  function statusColor(s: string): string {
    if (s === 'succeeded') return 'text-emerald-400';
    if (s === 'succeeded_unparsed') return 'text-amber-400';
    if (s === 'failed') return 'text-red-400';
    if (s === 'running') return 'text-cyan-400';
    return 'text-zinc-400';
  }
</script>

<div class="space-y-4">
  <h1 class="text-2xl font-semibold text-zinc-100">Recent runs</h1>

  {#if data.runs.length === 0}
    <div class="text-zinc-500 text-sm">No runs yet. <a href="/" class="text-cyan-400 hover:underline">Deploy one →</a></div>
  {:else}
    <div class="rounded-lg border border-zinc-800 overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-zinc-900 text-zinc-400 text-xs">
          <tr>
            <th class="text-left px-4 py-2">Name</th>
            <th class="text-left px-4 py-2">VMID</th>
            <th class="text-left px-4 py-2">Status</th>
            <th class="text-left px-4 py-2">Started</th>
            <th class="text-left px-4 py-2">Duration</th>
            <th class="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {#each data.runs as r}
            <tr class="border-t border-zinc-800 hover:bg-zinc-900/40">
              <td class="px-4 py-2 mono text-zinc-200">{r.name}</td>
              <td class="px-4 py-2 mono text-zinc-300">{r.vmid ?? '—'}</td>
              <td class="px-4 py-2 {statusColor(r.status)}">{r.status}</td>
              <td class="px-4 py-2 text-zinc-400 mono text-xs">{r.startedAt.replace('T', ' ').slice(0, 19)}</td>
              <td class="px-4 py-2 text-zinc-400 mono text-xs">{r.durationSec != null ? r.durationSec + 's' : '—'}</td>
              <td class="px-4 py-2"><a class="text-cyan-400 hover:underline" href="/runs/{r.jobId}">view</a></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
