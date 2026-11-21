import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="font-display text-2xl font-semibold">Page introuvable</h1>
      <Link href="/" className="text-primary-strong hover:underline">Retour au tableau de bord</Link>
    </div>
  );
}
