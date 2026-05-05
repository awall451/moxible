<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { AnsibleEvent } from '$lib/server/ansibleParser';

  type Props = {
    jobId: string;
    initialEvents?: AnsibleEvent[];
    onResult?: (e: Extract<AnsibleEvent, { type: 'result' }>) => void;
    onDone?: (e: Extract<AnsibleEvent, { type: 'done' }>) => void;
  };
  let { jobId, initialEvents = [], onResult, onDone }: Props = $props();

  let events = $state<AnsibleEvent[]>([...initialEvents]);
  let source: EventSource | null = null;
  let logRef: HTMLDivElement | undefined = $state(undefined);

  function push(evt: AnsibleEvent) {
    events = [...events, evt];
    if (evt.type === 'result' && onResult) onResult(evt);
    if (evt.type === 'done' && onDone) onDone(evt);
    queueMicrotask(() => {
      if (logRef) logRef.scrollTop = logRef.scrollHeight;
    });
  }

  onMount(() => {
    source = new EventSource(`/api/deploy/${jobId}/stream`);
    const seen = new Set(initialEvents.map((e) => `${e.type}-${e.ts}`));
    source.onmessage = (e) => {
      try {
        const evt = JSON.parse(e.data) as AnsibleEvent;
        const key = `${evt.type}-${evt.ts}`;
        if (seen.has(key)) return;
        seen.add(key);
        push(evt);
      } catch {
        /* ignore */
      }
    };
    source.onerror = () => {
      source?.close();
    };
  });

  onDestroy(() => source?.close());

  function statusBadge(evt: AnsibleEvent): string {
    if (evt.type === 'task_ok') return evt.changed ? 'changed' : 'ok';
    if (evt.type === 'task_skipped') return 'skip';
    if (evt.type === 'task_failed') return 'fail';
    return '';
  }

  function statusColor(badge: string): string {
    if (badge === 'ok') return 'text-emerald-400';
    if (badge === 'changed') return 'text-amber-400';
    if (badge === 'skip') return 'text-zinc-500';
    if (badge === 'fail') return 'text-red-400';
    return 'text-zinc-300';
  }
</script>

<div class="rounded-lg border border-zinc-800 bg-zinc-950">
  <div class="border-b border-zinc-800 px-3 py-2 text-xs text-zinc-400 flex justify-between">
    <span>events</span>
    <span class="mono">{events.length}</span>
  </div>
  <div bind:this={logRef} class="mono text-xs p-3 max-h-96 overflow-y-auto space-y-1">
    {#each events as evt (evt.ts + '-' + evt.type + '-' + Math.random())}
      {#if evt.type === 'job_started'}
        <div class="text-zinc-500">started pid={evt.pid}</div>
      {:else if evt.type === 'play_start'}
        <div class="text-zinc-300 mt-2">▶ play: {evt.play}</div>
      {:else if evt.type === 'task_start'}
        <div class="text-zinc-400">  • {evt.task}</div>
      {:else if evt.type === 'task_ok' || evt.type === 'task_skipped' || evt.type === 'task_failed'}
        <div class="ml-4 {statusColor(statusBadge(evt))}">
          [{statusBadge(evt)}] {('task' in evt) ? evt.task : ''}{('host' in evt) ? ' @ ' + evt.host : ''}
          {#if evt.type === 'task_failed'}
            <div class="text-red-300 ml-4 whitespace-pre-wrap">{evt.msg}</div>
          {/if}
        </div>
      {:else if evt.type === 'play_recap'}
        <div class="text-zinc-400 mt-2">recap {evt.host}: ok={evt.ok} changed={evt.changed} failed={evt.failed} unreachable={evt.unreachable}</div>
      {:else if evt.type === 'result'}
        <div class="text-cyan-400">→ result: vmid={evt.vmid} ip={evt.ip} name={evt.name}</div>
      {:else if evt.type === 'done'}
        <div class="{evt.status === 'succeeded' ? 'text-emerald-400' : 'text-red-400'} mt-1">done: {evt.status} (exit {evt.exitCode})</div>
      {:else if evt.type === 'stderr_line'}
        <div class="text-red-300 ml-4">stderr: {evt.line}</div>
      {/if}
    {/each}
    {#if events.length === 0}
      <div class="text-zinc-600">waiting for events…</div>
    {/if}
  </div>
</div>
