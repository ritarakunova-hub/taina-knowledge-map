import test from 'node:test';
import assert from 'node:assert/strict';
const fresh = () => ({ schemaVersion: 2, id: 'test', company: { name: '', industry: '', teamSize: '', departments: '', ownerName: '' }, scenario: 'solo', diagnostic: {}, sources: [], processes: [], documents: [], gaps: [], owners: [], aiTests: [], tasks: [], changes: [], verificationConfirmed: false, updatedAt: '2026-11-07T00:00:00.000Z' });
import { buildManagementReport } from '../src/management-report.ts';

test('management report surfaces undocumented process, missing owner and unowned stale document', () => {
  const p = fresh();
  p.company.name = 'Пилот';
  p.owners = [{ id: 'o1', name: 'Анна', role: 'Эксперт' }];
  p.processes = [{ id: 'p1', name: 'Критический процесс', criticality: 'Критический', purpose: 'Работа', steps: 'не описан', outputs: '', owner: '' }];
  p.documents = [{ id: 'd1', name: 'Регламент', type: 'Инструкция', process: 'p1', owner: '', nextReview: '2026-01-01', status: 'Действует' }];
  const report = buildManagementReport(p, '2026-11-07');
  assert.equal(report.company, 'Пилот');
  assert.equal(report.ownerlessProcessCount, 1);
  assert.equal(report.criticalProcessCount, 1);
  assert.ok(report.findings.some(f => f.title.includes('недостаточно закреплён')));
  assert.ok(report.findings.some(f => f.title.includes('нет владельца')));
  assert.ok(report.findings.some(f => f.title.includes('Просрочена проверка документа')));
});

test('management report flags knowledge concentration but does not invent findings for an empty map', () => {
  const p = fresh();
  p.owners = [{ id: 'o1', name: 'Мария', role: 'Эксперт' }];
  p.sources = [
    { id: 's1', name: 'Опыт эксперта — продажи', type: 'Знание сотрудника', location: 'У сотрудника', owner: 'o1', process: '', status: '' },
    { id: 's2', name: 'Опыт эксперта — возвраты', type: 'Знание сотрудника', location: 'У сотрудника', owner: 'o1', process: '', status: '' }
  ];
  const report = buildManagementReport(p, '2026-11-07');
  assert.ok(report.findings.some(f => f.title.includes('Несколько источников знаний')));
  const oneSource = fresh();
  oneSource.owners = p.owners;
  oneSource.sources = [p.sources[0]];
  assert.ok(!buildManagementReport(oneSource, '2026-11-07').findings.some(f => f.title.includes('Несколько источников знаний')));
  const empty = buildManagementReport(fresh(), '2026-11-07');
  assert.equal(empty.findings.length, 0);
  assert.match(empty.disclaimer, /только сигналы/);
});

test('completed and closed gaps are excluded from open gap totals', () => {
  const p = fresh();
  p.processes = [{ id: 'p1', name: 'Процесс', purpose: 'Цель', steps: 'Шаг', outputs: 'Результат', owner: 'o1' }];
  p.owners = [{ id: 'o1', name: 'Олег', role: 'Владелец' }];
  p.gaps = [
    { id: 'g1', name: 'Закрыто', process: 'p1', status: 'Закрыта', risk: 'Высокий', priority: 'Высокая', type: 'Пробел', owner: 'o1' },
    { id: 'g2', name: 'В работе', process: 'p1', status: 'В работе', risk: 'Средний', priority: 'Средняя', type: 'Пробел', owner: 'o1' }
  ];
  assert.equal(buildManagementReport(p, '2026-11-07').openGapCount, 1);
});


test('critical process count uses manager-assigned criticality, not name guessing', () => {
  const p = fresh();
  p.processes = [
    { id: 'p1', name: 'Приём заявки', purpose: 'Цель', steps: 'Шаги', outputs: 'Результат', owner: 'o1' },
    { id: 'p2', name: 'Внутренний процесс', criticality: 'Высокий', purpose: 'Цель', steps: 'Шаги', outputs: 'Результат', owner: 'o1' },
    { id: 'p3', name: 'Критический по названию, но не оценён', purpose: 'Цель', steps: 'Шаги', outputs: 'Результат', owner: 'o1' }
  ];
  p.owners = [{ id: 'o1', name: 'Анна', role: 'Руководитель' }];
  const report = buildManagementReport(p, '2026-11-07');
  assert.equal(report.criticalProcessCount, 0);
  assert.equal(report.highPriorityProcessCount, 1);
});

test('North Service demo produces a grounded management summary with distinct criticality levels', () => {
  const p = fresh();
  p.company.name = 'Северный сервис (учебный пример)';
  p.owners = [
    { id: 'o1', name: 'Ирина Смирнова', role: 'Операционный директор' },
    { id: 'o2', name: 'Павел Орлов', role: 'Руководитель поддержки' },
    { id: 'o3', name: 'Мария Волкова', role: 'Специалист сервиса' }
  ];
  p.processes = [
    { id: 'p1', name: 'Приём заявки', criticality: 'Критический', steps: 'Принять; уточнить; назначить', owner: 'o2' },
    { id: 'p2', name: 'Выездное обслуживание', criticality: 'Высокий', steps: 'Подготовить; диагностировать; оформить', owner: 'o1' },
    { id: 'p3', name: 'Передача устного знания мастера', criticality: 'Обычный', steps: 'Пока документированных шагов нет', owner: 'o3' }
  ];
  p.sources = [
    { id: 's1', name: 'Инструкция приёма заявок', type: 'Документ', location: 'Общий диск', owner: 'o2', process: 'p1' },
    { id: 's2', name: 'Памятка диспетчера', type: 'Документ', location: 'Архив', owner: '', process: 'p1' },
    { id: 's3', name: 'Практика диагностики насоса', type: 'Знание сотрудника', location: 'У сотрудника', owner: 'o3', process: 'p3' }
  ];
  p.documents = [
    { id: 'd1', name: 'Регламент приёма заявок', process: 'p1', owner: 'o2', nextReview: '2025-06-01', status: 'Действует' },
    { id: 'd2', name: 'Памятка диспетчера', process: 'p1', owner: '', nextReview: '2023-01-01', status: 'Устарела' },
    { id: 'd3', name: 'Инструкция по диагностике', process: 'p2', owner: 'o1', nextReview: '2027-01-01', status: 'Действует' }
  ];
  p.gaps = [
    { id: 'g1', name: 'Разные сроки реакции', process: 'p1', status: 'Открыта', risk: 'Высокий', priority: 'Высокая' },
    { id: 'g2', name: 'Диагностика насоса не описана', process: 'p3', status: 'Открыта', risk: 'Высокий', priority: 'Высокая' }
  ];
  const report = buildManagementReport(p, '2026-11-07');
  assert.equal(report.company, 'Северный сервис (учебный пример)');
  assert.equal(report.processCount, 3);
  assert.equal(report.sourceCount, 3);
  assert.equal(report.documentCount, 3);
  assert.equal(report.criticalProcessCount, 1);
  assert.equal(report.highPriorityProcessCount, 1);
  assert.ok(report.findings.some(f => f.title.includes('недостаточно закреплён: Передача устного знания мастера')));
  assert.ok(report.findings.some(f => f.title.includes('Просрочена проверка документа')));
  assert.ok(report.findings.some(f => f.title.includes('нет владельца')));
  assert.equal(report.findings.some(f => f.title.includes('Несколько источников знаний')), false);
});


test('management report recommends up to three next actions using severity and manager-assigned process criticality', () => {
  const p = fresh();
  p.owners = [{ id: 'o1', name: 'Анна', role: 'Руководитель' }];
  p.processes = [
    { id: 'p1', name: 'Остановка приёма заявок', criticality: 'Критический', steps: 'не описан', owner: 'o1' },
    { id: 'p2', name: 'Плановое обслуживание', criticality: 'Высокий', steps: 'Есть шаги', owner: '' },
    { id: 'p3', name: 'Внутренний архив', criticality: 'Обычный', steps: 'Есть шаги', owner: 'o1' }
  ];
  p.gaps = [
    { id: 'g1', name: 'Нет резервного порядка', process: 'p1', status: 'Открыта', risk: 'Высокий', priority: 'Высокая' },
    { id: 'g2', name: 'Не назначен координатор', process: 'p2', status: 'Открыта', risk: 'Средний', priority: 'Средняя' }
  ];
  const report = buildManagementReport(p, '2026-11-07');
  assert.ok(report.topActions.length <= 3);
  assert.equal(report.topActions[0].processId, 'p1');
  assert.equal(report.topActions[0].priority, 'Критический');
  assert.ok(report.topActions.some(item => item.processId === 'p2'));
  assert.ok(report.topActions.every(item => item.action && item.reason));
});


test('process documentation and ownership signals respect manager-assigned criticality', () => {
  const p = fresh();
  p.owners = [{ id: 'o1', name: 'Анна', role: 'Руководитель' }];
  p.processes = [
    { id: 'p1', name: 'Критичный приём', criticality: 'Критический', steps: 'не описан', owner: '' },
    { id: 'p2', name: 'Важное обслуживание', criticality: 'Высокий', steps: 'не описан', owner: '' },
    { id: 'p3', name: 'Обычный архив', criticality: 'Обычный', steps: 'не описан', owner: '' },
    { id: 'p4', name: 'Неоценённый процесс', steps: 'не описан', owner: '' }
  ];
  const report = buildManagementReport(p, '2026-11-07');
  const findingFor = (processId, phrase) => report.findings.find(item => item.processId === processId && item.title.includes(phrase));
  assert.equal(findingFor('p1', 'недостаточно закреплён').severity, 'critical');
  assert.equal(findingFor('p2', 'недостаточно закреплён').severity, 'high');
  assert.equal(findingFor('p3', 'недостаточно закреплён').severity, 'medium');
  assert.equal(findingFor('p4', 'недостаточно закреплён').severity, 'medium');
  assert.equal(findingFor('p1', 'нет назначенного владельца').severity, 'critical');
  assert.equal(findingFor('p2', 'нет назначенного владельца').severity, 'high');
  assert.equal(findingFor('p3', 'нет назначенного владельца').severity, 'medium');
});

test('management report does not manufacture recommendations when no signals exist', () => {
  assert.deepEqual(buildManagementReport(fresh(), '2026-11-07').topActions, []);
});


test('gap severity distinguishes high from critical and recognises the UI critical-risk label', () => {
  const p = fresh();
  p.processes = [
    { id: 'p1', name: 'Обычный процесс', criticality: 'Обычный', steps: 'Шаги', owner: 'o1' },
    { id: 'p2', name: 'Второй процесс', criticality: 'Обычный', steps: 'Шаги', owner: 'o1' },
    { id: 'p3', name: 'Третий процесс', criticality: 'Обычный', steps: 'Шаги', owner: 'o1' }
  ];
  p.owners = [{ id: 'o1', name: 'Анна', role: 'Руководитель' }];
  p.gaps = [
    { id: 'g1', name: 'Высокий риск', process: 'p1', status: 'Открыта', risk: 'Высокий', priority: 'Средняя' },
    { id: 'g2', name: 'Критический риск', process: 'p2', status: 'Открыта', risk: 'Критический', priority: 'Средняя' },
    { id: 'g3', name: 'Критический приоритет', process: 'p3', status: 'Открыта', risk: 'Средний', priority: 'Критическая' }
  ];
  const report = buildManagementReport(p, '2026-11-07');
  const findingFor = processId => report.findings.find(item => item.processId === processId && item.title.includes('Открытые проблемы'));
  assert.equal(findingFor('p1').severity, 'high');
  assert.equal(findingFor('p2').severity, 'critical');
  assert.equal(findingFor('p3').severity, 'critical');
});
