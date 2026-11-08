import type {Project} from './model';

/**
 * Completion rules for the five Knowledge Map stages.
 * These checks measure whether the minimum working structure exists;
 * they do not certify that the underlying company information is true.
 */
function isMeaningful(value: unknown): boolean {
  const text = String(value ?? '').trim().toLocaleLowerCase('ru-RU');
  if (!text) return false;
  return !['не определён', 'не определен', 'не указано', 'не описан', 'не описано', 'пока документированных шагов нет', 'нет данных', 'n/a', 'неизвестно'].includes(text);
}

export function getStageChecks(project: Project): boolean[] {
  const owners = new Set(project.owners.map(owner => owner.id));
  const sources = new Set(project.sources.map(source => source.id));
  const processes = new Set(project.processes.map(process => process.id));

  const collect = project.sources.length > 0 && project.sources.every(source =>
    Boolean(String(source.name ?? '').trim()) &&
    Boolean(source.owner) && owners.has(String(source.owner)) &&
    Boolean(String(source.location ?? '').trim())
  );

  const structure = project.processes.length > 0 && project.processes.every(process =>
    Boolean(String(process.name ?? '').trim()) &&
    isMeaningful(process.purpose) &&
    isMeaningful(process.steps) &&
    isMeaningful(process.outputs) &&
    Boolean(process.owner) && owners.has(String(process.owner))
  );

  // VERIFY means every recorded gap is triaged enough to act on: it has a
  // type, risk, priority, valid process link and a recognised workflow status.
  // High/critical gaps additionally need a valid accountable owner.
  const verify = project.verificationConfirmed === true && project.sources.length > 0 &&
    project.sources.every(source =>
      isMeaningful(source.name) && isMeaningful(source.type) && isMeaningful(source.location) &&
      Boolean(source.owner) && owners.has(String(source.owner)) &&
      Boolean(source.process) && processes.has(String(source.process))
    ) && project.gaps.every(gap =>
    Boolean(String(gap.name ?? '').trim()) &&
    Boolean(String(gap.type ?? '').trim()) &&
    Boolean(String(gap.risk ?? '').trim()) &&
    Boolean(String(gap.priority ?? '').trim()) &&
    Boolean(gap.process) && processes.has(String(gap.process)) &&
    ['Открыта', 'В работе', 'Готово', 'Закрыта'].includes(String(gap.status)) &&
    (!['Высокая', 'Критическая'].includes(String(gap.priority)) ||
      (Boolean(gap.owner) && owners.has(String(gap.owner))))
  );

  const activate = project.aiTests.some(test =>
    Boolean(String(test.name ?? '').trim()) &&
    Boolean(String(test.expectedAnswer ?? '').trim()) &&
    Boolean(test.source) && sources.has(String(test.source)) &&
    test.result === 'Подтверждён'
  );

  const evolve = project.tasks.some(task =>
    task.stage === 'evolve' && task.status === 'Готово' &&
    Boolean(String(task.name ?? '').trim())
  );

  return [collect, structure, verify, activate, evolve];
}
