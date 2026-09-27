import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
export async function writeNotices() {
  const lock=JSON.parse(await readFile('package-lock.json','utf8'));
  let output='Markdown Live · by zJay — third-party notices\n\nIncludes production dependencies; not every module is included in every bundle.\n\n';
  for (const [path,entry] of Object.entries(lock.packages)) {
    if(!path||entry.dev)continue;
    try {
      const pkg=JSON.parse(await readFile(join(path,'package.json'),'utf8'));
      output+=`\n${'='.repeat(72)}\n${pkg.name} ${pkg.version}\nLicense: ${typeof pkg.license==='string'?pkg.license:JSON.stringify(pkg.license??'See source package')}\n`;
      for(const file of await readdir(path)) if(/^(licen[sc]e|copying|notice)(\.|$|-)/i.test(file)) { try{output+=`\n${await readFile(join(path,file),'utf8')}\n`;}catch{} }
    }catch{}
  }
  await writeFile('dist/THIRD_PARTY_NOTICES.txt',output);
}
