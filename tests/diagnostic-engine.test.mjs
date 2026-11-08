import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAutomationDiagnostic } from '../src/diagnostic-engine.ts';

const project = () => ({
  schemaVersion: 2, id: 'test', company: { name: 'Пилот', industry: '', teamSize: '', departments: '', ownerName: '' },
  scenario: 'team', diagnostic: {}, sources: [], processes: [], documents: [], gaps: [],
  owners: [], aiTests: [], tasks: [], changes: [], verificationConfirmed: false, updatedAt: '2026-11-08'
});

test('diagnostic distinguishes missing-in-map from proven absence and lists scenario requirements', () => {
  const p = project();
  p.processes = [{ id: 'sales', name: 'Обработка входящей заявки', purpose: 'Ответить клиенту', steps: 'Принять заявку; уточнить задачу; подготовить ответ', owner: 'o1', criticality: 'Высокий' }];
  p.owners = [{ id: 'o1', name: 'Анна', role: 'Руководитель продаж' }];
  const result = buildAutomationDiagnostic(p, 'sales');
  assert.ok(result);
  assert.equal(result.requirements.length, 9);
  assert.equal(result.requirements.find(item => item.id === 'prices').status, 'not-found-in-map');
  assert.match(result.requirements.find(item => item.id === 'prices').nextStep, /не доказывает/);
  assert.equal(result.readiness, 'preparation-needed');
  assert.ok(result.verificationQuestions.some(question => question.includes('Актуальный прайс')));
  assert.ok(result.verificationQuestions.some(question => question.includes('Кто утверждает скидки')));
});

test('diagnostic finds linked materials by name and flags stale materials for verification', () => {
  const p = project();
  p.processes = [{ id: 'sales', name: 'Продажи', purpose: 'Продать', steps: 'Принять лид; связаться', owner: 'o1', rules: 'Скидки только по согласованию', kpi: 'Конверсия', nextReview: '2027-01-01' }];
  p.owners = [{ id: 'o1', name: 'Анна', role: 'Руководитель' }];
  p.documents = [
    { id: 'd1', name: 'Каталог продуктов и услуг', process: 'sales', owner: 'o1', status: 'Действует', evidenceStatus: 'Проверено владельцем', contentNotes: 'Состав услуг и ограничения сверены', verifiedBy: 'Анна', verifiedAt: '2026-11-08', nextReview: '2027-01-01' },
    { id: 'd2', name: 'Прайс и правила скидок', process: 'sales', owner: 'o1', status: 'Устарела', nextReview: '2025-01-01' }
  ];
  p.sources = [{ id: 's1', name: 'FAQ — частые вопросы клиентов', process: 'sales', owner: 'o1', location: 'Drive', type: 'Документ', evidenceStatus: 'Проверено владельцем', contentNotes: 'Ответы согласованы с руководителем', verifiedBy: 'Анна', verifiedAt: '2026-11-08' }];
  const result = buildAutomationDiagnostic(p, 'sales');
  assert.equal(result.requirements.find(item => item.id === 'product').status, 'found');
  assert.equal(result.requirements.find(item => item.id === 'faq').status, 'found');
  assert.equal(result.requirements.find(item => item.id === 'prices').status, 'needs-verification');
  assert.ok(result.dimensions.every(item => item.status === 'described'));
  assert.equal(result.verificationQuestions.some(question => question.includes('Актуальный прайс')), true);
});

test('unknown process returns null and empty map never invents process findings', () => {
  const p = project();
  assert.equal(buildAutomationDiagnostic(p, 'missing'), null);
});


test('owner confirmation is required before a matched document counts as evidence', () => {
  const p = project();
  p.processes = [{ id: 'sales', name: 'Продажи', purpose: 'Продать', steps: 'Принять лид', owner: 'o1' }];
  p.owners = [{ id: 'o1', name: 'Анна', role: 'Руководитель' }];
  p.documents = [{ id: 'd1', name: 'Прайс и правила скидок', process: 'sales', owner: 'o1', status: 'Действует', evidenceStatus: 'Проверено владельцем', contentNotes: 'Цены и пределы скидок сверены', verifiedBy: 'Анна', verifiedAt: '2026-11-08' }];
  const prices = buildAutomationDiagnostic(p, 'sales').requirements.find(item => item.id === 'prices');
  assert.equal(prices.status, 'found');
  assert.match(prices.evidence.join(' '), /Цены и пределы скидок сверены/);
});

test('explicit conflict blocks evidence even when a material was otherwise approved', () => {
  const p = project();
  p.processes = [{ id: 'sales', name: 'Продажи', purpose: 'Продать', steps: 'Принять лид', owner: 'o1' }];
  p.owners = [{ id: 'o1', name: 'Анна', role: 'Руководитель' }];
  p.documents = [{ id: 'd1', name: 'Прайс и правила скидок', process: 'sales', owner: 'o1', status: 'Действует', evidenceStatus: 'Противоречие', conflictNotes: 'В прайсе и CRM разные пределы скидок' }];
  const result = buildAutomationDiagnostic(p, 'sales');
  assert.equal(result.requirements.find(item => item.id === 'prices').status, 'contradictory');
  assert.equal(result.readiness, 'preparation-needed');
});


test('owner-confirmed status without verifier and verification date is not accepted as evidence', () => {
  const p = project();
  p.processes = [{ id: 'sales', name: 'Продажи', purpose: 'Продать', steps: 'Принять лид' }];
  p.documents = [{ id: 'd1', name: 'Прайс и правила скидок', process: 'sales', status: 'Действует', evidenceStatus: 'Проверено владельцем', contentNotes: 'Цены сверены' }];
  const prices = buildAutomationDiagnostic(p, 'sales').requirements.find(item => item.id === 'prices');
  assert.equal(prices.status, 'needs-verification');
  assert.match(prices.nextStep, /содержание ещё не подтверждено/);
});

test('a past document review date invalidates an otherwise owner-confirmed material', () => {
  const p = project();
  p.processes = [{ id: 'sales', name: 'Продажи', purpose: 'Продать', steps: 'Принять лид' }];
  p.documents = [{ id: 'd1', name: 'Прайс и правила скидок', process: 'sales', status: 'Действует', evidenceStatus: 'Проверено владельцем', verifiedBy: 'Анна', verifiedAt: '2026-11-08', nextReview: '2020-01-01' }];
  const prices = buildAutomationDiagnostic(p, 'sales').requirements.find(item => item.id === 'prices');
  assert.equal(prices.status, 'needs-verification');
  assert.match(prices.nextStep, /устаревший материал/);
});

test('overdue process review is shown as incomplete rather than current', () => {
  const p = project();
  p.processes = [{ id: 'sales', name: 'Продажи', purpose: 'Продать', steps: 'Принять лид', nextReview: '2020-01-01' }];
  const review = buildAutomationDiagnostic(p, 'sales').dimensions.find(item => item.id === 'review');
  assert.equal(review.status, 'incomplete');
  assert.match(review.question, /срок проверки уже прошёл/i);
});


test('a future verification date is not accepted as owner confirmation', () => {
  const p = project();
  p.processes = [{ id: 'sales', name: 'Продажи', purpose: 'Продать', steps: 'Принять лид' }];
  p.documents = [{ id: 'd1', name: 'Прайс и правила скидок', process: 'sales', status: 'Действует', evidenceStatus: 'Проверено владельцем', verifiedBy: 'Анна', verifiedAt: '2999-01-01' }];
  const prices = buildAutomationDiagnostic(p, 'sales').requirements.find(item => item.id === 'prices');
  assert.equal(prices.status, 'needs-verification');
});
