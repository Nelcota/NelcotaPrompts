import { useEffect, useState } from "react";

// URL temporária (blob:) para mostrar um arquivo escolhido; liberada ao trocar ou desmontar.
export function useObjectUrl(file: Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (file === null) {
      setUrl(null);

      return;
    }

    const created = URL.createObjectURL(file);
    setUrl(created);

    return () => URL.revokeObjectURL(created);
  }, [file]);

  return url;
}
