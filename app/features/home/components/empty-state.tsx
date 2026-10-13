import { Mascot } from "~/shared/ui/mascot";

export function EmptyState({ filtered, onNewPrompt }: { filtered: boolean; onNewPrompt: () => void }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-6 py-16 text-center">
      <Mascot pose="standing" size={192} className="mb-4 size-24" />
      <p className="font-display text-2xl font-light">{filtered ? "Nenhum resultado." : "Nenhum prompt ainda."}</p>
      <p className="mt-2 text-base text-muted">{filtered ? "Mude a busca ou limpe os filtros." : "Crie o primeiro (atalho: N)."}</p>
      {filtered ? null : (
        <button
          type="button"
          onClick={onNewPrompt}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-base font-medium text-accent-ink"
        >
          Novo prompt
        </button>
      )}
    </div>
  );
}
