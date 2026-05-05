export type Template = {
  vmid: number;
  label: string;
  default?: boolean;
};

export async function listTemplates(): Promise<Template[]> {
  return [{ vmid: 9000, label: 'Ubuntu 24.04 (cloud-init)', default: true }];
}
