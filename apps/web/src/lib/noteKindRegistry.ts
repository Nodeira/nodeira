export type KindDef = {
  id: string | null;
  displayName: string;
  icon: string;
  defaultMeta: Record<string, unknown>;
  availableViews: string[];
};

class NoteKindRegistry {
  private kinds = new Map<string | null, KindDef>();

  register(def: KindDef) {
    this.kinds.set(def.id, def);
  }

  getAll(): KindDef[] {
    return Array.from(this.kinds.values());
  }

  get(id: string | null): KindDef | undefined {
    return this.kinds.get(id);
  }
}

export const noteKindRegistry = new NoteKindRegistry();

noteKindRegistry.register({
  id: null,
  displayName: "Note",
  icon: "IconNote",
  defaultMeta: {},
  availableViews: ["recent", "pinned"],
});

noteKindRegistry.register({
  id: "task",
  displayName: "Task",
  icon: "IconCheckbox",
  defaultMeta: { status: "todo" },
  availableViews: ["recent", "pinned", "kanban"],
});

export const TASK_STATUSES: { id: string; label: string }[] = [
  { id: "todo", label: "To Do" },
  { id: "in-progress", label: "In Progress" },
  { id: "done", label: "Done" },
];
