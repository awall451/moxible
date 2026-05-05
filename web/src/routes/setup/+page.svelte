<!--
  Stub for the first-run wizard. Phase 4 replaces this with the
  multi-step flow (connection → network → storage → template →
  identity → protection → auth → review). For now this exists only
  so setupGate's redirect target resolves instead of 404'ing.
-->
<svelte:head>
  <title>Moxible — Setup</title>
</svelte:head>

<main class="mx-auto max-w-2xl p-8">
  <h1 class="text-2xl font-semibold">Moxible setup</h1>
  <p class="mt-4 text-neutral-700">
    The first-run wizard isn't built yet. It will collect Proxmox
    connection, network, storage, template, identity, protection, and
    auth settings, then write <code>/data/config.yml</code>.
  </p>
  <p class="mt-4 text-neutral-700">
    For now, set the env vars in <code>.env.example</code> directly on
    the container to drive the playbooks.
  </p>
</main>
