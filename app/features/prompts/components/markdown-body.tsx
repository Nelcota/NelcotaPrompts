import type { Element, ElementContent, Root } from "hast";
import Markdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

import { variableMarkClass } from "~/shared/ui/styles";
import { splitVariables } from "../variables";

// Leitura do prompt em Markdown (react-markdown + GFM: tabelas, listas de tarefas, links).
// Não renderiza HTML cru e bloqueia links javascript:, então o texto não injeta marcação.
// A cópia continua usando o texto original.

// As {variáveis} são trocadas por marcadores neutros (caracteres de uso privado) ANTES do
// Markdown: assim um padrão com sintaxe ({site=https://x}, {x=**y**}, {cmd=`ls`}) não é
// quebrado em link, negrito ou código. Depois, o plugin (rehype) devolve o texto original
// dentro de <mark>, inclusive em blocos de código; num atributo (href) volta como texto.
const PLACEHOLDER = /\uE000(\d+)\uE001/g;

function protectVariables(text: string): { source: string; variables: string[] } {
  const variables: string[] = [];
  const source = splitVariables(text)
    .map((part) => {
      if (part.kind === "text") {
        return part.value;
      }

      variables.push(part.value);

      return `\uE000${variables.length - 1}\uE001`;
    })
    .join("");

  return { source, variables };
}

function rehypeVariables(variables: string[]) {
  const restore = (value: string) => value.replace(PLACEHOLDER, (_match, index: string) => variables[Number(index)] ?? "");

  const highlight = (node: Root | Element) => {
    // O Markdown codifica a URL (%EE%80%80…): decodifica antes de devolver a variável.
    if (node.type === "element" && typeof node.properties.href === "string" && node.properties.href.includes("%EE%80%80")) {
      try {
        node.properties.href = restore(decodeURI(node.properties.href));
      } catch {
        // URL malformada: fica como veio.
      }
    }

    node.children = node.children.flatMap((child): ElementContent[] => {
      if (child.type === "element") {
        highlight(child);

        return [child];
      }

      if (child.type !== "text") {
        return child.type === "doctype" ? [] : [child];
      }

      return child.value.split(PLACEHOLDER).map((part, index): ElementContent =>
        // split com grupo: posições ímpares são os índices das variáveis.
        index % 2 === 1
          ? { type: "element", tagName: "mark", properties: { className: variableMarkClass.split(" ") }, children: [{ type: "text", value: variables[Number(part)] ?? "" }] }
          : { type: "text", value: part },
      );
    });
  };

  return () => (tree: Root) => highlight(tree);
}

// Títulos do prompt viram texto com papel de título num nível abaixo do diálogo (h2),
// para não bagunçar a estrutura de títulos da página.
function heading(level: number, className: string): Components["h1"] {
  return ({ children }) => (
    <p role="heading" aria-level={Math.min(level + 2, 6)} className={`${className} pt-1 tracking-tight`}>
      {children}
    </p>
  );
}

function languageOf(node: Element | undefined): string | null {
  const code = node?.children[0];

  if (code?.type !== "element") {
    return null;
  }

  const className = code.properties.className;
  const classes = Array.isArray(className) ? className : [];
  const language = classes.map(String).find((name) => name.startsWith("language-"));

  return language === undefined ? null : language.slice("language-".length);
}

const COMPONENTS: Components = {
  h1: heading(1, "text-xl font-semibold"),
  h2: heading(2, "text-lg font-semibold"),
  h3: heading(3, "text-base font-semibold"),
  h4: heading(4, "text-base font-semibold"),
  h5: heading(5, "text-base font-semibold"),
  h6: heading(6, "text-base font-semibold"),
  ul: ({ children, className }) => (
    <ul className={className?.includes("contains-task-list") ? "space-y-1" : "list-disc space-y-1 pl-6 marker:text-muted"}>{children}</ul>
  ),
  ol: ({ children, start }) => (
    <ol start={start} className="list-decimal space-y-1 pl-6 marker:text-muted">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-1">{children}</li>,
  input: ({ checked }) => <input type="checkbox" checked={checked} disabled className="mr-1.5 align-middle accent-ink" />,
  blockquote: ({ children }) => <blockquote className="border-l-2 border-line pl-3 text-muted">{children}</blockquote>,
  hr: () => <hr className="border-line" />,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-4 hover:text-ink">
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b border-line px-2 py-1.5 font-semibold">{children}</th>,
  td: ({ children }) => <td className="border-b border-line/60 px-2 py-1.5 align-top">{children}</td>,
  // Bloco de código: moldura com a linguagem (```bash) e rolagem horizontal.
  pre: ({ children, node }) => {
    const language = languageOf(node);

    return (
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {language === null ? null : <div className="border-b border-line px-3 py-1 font-mono text-xs text-muted">{language}</div>}
        <pre className="overflow-x-auto p-3 font-mono text-[13.5px] leading-relaxed [&_code]:bg-transparent [&_code]:p-0">{children}</pre>
      </div>
    );
  },
  code: ({ children }) => <code className="rounded-md bg-ink/10 px-1.5 py-0.5 font-mono text-[0.9em]">{children}</code>,
};

export function MarkdownBody({ text }: { text: string }) {
  const { source, variables } = protectVariables(text);

  return (
    <div className="space-y-3 text-[15px] leading-relaxed [&_strong]:font-semibold">
      <Markdown remarkPlugins={[remarkGfm, remarkBreaks]} rehypePlugins={[rehypeVariables(variables)]} components={COMPONENTS}>
        {source}
      </Markdown>
    </div>
  );
}
