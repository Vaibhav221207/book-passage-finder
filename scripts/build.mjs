import {cp,mkdir,rm,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd(),out=path.join(root,'dist');
if(path.dirname(out)!==root)throw new Error('Unsafe build directory');
await rm(out,{recursive:true,force:true});await mkdir(path.join(out,'vendor'),{recursive:true});
for(const item of ['index.html','src','assets']){try{await cp(path.join(root,item),path.join(out,item),{recursive:true});}catch(e){if(e.code!=='ENOENT')throw e;}}
const modules=path.join(root,'node_modules');
await mkdir(path.join(out,'vendor/pdfjs'),{recursive:true});
for(const item of ['pdf.mjs','pdf.worker.mjs'])await cp(path.join(modules,'pdfjs-dist/build',item),path.join(out,'vendor/pdfjs',item));
for(const item of ['cmaps','standard_fonts','wasm'])await cp(path.join(modules,'pdfjs-dist',item),path.join(out,'vendor/pdfjs',item),{recursive:true});
await cp(path.join(modules,'pdf-lib/dist/pdf-lib.min.js'),path.join(out,'vendor/pdf-lib.min.js'));
await cp(path.join(modules,'@pdf-lib/fontkit/dist/fontkit.umd.min.js'),path.join(out,'vendor/fontkit.umd.min.js'));
await mkdir(path.join(out,'vendor/gsap'),{recursive:true});
for(const name of ['gsap.min.js','ScrollTrigger.min.js'])await cp(path.join(modules,'gsap/dist',name),path.join(out,'vendor/gsap',name));
await mkdir(path.join(out,'vendor/licenses'),{recursive:true});
for(const pkg of ['pdfjs-dist','pdf-lib','@pdf-lib/fontkit','tesseract.js','tesseract.js-core']){const label=pkg.replaceAll('/','-').replaceAll('@','');for(const name of ['LICENSE','LICENSE.md','LICENSE.txt'])try{await cp(path.join(modules,pkg,name),path.join(out,'vendor/licenses',`${label}.txt`));break;}catch(e){if(e.code!=='ENOENT')throw e;}}
// GSAP ships its copyright and license URL in the distribution headers, not a LICENSE file.
const gsapSource=await readFile(path.join(modules,'gsap/dist/gsap.min.js'),'utf8');
await writeFile(path.join(out,'vendor/licenses/gsap.txt'),gsapSource.slice(0,gsapSource.indexOf('*/')+2)+'\n');
await cp(path.join(modules,'tesseract.js/dist'),path.join(out,'vendor/tesseract'),{recursive:true});
await cp(path.join(modules,'tesseract.js-core'),path.join(out,'vendor/tesseract-core'),{recursive:true,filter:s=>!s.endsWith('.md')});
console.log(`Static app built: ${out}`);
