export const CONFIG_KEYS = {
  ALLOW_REGISTRATION: "allow_registration",
} as const;

export const CONFIG_DEFAULTS: Record<string, string> = {
  [CONFIG_KEYS.ALLOW_REGISTRATION]: "false",
} as const;