<script lang="ts">
  import type { PageData } from './$types';
  import EventStream from '$lib/components/EventStream.svelte';
  import SshSnippet from '$lib/components/SshSnippet.svelte';

  let { data }: { data: PageData } = $props();

  let result = $state(data.result);

  function statusColor(s: string): string {
    if (s === 'succeeded') return 'text-emerald-400';
    if (s === 'succeeded_unparsed') return 'text-amber-400';
    if (s === 'failed') return 'text-red-400';
    if (s === 'running') return 'text-cyan-400';
    return 'text-zinc-400';
  }

  async function refreshResult() {
    try {
      const res = await fetch(`/api/deploy/${data.result.jobId}`);
      if (res.ok) result = await res.json();
    } catch {
      /* ignore */
    }
  }
</script>

<div class="space-y-4">
  <div class="flex items-baseline justify-between">
    <h1 class="text-xl font-semibold text-zinc-100">
      Run <span class="mono text-cyan-400">{result.jobId}</span>
    </h1>
    <div class="text-sm">
      status: <span class="{statusColor(result.status)} font-medium">{result.status}</span>
    </div>
  </div>

  <div class="text-sm text-zinc-400 mono">
    {result.request.name} · {result.request.cores} cores · {result.request.memoryGb} GB RAM · {result.request.diskGb} GB disk
    {#if result.request.advanced.dryRun}<span class="text-amber-400 ml-2">[dry-run]</span>{/if}
  </div>

  {#if result.result}
    <SshSnippet snippet={result.result.sshConfigSnippet} command={result.result.sshCommand} />
  {/if}

  {#if result.error}
    <div class="rounded border border-red-700/60 bg-red-950/30 px-4 py-3 text-sm text-red-300">
      <div class="font-medium">{result.error.lastTask ? `failed at: ${result.error.lastTask}` : 'failed'}</div>
      <div class="mono mt-1 whitespace-pre-wrap">{result.error.message}</div>
    </div>
  {/if}

  <EventStream
    jobId={result.jobId}
    initialEvents={data.events}
    onResult={() => void refreshResult()}
    onDone={() => void refreshResult()}
  />
</div>
