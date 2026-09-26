import * as vscode from 'vscode';
import * as assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export async function run() {
  const report: {name:string;passed:boolean;error?:string}[]=[];
  const folder = vscode.workspace.workspaceFolders?.[0]?.uri;
  if(!folder) throw new Error('Host tests require an isolated workspace');
  const extension = vscode.extensions.getExtension('markdown-live-local.markdown-live')!;
  const provider = await extension.activate();
  const uri=vscode.Uri.joinPath(folder,'宿主验证.md');
  const original='# 标题\r\n\r\n正文\r\n\r\n<!-- keep -->\r\n';
  await vscode.workspace.fs.writeFile(uri,new TextEncoder().encode(original));
  const doc=await vscode.workspace.openTextDocument(uri);
  const messages:any[]=[];
  // The protocol uses real VS Code TextDocuments and WorkspaceEdits; the transport
  // is captured here so failures are deterministic and inspectable.
  const panel={webview:{postMessage:(m:any)=>{messages.push(m);return Promise.resolve(true);}}};
  const session={document:doc,panels:new Set(),history:new Map([[doc.version,doc.getText()]]),queue:Promise.resolve()};
  async function check(name:string,fn:()=>Promise<void>){try{await fn();report.push({name,passed:true});}catch(e:any){report.push({name,passed:false,error:e.stack??e.message});}}
  await check('local edit preserves CRLF and comments',async()=>{
    await provider.handleMessage(session,panel,{type:'edit',id:'first',version:doc.version,edits:[{from:original.indexOf('正文')+2,to:original.indexOf('正文')+2,text:'修改'}]});
    assert.equal(doc.getText(),original.replace('正文','正文修改'));assert.equal(messages.at(-1).type,'ack');assert.equal(messages.at(-1).dirty,true);assert.equal(doc.isDirty,true);
  });
  await check('native undo redo shares document history',async()=>{
    await vscode.window.showTextDocument(doc);
    await vscode.commands.executeCommand('undo');assert.equal(doc.getText(),original);
    await vscode.commands.executeCommand('redo');assert.equal(doc.getText(),original.replace('正文','正文修改'));
  });
  await check('stale disjoint edit rebases; overlap keeps file untouched',async()=>{
    session.history.set(doc.version,doc.getText());const baseVersion=doc.version;
    const editor=await vscode.window.showTextDocument(doc);await editor.edit(e=>e.insert(new vscode.Position(0,2),'外部'));
    await provider.handleMessage(session,panel,{type:'edit',id:'rebase',version:baseVersion,edits:[{from:original.indexOf('正文'),to:original.indexOf('正文'),text:'本地'}]});
    assert.equal(messages.at(-1).type,'ack');assert.ok(doc.getText().includes('# 外部标题'));assert.ok(doc.getText().includes('本地正文'));
    const before=doc.getText();await provider.handleMessage(session,panel,{type:'edit',id:'conflict',version:baseVersion,edits:[{from:2,to:4,text:'重叠'}]});
    assert.equal(messages.at(-1).type,'conflict');assert.equal(doc.getText(),before);
  });
  await check('save persists exact UTF-8 file and confirms clean state',async()=>{await provider.handleMessage(session,panel,{type:'save'});assert.equal(doc.isDirty,false);assert.equal(new TextDecoder().decode(await vscode.workspace.fs.readFile(uri)),doc.getText());assert.deepEqual(messages.at(-1),{type:'saved',success:true,dirty:false});});
  await check('repeated save of a clean document reports success',async()=>{
    await provider.handleMessage(session,panel,{type:'save'});
    await provider.handleMessage(session,panel,{type:'save'});
    assert.deepEqual(messages.at(-1),{type:'saved',success:true,dirty:false});
    assert.equal(doc.isDirty,false);
  });
  await check('webview save converges with a concurrent native save',async()=>{
    const editor=await vscode.window.showTextDocument(doc);
    await editor.edit(e=>e.insert(doc.positionAt(doc.getText().length),'\r\n并发保存\r\n'));
    await Promise.all([doc.save(),provider.handleMessage(session,panel,{type:'save'})]);
    assert.deepEqual(messages.at(-1),{type:'saved',success:true,dirty:false});
    assert.equal(new TextDecoder().decode(await vscode.workspace.fs.readFile(uri)),doc.getText());
  });
  await check('image import writes bytes before returning relative path',async()=>{
    const bytes=Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6P6sAAAAASUVORK5CYII=','base64'));
    await provider.handleMessage(session,panel,{type:'image',id:'image',name:'截图.png',bytes});const response=messages.at(-1);assert.equal(response.type,'image');assert.ok(response.path?.startsWith('assets/宿主验证/'));assert.deepEqual(Array.from(await vscode.workspace.fs.readFile(vscode.Uri.joinPath(folder,response.path))),bytes);
  });
  await check('image failures do not change the document',async()=>{const before=doc.getText();await provider.handleMessage(session,panel,{type:'image',id:'bad',name:'bad.png',bytes:[]});assert.ok(messages.at(-1).error);assert.equal(doc.getText(),before);});
  await check('custom editor opens without changing file',async()=>{
    const before=doc.getText();await vscode.commands.executeCommand('vscode.openWith',uri,'markdownLive.editor');
    await new Promise(resolve=>setTimeout(resolve,2000));assert.equal(doc.getText(),before);assert.equal(doc.isDirty,false);
  });
  const data={vscode:vscode.version,remoteName:vscode.env.remoteName??null,platform:process.platform,report};
  await vscode.workspace.fs.writeFile(vscode.Uri.joinPath(folder,'host-report.json'),new TextEncoder().encode(JSON.stringify(data,null,2)));
  console.log(JSON.stringify(data,null,2));
  if(report.some(r=>!r.passed))throw new Error('Host integration tests failed');
}
