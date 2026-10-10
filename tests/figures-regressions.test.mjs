import test from 'node:test';
import assert from 'node:assert/strict';
import {suggestFigures} from '../src/figures.js';

const run=(text,x,y,width=.1,height=.014)=>({id:`${text}-${x}-${y}`,text,bounds:{x,y,width,height}});
const page=(pdfPage,runs)=>({ref:{pdfPage,printedLabel:String(pdfPage)},runs});
const result=(text,heading='Concrete',pdfPage=1,question='')=>({question:{text:question},passages:[{text,heading,segments:[{page:{pdfPage}}]}]});
const cells=(y)=>[run('1',.15,y,.02),run('435',.4,y,.04),run('18.3',.8,y,.05)];

// A fixed above-caption crop would select prose and omit the final table row.
test('a table caption above its rows includes every row and excludes preceding and following prose',()=>{
  const session={pages:[page(1,[run('The preceding paragraph discusses the laboratory experiment.',.14,.2,.72),run('Table 12.27. Trial mix proportions',.2,.25,.6),run('Mix',.15,.29,.04),run('Cement',.4,.29,.08),run('Water',.8,.29,.06),...cells(.33),...cells(.39),...cells(.43),...cells(.47),...cells(.51),...cells(.55),...cells(.58),run('The following paragraph explains the resulting observations.',.14,.65,.72)])]};
  const [table]=suggestFigures(session,result('The proportions are shown in Table 12.27.'));
  assert.ok(table,'Referenced table must be available for review');
  assert.ok(table.bounds.y>=.24,'Crop must begin at the caption, below preceding prose');
  assert.ok(table.bounds.y+table.bounds.height>=.594,'Crop must include the final row');
  assert.ok(table.bounds.y+table.bounds.height<.65,'Crop must stop before following prose');
  assert.ok(table.bounds.x<=.15&&table.bounds.x+table.bounds.width>=.86,'Crop must cover the outer columns');
  assert.equal(table.confirmed,false);
});

// Matching only the number would mistakenly suggest Fig. 2.3 for Table 2.3.
test('explicit references distinguish figures from tables with the same number',()=>{
  const session={pages:[page(1,[run('Fig. 2.3. Concrete apparatus',.2,.2,.6),run('Table 2.3. Concrete measurements',.2,.5,.6),...cells(.55),...cells(.6)])]};
  const candidates=suggestFigures(session,result('Concrete values are given in Table 2.3.'));
  assert.equal(candidates.length,1);
  assert.match(candidates[0].caption,/^Table 2\.3/);
});

// A caption split into PDF text runs must not be lost or mistaken for cells.
test('caption detection joins split type, number, and title runs in reading order',()=>{
  const session={pages:[page(1,[run('Table',.15,.25,.06),run('12.27.',.22,.25,.07),run('Trial mix proportions',.3,.25,.4),...cells(.3),...cells(.34)])]};
  const candidates=suggestFigures(session,result('The table 12.27 gives the proportions.'));
  assert.equal(candidates.length,1);
  assert.equal(candidates[0].caption,'Table 12.27. Trial mix proportions');
});

// A sentence beginning with a reference is prose, not a caption.
test('inline reference sentences are not offered as figure or table captions',()=>{
  const session={pages:[page(1,[run('Fig. 2.3 shows the apparatus used in the test.',.14,.25,.72),run('Table 2.3 gives the measured values for each experiment.',.14,.3,.72),run('Fig. 6.19 of chapter six illustrates the relationship between the measured values.',.14,.35,.72),run('Fig. 12.26. The V-Funnel test is used to determine filling ability.',.14,.4,.72)])]};
  assert.deepEqual(suggestFigures(session,result('See Fig. 2.3, Fig. 6.19, Fig. 12.26 and Table 2.3.')),[]);
});

// A generic textbook word should not bring unrelated diagrams into an answer.
test('generic concrete vocabulary does not select unrelated nearby captions',()=>{
  const session={pages:[page(1,[run('Fig. 2.3. Concrete batching apparatus',.2,.5,.6),run('Table 2.4. Concrete mix proportions',.2,.7,.6),...cells(.75),...cells(.8)])]};
  assert.deepEqual(suggestFigures(session,result('Concrete is used for many kinds of construction.')),[]);
});

// A genuine reference may be in a different chapter, beyond the nearby pages.
test('an explicitly referenced table is found outside the two-page neighborhood',()=>{
  const session={pages:[page(1,[]),page(10,[run('Table 12.27. Trial mix proportions',.2,.25,.6),...cells(.3),...cells(.34)])]};
  const [table]=suggestFigures(session,result('See Table 12.27.'));
  assert.equal(table?.page.pdfPage,10);
});

// Figures can be wider than their centered caption, with prose just above them.
test('an above-caption figure covers outer labels without swallowing preceding prose',()=>{
  const session={pages:[page(1,[run('The paragraph describes how the equipment is assembled.',.14,.48,.72,.02),run('Hopper',.18,.6,.06),run('Handle',.79,.7,.06),run('Fig. 2.3. Vibration apparatus',.4,.8,.25)])]};
  const [figure]=suggestFigures(session,result('The apparatus is shown in Fig. 2.3.','Vibration'));
  assert.ok(figure.bounds.y>.5,'Preceding prose must remain outside the figure crop');
  assert.ok(figure.bounds.y<=.6&&figure.bounds.y+figure.bounds.height>=.814);
  assert.ok(figure.bounds.x<=.18&&figure.bounds.x+figure.bounds.width>=.85,'Centered caption width must not clip figure labels');
});

test('table captions below their rows still include the rows above',()=>{
  const session={pages:[page(1,[...cells(.3),...cells(.34),run('Table 2.3. Measured vibration values',.2,.38,.6),run('The following paragraph discusses the experiment results.',.14,.44,.72)])]};
  const [table]=suggestFigures(session,result('See Table 2.3.','Vibration'));
  assert.ok(table.bounds.y<=.3&&table.bounds.y+table.bounds.height>=.394);
  assert.ok(table.bounds.y+table.bounds.height<.44);
});

// Body text in the neighboring column must not hide or crop a right-column figure.
test('a figure caption sharing a baseline with another column stays separate from that prose',()=>{
  const session={pages:[page(1,[run('Hopper',.48,.35,.08),run('Handle',.78,.6,.07),run('The left column continues to describe the laboratory experiment.',.14,.6,.27),run('The same paragraph continues beside the figure on this page.',.14,.65,.27),run('The next sentence stays in the left hand column.',.14,.7,.27),run('The final sentence remains separate from the diagram caption.',.14,.75,.27),run('Fig. 2.3. Vibration apparatus',.48,.75,.35)])]};
  const [figure]=suggestFigures(session,result('See Fig. 2.3.','Vibration'));
  assert.ok(figure,'Caption must be detected independently from the adjacent column');
  assert.equal(figure.caption,'Fig. 2.3. Vibration apparatus');
  assert.ok(figure.bounds.y<=.35&&figure.bounds.x>.41,'Figure crop must preserve its upper labels and exclude the prose column');
});

test('plural figure references include every named figure',()=>{
  const session={pages:[page(1,[run('Fig. 2.3. Apparatus A',.2,.3,.6),run('Fig. 2.4. Apparatus B',.2,.7,.6)])]};
  assert.deepEqual(suggestFigures(session,result('See Figs. 2.3 and 2.4.')).map(f=>f.caption),['Fig. 2.3. Apparatus A','Fig. 2.4. Apparatus B']);
});

test('an explicit standalone number-only figure caption remains available for manual review',()=>{
  const session={pages:[page(1,[run('Handle',.2,.5,.08),run('Figure 2.3.',.2,.7,.1)])]};
  const [figure]=suggestFigures(session,result('See Figure 2.3.'));
  assert.equal(figure?.caption,'Figure 2.3.');
  assert.equal(figure?.confirmed,false);
  assert.ok(figure.bounds.y<=.5&&figure.bounds.y+figure.bounds.height>=.714);
});

test('a wrapped number-only inline reference is not mistaken for a standalone caption',()=>{
  const session={pages:[page(1,[run('The components are distributed as shown in',.15,.65,.4),run('Figure 2.3.',.2,.67,.1)])]};
  assert.deepEqual(suggestFigures(session,result('See Figure 2.3.')),[]);
});

test('a multiline table caption does not stop the crop before the table headers and rows',()=>{
  const session={pages:[page(1,[run('Table 6.1. Workability and compacting factor',.18,.25,.65),run('with 20 mm or 40 mm maximum aggregate size',.26,.267,.48),run('Mix',.15,.3,.04),run('Cement',.4,.3,.08),run('Water',.8,.3,.06),...cells(.34),...cells(.38)])]};
  const [table]=suggestFigures(session,result('See Table 6.1.'));
  assert.match(table.caption,/aggregate size$/);
  assert.ok(table.bounds.y+table.bounds.height>=.394,'Continuation must not be classified as following prose');
});

test('an explicit question reference can find a table even when no prose answer was retrieved',()=>{
  const session={pages:[page(8,[run('Table 12.27. Trial mix proportions',.2,.25,.6),...cells(.3),...cells(.34)])]};
  const candidates=suggestFigures(session,{question:{text:'Discuss Table 12.27.'},passages:[]});
  assert.equal(candidates.length,1);
  assert.equal(candidates[0].page.pdfPage,8);
  assert.equal(candidates[0].confirmed,false);
  assert.deepEqual(suggestFigures(session,{question:{text:'Explain concrete.'},passages:[]}),[]);
});

test('explicit question references take priority over other passage references and nearby topic captions',()=>{
  const session={pages:[page(1,[run('Fig. 2.4. Laboratory measurement apparatus',.2,.3,.6),run('Table 2.5. Laboratory measurement values',.2,.7,.6),...cells(.75),...cells(.8)]),page(8,[run('Table 12.27. Trial mix proportions',.2,.25,.6),...cells(.3),...cells(.34)])]};
  const query=result('The laboratory measurement apparatus is shown in Fig. 2.4.','Laboratory measurement',1,'Discuss Table 12.27.');
  const candidates=suggestFigures(session,query);
  assert.equal(candidates.length,1,'An explicitly named table must not inherit unrelated figures from retrieved prose');
  assert.equal(candidates[0].caption,'Table 12.27. Trial mix proportions');
  assert.equal(candidates[0].page.pdfPage,8);
});

test('descriptive two-column table headers do not truncate the rows underneath',()=>{
  const session={pages:[page(1,[run('Table 1.7. Heat of hydration',.36,.15,.28),run('Compound',.25,.18,.09),run('Heat of hydration at the given age (cal/g)',.5,.18,.31),run('3 days',.5,.2,.05),run('90 days',.62,.2,.06),run('13 years',.74,.2,.07),run('C3S',.26,.22,.035),run('58',.51,.22,.03),run('104',.63,.22,.03),run('122',.75,.22,.03),run('C2S',.26,.24,.035),run('12',.51,.24,.03),run('42',.63,.24,.03),run('59',.75,.24,.03),run('C4AF',.26,.28,.04),run('69',.51,.28,.03),run('98',.63,.28,.03),run('102',.75,.28,.03),run('Since hydration is additive, it can be predicted from an expression.',.2,.31,.63)])]};
  const [table]=suggestFigures(session,{question:{text:'Discuss Table 1.7.'},passages:[]});
  assert.ok(table.bounds.y+table.bounds.height>=.294,'Every data row must be included despite a sentence-like grouped header');
  assert.ok(table.bounds.y+table.bounds.height<.31,'Following prose must remain outside the table');
});

test('punctuation and sentence qualifiers cannot turn prose references into diagram captions',()=>{
  const session={pages:[page(1,[run('Fig. 1.7 represents the microscopic schematic model of the structure.',.14,.2,.7),run('Fig. 6.24, shows plastic shrinkage cracks due to quick drying.',.14,.25,.7),run('Figure 8.5 also shows the relationship between the measured values.',.14,.3,.7),run('Figure 8.19. The graph shows that shrinkage increases with time.',.14,.35,.7),run('Fig 2.8. The cement shall be considered as finally set when lowered.',.14,.4,.7),run('Fig. 11.13 (curve B), the required water-cement ratio is 0.423.',.14,.45,.7),run('Table 9.18) adopt the prescribed water to cement ratio.',.14,.5,.7),run('Table 5.5, Table 5.6 and 5.7 shows the specification limits.',.14,.55,.7)])]};
  const candidates=suggestFigures(session,{question:{text:'Discuss Figs. 1.7, 6.24, 8.5, 8.19, 2.8, 11.13 and Tables 9.18, 5.5.'},passages:[]});
  assert.deepEqual(candidates,[]);
});

test('adjacent prose ending near the middle of the page cannot truncate a right-hand figure',()=>{
  const session={pages:[page(1,[run('The preceding sentence describes the ring dimensions and sizes.',.16,.15,.32),run('Another equipment sentence remains beside the image in its column.',.16,.24,.32),run('The ring is formed by vertical bars fixed at equal spacing.',.16,.3,.32),run('Fig. 12.25.',.59,.33,.07),run('J-ring apparatus',.66,.33,.11)])]};
  const [figure]=suggestFigures(session,{question:{text:'Describe Fig. 12.25.'},passages:[]});
  assert.ok(figure.bounds.y<=.16,'The picture above the caption must not be reduced to a caption-height crop');
  assert.ok(figure.bounds.x>.48&&figure.bounds.x<=.5,'Crop must separate the real column boundary without cutting off the picture');
  assert.ok(figure.bounds.x+figure.bounds.width>=.84);
});

test('a full-width descriptive table header referencing that same table remains inside its crop',()=>{
  const session={pages:[page(1,[run('Table 12.22. Trial result',.3,.4,.44),run('Table 12.22 Shows the Trial Result against the reference values',.18,.425,.65),run('Method',.2,.45,.06),run('Property',.4,.45,.06),run('Trial result',.72,.45,.09),...cells(.48),...cells(.52),...cells(.56),run('The following paragraph explains the measured results at the site.',.16,.578,.68)])]};
  const [table]=suggestFigures(session,{question:{text:'Discuss Table 12.22.'},passages:[]});
  assert.ok(table.bounds.y+table.bounds.height>=.574,'Reference wording in a table header must not cut off its rows');
  assert.ok(table.bounds.y+table.bounds.height<.578,'Crop padding must not reach the adjacent paragraph');
});

test('centered table cells retain the surrounding reading-column width for its outer grid borders',()=>{
  const session={pages:[page(1,[run('Table 1.7. Hydration values',.36,.15,.28),run('Compound',.26,.18,.08),run('Heat at the given age (cal/g)',.5,.18,.31),run('C3S',.26,.22,.035),run('58',.51,.22,.03),run('104',.63,.22,.03),run('122',.75,.22,.03),run('C4AF',.26,.28,.04),run('69',.51,.28,.03),run('98',.63,.28,.03),run('102',.75,.28,.03),run('The following paragraph explains hydration at each measured age.',.16,.32,.68)])]};
  const [table]=suggestFigures(session,{question:{text:'Discuss Table 1.7.'},passages:[]});
  assert.ok(table.bounds.x<=.16,'Centered first-column cells must not determine the table edge');
  assert.ok(table.bounds.x+table.bounds.width>=.84,'Crop must cover the neighboring column extent');
  assert.ok(table.bounds.y+table.bounds.height<.32,'Extra border context must still stop before following prose');
});

test('surrounding context cannot widen a table crop into prose running beside it',()=>{
  const session={pages:[page(1,[run('The paragraph above both columns spans this complete width.',.16,.15,.68),run('Table 2.3. Values',.62,.3,.2),run('Mix',.55,.34,.04),run('Value',.75,.34,.05),run('1',.55,.38,.02),run('435',.75,.38,.04),run('2',.55,.42,.02),run('421',.75,.42,.04),run('The independent left column explains another laboratory experiment.',.16,.36,.3),run('The next left column sentence contains its own explanation.',.16,.4,.3)])]};
  const [table]=suggestFigures(session,{question:{text:'Discuss Table 2.3.'},passages:[]});
  assert.ok(table.bounds.x>.46,'Table context must stay outside the neighboring prose column');
  assert.ok(table.bounds.y+table.bounds.height>=.434);
});

test('a connected inline reference list split into PDF runs is not offered as a number-only table',()=>{
  const session={pages:[page(1,[run('Table 5.5,',.14,.3,.12),run('Table 5.6 and 5.7 shows the specification limits.',.27,.3,.56)])]};
  assert.deepEqual(suggestFigures(session,{question:{text:'Discuss Tables 5.5 and 5.6.'},passages:[]}),[]);
});

test('independent captions in separate columns sharing a baseline remain available',()=>{
  const session={pages:[page(1,[run('Table 5.5. First trial values',.14,.3,.24),run('Table 5.6. Second trial values',.55,.3,.26)])]};
  assert.deepEqual(suggestFigures(session,{question:{text:'Discuss Tables 5.5 and 5.6.'},passages:[]}).map(f=>f.caption),['Table 5.5. First trial values','Table 5.6. Second trial values']);
});
