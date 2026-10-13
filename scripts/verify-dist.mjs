import {readdir,stat,readFile} from 'node:fs/promises';import path from 'node:path';
const root=path.resolve('dist');let files=0,bytes=0;
async function visit(dir){for(const name of await readdir(dir)){const file=path.join(dir,name),s=await stat(file);if(s.isDirectory()){await visit(file);continue;}const relative=path.relative(root,file).replaceAll('\\','/');if(!/^(index\.html|src\/|assets\/|vendor\/)/.test(relative)||/\.(pdf|zip|tar|env)$/i.test(relative)||/(?:book-session|evaluation|UserUpload|Shetty|credential|test-fixture)/i.test(relative))throw new Error(`Private or unexpected deployment file: ${relative}`);files++;bytes+=s.size;}}
await visit(root);for(const required of ['index.html','src/main.js','src/export.js','src/storage.js','vendor/pdfjs/pdf.worker.mjs','vendor/tesseract/worker.min.js','assets/NotoSans-Regular.ttf'])await stat(path.join(root,required));
const main=await readFile(path.join(root,'src/main.js'),'utf8'),urls=main.match(/https?:\/\/[^\s'"`<>]+/g)||[];
// The W3C SVG namespace identifies local SVG elements; it is not a network endpoint.
if(urls.some(url=>url!=='http://www.w3.org/2000/svg'))throw new Error('Unexpected remote application endpoint.');
console.log(`Distribution verified: ${files} app/dependency assets; ${(bytes/1024/1024).toFixed(1)} MB; no textbook or private evaluation data.`);
