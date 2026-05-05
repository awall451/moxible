export type Template = {
  vmid: number;
  label: string;
  default?: boolean;
};

// Phase 1.5: single hardcoded entry, with VMID controllable via env var.
// Phase 2+ replaces this with a real `qm list` probe via pveProbe.ts.
const DEFAULT_TEMPLATE_VMID = Number.parseInt(
  process.env.TEMPLATE_VMID ?? '9000',
  10
);

export async function listTemplates(): Promise<Template[]> {
  return [
    { vmid: DEFAULT_TEMPLATE_VMID, label: 'Ubuntu 24.04 (cloud-init)', default: true }
  ];
}
