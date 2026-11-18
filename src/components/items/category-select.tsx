"use client";
import { useT } from "@/lib/i18n/provider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useData } from "@/lib/data/store";
import { cn } from "@/lib/utils";
import { CATEGORY_COLORS } from "./meta";

const NONE = "__none__";

export function CategorySelect({ value, onChange, size, className, allLabel }: { value: string | null; onChange: (id: string | null) => void; size?: "sm" | "default"; className?: string; allLabel?: string }) {
  const { categories } = useData();
  const { t } = useT();
  return (
    <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : v)}>
      <SelectTrigger size={size} className={className}>
        <SelectValue placeholder={t("Category")} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{allLabel ?? t("No category")}</SelectItem>
        {categories.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            <span className="flex items-center gap-2">
              <span className={cn("size-2 rounded-full", CATEGORY_COLORS[c.color] ?? "bg-slate-400")} />
              {c.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
