import test from 'node:test';
import assert from 'node:assert/strict';
import {auraLookupState} from './aura-access';

test('lookup distinguishes consultation, eligible and already evaluated without granting permissions while loading',()=>{
 const input={user:{role:'membro',membro_directus_id:'self'} as any,targetMemberId:'target',linkedMemberIds:new Set(['target']),evaluatedMemberIds:new Set<string>(),ready:true};
 assert.equal(auraLookupState(input),'eligible');
 assert.equal(auraLookupState({...input,linkedMemberIds:new Set()}),'consult');
 assert.equal(auraLookupState({...input,evaluatedMemberIds:new Set(['target'])}),'evaluated');
 assert.equal(auraLookupState({...input,ready:false}),'checking');
 assert.equal(auraLookupState({...input,failed:true}),'unavailable');
 assert.equal(auraLookupState({...input,targetMemberId:'self'}),'consult');
 assert.equal(auraLookupState({...input,user:{role:'user',na_vitrine:true} as any}),'consult');
});
