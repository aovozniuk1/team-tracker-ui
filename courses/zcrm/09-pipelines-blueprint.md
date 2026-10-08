# Урок 9. Pipelines і Blueprint: два процеси продажу в одному модулі

*Після уроку ти вмієш розвести в модулі Deals два процеси продажу — кожен зі своїм layout і своїм
pipeline — і прив'язати blueprint лише до одного з них. А як QA доводиш, що процеси справді
ізольовані. Помилка ізоляції не показує червоного повідомлення: вона тихо пускає угоду не тим
шляхом, і знаходить її тільки той, хто перевіряє це навмисно.*

## Коротко

*Картка уроку: прочитай її перед уроком і повернись до неї після.*

**Одним реченням.** Два процеси продажу в Deals розводять трьома вкладеними важелями: layout — поля, pipeline — стадії, blueprint — рух між ними.

**Навіщо.** Окремий модуль розірвав би звітність; так звіти спільні, а процеси ізольовані.

**Де.** **Setup → Customization → Modules and Fields → Deals → Layouts**; **Setup → Customization → Pipelines**; **Setup → Process Management → Blueprint**.

**Модель**

- **Layout → Pipeline → Stage** — вкладений ланцюжок; ізоляція — на кожній ланці.
- **Layout** — розділи й поля угоди та їхня обов'язковість.
- **Pipeline** — упорядкований набір стадій; лише в Deals; належить одному layout.
- **Стадія** — **Probability**, **Record Category**, **Forecast Category**; одні значення в усіх pipelines.
- **Умова входу** — з якої стадії угода потрапляє в blueprint.

**Запам'ятай**

1. Ймовірність і категорії належать стадії, не pipeline: зміна діє всюди, де ця стадія є.
2. Перший pipeline створює **Standard** з наявними угодами й Stage-blueprints; відкотити непросто — краще в sandbox.
3. Ізоляцію полів дає лише склад layout; field permission діє на всі layouts модуля.
4. Клон layout забирає всі поля: клонуй, поки в джерелі немає полів іншого процесу.
5. Stage-blueprint у layout з pipelines прив'язаний до одного pipeline; **Choose Pipeline** підставляє **Standard** — міняй вручну.

**Пастки** (симптом → причина)

- В угоді видно поля іншого процесу → layout клоновано вже з ними.
- У полі **Pipeline** є чужий pipeline → pipeline створено з не тим **Layout**.
- **Stage** заблоковане, кнопок немає → угода в blueprint у стадії без переходів (бракує умови входу) або ти не власник.

**Як перевірити**

- Ізоляція: в угоді іншого layout — лише свої поля, pipeline і стадії; blueprint не спрацьовує.
- Регресія: після зміни ймовірності стадії перевір **Standard** і наявні угоди (**Probability**, **Expected Revenue**).

---

## 9.1. Задача: два процеси в одному модулі

Контекст завдання — постачальник B2B SaaS, у якого два способи продавати:

- **Motion A, Net-New Business** — нові корпоративні клієнти. Довгий цикл: технічна валідація,
  потім сувора юридична процедура узгодження контракту.
- **Motion B, Client Renewals** — продовження контрактів наявних клієнтів. Коротший цикл, що
  спирається на «здоров'я» клієнта і аудит використання продукту.

Обидва процеси — це угоди (Deals): їх рахують ті самі звіти й прогнози, у них конвертуються ліди.
Окремий модуль для продовжень був би поганою ідеєю: ти розірвав би звітність і дублював би
налаштування. Правильний шлях — один модуль і три важелі, які Zoho дає саме для цього:

| важіль | що визначає | де налаштовується | що бачить користувач |
|---|---|---|---|
| Layout | які розділи й поля має угода і які з них обов'язкові | **Setup → Customization → Modules and Fields → Deals → Layouts** | форму створення і сторінку запису |
| Pipeline | який набір стадій доступний угоді | **Setup → Customization → Pipelines** | поле **Pipeline** і значення в полі **Stage** |
| Blueprint | як угоді дозволено рухатися між стадіями | **Setup → Process Management → Blueprint** | кнопки переходів замість вільного редагування **Stage** |

Ці важелі вкладені один в одного: **Layout → Pipeline → Stage**. Pipeline належить рівно одному
layout, а в одному layout може бути кілька pipelines. Stage-blueprint належить одному layout, а
коли в layout з'являються pipelines — одному pipeline. У такому самому порядку Zoho перевіряє
угоду при масовому оновленні чи імпорті: спершу layout, потім pipeline, потім стадія.

Звідси головна думка уроку для тестувальника: **ізоляція тримається на кожній ланці ланцюжка**, і
тест має атакувати кожну — поля (layout), список pipelines і стадій (pipeline), поведінку переходів
(blueprint).

## 9.2. Layout: одна сутність — різні форми

Layout (page layout) — форма модуля: розділи (sections), поля в них і властивості цих полів. У
кожного модуля є **Standard** layout. Далі два шляхи: перейменувати й підлаштувати Standard або
створити новий layout. Новий створюється кнопкою **Create New Layout** на сторінці layouts модуля, і
Zoho пропонує обрати layout, з якого його клонувати. Клон забирає **всі** поля й розділи разом з
їхніми властивостями — для ізоляції це важливо, про це нижче.

Що належить модулю, а що — layout'у:

| річ | рівень | наслідок для завдання |
|---|---|---|
| саме поле (тип, дані в записах) | модуль | поле, створене в одному layout, можна додати і в інший |
| присутність поля на формі | layout | нема поля в layout — його не видно в угодах цього layout |
| обов'язковість та інші властивості поля | layout | Software Tier може бути обов'язковим в одному layout і відсутнім в іншому |
| доступ до поля за профілем (field permission) | модуль, **не** layout | зміна діє на всі layouts модуля, тож для ізоляції процесів не годиться |
| доступ до layout за профілем | layout | після **Save** Zoho питає профілі у вікні **Layout Permission** |

Поле, яке прибрали з layout, не зникає з CRM: воно йде в **Unused Items** цього layout і
повертається звідти перетягуванням разом з даними. Коли в модулі з'являється другий layout, у
записів з'являється системне поле **Layout** — за ним фільтрують списки і будують умови. Угоди, які
існували раніше, лишаються в Standard layout.

## 9.3. Pipeline: набір стадій для одного процесу

**Pipeline** (воронка продажу) — упорядкований набір стадій, через які проходить угода певного
типу. Pipelines є тільки в модулі Deals; налаштовує їх користувач з дозволом **Module
Customization** у профілі.

### Стадія та її ймовірність

Стадії — це значення поля **Stage**. У layout є головний список стадій, і pipelines беруть свої з
нього. Кожна стадія має чотири властивості — ти побачиш їх у вікні **Stage-Probability Mapping**:

| властивість | що означає | значення |
|---|---|---|
| **Stage Name** | назва стадії | довільна |
| **Probability** | ймовірність виграти угоду на цій стадії, 0–100 %; з неї та **Amount** рахується **Expected Revenue** | число |
| **Record Category** | загальний стан угоди | `Open` — ще в циклі, `Closed Won` — виграна, `Closed Lost` — програна |
| **Forecast Category** | як стадія потрапляє в прогноз | `Pipeline`, `Closed`, `Omitted` |

Record Category і Forecast Category пов'язані: відкритій угоді відповідає `Pipeline`, виграній —
`Closed`, програній — `Omitted`. Звіти й цілі продажу дивляться на категорію, а не на назву:
угода в стадії `Churned` рахуватиметься програною, тільки якщо в `Churned` стоїть `Closed Lost`.

**Ймовірність належить стадії, а не pipeline.** Якщо одна стадія стоїть у кількох pipelines, в
усіх у неї одне значення. Сам Zoho попереджає ширше: зміна назви, ймовірності чи категорій наявної
стадії відобразиться в усіх layouts модуля. У Deals стадія `Value Proposition` за замовчуванням має
40 %. Завдання хоче 50 %, отже після зміни буде 50 % всюди, де є ця стадія, зокрема в pipeline
`Standard` (про нього — нижче). Змінюючи Net-New, ти змінюєш і чужі угоди — це регресія, яку треба
перевірити. Ймовірність наявних стадій можна виправити просто з екрана створення pipeline, а
повний список стадій — у **Setup → Customization → Modules and Fields**, меню More біля модуля
Deals → **Stage-Probability Mapping**.

### Діалог Create New Pipeline

На сторінці **Setup → Customization → Pipelines** кнопка **Create New Pipeline** (так вона підписана,
поки pipelines ще немає; далі — **+ New Pipeline**) відкриває діалог:

- **Pipeline Name** — назва;
- **Layout** — до якого layout належить pipeline;
- **Stages** — стадії: обираєш наявні або додаєш нові через **Create New Stage**. Воно відкриває
  **Stage-Probability Mapping** з полями Stage Name, Probability, Record Category, Forecast
  Category. Нова стадія потрапляє в головний список стадій layout'у;
- **Set as Default** — цей pipeline підставлятиметься в нову угоду цього layout.

Обрати pipeline автоматично, за правилом, при створенні угоди не можна: або спрацьовує default, або
користувач обирає сам. У полі **Pipeline** угоди видно тільки pipelines її layout'у. Перенести угоду
в інший pipeline того ж layout можна вручну або через Mass Update; у pipeline іншого layout — тільки
змінивши спершу layout угоди.

### Pipeline Standard з'являється сам

Коли в org створюють **перший** pipeline, Zoho створює ще й системний pipeline **Standard**: у нього
йдуть стадії з поля Stage, до нього прив'язуються наявні угоди — щоб кожна угода належала якомусь
pipeline. Туди ж потрапляють наявні blueprints на полі Stage. Довідка Zoho додає умову: Standard не
створюється, якщо в layout немає записів або немає blueprint на полі Stage; FAQ Zoho каже коротше —
якщо в Deals немає записів. Формулювання неоднозначне, тож не вгадуй: після збереження першого
pipeline відкрий список і подивись. У тріалі, де вже є угоди, очікуй Standard у тому layout, де ці
угоди лежать.

Відкотити це непросто. Standard можна перейменувати і переналаштувати. Щоб видалити pipeline з
угодами, Zoho змусить перенести відкриті угоди в інший pipeline того ж layout (закриті лишаються у
видаленому), а blueprints видаленого pipeline зникнуть разом з ним. Якщо маєш sandbox, це вагомий
аргумент зробити завдання там.

## 9.4. Blueprint, прив'язаний до pipeline

Коротко про модель. Blueprint будується на picklist-полі (для Deals — **Stage**). **Стан** (State) —
значення цього поля. **Перехід** (Transition) — зв'язок двох станів, який на сторінці запису стає
кнопкою. У переходу три частини:

- **Before** — хто може виконати перехід (**Owners**) і за якої умови кнопка з'являється;
- **During** — що користувач мусить заповнити у вікні переходу;
- **After** — що система зробить автоматично після переходу.

Будувати blueprints може користувач з дозволом **Manage Automation** у профілі; виконати перехід —
той, кого вказано в Before → Owners.

### Що змінюють pipelines

- Зазвичай blueprint прив'язаний до layout. Якщо в layout є pipelines, Stage-blueprint
  прив'язується до **одного pipeline**: створюючи blueprint на полі Stage, Zoho просить обрати
  pipeline. У завданні це рядок **Target Pipeline**. В org без pipelines діалог **Create new
  Blueprint** має лише **Blueprint name**, **Module**, **Choose Layout**, **Choose field**,
  criteria, **Description** і **Advanced configuration**: поле вибору pipeline (підписане в
  інтерфейсі Zoho **Choose Pipeline**) з'являється одразу під
  **Choose field**, тільки коли там обрано `Stage` і в обраному layout уже є pipelines — не
  раніше. За замовчуванням воно підставляє системний **Standard**, а не той pipeline, що ти
  щойно створив, тож обери потрібний вручну.
- Нова стадія, яку ти додаєш у blueprint, автоматично з'являється і в pipeline.
- Видалив pipeline — видалив і його blueprints.

### Що бачить користувач

Поки угода в blueprint, поле **Stage** заблоковане для ручного редагування: у формі Edit воно тільки
для читання, а на сторінці запису замість звичайної смуги стадій видно смугу blueprint — поточний
стан, кнопки доступних переходів і посилання **View configured actions**. Клік по кнопці відкриває
вікно переходу з усім, що налаштовано в During. Коли запис доходить до стану, з якого немає
переходів, процес для нього закінчується: смуга blueprint зникає, поле знову вільне (так поводиться
blueprint на лідах у sandbox тріалу; для угод перевір сам). За довідкою, переходи, що чекають саме на
тебе, збираються в **Workqueue → My Jobs → Blueprint**; у тріалі цей розділ показував лише стартовий
екран Workqueue (урок 8), тож перевір сам.

### Чотири речі, які ламають тести

1. **Критерій входу.** Запис входить у blueprint, коли відповідає criteria; без criteria, за
   довідкою, входять усі записи layout'у (pipeline). Довідка прямо описує вхід нових записів; що
   запис увійде й пізніше, коли редагування доведе його до criteria, — перевір це на першій
   тестовій угоді. А якщо стадія угоди — не стан цього blueprint, довідка
   описує результат так: запис у процесі, але переходів не бачить. Поле Stage при цьому
   заблоковане — угода застрягла. У нашому blueprint лише три стани (`Value Proposition`,
   `Contract Negotiation`, `Closed Won`), а угоди починають з `Qualification`. Тому раджу умову
   входу **Stage = Value Proposition**: угода вільно доходить до Value Proposition і входить у
   процес саме там. Записи вручну включають у процес і виймають з нього на сторінці blueprints:
   вкладка **Filters** → **Include** або **Exclude**.
2. **Адміністратор бачить усі переходи**, навіть коли він не власник переходу. Під адміном
   обмеження Owners не перевірити — потрібен користувач з іншим профілем.
3. **Один запис — один blueprint.** Якщо запис підходить під кілька blueprints, спрацьовує той, що
   вище в списку; порядок змінюється на сторінці списку.
4. **Blueprint не охороняє прямі записи в поле.** Довідка перелічує канали, якими поле blueprint
   змінюється без переходів: Transition API, Workflow API, функції у workflow, field update у
   workflow і в CommandCenter (workflow rule — правило, яке саме оновлює поля за подією; field
   update — його дія «записати значення в поле»). Для людини у формі поле заблоковане, для
   автоматизації — ні. Порядок виконання автоматизацій у Zoho: assignment rules → workflow rules →
   approval process → Blueprint → case escalation rules. Повний ланцюг — з рев'ю, scoring і connected
   workflows — в уроках 12–14.

### Налаштування переходу: що де

**During** наповнюється через **+Add**: **Field** (поле цього або пов'язаного модуля, позначка
**Mark as** Mandatory чи Optional і за потреби **+ Validation**), **Checklist**,
**Associated Items**, **Message** (до 300 символів), **Tags**, **Widgets**, **Kiosks**. В
**Associated Items** — Tasks, **Notes**, **Attachments**, Meetings, Cases, **Invoices**, Sales
Orders, Calls, Quotes; нотатки і вкладення можна позначити
Mandatory або Optional. За замовчуванням усе, що ти додав у During, обов'язкове: щойно доданий
пункт одразу стоїть на Mandatory, без окремого кліка.

**Куди переходить угода, задає стрілка переходу** — стан, до якого ти провів перехід на канві.
**After** стрілку не замінює: там лише дії — email-сповіщення, задача, зустріч, дзвінок, оновлення
полів, створення запису, webhook, функція, теги, конвертація.

Назва переходу — до 50 символів. Готовий blueprint або публікуєш (**Publish** — і записи починають
входити в процес), або зберігаєш чернеткою (**Save as Draft**). Чернетка — полотно для схеми, а не
тестове середовище: виконати її на записах не можна. Після публікації перевір у списку blueprints,
що він увімкнений: довідка попереджає, що blueprint може бути вимкнений за замовчуванням.

## 9.5. Покроково: Phase I, Step 1 — layouts

Працюєш як адміністратор CRM, тільки стандартними засобами Zoho. Якщо маєш sandbox, роби завдання
там: перший pipeline змінює модуль Deals надовго.

**Порядок має значення.** Спершу створи Client Renewals, а поля Net-New додавай потім — інакше клон
потягне їх за собою.

1. Відкрий **Setup → Customization → Modules and Fields → Deals → Layouts**.
2. Відкрий **Standard** layout і перейменуй його на `Enterprise Net-New`. Збережи.

   **Що побачиш:** у списку layouts Deals — `Enterprise Net-New`; наявні угоди лишились у ньому.
3. Натисни **Create New Layout**, клонуй з `Enterprise Net-New`, назви `Client Renewals`.
4. У `Client Renewals` створи розділ `Retention Metrics` і додай у нього поля. Поле перетягуєш з
   лотка нових полів ліворуч у розділ, даєш назву і властивості; значення picklist задаєш у
   властивостях поля. Обов'язковість — іконка налаштувань поля → **Mark as required**.

   | поле | тип | значення | обов'язкове |
   |---|---|---|---|
   | `Current Contract Expiry` | Date | — | так |
   | `Churn Risk Profile` | Pick List | `Low`, `Medium`, `High`, `Critical` | ні |

5. **Save**. У вікні **Layout Permission** відміть профілі, яким потрібен цей layout:
   щонайменше Administrator і профілі тестових користувачів.
6. Поверніся в `Enterprise Net-New`, створи розділ `Technical & Implementation Details` і додай:

   | поле | тип | значення | обов'язкове |
   |---|---|---|---|
   | `Software Tier` | Pick List | `Basic`, `Professional`, `Enterprise` | так |
   | `Target Go-Live Date` | Date | — | ні |
   | `Implementation Required` | Checkbox | — | ні |

7. **Save**.

**Що побачиш:** при створенні угоди Zoho тепер питає, в якому layout її створити; у `Client
Renewals` немає розділу Technical & Implementation Details, а в `Enterprise Net-New` — розділу
Retention Metrics.

Рядок завдання «Add/rename stages according to the assignment stages» стосується стадій, і це
робиться в наступному кроці. Не перейменовуй системні стадії (скажімо, `Needs Analysis` на
`Technical Validation`): перейменування зачепить усі наявні угоди і pipeline Standard, а поки на
полі Stage є blueprint, значення picklist узагалі не редагуються. Нові стадії створюй через
**Create New Stage**.

Що легко відкотити: назву layout, розміщення полів (прибране поле йде в **Unused Items**),
обов'язковість. Що ні: видалення поля з **Unused Items** — разом з ним зникають дані.

## 9.6. Покроково: Step 2 — pipelines

1. Відкрий **Setup → Customization → Pipelines**, натисни **Create New Pipeline**.
2. **Pipeline Name** — `Net-New Pipeline`, **Layout** — `Enterprise Net-New`.
3. У **Stages** обери наявні стадії, відсутні створи через **Create New Stage**:

   | стадія | звідки | Probability | Record Category | Forecast Category |
   |---|---|---|---|---|
   | `Qualification` | наявна | `10` | `Open` | `Pipeline` |
   | `Technical Validation` | нова | `30` | `Open` | `Pipeline` |
   | `Value Proposition` | наявна (було 40) | `50` | `Open` | `Pipeline` |
   | `Contract Negotiation` | нова | `75` | `Open` | `Pipeline` |
   | `Closed Won` | наявна | `100` | `Closed Won` | `Closed` |
   | `Closed Lost` | наявна | `0` | `Closed Lost` | `Omitted` |

   Для наявних стадій звір ймовірність і категорію з таблицею і виправ, якщо відрізняються. Нову
   стадію в **Stage-Probability Mapping** підтверджуєш кнопкою, яку довідка називає **Done**.
   Розташуй стадії в такому самому порядку (перетягуванням).
4. Відміть **Set as Default**. У layout з'явиться ще й Standard, і без default нові угоди Net-New
   доведеться щоразу перемикати в потрібний pipeline вручну.
5. Збережи.

   **Що побачиш:** у списку pipelines для `Enterprise Net-New` — `Net-New Pipeline` і,
   найімовірніше, `Standard` з усіма старими стадіями. У Standard `Value Proposition` тепер
   теж 50 %.
6. Тепер кнопка зветься **+ New Pipeline**: `Renewal Pipeline`, layout `Client Renewals`.

   | стадія | звідки | Probability | Record Category | Forecast Category |
   |---|---|---|---|---|
   | `Renewal Initiated` | нова | `10` | `Open` | `Pipeline` |
   | `Usage Audit` | нова | `40` | `Open` | `Pipeline` |
   | `Renewal Quote Sent` | нова | `70` | `Open` | `Pipeline` |
   | `Closed Won` | наявна | `100` | `Closed Won` | `Closed` |
   | `Churned` | нова | `0` | `Closed Lost` | `Omitted` |

7. **Set as Default**, збережи.

**Що побачиш:** у новій угоді `Client Renewals` поле **Pipeline** пропонує тільки
`Renewal Pipeline`, а **Stage** — тільки його п'ять стадій. Якщо в списку є щось зайве, з'ясуй
звідки, перш ніж іти далі: тест ізоляції впаде саме тут.

## 9.7. Покроково: Step 3 — blueprint

1. Відкрий **Setup → Process Management → Blueprint**, натисни **Create Blueprint**.
2. Заповни діалог:

   | поле | значення |
   |---|---|
   | **Blueprint name** | `Enterprise Contract Approval` |
   | **Module** | `Deals` |
   | **Choose Layout** | `Enterprise Net-New` — цим Client Renewals виключено |
   | **Choose field** | `Stage` |
   | **Choose Pipeline** (у завданні Target Pipeline) | `Net-New Pipeline` |
   | criteria | `Stage` дорівнює `Value Proposition` (рекомендація з 9.4) |
   | **Description** | одне речення: навіщо процес |
   | **Advanced configuration** | не вмикай неперервний (continuous) процес: він для сценаріїв «за один раз» |

   Поле **Choose Pipeline** з'являється щойно **Choose field** стає `Stage`; за замовчуванням
   воно показує **Standard (Enterprise Net-New)** — обов'язково
   зміни на `Net-New Pipeline` вручну. Натисни **Next**.
3. У редакторі перетягни на канву стани `Value Proposition`, `Contract Negotiation`, `Closed Won`.
   Перехід створюєш кнопкою **+** між двома станами; видалити — правий клік по лінії переходу.
4. Налаштуй переходи:

   | | `Initiate Contracting` | `Finalize & Close` |
   |---|---|---|
   | стрілка | `Value Proposition` → `Contract Negotiation` | `Contract Negotiation` → `Closed Won` |
   | Before → Owners | власник запису (Record Owner) | завдання не задає; логічно теж власник запису — запиши рішення |
   | During | **+Add → Associated Items → Attachments**, Mandatory; **+Add → Associated Items → Notes**, Mandatory | **+Add → Field** → `Target Go-Live Date`, **Mark as** Mandatory |
   | After | нічого | нічого |

   Інтерфейс підписує **Owners** точно так: «Choose which users, groups, portals, or roles you
   would like to display these buttons for». Для обох переходів
   він одразу підставляє чіп **Record Owner** — жодного вибору вручну не треба, це і є «власник
   запису» з умови завдання.

   Вкладення імітує чернетку пропозиції, нотатка — обґрунтування ціни. Можеш додати в During
   **Message** з підказкою, наприклад:
   `Attach the drafted proposal and add a pricing justification`.
5. **Publish**. У списку blueprints переконайся, що `Enterprise Contract Approval` увімкнений.

**Що побачиш:** на канві три стани і дві стрілки з назвами переходів. Це «Architectural Proof»:
зроби скриншот у високій роздільній здатності, щоб назви читались.

Відкат: blueprint можна редагувати й вимикати. Коли вимикаєш або публікуєш нову версію, а в процесі
вже є записи, Zoho питає, що з ними робити: вивести з процесу в останньому стані чи перенести в
нову версію.

## 9.8. Покроково: Phase II — виконання тестів

Тепер ти кінцевий користувач. Підготуй дані: тестовий акаунт `QA Enterprise Client` і невеликий
файл, наприклад `proposal-draft.txt`. Довідка позначає в Deals обов'язковими **Deal Name**,
**Account Name**, **Closing Date** і **Stage**; з появою pipelines обов'язкове ще й **Pipeline**.

**1. Happy path.**

1. Створи угоду `NN Happy 1` у layout `Enterprise Net-New`. Спершу спробуй зберегти з порожнім
   **Software Tier**.

   **Що побачиш:** збереження не проходить, Software Tier позначене як обов'язкове. Запиши текст.
2. Заповни `Software Tier` = `Enterprise`, **Pipeline** `Net-New Pipeline`, **Stage**
   `Qualification`, **Amount** `120000`, збережи.
3. Через Edit зміни Stage на `Technical Validation`, потім на `Value Proposition`. Щоразу дивись на
   **Probability**: очікуєш значення стадії з мапінгу — 30, потім 50.

   **Що побачиш:** на `Value Proposition` угода входить у blueprint: Stage блокується, на сторінці —
   смуга blueprint з кнопкою **Initiate Contracting**. Якщо ні (Stage редагується, кнопки немає),
   перевір, що blueprint увімкнений, а угода в `Net-New Pipeline`. Коли все так, а угода все одно
   поза процесом, включи її вручну: **Setup → Process Management → Blueprint** → вкладка
   **Filters** → **Include** — і запиши цей факт у матрицю: він змінює опис поведінки продукту.
4. **Initiate Contracting**: додай нотатку і вкладення, збережи.

   **Що побачиш:** стан і Stage — `Contract Negotiation`, Probability 75, нова кнопка **Finalize &
   Close**; нотатка і файл — у пов'язаних списках угоди.
5. **Finalize & Close**: введи **Target Go-Live Date** у майбутньому, збережи.

   **Що побачиш:** Stage `Closed Won`, Probability 100, кнопок переходів більше немає. Зафіксуй, чи
   зникла смуга blueprint і чи Stage знову редагується.

**2. Негативні.** Нова угода `NN Negative 1`, доведи її до `Value Proposition`.

1. **Initiate Contracting** → спробуй зберегти без вкладення і без нотатки. Потім тільки з
   нотаткою, потім тільки з вкладенням.

   **Що побачиш:** щоразу збереження блокується з повідомленням у вікні переходу, угода лишається у
   `Value Proposition`. Запиши текст. Кнопка **Save as Draft** у вікні переходу зберігає частину
   введеного, але угоду не рухає — це задокументована поведінка, а не обхід.
2. Дійди до **Finalize & Close** і спробуй зберегти з порожнім **Target Go-Live Date**.

   **Що побачиш:** блок, угода в `Contract Negotiation`.

Ці спроби запиши на відео — це «Constraint Validation Proof».

**3. Ізоляція.**

1. Створи угоду `RN Isolation 1` у layout `Client Renewals`.

   **Що побачиш:** немає Software Tier, Target Go-Live Date, Implementation Required; є Retention
   Metrics з обов'язковим Current Contract Expiry; у **Pipeline** — тільки `Renewal Pipeline`, у
   **Stage** — тільки його стадії.
2. Доведи угоду до `Renewal Quote Sent`.

   **Що побачиш:** ні смуги blueprint, ні кнопок переходів; Stage редагується як звичайне поле.
   `Enterprise Contract Approval` не спрацював.

## 9.9. Як це тестувати

**Що може зламатися.** Pipeline прив'язаний не до того layout. Клон layout'у приніс чужі поля.
Стадія з неправильною Record Category — програна угода рахується відкритою. Ймовірність, змінена
«для одного pipeline», зачепила інші. Blueprint прив'язаний не до того pipeline або вимкнений.
Переходи без обов'язкових пунктів. Угоди застрягають через criteria.

**Позитивні, негативні, граничні:**

| перевірка | тип | очікування |
|---|---|---|
| Software Tier порожнє при створенні Net-New | негативна | збереження заблоковане |
| Initiate Contracting: нічого / тільки нотатка / тільки вкладення | негативна | блок у кожному з трьох варіантів |
| Finalize & Close з порожньою датою | негативна | блок |
| Finalize & Close з датою в минулому | гранична | вимога каже «valid future date», а обмеження не налаштоване, тож blueprint пропустить. Це розрив вимоги і конфігурації: запиши як знахідку або додай у During **+ Validation** |
| Renewal-угода на `Renewal Quote Sent` | ізоляція | blueprint не спрацьовує |
| списки Pipeline і Stage у Client Renewals | ізоляція | тільки Renewal Pipeline і його стадії |
| Probability на кожній стадії | позитивна | 10 / 30 / 50 / 75 / 100 / 0 і 10 / 40 / 70 / 100 / 0 |
| `Value Proposition` у pipeline Standard | регресія | тепер 50 %; перевір, чи змінились Probability і Expected Revenue наявних угод, і запиши, що побачив |
| перехід не власником і не адміністратором | права | кнопки немає |
| Edit і Mass Update поля Stage для угоди в blueprint | обхід | поле заблоковане, масове оновлення угоду не змінює; зафіксуй, чи Zoho повідомляє про пропущений запис |

**Пастка адміністратора.** У тріалі ти адміністратор, а адміністратор бачить усі переходи. Тест
«Available to Record Owner» під адміном нічого не доводить. Якщо маєш User B з не-адмінським
профілем, створи угоду від свого імені і відкрий її як User B: кнопки бути не повинно. Зроби User B
власником — кнопка має з'явитися.

**Докази для Phase III:**

| артефакт | як зібрати |
|---|---|
| Architectural Proof | скриншот канви blueprint, назви станів і переходів читаються |
| UI Segregation Proof | дві угоди поруч, `Enterprise Net-New` і `Client Renewals`: різні розділи, різний Pipeline, різний набір стадій у смузі стадій |
| Constraint Validation Proof | коротке відео негативних тестів: клік по переходу, спроба зберегти без обов'язкового, повідомлення, угода не зрушила |
| Formal Test Cases Matrix | матриця в Zoho Sheet (або таблиця в Zoho Writer) з результатами Phase II |

**Приклад тест-кейсу для матриці:**

| поле | значення |
|---|---|
| ID | A12-TC-04 |
| Назва | Initiate Contracting блокується без вкладення |
| Передумови | угода `NN Negative 1`: layout Enterprise Net-New, Pipeline Net-New Pipeline, стан Value Proposition; blueprint Enterprise Contract Approval опублікований і увімкнений |
| Кроки | 1. Відкрити угоду. 2. Натиснути **Initiate Contracting**. 3. Додати нотатку `Pricing justified by 3-year term`. 4. Вкладення не додавати. 5. Зберегти перехід |
| Очікуваний результат | перехід не зберігається, видно повідомлення про обов'язкове вкладення; Stage лишається Value Proposition |
| Фактичний результат | під час виконання: точний текст повідомлення, стан угоди |
| Статус | Pass / Fail / Blocked |
| Докази | кадр відео або скриншот вікна переходу з повідомленням |

## 9.10. Типові помилки

1. **Перейменувати системні стадії замість створити нові.** Перейменування зачіпає всі угоди і
   pipeline Standard, а з blueprint на полі Stage взагалі не проходить.
2. **Клонувати Client Renewals після того, як додав поля Net-New.** Клон забирає всі розділи — тест
   ізоляції падає на першому ж кроці.
3. **Ховати поле через field permission.** Field permission діє на всі layouts і на профіль, а не
   на процес. Ізоляцію полів дає тільки склад layout.
4. **Думати, що ймовірність належить pipeline.** 50 % для Value Proposition стають 50 % і в
   Standard; наявні угоди теж треба перевірити.
5. **Злякатися Standard і видалити його.** Це системний pipeline для наявних угод. Видалення вимагає
   перенесення угод, а blueprints цього pipeline зникають.
6. **Чекати, що After перемістить угоду.** Цільовий стан задає стрілка; After — лише дії.
7. **Blueprint без критерію входу, коли угоди стартують поза його станами.** Угода може застрягти з
   заблокованим Stage і без жодної кнопки.
8. **Перевіряти Owners під адміністратором.** Адмін бачить усі переходи — тест завжди зелений.
9. **Забути опублікувати або ввімкнути blueprint.** Чернетка на записах не працює.
10. **Не обрати pipeline при створенні угоди.** Без Set as Default угода Net-New може потрапити в
    Standard, і blueprint мовчить.
11. **Лишити нотатки чи вкладення Optional.** Перехід збережеться без них, негативний тест «падає»
    на конфігурації, а не на продукті.
12. **Дати Churned категорію Open.** Програні продовження рахуються відкритими в прогнозі.

### Симптом → причина

| симптом | найімовірніша причина |
|---|---|
| у полі Pipeline угоди Client Renewals є `Net-New Pipeline` | pipeline створено з не тим **Layout** |
| у Renewal-угоді видно Software Tier | Client Renewals клоновано вже з розділом Technical & Implementation Details |
| після першого pipeline з'явився ще й `Standard` | так задумано: системний pipeline для наявних угод |
| у Standard `Value Proposition` показує 50 % | ймовірність належить стадії, а не pipeline |
| у діалозі **Create new Blueprint** немає поля **Choose Pipeline** | в обраному layout ще немає pipelines, або в **Choose field** не Stage |
| угода у Value Proposition, а кнопки **Initiate Contracting** немає | blueprint чернетка або вимкнений; угода в іншому layout чи pipeline; не підходить під criteria; ти не власник і не адмін |
| Stage у формі Edit тільки для читання, кнопок переходів немає | угода увійшла в blueprint у стані, з якого немає переходів |
| перехід зберігся без вкладення чи нотатки | пункт позначено Optional або його немає в During |
| угода після переходу опинилась не в тій стадії | стрілку переходу проведено не до того стану |
| **Publish** видає повідомлення про петлі (loops) у схемі | у схемі є цикл, з якого запис не може вийти |
| значення поля Stage не редагуються | на полі є blueprint: поки він існує, значення picklist не змінити |
| угода не зберігається через Account Name чи Closing Date | це стандартні обов'язкові поля Deals |
| User B не бачить кнопку переходу, а адмін бачить | так має бути: власник переходу — власник запису, адмін бачить усе |
| видалення pipeline: `Pipeline field cannot be removed` | pipeline пов'язаний з угодами або з blueprint |
| у Setup немає пункту **Pipelines** | модуль Deals вимкнений або в профілі немає прав на Deals |

---

## 9.11. Що варто запам'ятати

1. Layout визначає поля, pipeline — стадії, blueprint — правила руху між стадіями.
2. Pipeline є тільки в Deals і належить одному layout; у layout може бути кілька pipelines.
3. Ймовірність і категорії — властивості стадії: одне значення всюди, де є стадія, — в усіх
   pipelines і layouts.
4. Перший pipeline створює Standard і прив'язує до нього наявні угоди та Stage-blueprints. Відкотити
   це непросто, тож краще робити в sandbox.
5. Stage-blueprint у layout з pipelines прив'язується до одного pipeline; видалення pipeline
   видаляє його blueprints.
6. Цільовий стан задає стрілка переходу; After — тільки дії.
7. Нотатки і вкладення — у During через **+Add → Associated Items**, з позначкою Mandatory.
8. Критерій входу вирішує, з якої стадії угода потрапляє в процес; стадія поза станами blueprint —
   ризик застрягти.
9. Для людини Stage у blueprint заблоковане; прямі записи автоматизації blueprint не зупиняє.
10. Адміністратор бачить усі переходи — права Owners перевіряй не-адміном.
11. Ізоляцію доводь з обох боків: поля, списки Pipeline і Stage, blueprint не спрацьовує.

---

# Задачі

**9.1.** *(пояснити)* Для кожної вимоги назви важіль, яким її реалізують: layout, pipeline,
blueprint чи Stage-Probability Mapping. Одним реченням поясни чому.

1. Поле `Churn Risk Profile` не повинно з'являтися в угодах Net-New.
2. Угода Net-New не може стати `Contract Negotiation` без вкладення.
3. У Renewal-угоди немає стадії `Technical Validation`.
4. `Software Tier` обов'язкове при створенні угоди Net-New.
5. Перехід `Initiate Contracting` може виконати тільки власник запису.
6. Стадія `Usage Audit` має ймовірність 40 %.

**9.2.** *(передбачити)* У модулі Deals один layout — Standard, у ньому 15 угод, `Value
Proposition` має 40 %, pipelines немає. Ти створюєш `Net-New Pipeline` у цьому layout і ставиш
`Value Proposition` 50 %. Дай відповіді до перевірки: які pipelines будуть у layout після
збереження; до якого pipeline належатимуть 15 угод; яку ймовірність матиме `Value Proposition` у
кожному pipeline; що з цього важко відкотити. Що тут варто перевірити в тріалі, бо довідка не дає
однозначної відповіді?

**9.3.** *(конфігурація, Phase I Step 1)* Потрібні: права адміністратора в CRM (краще в sandbox).
У **Setup → Customization → Modules and Fields → Deals → Layouts**:

- перейменуй Standard layout на `Enterprise Net-New`; створи розділ `Technical & Implementation
  Details` з полями `Software Tier` (Pick List: `Basic`, `Professional`, `Enterprise`,
  обов'язкове), `Target Go-Live Date` (Date), `Implementation Required` (Checkbox);
- створи layout `Client Renewals` з розділом `Retention Metrics` і полями `Current Contract
  Expiry` (Date, обов'язкове), `Churn Risk Profile` (Pick List: `Low`, `Medium`, `High`,
  `Critical`).

Зроби так, щоб у `Client Renewals` не було полів Net-New. Опиши порядок дій і результат.

**9.4.** *(конфігурація, Step 2)* Потрібні layouts `Enterprise Net-New` і `Client Renewals`. У
**Setup → Customization → Pipelines** створи:

- `Net-New Pipeline`, суворо для layout `Enterprise Net-New`: Qualification (10 %), Technical
  Validation (30 %), Value Proposition (50 %), Contract Negotiation (75 %), Closed Won (100 %),
  Closed Lost (0 %);
- `Renewal Pipeline`, суворо для layout `Client Renewals`: Renewal Initiated (10 %), Usage Audit
  (40 %), Renewal Quote Sent (70 %), Closed Won (100 %), Churned (0 %).

Стадіям Churned і Closed Lost дай Record Category `Closed Lost`. Для кожної стадії вкажи Record
Category і Forecast Category. Після першого збереження зафіксуй, які pipelines з'явилися в layout
`Enterprise Net-New`.

**9.5.** *(конфігурація, Step 3)* Потрібні: layout `Enterprise Net-New` з полем `Target Go-Live
Date`, pipeline `Net-New Pipeline` на цьому layout зі стадіями Qualification, Technical
Validation, Value Proposition, Contract Negotiation, Closed Won, Closed Lost. У **Setup → Process
Management → Blueprint** створи blueprint:

- Blueprint Name: `Enterprise Contract Approval`; Target Module: Deals; Target Layout: `Enterprise
  Net-New` (Client Renewals виключено); Target Pipeline (**Choose Pipeline**, з'являється після
  **Choose field**: `Stage`): `Net-New Pipeline`;
- State 1 `Value Proposition` → перехід `Initiate Contracting`: Before — доступний власнику
  запису; During — **+Add → Associated Items → Attachments** (чернетка пропозиції) і **Notes**
  (обґрунтування ціни), обидва Mandatory; цільовий стан — `Contract Negotiation`;
- State 2 `Contract Negotiation` → перехід `Finalize & Close`: During — поле `Target Go-Live Date`,
  обов'язкове; цільовий стан — `Closed Won`.

Вкажи, яку умову входу ставиш і чому, опублікуй і зроби скриншот канви.

**9.6.** *(виконання, Phase II.1 — happy path)* Потрібні: layout `Enterprise Net-New` з обов'язковим
`Software Tier`, pipeline `Net-New Pipeline`, опублікований і ввімкнений blueprint `Enterprise
Contract Approval` (Initiate Contracting: обов'язкові вкладення і нотатка; Finalize & Close:
обов'язкова `Target Go-Live Date`). Створи угоду в layout Enterprise Net-New і переконайся, що
Software Tier обов'язкове при створенні. Проведи угоду по Net-New Pipeline до Value Proposition,
виконай **Initiate Contracting** з вкладенням і нотаткою, перевір перехід у Contract Negotiation.
Виконай **Finalize & Close** з датою в майбутньому, перевір Closed Won. Для кожного кроку запиши
очікуване і фактичне.

**9.7.** *(виконання, Phase II.2 — негативні)* Потрібні: pipeline `Net-New Pipeline` на layout
`Enterprise Net-New` і опублікований, увімкнений blueprint `Enterprise Contract Approval`
(Initiate Contracting: обов'язкові вкладення і нотатка; Finalize & Close: обов'язкова `Target
Go-Live Date`). Доведи угоду Enterprise Net-New до Value Proposition, натисни **Initiate
Contracting** і спробуй зберегти перехід без вкладення і нотатки — система має жорстко
заблокувати рух і показати помилку в інтерфейсі. У переході **Finalize & Close** спробуй
продовжити з порожньою `Target Go-Live Date` — теж блок. Запиши все на відео.

**9.8.** *(виконання, Phase II.3 — ізоляція)* Потрібні: layouts `Enterprise Net-New` і `Client
Renewals`, pipelines `Net-New Pipeline` і `Renewal Pipeline`, blueprint `Enterprise Contract
Approval` на Net-New Pipeline. Створи угоду в layout Client Renewals. Перевір, що поля Net-New
(Software Tier, Target Go-Live Date) повністю приховані, а доступні тільки стадії Renewal
Pipeline. Доведи угоду до стадії, що відповідає тригеру blueprint (`Renewal Quote Sent`), і
переконайся, що blueprint не спрацював.

**9.9.** *(знайди помилки)* Колега налаштував A12 і каже, що все готово. Знайди шість помилок і для
кожної назви, який тест Phase II на ній впаде.

| де | налаштування |
|---|---|
| layout `Client Renewals` | створено клоном `Enterprise Net-New` після того, як у ньому з'явився розділ Technical & Implementation Details |
| pipeline `Renewal Pipeline` | стадія `Churned`: Record Category `Open` |
| blueprint, Choose Layout | `Client Renewals` |
| blueprint, criteria | не задано; угоди Net-New створюються в `Qualification` |
| перехід `Initiate Contracting` | стрілка до `Closed Won`; в After — оновлення поля Stage = `Contract Negotiation` |
| During `Initiate Contracting` | Attachments — Mandatory, Notes — Optional |

**9.10.** *(спроєктувати)* Phase II не покриває права, обхід і регресію. Спроєктуй п'ять додаткових
тест-кейсів у форматі матриці (ID, назва, передумови, кроки, очікуваний результат): дата Go-Live у
минулому; перехід користувачем, що не є ні власником, ні адміністратором; той самий користувач як
власник угоди; зміна Stage через Edit і через Mass Update для угоди в blueprint; ймовірність Value
Proposition у pipeline Standard. Для кожного вкажи, що потрібно заздалегідь (користувачі, профілі,
угоди).

**9.11.** *(здача, Phase III)* Збери і здай пакет: скриншот канви blueprint у високій роздільній
здатності, де видно потрібні стани й переходи (Architectural Proof); два скриншоти поруч — угода
Enterprise Net-New і угода Client Renewals з різними полями і смугами стадій (UI Segregation
Proof); коротке відео негативних тестів, де видно, як CRM блокує перехід без обов'язкових даних
(Constraint Validation Proof); матрицю тест-кейсів з виконанням Phase II (Formal Test Cases
Matrix). Документи — у Zoho Writer або Zoho Sheet, зберігання — у WorkDrive, здача — публічним
посиланням, назва документа збігається з назвою завдання.

**9.12.** *(передбачити)* Blueprint `Enterprise Contract Approval` опубліковано **без** умови входу.
Користувач створює угоду Net-New у стадії `Qualification`. Що може статися з угодою, чому, як це
перевірити і як виправити конфігурацію та саму угоду?

---

# Розв'язки

**9.1.**

| вимога | важіль | чому |
|---|---|---|
| 1 | layout | поля Retention Metrics просто немає в layout Enterprise Net-New |
| 2 | blueprint | During переходу `Initiate Contracting` з обов'язковим Attachments |
| 3 | pipeline | Renewal Pipeline не містить цієї стадії |
| 4 | layout | обов'язковість — властивість поля в конкретному layout |
| 5 | blueprint | Before → Owners переходу |
| 6 | Stage-Probability Mapping | ймовірність — властивість стадії; задається при створенні стадії в pipeline або в мапінгу |

**9.2.** Після збереження в layout два pipelines: `Net-New Pipeline` і системний `Standard` з усіма
стадіями поля Stage. Усі 15 угод прив'язані до Standard. `Value Proposition` має 50 % в обох
pipelines, бо ймовірність належить стадії. Важко відкотити: Standard і прив'язку угод (видалення
pipeline вимагає перенести відкриті угоди, blueprints pipeline видаляються разом з ним). Варто
перевірити: чи Standard справді створився (довідка ставить умови, і їх формулювання неоднозначне) і
чи змінились Probability та Expected Revenue у наявних угод на Value Proposition — довідка про це
не говорить.

**9.3.** Порядок:

1. **Setup → Customization → Modules and Fields → Deals → Layouts** → Standard → перейменувати на
   `Enterprise Net-New` → зберегти.
2. **Create New Layout** → клон з `Enterprise Net-New` → назва `Client Renewals` → розділ
   `Retention Metrics`: `Current Contract Expiry` (Date, **Mark as required**), `Churn Risk Profile`
   (Pick List: Low, Medium, High, Critical) → **Save** → **Layout Permission**: Administrator
   і тестові профілі.
3. `Enterprise Net-New` → розділ `Technical & Implementation Details`: `Software Tier` (Pick List:
   Basic, Professional, Enterprise, **Mark as required**), `Target Go-Live Date` (Date),
   `Implementation Required` (Checkbox) → **Save**.

Результат: форма Enterprise Net-New має Technical & Implementation Details і не має Retention
Metrics; Client Renewals — навпаки. Якщо Client Renewals створено пізніше, клоном вже зміненого
layout, прибери з нього розділ Technical & Implementation Details (поля підуть в Unused Items
цього layout) і перевір форму ще раз.

**9.4.**

`Net-New Pipeline` (Layout `Enterprise Net-New`, Set as Default):

| стадія | Probability | Record Category | Forecast Category |
|---|---|---|---|
| Qualification | `10` | `Open` | `Pipeline` |
| Technical Validation (нова) | `30` | `Open` | `Pipeline` |
| Value Proposition | `50` (було 40) | `Open` | `Pipeline` |
| Contract Negotiation (нова) | `75` | `Open` | `Pipeline` |
| Closed Won | `100` | `Closed Won` | `Closed` |
| Closed Lost | `0` | `Closed Lost` | `Omitted` |

`Renewal Pipeline` (Layout `Client Renewals`, Set as Default):

| стадія | Probability | Record Category | Forecast Category |
|---|---|---|---|
| Renewal Initiated (нова) | `10` | `Open` | `Pipeline` |
| Usage Audit (нова) | `40` | `Open` | `Pipeline` |
| Renewal Quote Sent (нова) | `70` | `Open` | `Pipeline` |
| Closed Won | `100` | `Closed Won` | `Closed` |
| Churned (нова) | `0` | `Closed Lost` | `Omitted` |

Після першого збереження в layout `Enterprise Net-New` видно `Net-New Pipeline` і, коли в layout
були угоди або Stage-blueprint, `Standard`. Запиши, що саме побачив: це частина звіту.

**9.5.** Діалог **Create new Blueprint**: Blueprint name `Enterprise Contract Approval`, Module
Deals, Choose Layout `Enterprise Net-New`, Choose field `Stage`, Choose Pipeline `Net-New
Pipeline`, criteria `Stage` = `Value Proposition`, Description, Advanced configuration без змін →
**Next**. Канва: `Value Proposition` → `Initiate Contracting` → `Contract Negotiation` →
`Finalize & Close` → `Closed Won`.

| | Initiate Contracting | Finalize & Close |
|---|---|---|
| Before → Owners | Record Owner | Record Owner (рішення, бо документ мовчить) |
| During | Associated Items → Attachments (Mandatory), Associated Items → Notes (Mandatory) | Field → Target Go-Live Date (Mandatory) |
| After | — | — |

Умова входу `Stage = Value Proposition`: угоди стартують з Qualification, а цієї стадії в blueprint
немає. Без умови угода могла б увійти в процес зі стадією поза його станами і застрягти з
заблокованим Stage. З умовою вона вільно проходить Qualification і Technical Validation і входить у
процес на Value Proposition. **Publish**, потім перевірити, що blueprint у списку увімкнений, і
зробити скриншот канви.

**9.6.**

| крок | очікуване |
|---|---|
| зберегти угоду з порожнім Software Tier | збереження заблоковане, поле позначене обов'язковим |
| зберегти з Software Tier = Enterprise, Pipeline Net-New, Stage Qualification | угода створена, Probability 10 |
| Stage → Technical Validation | Probability 30, угода поза blueprint, Stage редагується |
| Stage → Value Proposition | Probability 50; угода в blueprint: Stage заблоковане, кнопка Initiate Contracting |
| Initiate Contracting з нотаткою і файлом | Stage Contract Negotiation, Probability 75, кнопка Finalize & Close, нотатка і файл у пов'язаних списках |
| Finalize & Close з датою в майбутньому | Stage Closed Won, Probability 100, кнопок переходів немає, Target Go-Live Date заповнене |

У фактичному результаті зафіксуй тексти повідомлень і те, що сталося зі смугою blueprint після
Closed Won.

**9.7.**

| спроба | очікуване |
|---|---|
| Initiate Contracting без нотатки і вкладення | не зберігається, повідомлення про обов'язкові пункти, Value Proposition |
| тільки нотатка | не зберігається, бракує вкладення |
| тільки вкладення | не зберігається, бракує нотатки |
| Finalize & Close з порожньою Target Go-Live Date | не зберігається, Contract Negotiation |

На відео мають бути видні клік по переходу, порожні обов'язкові пункти, повідомлення і стадія
угоди після спроби. Save as Draft у вікні переходу не рухає угоду — якщо користуєшся ним, поясни це
в матриці.

**9.8.** У формі Client Renewals немає Software Tier, Target Go-Live Date і Implementation
Required; є Retention Metrics і обов'язкове Current Contract Expiry. Поле Pipeline пропонує тільки
Renewal Pipeline, Stage — тільки Renewal Initiated, Usage Audit, Renewal Quote Sent, Closed Won,
Churned. На Renewal Quote Sent немає смуги blueprint і кнопок, Stage редагується далі. Результат:
Pass, якщо все так; будь-яке поле Net-New на формі або чужа стадія в списку — Fail з
посиланням на ланку ланцюжка (layout чи pipeline).

**9.9.**

| помилка | виправлення | що впаде |
|---|---|---|
| Client Renewals клоновано з розділом Net-New | прибрати розділ з Client Renewals | ізоляція: Software Tier видно в Renewal-угоді; ще й обов'язковий — не створиш угоду без нього |
| Churned з Record Category Open | Closed Lost | формально Phase II пройде, але втрачені продовження рахуються відкритими; ловиться перевіркою мапінгу |
| blueprint на layout Client Renewals | Enterprise Net-New, pipeline Net-New Pipeline | happy path: угоди Net-New не входять у процес, переходу немає; ізоляція: стадія, додана в blueprint, додається і в pipeline, тож у Renewal Pipeline можуть з'явитися Value Proposition і Contract Negotiation |
| criteria не задано | `Stage` = `Value Proposition` | happy path: угода може увійти в процес ще на Qualification і застрягти із заблокованим Stage без кнопок (див. 9.12) |
| стрілка Initiate Contracting до Closed Won | стрілка до Contract Negotiation, After без оновлення Stage | happy path: після першого переходу угода опиняється не в Contract Negotiation |
| Notes Optional | Mandatory | негативний тест: перехід зберігається тільки з вкладенням |

**9.10.**

| ID | назва | передумови | кроки | очікуваний результат |
|---|---|---|---|---|
| A12-EX-01 | Дата Go-Live у минулому | угода в Contract Negotiation | Finalize & Close → дата вчора → зберегти | вимога: блок. Без **+ Validation** буде збережено — зафіксувати як розрив вимоги і конфігурації |
| A12-EX-02 | Перехід не власником | User B з не-адмінським профілем і доступом до layout; угода в Value Proposition, власник — адміністратор | увійти як User B, відкрити угоду | кнопки Initiate Contracting немає |
| A12-EX-03 | Перехід власником-не-адміном | як EX-02, але власник угоди — User B | увійти як User B | кнопка є, перехід виконується |
| A12-EX-04 | Stage в Edit і через Mass Update | угода в Value Proposition у blueprint | Edit → Stage; потім Mass Update Stage = Closed Won у списку | у формі Stage тільки для читання; масове оновлення угоду не змінює; зафіксувати повідомлення |
| A12-EX-05 | Ймовірність у Standard | угода в pipeline Standard на Value Proposition, створена до змін | відкрити угоду і мапінг | у мапінгу 50 %; Probability і Expected Revenue угоди — записати фактичні значення |

**9.11.** Чекліст здачі: канва (три стани, два переходи, назви читаються); два скриншоти поруч
(різні розділи, різні значення в Pipeline, різні стадії); відео з трьома невдалими спробами
Initiate Contracting і однією для Finalize & Close; матриця з усіма кейсами Phase II, фактичним
результатом, статусом і посиланням на докази. Усе лежить у WorkDrive, у документів назва завдання
(наприклад, `A12. Advanced Blueprints and Pipelines`), ментору йде публічне посилання.

**9.12.** Ризик: угода може увійти в blueprint одразу при створенні, бо умови входу немає. Її
стадія `Qualification` — не стан blueprint, і довідка описує такий випадок так: запис у процесі,
але переходів не бачить. Поле Stage при цьому заблоковане, отже угода застрягне: ні вручну, ні
переходом її не зрушити. Перевірка: створити угоду в Qualification, відкрити Edit — чи Stage
тільки для читання і чи є на сторінці хоч одна кнопка переходу. Виправлення конфігурації: умова
входу `Stage = Value Proposition`. Виправлення угоди: **Setup → Process Management → Blueprint** →
вкладка **Filters** → **Exclude** → module, layout, blueprint → знайти угоду → Exclude.

---

## Ворота уроку

- [ ] пояснюєш, що визначає layout, що pipeline, а що blueprint, і як вони вкладені один в одного;
- [ ] пояснюєш, чому field permission не годиться для ізоляції процесів, а склад layout — годиться;
- [ ] створюєш layout клоном і знаєш, що клон забирає всі розділи й поля;
- [ ] налаштовуєш pipeline з новими стадіями без підглядання: Create New Pipeline, Create New Stage,
  Stage-Probability Mapping;
- [ ] пояснюєш Record Category і Forecast Category та їхній зв'язок;
- [ ] пояснюєш, чому зміна ймовірності Value Proposition зачіпає всі pipelines, де є ця стадія;
- [ ] передбачаєш появу pipeline Standard і знаєш, що саме важко відкотити;
- [ ] створюєш Stage-blueprint на конкретному pipeline і пояснюєш, коли з'являється вибір pipeline;
- [ ] налаштовуєш During з обов'язковими нотатками, вкладеннями і полем;
- [ ] пояснюєш, чому цільовий стан задає стрілка, а не After;
- [ ] обираєш умову входу blueprint і пояснюєш ризик застряглої угоди;
- [ ] пояснюєш, чому перевірка Owners під адміністратором нічого не доводить;
- [ ] пояснюєш, які канали змінюють поле blueprint в обхід переходів;
- [ ] доводиш ізоляцію процесів тестами з обох боків;
- [ ] пакет Phase III здано: канва, два скриншоти поруч, відео негативних тестів, матриця
  тест-кейсів;
- [ ] задачі 9.9, 9.10 і 9.12 розв'язані без підглядання в розв'язки.
