import { describe, it, expect } from 'vitest';
import { EditorState } from '@milkdown/kit/prose/state';
import { SourceDocument, parse } from '../src/core/markdown';
import { fromSource, schema, toAst } from '../src/core/schema';
import { applyEdits, minimalEdit, rebaseEdits } from '../src/shared/protocol';

const mixed = `---\ntitle: 研究记录\n---\n\n# 实验与结果\n\n正文包含 __粗体__、*斜体*、~~删除~~、\`code\`、$x^2$ 与 [参考][paper]。\n\n<!-- 不可丢失的注释 -->\n\n*   第一项\n*   第二项\n    * 嵌套内容\n\n- [x] 已完成\n- [ ] 待完成\n\n| 项目 | 结果 |\n| :--- | ---: |\n| A | 0.8 |\n\n\`\`\`python\nprint('hello')\n\`\`\`\n\n$$\n\\sum_{i=1}^n x_i\n$$\n\n\`\`\`mermaid\nflowchart LR\n A --> B\n\`\`\`\n\n研究内容[^note] 和 ![图片](assets/a.png "说明")。\n\n[^note]: 第一行脚注\n\n    第二段脚注。\n\n[paper]: https://example.org "论文"\n\n<section>原始 HTML</section>\n`;
function model(text: string) { const source = new SourceDocument(text), doc = fromSource(source); return { source, doc, state: EditorState.create({ schema, doc }) }; }
describe('lossless Markdown storage', () => {
  for (const text of [mixed, mixed.replace(/\n/g, '\r\n'), '', '\n\n', 'Plain without newline', '\uFEFF# BOM\r\n', 'a &amp; b\\*c\n', '[x][ref]\n\n[ref]: /x\n', '~~~js\ncode\n~~~\n']) {
    it(`opens without changes: ${JSON.stringify(text.slice(0,25))}`, () => { const { source, doc } = model(text); expect(source.serialize(toAst(doc))).toBe(text); });
  }
  it('preserves unrelated blocks and inline marker style', () => {
    const { source, state } = model(mixed); let position = -1;
    state.doc.descendants((n,p) => { if (n.isText && n.text === '粗体') position=p; });
    const tr = state.tr.replaceWith(position, position + 2, schema.text('新的粗体', [schema.marks.strong.create()]));
    const output = source.serialize(toAst(tr.doc)); expect(output).toBe(mixed.replace('__粗体__','__新的粗体__'));
  });
  it('preserves nested list formatting when editing a single item', () => {
    const text = '*   first\n*   second\n    * nested\n\nuntouched\n'; const { source, state } = model(text); let position=0;
    state.doc.descendants((n,p) => { if (n.isText && n.text === 'second') position=p; });
    const output = source.serialize(toAst(state.tr.insertText('!', position+6).doc)); expect(output).toBe(text.replace('second','second!'));
  });
  it('updates math without dropping unknown blocks or footnote definitions', () => {
    const { source,state } = model(mixed); let position=0; state.doc.descendants((n,p) => { if(n.type===schema.nodes.math_block) position=p; });
    const n=state.doc.nodeAt(position)!; const result=source.serialize(toAst(state.tr.setNodeMarkup(position,undefined,{...n.attrs,value:'x+y'}).doc));
    expect(result).toContain('x+y'); expect(result).toContain('[paper]: https://example.org "论文"'); expect(result).toContain('<!-- 不可丢失的注释 -->'); expect(parse(result).children!.some(n=>n.type==='footnoteDefinition')).toBe(true);
  });
  it('preserves CRLF in a changed paragraph',()=>{ const {source,state}=model('first\r\n\r\nsecond\r\n'); expect(source.serialize(toAst(state.tr.insertText('!',6).doc))).toBe('first!\r\n\r\nsecond\r\n'); });
  it('new structures remain parseable and retain surrounding raw blocks',()=>{const {source,state}=model('<!-- keep -->\n\ntext\n\n[ref]: /x\n');const tr=state.tr.insert(state.doc.content.size,schema.nodes.heading.create({level:2},schema.text('new')));const out=source.serialize(toAst(tr.doc));expect(out).toContain('<!-- keep -->');expect(out).toContain('[ref]: /x');expect(out).toContain('## new');});
  it('inserting a list item preserves existing markers without splitting the list',()=>{
    const {source,state}=model('*   first\n*   second\n');const list=state.doc.firstChild!;
    const item=schema.nodes.list_item.create(null,schema.nodes.paragraph.create(null,schema.text('third')));
    const output=source.serialize(toAst(state.tr.insert(list.nodeSize-1,item).doc));
    expect(output).toContain('*   first\n*   second');const ast=parse(output);expect(ast.children).toHaveLength(1);expect(ast.children![0].children).toHaveLength(3);
  });
});
describe('transaction protocol',()=>{
  it('minimal patch handles Unicode and CRLF',()=>{for(const [a,b] of [['a😀b','a😺b'],['a\r\nb','a\r\n猫b'],['','中文'],['abc','']])expect(applyEdits(a,minimalEdit(a,b))).toBe(b);});
  it('rejects malformed and overlapping edits',()=>{expect(()=>applyEdits('abcd',[{from:0,to:3,text:''},{from:2,to:4,text:''}])).toThrow();expect(()=>applyEdits('abc',[{from:0,to:9,text:''}])).toThrow();});
  it('rebases disjoint remote edits',()=>{expect(rebaseEdits([{from:6,to:11,text:'world'}],[{from:0,to:5,text:'Hello!'}])).toEqual([{from:7,to:12,text:'world'}]);});
  it('detects overlapping changes and coincident insertions',()=>{expect(rebaseEdits([{from:2,to:4,text:'x'}],[{from:3,to:5,text:'y'}])).toBeNull();expect(rebaseEdits([{from:2,to:2,text:'x'}],[{from:2,to:2,text:'y'}])).toBeNull();});
});
