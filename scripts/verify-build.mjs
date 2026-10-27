import {readFile,writeFile,readdir,access} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),dist=resolve(root,'dist');
const pkg=JSON.parse(await readFile(resolve(root,'package.json'),'utf8')),lock=JSON.parse(await readFile(resolve(root,'package-lock.json'),'utf8')),html=await readFile(resolve(dist,'index.html'),'utf8');
if(lock.version!==pkg.version||lock.packages[''].version!==pkg.version)throw new Error('Las versiones de package.json y package-lock.json no coinciden.');
const label='v'+pkg.version.replace(/\.0$/,'');
if(!html.includes(`Render Pro ${label}</title>`)||!html.includes(`class="brand-version">${label}</b>`))throw new Error('La versión visible no corresponde al paquete.');
let modules=0;
for(const entry of await readdir(dist,{withFileTypes:true}))if(entry.isFile()&&entry.name.endsWith('.js')){
  const source=await readFile(resolve(dist,entry.name),'utf8');modules++;
  for(const match of source.matchAll(/(?:from\s*|import\s*)['"](\.\.?\/[^'"]+)['"]/g))await access(resolve(dist,match[1].split('?')[0]));
}
for(const match of html.matchAll(/(?:src|href)="(\.\/[^"?#]+)"/g))await access(resolve(dist,match[1]));
await writeFile(resolve(dist,'build-info.json'),JSON.stringify({version:pkg.version,format:'static-es-modules',modules,features:['aligned-comparison','mechanical-components','optional-stepped-shaft','exploded-view','canonical-stl','orthographic-view-selection','adaptive-mechanical-operation','companion-view-extrusion','proposed-transverse-holes','optional-raster-curve-smoothing','complete-source-sheet','companion-orthographic-render','source-context-isolation','source-faithful-exterior','material-selection','filter-independent-geometry','monochrome-dimension-separation','architectural-finish-palettes','source-plane-textures','volumetric-exterior-default','independent-exterior-depths','source-roof-family','observed-roof-elements','registered-source-geometry','source-view-camera','shared-source-face-boundaries']},null,2)+'\n');
console.log(`Prodalam Render Pro ${pkg.version}: entrega estática verificada (${modules} módulos).`);
