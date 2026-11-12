"use client";
import * as React from "react";
import { Archive, ArrowRightCircle, Lightbulb, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDialogs } from "@/components/app/dialogs";
import { CategorySelect } from "@/components/items/category-select";
import { AiBadge, CategoryBadge, EmptyState, PageHeader } from "@/components/items/meta";
import { relativeDayLabel } from "@/lib/dates";
import { useData } from "@/lib/data/store";
import type { Idea, IdeaStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<IdeaStatus, { label: string; cls: string }> = {
  new: { label: "New", cls: "bg-violet-50 text-violet-700" },
  exploring: { label: "Exploring", cls: "bg-blue-50 text-blue-700" },
  converted: { label: "Converted", cls: "bg-emerald-50 text-emerald-700" },
  archived: { label: "Archived", cls: "bg-muted text-muted-foreground" },
};

function IdeaCard({ idea, onTag }: { idea: Idea; onTag: (t: string) => void }) {
  const { update, remove } = useData();
  const { open } = useDialogs();
  const convert = () =>
    open({
      type: "task",
      initial: { title: idea.title, description: idea.description, category_id: idea.category_id },
      onSaved: async (task) => {
        await update("ideas", idea.id, { status: "converted", converted_task_id: task.id }, { silent: true });
        toast.success("Idea converted to a task", { description: task.title });
      },
    });

  return (
    <div className="group flex flex-col rounded-xl border bg-card p-4 transition-all hover:border-primary/25 hover:shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className={cn("rounded px-1.5 py-0.5 text-[10.5px] font-medium", STATUS_STYLE[idea.status].cls)}>{STATUS_STYLE[idea.status].label}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-xs" className="-mt-1 -mr-1" aria-label="Idea actions">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => open({ type: "idea", editing: idea })}>
              <Pencil /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={convert}>
              <ArrowRightCircle /> Convert to task
            </DropdownMenuItem>
            {idea.status !== "archived" ? (
              <DropdownMenuItem onClick={() => update("ideas", idea.id, { status: "archived" }, { silent: true })}>
                <Archive /> Archive
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => update("ideas", idea.id, { status: "new" }, { silent: true })}>
                <Archive /> Unarchive
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => remove("ideas", idea.id)}>
              <Trash2 /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <button className="flex-1 text-left" onClick={() => open({ type: "idea", editing: idea })}>
        <p className="font-medium leading-snug">{idea.title}</p>
        {idea.description && <p className="mt-1.5 line-clamp-4 text-[13px] leading-relaxed text-muted-foreground">{idea.description}</p>}
      </button>
      {idea.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {idea.tags.map((t) => (
            <button key={t} onClick={() => onTag(t)} className="rounded bg-accent px-1.5 py-0.5 text-[11px] text-accent-foreground hover:bg-accent/70">
              #{t}
            </button>
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-2">
          {relativeDayLabel(new Date(idea.created_at))}
          <CategoryBadge id={idea.category_id} />
          <AiBadge source={idea.source} />
        </span>
        {idea.status !== "converted" ? (
          <button onClick={convert} className="inline-flex items-center gap-1 font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100">
            <ArrowRightCircle className="size-3" /> Make it a task
          </button>
        ) : (
          <span className="text-emerald-600">✓ Task created</span>
        )}
      </div>
    </div>
  );
}

export default function IdeasPage() {
  const { ideas } = useData();
  const { open } = useDialogs();
  const [query, setQuery] = React.useState("");
  const [tag, setTag] = React.useState<string | null>(null);
  const [category, setCategory] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<"open" | IdeaStatus | "all">("open");

  const allTags = [...new Set(ideas.flatMap((i) => i.tags))].sort();
  const filtered = ideas.filter((i) => {
    const q = query.trim().toLowerCase();
    if (q && !`${i.title} ${i.description ?? ""} ${i.tags.join(" ")}`.toLowerCase().includes(q)) return false;
    if (tag && !i.tags.includes(tag)) return false;
    if (category && i.category_id !== category) return false;
    if (status === "open" && i.status === "archived") return false;
    if (status !== "open" && status !== "all" && i.status !== status) return false;
    return true;
  });

  return (
    <div>
      <PageHeader
        title="Ideas"
        description="Sparks of inspiration — capture now, decide later."
        actions={
          <Button size="sm" onClick={() => open({ type: "idea" })}>
            <Plus /> New idea
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search ideas…" className="h-8 pl-8 text-[13px]" aria-label="Search ideas" />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger size="sm" className="w-36" aria-label="Status filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Not archived</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="exploring">Exploring</SelectItem>
            <SelectItem value="converted">Converted</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
            <SelectItem value="all">All ideas</SelectItem>
          </SelectContent>
        </Select>
        <CategorySelect allLabel="All categories" value={category} onChange={setCategory} size="sm" className="w-40" />
      </div>
      {allTags.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-1.5">
          <button onClick={() => setTag(null)} className={cn("rounded-full border px-2.5 py-0.5 text-[12px]", !tag ? "border-primary/30 bg-accent text-accent-foreground" : "bg-card text-muted-foreground hover:text-foreground")}>
            All tags
          </button>
          {allTags.map((t) => (
            <button
              key={t}
              onClick={() => setTag(tag === t ? null : t)}
              className={cn("rounded-full border px-2.5 py-0.5 text-[12px]", tag === t ? "border-primary/30 bg-accent text-accent-foreground" : "bg-card text-muted-foreground hover:text-foreground")}
            >
              #{t}
            </button>
          ))}
        </div>
      )}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title={ideas.length ? "No ideas match" : "No ideas yet"}
          description={ideas.length ? "Try a different search or filter." : 'Say "I have an idea for…" in Quick capture, or add one here.'}
          action={
            <Button size="sm" onClick={() => open({ type: "idea" })}>
              <Plus /> New idea
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((i) => (
            <IdeaCard key={i.id} idea={i} onTag={setTag} />
          ))}
        </div>
      )}
    </div>
  );
}
