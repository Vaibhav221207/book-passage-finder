import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument, StandardFonts} from 'pdf-lib';
import {parseQuestions, readAssignment} from '../src/questions.js';

const questionTexts = questions => questions.map(question => question.text);

async function assignmentPdf(pages) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const [index, lines] of pages.entries()) {
    const page = pdf.addPage([600, 800]);
    lines.forEach((text, line) => page.drawText(text, {
      x: 40, y: 750 - line * 22, size: 12, font,
    }));
    page.drawText(`Page ${index + 1} of ${pages.length}`, {
      x: 40, y: 24, size: 10, font,
    });
  }
  return new File([await pdf.save()], 'synthetic-assignment.pdf', {
    type: 'application/pdf',
  });
}

test('a numbered assignment title from imported text is not an assignment question', () => {
  const text = [
    '1. Assignment / Tutorial No: -1',
    'General',
    '2. Write a short note on the early history of modern cement.',
    '3. What are the basic components of concrete?',
  ].join('\n');
  assert.deepEqual(questionTexts(parseQuestions(text)), [
    'Write a short note on the early history of modern cement.',
    'What are the basic components of concrete?',
  ]);
});

test('a two-page text PDF removes assignment metadata and repeated headers while preserving questions and subparts', async () => {
  const file = await assignmentPdf([
    [
      'Assignment / Tutorial No: -1',
      'Course: Concrete Technology',
      'Course code: BE03006021',
      'General',
      '1. Write a short note on the early history',
      'of modern cement.',
      '2. Discuss methods of measuring workability.',
      '(a) Explain the slump test.',
      '(b) Explain the Vee-Bee test with a diagram.',
    ],
    [
      'Assignment / Tutorial No: -1',
      'Course: Concrete Technology',
      'Section B',
      '3. Define segregation',
      'and describe its causes.',
    ],
  ]);
  assert.deepEqual(questionTexts(await readAssignment(file)), [
    'Write a short note on the early history\nof modern cement.',
    'Discuss methods of measuring workability.\n(a) Explain the slump test.\n(b) Explain the Vee-Bee test with a diagram.',
    'Define segregation\nand describe its causes.',
  ]);
});

test('section headings between numbered groups do not become part of the preceding question', () => {
  assert.deepEqual(questionTexts(parseQuestions([
    'General',
    '1) What are the basic components of concrete?',
    'Section B: Short answers',
    '2) Explain the purpose of curing.',
    'Discuss its effect on hydration.',
  ].join('\n'))), [
    'What are the basic components of concrete?',
    'Explain the purpose of curing.\nDiscuss its effect on hydration.',
  ]);
});

test('assignment title and course metadata without any prompts produce no questions', () => {
  assert.deepEqual(parseQuestions([
    'Assignment / Tutorial No: -1',
    'Course: Concrete Technology',
    'Course code: BE03006021',
    'General',
    'Page 1 of 1',
  ].join('\n')), []);
});

test('real numbered questions beginning with General or Assignment wording are preserved', () => {
  assert.deepEqual(questionTexts(parseQuestions([
    '1. General principles of concrete mix design: explain the main steps.',
    '2. Assignment of exposure classes: discuss the relevant factors.',
  ].join('\n'))), [
    'General principles of concrete mix design: explain the main steps.',
    'Assignment of exposure classes: discuss the relevant factors.',
  ]);
});

test('separate unnumbered prompts are detected while a wrapped continuation stays with its prompt', () => {
  assert.deepEqual(questionTexts(parseQuestions([
    'Assignment / Tutorial No: -1',
    'General',
    'What are the basic components of concrete?',
    'Write a short note on the early history',
    'of modern cement.',
  ].join('\n'))), [
    'What are the basic components of concrete?',
    'Write a short note on the early history\nof modern cement.',
  ]);
});

test('numbered questions on one extracted line split without treating decimal readings as labels', () => {
  assert.deepEqual(questionTexts(parseQuestions(
    '1. Explain slump readings of 0.5 mm and 1.25 mm. 2. Define segregation.',
  )), [
    'Explain slump readings of 0.5 mm and 1.25 mm.',
    'Define segregation.',
  ]);
});

test('OCR question numbers without punctuation still identify clear numbered prompts', () => {
  assert.deepEqual(questionTexts(parseQuestions([
    'Assignment / Tutorial No: -1',
    'General',
    '1 Explain the slump test.',
    '2 Define segregation.',
  ].join('\n'))), [
    'Explain the slump test.',
    'Define segregation.',
  ]);
});

test('an unnumbered Enlist prompt is retained after assignment headings', () => {
  assert.deepEqual(questionTexts(parseQuestions([
    'Assignment / Tutorial No: -1',
    'General',
    'Enlist the compounds of cement.',
    'State their roles in hydration.',
  ].join('\n'))), [
    'Enlist the compounds of cement.',
    'State their roles in hydration.',
  ]);
});

test('a repeated subject header after an extracted PDF page break is removed', () => {
  assert.deepEqual(questionTexts(parseQuestions([
    'Concrete Technology',
    '1. Explain the slump test.',
    'Page 1 of 2',
    '\f',
    'Concrete Technology',
    '2. Define segregation.',
    'Page 2 of 2',
  ].join('\n'))), [
    'Explain the slump test.',
    'Define segregation.',
  ]);
});

test('a real wrapped continuation across a PDF page break survives repeated-header removal', () => {
  assert.deepEqual(questionTexts(parseQuestions([
    'Concrete Technology',
    '1. Explain the slump test',
    'Page 1 of 2',
    '\f',
    'Concrete Technology',
    'and describe the procedure with a neat diagram.',
    '2. Define segregation.',
    'Page 2 of 2',
  ].join('\n'))), [
    'Explain the slump test\nand describe the procedure with a neat diagram.',
    'Define segregation.',
  ]);
});

test('a numbered chapter reference containing an explicit prompt is not a section heading', () => {
  assert.deepEqual(questionTexts(parseQuestions([
    '1. Chapter 3: Explain the methods of measuring workability.',
    '2. Define segregation.',
  ].join('\n'))), [
    'Chapter 3: Explain the methods of measuring workability.',
    'Define segregation.',
  ]);
});

test('a repeated assignment label still separates a new topic from the previous question', () => {
  assert.deepEqual(questionTexts(parseQuestions('Assignment / Tutorial No: -1\nGeneral\n1. Define concrete.\n\f\nAssignment / Tutorial No: -1\nFresh Concrete\n2. Explain workability.')), [
    'Define concrete.', 'Explain workability.',
  ]);
});

test('words with different heights on the same assignment baseline retain their reading order', async () => {
  const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),page=pdf.addPage([600,800]);
  for(const [text,x,size] of [['1. What',40,20],['are the',135,12],['basic components',190,20],['of concrete?',370,12]])page.drawText(text,{x,y:700,size,font});
  const file=new File([await pdf.save()],'mixed-word-heights.pdf',{type:'application/pdf'});
  assert.deepEqual(questionTexts(await readAssignment(file)),['What are the basic components of concrete?']);
});
