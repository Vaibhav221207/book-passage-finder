import test from 'node:test';
import assert from 'node:assert/strict';
import {openBook} from '../src/book.js';
import {encryptedFixture} from './encrypted-fixture.mjs';

test('a failed password UI rejects the PDF load instead of hanging', {timeout:3000}, async()=>{
  const file={name:'encrypted-test.pdf',size:encryptedFixture.length,arrayBuffer:async()=>encryptedFixture.slice().buffer};
  await assert.rejects(openBook(file,{onPassword:()=>{throw new Error('Password entry unavailable');}}), /Password entry unavailable/);
});
