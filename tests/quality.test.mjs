import test from 'node:test';
import assert from 'node:assert/strict';
const fresh = () => ({sources:[], processes:[], gaps:[], owners:[], aiTests:[], tasks:[], verificationConfirmed:false});
import {getStageChecks} from '../src/quality.ts';

test('all five stages remain incomplete for a new empty project', () => {
  assert.deepEqual(getStageChecks(fresh()), [false, false, false, false, false]);
});

test('a high-priority gap cannot pass VERIFY without a valid owner', () => {
  const project = fresh();
  project.processes = [{id:'p1', name:'Приём заявки'}];
  project.sources = [{id:'s1', name:'Регламент', type:'Документ', location:'Общий диск', owner:'o1', process:'p1'}];
  project.owners = [{id:'o1', name:'Руководитель'}];
  project.gaps = [{id:'g1', name:'Нет инструкции', type:'Пробел', risk:'Высокий', priority:'Высокая', status:'Открыта', process:'p1', owner:'missing'}];
  assert.equal(getStageChecks(project)[2], false);
  project.gaps[0].owner = 'o1';
  project.verificationConfirmed = true;
  assert.equal(getStageChecks(project)[2], true);
  project.gaps[0].process = 'missing-process';
  assert.equal(getStageChecks(project)[2], false);
});

test('ACTIVATE requires a human-confirmed test linked to an existing source', () => {
  const project = fresh();
  project.aiTests = [{id:'a1', name:'Порядок приёма', expectedAnswer:'По регламенту', source:'s1', result:'Подтверждён'}];
  assert.equal(getStageChecks(project)[3], false);
  project.sources = [{id:'s1', name:'Регламент', owner:'o1', location:'Общий диск'}];
  assert.equal(getStageChecks(project)[3], true);
});

test('EVOLVE requires a completed task explicitly assigned to the evolve stage', () => {
  const project = fresh();
  project.tasks = [{id:'t1', name:'Обновить регламент', stage:'verify', status:'Готово'}];
  assert.equal(getStageChecks(project)[4], false);
  project.tasks[0].stage = 'evolve';
  assert.equal(getStageChecks(project)[4], true);
});

test('VERIFY does not pass a gap with missing classification or a fake status', () => {
  const project = fresh();
  project.processes = [{id:'p1', name:'Продажи'}];
  project.owners = [{id:'o1', name:'Руководитель'}];
  project.sources = [{id:'s1', name:'Регламент продаж', type:'Документ', location:'Общий диск', owner:'o1', process:'p1'}];
  project.gaps = [{id:'g1', name:'Нет инструкции', type:'Пробел', risk:'Средний', priority:'Средняя', status:'Открыта', process:'p1'}];
  project.verificationConfirmed = true;
  assert.equal(getStageChecks(project)[2], true);
  project.gaps[0].risk = '';
  assert.equal(getStageChecks(project)[2], false);
  project.gaps[0].risk = 'Средний';
  project.gaps[0].status = 'что угодно';
  assert.equal(getStageChecks(project)[2], false);
});

test('VERIFY cannot pass until a person explicitly confirms the review, including when no gaps were found', () => {
  const project = fresh();
  assert.equal(getStageChecks(project)[2], false);
  project.verificationConfirmed = true;
  assert.equal(getStageChecks(project)[2], false);
  project.processes = [{id:'p1', name:'Продажи'}];
  project.owners = [{id:'o1', name:'Руководитель'}];
  project.sources = [{id:'s1', name:'Регламент продаж', type:'Документ', location:'Общий диск', owner:'o1', process:'p1'}];
  assert.equal(getStageChecks(project)[2], true);
});


test('STRUCTURE rejects placeholder steps and undefined outputs', () => {
  const project = fresh();
  project.owners = [{id:'o1', name:'Руководитель'}];
  project.processes = [{id:'p1', name:'Диагностика', purpose:'Восстановить работу', steps:'Пока документированных шагов нет', outputs:'Не определён', owner:'o1'}];
  assert.equal(getStageChecks(project)[1], false);
  project.processes[0].steps = 'Проверить давление; измерить температуру; оформить акт';
  assert.equal(getStageChecks(project)[1], false);
  project.processes[0].outputs = 'Акт диагностики с результатами измерений';
  assert.equal(getStageChecks(project)[1], true);
});


test('VERIFY requires a real review scope with at least one fully linked source', () => {
  const project = fresh();
  project.verificationConfirmed = true;
  assert.equal(getStageChecks(project)[2], false);
  project.processes = [{id:'p1', name:'Поддержка'}];
  project.owners = [{id:'o1', name:'Руководитель'}];
  project.sources = [{id:'s1', name:'Регламент', type:'Документ', location:'Общий диск', owner:'o1'}];
  assert.equal(getStageChecks(project)[2], false);
  project.sources[0].process = 'p1';
  assert.equal(getStageChecks(project)[2], true);
});
