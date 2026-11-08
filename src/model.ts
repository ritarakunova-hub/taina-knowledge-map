import {openDB} from 'idb';
import {validateActiveProjectRecord, validateWorkspacePointer, previousActiveProjectToDelete} from './storage-integrity';
export type Stage='collect'|'structure'|'verify'|'activate'|'evolve';
export type Row={id:string;name:string;[key:string]:string|boolean|string[]};
export type Project={schemaVersion:number;id:string;company:{name:string;industry:string;teamSize:string;departments:string;ownerName:string};scenario:string;diagnostic:Record<string,string>;sources:Row[];processes:Row[];documents:Row[];gaps:Row[];owners:Row[];aiTests:Row[];tasks:Row[];changes:{id:string;at:string;message:string}[];verificationConfirmed:boolean;updatedAt:string};
export const fresh=():Project=>({schemaVersion:2,id:crypto.randomUUID(),company:{name:'',industry:'',teamSize:'',departments:'',ownerName:''},scenario:'solo',diagnostic:{},sources:[],processes:[],documents:[],gaps:[],owners:[],aiTests:[],tasks:[],changes:[],verificationConfirmed:false,updatedAt:new Date().toISOString()});
const db=openDB('taina-km',1,{upgrade(d){d.createObjectStore('projects',{keyPath:'id'});d.createObjectStore('settings')}});
export async function load():Promise<unknown|null>{const d=await db,id=await d.get('settings','active');if(id===undefined||id===null){validateWorkspacePointer(id,await d.count('projects'));return null;}const data=await d.get('projects',id);
  // A dangling or mismatched active pointer must never be treated as a fresh
  // workspace: that could let autosave replace the only recoverable state.
  const record=validateActiveProjectRecord(id,data);
  // Return the stored record unchanged. Normalizing it here would silently
  // fill missing collections before integrity validation could detect damage.
  return record;
}
export async function save(p:Project){
  const d=await db;
  // Persist an immutable snapshot and update the active pointer in the same
  // IndexedDB transaction. A tab close or quota error must not leave a new
  // active ID pointing at a project that was never committed.
  const snapshot:Project={...p,updatedAt:new Date().toISOString()};
  const tx=d.transaction(['projects','settings'],'readwrite');
  const projects=tx.objectStore('projects');
  const settings=tx.objectStore('settings');
  // Import/replace can change the project ID. Remove only the previously active
  // record in the same transaction; never leave two active-looking workspaces.
  const previousId=await settings.get('active');
  const obsoleteId=previousActiveProjectToDelete(previousId,snapshot.id);
  if(obsoleteId) await projects.delete(obsoleteId);
  await projects.put(snapshot);
  await settings.put(snapshot.id,'active');
  await tx.done;
  return snapshot.updatedAt;
}
export function demo():Project {const p=fresh();p.company={name:'Северный сервис (учебный пример)',industry:'Обслуживание оборудования',teamSize:'24',departments:'Операции, Поддержка, Продажи',ownerName:'Ирина Смирнова'};p.scenario='team';p.owners=[{id:'o1',name:'Ирина Смирнова',role:'Операционный директор'},{id:'o2',name:'Павел Орлов',role:'Руководитель поддержки'},{id:'o3',name:'Мария Волкова',role:'Специалист сервиса'}];p.processes=[{id:'p1',name:'Приём заявки',department:'Поддержка',criticality:'Критический',purpose:'Зафиксировать обращение и назначить исполнителя',steps:'Принять заявку; уточнить оборудование; назначить мастера',outputs:'Карточка заявки',owner:'o2',status:'Описан'},{id:'p2',name:'Выездное обслуживание',department:'Операции',criticality:'Высокий',purpose:'Восстановить работу оборудования',steps:'Подготовить выезд; провести диагностику; оформить результат',outputs:'Акт работ',owner:'o1',status:'Черновик'},{id:'p3',name:'Передача устного знания мастера',department:'Операции',criticality:'Обычный',purpose:'Знание хранится у сотрудника',steps:'Пока документированных шагов нет',outputs:'Не определён',owner:'o3',status:'Не описан'}];p.sources=[{id:'s1',name:'Инструкция приёма заявок',type:'Документ',location:'Общий диск / Поддержка',owner:'o2',process:'p1',status:'Актуальность проверить'},{id:'s2',name:'Памятка диспетчера (старая)',type:'Документ',location:'Папка Архив',owner:'',process:'p1',status:'Устарела'},{id:'s3',name:'Практика диагностики насоса',type:'Знание сотрудника',location:'Только у Марии Волковой',owner:'o3',process:'p3',status:'Не документировано'}];p.documents=[{id:'d1',name:'Регламент приёма заявок',type:'Регламент',version:'2.1',process:'p1',owner:'o2',nextReview:'2025-06-01',status:'Действует'},{id:'d2',name:'Памятка диспетчера',type:'Инструкция',version:'1.0',process:'p1',owner:'',nextReview:'2023-01-01',status:'Устарела'},{id:'d3',name:'Инструкция по диагностике',type:'Инструкция',version:'1.2',process:'p2',owner:'o1',nextReview:'2027-01-01',status:'Действует'}];p.gaps=[{id:'g1',name:'Разные сроки реакции в регламенте и памятке',type:'Противоречие',risk:'Высокий',priority:'Высокая',owner:'o2',process:'p1',status:'Открыта'},{id:'g2',name:'Диагностика насоса не описана',type:'Знание сотрудника',risk:'Высокий',priority:'Высокая',owner:'o3',process:'p3',status:'Открыта'},{id:'g3',name:'У памятки нет владельца и срока проверки',type:'Актуальность',risk:'Средний',priority:'Средняя',owner:'',process:'p1',status:'Открыта'}];p.aiTests=[{id:'a1',name:'Каков порядок первичного приёма заявки?',expectedAnswer:'По регламенту 2.1; сверить шаги и ссылку на документ',source:'s1',result:'Проверить вручную',notes:'Учебный вопрос'}];p.tasks=[{id:'t1',name:'Сверить сроки реакции в двух документах',stage:'verify',priority:'Высокая',owner:'o2',dueDate:'',status:'К выполнению'},{id:'t2',name:'Интервьюировать Марию о диагностике насоса',stage:'collect',priority:'Высокая',owner:'o3',dueDate:'',status:'К выполнению'}];return p}
export async function clearAll(){
  const d=await db;
  // Clear project records and active pointer atomically; a failed reset must not
  // leave a stale pointer or a partially cleared workspace.
  const tx=d.transaction(['projects','settings'],'readwrite');
  await tx.objectStore('projects').clear();
  await tx.objectStore('settings').delete('active');
  await tx.done;
}
