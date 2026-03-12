export type Agent = "opencode" | "claudecode" | "gemini" | "codex";

export interface Task {
  id: string;
  sprint: number;
  wave: 1 | 2 | 3;
  agent: Agent;
  title: string;
  files: string[];
  produces_contract: boolean;
  contract_path: string;
  depends_on_contracts: string[];
  acceptance_criteria: string[];
  forbidden_side_effects: string[];
  rollback_plan: string;
}

export interface Criterion {
  description: string;
  sprint_reference: string;
  requires_task_completion?: string;
}

export interface ScopeConstraint {
  allowed: string[];
  forbidden: string[];
}

export interface SprintPlan {
  wave1: string[];
  wave2: string[];
  wave3: string[];
  gate_criteria: string[];
  skip_criteria?: string[];
}

export interface TaskManifest {
  version: string;
  generated_at: string;
  source_document: string;
  source_snapshot: {
    docx_text_lines: number;
    task_rows: number;
    unique_task_ids: number;
  };
  scope_constraints: Record<Agent, ScopeConstraint>;
  criteria: Record<string, Criterion>;
  sprints: Record<string, SprintPlan>;
  tasks: Task[];
}

export type TaskStatus = "pending" | "running" | "done" | "failed";

export interface OrchestratorState {
  current_sprint: number;
  current_wave: 0 | 1 | 2 | 3;
  current_state:
    | "idle"
    | "dispatching_wave1"
    | "awaiting_contract"
    | "dispatching_wave2"
    | "awaiting_wave2"
    | "running_gate"
    | "gate_passed"
    | "gate_failed";
  tasks: Record<string, TaskStatus>;
  last_updated: string;
}
