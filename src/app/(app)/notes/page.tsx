"use client";
import { useT } from "@/lib/i18n/provider";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Bell, CheckCircle2, Check, Folder, Loader2, MoreHorizontal, Pin, PinOff, Plus, Search, StickyNote, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useDialogs } from "@/components/app/dialogs";
import { CategorySelect } from "@/components/items/category-select";
import { TagInput } from "@/components/items/fields";
import { AiBadge, EmptyState, PageHeader } from "@/components/items/meta";
import { relativeDayLabel } from "@/lib/dates";
import { useData } from "@/lib/data/store";
import type { Note } from "@/lib/types";
import { cn } from "@/lib/utils";

function NoteEditor({ note, onDeleted, onBack }: { note: Note; onDeleted: () => void; onBack: () => void }) {
  const { update, remove, notes } = useData();
  const { open } = useDialogs();
  const { t } = useT();
  const [draft, setDraft] = React.useState({ title: note.title, content: note.content, folder: note.folder ?? "", tags: note.tags, category_id: note.category_id });
  const [status, setStatus] = React.useState<"saved" | "saving" | "dirty">("saved");
  const folders = [...new Set(notes.map((n) => n.folder).filter(Boolean))] as string[];
  const first = React.useRef(true);

  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setStatus("dirty");
    const timer = setTimeout(async () => {
      setStatus("saving");
      const ok = await update("notes", note.id, { title: draft.title.trim() || t("Untitled"), content: draft.content, folder: draft.folder.trim() || null, tags: draft.tags, category_id: draft.category_id }, { silent: true });
      setStatus(ok ? "saved" : "dirty");
    }, 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <Button variant="ghost" size="icon-xs" className="md:hidden" onClick={onBack} aria-label={t("Back to notes")}>
          <ArrowLeft />
        </Button>
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {status === "saving" ? <Loader2 className="size-3 animate-spin" /> : status === "saved" ? <Check className="size-3" /> : null}
          {status === "saving" ? t("Saving…") : status === "saved" ? t("Saved") : t("Editing…")}
        </span>
        <AiBadge source={note.source} />
        <div className="flex-1" />
        <Button variant="ghost" size="xs" onClick={() => update("notes", note.id, { pinned: !note.pinned }, { silent: true })}>
          {note.pinned ? <PinOff /> : <Pin />} {note.pinned ? t("Unpin") : t("Pin")}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-xs" aria-label={t("Note actions")}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => open({ type: "task", initial: { title: draft.title, description: draft.content, category_id: draft.category_id }, onSaved: (task) => toast.success(t("Task created from note"), { description: task.title }) })}>
              <CheckCircle2 /> {t("Convert to task")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => open({ type: "reminder", initial: { title: draft.title, description: draft.content.slice(0, 500), category_id: draft.category_id } })}>
              <Bell /> {t("Create reminder")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={async () => (await remove("notes", note.id)) && onDeleted()}>
              <Trash2 /> {t("Delete note")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-5">
        <input
          value={draft.title}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          placeholder={t("Untitled")}
          aria-label={t("Note title")}
          className="bg-transparent text-xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/50"
        />
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr]">
          <div className="relative">
            <Folder className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input list="note-folders" value={draft.folder} onChange={(e) => setDraft((d) => ({ ...d, folder: e.target.value }))} placeholder={t("Folder")} className="h-8 pl-8 text-[13px]" aria-label={t("Folder")} />
            <datalist id="note-folders">
              {folders.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </div>
          <CategorySelect value={draft.category_id} onChange={(c) => setDraft((d) => ({ ...d, category_id: c }))} size="sm" />
        </div>
        <TagInput value={draft.tags} onChange={(tags) => setDraft((d) => ({ ...d, tags }))} />
        <textarea
          value={draft.content}
          onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
          placeholder={t("Start writing…")}
          aria-label={t("Note content")}
          className="min-h-[320px] flex-1 resize-none bg-transparent text-[14.5px] leading-relaxed outline-none placeholder:text-muted-foreground/50"
        />
      </div>
    </div>
  );
}

function NotesInner() {
  const { notes, create } = useData();
  const params = useSearchParams();
  const router = useRouter();
  const { t } = useT();
  const [query, setQuery] = React.useState("");
  const [folder, setFolder] = React.useState<string | null>(null);
  const [tag, setTag] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(params.get("id"));

  const folders = [...new Set(notes.map((n) => n.folder).filter(Boolean))].sort() as string[];
  const tags = [...new Set(notes.flatMap((n) => n.tags))].sort();
  const filtered = notes
    .filter((n) => {
      const q = query.trim().toLowerCase();
      if (q && !`${n.title} ${n.content} ${n.tags.join(" ")} ${n.folder ?? ""}`.toLowerCase().includes(q)) return false;
      if (folder && n.folder !== folder) return false;
      if (tag && !n.tags.includes(tag)) return false;
      return true;
    })
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updated_at.localeCompare(a.updated_at));

  const selected = notes.find((n) => n.id === selectedId) ?? null;

  const select = (id: string | null) => {
    setSelectedId(id);
    router.replace(id ? `/notes?id=${id}` : "/notes", { scroll: false });
  };

  const newNote = async () => {
    const n = await create("notes", { title: t("Untitled"), content: "", folder, tags: tag ? [tag] : [], pinned: false, category_id: null, source: "manual" }, { silent: true });
    if (n) select(n.id);
  };

  return (
    <div>
      <PageHeader
        title={t("Notes")}
        description={t("Everything worth remembering, organized your way.")}
        actions={
          <Button size="sm" onClick={newNote}>
            <Plus /> {t("New note")}
          </Button>
        }
      />
      <div className="grid h-[calc(100dvh-13rem)] min-h-[480px] overflow-hidden rounded-xl border bg-card md:grid-cols-[300px_1fr]">
        <div className={cn("flex min-h-0 flex-col border-r", selected && "hidden md:flex")}>
          <div className="grid gap-2 border-b p-3">
            <div className="relative">
              <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("Search notes…")} className="h-8 pl-8 text-[13px]" aria-label={t("Search notes")} />
            </div>
            {(folders.length > 0 || tags.length > 0) && (
              <div className="flex flex-wrap gap-1">
                {folders.map((f) => (
                  <button key={f} onClick={() => setFolder(folder === f ? null : f)} className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px]", folder === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>
                    <Folder className="size-3" /> {f}
                  </button>
                ))}
                {tags.map((tg) => (
                  <button key={tg} onClick={() => setTag(tag === tg ? null : tg)} className={cn("rounded px-1.5 py-0.5 text-[11px]", tag === tg ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground hover:bg-accent/70")}>
                    #{tg}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-1.5 scrollbar-thin">
            {filtered.length === 0 && <p className="px-3 py-8 text-center text-[13px] text-muted-foreground">{notes.length ? t("No notes match.") : t("No notes yet.")}</p>}
            {filtered.map((n) => (
              <button
                key={n.id}
                onClick={() => select(n.id)}
                className={cn("block w-full rounded-lg px-3 py-2.5 text-left transition-colors", n.id === selectedId ? "bg-accent" : "hover:bg-muted/60")}
              >
                <p className="flex items-center gap-1.5 truncate text-[13px] font-medium">
                  {n.pinned && <Pin className="size-3 shrink-0 text-primary" />}
                  {n.title || t("Untitled")}
                </p>
                <p className="mt-0.5 line-clamp-2 text-[12px] text-muted-foreground">{n.content || t("Empty note")}</p>
                <p className="mt-1 flex items-center gap-2 text-[10.5px] text-muted-foreground/80">
                  {relativeDayLabel(new Date(n.updated_at))}
                  {n.folder && (
                    <span className="inline-flex items-center gap-0.5">
                      <Folder className="size-2.5" /> {n.folder}
                    </span>
                  )}
                </p>
              </button>
            ))}
          </div>
        </div>
        <div className={cn("min-h-0", !selected && "hidden md:block")}>
          {selected ? (
            <NoteEditor key={selected.id} note={selected} onDeleted={() => select(null)} onBack={() => select(null)} />
          ) : (
            <div className="flex h-full items-center justify-center p-6">
              <EmptyState
                icon={StickyNote}
                title={t("Select a note")}
                description={t('Or say "Remember that…" in Quick capture to save one with AI.')}
                action={
                  <Button size="sm" variant="outline" onClick={newNote}>
                    <Plus /> {t("New note")}
                  </Button>
                }
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function NotesPage() {
  return (
    <React.Suspense>
      <NotesInner />
    </React.Suspense>
  );
}
