import type { Element, ElementContent, Root } from "hast";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import diff from "highlight.js/lib/languages/diff";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import python from "highlight.js/lib/languages/python";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";
import { createLowlight } from "lowlight";
import { Check, Copy } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

import { copyText } from "~/shared/lib/copy-text";
import { variableMarkClass } from "~/shared/ui/styles";
import { splitVariables } from "../variables";

// Leitura do prompt em Markdown (react-markdown + GFM: tabelas, listas de tarefas, links).
// Não renderiza HTML cru e bloqueia links javascript:, então o texto não injeta marcação.
// A cópia continua usando o texto original.

// As {variáveis} são trocadas por marcadores neutros (caracteres de uso privado) ANTES do
// Markdown: assim um padrão com sintaxe ({site=https://x}, {x=**y**}, {cmd=`ls`}) não é
// quebrado em link, negrito ou código. Depois, o plugin (rehype) devolve o texto original
// dentro de <mark>, inclusive em blocos de código; num atributo (href) volta como texto.
// O índice também vai como caractere de uso privado (não dígito): assim o realce de
// sintaxe não o confunde com um número e não parte o marcador em dois tokens.
const PLACEHOLDER = /\uE000([\uE100-\uF8FF])\uE001/g;
const INDEX_BASE = 0xe100;

function placeholder(index: number): string {
  return `\uE000${String.fromCharCode(INDEX_BASE + index)}\uE001`;
}

function indexOf(char: string): number {
  return char.charCodeAt(0) - INDEX_BASE;
}

function protectVariables(text: string): { source: string; variables: string[] } {
  const variables: string[] = [];
  const source = splitVariables(text)
    .map((part) => {
      if (part.kind === "text") {
        return part.value;
      }

      variables.push(part.value);

      return placeholder(variables.length - 1);
    })
    .join("");

  return { source, variables };
}

// Realce de sintaxe (lowlight) só com as linguagens mais comuns em prompts: o pacote
// "common" do highlight.js somava ~50 kB (gzip) à página inicial. Os apelidos (ts, js, sh,
// html…) vêm com cada linguagem; bloco sem linguagem ou com uma desconhecida fica sem cor.
// Roda antes de rehypeVariables: os marcadores das variáveis passam intactos pelo realce.
const lowlight = createLowlight({ bash, css, diff, javascript, json, markdown, python, sql, typescript, xml, yaml });

function rehypeHighlight() {
  const visit = (node: Root | Element) => {
    for (const child of node.children) {
      if (child.type !== "element") {
        continue;
      }

      const language = child.tagName === "pre" ? languageOf(child) : null;
      const code = child.children[0];

      if (language === null || code?.type !== "element" || !lowlight.registered(language)) {
        visit(child);
        continue;
      }

      code.children = lowlight.highlight(language, textOf(code)).children.filter((part): part is ElementContent => part.type !== "doctype");
    }
  };

  return (tree: Root) => visit(tree);
}

function rehypeVariables(variables: string[], markClass: string) {
  const restore = (value: string) => value.replace(PLACEHOLDER, (_match, index: string) => variables[indexOf(index)] ?? "");

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
          ? { type: "element", tagName: "mark", properties: { className: markClass.split(" ") }, children: [{ type: "text", value: variables[indexOf(part)] ?? "" }] }
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

// Texto do bloco como escrito (as {variáveis} já voltaram para dentro dos <mark>).
function textOf(node: Element | ElementContent | undefined): string {
  if (node === undefined) {
    return "";
  }

  if (node.type === "text") {
    return node.value;
  }

  if (node.type !== "element") {
    return "";
  }

  return node.children.map(textOf).join("");
}

const FEEDBACK_MS = 2000;

function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timer = window.setTimeout(() => setCopied(false), FEEDBACK_MS);

    return () => window.clearTimeout(timer);
  }, [copied]);

  const Icon = copied ? Check : Copy;

  return (
    <button
      type="button"
      onClick={() => void copyText(code.replace(/\n$/, ""), "Código copiado.").then(setCopied)}
      className="ml-auto flex items-center gap-1 rounded-md px-1.5 py-0.5 font-sans text-xs text-muted transition hover:bg-ink/5 hover:text-ink"
    >
      <Icon aria-hidden className="size-3.5" />
      {copied ? "Copiado" : "Copiar"}
    </button>
  );
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
  // Bloco de código: moldura com a linguagem (```bash), botão de copiar, realce de sintaxe
  // (cores em app.css) e rolagem horizontal.
  pre: ({ children, node }) => {
    const language = languageOf(node);

    return (
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <div className="flex items-center gap-2 border-b border-line py-1 pr-1.5 pl-3 font-mono text-xs text-muted">
          {language}
          <CopyCodeButton code={textOf(node?.children[0])} />
        </div>
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
      <Markdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[rehypeHighlight, rehypeVariables(variables, variableMarkClass)]}
        components={COMPONENTS}
      >
        {source}
      </Markdown>
    </div>
  );
}

// Prévia no card: o mesmo Markdown, mas tudo em linha (cabe no line-clamp). Blocos viram
// trechos separados por espaço, títulos ficam em negrito e links não são clicáveis (o card
// inteiro abre o prompt).
function inline({ children }: { children?: ReactNode }) {
  return <span>{children} </span>;
}

function bold({ children }: { children?: ReactNode }) {
  return <strong className="font-semibold text-white/90">{children} </strong>;
}

function passthrough({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

const PREVIEW_COMPONENTS: Components = {
  h1: bold,
  h2: bold,
  h3: bold,
  h4: bold,
  h5: bold,
  h6: bold,
  p: inline,
  li: inline,
  blockquote: inline,
  td: inline,
  th: inline,
  ul: passthrough,
  ol: passthrough,
  table: passthrough,
  thead: passthrough,
  tbody: passthrough,
  tr: passthrough,
  br: () => " ",
  hr: () => null,
  img: () => null,
  input: ({ checked }) => (checked === true ? "☑ " : "☐ "),
  a: passthrough,
  pre: ({ children }) => <span>{children} </span>,
  code: ({ children }) => <code className="rounded bg-white/15 px-1 text-white/85">{children}</code>,
};

const PREVIEW_MARK_CLASS = "rounded bg-amber-300/30 px-0.5 text-white";

export function MarkdownPreview({ text, className }: { text: string; className?: string }) {
  const { source, variables } = protectVariables(text);

  return (
    <div className={className}>
      <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeVariables(variables, PREVIEW_MARK_CLASS)]} components={PREVIEW_COMPONENTS}>
        {source}
      </Markdown>
    </div>
  );
}

// Títulos aceitam só `código` (o resto é texto puro).
export function InlineCodeText({ text, codeClassName }: { text: string; codeClassName: string }) {
  return (
    <>
      {text.split(/`([^`]+)`/).map((part, index) =>
        index % 2 === 1 ? (
          <code key={index} className={codeClassName}>
            {part}
          </code>
        ) : (
          part
        ),
      )}
    </>
  );
}
