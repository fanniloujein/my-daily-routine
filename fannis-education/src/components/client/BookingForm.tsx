"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createBookingAction, getSlotsAction } from "@/actions/student";
import { bookingRequestSchema, type BookingRequestInput } from "@/lib/validation/student";
import { Alert, Button, Field } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import { useErrorText, useI18n } from "@/lib/i18n/client";
import { applyServerErrors } from "./form";

type Slot = { startsAt: string; endsAt: string; modes: string[] };

export function BookingForm({
  teacherId,
  subjects,
  modes,
  minDate,
  maxDate,
}: {
  teacherId: string;
  subjects: { id: string; label: string }[];
  modes: { value: "ONLINE" | "IN_PERSON"; label: string; price: string }[];
  minDate: string;
  maxDate: string;
}) {
  const { t, locale } = useI18n();
  const err = useErrorText();
  const router = useRouter();
  const s = t.student;
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [loading, startLoading] = useTransition();
  const [formError, setFormError] = useState<string>();
  const [done, setDone] = useState(false);

  const { register, handleSubmit, setError, watch, setValue, formState } = useForm<BookingRequestInput>({
    resolver: zodResolver(bookingRequestSchema, undefined, { raw: true }),
    defaultValues: { teacherId, subjectId: subjects[0]?.id ?? "", mode: modes[0]?.value, date: minDate, startsAt: "" },
  });
  const date = watch("date");
  const mode = watch("mode");
  const startsAt = watch("startsAt");

  useEffect(() => {
    setValue("startsAt", "");
    if (!date) return;
    startLoading(async () => {
      const res = await getSlotsAction(teacherId, date);
      setSlots(res.ok ? res.data ?? [] : []);
    });
  }, [date, teacherId, setValue]);

  const visible = (slots ?? []).filter((sl) => sl.modes.includes(mode));
  const timeFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-TN-u-nu-latn" : "fr-FR", { timeZone: "Africa/Tunis", hour: "2-digit", minute: "2-digit" });
  const price = modes.find((m) => m.value === mode)?.price;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(undefined);
    const res = await createBookingAction(values);
    if (res.ok) {
      setDone(true);
      router.refresh();
      return;
    }
    if (res.error === "slotUnavailable") {
      const again = await getSlotsAction(teacherId, values.date);
      setSlots(again.ok ? again.data ?? [] : []);
      setValue("startsAt", "");
    }
    setFormError(applyServerErrors(res, setError));
  });

  if (done) return <Alert tone="green" title={s.bookSuccess} />;

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {formError && <Alert tone="red">{err(formError)}</Alert>}
      <Field label={s.bookSubject} htmlFor="subjectId" error={err(formState.errors.subjectId?.message)}>
        <select id="subjectId" className="input" {...register("subjectId")}>
          {subjects.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
        </select>
      </Field>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">{s.bookMode}</legend>
        <div className="grid grid-cols-2 gap-2">
          {modes.map((m) => (
            <label key={m.value} className={cn("cursor-pointer rounded-xl border px-3 py-2.5 text-sm", mode === m.value ? "border-brand-400 bg-brand-50" : "border-gray-200")}>
              <input type="radio" value={m.value} className="sr-only" {...register("mode")} />
              <span className="block font-medium">{m.label}</span>
              <span className="text-ink-muted">{m.price}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <Field label={s.bookDate} htmlFor="date" error={err(formState.errors.date?.message)}>
        <input id="date" type="date" min={minDate} max={maxDate} className="input" {...register("date")} />
      </Field>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">{s.bookSlot}</legend>
        {loading || slots === null ? (
          <p className="text-sm text-ink-muted">{s.bookLoadingSlots}</p>
        ) : visible.length === 0 ? (
          <p className="rounded-xl bg-surface p-3 text-sm text-ink-muted">{s.bookNoSlots}</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {visible.map((sl) => (
              <button
                type="button"
                key={sl.startsAt}
                onClick={() => setValue("startsAt", sl.startsAt, { shouldValidate: true })}
                aria-pressed={startsAt === sl.startsAt}
                className={cn("rounded-xl border px-2 py-2 text-sm font-medium transition", startsAt === sl.startsAt ? "border-brand-500 bg-brand-600 text-white" : "border-gray-200 hover:border-brand-300")}
              >
                <span dir="ltr">{timeFmt.format(new Date(sl.startsAt))}</span>
              </button>
            ))}
          </div>
        )}
        {formState.errors.startsAt && <p className="mt-1 text-xs text-red-600">{err(formState.errors.startsAt.message)}</p>}
      </fieldset>
      <Field label={`${s.bookNote} (${t.common.optional})`} htmlFor="note">
        <textarea id="note" rows={2} className="input" placeholder={s.bookNotePlaceholder} {...register("note")} />
      </Field>
      {startsAt && price && (
        <div className="rounded-xl bg-sun-50 p-3 text-sm">
          <p className="font-medium">{s.bookSummary}</p>
          <p className="text-ink-soft">{new Intl.DateTimeFormat(locale === "ar" ? "ar-TN-u-nu-latn" : "fr-FR", { timeZone: "Africa/Tunis", dateStyle: "full", timeStyle: "short" }).format(new Date(startsAt))}</p>
          <p className="text-ink-soft">{modes.find((m) => m.value === mode)?.label} · <strong className="text-ink">{price}</strong></p>
        </div>
      )}
      <p className="text-xs text-ink-muted">{s.bookPaymentNote}</p>
      <Button type="submit" className="w-full" disabled={formState.isSubmitting || !startsAt}>
        {formState.isSubmitting ? t.common.loading : s.bookSubmit}
      </Button>
    </form>
  );
}
