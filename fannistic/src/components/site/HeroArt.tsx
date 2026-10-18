import { LogoMark } from "./Logo";

/** Composition graphique de la page d'accueil : interface web, typographie, supports de marque et pixels. */
export function HeroArt() {
  return (
    <div dir="ltr" aria-hidden="true" className="relative mx-auto aspect-[5/4] w-full max-w-[560px] select-none">
      <div className="pixel-grid absolute inset-0 overflow-hidden rounded-[2rem] bg-midnight shadow-pop">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-cyan/20 blur-3xl" />
        <div className="absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-gold/20 blur-3xl" />
      </div>

      {/* Fenêtre de navigateur */}
      <div className="absolute left-[7%] top-[9%] w-[60%] -rotate-2 rounded-xl bg-white p-2.5 shadow-pop animate-fade-up">
        <div className="flex items-center gap-1.5 pb-2">
          <span className="h-2 w-2 rounded-full bg-danger/70" />
          <span className="h-2 w-2 rounded-full bg-gold" />
          <span className="h-2 w-2 rounded-full bg-success/70" />
          <span className="ml-2 h-3 flex-1 rounded-full bg-paper-2" />
        </div>
        <div className="rounded-lg bg-paper-2 p-3">
          <div className="flex items-center justify-between">
            <LogoMark className="h-5 w-5" />
            <div className="flex gap-1.5">
              <span className="h-1.5 w-6 rounded-full bg-ink/20" />
              <span className="h-1.5 w-6 rounded-full bg-ink/20" />
              <span className="h-1.5 w-6 rounded-full bg-ink/20" />
            </div>
          </div>
          <div className="mt-4 h-3 w-4/5 rounded-full bg-midnight" />
          <div className="mt-2 h-3 w-3/5 rounded-full bg-midnight" />
          <div className="mt-3 h-1.5 w-11/12 rounded-full bg-ink/15" />
          <div className="mt-1.5 h-1.5 w-2/3 rounded-full bg-ink/15" />
          <div className="mt-3 flex gap-2">
            <span className="h-5 w-16 rounded-full bg-gold" />
            <span className="h-5 w-12 rounded-full border border-ink/20" />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <span className="h-10 rounded-md bg-cyan/30" />
            <span className="h-10 rounded-md bg-gold/30" />
            <span className="h-10 rounded-md bg-midnight/15" />
          </div>
        </div>
      </div>

      {/* Spécimen typographique */}
      <div className="absolute right-[6%] top-[14%] w-[30%] rotate-3 rounded-2xl bg-midnight-700 p-4 text-white shadow-pop ring-1 ring-white/10">
        <div className="text-4xl font-bold leading-none">Aa</div>
        <div className="mt-2 text-[10px] font-medium uppercase tracking-[0.2em] text-white/60">Poppins</div>
        <div className="mt-3 grid grid-cols-5 gap-1">
          <span className="aspect-square rounded bg-midnight ring-1 ring-white/20" />
          <span className="aspect-square rounded bg-gold" />
          <span className="aspect-square rounded bg-gold-sun" />
          <span className="aspect-square rounded bg-cyan" />
          <span className="aspect-square rounded bg-white" />
        </div>
      </div>

      {/* Icône d'application */}
      <div className="absolute bottom-[10%] left-[10%] flex h-[22%] w-[18%] items-center justify-center rounded-2xl bg-white shadow-pop animate-float">
        <LogoMark className="h-3/5 w-3/5" />
      </div>

      {/* Carte de visite */}
      <div className="absolute bottom-[9%] right-[8%] w-[46%] rotate-[5deg] rounded-xl bg-gold-sun p-4 shadow-pop">
        <div className="flex items-start justify-between">
          <LogoMark className="h-7 w-7" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-midnight/70">Studio</span>
        </div>
        <div className="mt-5 h-2.5 w-2/3 rounded-full bg-midnight" />
        <div className="mt-1.5 h-1.5 w-1/2 rounded-full bg-midnight/40" />
        <div className="mt-3 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-sm bg-midnight" />
          <span className="h-1.5 w-1/3 rounded-full bg-midnight/40" />
        </div>
      </div>

      {/* Pixels et étincelles */}
      <span className="absolute left-[46%] top-[6%] h-3 w-3 rounded-[3px] bg-gold animate-float" />
      <span className="absolute left-[70%] top-[52%] h-2.5 w-2.5 rounded-[3px] bg-cyan" />
      <span className="absolute left-[38%] bottom-[30%] h-2 w-2 rounded-[2px] bg-white/70" />
      <svg viewBox="0 0 24 24" className="absolute left-[64%] top-[4%] h-7 w-7 animate-twinkle text-cyan">
        <path fill="currentColor" d="M12 0c.8 6.2 2.8 8.2 9 9-6.2.8-8.2 2.8-9 9-.8-6.2-2.8-8.2-9-9 6.2-.8 8.2-2.8 9-9Z" />
      </svg>
    </div>
  );
}
