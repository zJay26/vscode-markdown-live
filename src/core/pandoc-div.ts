import type { Processor } from 'unified';
import type { BlockContent, Literal, Parent, Root } from 'mdast';
import type { Extension as FromMarkdownExtension } from 'mdast-util-from-markdown';
import type { Options as ToMarkdownExtension } from 'mdast-util-to-markdown';
import type { Extension, State, Tokenizer } from 'micromark-util-types';

export interface PandocDiv extends Parent {
  type: 'pandocDiv';
  children: BlockContent[];
  attributes: string;
  opening: string;
  closing: string;
}
interface DivFence extends Literal { type: 'pandocDivFence'; value: string; attributes: string | null }
declare module 'mdast' {
  interface BlockContentMap { pandocDiv: PandocDiv; pandocDivFence: DivFence }
  interface RootContentMap { pandocDiv: PandocDiv; pandocDivFence: DivFence }
}
declare module 'micromark-util-types' {
  interface TokenTypeMap { pandocDivFence: 'pandocDivFence' }
}

/** Validate attributes without interpreting them as HTML or executable CSS. */
function readAttributes(text: string): Record<string, string> | undefined {
  if (!text.startsWith('{')) return /^[\p{L}_][\p{L}\p{N}_-]*$/u.test(text) ? {} : undefined;
  if (!text.endsWith('}')) return;
  const attrs: Record<string, string> = Object.create(null);
  let rest = text.slice(1, -1).trim();
  while (rest) {
    const token = /^(?:[.#][^\s{}"'=]+|([\w:-]+)=(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|([^\s{}"']+)))(?=\s|$)/u.exec(rest);
    if (!token) return;
    if (token[1]) attrs[token[1]] = (token[2] ?? token[3] ?? token[4]).replace(/\\([\\"'])/g, '$1');
    rest = rest.slice(token[0].length).trimStart();
  }
  return attrs;
}

export function divStyle(attributes: string): string { return readAttributes(attributes)?.['custom-style'] ?? ''; }

function fence(text: string): { attributes: string | null } | undefined {
  const match = /^:{3,}(.*)$/.exec(text);
  if (!match) return;
  const tail = match[1].trim();
  if (!tail) return { attributes: null };
  // A decorative run of colons after the attributes is valid Pandoc syntax.
  const attributes = tail.replace(/\s*:+\s*$/, '').trimEnd();
  return readAttributes(attributes) ? { attributes } : undefined;
}

// Recognize fences at Markdown flow boundaries. Micromark handles code, HTML,
// frontmatter, blockquote/list prefixes and absolute source offsets for us.
const tokenizeFence: Tokenizer = function (effects, ok, nok) {
  const context = this;
  let token: ReturnType<typeof effects.enter>;
  const line: State = code => {
    if (code === null || code === -5 || code === -4 || code === -3) {
      effects.exit('pandocDivFence');
      return fence(context.sliceSerialize(token)) ? ok(code) : nok(code);
    }
    effects.consume(code);
    return line;
  };
  return code => { token = effects.enter('pandocDivFence'); return line(code); };
};

function literalFence(node: DivFence): BlockContent {
  return { type: 'paragraph', position: node.position, children: [{ type: 'text', value: node.value, position: node.position }] };
}

/** Pair fences only within the same Markdown parent; never consume broken input. */
function groupDivs(parent: Root | Parent) {
  for (const child of parent.children) if ('children' in child) groupDivs(child as Parent);
  if (!parent.children.some(child => child.type === 'pandocDivFence')) return;
  const result: BlockContent[] = [];
  const stack: { fence: DivFence; children: BlockContent[] }[] = [];
  const append = (node: BlockContent) => (stack.at(-1)?.children ?? result).push(node);
  for (const child of parent.children as BlockContent[]) {
    if (child.type !== 'pandocDivFence') { append(child); continue; }
    if (child.attributes !== null) { stack.push({ fence: child, children: [] }); continue; }
    const opened = stack.pop();
    if (!opened) { append(literalFence(child)); continue; }
    append({
      type: 'pandocDiv', attributes: opened.fence.attributes!,
      opening: opened.fence.value, closing: child.value, children: opened.children,
      position: { start: opened.fence.position!.start, end: child.position!.end },
    });
  }
  // Unclosed openings stay visible and editable, including their contents.
  while (stack.length) {
    const opened = stack.pop()!;
    append(literalFence(opened.fence));
    for (const child of opened.children) append(child);
  }
  parent.children = result;
}

export default function remarkPandocDiv(this: Processor) {
  const data = this.data();
  const syntax: Extension = { flow: { 58: { tokenize: tokenizeFence } } };
  const from: FromMarkdownExtension = {
    enter: { pandocDivFence(token) {
      const value = this.sliceSerialize(token);
      this.enter({ type: 'pandocDivFence', value, attributes: fence(value)!.attributes }, token);
    } },
    exit: { pandocDivFence(token) { this.exit(token); } },
    transforms: [tree => { groupDivs(tree); }],
  };
  const to: ToMarkdownExtension = {
    handlers: { pandocDiv(node: PandocDiv, _parent, state, info) {
      const tracker = state.createTracker(info);
      const opening = `${node.opening}\n`;
      tracker.move(opening);
      const body = state.containerFlow(node, tracker.current());
      return opening + body + (body ? '\n' : '') + node.closing;
    } },
    unsafe: [{ character: ':', atBreak: true, after: ':{2}' }],
  };
  (data.micromarkExtensions ??= []).push(syntax);
  (data.fromMarkdownExtensions ??= []).push(from);
  (data.toMarkdownExtensions ??= []).push(to);
}
