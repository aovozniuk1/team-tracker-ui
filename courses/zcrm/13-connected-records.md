# Урок 13. Team modules, connected records і connected workflows

*Після уроку ти створюєш team modules, пов'язуєш із ними угоди без lookup-полів і автоматизуєш
передачу роботи між командами — правилом і connected workflow, — а потім перевіряєш увесь ланцюжок
від угоди до навчання клієнта. Для QA тут головне: збій передачі тихий. Запис просто не з'являється
в сусідньому модулі, і помітиш це, тільки якщо туди подивишся.*

---

## 13.1. Навіщо це: передача роботи між командами

Угода закрита — далі з клієнтом працюють інші команди: пресейл показує демо, онбординг запускає
клієнта, навчання вчить його команду. Без підтримки в CRM передача йде листами й чатами: хтось
забув написати, хтось не знав, кому писати, а контекст угоди губиться по дорозі.

Zoho закриває це двома функціями:
- **Connected records** — зв'язок між записами різних модулів: з картки угоди видно запит на демо й
  онбординг, з картки онбордингу — угоду. Контекст поруч, нікуди не треба переходити.
- **Connected workflows** — автоматика поверх цих зв'язків: подія в одному модулі створює запис,
  оновлює поле або шле лист в іншому. Наступний крок процесу запускається без ручного запиту.

Приклад із документа: фахівець із продовжень підписок (team module Renewals) через connected records
бачить історію рахунків клієнта (організаційний модуль Invoices) — платежі, тарифи, кількість
ліцензій — не виходячи з картки. А connected workflow автоматично створює запис у Renewals, коли
рахунок доходить до певного кінцевого стану, і сповіщає відповідального фахівця.

Разом ці дві функції зберігають контекст клієнта на всьому шляху, прибирають затримки на стиках між
командами й дають видимість процесу від початку до кінця.

## 13.2. Два види модулів

У Zoho CRM модулі бувають двох видів:

| | Organization module | Team module |
|---|---|---|
| що це | стандартні (Leads, Contacts, Accounts, Deals…) і кастомні модулі організації | модуль конкретної команди — фактично кастомний модуль, але «командний» |
| кому доступний | усім, згідно з профілями | тільки тим, кого додали в сам модуль |
| хто керує | адміністратори CRM | адміністратор team module (до 5 на модуль) |
| де живе | у будь-якому teamspace | у teamspace команди |
| layouts | скільки потрібно | один layout |

**Teamspace** — робочий простір команди: набір модулів, згрупованих у папки (за замовчуванням —
папка `Root`), і список людей. Team module створюють у teamspace команди.

**Доступ до team module** дає не teamspace, а сам модуль. Людина, яку додали в teamspace, модуль не
побачить, поки її не додадуть у нього з одним із профілів team module:

| профіль у team module | що може |
|---|---|
| Admins | усе: поля, дозволи, налаштування, записи |
| Managers | бачить і змінює всі записи |
| Members | бачить усі записи, створює, змінює й видаляє свої |
| Participants | бачить лише свої записи, створює, змінює й видаляє свої |
| Requesters | створює запити й стежить за ними у вкладці **My Requests**, без доступу до модуля |

Користувачів додають через **Manage User Access** модуля (**Add User** → **Access Type**), дії й
доступ до полів для профілів — через **Manage Profiles**. Нотатки й вкладення в team modules за
замовчуванням вимкнені для всіх профілів; вмикають їх у **Manage Profiles** → вкладка **Actions**.

**Хто створює.** Адміністратор або користувач із дозволом **Create Team Module** (це дозвіл рівня
адміністрування в профілі).

**Чого в team modules нема** (довідка): review process і escalation rules; Workqueue team modules
теж не підтримує. Workflow rules, Blueprint, approval process, layout і validation rules — є.

**Чому зв'язок — не lookup.** Team module може мати lookup-поле на organization module (наприклад,
Onboarding → Deals). Навпаки — ні: organization module не може мати lookup на team module. Отже, з
картки угоди до записів team modules lookup не проведеш. Для цього й існують connected records.

**Де створюють.** **Setup → Customization → Modules and Fields**. На сторінці модулів є розділи
**Custom Module** і **Team Module**, а також **Create Module Using Zia** і **Create New Module**.
**Create New Module** питає, що створюєш: **Organization Modules** чи **Team Modules**. Далі, за
довідкою, будуєш модуль (назва, поля) і під час збереження обираєш teamspace.
Інший шлях із довідки — **+** (Quick Create) угорі → **Create Team Module** → шаблон або **Build from
scratch**.

## 13.3. Connected records

**Connected record** — зв'язок між записом одного модуля і записом team module. У картці запису
його видно як розділ **Connected Records**.

Два способи створити зв'язок:
1. **Вручну.** Відкриваєш запис (угоду, наприклад), гортаєш до розділу **Connected Records**,
   натискаєш **Add New**, обираєш team module і створюєш у ньому запит. Новий запис автоматично
   пов'язаний з угодою.
2. **Workflow rule.** Звичайне правило з миттєвою дією **Create connected records**: при
   спрацюванні воно створює запис у вибраному team module, уже пов'язаний із записом, на якому
   правило спрацювало.

Факти з довідки, які впливають на тести:
- цільовим модулем connected record може бути тільки team module; тому розділ **Connected Records** у
  записі з'являється, лише коли в організації є хоча б один team module;
- зв'язувати можна organization module з team module і два team modules між собою;
- кількість connected records не обмежена;
- видалення connected record прибирає тільки зв'язок — обидва записи лишаються на місці;
- у list views фільтрувати за connected records не можна, у звітах аналізувати — можна.

**Lookup проти connected record** (за довідкою):

| | lookup-поле | connected record |
|---|---|---|
| зв'язок | поле вказує на один запис | запис може мати багато зв'язаних записів |
| хто налаштовує | адміністратор, заздалегідь, як поле | користувач, будь-коли, з картки |
| автоматичне створення | workflow створити не може | workflow створює (**Create connected records**) |
| як виглядає | поле у формі | розділ у картці запису |

## 13.4. Connected workflows

Connected workflow — автоматизація, що охоплює кілька модулів, організаційних і командних. Вона
будується навколо **primary module** — точки входу процесу (для A16 це Deals). До нього додаються
пов'язані модулі; у кожного — свої тригери, у кожного тригера — свої дії.

**Де.** **Setup → Process Management → Connected Workflow** (пункт меню в однині) → **Create New
Connected Workflow**. У вікні — назва, **Primary Module** (у списку Leads, Contacts, Accounts, Deals,
Products, Quotes, Sales Orders та інші) і опис. Далі відкривається полотно: блок Primary Module
угорі, під ним кнопка **Add Module** для кожного модуля в ланцюжку. Клік на модуль відкриває бічну
панель **«Automate your process using trigger(s)»** з кнопкою **Create Trigger**; у ній — блок
**Trigger** і, під ним, блок **Actions**.

**Тригери** (для primary module або пов'язаного модуля) — у полі **What Happens?** рівно чотири
варіанти:
- запис створено в модулі;
- запис змінено в модулі;
- запис створено або змінено;
- змінено поле запису в модулі.

Останній варіант («змінено поле») додає рядок «Поле — is modified to — значення»; у тріалі значення
пропонує не просто чи-пікер, а список порівнянь: `any value`, `the value`, `a value which is not
equal to`, `a value starting with`, `a value ending with`, `a value containing`, `empty` (і подібні).
Поруч із самим тригером є перемикач **Repeat this trigger** — на відміну від прапорця Repeat у
workflow rules, він **увімкнений за замовчуванням**. Постав це поруч із
таблицею Repeat з попереднього розділу — переплутати чи забути перевірити цей перемикач саме тут
типова помилка.

До тригера додається критерій на поточний запис (чекбокс **Specify current record criteria**, наприклад
`Demo Status is Completed`). Можна увімкнути критерії з інших модулів (опція **Other module
criteria**) і обрати, чи має умова збігтися з ANY (будь-яким) чи з ALL (усіма) connected records: з
ALL угоду можна вважати «готовою», лише коли виконані всі її запити на демо, з ANY — вистачить
одного.

**Дії** на тригер:

| дія | що задаєш |
|---|---|
| створити connected record у пов'язаному модулі | модуль і дані нового запису |
| оновити наявний connected record | модуль, поле, значення і які записи: `All Records`, `Current Records` чи `Selected Records` |
| сповістити користувачів листом | кого сповіщати (або адресу) і шаблон листа |

Важлива примітка до оновлення: поле *поточного* запису оновлюється, лише коли модуль тригера й модуль
оновлення збігаються. Тригер у Training і оновлення в Accounts — різні модулі, тож `Current Records`
там не спрацює.

**Ризик: дія «оновити connected record» на модуль, якого нема на полотні, не виконується.** Вікно дії
саме́ дозволяє обрати будь-який модуль (він просто не в списку, а знаходиться пошуком) і зберігається
без помилки — але якщо цей модуль ніколи не додавали в конструктор (ані вручну кнопкою **+**, ані
автоматично дією «створити»), дія мовчки не спрацьовує: запис не оновлюється, і ніде — ні тостом, ні в
Timeline цільового запису — про це не повідомляється. Це відтворюється і на записі, що пройшов увесь
ланцюжок, і на записі Training, створеному вручну й не пов'язаному з жодною угодою, — в обох випадках
Account Type цільового акаунта лишається порожнім.
Висновок для A16: якщо кейс 3 працює саме так у твоєму тріалі, додай Accounts у конструктор через
**Add Module**, перш ніж налаштовувати оновлення на нього, і обов'язково перевір результат на
реальному записі — «зберігся без помилки» тут не означає «спрацює».

Модуль потрапляє в connected workflow двома шляхами: автоматично — коли дія створює в ньому connected
record (сам стає видимим на полотні як дочірній вузол), або вручну — кнопкою **Add Module** на
заголовку батьківського модуля. Коли все готово — **Publish**.

**Правила гри** (довідка):
1. **Один connected workflow на primary module.** Для Deals другий не створиш.
2. **Лише нові записи.** Primary module діє тільки на записи, створені *після* налаштування
   connected workflow. Модуль, доданий пізніше, відстежує записи, створені після його додавання.
   Стара угода в процес не потрапить.
3. Працює лише в новому інтерфейсі CRM (створений workflow виконується й після повернення до
   старого).
4. Доступ: дозвіл **Manage Automation** або окремий дозвіл **Connected Workflows** у профілі.
5. Ліміти за редакціями:

   | | Standard | Professional | Enterprise | Ultimate |
   |---|---|---|---|---|
   | connected workflows | 2 | 2 | 10 | 10 |
   | модулів в одному workflow | 5 | 10 | 15 | 15 |
   | тригерів на модуль | 5 | 5 | 10 | 10 |
   | дій «створити connected record» | 3 | 3 | 3 | 3 |
   | дій «оновити поле» | 5 | 5 | 5 | 5 |
   | дій «сповістити» | 3 | 3 | 3 | 3 |

   Тому документ і просить один connected workflow з трьома кейсами, а не три окремі.

**Порядок виконання** з connected workflows (довідка): Assignment Rules → Review Process → Scoring
Rules → Workflow Rules → **Connected workflows** → Approval Process → Blueprint → CommandCenter.
Спершу відпрацьовують звичайні правила, потім connected workflow.

**Workflow rule чи connected workflow.** Workflow rule живе в одному модулі й уміє створити connected
record — один крок передачі. Connected workflow описує весь ланцюжок передач через кілька модулів в
одному місці: хто кому що передає і що оновлюється по дорозі.

## 13.5. Покроково: A16, частина 1 — модулі й ручний зв'язок

Мета A16: налаштувати потік даних між модулями через connected records і connected workflows, а
потім вручну перевірити поведінку. Primary organization module — **Deals**; team modules — **Product
Demo**, **Onboarding**, **Training**.

Що легко відкотити, а що ні (довідка): team module можна вимкнути перемикачем статусу в **Setup →
Customization → Modules and Fields** або видалити через меню модуля (**Delete** → **Yes, Delete
Now**); видалений connected record прибирає лише зв'язок. Connected workflow для Deals може бути
тільки один — зайвий кейс виправляй у ньому ж, другий для Deals не створиш.

**Крок 1. Три team modules.**
1. **Setup → Customization → Modules and Fields** → **Create New Module**.
   **Що побачиш:** вибір **Organization Modules** або **Team Modules**; для Team Modules — підказка
   «Team Module will be used for a user or for a group of users and it will be specific to a
   teamspace.»
2. **Team Modules** → **Next** відкриває редактор макета з назвою `Untitled`. Перейменуй її на
   `Product Demo` і натисни **Save and Close**: з'явиться попап **Module Details** з полями **Module
   Name**, **Plural Name**, **Singular Name** (обидва останні вже підставлені з того, що ти ввів, —
   лишай як є) → **Save**. Далі — попап **Teamspace permission**: обери теку (за замовчуванням **CRM
   Teamspace → Root**) → **Save**.
3. Повтори для `Onboarding` і `Training`.
   **Очікування:** три модулі в розділі **Team Module** сторінки модулів.

**Крок 2. Поля статусу.** Кейси connected workflow спираються на поля, яких у нових модулях нема:
- у Product Demo — picklist **Demo Status** із значенням `Completed` (плюс робочі, наприклад
  `Planned`, `Scheduled`);
- в Onboarding — picklist **Onboarding Status** із значенням `Completed` (плюс, наприклад,
  `Not Started`, `In Progress`).

Поле додаєш у редакторі layout модуля (у team module layout один): перетягни **Pick List** з панелі
**New Fields** у секцію (**Setup → Customization → Modules and Fields** → модуль → його layout).
Layout-редактор для team module відкривається так само, як для звичайного модуля (New Fields,
Components, Unused Items) — документ цих полів не описує, у тест-кейсах вкажи, які значення ти додав.

**Крок 3. Ручний зв'язок (Task 1, Manual Connection).**
1. Відкрий будь-яку угоду в Deals.
2. Прогорни до розділу **Connected Records** → **Add New**. Розділ **Connected Records** з'являється
   в списку вкладок картки одразу після **Notes**, щойно в організації є хоча б один team module, —
   і саме з власним **Add New**, як каже документ.
3. Обери **Product Demo**, заповни запит (назву, **Demo Status** `Planned`) і збережи.
   **Очікування (довідка):** новий запис Product Demo з'являється в розділі **Connected Records**
   угоди, і він уже пов'язаний з нею.
4. Відкрий створений запис Product Demo й переконайся, що зв'язок видно і з його боку.

Якщо розділу **Connected Records** в угоді нема — перевір, що team modules справді створені як
**Team Modules**, а не як організаційні.

## 13.6. Покроково: A16, частина 1 — правило і connected workflow

**Крок 4. Правило «Closed Won → Onboarding» (Task 1, Workflow Rule Connection).**
1. **Setup → Automation → Workflow Rules** → **Create Rule**: **Module** `Deals`, **Rule Name**,
   наприклад, `Deal_ClosedWon_Onboarding` → **Next**.
2. **Record action** → `Edit`. Документ каже «запис відредаговано так, що він відповідає умові» —
   це `Any field gets modified` з умовою на Stage (або `Specific field(s) gets modified` → **Stage**).
3. Прапорець **Repeat this workflow every time a record is edited** — **знятий**. Так правило
   спрацює в момент, коли угода *стала* `Closed Won`, а не на кожне наступне редагування закритої
   угоди. З Repeat кожне редагування такої угоди створювало б новий запис Onboarding.
4. Умова: **Stage** `is` `Closed Won`.
5. **Instant Actions** → **Create connected records**. Вікно дії питає:
   **Module** (`Onboarding`), **Layout** (`Standard`, єдиний), назву нового запису (наприклад,
   `Onboarding for closed deal`) і власника — **Onboarding Owner** з вибором **Users** та готовим
   варіантом **Logged In User** («The user who initiates the Record Act…») поруч із конкретним
   користувачем; обери себе. **Save**, потім ще раз **Save** — для самого правила.

Правило живе в Deals, тому Deals тут — модуль тригера, а Onboarding — цільовий модуль. Стадію угоди
змінюєш сам — ніякої ручної передачі онбордингу.

**Крок 5. Connected workflow (Task 2).**
1. **Setup → Process Management → Connected Workflow** → **Create New Connected Workflow**.
   **Що побачиш:** вікно з назвою, **Primary Module** і описом.
2. Назва, наприклад, `Deal Handoff`, **Primary Module** `Deals`, опис — `Demo, onboarding and
   training handoffs`.
3. Додай у workflow пов'язані модулі. Product Demo й Onboarding з'являються в угоді не через цей
   workflow (демо — вручну, онбординг — правилом), тож їх додаєш кнопкою **+**. Training
   з'явиться автоматично, коли кейс 2 створюватиме в ньому запис.
4. Три кейси:

   | кейс | модуль тригера | тригер і критерій | дія |
   |---|---|---|---|
   | 1 — сповіщення | Product Demo | змінено поле; `Demo Status is Completed` | сповістити листом Sales Team |
   | 2 — створення запису | Onboarding | змінено поле; `Onboarding Status is Completed` | створити connected record у Training |
   | 3 — оновлення поля | Training | створено запис | оновити в Accounts поле **Account Type** на `Customer` |

5. **Кейс 1.** Кого сповіщати: у тріалі «Sales Team» — це конкретні люди (наприклад, User B і
   User C) або адреса. Потрібен шаблон листа; якщо підходящого нема, створи його заздалегідь
   (**Setup → Customization → Templates → Email Templates**) з темою на кшталт `Product demo
   completed`.
6. **Кейс 3.** Тригер у Training, дія **Update Connected Record** оновлює **Account Type** в
   Accounts. Вікно дії дозволяє обрати Accounts прямо в полі **Module** (пошуком), не додаючи модуль
   на полотно заздалегідь, і зберігається без помилки. Але якщо Accounts ніколи не додавали на полотно
   кнопкою **Add Module**, дія **не виконується** — запис не оновлюється, і про це ніде не
   повідомляється. Тому спершу додай
   Accounts на полотно вручну (кнопка **Add Module** на заголовку Deal чи Training), і лише тоді
   налаштовуй **Update Connected Record**. Режим оновлення — не `Current Records` (модуль тригера
   інший); обери `All Records` або `Selected Records` і в тесті перевір, що змінився саме акаунт цієї
   угоди, а не інші, і що зміна взагалі відбулася.
7. **Publish**.

Після публікації зроби скриншоти кожного кейсу — вони знадобляться для звіту.

## 13.7. Покроково: A16, частина 2 — перевірка

Перевірка ручна: ти запускаєш тригери через інтерфейс і дивишся, чи з'явилися очікувані дії, — без
жодного коду.

**Головне правило: тільки нові угоди.** Connected workflow діє на записи primary module, створені
після налаштування. Угода, створена до **Publish**, у процес не потрапить. Тому для перевірки —
свіжа угода з заповненим **Account Name**; у її акаунта **Account Type** має бути не `Customer`
(наприклад, `Partner`), інакше кейс 3 нічого видимого не змінить.

| крок | дія | очікуваний результат |
|---|---|---|
| 1 | створи угоду з акаунтом, **Account Type** якого не `Customer` | угода створена |
| 2 | у **Connected Records** угоди створи запис Product Demo (**Add New**), **Demo Status** `Planned` | запис Product Demo пов'язаний з угодою |
| 3 | зміни **Demo Status** на `Completed` | кейс 1: лист отримувачам «Sales Team» |
| 4 | переведи угоду на `Closed Won` | правило: в угоді з'явився connected record Onboarding |
| 5 | у записі Onboarding зміни **Onboarding Status** на `Completed` | кейс 2: з'явився запис Training, пов'язаний у ланцюжку |
| 6 | відкрий акаунт угоди | кейс 3: **Account Type** = `Customer` |

Знімай стан **до і після** кожного кроку: список Connected Records угоди, поле акаунта, поштову
скриньку отримувача. Документ вимагає саме цього — «state before and after the trigger execution».

Якщо на Deals активний Blueprint на **Stage** з попередніх завдань, до `Closed Won` ведуть переходи.
Або тестуй на угоді поза Blueprint (інший layout), або перевір окремо, що правило спрацьовує й після
переходу Blueprint.

## 13.8. Як це тестувати

**Думай ланцюжком.** Тут шість ланок: ручний зв'язок, правило, три кейси connected workflow і зв'язок
угода → акаунт. Кожна ланка має свій тригер, критерій і дію. Спершу перевір ланки поодинці, потім
увесь ланцюжок наскрізь на одній угоді. Якщо наскрізний тест упав, поодинокі тести скажуть, на якій
ланці.

**Негативні й граничні випадки:**

| ланка | випадок | очікування |
|---|---|---|
| правило Closed Won | угоду створено одразу в `Closed Won` | Onboarding нема: тригер `Edit` |
| правило Closed Won | закриту угоду редагують ще раз (опис) | другого Onboarding нема (Repeat знятий) |
| правило Closed Won | угоду переводять на `Closed Lost` | Onboarding нема |
| правило Closed Won | `Closed Won` → інша стадія → знову `Closed Won` | за довідкою без Repeat правило спрацьовує, коли умова виконалася вперше, — другого Onboarding бути не повинно; зафіксуй фактичне |
| кейс 1 | **Demo Status** → `Scheduled` | листа нема |
| кейс 1 | нове демо до угоди, створеної до **Publish** | довідка тут неоднозначна: стара угода не відстежується, а нові записи пов'язаних модулів — відстежуються; зафіксуй, чи прийшов лист |
| кейс 2 | **Onboarding Status** → `In Progress` | Training не створено |
| кейс 3 | угода без **Account Name** | оновлювати нема що — зафіксуй поведінку |
| кейс 3 | запис Training створено вручну, поза ланцюжком | акаунт **не** оновлюється, якщо Accounts не додано на полотно (див. 13.4) |
| увесь ланцюжок | на `Closed Won` скільки записів Onboarding? | рівно один |

**Дублікати — головний ризик.** Onboarding створює правило з Task 1. Якщо ту саму передачу додати ще
й у connected workflow (як у прикладі Zoho, де Closed Won створює онбординг саме там), на одну угоду
вийде два записи. Рахуй записи в Connected Records після кожного кроку.

**Доступ.** Team modules бачать тільки додані в них люди. Якщо тестуєш під User B чи User C, спершу
додай їх у модулі через **Manage User Access**, інакше «модуль не видно» — не дефект, а налаштування.

**Сповіщення.** Для кейсу 1 доказ — лист у скриньці отримувача (тема, час, для якого запису).
Перевір і отримувача, якого там бути не повинно.

**Зразок рядка матриці** (Zoho Sheet):

| TC ID | Flow | Preconditions | Steps | Expected result | Actual result | Status | Evidence |
|---|---|---|---|---|---|---|---|
| TC-CW-01 | Case 1: Demo Status → Completed | connected workflow `Deal Handoff` опубліковано; угода створена після публікації; демо в стані `Planned` | 1. Відкрити демо з Connected Records угоди. 2. Demo Status → `Completed`. 3. Save. 4. Перевірити пошту отримувачів | лист про завершене демо отримали User B і User C | … | PASS / FAIL | `CW-01-before.png`, `CW-01-after.png`, `CW-01-mail.png` |

---

## 13.9. Типові помилки

**1. Модуль створено як організаційний.** Тоді він не з'являється серед варіантів **Add New** у
Connected Records.

**2. Перевірка на старій угоді.** Connected workflow відстежує тільки записи, створені після
налаштування, — стара угода мовчить, і здається, що нічого не працює.

**3. Repeat у правилі Closed Won.** Кожне редагування закритої угоди створює ще один Onboarding.

**4. Onboarding створюють два механізми.** Правило з Task 1 і кейс у connected workflow на ту саму
подію дають дублікати.

**5. Нема полів статусу.** **Demo Status** і **Onboarding Status** не існують у нових модулях, поки
їх не додаси; кейси 1 і 2 нема на чому будувати.

**6. `Current Records` для кейсу 3.** Модуль тригера (Training) не збігається з модулем оновлення
(Accounts) — поле поточного запису не оновиться.

**7. Шукають пункт «Connected Workflows».** У меню він в однині: **Connected Workflow**.

**8. Забутий Publish.** Налаштування є, але процес не діє.

**9. Людина в teamspace, але не в модулі.** Модуль їй не видно — це доступ, а не дефект.

**10. Нема видимої зміни.** Акаунт уже був `Customer` — кейс 3 «пройшов», нічого не довівши.

### Симптом → причина

| симптом | найімовірніша причина |
|---|---|
| у картці угоди нема розділу **Connected Records** | в організації ще нема жодного team module |
| **Add New** не пропонує потрібний модуль | модуль створено як організаційний, а не team module |
| колега не бачить Product Demo | його не додали в модуль через **Manage User Access** (teamspace доступу не дає) |
| у записі team module нема нотаток і вкладень | для профілів team module вони вимкнені за замовчуванням |
| угода стала `Closed Won`, Onboarding нема | угоду створено одразу закритою (тригер `Edit`); правило вимкнене; умова не на `Closed Won` |
| на кожне редагування закритої угоди — новий Onboarding | Repeat у правилі увімкнений |
| на одну угоду два Onboarding | передачу налаштовано і правилом, і в connected workflow |
| кейс не спрацьовує на наявних записах | connected workflow діє тільки на записи, створені після налаштування |
| не вдається створити другий connected workflow для Deals | один connected workflow на primary module |
| лист кейсу 1 не прийшов | Demo Status змінено не на `Completed`; не вибрано отримувачів чи шаблон; workflow не опубліковано; лист у спамі |
| Training створено, а Account Type не змінився | угода без акаунта; режим `Current Records`; Accounts не додано в workflow |
| змінилися акаунти інших угод | режим оновлення `All Records` зачепив більше, ніж треба |

---

## 13.10. Що варто запам'ятати

1. Organization module — для всієї організації; team module — для команди, доступ дає сам модуль,
   а не teamspace.
2. Organization module не може мати lookup на team module — зв'язок дають connected records.
3. Connected record створюють вручну (**Connected Records** → **Add New**) або правилом (**Create
   connected records**); видалення прибирає лише зв'язок.
4. Connected workflow будується навколо primary module; тригери — у будь-якому з його модулів; дії —
   створити, оновити, сповістити; без **Publish** не діє.
5. Один connected workflow на primary module; діє лише на записи, створені після налаштування.
6. `Current Records` оновлює поточний запис лише тоді, коли модуль тригера й оновлення той самий.
7. Порядок: workflow rules → connected workflows → approval → Blueprint.
8. Правило «на подію один раз» — без Repeat; інакше дублікати.
9. Ланцюжок тестуй поланково, потім наскрізь, і рахуй записи після кожного кроку.
10. Доказ передачі — стан до і після в обох модулях.

---

# Задачі

*Для практичних задач потрібен тріал із правами адміністратора; модуль Deals і поле Account Type
акаунтів (значення `Customer`, `Partner`) у ньому є.*

**13.1.** Поясни своїми словами: чим team module відрізняється від кастомного організаційного
модуля; чому з угоди не можна зробити lookup на Product Demo, а з Product Demo на угоду — можна; що
дає connected record, чого не дає lookup.

**13.2.** Connected workflow для Deals опубліковано 10-го числа о 12:00. Передбач, чи відпрацює кейс
«Demo Status → Completed → лист» у кожному випадку, і поясни:
а) угода створена 9-го, демо до неї — 11-го, статус змінено 11-го;
б) угода створена 10-го о 12:30, демо — одразу, статус змінено наступного дня;
в) угода створена 11-го, статус демо змінено на `Scheduled`;
г) те саме, що б), але connected workflow не опубліковано, а лише збережено.

**13.3.** Знайди помилки. Колега налаштував: правило для Deals — `Create or Edit`, умова `Stage is
Closed Won`, Repeat увімкнений, дія **Create connected records** → Onboarding; у connected workflow
для Deals — ще тригер «запис змінено», критерій `Stage is Closed Won`, дія — створити connected record
в Onboarding. Скільки записів Onboarding отримає угода, яку створили в `Qualification`, потім
закрили, а потім двічі виправили в ній опис? Що виправити?

**13.4.** *(A16, частина 1, підготовка)* Створи в **Setup → Customization → Modules and Fields →
Create New Module → Team Modules** три team modules: `Product Demo`, `Onboarding`, `Training`.
Додай у Product Demo picklist **Demo Status**, а в Onboarding — picklist **Onboarding Status**; в
обох має бути значення `Completed`. Primary organization module — Deals.

**13.5.** *(A16, Task 1)* Налаштуй зв'язки між Deals і team modules:
- ручний: у будь-якій угоді в розділі **Connected Records** натисни **Add New** і створи пов'язаний
  запит у Product Demo;
- правилом: **Setup → Automation → Workflow Rules**, нове правило для Deals, що спрацьовує, коли
  угоду відредагували так, що `Stage is Closed Won`; миттєва дія **Create connected records** — запис
  у модулі Onboarding.

Поясни, як ти виставив Repeat і чому.

**13.6.** *(A16, Task 2)* Налаштуй один connected workflow: **Setup → Process Management → Connected
Workflow** → **Create New Connected Workflow**, primary module — Deals, три кейси:
1. тригер у Product Demo: поле **Demo Status** змінено на `Completed` → сповістити Sales Team листом;
2. тригер в Onboarding: поле **Onboarding Status** змінено на `Completed` → створити connected record
   у Training;
3. тригер у Training: створено новий запис → оновити поле **Account Type** пов'язаного акаунта
   (Accounts) на `Customer`.

Опублікуй і зроби скриншоти кожного кейсу.

**13.7.** *(A16, частина 2)* Склади в Zoho Sheet матрицю тест-кейсів для трьох основних кейсів
connected workflow (плюс ручний зв'язок і правило з Task 1): позитивні й негативні випадки, колонки
TC ID | Flow | Preconditions | Steps | Expected result | Actual result | Status | Evidence.

**13.8.** *(A16, частина 2)* Виконай матрицю вручну на свіжій угоді й зафіксуй візуальні докази:
записи екрана або підписані скриншоти стану до і після кожного тригера. Поклади матрицю й медіа в
одну папку WorkDrive (медіа можна й у Zoho Show) і надішли в чат одне публічне посилання.

**13.9.** *(складніша)* Спроєктуй на папері процес із прикладу документа: team module `Renewals`
і організаційний модуль `Invoices`. Коли рахунок доходить до кінцевого стану, має з'явитися запис
у Renewals і лист фахівцю з продовжень. Що буде primary module? Які тригери й дії? Які три тести ти
написав би першими і який ризик із правила «лише нові записи» тут найнебезпечніший?

**13.10.** Порівняй: передача «Closed Won → Onboarding» через workflow rule і через кейс connected
workflow. Що спільного, чим відрізняються, коли обрав би кожен варіант?

---

# Розв'язки

**13.1.** Team module — це кастомний модуль, яким керує команда: він живе в teamspace команди, має
один layout і доступний лише тим, кого додали в нього з профілем (Admins, Managers, Members,
Participants, Requesters). Кастомний організаційний модуль доступний усім за профілями CRM і
керується адміністраторами CRM. Lookup: team module може посилатися на організаційний модуль, тож
Product Demo → Deals можна; організаційний модуль на team module посилатися не може, тож Deals →
Product Demo — ні. Connected record дає угоді багато пов'язаних записів у team modules, створюється
будь-коли з картки або правилом і показується окремим розділом; lookup — одне поле з одним записом,
яке налаштовують заздалегідь і яке workflow створити не може.

**13.2.**
а) Найімовірніше, ні: угоду створено до налаштування, а primary module — точка входу процесу й
відстежує лише записи, створені після налаштування. Водночас довідка каже, що записи пов'язаних
модулів, створені після додавання модуля, відстежуються, а демо створено 11-го. Тому прогноз
обережний: це граничний випадок, який треба прогнати й записати фактичну поведінку.
б) Так: угода створена після налаштування, демо пов'язане з нею, статус став `Completed`.
в) Ні: критерій `Demo Status is Completed` не виконано.
г) Ні: без **Publish** процес не діє.

**13.3.** Помилки: `Create or Edit` (досить `Edit`), увімкнений Repeat і дублювання передачі в
connected workflow. Прогноз для угоди «створено в `Qualification` → закрито → два редагування опису»:
- створення: умова не виконана — нічого;
- закриття: спрацьовує правило (ні → так) — **1**; спрацьовує кейс connected workflow — **2**;
- два редагування опису: правило з Repeat на «так → так» — **+2**; кейс connected workflow на «запис
  змінено» з виконаним критерієм — імовірно ще **+2** (як поводиться його тригер на повторні
  редагування, довідка не уточнює — це треба перевірити).

Разом від 4 до 6 записів замість одного. Виправлення: у правилі `Edit`, Repeat знятий; з connected
workflow прибрати кейс Closed Won → Onboarding (або навпаки — залишити передачу лише там і вимкнути
правило). Один механізм на одну передачу.

**13.4.** Кінцевий стан: у розділі **Team Module** сторінки модулів — `Product Demo`, `Onboarding`,
`Training`, кожен у teamspace. У Product Demo — **Demo Status** (наприклад, `Planned`, `Scheduled`,
`Completed`), в Onboarding — **Onboarding Status** (наприклад, `Not Started`, `In Progress`,
`Completed`). У тест-документі записано, які значення додано і чому.

**13.5.**
- Ручний зв'язок: у **Connected Records** угоди — запис Product Demo; у самому записі видно угоду.
- Правило: **Module** `Deals`; **Record action** → `Edit` (`Any field gets modified` або `Specific
  field(s) gets modified` → **Stage**); Repeat **знятий**; умова `Stage is Closed Won`; **Instant
  Actions** → **Create connected records** → модуль `Onboarding`, layout, власник (і назва запису,
  якщо форма її просить).

Repeat знятий, бо онбординг потрібен один раз — у момент, коли угода *стала* `Closed Won`. З Repeat
кожне редагування закритої угоди (перехід «так → так») створювало б ще один запис.

**13.6.** Кінцевий стан connected workflow `Deal Handoff` (primary module Deals, опубліковано):

| кейс | модуль тригера | тригер | критерій | дія |
|---|---|---|---|---|
| 1 | Product Demo | змінено поле | `Demo Status is Completed` | лист отримувачам «Sales Team» (напр. User B, User C) за шаблоном `Product demo completed` |
| 2 | Onboarding | змінено поле | `Onboarding Status is Completed` | створити connected record у Training |
| 3 | Training | створено запис | — | оновити Accounts: **Account Type** = `Customer`, режим не `Current Records` |

Product Demo й Onboarding додані в workflow вручну, Training — через дію кейсу 2, Accounts — так, як
запропонував конструктор (спосіб записано).

**13.7.** Приклад матриці:

| TC ID | Flow | Preconditions | Steps | Expected result |
|---|---|---|---|---|
| TC-T1-01 | Manual connection | є team module Product Demo | угода → Connected Records → Add New → Product Demo → Save | демо в Connected Records угоди |
| TC-T1-02 | Rule: Closed Won | правило активне; угода в `Qualification` | Stage → `Closed Won` | один запис Onboarding в Connected Records |
| TC-T1-03 | Rule: negative | те саме | створити угоду одразу в `Closed Won` | Onboarding нема |
| TC-T1-04 | Rule: no duplicates | угода вже `Closed Won` з одним Onboarding | змінити опис | досі один Onboarding |
| TC-CW-01 | Case 1 | угода створена після Publish, демо `Planned` | Demo Status → `Completed` | лист отримувачам |
| TC-CW-02 | Case 1 negative | те саме | Demo Status → `Scheduled` | листа нема |
| TC-CW-03 | Case 2 | Onboarding угоди `In Progress` | Onboarding Status → `Completed` | запис Training у ланцюжку |
| TC-CW-04 | Case 2 negative | Onboarding `Not Started` | Onboarding Status → `In Progress` | Training нема |
| TC-CW-05 | Case 3 | акаунт угоди `Partner` | дочекатися кроку TC-CW-03 | Account Type = `Customer` |
| TC-CW-06 | Old record | угода створена до Publish | пройти кейс 1 | листа нема (правило «лише нові записи»; довідка тут неоднозначна — фактичне записати) |

**13.8.** На кожен тест-кейс — пара доказів «до / після»: список Connected Records угоди, поле
**Account Type** акаунта, пошта отримувача з темою й часом. Відео наскрізного ланцюжка —
найпереконливіший доказ. Папка WorkDrive з матрицею й медіа, доступ «Anyone with the link can view»,
одне посилання в чат.

**13.9.** Primary module — Invoices: процес починається з рахунку. Тригер у Invoices: змінено поле
статусу рахунку, критерій — кінцевий стан. Дії: створити connected record у Renewals і сповістити
фахівця листом. Перші тести: рахунок доходить до кінцевого стану → запис у Renewals і лист; рахунок
у проміжному стані → нічого; повторне збереження рахунку в кінцевому стані → не створюється другий
запис. Найнебезпечніший ризик: connected workflow діє лише на рахунки, створені після налаштування.
Рахунки, що вже були в системі в день запуску, продовжень не отримають — і ніхто цього не помітить,
бо помилки не буде. Потрібен окремий план для наявних рахунків.

**13.10.** Спільне: обидва варіанти створюють пов'язаний запис в Onboarding за подією в угоді.
Відмінності: правило живе в модулі Deals і нічого не знає про наступні кроки; connected workflow
тримає весь ланцюжок (демо, онбординг, навчання, акаунт) в одному місці, має обмеження «один на
primary module» і «лише нові записи», а порядок виконання ставить його одразу після workflow rules.
Правило — коли потрібна одна передача або коли connected workflow уже зайнятий для модуля; connected
workflow — коли передач кілька і їх треба бачити й підтримувати як єдиний процес. Головне — не
дублювати одну передачу в обох.

---

## Ворота уроку

- [ ] пояснюєш, чим organization module відрізняється від team module і хто дає доступ до team module;
- [ ] називаєш п'ять профілів team module і що може кожен;
- [ ] пояснюєш, чому з угоди не можна зробити lookup на team module і що замість цього дають
  connected records;
- [ ] створюєш connected record вручну і правилом **Create connected records**;
- [ ] знаєш, що видалення connected record прибирає тільки зв'язок;
- [ ] описуєш тригери й дії connected workflow і що змінює режим `Current Records`;
- [ ] пам'ятаєш обмеження «один connected workflow на primary module» і «лише записи, створені після
  налаштування», і як вони впливають на тести;
- [ ] називаєш місце connected workflows у порядку виконання автоматизацій;
- [ ] пояснюєш, чому правило Closed Won — без Repeat, і як виявити дублікати;
- [ ] тестуєш ланцюжок поланково й наскрізь і фіксуєш стан до і після в обох модулях;
- [ ] три team modules, поля статусу, ручний зв'язок, правило й connected workflow A16 налаштовані;
- [ ] матриця тест-кейсів і візуальні докази здані одним публічним посиланням;
- [ ] задачі 13.3, 13.9 і 13.10 розв'язані без підглядання.
