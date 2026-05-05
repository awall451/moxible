<script lang="ts">
  import DeployForm from '$lib/components/DeployForm.svelte';
</script>

<div class="space-y-4">
  <div>
    <h1 class="text-2xl font-semibold text-zinc-100">Deploy a new VM</h1>
    <p class="text-zinc-400 text-sm mt-1">
      Wraps <span class="mono text-zinc-300">ansible/playbooks/create-vm-from-template.yml</span>.
      VMID + IP auto-assigned from <span class="mono">10.1.10.200..254</span> unless overridden.
    </p>
  </div>

  <DeployForm />
</div>
