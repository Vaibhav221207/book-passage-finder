import test from 'node:test';
import assert from 'node:assert/strict';
const studio=await import('../src/studio.js').catch(()=>({}));

test('question bookmarks navigate by arrows and Home/End without losing long assignment positions',()=>{
  assert.equal(typeof studio.questionDestination,'function');
  assert.equal(studio.questionDestination(99,98,'ArrowRight'),0);
  assert.equal(studio.questionDestination(99,0,'ArrowLeft'),98);
  assert.equal(studio.questionDestination(99,49,'Home'),0);
  assert.equal(studio.questionDestination(99,49,'End'),98);
  assert.equal(studio.questionDestination(99,49,'ArrowRight'),50);
  assert.equal(studio.questionDestination(1,0,'ArrowLeft'),0);
  assert.equal(studio.questionDestination(0,0,'End'),null);
  assert.equal(studio.questionDestination(3,0,'Tab'),null);
});

test('book drops accept PDF files and preserve order while rejecting images and non-file drops',()=>{
  assert.equal(typeof studio.droppedBooks,'function');
  const pdf={name:'Concrete.PDF',type:''},mime={name:'notes',type:'application/pdf'},image={name:'photo.png',type:'image/png'},text={name:'notes.txt',type:'text/plain'};
  assert.deepEqual(studio.droppedBooks([image,pdf,text,mime]),[pdf,mime]);
  assert.deepEqual(studio.droppedBooks(undefined),[]);
  assert.deepEqual(studio.droppedBooks(['https://example.com/book.pdf',{},null]),[]);
});

test('vertical question navigation follows the displayed list and wraps at both ends',()=>{
  assert.equal(studio.questionDestination(99,49,'ArrowDown'),50);
  assert.equal(studio.questionDestination(99,49,'ArrowUp'),48);
  assert.equal(studio.questionDestination(99,98,'ArrowDown'),0);
  assert.equal(studio.questionDestination(99,0,'ArrowUp'),98);
});
