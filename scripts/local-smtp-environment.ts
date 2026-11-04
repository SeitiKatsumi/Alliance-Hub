export const LOCAL_SMTP_KEYS = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'] as const;

/** Local SMTP belongs to this project; never mix it with a parent application's account. */
export function applyLocalSmtpEnvironment(project: Record<string, string | undefined>, environment: Record<string, string | undefined>) {
  for (const key of LOCAL_SMTP_KEYS) {
    if (project[key] === undefined) delete environment[key];
    else environment[key] = project[key];
  }
}
