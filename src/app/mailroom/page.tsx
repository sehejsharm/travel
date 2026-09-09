import { MailroomForm } from "@/components/mailroom-form";
import { hasCredentials } from "@/lib/extract";

export const dynamic = "force-dynamic";

export default function Mailroom() {
  return (
    <div className="flex flex-col gap-6">
      <section>
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-accent-strong">
          Mailroom
        </p>
        <h1 className="mt-1.5 font-display text-3xl font-semibold">Drop anything in</h1>
        <p className="mt-1 max-w-prose text-sm text-ink-soft">
          A booking email, the text off a screenshot, a caption you saved. Pattern matching runs
          first because it is free and instant; the model is only paid for when that comes back
          under-confident.
        </p>
      </section>

      <MailroomForm escalationAvailable={hasCredentials()} />
    </div>
  );
}
