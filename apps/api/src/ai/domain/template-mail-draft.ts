export type MailTemplateForDraft = {
  key: string;
  body: string;
  subject?: string | null;
};

export type MailTemplateValues = Record<string, string | number | null | undefined>;

export function renderMailTemplate(template: MailTemplateForDraft, values: MailTemplateValues) {
  const unresolvedVariables = new Set<string>();
  const replace = (value: string) => value.replace(/{{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*}}/g, (token, key: string) => {
    const replacement = values[key];
    if (replacement === undefined || replacement === null) {
      unresolvedVariables.add(key);
      return token;
    }
    return String(replacement);
  });

  return {
    subject: template.subject ? replace(template.subject) : '',
    body: replace(template.body),
    unresolvedVariables: Array.from(unresolvedVariables)
  };
}
