import { z } from 'zod';

// Schema for /data/config.yml — written by the first-run wizard, read by
// both the SvelteKit server (loadConfig) and the ansible CLI (vars file).
//
// Keep field names snake_case to match YAML idiom and the ansible side,
// even though the rest of the TS codebase uses camelCase. The config tree
// is the contract; code that consumes it can adapt.

const SubnetPrefix = z
  .string()
  .regex(/^\d{1,3}\.\d{1,3}\.\d{1,3}$/, 'subnet_prefix must look like X.Y.Z (no trailing octet)');

const Ipv4 = z
  .string()
  .regex(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, 'must be a dotted-quad IPv4 address');

export const ConnectionSchema = z.object({
  pve_host: z.string().min(1),
  pve_user: z.string().min(1),
  pve_bastion: z.string().nullable().default(null),
  ssh_key_path: z.string().min(1),
  ssh_pubkey_path: z.string().min(1)
});

export const NetworkSchema = z.object({
  subnet_prefix: SubnetPrefix,
  cidr_prefix: z.number().int().min(8).max(30),
  gateway: Ipv4,
  dns_servers: z.array(z.string().min(1)).min(1),
  bridge: z.string().min(1)
});

export const StorageSchema = z.object({
  vm_storage: z.string().min(1),
  snippets_storage: z.string().min(1),
  backup_storage: z.string().nullable().default(null)
});

export const TemplateSchema = z.object({
  template_vmid: z.number().int().positive()
});

export const IdentitySchema = z.object({
  cloud_user: z.string().regex(/^[a-z][a-z0-9_-]{0,30}$/, 'cloud_user: lowercase, starts alpha, max 31 chars'),
  dotfiles_url: z.string().default('')
});

export const VmidRangeSchema = z
  .object({
    start: z.number().int().min(100).max(999999999),
    end: z.number().int().min(100).max(999999999)
  })
  .refine((v) => v.end >= v.start, { message: 'vmid_range.end must be >= vmid_range.start' });

export const ProtectionSchema = z.object({
  critical_vmids: z.array(z.number().int().positive()).default([])
});

export const AuthBasicSchema = z.object({
  username: z.string().default(''),
  password_hash: z.string().default('')
});

export const AuthSchema = z.object({
  mode: z.enum(['none', 'shared_token', 'basic']),
  token_hash: z.string().optional(),
  basic: AuthBasicSchema.default({ username: '', password_hash: '' })
});

export const ConfigSchema = z.object({
  schema_version: z.literal(1),
  setup_complete: z.boolean(),
  connection: ConnectionSchema,
  network: NetworkSchema,
  storage: StorageSchema,
  template: TemplateSchema,
  identity: IdentitySchema,
  vmid_range: VmidRangeSchema,
  protection: ProtectionSchema,
  auth: AuthSchema
});

export type Config = z.infer<typeof ConfigSchema>;
export type Connection = z.infer<typeof ConnectionSchema>;
export type Network = z.infer<typeof NetworkSchema>;
export type Storage = z.infer<typeof StorageSchema>;
export type Identity = z.infer<typeof IdentitySchema>;
export type Auth = z.infer<typeof AuthSchema>;
