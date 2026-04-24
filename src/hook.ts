export type HookEvent = {
  hook_event_name: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_response?: Record<string, unknown>;
  cwd?: string;
  session_id?: string;
  transcript_path?: string;
};

export type HookResponse = {
  continue?: boolean;
  decision?: "approve" | "block";
  reason?: string;
  additionalContext?: string;
  suppressOutput?: boolean;
};

type Handler = (e: HookEvent) => Promise<HookResponse>;

const handlers: Record<string, Handler> = {};

export function register(event: string, handler: Handler): void {
  handlers[event] = handler;
}

import { handleSessionStart } from "./pillars/output_rules/session_start.js";
register("SessionStart", handleSessionStart);

import { handleUserPromptSubmit } from "./pillars/output_rules/prompt_submit.js";
register("UserPromptSubmit", handleUserPromptSubmit);

export async function dispatch(event: HookEvent): Promise<HookResponse> {
  const h = handlers[event.hook_event_name];
  if (!h) return {};
  try {
    return await h(event);
  } catch (err) {
    return { additionalContext: `[tokenstack error] ${(err as Error).message}` };
  }
}

async function main(): Promise<void> {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  let event: HookEvent;
  try {
    event = JSON.parse(raw);
  } catch {
    process.exit(0);
  }
  const response = await dispatch(event);
  process.stdout.write(JSON.stringify(response));
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
