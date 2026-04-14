const TICKET_REGEX = /\[((?:US|DEF|TASK)-\d+)\]/gi;

export function extractTicketKeys(message: string): string[] {
  const keys: string[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(TICKET_REGEX.source, 'gi');
  while ((match = regex.exec(message)) !== null) {
    keys.push(match[1].toUpperCase());
  }
  return [...new Set(keys)];
}
