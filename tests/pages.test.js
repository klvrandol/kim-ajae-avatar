import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
test('Pages assets match original sources and initialize static mode under repository path',async()=>{
 for(const file of ['app.js','avatar.js','audio.js','style.css'])assert.equal(await readFile(new URL('docs/'+file,root),'utf8'),await readFile(new URL('public/'+file,root),'utf8'),file+' needs build:pages');
 const html=await readFile(new URL('docs/index.html',root),'utf8');assert.match(html,/window.KIM_AJAE_STATIC=true/);assert.match(html,/href="\.\/style.css"/);assert.match(html,/src="\.\/app\.js\?pose=slam-v2"/);assert.ok(!/\b(?:src|href)="\//.test(html),'asset paths must be relative');
 await readFile(new URL('docs/.nojekyll',root));
});
