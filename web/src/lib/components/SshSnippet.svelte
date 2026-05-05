<script lang="ts">
  let { snippet, command }: { snippet: string; command: string } = $props();

  let copiedSnippet = $state(false);
  let copiedCmd = $state(false);

  async function copy(text: string, which: 'snippet' | 'cmd') {
    try {
      await navigator.clipboard.writeText(text);
      if (which === 'snippet') {
        copiedSnippet = true;
        setTimeout(() => (copiedSnippet = false), 1500);
      } else {
        copiedCmd = true;
        setTimeout(() => (copiedCmd = false), 1500);
      }
    } catch {
      /* clipboard not available */
    }
  }
</script>

<div class="rounded-lg border border-cyan-700/50 bg-cyan-950/20 p-4">
  <div class="text-cyan-300 text-sm font-medium mb-2">Ready to SSH</div>

  <div class="flex items-center gap-2 mb-3">
    <code class="flex-1 mono text-sm bg-zinc-900 rounded px-3 py-2 text-zinc-200">{command}</code>
    <button
      class="text-xs px-3 py-2 rounded bg-cyan-700 hover:bg-cyan-600 text-white"
      onclick={() => copy(command, 'cmd')}
    >
      {copiedCmd ? 'copied' : 'copy'}
    </button>
  </div>

  <div class="text-zinc-400 text-xs mb-1">~/.ssh/config snippet</div>
  <div class="flex items-start gap-2">
    <pre class="flex-1 mono text-xs bg-zinc-900 rounded px-3 py-2 text-zinc-200 whitespace-pre overflow-x-auto">{snippet}</pre>
    <button
      class="text-xs px-3 py-2 rounded bg-cyan-700 hover:bg-cyan-600 text-white"
      onclick={() => copy(snippet, 'snippet')}
    >
      {copiedSnippet ? 'copied' : 'copy'}
    </button>
  </div>
</div>
