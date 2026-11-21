// Types côté client (réponses JSON de l'API ; les Decimal sont convertis en nombres).
export type Level = { id: string; name: string; cycle: string; order: number; _count?: { students: number } };
export type Subject = { id: string; name: string; description: string | null; color: string; defaultRate: number | null; defaultDuration: number; archived: boolean; levels?: Level[]; _count?: { students: number; sessions: number; chapters: number } };
export type Parent = { id: string; name: string; phone: string | null };
export type StudentLite = { id: string; firstName: string; lastName: string; color?: string | null; billingMode?: string; photo?: string | boolean | null };

export type Finance = {
  rate: number; billingMode: string; sessionsDone: number; sessionsBilled: number; sessionsPaid: number; billed: number; paymentsReceived: number;
  advancesReceived: number; discounts: number; refunded: number; paidOnInvoices: number; revenue: number; creditUsed: number; credit: number; due: number;
  oldestUnpaid?: string; alert?: "INSUFFICIENT" | "LOW" | null; sessionsCovered?: number;
};

export type Student = StudentLite & {
  phone: string | null; address: string | null; school: string | null; levelId: string | null; level: Level | null; parent: Parent | null; parentId: string | null;
  subjects: Subject[]; enrolledAt: string; courseType: string; rate: number; sessionDuration: number; sessionsPerWeek: number; billingMode: string;
  availability: string | null; notes: string | null; strengths: string | null; weaknesses: string | null; difficulties: string | null; goals: string | null;
  archived: boolean; isDemo: boolean; finance: Finance; nextSession?: string | null;
};

export type Participant = { studentId: string; price: number; absent: boolean; student: StudentLite };
export type Session = {
  id: string; title: string | null; subjectId: string | null; levelId: string | null; date: string; startTime: string; endTime: string; location: string | null;
  chapter: string | null; objectives: string | null; preparationNeeded: string | null; prepared: boolean; notes: string | null; report: string | null;
  status: "PLANNED" | "DONE" | "CANCELLED" | "POSTPONED" | "STUDENT_ABSENT" | "TEACHER_ABSENT"; lateAbsenceBillable: boolean; seriesId: string | null; postponedToId: string | null;
  participants: Participant[]; subject: Subject | null; level: Level | null; lessons: { lesson: { id: string; title: string; status: string } }[];
  invoices: { id: string; studentId: string; amount: number }[];
};

export type Invoice = { id: string; kind: string; sessionId: string | null; month: string | null; date: string; label: string; amount: number; voidedAt: string | null; voidReason: string | null; state: { paid: number; remaining: number; status: "PAID" | "PARTIAL" | "UNPAID" } | null };
export type Payment = { id: string; studentId: string; kind: "PAYMENT" | "ADVANCE" | "DISCOUNT"; date: string; amount: number; method: string; reason: string | null; reference: string | null; notes: string | null; receiptNo: string | null; voidedAt: string | null; voidReason: string | null; student?: StudentLite };
export type Refund = { id: string; date: string; amount: number; method: string; reason: string | null; voidedAt: string | null; voidReason: string | null };
export type Tx = { id: string; type: string; amount: number; date: string; description: string; dueAfter: number; creditAfter: number; createdAt: string; student?: StudentLite; paymentId: string | null; invoiceId: string | null };
export type Package = { id: string; name: string; amount: number; sessionsCount: number | null; startMonth: string; endMonth: string | null; active: boolean; notes: string | null };

export type Task = { id: string; title: string; description: string | null; category: string; priority: string; status: string; dueDate: string | null; time: string | null; duration: number | null; order: number; completedAt: string | null };
export type PersonalEvent = { id: string; title: string; kind: string; date: string; startTime: string; endTime: string; weeklyUntil: string | null; notes: string | null; occurrence?: string };
export type Chapter = { id: string; subjectId: string; levelId: string | null; title: string; order: number; subject: { id: string; name: string; color: string }; level: { id: string; name: string } | null; lessons: { id: string; title: string; status: string; _count: { exercises: number; sessions: number; documents: number } }[] };
export type Homework = { id: string; title: string; type: string; studentId: string | null; subjectId: string | null; levelId: string | null; lessonId: string | null; dueDate: string | null; status: string; grade: number | null; maxGrade: number | null; notes: string | null; student: StudentLite | null; subject: { id: string; name: string; color: string } | null; lesson: { id: string; title: string } | null };
export type DocumentRow = { id: string; name: string; type: string; mimeType: string | null; size: number | null; url: string | null; tags: string | null; createdAt: string; student?: StudentLite | null; subject?: { id: string; name: string; color: string } | null; level?: { id: string; name: string } | null; chapter?: { id: string; title: string } | null; lesson?: { id: string; title: string } | null };
export type Notification = { id: string; type: string; severity: "INFO" | "WARNING" | "DANGER"; title: string; body: string | null; href: string | null; readAt: string | null; createdAt: string };
