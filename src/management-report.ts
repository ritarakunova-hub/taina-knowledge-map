import type { Project } from './model';

type Finding = { severity: 'critical' | 'high' | 'medium'; title: string; detail: string; action: string; processId?: string };
type RecommendedAction = { rank: number; priority: 'Критический' | 'Высокий' | 'Средний'; title: string; reason: string; action: string; processId?: string };

const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const openGap = (gap: Project['gaps'][number]) => !['Готово', 'Закрыта'].includes(text(gap.status));

// Match the labels used by the UI: risk uses "Критический", priority uses
// "Критическая". A high signal must not be promoted to critical.
const gapSeverity = (gap: Project['gaps'][number]): Finding['severity'] => {
  const risk = text(gap.risk);
  const priority = text(gap.priority);
  if (risk === 'Критический' || priority === 'Критическая') return 'critical';
  if (risk === 'Высокий' || priority === 'Высокая') return 'high';
  return 'medium';
};

/** Evidence-based management signals from the current map; this is a diagnostic, not a risk certification. */
export function buildManagementReport(project: Project, today = new Date().toISOString().slice(0, 10)) {
  const findings: Finding[] = [];
  const ownerName = (id: string) => project.owners.find(owner => owner.id === id)?.name || 'Владелец не назначен';
  const processSeverity = (process: Project['processes'][number]): Finding['severity'] => {
    const criticality = text(process.criticality);
    return criticality === 'Критический' ? 'critical' : criticality === 'Высокий' ? 'high' : 'medium';
  };

  // One employee-linked knowledge source is normal and is not enough to infer
  // concentration. Raise a signal only when at least two such sources are
  // explicitly assigned to the same known owner.
  const knowledgeSourcesByOwner = new Map<string, number>();
  for (const source of project.sources) {
    const ownerId = text(source.owner);
    if (ownerId && project.owners.some(owner => owner.id === ownerId) && text(source.type).toLocaleLowerCase('ru-RU').includes('знани')) {
      knowledgeSourcesByOwner.set(ownerId, (knowledgeSourcesByOwner.get(ownerId) || 0) + 1);
    }
  }
  for (const [ownerId, count] of knowledgeSourcesByOwner) {
    if (count >= 2) {
      findings.push({ severity: 'high', title: `Несколько источников знаний закреплены за одним сотрудником: ${ownerName(ownerId)}`, detail: `${count} источника типа «Знание сотрудника» связаны с одним человеком. Это повод проверить зависимость, но не доказательство незаменимости сотрудника.`, action: 'Проверить критичность этих знаний, провести интервью, зафиксировать решения и назначить резервного носителя знаний.' });
    }
  }

  for (const source of project.sources) {
    if (!text(source.owner) || !project.owners.some(owner => owner.id === source.owner)) {
      findings.push({ severity: 'high', title: `У источника знаний нет владельца: ${text(source.name) || 'Без названия'}`, detail: 'Не определён человек, который подтвердит содержание и подскажет, где находится актуальная версия источника.', action: 'Назначить владельца источника и проверить его место хранения.' });
    }
  }

  for (const process of project.processes) {
    const linkedSources = project.sources.filter(source => source.process === process.id);
    const linkedDocuments = project.documents.filter(document => document.process === process.id);
    const linkedOpenGaps = project.gaps.filter(gap => gap.process === process.id && openGap(gap));
    const noSteps = !text(process.steps) || ['не описан', 'не описано', 'пока документированных шагов нет', 'нет данных'].includes(text(process.steps).toLocaleLowerCase('ru-RU'));
    if (noSteps || (!linkedSources.length && !linkedDocuments.length)) {
      findings.push({ severity: processSeverity(process), title: `Процесс недостаточно закреплён: ${text(process.name) || 'Без названия'}`, detail: [noSteps ? 'Шаги процесса не описаны.' : '', !linkedSources.length && !linkedDocuments.length ? 'Нет связанных источников и документов.' : ''].filter(Boolean).join(' '), action: 'Описать реальные шаги и связать процесс с первичными источниками.', processId: process.id });
    }
    if (!text(process.owner) || !project.owners.some(owner => owner.id === process.owner)) {
      findings.push({ severity: processSeverity(process), title: `У процесса нет назначенного владельца: ${text(process.name) || 'Без названия'}`, detail: 'Не определён человек, отвечающий за результат и актуальность процесса.', action: 'Назначить владельца процесса и согласовать его ответственность.', processId: process.id });
    }
    if (linkedOpenGaps.length) {
      const gapSeverityRank = { critical: 0, high: 1, medium: 2 };
      const severity = linkedOpenGaps
        .map(gapSeverity)
        .sort((a, b) => gapSeverityRank[a] - gapSeverityRank[b])[0];
      findings.push({ severity, title: `Открытые проблемы процесса: ${text(process.name) || 'Без названия'}`, detail: linkedOpenGaps.map(gap => text(gap.name) || 'Проблема без названия').join('; '), action: 'Согласовать приоритет, владельца и срок устранения.', processId: process.id });
    }
  }

  for (const document of project.documents) {
    if (text(document.nextReview) && text(document.nextReview) < today && !['Устарела', 'Архив'].includes(text(document.status))) {
      findings.push({ severity: 'medium', title: `Просрочена проверка документа: ${text(document.name) || 'Без названия'}`, detail: `Дата следующей проверки: ${text(document.nextReview)}.`, action: 'Сверить документ с текущей практикой и назначить новую дату проверки.' });
    }
    if (!text(document.owner) || !project.owners.some(owner => owner.id === document.owner)) {
      findings.push({ severity: 'medium', title: `У документа нет владельца: ${text(document.name) || 'Без названия'}`, detail: 'Некому явно поручить проверку актуальности.', action: 'Назначить владельца документа.' });
    }
  }

  const severityRank = { critical: 0, high: 1, medium: 2 };
  findings.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || a.title.localeCompare(b.title, 'ru'));
  // Criticality must be explicitly assigned by a manager. Guessing it from
  // process names creates false positives and makes the report look more
  // authoritative than the underlying evidence allows.
  const criticalProcesses = project.processes.filter(process => text(process.criticality) === 'Критический');
  const highPriorityProcesses = project.processes.filter(process => text(process.criticality) === 'Высокий');
  // Recommend concrete next steps from observed signals only. This is a transparent
  // triage order, not a numeric risk score or a claim about financial impact.
  const processRank = (id?: string) => {
    const criticality = text(project.processes.find(process => process.id === id)?.criticality);
    return criticality === 'Критический' ? 0 : criticality === 'Высокий' ? 1 : 2;
  };
  const priorityLabel = (finding: Finding): RecommendedAction['priority'] =>
    finding.severity === 'critical' || (finding.severity === 'high' && processRank(finding.processId) === 0)
      ? 'Критический'
      : finding.severity === 'high' || processRank(finding.processId) === 1 ? 'Высокий' : 'Средний';
  const rankedFindings = [...findings].sort((a, b) =>
    severityRank[a.severity] - severityRank[b.severity] || processRank(a.processId) - processRank(b.processId) || a.title.localeCompare(b.title, 'ru')
  );
  const seenActions = new Set<string>();
  const topActions: RecommendedAction[] = [];
  for (const finding of rankedFindings) {
    const key = `${finding.processId || 'global'}|${finding.action}`;
    if (seenActions.has(key)) continue;
    seenActions.add(key);
    topActions.push({ rank: topActions.length + 1, priority: priorityLabel(finding), title: finding.title, reason: finding.detail, action: finding.action, ...(finding.processId ? { processId: finding.processId } : {}) });
    if (topActions.length === 3) break;
  }
  return {
    company: text(project.company.name) || 'Компания не указана',
    generatedAt: today,
    processCount: project.processes.length,
    sourceCount: project.sources.length,
    documentCount: project.documents.length,
    openGapCount: project.gaps.filter(openGap).length,
    ownerlessProcessCount: project.processes.filter(process => !text(process.owner) || !project.owners.some(owner => owner.id === process.owner)).length,
    criticalProcessCount: criticalProcesses.length,
    highPriorityProcessCount: highPriorityProcesses.length,
    findings,
    topActions,
    disclaimer: 'Отчёт показывает только сигналы, видимые в заполненной карте. Пустые поля могут означать отсутствие данных, а не отсутствие проблемы. Приоритеты нужно подтвердить с владельцами процессов.'
  };
}
