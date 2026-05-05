import { z } from 'zod';

const HOSTNAME = /^[a-z][a-z0-9-]{1,30}$/;
const PUBKEY = /^(ssh-ed25519|ssh-rsa|ecdsa-sha2-\S+) [A-Za-z0-9+/=]+( .+)?$/;
const IP = /^10\.1\.10\.\d{1,3}$/;
const ANY_IP = /^(\d{1,3}\.){3}\d{1,3}$/;

export const deploySchema = z.object({
  name: z
    .string()
    .min(2)
    .max(31)
    .regex(HOSTNAME, 'lowercase letters, digits, hyphens; must start with a letter'),
  cores: z.number().int().min(1).max(16),
  memoryGb: z.number().int().min(1).max(64),
  diskGb: z.number().int().min(8).max(500),
  templateVmid: z.number().int().default(9000),
  sshPubkey: z.string().min(80).max(4096).regex(PUBKEY, 'must be a valid OpenSSH public key'),
  advanced: z
    .object({
      vmidOverride: z
        .number()
        .int()
        .min(200)
        .max(254)
        .optional()
        .nullable(),
      ipOverride: z.string().regex(IP).optional().nullable(),
      dnsOverride: z.string().min(7).max(64).optional().nullable(),
      gatewayOverride: z.string().regex(ANY_IP).optional().nullable(),
      dotfilesUrl: z.string().url().optional().nullable(),
      dryRun: z.boolean().default(false)
    })
    .default({ dryRun: false })
});

export type DeployInput = z.infer<typeof deploySchema>;
