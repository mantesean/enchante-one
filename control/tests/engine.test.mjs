import test from 'node:test';import assert from 'node:assert/strict';import {createTask,transition} from '../src/engine.mjs';
test('rejects vague intents',()=>assert.throws(()=>createTask('make app')));
test('cannot skip verification',()=>{const t=createTask('Build verifiable company onboarding');assert.throws(()=>transition(t,'released'));});
test('requires evidence and founder approval',()=>{let t=createTask('Build verifiable company onboarding');for(const s of ['specified','ready','running','verification'])t=transition(t,s);assert.throws(()=>transition(t,'review'));t=transition(t,'review',{evidence:'test report'});assert.throws(()=>transition(t,'approved'));t=transition(t,'approved',{actor:'founder'});assert.equal(transition(t,'released').state,'released');});
