<script lang="ts">
  import DeployForm from '$lib/components/DeployForm.svelte';
</script>

<div class="space-y-4">
  <div>
    <h1 class="text-2xl font-semibold text-zinc-100">Deploy a new VM</h1>
    <p class="text-zinc-400 text-sm mt-1">
      Wraps <span class="mono text-zinc-300">ansible/playbooks/create-vm-from-template.yml</span>.
      VMID auto-assigned from the configured range; IP follows
      <span class="mono">&lt;subnet_prefix&gt;.&lt;vmid&gt;</span> unless overridden.
    </p>
  </div>

  <DeployForm />
</div>
