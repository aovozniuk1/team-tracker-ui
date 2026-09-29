# Урок 15. Фінальне QA-завдання: документація, прогін і звіт

*Після уроку ти перетворюєш налаштовану конфігурацію на перевірений результат: складаєш інвентар
того, що налаштовано, пишеш тест-кейси на кожне правило макета і чекліст, виконуєш прогін у різних
сценаріях, описуєш відхилення і збираєш фінальний звіт по всіх налаштуваннях документа. Для QA це
головне: не «потикав — працює», а документований доказ, який інша людина може повторити.*

---

## 15.1. Що просить фінальне завдання

Документ ставить фінальне QA-завдання після трьох конфігурацій layout rules — Risk Assessment,
Employee Onboarding, Incident Resolution. Команда QA відповідає за дві речі.

**1. Документація:**

- тест-кейс на **кожне правило макета**, у якому розписано:
   - передумови (Preconditions);
   - дії, що запускають правило (Trigger actions);
   - очікувана видимість і поведінка полів (Expected field visibility/behavior);
   - очікувані умови обов'язковості (Expected mandatory conditions);
- чекліст, що перевіряє:
   1. виконання правил при створенні і при оновленні задачі;
   2. поля ховаються і показуються як очікується;
   3. обов'язкові поля не дають зберегти задачу порожньою;
   4. фільтрація pick list у залежних правилах точна;
   5. поля правильно вимикаються і вмикаються;
   6. крайні випадки (наприклад, зміна значень після того, як умова вже спрацювала).

**2. Прогін:**

- виконати кожен тест-кейс у різних сценаріях;
- записати фактичну поведінку проти очікуваної;
- повідомити про відхилення, UI-баги і прогалини в процесі (workflow gaps);
- запропонувати покращення юзабіліті (назви полів, структура layout).

Крім того, кожне завдання з автоматизації в документі закінчувалось фразою «include this in the
final summary report»: Blueprint, workflow rules, business rules, SLA. Тож фінальний пакет — це QA
правил макета **плюс** фінальний звіт, що зводить усе налаштоване.

| # | що здаєш | зміст |
|---|---|---|
| 1 | тест-кейси | документ на кожне з 11 правил макета |
| 2 | чекліст | шість пунктів документа, розписані по трьох layouts |
| 3 | журнал прогону | кожен кейс у кожному сценарії: факт, результат, доказ |
| 4 | відхилення | окремий опис кожного: дефект, прогалина, UI-баг |
| 5 | пропозиції з юзабіліті | назви, структура, поведінка форми |
| 6 | фінальний звіт | усі налаштування документа і їхній стан |

Куди і в якому вигляді здавати пакет, документ не каже — уточни в ментора онбордингу до початку
роботи, а не в день здачі.

---

## 15.2. Тестова база: інвентар того, що налаштовано

Перевірити можна лише те, що перелічено. Конфігурація ще й дрейфує: правило вимкнули «на хвилинку»,
проєкт перевели на інший layout, дефолтний статус з'їхав. Тому прогін починається з інвентаря.

Цей урок передбачає, що практичні завдання попередніх уроків (Blueprint, три layouts з правилами
макета і тестові проєкти під ними) уже зроблені. Якщо інвентар (задача 15.1) не знаходить котрогось
із цих об'єктів — це не помилка продукту, а ознака, що відповідне практичне завдання ще не виконане:
допиши його, перш ніж писати тест-кейси на неіснуючу конфігурацію.

### Що налаштовано за документом

| компонент | де | на чому стоїть | коли спрацьовує | що має статися |
|---|---|---|---|---|
| workflow rule `Auto Assign QA Tasks` | **Setup → Automation → Workflow Rules**, вкладка **Task** | layout, обраний у правилі | задачу створено, Task Name contains `QA` | Owner = ти |
| Blueprint `Issue Escalation Process` | **Setup → Automation → Task Blueprint** | layout навчального проєкту з полями Severity, Escalation Level, Resolution Steps, Final Status; критерій Task Name contains `Issue` | переходи New → In Review → Escalated → Resolved → Closed | Before / During / After; Escalation Level 1 → 2 → 0; Final Status = Closed; лист `oz_Escalation Alert` на Escalate Issue |
| Blueprint `Content Creation and Approval Pipeline` | те саме | layout `Content QA Project` з Urgency, Editorial Notes, Current Phase; критерій Task Name contains `Content` | Draft → Editorial Review → Revisions Needed / Design/Layout → Approved | Current Phase = Design, потім Approved; листи `oz_Editorial Review Request`, `oz_Content Approved` |
| workflow `oz_Auto-Priority Based on Deadline` | Workflow Rules, **Task** | конкретний layout (правила за датою не йдуть на All Layouts) | Before 3 Days from Due Date, Once, 09:00; Due Date не порожня, Status не Closed | Priority = High; лист `oz_Due Soon Alert` виконавцю |
| workflow `oz_Planning Reminder 5 Days Before Start` (у документі — Send "Planning Reminder" 5 Days Before Start, у прикладі звіту — Time-Based Planning Reminder) | те саме | конкретний layout з полем Reminder Sent? | Before 5 Days from Start Date, Once, 09:00; Start Date не порожня, Status не Closed, Reminder Sent? = No | лист `oz_Planning Reminder Alert` за шаблоном Planning Reminder; Reminder Sent? = Yes |
| workflow `oz_Bulk Field Change on Task Creation` | те саме | layout з полем Workstream | створення; Task Name contains `Campaign` | Workstream = Marketing, Completion Percentage = 0, Priority = High; за бажання — webhook `oz_Campaign Task Created` |
| business rule `Client Escalation Rule` | **Setup → Issue Tracker → Business Rules**, обраний проєкт | проєкт | Creation або Creation or Updation (як лишив після перевірки); Tags = `Client Escalation` | Severity = Critical; за бажанням — Assignee |
| business rule `Auto-Assign to UI/UX` | те саме | проєкт | Creation; Module = `UI/UX` | Assignee = дизайнер (User B) |
| SLA `Critical Bug SLA` | **Setup → Issue Tracker → SLA**, обраний проєкт | проєкт | Creation or Updation; Severity = Critical | Close Before 2 дні, Business hours; ескалація в момент цілі на менеджера, лист за шаблоном |
| SLA `High-Priority Multi-Escalation` | те саме | проєкт | Creation or Updation; Severity = Show stopper | Close Before 3 дні, Business hours; Level 1 за день до цілі → Assignee; Level 2 у момент цілі → Project Owner |
| три layouts з правилами | **Setup → Customization → Layouts** і **Layout Rules** | свій layout + тестовий проєкт | заповнення форми **Add Task** | таблиця правил нижче |

### Правила макета — тестова база

| ID | layout | тип | умова | дії |
|---|---|---|---|---|
| RA-R1 | Risk Assessment Layout | Conditional | Risk Severity = High або Critical | показати Mitigation Plan, Assigned Reviewer, Review Due Date; обов'язкові Mitigation Plan, Assigned Reviewer |
| RA-R2 | Risk Assessment Layout | Conditional | Risk Type = Compliance і Risk Severity = Critical | обов'язкове Review Due Date; показати Residual Risk Level |
| RA-R3 | Risk Assessment Layout | Conditional | Risk Severity = Low | вимкнути Mitigation Plan, Residual Risk Level |
| EO-R1 | Employee Onboarding Layout | Dependent | Department → Training Module | Engineering → Git, Security, Dev Stack; Sales → CRM Training, Product Demos; Marketing → SEO, Content Tools; HR → Policy Management, Zoho People; Support → Zoho Desk, Call Handling |
| EO-R2 | Employee Onboarding Layout | Conditional | System Access Level = Full | показати і зробити обов'язковим NDA Submitted |
| EO-R3 | Employee Onboarding Layout | Conditional | Department = Support або Sales | обов'язкове Training Completion Date; показати Assigned Mentor |
| EO-R4 | Employee Onboarding Layout | Conditional | Department = Marketing і System Access Level = Guest | вимкнути Training Module |
| IR-R1 | Incident Resolution Layout | Conditional | Requires External Communication? позначено | показати і зробити обов'язковими Customer Contact Method, Public Response Draft |
| IR-R2 | Incident Resolution Layout | Conditional | Incident Type = Complaint і Escalation Stage = Final | показати і зробити обов'язковим Escalated To; вимкнути Customer Contact Method |
| IR-R3 | Incident Resolution Layout | Conditional | Incident Type = Feedback | сховати Escalation Stage, Escalated To (дії «Hide» нема — реалізовано показом для решти типів) |
| IR-R4 | Incident Resolution Layout | Dependent | Incident Type → Customer Contact Method | Technical → Email, Chat; Billing → Email, Phone; Complaint → Phone, Chat; Feedback → Email |

Тестові проєкти: `Layout QA – Risk`, `Layout QA – Onboarding`, `Layout QA – Incident` — кожен
прив'язаний саме до свого layout, без приватної копії.

ID у таблиці — це правила документа. Якщо редактор змусив тримати кілька з них в одному правилі
продукту (кілька умов на одному полі-тригері), ID лишай ті самі, а в інвентарі познач, якою умовою
якого правила продукту реалізоване кожне.

### Перевірка перед прогоном

| що перевірити | де | чому |
|---|---|---|
| кожен тестовий проєкт стоїть під своїм layout | **Setup → Customization → Layouts → Task**, назва проєкту під layout | правило на іншому layout у проєкті мовчить |
| усі 11 правил на місці | **Setup → Customization → Layout Rules** | правило могли видалити чи змінити |
| **Set Default Status** кожного layout — статус типу Open | редактор layout, поле **Status** | задачі, народжені закритими, спотворять прогін |
| дефолтні workflow rules для задач (`Assign Task to Project Owner by Default`, `Remind Task Owners on the Due Date`, правила сповіщень) вимкнені або записані | **Setup → Automation → Workflow Rules → Task** | увімкнене правило змінює поля без твоєї участі |
| правила на "All Layouts" виписані | там само | вони можуть спрацювати і в нових тестових проєктах |
| Blueprint опубліковані і прив'язані; business rules і SLA активні, порядок записаний | **Task Blueprint**; **Issue Tracker → Business Rules / SLA** з вибором проєкту | стан конфігурації — частина передумов кожного кейсу |
| пошта для e-mail alerts під рукою | твоя скринька | лист — доказ для частини перевірок |
| скільки користувачів у порталі | **Users** у лівому меню | з одним користувачем кейси «іншим користувачем» — N/A |

---

## 15.3. Тест-кейс на правило макета

Документ вимагає чотири елементи; додай до них ідентифікацію і місце для результату:

| поле | що писати |
|---|---|
| ID | `TC-RA-R1-01`: layout, правило, номер |
| Rule | `Risk Assessment Layout · RA-R1` |
| Title | що перевіряємо, одним реченням |
| Preconditions | проєкт і layout; які правила збережені; нова чи збережена задача; значення полів до початку |
| Trigger actions | кроки: що відкрити, що обрати, в якому порядку |
| Expected field visibility/behavior | стан **кожного** залежного поля: видно / сховано, вимкнено, які значення в списку |
| Expected mandatory conditions | які поля обов'язкові; що стається при збереженні з порожніми |
| Actual Result | заповнюєш під час прогону, дослівно |
| Pass/Fail | Pass / Fail / Blocked / N/A / Not observed / Recorded (що означає кожен — у розділі про прогін) |
| Evidence | назви скриншотів і відео |

Правила для очікуваних результатів:

- **очікування — з вимоги, а не з того, що робить продукт.** Записуй його до прогону і не
  підганяй під факт;
- **описуй усі залежні поля, а не лише ті, що мають змінитись.** Поле, що несподівано з'явилось, —
  такий самий дефект, як поле, що не з'явилось;
- **вимога мовчить або суперечить сама собі — так і пиши:** «вимога не визначає; фіксуємо факт».
  Такий кейс дослідницький: його результат іде у відхилення як прогалина у вимогах, а не в
  Pass/Fail.

### Скільки кейсів на правило

| тип правила | мінімальний набір |
|---|---|
| умова з OR | кожен операнд окремо; жоден; зміна значення після спрацювання; оновлення збереженої задачі |
| умова з AND | обидві частини; кожна окремо; зміна значення; оновлення |
| умова з одним значенням | значення-тригер; сусіднє значення; порожнє; зміна; оновлення |
| залежне правило | кожне значення основного поля; порожнє; зміна основного після вибору залежного; оновлення |

Пам'ятай про **результат з неправильної причини.** Кейс «для `Compliance` + `High` поле
`Residual Risk Level` сховане» пройде і тоді, коли RA-R2 не працює зовсім. Негативний кейс
доводить щось лише в парі з позитивним.

### Приклад

| поле | значення |
|---|---|
| ID | `TC-RA-R1-02` |
| Rule | `Risk Assessment Layout · RA-R1` |
| Title | Critical показує три поля і вимагає план і рецензента |
| Preconditions | `Layout QA – Risk` на `Risk Assessment Layout`; RA-R1…R3 збережені; нова задача |
| Trigger actions | 1. **Tasks → Add Task**, назва `RA-02 Critical strategic`. 2. `Risk Type` = `Strategic`. 3. `Risk Severity` = `Critical`. 4. Зберегти, лишивши `Mitigation Plan` порожнім. 5. Заповнити `Mitigation Plan` і `Assigned Reviewer`, зберегти |
| Expected field visibility/behavior | після кроку 3: `Mitigation Plan`, `Assigned Reviewer`, `Review Due Date` видно; `Residual Risk Level` сховане; жодне поле не вимкнене |
| Expected mandatory conditions | `Mitigation Plan` і `Assigned Reviewer` обов'язкові, `Review Due Date` — ні; крок 4 — задача не зберігається; крок 5 — зберігається |
| Actual Result | *[дослівно, з текстом помилки]* |
| Pass/Fail | *[ ]* |
| Evidence | `TC-RA-R1-02_step3.png`, `TC-RA-R1-02_step4.png` |

Тестові задачі називай з префіксом layout: `RA-01 …`, `EO-01 …`, `IR-01 …`. Одразу видно, звідки
задача, і легко прибрати після циклу.

---

## 15.4. Чекліст

Чекліст — не копія тест-кейсів, а коротка відповідь «чи перевірено це і де доказ». Формат той
самий, що в прикладах документа:

| Checklist Item | Completed (Y/N) | Notes |
|---|---|---|
| RA: правила спрацьовують при створенні задачі | | кейси `TC-RA-*` у сценарії створення |
| RA: правила спрацьовують при оновленні задачі | | `TC-RA-R1-06`, `TC-RA-R2-05`, `TC-RA-R3-03` |
| RA: поля ховаються і показуються за таблицею станів | | скриншоти всіх станів |
| RA: порожні обов'язкові поля блокують збереження | | текст повідомлення дослівно |
| EO: фільтр Training Module точний для кожного відділу | | п'ять скриншотів випадайки |
| EO: Training Module вимикається для Marketing + Guest і вмикається знову | | |
| IR: Customer Contact Method пропонує лише дозволені способи | | чотири скриншоти |
| IR: конфлікт IR-R1 / IR-R2 перевірено і описано | | відхилення `DEV-…` |
| усі: зміна значень після спрацювання умови | | кейси сценарію переходів |

У колонці Notes — ID кейсів або назви файлів. Порожні Notes біля `Y` означають «повір мені на
слово», а звіт на слово не вірять.

---

## 15.5. Прогін: «кожен кейс у різних сценаріях»

### Сценарії

| код | сценарій | що перевіряє |
|---|---|---|
| S1 | створення через форму **Add Task** | основний шлях |
| S2 | оновлення: зміна поля-тригера у збереженій задачі | правила на оновленні |
| S3 | переходи у формі: умову ввімкнув → вимкнув → ввімкнув, не зберігаючи | «залишки» станів, значення схованих полів |
| S4 | інші точки входу: створення зі списку, з Kanban, підзадача | чи діють правила поза формою (дослідження) |
| S5 | інший користувач | якщо в порталі є другий користувач; інакше N/A |
| S6 | інший браузер | відтворюваність поведінки форми |

Кейси створення виконуй у S1, кейси оновлення — у S2, кейси переходів — у S3. По одному
позитивному кейсу на правило повтори в S4 і S6, а якщо є другий користувач — і в S5.

### Порядок

1. **Перевірка перед прогоном** — таблиця з інвентаря.
2. **Швидкий прогін** — один позитивний кейс на правило. Не пройшов — стоп: спершу конфігурація,
   потім решта кейсів.
3. **Повні кейси** в S1 і S2.
4. **Переходи** (S3) і **точки входу** (S4).
5. **Перехресна перевірка з автоматизацією.** У тестових проєктах створи задачі з назвами, що
   підпадають під критерії інших правил (`QA …`, `Campaign …`), і запиши, що спрацювало. Правила на
   "All Layouts" можуть дістати й нові проєкти.
6. **Регрес попередніх налаштувань** — по одній перевірці на компонент: перехід Blueprint, workflow
   на створення, business rule на створенні issue, ціль SLA на новій issue.
7. **Перевірки за часом** — у заплановані вікна (нижче).

### Журнал прогону

| Case ID | Scenario | Date & time | Actual Result | Result | Evidence | Deviation |
|---|---|---|---|---|---|---|
| `TC-RA-R1-02` | S1 | *[дата, час]* | *[дослівно]* | Pass | `TC-RA-R1-02_step4.png` | — |
| `TC-IR-R2-04` | S1 | *[дата, час]* | *[дослівно]* | Recorded | `TC-IR-R2-04_save.png` | `DEV-…` |

Статуси результату:

| статус | коли |
|---|---|
| **Pass** | факт збігся з очікуваним, доказ є |
| **Fail** | факт не збігся; є номер відхилення |
| **Blocked** | не виконалась передумова (правило не збереглося, проєкт не на тому layout) |
| **N/A** | неможливо в цьому середовищі (другий користувач) — з причиною |
| **Not observed** | перевірка за часом, вікно якої не настало до кінця циклу |
| **Recorded** | дослідницький кейс: вимога мовчить або суперечить; факт записано, оцінку дає відхилення |

### Докази

- знімай у момент перевірки, а не «потім відтворю»;
- називай файл ID кейсу і кроком: `TC-EO-R1-03_values.png`;
- для станів форми — скриншот усієї форми, а не одного поля: так видно і контрольні поля;
- для оновлень — Activity Stream задачі (вкладка за `•••` у деталях задачі);
- для ланцюжків (Blueprint, SLA) — коротке відео 3–5 хвилин.

### Перевірки за часом

Workflow rules за датою (за 3 дні до Due Date о 09:00, за 5 днів до Start Date о 09:00) і SLA
(2 і 3 робочі дні) дають результат лише коли мине час. Плануй їх першими:

- тестові дані створюй на початку циклу і записуй, **коли** очікуєш результат;
- дати обирай так, щоб вікно потрапило в цикл: правило «за 3 дні до Due Date о 09:00» при
  Due Date = завтра + 3 дні за своїм формулюванням має спрацювати завтра о 09:00;
- вікно не настало до здачі — статус **Not observed**, ніколи не Pass;
- якщо для спостереження робиш тимчасову копію правила з коротшою ціллю, у звіті чітко розділяй:
  що побачено на копії, а що — на справжній конфігурації.

---

## 15.6. Відхилення

### Категорії

| категорія | що це | приклад |
|---|---|---|
| дефект продукту: функціональний | продукт робить не те, що обіцяють інтерфейс чи довідка | обов'язкове поле не блокує збереження у формі **Add Task** |
| дефект продукту: UI | відображення, тексти, верстка | у гріді задач рядок `Total Count : #######` замість числа |
| помилка конфігурації | налаштовано не так — зазвичай нами | правила на оригінальному layout, проєкт на приватній копії |
| прогалина у вимогах | вимога суперечлива, неповна або нездійсненна в продукті | IR-R1 робить поле обов'язковим, IR-R2 його вимикає |
| прогалина процесу (workflow gap) | усе працює як налаштовано, але в процесі дірка | задача, створена поза формою, обходить обов'язкові поля (якщо прогін це покаже) |
| обмеження середовища | тріал не дає перевірити | один користувач у порталі |
| юзабіліті | працює, але незручно або незрозуміло | секція `Untitled Section 1` на формі |

### Перш ніж назвати це дефектом

1. **Відтвори ще раз** — тричі; запиши, скільки разів відтворилось.
2. **Перевір конфігурацію:** на якому layout проєкт; чи правило на цьому layout; чи збережене;
   чи значення в умові дослівно ті самі; чи інше правило не чіпає те саме поле.
3. **Перевір план, права і налаштування порталу.** Відсутня кнопка чи поле частіше означає
   вимкнену функцію, ніж баг.
4. **Пройди власні кроки буквально**, як їх прочитає інша людина. Кроки, які працюють лише з
   твоїм контекстом у голові, — не кроки.
5. Тільки після цього — дефект продукту.

### Формат опису

```
ID: DEV-01
Title: <що не так, де і за якої умови — одним реченням>
Category: <категорія з таблиці>
Where: <layout · правило · проєкт · точка входу>
Preconditions: <…>
Steps:
  1. <…>
  2. <…>
Expected: <…> (джерело: правило IR-R1 / пункт чекліста)
Actual: <дослівно, з текстами помилок>
Evidence: <файли, час>
Reproducibility: <3/3>
Impact: <що це означає для людини чи процесу>
Related cases: <TC-…>
Suggestion: <за потреби>
```

### Приклад: UI-дефект, що траплявся в тріалі

```
ID: DEV-UI-01
Title: Task grid shows "Total Count : #######" instead of the task count
Category: product defect: UI
Where: project → Tasks → List view (also Kanban); two projects
Steps:
  1. Open a project → Tasks → List view.
  2. Read the pagination line at the bottom of the grid.
Expected: a number, as the Projects grid shows ("Total Count: 1")
Actual: "Total Count : #######"; survives a full page reload; the browser console repeats
        "Error: total.fetch must return a number"
Scope: the Projects list and Recycle Bin grids show the number correctly
Evidence: screenshots of List and Kanban, console screenshot
Reproducibility: every time, on two projects
Impact: the user does not see how many tasks the grid holds
```

Зверни увагу: кроки буквальні, очікування має джерело (сусідній грід рахує правильно), область
дефекту окреслена — де відтворюється і де ні, а консоль дає розробнику зачіпку.

### Приклад: прогалина у вимогах

```
ID: DEV-02
Title: Customer Contact Method is both mandatory (IR-R1) and disabled (IR-R2) for a Complaint at
       Final stage with external communication
Category: requirements gap
Where: Incident Resolution Layout · IR-R1, IR-R2 · Layout QA – Incident · Add Task
Steps:
  1. Add Task, Incident Type = Complaint, Escalation Stage = Final.
  2. Tick "Requires External Communication?".
  3. Fill Public Response Draft and Escalated To; leave Customer Contact Method empty; save.
Expected: requirements contradict each other — IR-R1 demands a value, IR-R2 forbids entering one
Actual: <what the form did: blocked / saved / field enabled>
Impact: <for example: the agent cannot close the escalation form at all>
Suggestion: decide which rule wins; for example, drop the disable from IR-R2 or pre-fill the
            contact method
```

Відхилення пишеш тією мовою, якою пишеться звіт; якщо звіт англійською — і відхилення теж.

---

## 15.7. Пропозиції з юзабіліті

Формат: **зараз → пропоную → чому**. Кожна пропозиція спирається на спостереження, а не на смак.

| зараз | пропоную | чому |
|---|---|---|
| поле потрапило в `Untitled Section 1` | осмислена назва секції | технічну назву бачить кожен, хто створює задачу |
| три поля RA-R1 показуються окремо | зібрати їх в одну секцію (без поля-тригера `Risk Severity`) і показувати секцію (**Show sections**) | одна дія замість трьох, форма читається блоками |
| `Severity` в одному layout, `Risk Severity` в іншому, `Escalation Level` і `Escalation Stage` поруч | конвенція назв: префікс процесу або єдиний словник | назва поля спільна для порталу і видна в критеріях і звітах |
| правила названі «Rule 1», «Rule 2» | назви з префіксом, як у компанії прийнято для workflow (`oz_<назва>`) | правило знаходиться пошуком і зрозуміле без відкриття |
| обов'язковий чекбокс `NDA Submitted` (якщо непозначений проходить) | pick list `NDA Status`: `Not submitted`, `Submitted` з вимогою `Submitted` | чекбокс «обов'язковий» не гарантує, що його позначили |

---

## 15.8. Фінальний звіт

Документ дає приклад фінального звіту з розділами Date, QA Tester(s), Projects Tested, Summary of
Findings, Issues/Discrepancies, Recommendations, Overall Result. Додай до них три розділи, без яких
звіт не можна перевірити: середовище, що не перевірено, і де докази.

```
Final QA Report — ZProjects Onboarding
Date: <dd-MM-yyyy>
QA Tester(s): <ім'я>
Environment: Zoho One trial (EU data centre), portal <назва>, users in portal: <N>
Projects Tested: <перелік проєктів>
Scope: <компоненти: Blueprint, workflow rules, business rules, SLA, layouts і layout rules>

Summary of Findings
- <компонент>: <що перевірено> — <результат>; cases: <N>, Pass <…>, Fail <…>, N/A <…>;
  evidence: <де лежать>
Issues/Discrepancies
- DEV-01 [<категорія>] <одне речення> — <статус>
Recommendations
- <що зробити і чому>
Not tested in this cycle
- <що і чому: середовище, час, доступ>
Evidence index
- <кейс або відхилення → файли>
Overall Result
- <вердикт одним абзацом>
```

Як писати **Summary of Findings**: по рядку-двох на компонент — що саме перевіряли, результат і
де докази. «Пройшло» без числа кейсів і без доказів — не результат.

Як писати **Overall Result**:

- усе в межах перевірено і пройшло — так і пиши, з кількістю кейсів;
- є відхилення — перелічи ID і скажи, чи блокує хоч одне основний шлях;
- є Not observed — назви їх у вердикті, а не лише в окремому розділі.

Фраза «All tested … have passed QA» чесна, тільки коли все заявлене в Scope справді перевірено.
Якщо частину не встигли — вердикт звучить як «пройшло, крім …; не спостерігали …».

---

## 15.9. Як це тестувати: перевір власну QA-роботу перед здачею

Твоя документація — теж продукт, і її теж перевіряють.

**Трасованість.** Склади таблицю «правило → кейси» і переконайся:

- кожне з 11 правил має позитивні і негативні кейси, кейс переходу і кейс оновлення;
- кожен пункт чекліста має ID кейсів або файли в Notes;
- кожен Fail має відхилення, кожне відхилення посилається на кейс;
- кожне твердження звіту має доказ.

**Відтворюваність.** Дай один кейс людині без контексту (або прочитай його як чужий через день).
Якщо без питань до тебе його не виконати — передумови неповні.

**Чесність.**

- жодного Pass без доказу;
- очікування записані до прогону, не підігнані під факт;
- Not observed і N/A не сховані в Pass;
- «працює з неправильної причини» виключено парою позитивний / негативний кейс.

**Питання для самоперевірки:** що буде з моїм висновком, якщо тестовий проєкт виявиться на іншому
layout? Які з моїх Pass зламаються, якщо правило на "All Layouts" увімкнуть завтра? Що я не
перевірив і чи написав про це?

---

## 15.10. Типові помилки

**1. Прогін без інвентаря.** Невідомо, що саме перевірено і в якому стані була конфігурація;
результат не відтворити.

**2. Очікування після факту.** Expected переписаний під те, що зробив продукт, — кейс перестав
перевіряти.

**3. Тільки позитивні кейси.** Правило, яке «показує поле», не перевірене на тому, що поле
сховане в решті станів.

**4. Тільки створення.** Оновлення збереженої задачі не перевірене, хоча чекліст документа вимагає
обидва.

**5. Стан одного поля замість усієї форми.** Несподівано показане чи вимкнене сусіднє поле
пройшло повз.

**6. Pass без доказу.** Звіт тримається на слові.

**7. Конфігураційна помилка записана як дефект продукту.** Не перевірено, на якому layout проєкт і
чи збережене правило.

**8. Суперечливі вимоги записані як Fail.** Коли вимога не визначає результат, це прогалина у
вимогах, а не провал продукту.

**9. «All passed» при перевірках, що не настали.** Часові правила без статусу Not observed
роблять звіт неправдивим.

**10. Сусідні правила не враховані.** Workflow на "All Layouts" змінив поле, а кейс записав це
як поведінку layout rule.

### Симптом → причина

| симптом | найімовірніша причина |
|---|---|
| кейс проходить у тебе і не проходить у колеги | різні проєкти чи layouts (приватна копія) або різний стан правил |
| результат не повторюється через день | конфігурація змінилась після прогону; нема інвентаря з датою |
| Pass, але правило насправді не працює | нема позитивного кейсу в парі з негативним |
| в Actual написано «працює» | факт не записаний дослівно; нема доказу |
| пункт чекліста `Y`, а в Notes порожньо | доказ не зібрано або не пов'язано з кейсом |
| «дефект» зник після перевірки налаштувань | це була помилка конфігурації |
| поле змінилось без дії правила макета | спрацювало інше правило (workflow, Blueprint) |
| у задачі несподіваний Owner | увімкнене `Assign Task to Project Owner by Default` або правило `Auto Assign QA Tasks` дістає цей layout |
| нові тестові задачі народжуються закритими | **Set Default Status** layout на статусі типу Closed |
| часова перевірка «не спрацювала» | вікно ще не настало або дати тестових даних не потрапили у вікно |
| звіт не приймають | нема розділу про неперевірене або вердикт суперечить відхиленням |

---

## 15.11. Що варто запам'ятати

1. Фінальний пакет: тест-кейси на 11 правил, чекліст, журнал прогону, відхилення, пропозиції з
   юзабіліті, фінальний звіт по всіх налаштуваннях.
2. Прогін починається з інвентаря і перевірки конфігурації, а не з першого кейсу.
3. У кейсі правила макета — чотири обов'язкові елементи документа і стан усіх залежних полів.
4. Очікування — з вимоги і до прогону; вимога мовчить — кейс дослідницький.
5. Кожне правило: позитив, негатив, перехід у формі, оновлення збереженої задачі.
6. Сценарії: створення, оновлення, переходи, інші точки входу, інший користувач, інший браузер.
7. Статуси: Pass, Fail, Blocked, N/A, Not observed, Recorded — і лише Pass означає «перевірено й
   працює».
8. Перш ніж назвати дефектом — повтори, перевір конфігурацію, план і права, пройди свої кроки.
9. Відхилення класифікуй: дефект, конфігурація, вимоги, процес, середовище, юзабіліті.
10. Фінальний звіт — з середовищем, неперевіреним і доказами; вердикт чесний.

---

# Задачі

*Задачі 15.3–15.9 — фінальне QA-завдання документа повністю; 15.13 — фінальний звіт, у який
документ просить включити всі завдання з автоматизації; 15.1–15.2 — підготовка до прогону.
Потрібні три layouts із правилами і тестові проєкти `Layout QA – Risk`, `Layout QA – Onboarding`,
`Layout QA – Incident`, кожен прив'язаний саме до свого layout.*

**15.1.** *(інвентар)* Склади інвентар конфігурації порталу: усі workflow rules для задач (з
layout і станом), обидва Blueprint (статус публікації, layout, прив'язка), business rules і SLA
кожного проєкту (активні, порядок), три layouts з правилами макета (кількість правил на кожному) і
які проєкти стоять під кожним layout. Для кожного пункту — дата і час перевірки.

**15.2.** *(перевірка перед прогоном)* Перевір і запиши: кожен тестовий проєкт під своїм layout;
**Set Default Status** трьох layouts; стан дефолтних workflow rules для задач
(`Assign Task to Project Owner by Default`, `Remind Task Owners on the Due Date`, правила
сповіщень); правила на "All Layouts"; кількість користувачів у порталі. Що з цього блокує прогін?

**15.3.** *(тест-кейси: Risk Assessment Layout)* Напиши документ тест-кейсів на правила: RA-R1 —
якщо Risk Severity = High або Critical, показати Mitigation Plan, Assigned Reviewer, Review Due
Date, обов'язкові Mitigation Plan і Assigned Reviewer; RA-R2 — якщо Risk Type = Compliance і Risk
Severity = Critical, обов'язкове Review Due Date, показати Residual Risk Level; RA-R3 — якщо Risk
Severity = Low, вимкнути Mitigation Plan і Residual Risk Level. У кожному кейсі — Preconditions,
Trigger actions, Expected field visibility/behavior, Expected mandatory conditions.

**15.4.** *(тест-кейси: Employee Onboarding Layout)* Те саме для правил: EO-R1 (Dependent) —
Department → Training Module: Engineering → Git, Security, Dev Stack; Sales → CRM Training,
Product Demos; Marketing → SEO, Content Tools; HR → Policy Management, Zoho People; Support → Zoho
Desk, Call Handling; EO-R2 — якщо System Access Level = Full, показати й зробити обов'язковим NDA
Submitted (Checkbox); EO-R3 — якщо Department = Support або Sales, обов'язкове Training
Completion Date, показати Assigned Mentor; EO-R4 — якщо Department = Marketing і System Access
Level = Guest, вимкнути Training Module.

**15.5.** *(тест-кейси: Incident Resolution Layout)* Те саме для правил: IR-R1 — якщо Requires
External Communication? позначено, показати й зробити обов'язковими Customer Contact Method і
Public Response Draft; IR-R2 — якщо Incident Type = Complaint і Escalation Stage = Final, показати
й зробити обов'язковим Escalated To, вимкнути Customer Contact Method; IR-R3 — якщо Incident Type =
Feedback, сховати Escalation Stage і Escalated To; IR-R4 (Dependent) — Incident Type → Customer
Contact Method: Technical → Email, Chat; Billing → Email, Phone; Complaint → Phone, Chat; Feedback
→ Email. Позначь кейси, де вимоги суперечать або мовчать.

**15.6.** *(чекліст)* Розпиши шість пунктів чекліста документа (створення і оновлення; показ і
приховування; обов'язкові поля блокують збереження; фільтрація в залежних правилах; вимкнення і
ввімкнення; крайні випадки) по трьох layouts у форматі Checklist Item | Completed (Y/N) | Notes.

**15.7.** *(прогін)* Виконай кейси із задач 15.3–15.5: кейси створення — у S1 (форма **Add
Task**), кейси оновлення — у S2, кейси переходів — у S3; по одному позитивному кейсу на правило — у
S4 (створення зі списку, з Kanban, підзадача) і S6 (інший браузер). Веди журнал: Case ID,
Scenario, Date & time, Actual Result, Result, Evidence, Deviation. Окремо — перехресна перевірка:
задачі `RA-90 QA cross-check` і `RA-91 Campaign cross-check` у `Layout QA – Risk`; що змінилось у
них без твоєї участі?

**15.8.** *(відхилення)* Для кожного Fail і кожного дослідницького кейсу з прогону напиши опис
відхилення у форматі: ID, Title, Category, Where, Preconditions, Steps, Expected, Actual, Evidence,
Reproducibility, Impact, Related cases, Suggestion. Перед кожним — пройди п'ять кроків перевірки
«перш ніж назвати це дефектом».

**15.9.** *(юзабіліті)* Запропонуй щонайменше п'ять покращень для трьох layouts у форматі «зараз →
пропоную → чому»; кожне — з посиланням на спостереження з прогону.

**15.10.** *(знайди помилки)* Що не так у цьому тест-кейсі?

```
ID: TC-01
Title: Rule works
Preconditions: layout is set up
Trigger actions: choose High
Expected: fields are shown
Actual: works
Pass/Fail: Pass
```

**15.11.** *(класифікуй)* До якої категорії відхилень належить кожне спостереження і що робиш
далі?
   1. У `Layout QA – Risk` при `High` поля не з'являються; правила збережені на
      `Risk Assessment Layout`, а під ним у списку нема жодного проєкту.
   2. `NDA Submitted` обов'язковий, але задача з непозначеним чекбоксом зберігається.
   3. Для `Complaint` + `Final` + зовнішня комунікація задачу неможливо зберегти ніяк.
   4. Задача, створена з Kanban, зберігається без обов'язкового `Mitigation Plan` при `Critical`.
   5. Нема кому перевірити правило від імені іншого користувача: у порталі один користувач.
   6. Випадайка `Training Module` для порожнього `Department` показує всі 11 значень.
   7. На формі поле `Requires External Communication?` обрізане до `Requires External Commu…`.

**15.12.** *(планування)* У тебе два робочі дні на прогін, і в нього мають увійти також перевірки за
часом: workflow «за 3 дні до Due Date о 09:00», workflow «за 5 днів до Start Date о 09:00», SLA на
2 і 3 робочі дні. Склади план по годинах: що робиш першим, які тестові дані з якими датами
створюєш, коли перевіряєш результат, що потрапить у Not observed.

**15.13.** *(фінальний звіт)* Збери фінальний звіт за всіма налаштуваннями документа з позначкою
«include this in the final summary report» і за трьома layouts із правилами макета. Налаштування:
Blueprint `Issue Escalation Process` і `Content Creation and Approval Pipeline`; workflow-завдання
Auto-Priority Based on Deadline, Time-Based Planning Reminder і Bulk Field Change on Task Creation
(правила `oz_Auto-Priority Based on Deadline`, `oz_Planning Reminder 5 Days Before Start`,
`oz_Bulk Field Change on Task Creation`); business rules `Client Escalation Rule`,
`Auto-Assign to UI/UX`; SLA `Critical Bug SLA`, `High-Priority Multi-Escalation`. Розділи: Date,
QA Tester(s), Environment, Projects Tested, Scope, Summary of Findings, Issues/Discrepancies,
Recommendations, Not tested in this cycle, Evidence index, Overall Result.

---

# Розв'язки

**15.1.** Модель — таблиця «Що налаштовано за документом» із розділу про інвентар плюс дві колонки:
**стан зараз** (увімкнено / вимкнено / опубліковано, під яким layout, порядок) і **перевірено**
(дата, час). Мінімум рядків: правило `Auto Assign QA Tasks`, 2 Blueprint, 3 workflow з документа,
дефолтні workflow rules для задач, 2 business rules, 2 SLA (для кожного — проєкт), 3 layouts з
кількістю правил документа (RA — 3, EO — 4, IR — 4; якщо частину об'єднано — якими правилами й
умовами продукту їх реалізовано) і проєктами під ними. Інвентар з датою — перша сторінка пакету:
він пояснює, у якому стані була конфігурація під час прогону.

**15.2.**

| перевірка | очікуваний стан | якщо ні |
|---|---|---|
| тестові проєкти під своїми layouts | під кожним layout — його проєкт | блокує: прив'яжи (**•••** → **Associate Project**) і повтори |
| **Set Default Status** | статус типу Open | блокує: виправ, створи пробну задачу |
| `Assign Task to Project Owner by Default` і правила сповіщень | вимкнені або записані | не блокує, якщо записано: враховуй у кейсах |
| правила на "All Layouts" | виписані | не блокує; дає очікування для перехресної перевірки |
| користувачі | записана кількість | один користувач — S5 стає N/A |

**15.3.** Документ на три правила (Preconditions для всіх: `Layout QA – Risk` на
`Risk Assessment Layout`, RA-R1…R3 збережені, нова задача через **Add Task**, якщо не сказано інше;
`MP` — Mitigation Plan, `AR` — Assigned Reviewer, `RDD` — Review Due Date, `RRL` — Residual Risk
Level):

| ID | Trigger actions | Expected visibility/behavior | Expected mandatory |
|---|---|---|---|
| TC-RA-R1-01 | Type `Operational`, Severity `High` | MP, AR, RDD видно; RRL сховане | MP, AR обов'язкові; порожні — не зберігається |
| TC-RA-R1-02 | Type `Strategic`, Severity `Critical` | як 01 | як 01 |
| TC-RA-R1-03 | Severity `Medium` | MP, AR, RDD, RRL сховані | нічого; зберігається |
| TC-RA-R1-04 | Severity порожнє | усе сховане | нічого; зберігається |
| TC-RA-R1-05 (S3) | `High` → заповнити MP → `Medium` → `High` | після `Medium` поля сховані; після `High` знову видно; що з текстом MP — записати | після `Medium` збереження не блокується |
| TC-RA-R1-06 (S2) | збережена задача з `Medium` → змінити на `High` | MP, AR, RDD з'являються | MP, AR обов'язкові; як інтерфейс цього вимагає — записати |
| TC-RA-R2-01 | `Compliance` + `Critical` | MP, AR, RDD, RRL видно | MP, AR, RDD обов'язкові |
| TC-RA-R2-02 | `Compliance` + `High` | RRL сховане, RDD видно | RDD необов'язкове |
| TC-RA-R2-03 | `Financial` + `Critical` | RRL сховане | RDD необов'язкове |
| TC-RA-R2-04 (S3) | `Compliance` + `Critical`, обрати RRL `Monitor` → Type `Operational` | RRL сховане; що з `Monitor` — записати | RDD більше не обов'язкове |
| TC-RA-R2-05 (S2) | збережена `Compliance` + `High` → `Critical` | RRL з'являється | RDD обов'язкове |
| TC-RA-R3-01 | Severity `Low` | MP і RRL недоступні для введення: сховані (якщо видно — вимкнені) | нічого |
| TC-RA-R3-02 (S3) | `High` → заповнити MP → `Low` | MP недоступний; записати: сховано чи вимкнено, чи збереглось значення після збереження | нічого |
| TC-RA-R3-03 (S2) | збережена `High` з MP → `Low` | MP не редагується; значення — записати | нічого |

Для RA-R3 очікування спирається на намір вимоги: «для низького ризику план не вводять». Буквальне
«вимкнено» може бути непомітним, бо поля й так сховані — це окреме спостереження для відхилень.

**15.4.** Preconditions: `Layout QA – Onboarding` на `Employee Onboarding Layout`, EO-R1…R4
збережені; `TM` — Training Module, `AM` — Assigned Mentor, `TCD` — Training Completion Date.

| ID | Trigger actions | Expected visibility/behavior | Expected mandatory |
|---|---|---|---|
| TC-EO-R1-01…05 | Department по черзі `Engineering`, `Sales`, `Marketing`, `HR`, `Support` | TM пропонує лише значення свого відділу (мапа EO-R1) | — |
| TC-EO-R1-06 | Department порожнє | вимога не визначає; записати, що пропонує TM | — |
| TC-EO-R1-07 (S3) | `Engineering` + `Git` → `Sales` | TM пропонує `CRM Training`, `Product Demos`; що з `Git` — записати | — |
| TC-EO-R1-08 (S2) | збережена `Engineering` + `Git` → `HR` | TM пропонує `Policy Management`, `Zoho People`; що з `Git` — записати | — |
| TC-EO-R2-01 | Access `Full` | NDA видно | NDA обов'язковий: непозначений — не зберігається |
| TC-EO-R2-02 | Access `Limited` | NDA сховане | — |
| TC-EO-R2-03 | Access `Guest` | NDA сховане | — |
| TC-EO-R2-04 (S3) | `Full` → позначити NDA → `Limited` | NDA сховане | збереження не блокується |
| TC-EO-R3-01 | Department `Sales` | AM видно | TCD обов'язкова |
| TC-EO-R3-02 | Department `Support` | AM видно | TCD обов'язкова |
| TC-EO-R3-03 | Department `Engineering` | AM сховане | TCD необов'язкова |
| TC-EO-R3-04 (S2) | збережена `Engineering` → `Support` | AM з'являється | TCD обов'язкова |
| TC-EO-R4-01 | `Marketing` + `Guest` | TM видно і вимкнене | — |
| TC-EO-R4-02 | `Marketing` + `Full` | TM доступне: `SEO`, `Content Tools` | NDA обов'язковий (EO-R2) |
| TC-EO-R4-03 | `HR` + `Guest` | TM доступне: `Policy Management`, `Zoho People` | — |
| TC-EO-R4-04 (S3) | `Marketing` + `SEO` → `Guest` → `Limited` | після `Guest` TM вимкнене (що з `SEO` — записати); після `Limited` знову доступне | — |

**15.5.** Preconditions: `Layout QA – Incident` на `Incident Resolution Layout`, IR-R1…R4 збережені;
`CCM` — Customer Contact Method, `PRD` — Public Response Draft, `ES` — Escalation Stage, `ET` —
Escalated To; `Deadline for Resolution` у всіх кейсах видно і необов'язкове (контрольне поле).

| ID | Trigger actions | Expected visibility/behavior | Expected mandatory |
|---|---|---|---|
| TC-IR-R1-01 | позначити External | CCM, PRD видно | CCM, PRD обов'язкові |
| TC-IR-R1-02 | External не позначати | CCM, PRD сховані | зберігається |
| TC-IR-R1-03 (S3) | позначити → заповнити PRD → зняти | CCM, PRD сховані; що з текстом PRD після збереження — записати | зберігається |
| TC-IR-R1-04 (S2) | збережена без External → позначити | CCM, PRD з'являються | CCM, PRD обов'язкові |
| TC-IR-R2-01 | `Complaint` + `Final`, External не позначати | ET видно; CCM сховане (вимкнення не спостерігається) | ET обов'язкове |
| TC-IR-R2-02 | `Complaint` + `Level 2` | ET сховане | — |
| TC-IR-R2-03 | `Technical` + `Final` | ET сховане | — |
| TC-IR-R2-04 ⚠ | `Complaint` + `Final` + External | вимоги суперечать: CCM обов'язкове (IR-R1) і вимкнене (IR-R2); дослідницький — записати факт | записати, чи можна зберегти |
| TC-IR-R3-01 | `Feedback` | ES і ET сховані | — |
| TC-IR-R3-02 | `Technical` | ES видно | — |
| TC-IR-R3-03 ⚠ | Incident Type порожнє | за вимогою ES видно; записати поведінку обраної реалізації | — |
| TC-IR-R3-04 (S3) | `Complaint` + `Final` (ET видно) → `Feedback` | ES і ET сховані | збереження не блокується порожнім ET |
| TC-IR-R4-01…04 | External позначено; тип по черзі `Technical`, `Billing`, `Complaint`, `Feedback` | CCM пропонує: Email, Chat / Email, Phone / Phone, Chat / лише Email | CCM обов'язкове (IR-R1) |
| TC-IR-R4-05 (S3) | External, `Billing` + `Phone` → `Technical` | CCM пропонує Email, Chat; що з `Phone` — записати | — |

⚠ — вимоги суперечать або мовчать: ці кейси дослідницькі, їхній результат іде у відхилення як
прогалина у вимогах.

**15.6.**

| Checklist Item | Completed (Y/N) | Notes |
|---|---|---|
| RA / EO / IR: правила спрацьовують при створенні задачі | | кейси S1 кожного правила |
| RA / EO / IR: правила спрацьовують при оновленні задачі | | `TC-RA-R1-06`, `TC-RA-R2-05`, `TC-RA-R3-03`, `TC-EO-R1-08`, `TC-EO-R3-04`, `TC-IR-R1-04` |
| RA: MP, AR, RDD, RRL ховаються і показуються за таблицею станів | | скриншоти всіх станів |
| EO: AM і NDA ховаються і показуються | | |
| IR: CCM, PRD, ES, ET ховаються і показуються | | |
| RA: порожні MP / AR / RDD блокують збереження | | текст повідомлення |
| EO: порожня TCD блокує; непозначений обов'язковий NDA блокує | | чекбокс — окремий висновок |
| IR: порожні CCM / PRD / ET блокують | | |
| EO-R1: фільтр TM точний для п'яти відділів | | `TC-EO-R1-01…05` |
| IR-R4: фільтр CCM точний для чотирьох типів | | `TC-IR-R4-01…04` |
| RA-R3, EO-R4, IR-R2: вимкнення і повторне ввімкнення | | зокрема, що RA-R3 і IR-R2 можуть бути непомітні |
| крайні випадки: зміна значень після спрацювання | | усі кейси S3 |
| крайні випадки: порожні тригери, конфлікт IR-R1 / IR-R2 | | `TC-EO-R1-06`, `TC-IR-R3-03`, `TC-IR-R2-04` |
| контрольне поле `Deadline for Resolution` не змінюється | | |

**15.7.** Журнал — таблиця з розділу про прогін, рядок на кожне виконання: кейс × сценарій. Правила
заповнення:

- Actual — дослівно, з текстами повідомлень; «працює» не пишеться;
- Fail — одразу номер відхилення;
- Blocked — з причиною і діями (наприклад, «проєкт на копії layout; перепривʼязано, повторено
  о …»);
- S4 — дослідження зі статусом Recorded: і «правило діє», і «правило не діє» — результат, але
  друге одразу стає кандидатом у прогалину процесу.

Перехресна перевірка: у `RA-90 QA cross-check` очікуєш зміни Owner, лише якщо `Auto Assign QA Tasks`
стоїть на "All Layouts" або на `Risk Assessment Layout`; у `RA-91 Campaign cross-check` — зміни
Workstream / Priority, лише якщо правило з `Campaign` дістає цей layout (поля Workstream у цьому
layout нема — зверни увагу, що саме змінилось). Будь-яка зміна, якої не пояснює інвентар, —
відхилення.

**15.8.** Очікувані кандидати у відхилення (кожен — лише якщо прогін це підтвердив):

| спостереження | категорія |
|---|---|
| CCM обов'язкове і вимкнене водночас (`TC-IR-R2-04`) | прогалина у вимогах |
| RA-R3 і вимкнення в IR-R2 непомітні, бо поля сховані | прогалина у вимогах (надлишкове правило) |
| IR-R3 реалізоване показом замість «Hide» | прогалина у вимогах: вимога нездійсненна дослівно |
| непозначений обов'язковий NDA не блокує збереження | прогалина процесу |
| задача з Kanban / списку обходить обов'язкові поля | прогалина процесу |
| текст схованого поля зберігається в задачі | прогалина процесу: дані, яких людина не бачила |
| обов'язкове поле не блокує збереження у формі **Add Task** | дефект продукту: функціональний |

Перед записом кожного — п'ять кроків перевірки. Формат — як у прикладах `DEV-UI-01` і `DEV-02`.

**15.9.** Приклади з розділу про юзабіліті, плюс ті, що дасть прогін. Сильна пропозиція посилається
на кейс: «`TC-EO-R2-01`: непозначений NDA зберігається → pick list `NDA Status` з вимогою
`Submitted` → обов'язковий чекбокс не гарантує, що його позначили».

**15.10.** Проблеми:

- ID не каже, яке правило і який layout;
- Title не каже, що саме перевіряється;
- Preconditions: не сказано, який проєкт, чи він на потрібному layout, які правила збережені,
  нова чи збережена задача;
- Trigger actions: «choose High» — у якому полі, в якій формі, що до того і що після;
- Expected: не названі поля; нема стану решти полів; нема **Expected mandatory conditions**, хоча
  документ їх вимагає;
- Actual «works» — не факт, а оцінка;
- Pass без доказу; нема Evidence.

**15.11.**

| # | категорія | що далі |
|---|---|---|
| 1 | помилка конфігурації | тестовий проєкт не прив'язаний до layout — прив'язати, повторити; дефект не заводити |
| 2 | прогалина процесу (або дефект, якщо довідка обіцяє інше) | описати; запропонувати pick list замість чекбокса |
| 3 | прогалина у вимогах (конфлікт IR-R1 / IR-R2) | описати з фактом поведінки; рішення — за власником вимог |
| 4 | прогалина процесу | описати: обов'язковість діє лише у формі; порадити страховку workflow-листом |
| 5 | обмеження середовища | N/A з причиною; у звіті — «не перевірено» |
| 6 | вимога мовчить — факт для звіту | записати поведінку; запропонувати правило для порожнього відділу |
| 7 | юзабіліті (або UI-дефект, якщо підказки з повною назвою нема) | скриншот; запропонувати коротшу назву |

**15.12.** Приклад плану (день 1 — D, день 2 — D+1):

| коли | що |
|---|---|
| D, 09:00–09:30 | інвентар і перевірка перед прогоном |
| D, 09:30–10:00 | тестові дані для часових перевірок: задача з Due Date = D+1 + 3 дні (правило має спрацювати D+1 о 09:00); задача зі Start Date = D+1 + 5 днів і Reminder Sent? = No; issues з Severity `Critical` і `Show stopper` — записати час створення і розраховані цілі |
| D, 10:00–10:30 | швидкий прогін: один позитивний кейс на правило |
| D, 10:30–17:00 | повні кейси RA, EO, IR у S1 і S2 |
| D+1, 09:00–09:30 | перевірити дві задачі часових workflow: Priority, Reminder Sent?, листи |
| D+1, 09:30–13:00 | S3, S4, перехресна перевірка, регрес попередніх налаштувань |
| D+1, 13:00–15:00 | відхилення, пропозиції з юзабіліті |
| D+1, 15:00–17:00 | фінальний звіт; перевірка власної роботи; здача |

Not observed: цілі SLA на 2 і 3 робочі дні й ескалації за ними (якщо issues створені в день D, цілі
настануть після D+1), якщо їх не створили раніше. Вихід — створювати такі issues за кілька
робочих днів до прогону або чесно винести у Not tested in this cycle з розрахованим часом цілі.

**15.13.** Каркас звіту — у розділі про фінальний звіт. Що має бути в кожній частині:

- **Environment:** Zoho One trial, EU, назва порталу, кількість користувачів; це пояснює всі N/A;
- **Scope:** дев'ять налаштувань з позначкою «include this in the final summary report» і три
  layouts з правилами;
- **Summary of Findings:** по рядку-двох на компонент: що перевіряли, числа кейсів, результат,
  де докази. Для SLA і часових workflow — окремо, що спостерігали на справжній конфігурації, а що
  не настало;
- **Issues/Discrepancies:** усі `DEV-…` з категорією і одним реченням; прогалини у вимогах окремо
  від дефектів продукту;
- **Recommendations:** з відхилень і юзабіліті — наприклад, розв'язати конфлікт IR-R1 / IR-R2,
  прибрати надлишкове вимкнення з RA-R3, замінити обов'язковий чекбокс на pick list, страхувати
  обов'язкові поля workflow-листом для задач, створених поза формою;
- **Not tested in this cycle:** кейси іншим користувачем, часові перевірки, що не настали, точки
  входу, яких нема в тріалі;
- **Overall Result:** вердикт з числами і ID відхилень; якщо є Not observed — вони названі в
  самому вердикті.

---

## Ворота уроку

- [ ] перелічуєш шість складових фінального пакета і кажеш, що в кожній;
- [ ] складаєш інвентар конфігурації з датою і пояснюєш, навіщо він першою сторінкою;
- [ ] перевіряєш конфігурацію перед прогоном і знаєш, що з неї блокує прогін;
- [ ] пишеш тест-кейс на правило макета з чотирма елементами документа і станом усіх залежних
  полів;
- [ ] будуєш мінімальний набір кейсів для правила з OR, з AND, з одним значенням і для залежного;
- [ ] відрізняєш кейс з очікуванням від дослідницького і знаєш, куди йде результат кожного;
- [ ] складаєш чекліст із посиланнями на кейси і докази;
- [ ] виконуєш кейси в сценаріях S1–S6 і ведеш журнал зі статусами Pass, Fail, Blocked, N/A,
  Not observed, Recorded;
- [ ] плануєш прогін так, щоб часові перевірки встигли або чесно стали Not observed;
- [ ] перш ніж назвати щось дефектом, проходиш п'ять кроків перевірки;
- [ ] класифікуєш відхилення і пишеш опис, який інша людина відтворить без тебе;
- [ ] формулюєш пропозиції з юзабіліті у форматі «зараз → пропоную → чому»;
- [ ] складаєш фінальний звіт з середовищем, неперевіреним, доказами і чесним вердиктом;
- [ ] фінальний пакет здано: тест-кейси на 11 правил, чекліст, журнал прогону, відхилення,
  пропозиції, фінальний звіт;
- [ ] задачі 15.10–15.12 розв'язані без підглядання в розв'язки.
