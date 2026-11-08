import test from 'node:test';
import assert from 'node:assert/strict';
import { getJourneySteps } from '../src/journey.ts';

const base = () => ({
  company: { name: 'Учебная компания' },
  owners: [{ id: 'o1', name: 'Владелец' }],
  sources: [{ id: 's1', name: 'Регламент', type: 'Документ', location: 'Диск / Регламенты', owner: 'o1', process: 'p1' }],
  processes: [{ id: 'p1', name: 'Приём заявки', purpose: 'Принять обращение', steps: 'Принять; зарегистрировать; назначить', outputs: 'Карточка заявки', owner: 'o1' }],
  gaps: [],
  aiTests: [{ id: 'a1', name: 'Вопрос', expectedAnswer: 'Ответ по регламенту', source: 's1', result: 'Подтверждён' }],
  tasks: [{ id: 't1', name: 'Обновить регламент', stage: 'evolve', priority: 'Средняя', owner: 'o1', dueDate: '2026-11-14' }],
  verificationConfirmed: true,
});

test('journey reports completed data-driven steps without depending on elapsed calendar days', () => {
  const steps = getJourneySteps(base(), [true, true, true, true, true], true);
  assert.equal(steps.length, 7);
  assert.deepEqual(steps.map(step => step.complete), [true, true, true, true, true, true, true]);
});

test('journey does not mark source verification complete when a source is missing its owner or location', () => {
  const project = base();
  project.sources[0].owner = '';
  project.sources[0].location = '';
  const steps = getJourneySteps(project, [true, true, true, true, true], false);
  assert.equal(steps[1].complete, false);
  assert.equal(steps[4].complete, false);
});

test('journey requires human confirmation and a real source-linked AI test', () => {
  const project = base();
  project.verificationConfirmed = false;
  project.aiTests[0].source = 'missing-source';
  const steps = getJourneySteps(project, [true, true, false, true, false], false);
  assert.equal(steps[4].complete, false);
  assert.equal(steps[5].complete, false);
});

test('journey permits a verified zero-gap result but requires all gaps to be triaged when present', () => {
  const project = base();
  assert.equal(getJourneySteps(project, [true, true, true, true, true])[3].complete, true);
  project.gaps.push({ id: 'g1', name: 'Пробел', type: 'Знание сотрудника', risk: 'Высокий', priority: 'Высокая', process: 'p1', status: 'Открыта', owner: '' });
  assert.equal(getJourneySteps(project, [true, true, true, true, true])[3].complete, false);
});

test('final journey step requires all five stage checks and a backup action', () => {
  const project = base();
  assert.equal(getJourneySteps(project, [true, true, true, true, true], false)[6].complete, false);
  assert.equal(getJourneySteps(project, [true, true, true, true, false], true)[6].complete, false);
  assert.equal(getJourneySteps(project, [true, true, true, true, true], true)[6].complete, true);
});
