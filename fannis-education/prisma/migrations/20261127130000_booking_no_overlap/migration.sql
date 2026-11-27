-- Empêche, au niveau de la base, deux réservations actives (en attente ou acceptées)
-- d'un même enseignant de se chevaucher, même en cas de requêtes concurrentes.
-- Les colonnes Prisma DateTime sont des "timestamp(3)" (UTC sans fuseau) : on utilise tsrange.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Booking"
  ADD CONSTRAINT "booking_no_overlap"
  EXCLUDE USING gist (
    "teacherId" WITH =,
    tsrange("startsAt", "endsAt", '[)') WITH &&
  )
  WHERE ("status" IN ('PENDING', 'ACCEPTED'));

ALTER TABLE "Booking" ADD CONSTRAINT "booking_time_order" CHECK ("endsAt" > "startsAt");
ALTER TABLE "Review" ADD CONSTRAINT "review_rating_range" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "TeacherAvailability" ADD CONSTRAINT "availability_range"
  CHECK ("dayOfWeek" BETWEEN 0 AND 6 AND "startMinute" >= 0 AND "endMinute" <= 1440 AND "endMinute" > "startMinute");
ALTER TABLE "SubscriptionPlan" ADD CONSTRAINT "plan_positive" CHECK ("priceMillimes" >= 0 AND "durationDays" > 0);
