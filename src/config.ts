import { z } from "zod";

const WebhookRouteSchema = z.object({
  secret: z.string().optional(),
  verify: z.enum(["hmac-sha256", "none"]).default("none"),
});

const ScheduleEntrySchema = z.object({
  cron: z.string(),
  channel: z.string().optional(),
  prompt: z.string(),
  timezone: z.string().default("UTC"),
});

export const ConfigSchema = z.object({
  name: z.string().default("Mindaugas"),
  model: z.string().default("claude-sonnet-4-6"),
  fallbackModel: z.string().default("claude-haiku-4-5"),
  cwd: z.string().optional(),
  data: z.string().default("./data"),

  slack: z
    .object({
      botToken: z.string(),
      appToken: z.string(),
      channel: z.string().optional(),
    })
    .optional(),

  webhook: z
    .object({
      port: z.number().default(9100),
      routes: z.record(z.string(), WebhookRouteSchema).default({}),
    })
    .optional(),

  schedule: z.array(ScheduleEntrySchema).default([]),

  maxBudgetUsd: z.number().default(5.0),
  maxTurns: z.number().default(50),
  sandbox: z.boolean().default(false),
  blockedPatterns: z.array(z.instanceof(RegExp)).default([
    /rm\s+-rf\s+[\/~]/,
    /mkfs/,
    /shutdown/,
    /reboot/,
    /dd\s+if=/,
    />\s*\/dev\//,
  ]),

  health: z
    .object({
      port: z.number().default(9200),
      endpoint: z.string().default("/health"),
    })
    .default({}),
});

export type LituanicConfig = z.infer<typeof ConfigSchema>;

export function defineConfig(config: z.input<typeof ConfigSchema>): LituanicConfig {
  return ConfigSchema.parse(config);
}

/**
 * Load config from file, or auto-detect from env vars if no file exists.
 * Priority: config file > env vars > defaults.
 */
export async function loadConfig(path?: string): Promise<LituanicConfig> {
  const configPath = path ?? "./lituanic.config.ts";
  try {
    const mod = await import(configPath);
    return ConfigSchema.parse(mod.default ?? mod);
  } catch (err: any) {
    if (err?.code === "ERR_MODULE_NOT_FOUND" || err?.code === "MODULE_NOT_FOUND") {
      console.log(`[lituanic] No config file — auto-detecting from env vars`);
      return ConfigSchema.parse(configFromEnv());
    }
    console.error(`[lituanic] Config error in ${configPath}:`, err?.message ?? err);
    process.exit(1);
  }
}

/**
 * Build config from environment variables. Zero-config mode.
 * Set SLACK_BOT_TOKEN + SLACK_APP_TOKEN → Slack activates.
 * Set LINEAR_WEBHOOK_SECRET → webhook server activates.
 * Set LINEAR_API_KEY → Linear check schedule activates.
 */
function configFromEnv(): z.input<typeof ConfigSchema> {
  const env = process.env;
  const config: z.input<typeof ConfigSchema> = {};

  // Slack — auto-detect from env
  if (env.SLACK_BOT_TOKEN && env.SLACK_APP_TOKEN) {
    config.slack = {
      botToken: env.SLACK_BOT_TOKEN,
      appToken: env.SLACK_APP_TOKEN,
      channel: env.LITUANIC_OPS_CHANNEL,
    };
  }

  // Webhook — auto-detect from Linear webhook secret
  if (env.LINEAR_WEBHOOK_SECRET) {
    config.webhook = {
      port: Number(env.LITUANIC_WEBHOOK_PORT ?? 9100),
      routes: {
        "/webhook/linear": {
          secret: env.LINEAR_WEBHOOK_SECRET,
          verify: "hmac-sha256",
        },
      },
    };
  }

  // Schedule — auto-configure if Linear API key is set
  const schedule: z.input<typeof ScheduleEntrySchema>[] = [];
  const tz = env.TZ ?? env.LITUANIC_TIMEZONE ?? "UTC";

  if (env.LINEAR_API_KEY) {
    schedule.push({
      cron: "*/15 * * * *",
      prompt: "Check Linear for assigned issues in Todo or In Progress state. Work on the highest priority one.",
      timezone: tz,
    });
  }

  if (schedule.length > 0) config.schedule = schedule;

  // Model override
  if (env.LITUANIC_MODEL) config.model = env.LITUANIC_MODEL;

  // Name
  if (env.LITUANIC_NAME) config.name = env.LITUANIC_NAME;

  return config;
}
