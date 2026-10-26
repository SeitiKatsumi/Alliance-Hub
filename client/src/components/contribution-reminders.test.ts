import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ContributionReminderFields} from './contribution-reminders';
import {defaultContributionReminders} from '@shared/contribution-reminders';
test('opção explícita e três prazos responsivos nos dois canais',()=>{
 const render=(enabled:boolean)=>renderToStaticMarkup(React.createElement(ContributionReminderFields,{value:{...defaultContributionReminders,enabled},onChange:()=>{}}));
 assert.match(render(false),/por e-mail e na plataforma/);assert.doesNotMatch(render(false),/1 mês antes/);
 for(const label of ['1 mês antes','1 semana antes','1 dia antes','flex-wrap'])assert.ok(render(true).includes(label));
});
