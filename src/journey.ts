import type { Project } from './model';

export type JourneyStep = {
  day: number;
  title: string;
  description: string;
  result: string;
  complete: boolean;
  target: string;
  action: string;
};

const hasText = (value: unknown) => typeof value === 'string' && value.trim().length > 0;

export function getJourneySteps(project: Project, stageChecks: boolean[], backupDownloaded = false): JourneyStep[] {
  const owners = new Set(project.owners.map(owner => owner.id));
  const processes = new Set(project.processes.map(process => process.id));
  const sources = new Set(project.sources.map(source => source.id));
  const completeProcess = project.processes.some(process =>
    hasText(process.name) && hasText(process.purpose) && hasText(process.steps) &&
    hasText(process.outputs) && typeof process.owner === 'string' && owners.has(process.owner)
  );
  const completeSources = project.sources.length > 0 && project.sources.every(source =>
    hasText(source.name) && hasText(source.type) && hasText(source.location) &&
    typeof source.owner === 'string' && owners.has(source.owner) &&
    typeof source.process === 'string' && processes.has(source.process)
  );
  const completeGaps = project.gaps.every(gap =>
    hasText(gap.name) && hasText(gap.type) && hasText(gap.risk) && hasText(gap.priority) &&
    typeof gap.process === 'string' && processes.has(gap.process) &&
    ['Открыта', 'В работе', 'Готово', 'Закрыта'].includes(String(gap.status)) &&
    (!['Высокая', 'Критическая'].includes(String(gap.priority)) ||
      (typeof gap.owner === 'string' && owners.has(gap.owner)))
  );
  const confirmedTest = project.aiTests.some(test =>
    hasText(test.name) && hasText(test.expectedAnswer) &&
    typeof test.source === 'string' && sources.has(test.source) && test.result === 'Подтверждён'
  );
  const actionableTask = project.tasks.some(task =>
    hasText(task.name) && hasText(task.stage) && hasText(task.priority) &&
    typeof task.owner === 'string' && owners.has(task.owner) && hasText(task.dueDate)
  );

  return [
    { day: 1, title: 'COLLECT · Определить границы пилота', description: 'Укажите компанию, выберите небольшой участок работы и добавьте владельца проекта в реестр ответственных. Не пытайтесь описать всю компанию сразу.', result: 'Результат: понятная граница пилота и ответственный.', complete: hasText(project.company.name) && project.owners.length > 0, target: 'company', action: 'Настроить проект' },
    { day: 2, title: 'COLLECT · Собрать источники', description: 'Найдите регламенты, инструкции, таблицы и носителей устных знаний. Для каждого источника укажите тип, место хранения и владельца. Связь с процессом можно завершить на следующем шаге.', result: 'Результат: первичный реестр источников.', complete: project.sources.length > 0 && project.sources.every(source => hasText(source.name) && hasText(source.type) && hasText(source.location) && typeof source.owner === 'string' && owners.has(source.owner)), target: 'sources', action: 'Открыть источники' },
    { day: 3, title: 'STRUCTURE · Описать процесс', description: 'Зафиксируйте цель, входы, реальные шаги, исключения и результат. Назначьте владельца и свяжите процесс с источниками знаний.', result: 'Результат: черновая карта одного рабочего процесса.', complete: completeProcess && completeSources, target: 'processes', action: 'Открыть процессы' },
    { day: 4, title: 'VERIFY · Найти пробелы и противоречия', description: 'Сопоставьте документы и реальную практику. Для каждой проблемы укажите тип, риск, приоритет, процесс и статус. Для высоких и критических рисков назначьте владельца.', result: 'Результат: классифицированный список проблем либо отсутствие пробелов, готовое к подтверждению.', complete: completeGaps, target: 'gaps', action: 'Открыть проблемы и пробелы' },
    { day: 5, title: 'VERIFY · Проверить качество карты', description: 'Проверьте связи, владельцев, версии и даты пересмотра. Уточните спорные места по первичным источникам и подтвердите проверку вручную.', result: 'Результат: проверенная в обозначенном объёме карта.', complete: completeSources && project.verificationConfirmed && Boolean(stageChecks[2]), target: 'quality', action: 'Открыть проверку качества' },
    { day: 6, title: 'ACTIVATE · Проверить AI-сценарий', description: 'Подготовьте типовой вопрос и эталонный ответ со ссылкой на источник. Сверьте ответ и подтвердите результат человеком. Это тестовый сценарий, а не автоматическая оценка AI-готовности.', result: 'Результат: хотя бы один проверенный человеком тест.', complete: confirmedTest, target: 'aiTests', action: 'Открыть AI-тесты' },
    { day: 7, title: 'EVOLVE · Передать карту в работу', description: 'Назначьте следующие действия и сроки, проверьте пять этапов, экспортируйте XLSX и скачайте JSON-резервную копию. Храните копию отдельно от браузера.', result: 'Результат: карта, план улучшений и резервная копия.', complete: actionableTask && stageChecks.length === 5 && stageChecks.every(Boolean) && backupDownloaded, target: 'tasks', action: 'Открыть план развития' },
  ];
}
