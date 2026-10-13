import type { EmblaCarouselType } from "embla-carousel";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Mouse } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";

import type { Prompt } from "~/features/prompts/types";
import { PromptCard } from "./prompt-card";

type PromptCoverflowProps = {
  prompts: Prompt[];
  // Prompt do link direto (?p=): o slider já começa nele.
  initialId: string | null;
  onOpen: (prompt: Prompt) => void;
  onActiveChange: (prompt: Prompt | null) => void;
};

const MAX_OFFSET = 3;
const WHEEL_THRESHOLD = 30;
const WHEEL_IDLE_MS = 160;
const WHEEL_REPEAT_MS = 380;
const WHEEL_STRONG_DELTA = 50;
const LINE_HEIGHT_PX = 16;
const MIN_VISIBLE_RATIO = 0.8;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// Slides a mais de 3 posições do centro ficam invisíveis (opacidade ~0) e saem do cálculo.
const HIDE_OFFSET = 3;
// Só os slides próximos do selecionado renderizam a arte com filtro SVG (cara de pintar).
const ART_RADIUS = 4;

type TweenCache = {
  inners: (HTMLElement | null)[];
  hidden: boolean[];
};

function createTweenCache(api: EmblaCarouselType): TweenCache {
  const inners = api.slideNodes().map((slide) => slide.querySelector<HTMLElement>("[data-tween]"));

  // Lê o estado real do DOM: no reInit (lista mudou), o React reaproveita nós que podem ter
  // ficado escondidos; partir de "nada escondido" deixaria esses cards invisíveis.
  return { inners, hidden: inners.map((inner) => inner?.style.visibility === "hidden") };
}

// Sinal do deslocamento de loop de cada slide, calculado uma vez por quadro
// (seguindo o exemplo oficial de tween do Embla).
function loopSigns(api: EmblaCarouselType): Map<number, number> {
  const engine = api.internalEngine();
  const signs = new Map<number, number>();

  if (!engine.options.loop) {
    return signs;
  }

  for (const point of engine.slideLooper.loopPoints) {
    const target = point.target();

    if (target !== 0) {
      signs.set(point.index, Math.sign(target));
    }
  }

  return signs;
}

function diffToSnap(snap: number, progress: number, loopSign: number | undefined): number {
  if (loopSign === -1) {
    return snap - (1 + progress);
  }

  if (loopSign === 1) {
    return snap + (1 - progress);
  }

  return snap - progress;
}

// Com containScroll desligado, cada slide tem o próprio snap (1:1 com slideNodes).
// Efeito coverflow: cada slide gira, encolhe e recua conforme a distância do centro.
function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function applyTween(api: EmblaCarouselType, cache: TweenCache) {
  const reduced = prefersReducedMotion();
  const progress = api.scrollProgress();
  const snaps = api.scrollSnapList();
  const slides = api.slideNodes();
  const signs = loopSigns(api);
  const first = snaps[0];
  const second = snaps[1];
  const step = first !== undefined && second !== undefined ? second - first : 0;

  snaps.forEach((snap, index) => {
    const slide = slides[index];
    const inner = cache.inners[index];

    if (slide === undefined || inner === null || inner === undefined) {
      return;
    }

    const rawOffset = step === 0 ? 0 : diffToSnap(snap, progress, signs.get(index)) / step;

    if (Math.abs(rawOffset) >= HIDE_OFFSET) {
      if (cache.hidden[index] === true) {
        return;
      }

      cache.hidden[index] = true;
      inner.style.visibility = "hidden";
      inner.style.willChange = "auto";

      return;
    }

    if (cache.hidden[index] === true) {
      cache.hidden[index] = false;
      inner.style.visibility = "visible";
    }

    const offset = clamp(rawOffset, -MAX_OFFSET, MAX_OFFSET);
    const distance = Math.abs(offset);
    // Com "reduzir movimento" ligado no sistema: sem giro 3D e sem encolher, só desliza.
    const scale = reduced ? 1 : 1 - Math.min(distance, 2.2) * 0.12;
    const rotate = reduced ? 0 : clamp(offset, -2.2, 2.2) * 14;
    const shift = reduced ? 0 : -offset * 5;
    const opacity = 1 - Math.max(0, distance - 1.8) * 0.8;

    inner.style.willChange = "transform";
    inner.style.transform = `perspective(1400px) translateX(${shift}%) rotateY(${rotate}deg) scale(${scale})`;
    inner.style.opacity = String(clamp(opacity, 0, 1));
    slide.style.zIndex = String(100 - Math.round(distance * 10));
  });
}

// Distância em posições, considerando a volta do loop.
function circularDistance(a: number, b: number, total: number): number {
  const direct = Math.abs(a - b);

  return Math.min(direct, total - direct);
}

type SlideProps = {
  prompt: Prompt;
  index: number;
  total: number;
  active: boolean;
  near: boolean;
  onActivate: (index: number) => void;
};

// memo: ao trocar o selecionado, só os slides cujo active/near mudou re-renderizam.
const Slide = memo(function Slide({ prompt, index, total, active, near, onActivate }: SlideProps) {
  const handleOpen = useCallback(() => onActivate(index), [onActivate, index]);

  return (
    <div
      role="group"
      aria-roledescription="slide"
      aria-label={`${index + 1} de ${total}`}
      className="relative min-w-0 flex-[0_0_68%] sm:flex-[0_0_36%] md:flex-[0_0_28%] lg:flex-[0_0_24%] xl:flex-[0_0_21%] tiny:md:flex-[0_0_26%] tiny:lg:flex-[0_0_21%] tiny:xl:flex-[0_0_19%]"
    >
      <div data-tween className="mx-auto aspect-[3/4.2] max-h-[56dvh] tiny:max-h-[50dvh]">
        <PromptCard prompt={prompt} active={active} lite={!near} onOpen={handleOpen} />
      </div>
    </div>
  );
});

// Índice inicial: o prompt do link direto; sem ele, o primeiro (com loop há cards dos dois
// lados). Sem loop (poucos prompts) o efeito abaixo centraliza o do meio.
function initialIndex(prompts: Prompt[], initialId: string | null): number {
  if (initialId === null) {
    return 0;
  }

  const index = prompts.findIndex((prompt) => prompt.id === initialId);

  return index < 0 ? 0 : index;
}

export function PromptCoverflow({ prompts, initialId, onOpen, onActiveChange }: PromptCoverflowProps) {
  const [startIndex] = useState(() => initialIndex(prompts, initialId));
  const startedFromLink = useRef(initialId !== null && startIndex > 0);
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "center",
    loop: true,
    startIndex,
    containScroll: false,
    skipSnaps: false,
    duration: 30,
  });
  const [selected, setSelected] = useState(startIndex);
  const selectedRef = useRef(startIndex);
  const onOpenRef = useRef(onOpen);
  const promptsRef = useRef(prompts);

  useEffect(() => {
    onOpenRef.current = onOpen;
    promptsRef.current = prompts;
  }, [onOpen, prompts]);

  const handleSelect = useCallback((api: EmblaCarouselType) => {
    const index = api.selectedScrollSnap();
    selectedRef.current = index;
    setSelected(index);
  }, []);

  useEffect(() => {
    onActiveChange(prompts[selected] ?? null);
  }, [onActiveChange, prompts, selected]);

  useEffect(() => () => onActiveChange(null), [onActiveChange]);

  // Sem loop (poucos prompts) o primeiro card no centro deixaria a esquerda vazia:
  // centraliza o do meio ao abrir e quando a quantidade muda (prompt criado/apagado).
  // Não mexe quando veio de um link direto nem em revalidações que não mudam a lista.
  useEffect(() => {
    if (emblaApi === undefined) {
      return;
    }

    let count = emblaApi.slideNodes().length;

    const centerWithoutLoop = () => {
      if (emblaApi.internalEngine().options.loop) {
        return;
      }

      emblaApi.scrollTo(Math.floor((emblaApi.slideNodes().length - 1) / 2), true);
    };

    const handleReInit = () => {
      const next = emblaApi.slideNodes().length;

      if (next === count) {
        return;
      }

      count = next;
      centerWithoutLoop();
    };

    if (!startedFromLink.current) {
      centerWithoutLoop();
    }

    emblaApi.on("reInit", handleReInit);

    return () => {
      emblaApi.off("reInit", handleReInit);
    };
  }, [emblaApi]);

  // Estável entre renders, para o memo dos slides funcionar.
  const handleActivate = useCallback(
    (index: number) => {
      if (index !== selectedRef.current) {
        emblaApi?.scrollTo(index);

        return;
      }

      const prompt = promptsRef.current[index];

      if (prompt !== undefined) {
        onOpenRef.current(prompt);
      }
    },
    [emblaApi],
  );

  useEffect(() => {
    if (emblaApi === undefined) {
      return;
    }

    let cache = createTweenCache(emblaApi);
    const tween = () => applyTween(emblaApi, cache);
    // reInit (lista mudou): recoleta os nós e força reaplicar todos os estilos.
    const reInit = () => {
      cache = createTweenCache(emblaApi);
      tween();
    };

    tween();
    handleSelect(emblaApi);
    emblaApi.on("scroll", tween).on("slideFocus", tween).on("reInit", reInit);
    emblaApi.on("select", handleSelect).on("reInit", handleSelect);

    return () => {
      emblaApi.off("scroll", tween).off("slideFocus", tween).off("reInit", reInit);
      emblaApi.off("select", handleSelect).off("reInit", handleSelect);
    };
  }, [emblaApi, handleSelect]);

  useEffect(() => {
    if (emblaApi === undefined) {
      return;
    }

    const root = emblaApi.rootNode();
    const wheel = { accumulated: 0, locked: false, lockedAt: 0, idleTimer: 0 };

    // Cada "clique" da roda (ou gesto do trackpad) troca exatamente um prompt.
    // O bloqueio só cai quando a roda para, para o momentum do trackpad não pular vários.
    const handleWheel = (event: WheelEvent) => {
      const raw = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
      const delta = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? raw * LINE_HEIGHT_PX : raw;

      if (delta === 0 || Number.isNaN(delta)) {
        return;
      }

      // Se o carrossel está bem cortado (tela baixa), deixa a página rolar até ele primeiro.
      // Tolerância de 20%: a borda dele é espaçamento vazio, não precisa estar toda na tela.
      const rect = root.getBoundingClientRect();
      const visibleHeight = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);

      if (rect.height <= 0 || visibleHeight / rect.height < MIN_VISIBLE_RATIO) {
        return;
      }

      event.preventDefault();
      window.clearTimeout(wheel.idleTimer);
      wheel.idleTimer = window.setTimeout(() => {
        wheel.locked = false;
        wheel.accumulated = 0;
      }, WHEEL_IDLE_MS);

      const now = performance.now();
      const canRepeat = Math.abs(delta) >= WHEEL_STRONG_DELTA && now - wheel.lockedAt >= WHEEL_REPEAT_MS;

      if (wheel.locked && !canRepeat) {
        return;
      }

      wheel.accumulated += delta;

      if (Math.abs(wheel.accumulated) < WHEEL_THRESHOLD) {
        return;
      }

      const forward = wheel.accumulated > 0;
      wheel.accumulated = 0;
      wheel.locked = true;
      wheel.lockedAt = now;

      if (forward) {
        emblaApi.scrollNext();

        return;
      }

      emblaApi.scrollPrev();
    };

    root.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      root.removeEventListener("wheel", handleWheel);
      window.clearTimeout(wheel.idleTimer);
    };
  }, [emblaApi]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (emblaApi === undefined) {
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      emblaApi.scrollPrev();

      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      emblaApi.scrollNext();

      return;
    }

    if (event.key === "Enter" && event.target === event.currentTarget) {
      event.preventDefault();
      handleActivate(selectedRef.current);
    }
  };

  const total = prompts.length;
  const current = prompts[selected];

  return (
    <div className="relative w-full">
      <div
        ref={emblaRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        role="region"
        aria-roledescription="carrossel"
        aria-label="Prompts. Role a roda do mouse, arraste ou use as setas para navegar."
        className="overflow-hidden py-8 outline-none focus-visible:ring-2 focus-visible:ring-ink/40 tiny:py-3"
      >
        <div className="flex touch-pan-y touch-pinch-zoom">
          {prompts.map((prompt, index) => (
            <Slide
              key={prompt.id}
              prompt={prompt}
              index={index}
              total={total}
              active={index === selected}
              near={circularDistance(index, selected, total) <= ART_RADIUS}
              onActivate={handleActivate}
            />
          ))}
        </div>
      </div>

      {/* Fade nas bordas com gradientes por cima, em vez de mask-image (que recompõe tudo a cada quadro). */}
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 z-[110] w-[12%] bg-gradient-to-r from-canvas to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 z-[110] w-[12%] bg-gradient-to-l from-canvas to-transparent" />

      <div className="mx-auto mt-2 flex max-w-lg items-center justify-between gap-4 px-4 text-base text-muted tiny:mt-0">
        <button
          type="button"
          onClick={() => emblaApi?.scrollPrev()}
          aria-label="Prompt anterior"
          className="grid size-12 place-items-center rounded-full border border-line transition hover:bg-ink/5"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <div className="flex min-w-0 flex-col items-center gap-1 text-center">
          <span className="font-mono text-xl text-ink tabular-nums">
            {String(selected + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </span>
          <span className="hidden items-center gap-2 text-base sm:flex" aria-hidden>
            <Mouse className="size-4" />
            role para trocar · clique para abrir
          </span>
          <span className="sr-only" aria-live="polite">
            {current === undefined ? "" : `Selecionado: ${current.title}`}
          </span>
        </div>
        <button
          type="button"
          onClick={() => emblaApi?.scrollNext()}
          aria-label="Próximo prompt"
          className="grid size-12 place-items-center rounded-full border border-line transition hover:bg-ink/5"
        >
          <ChevronRight className="size-5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
