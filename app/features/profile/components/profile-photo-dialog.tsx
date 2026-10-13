import { ImagePlus, Trash } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { toast } from "sonner";

import { useFetcherResult } from "~/shared/hooks/use-fetcher-result";
import { usePhotoEdit } from "~/features/profile/hooks/use-photo-edit";
import { loadSource, renderAvatar } from "~/features/profile/avatar-image";
import type { ProfilePhotoResult } from "~/features/profile/avatar-rules";
import { Avatar } from "~/shared/ui/avatar";
import { Dialog } from "~/shared/ui/dialog";
import { PhotoEditor } from "./photo-editor";
import { buttonClass } from "~/shared/ui/styles";

type ProfilePhotoDialogProps = {
  open: boolean;
  name: string;
  currentUrl: string | null;
  onClose: () => void;
};

const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif,image/gif";

function extensionFor(type: string): string {
  if (type === "image/png") {
    return "png";
  }

  return "webp";
}

export function ProfilePhotoDialog({ open, name, currentUrl, onClose }: ProfilePhotoDialogProps) {
  const fetcher = useFetcher<ProfilePhotoResult>();
  const inputRef = useRef<HTMLInputElement>(null);
  const edit = usePhotoEdit();
  const [processing, setProcessing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const busy = processing || fetcher.state !== "idle";

  useFetcherResult(fetcher, {
    onSuccess: () => {
      edit.clear();
      onClose();
    },
  });

  // O diálogo pode fechar enquanto a foto é aberta: aí o resultado é descartado.
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  const handleFile = async (file: File | undefined) => {
    if (file === undefined || busy) {
      return;
    }

    setProcessing(true);
    const loaded = await loadSource(file);

    if (!mounted.current) {
      return;
    }

    setProcessing(false);

    if (!loaded.ok) {
      toast.error(loaded.message);

      return;
    }

    edit.load(loaded.source);
  };

  const save = async () => {
    if (edit.image === null || edit.crop === null) {
      return;
    }

    setProcessing(true);
    const blob = await renderAvatar(edit.image, edit.crop, edit.adjustments);
    setProcessing(false);

    if (blob === null) {
      toast.error("Não consegui preparar a foto. Tente outra imagem.");

      return;
    }

    const form = new FormData();
    form.append("intent", "upload");
    form.append("photo", blob, `avatar.${extensionFor(blob.type)}`);
    void fetcher.submit(form, { method: "post", action: "/perfil/foto", encType: "multipart/form-data" });
  };

  const remove = () => void fetcher.submit({ intent: "remove" }, { method: "post", action: "/perfil/foto" });

  // Enquanto envia, não fecha: o resultado (e o aviso) se perderia com o diálogo.
  const close = () => {
    if (fetcher.state !== "idle") {
      return;
    }

    edit.clear();
    onClose();
  };

  const chooseFile = () => inputRef.current?.click();

  return (
    <Dialog open={open} onClose={close} label="Foto de perfil">
      <h2 className="font-display text-3xl font-light tracking-tight">Foto de perfil</h2>
      <p className="mt-1 text-base text-muted">Aparece no menu e nos prompts que você publica.</p>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          void handleFile(event.currentTarget.files?.[0]);
          event.currentTarget.value = "";
        }}
      />

      {edit.image === null || edit.crop === null ? (
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(event) => {
            // Passar por cima dos elementos de dentro também dispara dragleave: só conta sair da área.
            if (!(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))) {
              setDragging(false);
            }
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void handleFile(event.dataTransfer.files[0]);
          }}
          data-dragging={dragging}
          className="mt-6 flex flex-col items-center gap-4 rounded-3xl border border-dashed border-line px-6 py-8 text-center transition data-[dragging=true]:border-ink/40 data-[dragging=true]:bg-ink/5"
        >
          <Avatar name={name} url={currentUrl} sizeClassName="size-32" fallbackClassName="bg-ink/10 text-4xl text-ink" />
          <p className="text-sm text-muted">
            {processing ? "Abrindo a foto…" : "Arraste uma imagem aqui ou escolha um arquivo. Depois você ajusta o enquadramento e as cores."}
          </p>
          <button type="button" disabled={busy} onClick={chooseFile} className={buttonClass("outline")}>
            <ImagePlus className="size-4" aria-hidden />
            Escolher foto
          </button>
        </div>
      ) : (
        <div className="mt-6">
          <PhotoEditor
            image={edit.image}
            version={edit.version}
            crop={edit.crop}
            adjustments={edit.adjustments}
            onCropChange={edit.setCrop}
            onAdjustmentsChange={edit.setAdjustments}
            onRotate={edit.rotate}
            onFlip={edit.flip}
            onReset={edit.reset}
          />
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        {edit.image !== null ? (
          <button type="button" disabled={busy} onClick={chooseFile} className={buttonClass("outline")}>
            <ImagePlus className="size-4" aria-hidden />
            Trocar foto
          </button>
        ) : currentUrl !== null ? (
          <button type="button" disabled={busy} onClick={remove} className={buttonClass("danger")}>
            <Trash className="size-4" aria-hidden />
            Remover foto
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button type="button" onClick={close} disabled={fetcher.state !== "idle"} className={buttonClass("ghost")}>
            Cancelar
          </button>
          <button type="button" disabled={edit.image === null || busy} onClick={() => void save()} className={buttonClass("primary")}>
            {busy && edit.image !== null ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
