<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
  let { children } = $props();
</script>

<div class="min-h-screen flex flex-col">
  <header class="border-b border-zinc-800 bg-zinc-900/60 backdrop-blur sticky top-0 z-10">
    <div class="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
      <a href="/" class="font-semibold text-lg tracking-tight">
        <span class="text-cyan-400">proxmox</span><span class="text-zinc-300">-deployer</span>
      </a>
      <nav class="flex gap-4 text-sm">
        <a
          href="/"
          class="hover:text-cyan-400 {$page.url.pathname === '/' ? 'text-cyan-400' : 'text-zinc-400'}"
        >Deploy</a>
        <a
          href="/runs"
          class="hover:text-cyan-400 {$page.url.pathname.startsWith('/runs') ? 'text-cyan-400' : 'text-zinc-400'}"
        >Runs</a>
      </nav>
    </div>
  </header>

  <main class="flex-1 max-w-5xl w-full mx-auto px-4 py-6">
    {@render children()}
  </main>

  <footer class="border-t border-zinc-800 text-zinc-500 text-xs">
    <div class="max-w-5xl mx-auto px-4 py-3 flex justify-between">
      <span>~/lab/proxmox/web/deployer</span>
      <span>port 4080</span>
    </div>
  </footer>
</div>
