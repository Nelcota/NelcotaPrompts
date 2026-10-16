// Baixa um texto como arquivo (ex.: o prompt em .md), sem passar pelo servidor.
export function downloadText(fileName: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.click();
  // Depois do clique o download já começou; a URL pode ser liberada no próximo ciclo.
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
