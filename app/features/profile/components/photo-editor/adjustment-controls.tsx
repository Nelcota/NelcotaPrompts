import { useId } from "react";

import { type Adjustments, PRESETS } from "~/features/profile/avatar-image";
import { labelClass } from "~/shared/ui/styles";
import { cn } from "~/shared/ui/cn";

const SLIDERS: { key: keyof Adjustments; label: string }[] = [
  { key: "brightness", label: "Brilho" },
  { key: "contrast", label: "Contraste" },
  { key: "saturation", label: "Saturação" },
  { key: "temperature", label: "Temperatura" },
];

function sameAdjustments(a: Adjustments, b: Adjustments): boolean {
  return SLIDERS.every(({ key }) => a[key] === b[key]);
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

// Um ajuste: rótulo ligado ao controle (htmlFor) e, fora do rótulo, o botão que volta a 0.
function AdjustmentSlider({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const id = useId();

  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <label htmlFor={id}>{label}</label>
        <button
          type="button"
          onClick={() => onChange(0)}
          title={`Voltar ${label.toLowerCase()} a 0`}
          aria-label={`${label}: ${signed(value)}. Voltar a 0`}
          disabled={value === 0}
          className="rounded px-1 font-mono text-xs text-muted tabular-nums transition hover:text-ink disabled:hover:text-muted"
        >
          {signed(value)}
        </button>
      </div>
      <input
        id={id}
        type="range"
        min={-100}
        max={100}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        onDoubleClick={() => onChange(0)}
        className="mt-1 w-full accent-ink"
      />
    </div>
  );
}

// Filtros prontos e os quatro ajustes de cor.
export function AdjustmentControls({ adjustments, onChange }: { adjustments: Adjustments; onChange: (adjustments: Adjustments) => void }) {
  const activePreset = PRESETS.find((preset) => sameAdjustments(preset.adjustments, adjustments))?.id ?? null;

  return (
    <>
      <p className={labelClass}>Filtros</p>
      <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto pb-1">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            aria-pressed={activePreset === preset.id}
            onClick={() => onChange(preset.adjustments)}
            className="shrink-0 rounded-full border border-line px-3 py-1 text-sm font-medium text-muted transition hover:text-ink aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-canvas"
          >
            {preset.label}
          </button>
        ))}
      </div>

      <p className={cn(labelClass, "mt-5")}>Ajustes</p>
      <div className="mt-2 space-y-3">
        {SLIDERS.map(({ key, label }) => (
          <AdjustmentSlider key={key} label={label} value={adjustments[key]} onChange={(value) => onChange({ ...adjustments, [key]: value })} />
        ))}
      </div>
      {activePreset === "original" ? null : <p className="mt-2 text-xs text-muted">Dica: clique duas vezes num controle para zerá-lo.</p>}
    </>
  );
}
