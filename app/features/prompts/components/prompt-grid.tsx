import type { Prompt } from "~/features/prompts/types";
import { PromptCard } from "./prompt-card";

type PromptGridProps = {
  prompts: Prompt[];
  onOpen: (prompt: Prompt) => void;
};

export function PromptGrid({ prompts, onOpen }: PromptGridProps) {
  return (
    <ul className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-5 px-4 py-6 sm:grid-cols-2 sm:px-6 lg:grid-cols-3 xl:grid-cols-4">
      {prompts.map((prompt) => (
        <li key={prompt.id} className="aspect-[3/4] [contain-intrinsic-size:auto_360px] [content-visibility:auto]">
          <PromptCard prompt={prompt} active onOpen={onOpen} />
        </li>
      ))}
    </ul>
  );
}
