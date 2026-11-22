import { type ParsedLine, type ParseOptions, parse } from "sugar-high/core";
import { tokenize as tokenizeJavaScript } from "sugar-high/lang/javascript";
import * as markdown from "sugar-high/lang/markdown";
import * as plaintext from "sugar-high/lang/plaintext";
import * as svelte from "sugar-high/lang/svelte";
import * as typescript from "sugar-high/lang/typescript";
import * as vue from "sugar-high/lang/vue";

const javascript = {
  tokenize: (code: string) => tokenizeJavaScript(code, {}),
} satisfies ParseOptions;

const GRAMMARS = new Map(
  Object.entries({
    astro: typescript,
    cjs: javascript,
    js: javascript,
    jsx: javascript,
    mdx: markdown,
    mjs: javascript,
    svelte,
    ts: typescript,
    tsx: typescript,
    vue,
  } satisfies Record<string, ParseOptions>)
);

export function syntaxLines(code: string, path: string): readonly ParsedLine[] {
  const extension = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  return parse(code, GRAMMARS.get(extension) ?? plaintext).lines;
}
