// Crée (ou promeut) un compte administrateur.
// Usage : npm run admin:create -- email@exemple.com "MotDePasseSolide" ["Nom"]
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const [email, password, name = "Administrateur"] = process.argv.slice(2);
if (!email || !password) {
  console.error('Usage : npm run admin:create -- email@exemple.com "MotDePasse" ["Nom"]');
  process.exit(1);
}
if (password.length < 12) {
  console.error("Le mot de passe administrateur doit contenir au moins 12 caractères.");
  process.exit(1);
}

const prisma = new PrismaClient();
const passwordHash = await bcrypt.hash(password, 12);
const user = await prisma.user.upsert({
  where: { email: email.toLowerCase() },
  create: { email: email.toLowerCase(), name, passwordHash, role: "ADMIN" },
  update: { passwordHash, role: "ADMIN", tokenVersion: { increment: 1 } },
});
console.log(`✔ Administrateur prêt : ${user.email}`);
await prisma.$disconnect();
