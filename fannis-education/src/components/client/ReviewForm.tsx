"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Star } from "lucide-react";
import { reviewBookingAction } from "@/actions/student";
import { reviewSchema, type ReviewInput } from "@/lib/validation/student";
import { Alert, Button } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import { useErrorText, useI18n } from "@/lib/i18n/client";
import { useToast } from "./Toaster";

export function ReviewForm({ bookingId }: { bookingId: string }) {
  const { t } = useI18n();
  const err = useErrorText();
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setErr] = useState<string>();
  const { register, handleSubmit, watch, setValue, formState } = useForm<ReviewInput>({
    resolver: zodResolver(reviewSchema, undefined, { raw: true }),
    defaultValues: { bookingId, rating: 0, comment: "" },
  });
  const rating = Number(watch("rating"));
  if (!open) return <Button size="sm" variant="sun" onClick={() => setOpen(true)}>{t.student.reviewCta}</Button>;

  return (
    <form
      className="mt-3 w-full space-y-3 rounded-xl bg-surface p-3"
      onSubmit={handleSubmit(async (v) => {
        const res = await reviewBookingAction(v);
        if (res.ok) {
          toast(t.student.reviewThanks);
          router.refresh();
        } else setErr(res.error);
      })}
    >
      {error && <Alert tone="red">{err(error)}</Alert>}
      <div role="radiogroup" aria-label={t.student.reviewRating} className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n}/5`} onClick={() => setValue("rating", n, { shouldValidate: true })}>
            <Star className={cn("h-6 w-6", n <= rating ? "fill-sun-400 text-sun-400" : "text-gray-300")} />
          </button>
        ))}
      </div>
      {formState.errors.rating && <p className="text-xs text-red-600">{err("required")}</p>}
      <textarea rows={2} className="input" placeholder={t.student.reviewComment} {...register("comment")} />
      <Button type="submit" size="sm" disabled={formState.isSubmitting}>{t.student.reviewSubmit}</Button>
    </form>
  );
}
