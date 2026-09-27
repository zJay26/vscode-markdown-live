import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkFrontmatter from 'remark-frontmatter';
import remarkPandocDiv from './pandoc-div';

export interface Ast { type: string; children?: Ast[]; value?: string; position?: { start: { offset: number }; end: { offset: number } }; _id?: string; [key: string]: any }
const processor = unified().use(remarkParse).use(remarkGfm).use(remarkMath).use(remarkFrontmatter, ['yaml', 'toml']).use(remarkPandocDiv).use(remarkStringify, { bullet: '-', fences: true, listItemIndent: 'one' });
export function parse(source: string): Ast { return processor.parse(source) as unknown as Ast; }
export function stringify(ast: Ast, options?: {bullet?: '-'|'+'|'*'}): string { return (options ? processor().use(remarkStringify,{bullet:'-',fences:true,listItemIndent:'one',...options}) : processor).stringify(ast as any).replace(/\n$/, ''); }
export function semantic(ast: Ast): string {
  return JSON.stringify(ast, (key, value) => ['position', '_id', 'data'].includes(key) ? undefined : value);
}
function meta(ast: Ast): string {
  const { children, value, ...rest } = ast; return semantic(rest as Ast);
}

/** Keep the source as the storage model. AST serialization is only a fallback for changed structures. */
export class SourceDocument {
  readonly ast: Ast;
  readonly originals = new Map<string, Ast>();
  readonly baselines = new Map<string, Ast>();
  readonly eol: string;
  constructor(readonly text: string) {
    this.eol = text.includes('\r\n') ? '\r\n' : '\n';
    this.ast = parse(text);
    let id = 0;
    const visit = (node: Ast) => { node._id = `n${id++}`; this.originals.set(node._id, node); node.children?.forEach(visit); };
    this.ast.children?.forEach(visit);
  }
  setBaseline(ast: Ast) {
    const visit = (n: Ast) => { if (n._id) this.baselines.set(n._id, n); n.children?.forEach(visit); };
    ast.children?.forEach(visit);
  }
  raw(ast: Ast): string { return this.text.slice(ast.position!.start.offset, ast.position!.end.offset); }
  render(next: Ast): string {
    const original = next._id && this.originals.get(next._id);
    const baseline = next._id && this.baselines.get(next._id);
    if (original && baseline) return baseline === next ? this.raw(original) : this.patch(original, baseline, next);
    return stringify(next).replace(/\n/g, this.eol);
  }
  private patch(original: Ast, before: Ast, after: Ast): string {
    if (semantic(before) === semantic(after)) return this.raw(original);
    if (meta(before) === meta(after)) {
      if (before.type === 'text' && this.raw(original) === original.value && typeof after.value === 'string') {
        // Text inside an existing inline context; escape characters that could become Markdown syntax.
        return after.value.replace(/([\\`*_\[\]<>])/g, '\\$1').replace(/^([ \t]*)([#>+-]|\d+[.)])(?=\s)/gm, '$1\\$2').replace(/\n/g, this.eol);
      }
      const a = original.children, b = before.children, c = after.children;
      if (a && b && c && a.length === b.length && b.length === c.length && b.every((n, i) => n.type === c[i].type) && a.every(n => n.position)) {
        let result = '', cursor = original.position!.start.offset;
        for (let i = 0; i < a.length; i++) {
          result += this.text.slice(cursor, a[i].position!.start.offset) + this.patch(a[i], b[i], c[i]);
          cursor = a[i].position!.end.offset;
        }
        return result + this.text.slice(cursor, original.position!.end.offset);
      }
    }
    // Structural changes: serialize this container, then reuse unchanged child source where context permits.
    const bullet = before.type === 'list' && !before.ordered ? /^\s*([-+*])\s/.exec(this.raw(original))?.[1] as '-'|'+'|'*'|undefined : undefined;
    let canonical = stringify(after, bullet ? {bullet} : undefined).replace(/\n/g, this.eol);
    // Reuse unchanged descendants inside a structurally changed container when the
    // serializer retained their nesting/indentation context (e.g. untouched list items).
    const parsed = parse(canonical).children?.[0];
    const replacements: { from: number; to: number; text: string }[] = [];
    const restore = (generated: Ast, actual: Ast) => {
      if (generated.type !== actual.type || !actual.position) return;
      const old = generated._id && this.originals.get(generated._id);
      const baseline = generated._id && this.baselines.get(generated._id);
      if (old && baseline && semantic(baseline) === semantic(generated)) {
        const oldColumn = old.position!.start.offset - this.text.lastIndexOf('\n', old.position!.start.offset - 1);
        const newColumn = actual.position.start.offset - canonical.lastIndexOf('\n', actual.position.start.offset - 1);
        if (oldColumn === newColumn || !this.raw(old).includes('\n')) {
          replacements.push({ from: actual.position.start.offset, to: actual.position.end.offset, text: this.raw(old) }); return;
        }
      }
      if (generated.children?.length === actual.children?.length) generated.children?.forEach((c,i) => restore(c, actual.children![i]));
    };
    if (parsed?.type === after.type && after.children?.length === parsed.children?.length) after.children?.forEach((n,i) => restore(n,parsed.children![i]));
    for (const edit of replacements.sort((a,b)=>b.from-a.from)) canonical = canonical.slice(0,edit.from)+edit.text+canonical.slice(edit.to);
    return canonical;
  }
  serialize(root: Ast): string {
    const old = this.ast.children ?? [], next = root.children ?? [];
    if (!old.length) return next.length && !(next.length === 1 && next[0].type === 'paragraph' && !next[0].children?.length) ? next.map(n => this.render(n)).join(this.eol + this.eol) + this.eol : this.text;
    if (old.length === next.length && old.every((n, i) => n._id === next[i]._id)) {
      let result = '', cursor = 0;
      for (const n of next) {
        const original = this.originals.get(n._id!)!;
        result += this.text.slice(cursor, original.position!.start.offset) + this.render(n);
        cursor = original.position!.end.offset;
      }
      return result + this.text.slice(cursor);
    }
    const oldIndices = new Map(old.map((node, index) => [node._id, index]));
    let result = this.text.slice(0, old[0].position!.start.offset);
    for (let i = 0; i < next.length; i++) {
      result += this.render(next[i]);
      const index = oldIndices.get(next[i]._id) ?? -1;
      if (i < next.length - 1) {
        result += index >= 0 && old[index + 1] && old[index + 1]._id === next[i + 1]._id
          ? this.text.slice(old[index].position!.end.offset, old[index + 1].position!.start.offset)
          : this.eol + this.eol;
      } else result += next[i]._id === old.at(-1)?._id ? this.text.slice(old.at(-1)!.position!.end.offset) : this.eol;
    }
    return result;
  }
}
