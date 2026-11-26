import { cn } from "@/lib/utils";

export function Logo({ className, withText = true }: { className?: string; withText?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="relative inline-flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-sand-500 to-sand-700 shadow-sm shadow-primary/30">
        <svg viewBox="0 0 24 24" className="size-4 text-white" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 4h5.5a7 7 0 0 1 0 14H6z" />
          <path d="M6 20v-2" />
          <circle cx="17.5" cy="5.5" r="1.4" fill="currentColor" stroke="none" />
        </svg>
      </span>
      {withText && <span className="text-[17px] font-semibold tracking-tight">DYBYSTA</span>}
    </span>
  );
}
