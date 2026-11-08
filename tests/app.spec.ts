import {test,expect} from '@playwright/test';
test('first run creates company and retains it after reload',async({page})=>{await page.goto('/');await expect(page.getByRole('heading',{name:'Моя компания'})).toBeVisible();await page.getByLabel('Название компании').fill('Тестовая сервисная компания');await page.getByRole('button',{name:'Далее →'}).click();await page.getByRole('button',{name:'Далее →'}).click();await page.getByRole('button',{name:'Пропустить диагностику'}).click();await page.getByRole('button',{name:'Перейти к карте знаний'}).click();await expect(page.getByRole('heading',{name:'Ваша карта знаний'})).toBeVisible();await expect(page.getByText('Сохранено локально')).toBeVisible({timeout:5000});await page.reload();await expect(page.getByText('Тестовая сервисная компания')).toBeVisible()});
test('can create linked owner, process and source',async({page})=>{await page.goto('/');await page.getByLabel('Название компании').fill('Проверка связей');await page.getByRole('button',{name:'Далее →'}).click();await page.getByRole('button',{name:'Далее →'}).click();await page.getByRole('button',{name:'Пропустить диагностику'}).click();await page.getByRole('button',{name:'Перейти к карте знаний'}).click();await page.getByRole('button',{name:'Ответственные'}).click();await page.getByRole('button',{name:/Добавить/}).click();await page.getByLabel('Название',{exact:true}).fill('Алексей');await page.getByLabel('Роль').fill('Операционный руководитель');await page.getByRole('button',{name:'Процессы'}).click();await page.getByRole('button',{name:/Добавить/}).click();await page.getByLabel('Название',{exact:true}).fill('Приём заявки');await page.getByLabel('Цель процесса').fill('Зафиксировать обращение');await page.getByLabel('Результат', {exact: true}).fill('Карточка заявки');await page.getByLabel('Ответственный').selectOption({label:'Алексей'});await page.getByRole('button',{name:'Источники'}).click();await page.getByRole('button',{name:/Добавить/}).click();await page.getByLabel('Название',{exact:true}).fill('Регламент приёма');await page.getByLabel('Расположение').fill('Общий диск');await page.getByLabel('Ответственный').selectOption({label:'Алексей'});await page.getByLabel('Связанный процесс').selectOption({label:'Приём заявки'});await expect(page.getByLabel('Связанный процесс')).toHaveValue(/.+/)});
test('mobile layout exposes navigation and project content',async({page})=>{await page.setViewportSize({width:390,height:844});await page.goto('/');await expect(page.getByRole('heading',{name:'Моя компания'})).toBeVisible();await expect(page.locator('body')).toBeVisible()});

test('opening the demo downloads a backup before replacing the current project', async ({page}) => {
  await page.goto('/');
  await page.getByLabel('Название компании').fill('Мой рабочий проект');
  await page.getByRole('button', {name:'Далее →'}).click();
  await page.getByRole('button', {name:'Далее →'}).click();
  await page.getByRole('button', {name:'Пропустить диагностику'}).click();
  await page.getByRole('button', {name:'Перейти к карте знаний'}).click();
  const downloadPromise = page.waitForEvent('download');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', {name:'Открыть учебный пример'}).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain('taina-project-backup');
  await expect(page.getByText(/Северный сервис/)).toBeVisible();
});


test('JSON backup restores the project after an accidental edit', async ({page}) => {
  await page.goto('/');
  await page.getByLabel('Название компании').fill('Северный тест');
  await page.getByRole('button', {name:'Далее →'}).click();
  await page.getByRole('button', {name:'Далее →'}).click();
  await page.getByRole('button', {name:'Пропустить диагностику'}).click();
  await page.getByRole('button', {name:'Перейти к карте знаний'}).click();
  await expect(page.getByText('Сохранено локально')).toBeVisible({timeout:5000});

  await page.getByRole('button', {name:'Отчёты и экспорт'}).click();
  const backupDownload = page.waitForEvent('download');
  await page.getByRole('button', {name:'Скачать JSON'}).click();
  const backup = await backupDownload;
  const backupPath = await backup.path();
  expect(backup.suggestedFilename()).toBe('taina-project.json');
  expect(backupPath).toBeTruthy();

  await page.getByRole('button', {name:'Моя компания'}).click();
  await page.getByLabel('Название компании').fill('Случайно изменённое название');
  await expect(page.getByText('Сохранено локально')).toBeVisible({timeout:5000});
  await page.getByRole('button', {name:'Отчёты и экспорт'}).click();

  page.on('dialog', async dialog => {
    if (dialog.type() === 'prompt') await dialog.accept('REPLACE');
    else if (dialog.type() === 'confirm') await dialog.accept();
    else await dialog.dismiss();
  });
  await page.locator('input[type="file"]').setInputFiles(backupPath!);
  await expect(page.getByText('Северный тест')).toBeVisible();
  await expect(page.getByText('Случайно изменённое название')).toHaveCount(0);
});

test('empty management report does not invent recommendations', async ({page}) => {
  await page.goto('/');
  await page.getByLabel('Название компании').fill('Пустая карта');
  await page.getByRole('button', {name:'Далее →'}).click();
  await page.getByRole('button', {name:'Далее →'}).click();
  await page.getByRole('button', {name:'Пропустить диагностику'}).click();
  await page.getByRole('button', {name:'Перейти к карте знаний'}).click();
  await page.getByRole('button', {name:'Отчёты и экспорт'}).click();
  await expect(page.getByText('Пока нет оснований рекомендовать действия.')).toBeVisible();
});

test('full first-cycle path saves linked knowledge, a task, and a restorable backup', async ({page}) => {
  await page.goto('/');
  await page.getByLabel('Название компании').fill('Приёмочный тест');
  await page.getByRole('button', {name: 'Далее →'}).click();
  await page.getByRole('button', {name: 'Далее →'}).click();
  await page.getByRole('button', {name: /Пропустить диагностику/}).click();
  await page.getByRole('button', {name: /Перейти к карте знаний/}).click();

  await page.getByRole('button', {name: 'Ответственные'}).click();
  await page.getByRole('button', {name: /Добавить/}).click();
  await page.getByLabel('Название', {exact: true}).fill('Ирина');
  await page.getByLabel('Роль').fill('Владелец процесса');

  await page.getByRole('button', {name: 'Процессы'}).click();
  await page.getByRole('button', {name: /Добавить/}).click();
  await page.getByLabel('Название', {exact: true}).fill('Обработка обращения');
  await page.getByLabel('Цель процесса').fill('Принять и зарегистрировать обращение');
  await page.getByLabel('Шаги').fill('Принять обращение; проверить данные; зарегистрировать');
  await page.getByLabel('Результат', {exact: true}).fill('Зарегистрированная заявка');
  await page.getByLabel('Ответственный').selectOption({label: 'Ирина'});

  await page.getByRole('button', {name: 'Источники'}).click();
  await page.getByRole('button', {name: /Добавить/}).click();
  await page.getByLabel('Название', {exact: true}).fill('Инструкция регистрации');
  await page.getByLabel('Тип').selectOption({label: 'Инструкция'});
  await page.getByLabel('Расположение').fill('Корпоративный диск / Операции');
  await page.getByLabel('Ответственный').selectOption({label: 'Ирина'});
  await page.getByLabel('Связанный процесс').selectOption({label: 'Обработка обращения'});

  await page.getByRole('button', {name: 'Качество карты'}).click();
  await expect(page.getByText(/Проверка помогает найти незаполненные поля/)).toBeVisible();
  await page.getByRole('button', {name: 'Отчёты и экспорт'}).click();
  await expect(page.getByText('Обработка обращения')).toBeVisible();

  await page.getByRole('button', {name: 'План развития'}).click();
  await page.getByRole('button', {name: /Добавить/}).click();
  await page.getByLabel('Название', {exact: true}).fill('Утвердить инструкцию');
  await page.getByLabel('Этап').selectOption({label: 'EVOLVE — Развитие'});
  await page.getByLabel('Приоритет').selectOption({label: 'Средняя'});
  await page.getByLabel('Ответственный').selectOption({label: 'Ирина'});
  await page.getByLabel('Статус').selectOption({label: 'К выполнению'});
  await expect(page.getByText('Сохранено локально')).toBeVisible({timeout: 5000});

  await page.reload();
  await expect(page.getByText('Приёмочный тест')).toBeVisible();
  await page.getByRole('button', {name: 'План развития'}).click();
  await expect(page.getByLabel('Название', {exact: true})).toHaveValue('Утвердить инструкцию');
  await page.getByRole('button', {name: 'Отчёты и экспорт'}).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', {name: 'Скачать JSON'}).click();
  const backup = await downloadPromise;
  expect(backup.suggestedFilename()).toBe('taina-project.json');
});

test('a second tab is read-only while the first tab owns the project lock', async ({browser}) => {
  const context = await browser.newContext();
  const first = await context.newPage();
  await first.goto('/');
  await expect(first.getByRole('heading', {name: 'Моя компания'})).toBeVisible();
  await expect(first.getByText('Сохранено локально')).toBeVisible({timeout: 5000});

  const second = await context.newPage();
  await second.goto('/');
  await expect(second.getByRole('heading', {name: 'Проект уже открыт в другой вкладке'})).toBeVisible();
  await expect(second.getByText(/разрешает редактирование только в одной вкладке/)).toBeVisible();

  await second.close();
  await first.close();
  await context.close();
});
