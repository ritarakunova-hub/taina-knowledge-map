import type { Project } from './model';

export type EvidenceStatus = 'found' | 'partial' | 'not-found-in-map' | 'contradictory' | 'needs-verification';
export type Requirement = {
  id: string;
  title: string;
  why: string;
  terms: string[];
  kind: 'document' | 'rule' | 'data' | 'control' | 'integration';
  question: string;
};
export type RequirementResult = Requirement & {
  status: EvidenceStatus;
  evidence: string[];
  nextStep: string;
};
export type ProcessDimension = {
  id: string;
  title: string;
  status: 'described' | 'incomplete' | 'not-recorded';
  evidence: string[];
  question: string;
};
export type AutomationDiagnostic = {
  scenario: string;
  processId: string;
  processName: string;
  dimensions: ProcessDimension[];
  requirements: RequirementResult[];
  readiness: 'not-assessed' | 'preparation-needed' | 'ready-for-pilot-review';
  readinessReasons: string[];
  disclaimer: string;
  verificationQuestions: string[];
};

const value = (input: unknown) => typeof input === 'string' ? input.trim() : '';
const norm = (input: string) => input.toLocaleLowerCase('ru-RU').replace(/ё/g, 'е');
const hasAny = (haystack: string, terms: string[]) => terms.some(term => norm(haystack).includes(norm(term)));
const meaningful = (input: unknown) => {
  const v = norm(value(input));
  return Boolean(v) && !['не указано', 'не определен', 'не определён', 'не описан', 'не описано', 'нет данных', 'пока документированных шагов нет', 'n/a', 'неизвестно'].includes(v);
};

const salesAssistantRequirements: Requirement[] = [
  { id: 'product', title: 'Каталог продуктов и услуг', why: 'Ассистент должен понимать, что именно предлагает компания, кому подходит предложение и какие ограничения действуют.', question: 'Какие продукты и услуги разрешено предлагать? Где находится утверждённое описание и кто отвечает за него?', terms: ['каталог', 'продукт', 'услуг', 'ассортимент', 'описание продукта'], kind: 'document' },
  { id: 'prices', title: 'Актуальный прайс и правила скидок', why: 'Без утверждённых цен и правил скидок ассистент может сообщить клиенту неверные коммерческие условия.', question: 'Где хранится действующий прайс? Кто утверждает скидки и какие пределы нельзя превышать?', terms: ['прайс', 'цены', 'стоимость', 'скидк', 'тариф'], kind: 'document' },
  { id: 'sales-process', title: 'Регламент или описание процесса продаж', why: 'Нужны этапы сделки, критерии перехода между этапами и ответственность сотрудников.', question: 'Как проходит продажа от первого обращения до оплаты? Кто отвечает за каждый этап?', terms: ['продаж', 'воронк', 'сделк', 'этап'], kind: 'document' },
  { id: 'faq', title: 'FAQ и типовые ответы клиентам', why: 'Это основа для ответов на повторяющиеся вопросы. Ответы должны быть сверены с действующими условиями.', question: 'Какие вопросы клиенты задают чаще всего? Какие ответы уже согласованы руководителем?', terms: ['faq', 'частые вопросы', 'вопросы клиентов', 'ответы клиентам', 'возражен'], kind: 'document' },
  { id: 'cases', title: 'Подтверждённые кейсы и примеры работ', why: 'Ассистент сможет ссылаться только на реальные, разрешённые к использованию примеры.', question: 'Какие кейсы можно показывать клиентам? Есть ли разрешение на публикацию и подтверждённые результаты?', terms: ['кейс', 'портфолио', 'пример работ', 'отзыв'], kind: 'document' },
  { id: 'handoff', title: 'Правила передачи обращения человеку', why: 'Нестандартные запросы, жалобы, торг и вопросы вне базы должны своевременно передаваться ответственному.', question: 'В каких случаях AI обязан остановиться и передать диалог сотруднику? Кому именно?', terms: ['эскалац', 'передач', 'ответственный менеджер', 'сложный запрос', 'жалоб'], kind: 'rule' },
  { id: 'exceptions', title: 'Исключения и ограничения предложения', why: 'Нужны правила для нестандартных условий, отказов, ограничений и случаев, когда нельзя обещать результат.', question: 'Какие исключения, запреты и нестандартные условия должен учитывать менеджер?', terms: ['исключен', 'ограничен', 'нестандарт', 'условия отказа', 'не допускается'], kind: 'rule' },
  { id: 'crm', title: 'Структура CRM и правила работы с лидами', why: 'Для работы с заявками нужны поля карточки, статусы, правила назначения и доступ к системе.', question: 'В какой CRM ведутся заявки? Какие поля обязательны, как назначается ответственный и какие статусы используются?', terms: ['crm', 'карточка лида', 'карточка клиента', 'статусы заявок', 'распределение заявок'], kind: 'integration' },
  { id: 'quality', title: 'Критерии качества и контроль ответов', why: 'Нужно определить, что считается корректным ответом, кто проверяет ошибки и как измеряется качество.', question: 'Как руководитель поймёт, что ответ AI корректен? Кто проверяет ошибки и по каким критериям?', terms: ['контроль качества', 'kpi', 'конверсия', 'точность ответа', 'оценка диалогов'], kind: 'control' }
];

function linkedRecords(project: Project, processId: string) {
  const sources = project.sources.filter(item => value(item.process) === processId);
  const documents = project.documents.filter(item => value(item.process) === processId);
  return { sources, documents };
}

function requirementResult(requirement: Requirement, sources: Project['sources'], documents: Project['documents']): RequirementResult {
  const candidates = [
    ...documents.map(item => ({ name: value(item.name), status: value(item.status), evidenceStatus: value(item.evidenceStatus), contentNotes: value(item.contentNotes), conflictNotes: value(item.conflictNotes), type: 'document' })),
    ...sources.map(item => ({ name: value(item.name), status: value(item.status), evidenceStatus: value(item.evidenceStatus), contentNotes: value(item.contentNotes), conflictNotes: value(item.conflictNotes), type: 'source' }))
  ].filter(item => item.name);
  const matches = candidates.filter(item => hasAny(item.name, requirement.terms));
  const stale = matches.filter(item => ['устарела', 'архив', 'не действует'].includes(norm(item.status)));
  const contradictory = matches.filter(item => norm(item.evidenceStatus) === norm('Противоречие') || Boolean(item.conflictNotes));
  const verified = matches.filter(item => norm(item.evidenceStatus) === norm('Проверено владельцем') && !stale.includes(item) && !contradictory.includes(item));
  const unverified = matches.filter(item => !stale.includes(item) && !contradictory.includes(item) && !verified.includes(item));
  const evidence = matches.map(item => [item.name, item.status, item.evidenceStatus, item.contentNotes ? `Содержание: ${item.contentNotes}` : '', item.conflictNotes ? `Замечание: ${item.conflictNotes}` : ''].filter(Boolean).join(' · '));
  if (contradictory.length) {
    return { ...requirement, status: 'contradictory', evidence, nextStep: 'Разобрать зафиксированное противоречие с владельцами источников. До согласования не использовать эти сведения в AI.' };
  }
  if (stale.length || unverified.length) {
    return { ...requirement, status: 'needs-verification', evidence, nextStep: stale.length ? 'Есть устаревший материал: найдите действующую версию и подтвердите её у владельца.' : 'Материал найден по названию, но его содержание ещё не подтверждено владельцем.' };
  }
  if (verified.length) {
    return { ...requirement, status: 'found', evidence, nextStep: 'Владелец подтвердил материал. Перед пилотом отдельно проверьте полноту, права доступа и тестовые ответы.' };
  }
  return { ...requirement, status: 'not-found-in-map', evidence: [], nextStep: 'Уточнить у владельца процесса, существует ли такой материал. Отсутствие записи в карте ещё не доказывает, что документа нет.' };
}

function dimension(id: string, title: string, present: boolean, evidence: string[], question: string): ProcessDimension {
  return { id, title, status: present ? 'described' : 'not-recorded', evidence, question };
}

export function buildAutomationDiagnostic(project: Project, processId: string): AutomationDiagnostic | null {
  const process = project.processes.find(item => item.id === processId);
  if (!process) return null;
  const { sources, documents } = linkedRecords(project, processId);
  const owner = project.owners.find(item => item.id === value(process.owner));
  const sourceNames = sources.map(item => value(item.name)).filter(Boolean);
  const documentNames = documents.map(item => value(item.name)).filter(Boolean);
  const linkedGaps = project.gaps.filter(item => value(item.process) === processId && !['готово', 'закрыта'].includes(norm(value(item.status))));
  const hasRules = meaningful(process.rules) || meaningful(process.decisions) || meaningful(process.exceptions);
  const hasControl = meaningful(process.kpi) || meaningful(process.control) || meaningful(process.metrics);
  const hasReview = meaningful(process.nextReview) || meaningful(process.reviewDate) || documents.some(item => meaningful(item.nextReview));
  const dimensions: ProcessDimension[] = [
    dimension('purpose', 'Цель процесса', meaningful(process.purpose), [value(process.purpose)].filter(Boolean), 'Какой измеримый результат должен дать процесс?'),
    dimension('steps', 'Последовательность действий', meaningful(process.steps), [value(process.steps)].filter(Boolean), 'Все ли реальные шаги и варианты выполнения описаны?'),
    dimension('owner', 'Ответственность', Boolean(owner), [owner ? value(owner.name) + (value(owner.role) ? ' · ' + value(owner.role) : '') : ''].filter(Boolean), 'Кто отвечает за результат и кто замещает владельца?'),
    dimension('sources', 'Источники и документы', sourceNames.length + documentNames.length > 0, [...documentNames, ...sourceNames], 'Какие источники являются действующими и кто подтверждает их содержание?'),
    dimension('rules', 'Правила и исключения', hasRules, [value(process.rules), value(process.decisions), value(process.exceptions)].filter(Boolean), 'Какие правила принятия решений и исключения должен соблюдать сотрудник или AI?'),
    dimension('control', 'Контроль результата', hasControl, [value(process.kpi), value(process.control), value(process.metrics)].filter(Boolean), 'По каким показателям проверяется качество и кто разбирает ошибки?'),
    dimension('review', 'Актуальность', hasReview, [value(process.nextReview), value(process.reviewDate), ...documents.map(item => value(item.nextReview))].filter(Boolean), 'Кто и когда пересматривает процесс и связанные материалы?')
  ];
  const requirements = salesAssistantRequirements.map(item => requirementResult(item, sources, documents));
  const blockers = dimensions.filter(item => item.status !== 'described').map(item => 'Не заполнен раздел: ' + item.title);
  const missing = requirements.filter(item => item.status === 'not-found-in-map' || item.status === 'needs-verification' || item.status === 'contradictory');
  if (linkedGaps.length) blockers.push('Есть открытые замечания по процессу: ' + linkedGaps.map(item => value(item.name)).filter(Boolean).join(', '));
  if (requirements.some(item => item.status === 'contradictory')) blockers.push('Обнаружены противоречивые материалы.');
  const readiness = dimensions.every(item => item.status === 'described') && missing.length === 0 && linkedGaps.length === 0
    ? 'ready-for-pilot-review'
    : 'preparation-needed';
  const readinessReasons = [...blockers, ...missing.map(item => item.title + ': ' + item.status)];
  const verificationQuestions = missing.map(item => item.title + ': ' + item.question);
  return {
    scenario: 'AI-помощник отдела продаж',
    processId,
    processName: value(process.name) || 'Процесс без названия',
    dimensions,
    requirements,
    readiness,
    readinessReasons,
    disclaimer: 'Это предварительная проверка структуры карты для сценария AI-помощника продаж. «Не найдено в карте» не означает, что документа нет в компании. Содержание, актуальность, права доступа, безопасность и качество ответов должны быть проверены людьми до пилота.'
  };
}

export const automationScenarios = [{ id: 'sales-assistant', title: 'AI-помощник отдела продаж', requirements: salesAssistantRequirements }];
