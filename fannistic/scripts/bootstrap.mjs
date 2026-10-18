// Exécuté au démarrage (npm start) : crée le premier administrateur depuis
// ADMIN_EMAIL / ADMIN_PASSWORD s'il n'existe encore aucun compte administrateur.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
try {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const admins = await prisma.user.count({ where: { role: "ADMIN" } });
  if (admins > 0) {
    console.log("[bootstrap] administrateur existant : rien à faire.");
  } else if (!email || !password) {
    console.warn("[bootstrap] aucun administrateur. Définissez ADMIN_EMAIL et ADMIN_PASSWORD, ou lancez npm run admin:create.");
  } else if (password.length < 12) {
    console.warn("[bootstrap] ADMIN_PASSWORD doit contenir au moins 12 caractères : administrateur non créé.");
  } else {
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.upsert({
      where: { email },
      create: { email, name: "Administrateur", passwordHash, role: "ADMIN" },
      update: { role: "ADMIN", passwordHash },
    });
    console.log(`[bootstrap] administrateur créé : ${email}`);
  }
} catch (e) {
  console.error("[bootstrap] erreur :", e.message);
} finally {
  await prisma.$disconnect();
}
