/** Actions the agent asks the client to perform on the user's data. */
export type AgentTable = "tasks" | "reminders" | "notes" | "ideas" | "events" | "categories";

export type AgentAction =
  | { op: "create"; table: AgentTable; ref?: string; data: Record<string, unknown> }
  | { op: "update"; table: AgentTable; id: string; data: Record<string, unknown> }
  | { op: "delete"; table: AgentTable; id: string };

export interface AgentFocus {
  type: "task" | "note" | "reminder" | "idea" | "event";
  id: string;
}

export interface AgentResponse {
  reply: string;
  actions: AgentAction[];
  simulated: boolean;
  error?: string;
  model?: string;
}
