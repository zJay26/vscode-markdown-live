import * as vscode from 'vscode';
export async function run() {
  const folder=vscode.workspace.workspaceFolders![0].uri;
  const uri=vscode.Uri.joinPath(folder,'界面验证.md');
  const sample='# 安装后验证\n\n正文可以直接修改。\n\n## 研究记录\n\n一个公式 $E=mc^2$，以及脚注[^1]。\n\n| 实验 | 得分 |\n| --- | ---: |\n| A | 0.92 |\n\n```mermaid\nflowchart LR\n A[阅读] --> B[修改]\n```\n\n[^1]: 脚注内容。\n';
  await vscode.workspace.fs.writeFile(uri,new TextEncoder().encode(sample));
  await vscode.commands.executeCommand('vscode.openWith',uri,'markdownLive.editor');
  const signal=vscode.Uri.joinPath(folder,'ui-finish.signal');
  for(let i=0;i<240;i++){try{await vscode.workspace.fs.stat(signal);return;}catch{}await new Promise(resolve=>setTimeout(resolve,500));}
  throw new Error('UI harness timed out');
}
