# Урок 14. Layout rules: форма, що підлаштовується під відповіді

*Після уроку ти налаштовуєш правила макета задач — умовні (показати поле, зробити обов'язковим,
вимкнути) і залежні (відфільтрувати значення списку) — і виконуєш три практичні завдання
документа: Risk Assessment, Employee Onboarding, Incident Resolution. Для QA головне вміння тут —
бачити форму як стан: для кожного набору значень знати, які поля видно, які обов'язкові, які
вимкнені і що пропонує список.*

---

## 14.1. Що таке layout rule і яку проблему розв'язує

Одна форма задачі обслуговує різні ситуації. Ризик низький — описувати план дій не треба. Ризик
критичний — план і рецензент обов'язкові. Без правил лишається два погані варіанти: показувати
всі поля завжди (люди пропускають половину, дані неповні) або робити окремий layout на кожен
випадок (але в проєкту лише один task layout). **Layout rules** роблять одну форму гнучкою: вона
змінюється, поки людина її заповнює.

Два типи правил:

- **Conditional** (умовне) — змінює властивості полів, коли виконується умова: показує поле чи
  секцію, робить поле обов'язковим або знімає обов'язковість, вимикає поле. Спрацьовує при
  створенні задачі, при оновленні або в обох випадках.
- **Dependent** (залежне) — показує в одному списку лише ті значення, що відповідають значенню
  іншого поля.

Приклади з документа:

- умовне: якщо Priority = High і кастомне поле Quantity порожнє, то Due Date і Quantity стають
  обов'язковими;
- залежне: якщо Item Weightage = High, у списку Sr Supply Chain Managers показуються лише певні
  люди.

Layout rules доступні на плані Enterprise і вище. Вони є також для issues, проєктів і фаз — з тією
самою механікою. У цьому уроці — правила для задач.

### Чим layout rule не є

| | layout rule | workflow rule | Blueprint |
|---|---|---|---|
| коли діє | поки людина заповнює форму задачі | після збереження: на подію або в заданий час | коли задача переходить між статусами |
| що змінює | форму: видимість, обов'язковість, доступність полів, значення списків | дані задачі; надсилає листи, викликає вебхуки | статус; перевіряє Before, просить введення During, виконує After |
| чи може не дати зберегти | так — порожнє обов'язкове поле | ні, тільки реагує | так — перехід не виконається |
| на чому стоїть | конкретний layout | layout (правила за дією — ще й "All Layouts") | layout і критерій |

Layout rule керує **формою**, а не даними як такими. Що буде, коли задача з'являється не через
форму (імпорт, workflow rule, e-mail, швидке створення в списку), довідка не описує. Це окреме
питання для тестування. Одне продукт каже прямо, приміткою в редакторі: дії **Set mandatory
fields** не застосовуються під час переходів Blueprint.

---

## 14.2. Як влаштоване правило

```
Layout Rule
├── Rule Name, Description
├── Choose Layout               ← правило живе на одному layout
└── Rule Type
    ├── Conditional
    │   ├── Execute On          ← створення задачі, оновлення або обидва (хоча б один)
    │   └── умови (Add Condition; до 35 на правило)
    │       ├── критерії: поле · оператор · значення (кілька — через AND / OR)
    │       └── дії (Add Action; щонайменше одна на умову)
    └── Dependent
        ├── Primary Field       ← список, від якого залежимо
        └── Dependent Field     ← список, чиї значення фільтруємо, + мапа значень
```

Що з цього випливає:

1. **Правило належить одному layout.** Правило на layout А не діє в проєкті на layout Б — і в
   проєкті на приватній копії layout А теж: копія — інший layout.
2. **У межах одного правила спрацьовує перша умова, що збіглася.** Якщо в правилі кілька умов,
   виконуються дії тільки першої умови, що підійшла; решта навіть не перевіряються. Тому
   незалежні вимоги розкладай на окремі правила, а всередині правила став конкретнішу умову
   першою.
3. **Одне поле-тригер — одне умовне правило.** Поле, з якого
   починається умова одного умовного правила, для нового умовного правила того самого layout не
   пропонується пошуком узагалі, без жодного повідомлення — рядок поля просто відсутній у списку.
   Це стається на будь-якій кількості правил одного layout: поле, вже використане як стартове в
   одному умовному правилі, зникає з пошуку для іншого, хоча воно стоїть на самому layout і
   доступне для дій (Show fields, Set mandatory fields тощо) без обмежень. Якщо потрібного поля для
   нового правила нема, додай вимогу в наявне правило на цьому полі як ще одну умову (**Add
   Condition**) з власними діями. Умови, що можуть збігтися одночасно, став так: конкретніша —
   першою, і в ній повтори дії загальнішої. Таке об'єднання запиши як відхилення від документа.
   Обмеження діє тільки між умовними правилами: поле, що вже стартове в умовному правилі, без
   перешкод стає **Primary Field** нового залежного правила того самого layout.
4. **Поля для умов**: кастомні поля плюс дефолтні поля задачі. У тріалі стартове поле
   умови можна обрати і серед них **Owner** і **Status** — обидва пропонуються поруч із Task Name,
   Priority, Start Date, Due Date, Completion Percentage і кастомними полями layout.
5. **Оператор Is Updated** спрацьовує, коли поле змінили при оновленні задачі, і застосовується лише
   до поля, з якого починається умова. З такою умовою доступна тільки дія **Set mandatory fields**,
   зате в ній з'являється опція **Clear the current value and prompt for a new value when
   triggered** — очистити значення і попросити нове. Приклад: змінили Due Date — поле
   `Reason for Delay` стає обов'язковим і порожнім.
6. **Ліміти:** до 35 умов на правило, до 200 умов на layout; кількість правил на layout, за
   довідкою, не обмежена.

---

## 14.3. Дії умовного правила

| дія | що робить | обмеження |
|---|---|---|
| **Show fields** | показує поля, коли умова виконана | довідка описує її як показ полів лише за виконаної умови: поки умова не спрацювала, поле сховане (перевір першим тестом) |
| **Show sections** | показує цілу секцію | дефолтної секції в списку нема; секцію, де стоїть поле-тригер, редактор для цієї дії не прийме |
| **Set mandatory fields** | робить поля обов'язковими | з умовою Is Updated — опція очистити значення |
| **Mark fields as not mandatory** | знімає обов'язковість (у довідці дія зветься Remove Mandatory Field) | для полів, які обов'язкові без правила |
| **Disable field** | поле видно, але змінити не можна (підказка на кшталт «Layout rule restricts editing this field.») | обов'язкове поле вимкнути не можна |

Чотири наслідки, на яких спотикаються:

1. **Дії «Hide» нема.** Щоб сховати поле за умови X, показуй його за умови «не X». Тоді поле
   сховане в усіх станах, де «не X» не виконується, — зокрема, можливо, коли поле-тригер порожнє.
   Рішення записуй: це вже відхилення від дослівного формулювання вимоги.
2. **Дії «Enable» теж нема.** Disable field діє, поки умова виконана; перестала виконуватись —
   поле очікувано знову доступне. Це перевіряють.
3. **Обов'язкове і вимкнене — несумісні.** Довідка каже прямо: обов'язкове поле вимкнути не
   можна; для поля, обов'язкового в layout, у редакторі правил є помилка «Field is mandatory in
   layout».
   Тому поля, якими керують правила, не роби обов'язковими у властивостях layout. Що буде, коли
   одне правило робить поле обов'язковим, а друге одночасно вимикає його, довідка не описує — це
   конфлікт, який треба знайти і перевірити.
4. **Обов'язкове сховане поле — пастка.** Якщо в якомусь стані поле обов'язкове, але сховане,
   людина, найімовірніше, не збереже задачу і не побачить чому. Стеж, щоб Set mandatory fields
   стосувався полів, які в цьому ж стані видно.

### Форма як стан

Щоб перевіряти правила, опиши форму як таблицю: для кожного набору значень полів-тригерів — стан
кожного залежного поля. Позначення в цьому уроці:

| позначка | стан поля |
|---|---|
| `—` | сховане |
| `V` | видно, необов'язкове |
| `V·M` | видно, обов'язкове |
| `V·D` | видно, вимкнене |
| список значень | що пропонує випадайка |

Кожен рядок такої таблиці — готовий тест: вибрав значення — звірив стан.

---

## 14.4. Залежне правило

Залежне правило пов'язує **Primary Field** (список, від якого залежимо) і **Dependent Field**
(кастомний список, чиї значення фільтруємо; у прикладі довідки це навіть список користувачів) і
для значень основного поля задає дозволені значення залежного.

Що треба знати наперед:

- **залежний список має містити всі значення** — об'єднання всіх наборів. Правило не додає
  значень, воно лише показує потрібну частину тих, що вже є в полі;
- мапа задається на значення основного поля. Якщо редактор приймає одне значення основного поля
  на умову — додай умову на кожне (п'ять відділів — п'ять умов; ліміт 35);
- довідка не відповідає на три питання, які доведеться з'ясувати тестом:
   1. що пропонує залежний список, поки основне поле порожнє;
   2. що стається з уже вибраним значенням, коли основне поле змінили і це значення стало
      недозволеним (у продукті є повідомлення «The value you selected for … does not match the
      dependent rule.» — запиши, чи і коли воно з'являється);
   3. як поводиться збережена задача, коли її основне поле змінюють при оновленні.

---

## 14.5. Де це в інтерфейсі: створити правило

Правила макета — окремий пункт меню: **Setup → Customization → Layout Rules**. У тріалі
сторінка відкривається на вкладках модулів **Projects**, **Task**, **Issues**, **Phase** (Time Log і
User серед них нема — саме ці чотири модулі підтримують layout rules); порожній стан каже «No layout
rules created yet.» і показує кнопку **New Layout Rule**, яка відкриває форму без жодних проблем.

### Покроково: умовне правило

1. **Setup → Customization → Layout Rules**, вкладка модуля задач.
2. **New Layout Rule** праворуч угорі.
3. **Rule Name**, **Description** і **Choose Layout** — layout, на якому працюватиме правило.
4. **Rule Type** → **Conditional** (обраний за замовчуванням) або **Dependent**.
5. **Execute On**: **Task Creation** і **Task Updation** — обидва прапорці вже позначені за
   замовчуванням, знімати чи ставити нічого не треба, якщо потрібні саме вони (так вимагає чекліст
   документа). Без жодного тригера умову не збережеш.
6. Перша умова прямо на цій формі — це рівно **один** рядок: поле, оператор (**Is**, **Is Not**,
   **Contains** тощо), значення. Тут AND/OR ще нема. Натисни **Save** — з'явиться картка
   **Condition 1** з посиланням **+ Add Action**.
7. **+ Add Action** → одна з п'яти дій (**Show fields**, **Show sections**, **Set mandatory
   fields**, **Mark fields as not mandatory**, **Disable field**) → обери поля (мультивибір з
   пошуком) → **Save**. Дію додано — під карткою одразу з'являється наступна **+ Add Action** для
   ще однієї дії того самого переходу.
8. **Другий і наступний критерій до тієї самої умови (AND):** відкрий умову на редагування
   (олівець у правому верхньому куті картки **Condition N**) — під першим рядком з'явиться
   маленька іконка **+** (у тріалі вона стоїть впритул праворуч від рядка й губиться при вузькому
   вікні браузера — якщо її не видно, розтягни вікно або прогорни картку вбік). Клік по ній додає
   рядок **2** з полем, оператором і значенням і зв'язує обидва рядки написом **AND** та полем
   **Criteria pattern** зі значенням `(1 AND 2)`, яке можна редагувати вручну (наприклад, на
   `(1 OR 2)`, якщо потрібно OR — за формою це те саме поле, за яке відповідав пункт «критерії …
   через AND / OR»).
9. **Наступна незалежна умова того самого правила (Add Condition):** під останньою карткою умови,
   на вертикальній лінії таймлайну, стоїть кружечок **+** (без підпису) — клік відкриває форму
   **Add Condition** з тим самим набором полів, що й перша умова, плюс власне поле **Criteria
   pattern**. Дії для неї додаються так само через **+ Add Action** після збереження.
10. Коли всі умови й дії готові, правило вже збережено покроково — окремої фінальної кнопки
    **Save** для всього правила нема.

### Покроково: залежне правило

1–3. Як вище.
4. **Rule Type** → **Dependent**.
5. **Primary Field** і **Dependent Field**.
6. Для кожного значення основного поля — дозволені значення залежного.
7. **Save**.

**Що побачиш:** правило в списку сторінки **Layout Rules**. Змінити або видалити правило: наведи
курсор на правило → іконка додаткових дій → **Edit** або **Delete**. Видалене правило не
відновити — про це попереджає підтвердження.

---

## 14.6. Підготовка: layout, поля, тестовий проєкт

Для кожного з трьох завдань порядок однаковий.

1. **Layout.** **Setup → Customization → Layouts → Task → Create Layout**, базовий
   `Standard Layout`, **Layout Name** — із завдання.
2. **Поля.** У редакторі: тип із **New Fields** → назва і значення → **Add to Layout**; наприкінці
   **Save Layout**. Три поради:
   - збери поля завдання в одну секцію з нормальною назвою, а не в `Untitled Section`;
   - **не став Mandatory у властивостях** полів, якими керують правила: обов'язковість задають
     правила, а обов'язкове поле ще й не вимкнеш;
   - **не став значень за замовчуванням** у поля-тригери: дефолт мовчки вмикає умову на кожній
     новій задачі.
3. **Тестовий проєкт.** **Projects → New Project → Blank project**; у **Task Layout** обери
   новий layout і **зніми** галочку **Create a private copy of this layout**. Інакше проєкт
   отримає копію — окремий layout, а твої правила лишаться на оригіналі (чи копіюються правила в
   приватну копію, довідка не каже). Перевір: назва проєкту стоїть під новим layout у списку.
4. **Правила** — по одному. Після кожного — швидка перевірка у формі **Add Task** тестового
   проєкту.
5. **Докази:** скриншот полів у редакторі, скриншот кожного правила, результат швидкої перевірки.

Назви тестових проєктів у цьому уроці: `Layout QA – Risk`, `Layout QA – Onboarding`,
`Layout QA – Incident`.

Поля типу User Pick List показують користувачів проєкту; у тестовому проєкті там, найімовірніше,
будеш лише ти — для завдань цього достатньо.

---

## 14.7. Завдання 1 — Risk Assessment Layout

У документі: *Assignment 1: Multi-Level Conditional Rules for Risk Assessment Tasks*.

**Сценарій.** Команда ризик-менеджменту оцінює ризики різної серйозності. Залежно від типу і
серйозності ризику форма задачі має вимагати потрібні дані і відповідальних.

**Layout:** `Risk Assessment Layout`.

**Поля:**

| поле | тип | значення |
|---|---|---|
| `Risk Type` | Pick List | `Operational`, `Financial`, `Compliance`, `Strategic` |
| `Risk Severity` | Pick List | `Low`, `Medium`, `High`, `Critical` |
| `Mitigation Plan` | Multi-Line | — |
| `Assigned Reviewer` | User Pick List | — |
| `Review Due Date` | Date | — |
| `Residual Risk Level` | Pick List | `Acceptable`, `Monitor`, `Escalate` |

**Правила:**

| правило | тип | умова | дії |
|---|---|---|---|
| Rule 1 | Conditional | Risk Severity = High **або** Critical | Show fields: Mitigation Plan, Assigned Reviewer, Review Due Date; Set mandatory fields: Mitigation Plan, Assigned Reviewer |
| Rule 2 | Conditional | Risk Type = Compliance **і** Risk Severity = Critical | Set mandatory fields: Review Due Date; Show fields: Residual Risk Level |
| Rule 3 | Conditional (дія Disable field) | Risk Severity = Low | Disable field: Mitigation Plan, Residual Risk Level |

### Покроково

1. Layout `Risk Assessment Layout` на основі `Standard Layout`; секція `Risk Details` з шістьма
   полями; **Save Layout**.
2. Проєкт `Layout QA – Risk` на цьому layout (галочку приватної копії знято).
3. **Rule 1:** **New Layout Rule** → **Rule Name** `RA Rule 1 – High or Critical` → layout
   `Risk Assessment Layout` → **Conditional** → **Execute On**: створення і оновлення (уже
   позначені) → умова `Risk Severity` **Is** `High` → **Save**. У тріалі поле
   значення для оператора **Is** приймає рівно одне значення — після кліку на `High` список
   закривається, другого значення в той самий рядок не додати. Тому «High або Critical» — це
   **дві окремі умови** одного правила, не одна умова з двома значеннями: у збереженому
   **Condition 1** відкрий олівець → маленька іконка **+** біля рядка 1 (за вузького вікна ховається
   праворуч) додає **AND**, а щоб отримати **OR** для другого значення того самого поля — простіше
   не чіпати рядок 1, а створити нижче **другу незалежну умову правила** (кружечок **+** під
   карткою) з тим самим полем `Risk Severity` **Is** `Critical`. В обох умовах — однакові дії:
   **Add Action** → **Show fields** → `Mitigation Plan`, `Assigned Reviewer`, `Review Due Date` →
   **Add Action** → **Set mandatory fields** → `Mitigation Plan`, `Assigned Reviewer`.
   **Що побачиш** у **Add Task** проєкту `Layout QA – Risk`: поки `Risk Severity` порожнє, трьох
   полів нема; обираєш `High` — вони з'являються, `Mitigation Plan` і `Assigned Reviewer` позначені
   обов'язковими; `Review Due Date` видно, але без зірочки; зберегти з порожнім `Mitigation Plan`
   не вийде — поле і `Assigned Reviewer` підсвічуються червоним, задача не створюється, поки обидва
   не заповниш. Те саме — при `Critical` (перевір саме через другу умову, а не «або» в першій).
4. **Rule 2:** `RA Rule 2 – Compliance Critical` → умова, що починається з `Risk Type`:
   `Risk Type` **Is** `Compliance` AND `Risk Severity` **Is** `Critical` → **Set mandatory fields**
   → `Review Due Date` → **Show fields** → `Residual Risk Level` → **Save**.
   **Що побачиш:** `Compliance` + `Critical` — з'являється `Residual Risk Level`, `Review Due Date`
   стає обов'язковим; `Operational` + `Critical` — `Residual Risk Level` сховане, `Review Due Date`
   видно, але необов'язкове.
5. **Rule 3 — окремим правилом не вийде.** Поле, яке вже
   є стартовим у чужому правилі, зникає з пошуку зовсім, без пояснення — а `Risk Severity` до цього
   моменту вже стартове поле в `RA Rule 1` (Rule 2 стартує з `Risk Type`, тому окремим правилом
   лишається можливим). Замість нового `RA Rule 3` онови `RA Rule 1`: відкрий картку останньої
   умови → кружечок **+** на таймлайні під нею → **Add Condition** → нова умова автоматично
   пропонує те саме поле, `Risk Severity` **Is** `Low` → **Save** → **+ Add Action** →
   **Disable field** → `Mitigation Plan`, `Residual Risk Level`. Порядок умов у правилі значення не
   має: `High`, `Critical` і `Low` одночасно не збігаються ніколи. `RA Rule 1` в підсумку має три
   умови (High, Critical, Low), `RA Rule 2` лишається окремим правилом на `Risk Type`.

### Очікуваний стан форми

| # | Risk Type | Risk Severity | Mitigation Plan | Assigned Reviewer | Review Due Date | Residual Risk Level |
|---|---|---|---|---|---|---|
| 1 | будь-який | порожньо | — | — | — | — |
| 2 | будь-який | Low | — (якщо видно — `V·D`) | — | — | — (якщо видно — `V·D`) |
| 3 | будь-який | Medium | — | — | — | — |
| 4 | будь-який | High | `V·M` | `V·M` | `V` | — |
| 5 | Operational | Critical | `V·M` | `V·M` | `V` | — |
| 6 | Compliance | Critical | `V·M` | `V·M` | `V·M` | `V` |
| 7 | Compliance | High | `V·M` | `V·M` | `V` | — |

### Розбір для QA

- **Rule 1 і Rule 2 перетинаються** на `Compliance` + `Critical`. Це два окремі правила, тож
  очікуєш дії обох: рядок 6. Рядки 5 і 7 — негативні для AND: одна частина умови є, другої нема.
  Якщо обидві умови опиняться в одному правилі, спрацює лише перша, що збіглася: з умовою
  `High або Critical` першою рядок 6 втратить дії Rule 2.
- **Rule 3 може бути непомітним.** `Mitigation Plan` і `Residual Risk Level` стоять у діях Show
  fields, тож для `Low` вони й так сховані — вимикати нічого. Що станеться, коли людина обрала
  `High`, заповнила план і перемкнула на `Low` (поле сховалось? вимкнулось? значення лишилось і
  збереглось?), покаже тільки тест. Надлишкове правило — спостереження для звіту, а не твоя
  помилка.

---

## 14.8. Завдання 2 — Employee Onboarding Layout

У документі: *Assignment 2: Multi-Branch Onboarding Flow Using Dependent and Conditional Rules*.

**Сценарій.** HR веде задачі онбордингу для різних відділів. Від відділу залежать навчальні
модулі, ментор і вимоги.

**Layout:** `Employee Onboarding Layout`.

**Поля:**

| поле | тип | значення |
|---|---|---|
| `Department` | Pick List | `Engineering`, `Sales`, `Marketing`, `HR`, `Support` |
| `Training Module` | Pick List | `Git`, `Security`, `Dev Stack`, `CRM Training`, `Product Demos`, `SEO`, `Content Tools`, `Policy Management`, `Zoho People`, `Zoho Desk`, `Call Handling` |
| `Assigned Mentor` | User Pick List | — |
| `Training Completion Date` | Date | — |
| `System Access Level` | Pick List | `Full`, `Limited`, `Guest` |
| `NDA Submitted` | Checkbox | — |

У `Training Module` — усі одинадцять значень: залежне правило лише звужує список.

**Правила:**

| правило | тип | умова / поля | дії |
|---|---|---|---|
| Rule 1 | Dependent | Primary Field: Department → Dependent Field: Training Module | Engineering → Git, Security, Dev Stack; Sales → CRM Training, Product Demos; Marketing → SEO, Content Tools; HR → Policy Management, Zoho People; Support → Zoho Desk, Call Handling |
| Rule 2 | Conditional | System Access Level = Full | Show fields і Set mandatory fields: NDA Submitted |
| Rule 3 | Conditional | Department = Support **або** Sales | Set mandatory fields: Training Completion Date; Show fields: Assigned Mentor |
| Rule 4 | Conditional | Department = Marketing **і** System Access Level = Guest | Disable field: Training Module |

### Покроково

1. Layout `Employee Onboarding Layout`; секція `Onboarding Details` з шістьма полями; **Save
   Layout**. Проєкт `Layout QA – Onboarding` на цьому layout.
2. **Rule 1:** `EO Rule 1 – Training by Department` → **Dependent** → **Primary Field**
   `Department` → **Dependent Field** `Training Module` → для кожного відділу позначити його
   модулі → **Save**.
   **Що побачиш:** `Department` = `Sales` — у `Training Module` лише `CRM Training` і
   `Product Demos`.
3. **Rule 2:** `EO Rule 2 – NDA for Full access` → умова `System Access Level` **Is** `Full` →
   **Show fields** → `NDA Submitted` → **Set mandatory fields** → `NDA Submitted` → **Save**.
   **Що побачиш:** `NDA Submitted` з'являється лише для `Full`.
4. **Rule 3:** `EO Rule 3 – Support or Sales` → умова `Department` **Is** `Support` OR
   `Department` **Is** `Sales` → **Set mandatory fields** → `Training Completion Date` → **Show
   fields** → `Assigned Mentor` → **Save**.
   **Що побачиш:** для `Support` і `Sales` з'являється `Assigned Mentor`, дата стає
   обов'язковою; для інших відділів ментора не видно, дата необов'язкова.
5. **Rule 4:** `EO Rule 4 – Marketing Guest` → умова `Department` **Is** `Marketing` AND
   `System Access Level` **Is** `Guest` → **Disable field** → `Training Module` → **Save**.
   **Що побачиш:** `Marketing` + `Guest` — `Training Module` видно, але вибрати значення не можна.
   Якщо редактор не пропонує для Rule 4 ні `Department`, ні `System Access Level` (обидва вже
   зайняті Rule 3 і Rule 2), додай цю умову другою умовою в `EO Rule 3` (**Add Condition**) з дією
   **Disable field**: з `Support або Sales` вона одночасно не збігається.

### Очікуваний стан форми

| # | Department | System Access Level | Training Module | Assigned Mentor | Training Completion Date | NDA Submitted |
|---|---|---|---|---|---|---|
| 1 | порожньо | порожньо | зафіксуй, що пропонує | — | `V` | — |
| 2 | Engineering | Limited | Git, Security, Dev Stack | — | `V` | — |
| 3 | Sales | Limited | CRM Training, Product Demos | `V` | `V·M` | — |
| 4 | Support | Full | Zoho Desk, Call Handling | `V` | `V·M` | `V·M` |
| 5 | Marketing | Guest | `V·D` (SEO, Content Tools) | — | `V` | — |
| 6 | Marketing | Full | SEO, Content Tools | — | `V` | `V·M` |
| 7 | HR | Guest | Policy Management, Zoho People | — | `V` | — |

### Розбір для QA

- **Обов'язковий чекбокс.** Що означає «обов'язковий» для `NDA Submitted`: обов'язково
  позначений чи будь-який стан? Бізнес-сенс ясний — повний доступ лише з підписаним NDA. Якщо
  непозначений обов'язковий чекбокс не заважає зберегти задачу, вимога бізнесу не виконується.
  Перевір і запиши.
- **Rule 4 вимикає поле, яке фільтрує Rule 1.** Людина обрала `Marketing`, модуль `SEO`, а потім
  `Guest`: значення лишається у вимкненому полі чи очищується? Документ не визначає — фіксуєш
  факт.
- **Зміна відділу після вибору модуля.** `Engineering` + `Git` → перемкнули на `Sales`: `Git` для
  `Sales` недозволений. Що зробить форма — очистить, лишить, не дасть зберегти?
- Рядки 6 і 7 — негативні для AND у Rule 4: лише одна частина умови.

---

## 14.9. Завдання 3 — Incident Resolution Layout

У документі: *Assignment 3: Dynamic Field Visibility for Customer Incident Resolution Workflow*.

**Сценарій.** Підтримка ескалує звернення клієнтів як внутрішні задачі. Процес залежить від типу
інциденту і від того, чи потрібна зовнішня комунікація.

**Layout:** `Incident Resolution Layout`.

**Поля:**

| поле | тип | значення |
|---|---|---|
| `Incident Type` | Pick List | `Technical`, `Billing`, `Complaint`, `Feedback` |
| `Requires External Communication?` | Checkbox | — |
| `Customer Contact Method` | Pick List | `Email`, `Phone`, `Chat` |
| `Escalation Stage` | Pick List | `Level 1`, `Level 2`, `Final` |
| `Escalated To` | User Pick List | — |
| `Public Response Draft` | Multi-Line | — |
| `Deadline for Resolution` | Date | — |

**Правила:**

| правило | тип | умова / поля | дії |
|---|---|---|---|
| Rule 1 | Conditional | Requires External Communication? позначено | Show fields і Set mandatory fields: Customer Contact Method, Public Response Draft |
| Rule 2 | Conditional | Incident Type = Complaint **і** Escalation Stage = Final | Show fields і Set mandatory fields: Escalated To; Disable field: Customer Contact Method |
| Rule 3 | Conditional | Incident Type = Feedback | сховати: Escalation Stage, Escalated To |
| Rule 4 | Dependent | Primary Field: Incident Type → Dependent Field: Customer Contact Method | Technical → Email, Chat; Billing → Email, Phone; Complaint → Phone, Chat; Feedback → Email |

### Rule 3 без дії «Hide»

Серед п'яти дій умовного правила «сховати» нема. Вимогу реалізують навпаки:

- **Escalated To** для `Feedback` сховане і так: його показує лише Rule 2, а він спрацьовує тільки
  для `Complaint`.
- **Escalation Stage** показуй для всіх типів, крім `Feedback`: умова `Incident Type` **Is Not**
  `Feedback` → **Show fields** → `Escalation Stage`. У тріалі оператор **Is Not** для
  pick list є в редакторі поруч із **Is**, **Contains** тощо, і саме з ним `IR Rule 3`
  збережено — перелік трьох значень для цього кроку не знадобився.

Два варіанти умови й далі відрізняються порожнім `Incident Type`: вимога ховає поле тільки для
`Feedback`, отже для порожнього типу воно мало б лишатись видимим. Як саме поводиться
`Is Not Feedback` на порожньому значенні — перевір за технікою 1 («Як це тестувати») і запиши факт.
Дію приховування «Hide» серед п'яти дій редактор не пропонує ні тут, ні деінде — реалізація через
інвертований Show лишається єдиним шляхом.

### Покроково

1. Layout `Incident Resolution Layout`; секція `Incident Details` із сімома полями; **Save
   Layout**. Проєкт `Layout QA – Incident` на цьому layout.
2. **Rule 1:** `IR Rule 1 – External communication` → умова: `Requires External Communication?`
   позначено → **Show fields** і **Set mandatory fields** → `Customer Contact Method`,
   `Public Response Draft` → **Save**.
   **Що побачиш:** позначив чекбокс — з'явились два обов'язкові поля; зняв — зникли.
3. **Rule 2:** `IR Rule 2 – Complaint Final` → умова, що починається з `Escalation Stage`:
   `Escalation Stage` **Is** `Final` AND `Incident Type` **Is** `Complaint` → **Show fields** і
   **Set mandatory fields** → `Escalated To` → **Disable field** → `Customer Contact Method` →
   **Save**. У тріалі редактор дає вибрати `Customer Contact Method` для Disable field
   без перешкод, попри те що те саме поле в іншому правилі (`IR Rule 1`) стає обов'язковим:
   конфлікт між правилами — це питання рядка 6 (`Complaint` + `Final` + позначений чекбокс), а не
   заборона на етапі налаштування.
4. **Rule 3:** `IR Rule 3 – Escalation Stage except Feedback` → умова за розбором вище → **Show
   fields** → `Escalation Stage` → **Save**.
   **Що побачиш:** для `Feedback` полів `Escalation Stage` і `Escalated To` нема.

   Rule 2 починається з `Escalation Stage`, щоб `Incident Type` лишилось вільним для Rule 3. Якщо
   обидві умови все ж доведеться тримати в одному правилі на `Incident Type`, умова `Complaint` +
   `Final` має стояти першою (інакше «не Feedback» перехопить `Complaint`) і в її діях має бути ще
   й **Show fields** → `Escalation Stage`: коли вона збіглась, другу умову вже не перевіряють, і без
   цього поле сховається саме тоді, коли в ньому обрано `Final`.
5. **Rule 4:** `IR Rule 4 – Contact method by type` → **Dependent** → **Primary Field**
   `Incident Type` → **Dependent Field** `Customer Contact Method` → мапа з таблиці → **Save**.
   **Що побачиш** (з позначеним чекбоксом, інакше поле сховане): `Feedback` — лише `Email`.

### Очікуваний стан форми

`ES` — поле `Escalation Stage`; `Deadline for Resolution` ні від чого не залежить і завжди `V`.

| # | Incident Type | External? | ES (значення) | Customer Contact Method | Public Response Draft | ES (поле) | Escalated To |
|---|---|---|---|---|---|---|---|
| 1 | порожньо | ні | — | — | — | `V` за вимогою; перевір свій варіант | — |
| 2 | Technical | ні | Level 1 | — | — | `V` | — |
| 3 | Technical | так | Level 1 | `V·M`: Email, Chat | `V·M` | `V` | — |
| 4 | Billing | так | Level 2 | `V·M`: Email, Phone | `V·M` | `V` | — |
| 5 | Complaint | ні | Final | — (вимкнення не видно) | — | `V` | `V·M` |
| 6 | Complaint | так | Final | **конфлікт**: `M` за Rule 1 і `D` за Rule 2; Phone, Chat | `V·M` | `V` | `V·M` |
| 7 | Complaint | так | Level 2 | `V·M`: Phone, Chat | `V·M` | `V` | — |
| 8 | Feedback | так | — | `V·M`: Email | `V·M` | — | — |
| 9 | Feedback | ні | — | — | — | — | — |

### Розбір для QA

- **Конфлікт вимог (рядок 6).** Rule 1 робить `Customer Contact Method` обов'язковим, Rule 2 його
  вимикає. Обов'язкове поле вимкнути не можна; що зробить форма, коли обидва правила спрацюють
  разом, невідомо: не дасть зберегти, проігнорує вимкнення чи обов'язковість. Будь-який результат
  — прогалина у вимогах, яку треба описати.
- **Rule 2 наполовину невидимий (рядок 5).** Без зовнішньої комунікації поле контакту сховане, і
  його вимкнення нічого не змінює. Тобто вимкнення з Rule 2 або непомітне, або конфліктує з Rule 1.
- **Rule 4 працює, лише коли поле видно** — з позначеним чекбоксом.
- **Зміна типу після вибору способу зв'язку.** `Billing` + `Phone` → перемкнули на `Technical`:
  `Phone` для `Technical` недозволений. Що зробить форма, покаже тест.

---

## 14.10. Як це тестувати

**Техніка 1 — таблиця станів.** Входи — поля-тригери, виходи — стан кожного залежного поля. Як
вибирати рядки:

- для умови з **OR** — кожен операнд окремо і жоден;
- для умови з **AND** — обидва, лише перший, лише другий, жоден;
- для pick list — кожне значення-тригер, одне значення не-тригер і порожнє;
- для чекбокса — позначений і непозначений.

**Техніка 2 — переходи у формі.** Умову ввімкнув → вимкнув → ввімкнув, не зберігаючи. Перевір:
сховане поле більше не блокує збереження; що стається зі значенням, введеним у поле, яке потім
сховалось (лишається? зберігається в задачі?); вимкнене поле знову доступне, коли умова зникла.

**Техніка 3 — створення і оновлення.** Той самий рядок таблиці двічі: через **Add Task** і через
зміну поля-тригера в уже збереженій задачі. Правила мають спрацьовувати в обох випадках. На
оновленні обов'язкові поля, найімовірніше, запитає окреме вікно: у продукті є повідомлення «Layout
rule has triggered the below mandatory fields. Please fill the fields to proceed.» Зафіксуй, де і
коли воно з'являється.

**Техніка 4 — точки входу.** Основна — форма **Add Task**. Задачу можна створити й інакше: зі
списку, з Kanban, як підзадачу. Чи діють там правила, довідка не каже — це дослідження, його
результат іде в звіт.

**Контрольні поля.** Поля без правил (`Deadline for Resolution`) і стани «нічого не вибрано» мають
лишатися незмінними. Регрес зазвичай вилазить саме тут.

**Швидка перевірка чи повний прогін.** Після кожного правила — швидка перевірка одного-двох
рядків. Повна документація і прогін за всіма рядками — окрема робота, коли всі три конфігурації
готові.

**Що довести зараз:** скриншоти полів кожного layout у редакторі, скриншоти налаштувань кожного
правила, результат швидкої перевірки, список рішень, прийнятих замість документа (реалізація
Rule 3 для інцидентів, вибір операторів).

Приклад тест-кейсу у форматі документа:

- **Title:** Sales робить Training Completion Date обов'язковим і показує Assigned Mentor
- **Precondition:** `Employee Onboarding Layout` прив'язаний до `Layout QA – Onboarding`; правила
  EO Rule 1–4 збережені; ти в проєкті `Layout QA – Onboarding`.
- **Steps:**
   1. **Tasks → Add Task**, назва `EO-01 Sales onboarding`.
   2. `Department` не обирай; подивись на поля.
   3. Обери `Department` = `Sales`.
   4. `Training Completion Date` лиши порожнім; спробуй зберегти.
   5. Заповни дату; збережи.
- **Expected Result:** крок 2 — `Assigned Mentor` сховане, `Training Completion Date` видно і
  необов'язкове; крок 3 — `Assigned Mentor` з'явилось, `Training Completion Date` обов'язкове,
  `Training Module` пропонує лише `CRM Training` і `Product Demos`; крок 4 — задача не
  зберігається, поле дати позначене; крок 5 — задача збережена.
- **Actual Result:** *[що сталося насправді; текст помилки — дослівно]*
- **Pass/Fail:** *[ ]*
- **Notes/Attachments:** скриншоти після кроків 2, 3 і 4.

---

## 14.11. Типові помилки

**1. Правила на оригінальному layout, а проєкт на приватній копії.** Форма не змінюється, бо в
проєкту інший layout. Знімай галочку **Create a private copy of this layout** для тестових
проєктів.

**2. AND замість OR.** `Risk Severity Is High AND Risk Severity Is Critical` не виконується ніколи.

**3. Дві незалежні вимоги в одному правилі без продуманого порядку.** Спрацьовує лише перша умова,
що збіглася; дії другої губляться на перетині.

**4. Mandatory у властивостях layout для поля, яким керує правило.** Поле обов'язкове завжди, навіть
коли сховане, і правило вже не може його вимкнути.

**5. Пошук дії «Hide».** Її нема; ховають, показуючи за протилежної умови.

**6. Неповний залежний список.** Значення, якого нема в полі, правило не покаже.

**7. Значення за замовчуванням у полі-тригері.** Умова спрацьовує на кожній новій задачі, і тест
проходить «сам».

**8. Перевірено тільки створення.** Оновлення поводиться інакше, і саме там ховаються сюрпризи.

**9. Перевірено один операнд з OR.** `High` працює, `Critical` забули — друга половина умови не
перевірена.

**10. Обов'язкове сховане поле.** Людина не може зберегти задачу і не бачить чому.

### Симптом → причина

| симптом | найімовірніша причина |
|---|---|
| **New Layout Rule** нема або недоступна | план порталу нижче за Enterprise або недостатньо прав |
| правило збережене, а форма задачі не змінюється | проєкт на іншому layout (приватна копія) або перевіряєш не через **Add Task** |
| поля з дії Show fields видно завжди | поле не потрапило в дію або правило на іншому layout; якщо все налаштовано правильно — зафіксуй факт поведінки продукту |
| для `Compliance` + `Critical` спрацювала лише частина дій | обидві умови в одному правилі: виконується перша, що збіглася |
| «All fields have been used in other conditional rules.» або потрібного поля нема для нового правила | поле вже стоїть в умові іншого умовного правила цього layout: додай умову в те правило |
| умова не спрацьовує ніколи | AND замість OR або значення в умові не те, що в списку |
| поле не вдається вибрати в **Disable field** | поле обов'язкове за властивостями layout («Field is mandatory in layout») або в тій самій умові інша дія робить його обов'язковим |
| у діях доступна тільки **Set mandatory fields** | в умові оператор Is Updated |
| у залежному списку всі значення | правило не збережене, основне поле порожнє або мапа не задана |
| потрібного значення нема в залежному списку | значення нема в самому полі або мапа його не включає |
| в умові не знаходиш Status чи Owner | за довідкою, у правилах доступні кастомні поля і лише Priority, Start Date, дата завершення, Completion Percentage |
| задачу не зберегти, а порожніх видимих полів нема | обов'язкове поле сховане в цьому стані |
| умова спрацьовує на кожній новій задачі | у поля-тригера є значення за замовчуванням |
| Rule 3 з Risk Assessment нічого не змінює | поля для `Low` уже сховані діями Show fields |
| збереження блокується при `Complaint` + `Final` + зовнішня комунікація | конфлікт: поле обов'язкове за Rule 1 і вимкнене за Rule 2 |
| помилка про ліміт при збереженні правила | понад 35 умов у правилі або 200 на layout |
| не вдається прибрати поле з layout, видалити секцію, значення pick list чи сам layout | їх використовує layout rule: спершу зміни або видали правило |

---

## 14.12. Що варто запам'ятати

1. Layout rules змінюють форму, поки її заповнюють; дані після збереження змінюють workflow rules.
2. Conditional змінює властивості полів, Dependent звужує значення списку.
3. Правило живе на одному layout; приватна копія — інший layout.
4. У межах правила виконується тільки перша умова, що збіглася; незалежні вимоги — окремими
   правилами, а якщо редактор не дає другого правила на тому самому полі — окремими умовами,
   конкретніша першою.
5. Дії: Show fields, Show sections, Set mandatory fields, Mark fields as not mandatory, Disable
   field; «Hide» роблять інвертованим Show.
6. Обов'язкове поле вимкнути не можна; Mandatory у властивостях layout для керованих полів не
   став.
7. З умовою Is Updated доступна тільки Set mandatory fields і опція очистити значення.
8. Ліміти: 35 умов на правило, 200 на layout, кількість правил не обмежена.
9. Залежний список містить усі значення; правило лише фільтрує.
10. Форма — це стан: таблиця «входи → видимість, обов'язковість, доступність, значення» і є план
    тестів.
11. Перевіряй і створення, і оновлення, і зміну значень до збереження.

---

# Задачі

*Практичні задачі 14.3–14.8 — це три завдання документа повністю. Роби їх у порядку: спершу
layout і поля, потім тестовий проєкт, потім правила з перевіркою після кожного.*

**14.1.** *(пояснення)* Поясни своїми словами різницю між conditional і dependent layout rule. Для
кожного типу придумай приклад для форми **issue** (не з завдань документа).

**14.2.** *(передбач)* Дано правила Risk Assessment Layout: Rule 1 — якщо Risk Severity = High
або Critical, показати Mitigation Plan, Assigned Reviewer, Review Due Date і зробити обов'язковими
Mitigation Plan та Assigned Reviewer; Rule 2 — якщо Risk Type = Compliance і Risk Severity =
Critical, зробити обов'язковим Review Due Date і показати Residual Risk Level; Rule 3 — якщо Risk
Severity = Low, вимкнути Mitigation Plan і Residual Risk Level. Show fields ховає поле, поки умова
не виконана. Заповни стан чотирьох полів для комбінацій: (а) `Financial` + `Medium`;
(б) `Strategic` + `Critical`; (в) `Compliance` + `Critical`; (г) `Compliance` + `High`;
(ґ) `Operational` + `Low`; (д) нічого не обрано.

**14.3.** *(завдання 1, частина 1)* Створи layout `Risk Assessment Layout` і кастомні поля:
`Risk Type` (Pick List: `Operational`, `Financial`, `Compliance`, `Strategic`), `Risk Severity`
(Pick List: `Low`, `Medium`, `High`, `Critical`), `Mitigation Plan` (Multi-Line),
`Assigned Reviewer` (User Pick List), `Review Due Date` (Date), `Residual Risk Level` (Pick List:
`Acceptable`, `Monitor`, `Escalate`). Створи тестовий проєкт `Layout QA – Risk`, прив'язаний саме
до цього layout.

**14.4.** *(завдання 1, частина 2)* На `Risk Assessment Layout` створи правила:
Rule 1 (Conditional) — якщо Risk Severity = High або Critical: показати Mitigation Plan, Assigned
Reviewer, Review Due Date; Mitigation Plan і Assigned Reviewer обов'язкові. Rule 2 (Conditional) —
якщо Risk Type = Compliance і Risk Severity = Critical: Review Due Date обов'язкове, показати
Residual Risk Level. Rule 3 (Disable Field) — якщо Risk Severity = Low: вимкнути Mitigation Plan і
Residual Risk Level. Після кожного правила перевір форму **Add Task** у `Layout QA – Risk`, а
наприкінці пройди всі сім рядків таблиці станів. Якщо редактор не дає другого умовного правила на
тому самому полі, додай вимогу умовою в наявне правило (конкретнішу — першою, з діями обох) і
запиши це як відхилення.

**14.5.** *(завдання 2, частина 1)* Створи layout `Employee Onboarding Layout` і поля: `Department`
(Pick List: `Engineering`, `Sales`, `Marketing`, `HR`, `Support`), `Training Module` (Pick List з
модулями для всіх відділів: `Git`, `Security`, `Dev Stack`, `CRM Training`, `Product Demos`, `SEO`,
`Content Tools`, `Policy Management`, `Zoho People`, `Zoho Desk`, `Call Handling`),
`Assigned Mentor` (User Pick List), `Training Completion Date` (Date), `System Access Level` (Pick
List: `Full`, `Limited`, `Guest`), `NDA Submitted` (Checkbox). Створи проєкт
`Layout QA – Onboarding` на цьому layout.

**14.6.** *(завдання 2, частина 2)* Створи правила: Rule 1 (Dependent) — за Department показувати
Training Module: Engineering → Git, Security, Dev Stack; Sales → CRM Training, Product Demos;
Marketing → SEO, Content Tools; HR → Policy Management, Zoho People; Support → Zoho Desk, Call
Handling. Rule 2 (Conditional) — якщо System Access Level = Full: показати NDA Submitted і зробити
обов'язковим. Rule 3 (Conditional) — якщо Department = Support або Sales: Training Completion
Date обов'язкове, показати Assigned Mentor. Rule 4 (Conditional) — якщо Department = Marketing і
System Access Level = Guest: вимкнути Training Module. Перевір усі сім рядків таблиці станів і
окремо: обов'язковий непозначений чекбокс; `Marketing` + `SEO`, потім `Guest`; `Engineering` +
`Git`, потім `Sales`. Якщо для Rule 4 редактор не пропонує вільного поля, додай його умову в
правило Rule 3 і запиши це.

**14.7.** *(завдання 3, частина 1)* Створи layout `Incident Resolution Layout` і поля:
`Incident Type` (Pick List: `Technical`, `Billing`, `Complaint`, `Feedback`),
`Requires External Communication?` (Checkbox), `Customer Contact Method` (Pick List: `Email`,
`Phone`, `Chat`), `Escalation Stage` (Pick List: `Level 1`, `Level 2`, `Final`), `Escalated To`
(User Pick List), `Public Response Draft` (Multi-Line), `Deadline for Resolution` (Date).
Створи проєкт `Layout QA – Incident` на цьому layout.

**14.8.** *(завдання 3, частина 2)* Створи правила: Rule 1 (Conditional) — якщо Requires External
Communication = True: показати й зробити обов'язковими Customer Contact Method і Public Response
Draft. Rule 2 (Conditional) — якщо Incident Type = Complaint і Escalation Stage = Final: показати й
зробити обов'язковим Escalated To; вимкнути Customer Contact Method. Rule 3 (Conditional) — якщо
Incident Type = Feedback: сховати Escalation Stage і Escalated To. Rule 4 (Dependent) — за Incident
Type показувати Customer Contact Method: Technical → Email, Chat; Billing → Email, Phone; Complaint
→ Phone, Chat; Feedback → Email. Запиши, як ти реалізував Rule 3 (і чи довелося тримати Rule 2 і
Rule 3 в одному правилі), і пройди всі дев'ять рядків таблиці станів.

**14.9.** *(знайди помилки)* Колега налаштовував ті самі завдання. Що не так у кожному пункті і як
виправити?
   1. Правила Risk Assessment створені на `Risk Assessment Layout`, а тестовий проєкт `Risk Demo`
      створений із галочкою **Create a private copy of this layout**.
   2. Умова Rule 1 (Risk Assessment): `Risk Severity Is High AND Risk Severity Is Critical`.
   3. Rule 1 і Rule 2 (Risk Assessment) зібрані в одне правило: умова 1 — High або Critical з
      діями Rule 1; умова 2 — Compliance і Critical з діями Rule 2.
   4. У властивостях layout поле `Mitigation Plan` позначене Mandatory.
   5. Поле `Training Module` створене лише зі значеннями `Git`, `Security`, `Dev Stack` — «решту
      додасть залежне правило».
   6. Умова Rule 4 (Onboarding): `Department Is Marketing OR System Access Level Is Guest`.
   7. Rule 3 (Incident): умова `Incident Type Is Feedback`, дія **Show fields** → `Escalation Stage`,
      `Escalated To`.
   8. У поля `System Access Level` значення за замовчуванням `Full`.

**14.10.** *(дизайн)* Для Incident Resolution Layout побудуй таблицю станів на дев'ять рядків
(поля-входи: Incident Type, Requires External Communication?, Escalation Stage; поля-виходи:
Customer Contact Method, Public Response Draft, поле Escalation Stage, Escalated To) і випиши всі
місця, де вимоги суперечать одна одній або не визначають результат. Правила — як у задачі 14.8.

**14.11.** *(дослідження)* Створи проєкт `Layout QA – Risk Copy`: **Task Layout** =
`Risk Assessment Layout`, галочку **Create a private copy of this layout** не знімай. Спершу
передбач, потім перевір: чи змінюється форма **Add Task** цього проєкту при `Risk Severity` =
`High`; чи видно на сторінці **Layout Rules** правила для його копії. Запиши висновок і прибери за
собою.

**14.12.** *(порівняння)* Вимога: «для ризику High або Critical план пом'якшення має бути
заповнений». Порівняй, що дасть layout rule, workflow rule і Blueprint: що кожен гарантує, коли
діє, які шляхи створення задачі покриває. Що порадиш клієнту?

---

# Розв'язки

**14.1.** Conditional змінює *властивості полів* (видно, обов'язкове, вимкнене), коли виконується
умова. Dependent звужує *набір значень* одного списку залежно від значення іншого. Приклади для
issue: умовне — якщо Severity = `Critical`, Due Date стає обов'язковою; залежне — для Module =
`UI/UX` поле `Browser` пропонує лише браузери, а для інших модулів — інший набір.

**14.2.**

| | Mitigation Plan | Assigned Reviewer | Review Due Date | Residual Risk Level |
|---|---|---|---|---|
| (а) Financial + Medium | — | — | — | — |
| (б) Strategic + Critical | `V·M` | `V·M` | `V` | — |
| (в) Compliance + Critical | `V·M` | `V·M` | `V·M` | `V` |
| (г) Compliance + High | `V·M` | `V·M` | `V` | — |
| (ґ) Operational + Low | — (Rule 3 вимикає, але поле й так сховане) | — | — | — |
| (д) нічого не обрано | — | — | — | — |

(в) — єдиний рядок, де спрацьовують обидва правила; (г) — негативний для AND у Rule 2.

**14.3.**
1. **Setup → Customization → Layouts → Task → Create Layout** → базовий `Standard Layout` →
   **Layout Name** `Risk Assessment Layout` → **Create**.
2. Відкрий layout; додай секцію `Risk Details`; з **New Fields** — шість полів з таблиці, кожне
   **Add to Layout**; Mandatory і значень за замовчуванням не став; **Save Layout**.
3. **Projects → New Project → Blank project** → `Layout QA – Risk` → **Task Layout**
   `Risk Assessment Layout`, галочку **Create a private copy of this layout** знято → створи
   проєкт.
4. У списку layouts під `Risk Assessment Layout` — `Layout QA – Risk`.

**14.4.** Усі три правила: layout `Risk Assessment Layout`, **Rule Type** Conditional,
**Execute On** — створення і оновлення.

| Rule Name | умова | дії |
|---|---|---|
| `RA Rule 1 – High or Critical` | `Risk Severity` **Is** `High` OR `Risk Severity` **Is** `Critical` | **Show fields**: Mitigation Plan, Assigned Reviewer, Review Due Date; **Set mandatory fields**: Mitigation Plan, Assigned Reviewer |
| `RA Rule 2 – Compliance Critical` | `Risk Type` **Is** `Compliance` AND `Risk Severity` **Is** `Critical` | **Set mandatory fields**: Review Due Date; **Show fields**: Residual Risk Level |
| `RA Rule 3 – Low disables` | `Risk Severity` **Is** `Low` | **Disable field**: Mitigation Plan, Residual Risk Level |

Якщо редактор не дав окремих правил на `Risk Severity`, у `RA Rule 1` три умови в такому порядку:
`Compliance` + `Critical` (дії обох правил: чотири поля показати, `Mitigation Plan`,
`Assigned Reviewer`, `Review Due Date` обов'язкові) → `High` або `Critical` → `Low` (Disable
field). Очікування ті самі.

Очікування перевірки (`MP` — Mitigation Plan, `AR` — Assigned Reviewer, `RDD` — Review Due Date,
`RRL` — Residual Risk Level):

| Type + Severity | MP | AR | RDD | RRL |
|---|---|---|---|---|
| будь-який + порожньо / `Medium` | — | — | — | — |
| будь-який + `Low` | — (якщо видно — `V·D`) | — | — | — (якщо видно — `V·D`) |
| будь-який + `High` | `V·M` | `V·M` | `V` | — |
| `Operational` + `Critical` | `V·M` | `V·M` | `V` | — |
| `Compliance` + `Critical` | `V·M` | `V·M` | `V·M` | `V` |
| `Compliance` + `High` | `V·M` | `V·M` | `V` | — |

Окремо запиши перемикання `High` → `Low` із заповненим планом: поле сховалось чи вимкнулось, чи
лишилось значення, чи збереглося воно в задачі.

**14.5.**
1. Layout `Employee Onboarding Layout` на основі `Standard Layout`, секція `Onboarding Details`.
2. Поля за умовою; у `Training Module` — усі одинадцять значень; без Mandatory і дефолтів; **Save
   Layout**.
3. Проєкт `Layout QA – Onboarding`, **Task Layout** = `Employee Onboarding Layout`, галочку
   приватної копії знято; перевір прив'язку в списку.

**14.6.** Усі правила на layout `Employee Onboarding Layout`; умовні — з **Execute On** на
створення і оновлення.

| Rule Name | Rule Type | умова / поля | дії |
|---|---|---|---|
| `EO Rule 1 – Training by Department` | Dependent | **Primary Field** Department → **Dependent Field** Training Module | Engineering → Git, Security, Dev Stack; Sales → CRM Training, Product Demos; Marketing → SEO, Content Tools; HR → Policy Management, Zoho People; Support → Zoho Desk, Call Handling |
| `EO Rule 2 – NDA for Full access` | Conditional | `System Access Level` **Is** `Full` | **Show fields** і **Set mandatory fields**: NDA Submitted |
| `EO Rule 3 – Support or Sales` | Conditional | `Department` **Is** `Support` OR `Department` **Is** `Sales` | **Set mandatory fields**: Training Completion Date; **Show fields**: Assigned Mentor |
| `EO Rule 4 – Marketing Guest` | Conditional | `Department` **Is** `Marketing` AND `System Access Level` **Is** `Guest` | **Disable field**: Training Module |

Якщо окремого Rule 4 редактор не дав, його умова — друга умова в `EO Rule 3`; очікування ті самі.

Очікування (`TM` — Training Module, `AM` — Assigned Mentor, `TCD` — Training Completion Date):

| Department + Access | TM | AM | TCD | NDA Submitted |
|---|---|---|---|---|
| порожньо + порожньо | зафіксуй, що пропонує | — | `V` | — |
| `Engineering` + `Limited` | Git, Security, Dev Stack | — | `V` | — |
| `Sales` + `Limited` | CRM Training, Product Demos | `V` | `V·M` | — |
| `Support` + `Full` | Zoho Desk, Call Handling | `V` | `V·M` | `V·M` |
| `Marketing` + `Guest` | `V·D` | — | `V` | — |
| `Marketing` + `Full` | SEO, Content Tools | — | `V` | `V·M` |
| `HR` + `Guest` | Policy Management, Zoho People | — | `V` | — |

Окремі перевірки:

| перевірка | очікування за вимогою | що записати |
|---|---|---|
| `Full`, `NDA Submitted` не позначено, зберегти | не зберігається (NDA обов'язковий) | якщо зберігається — відхилення: вимога бізнесу не виконується |
| `Marketing` + `SEO`, потім `Guest` | `Training Module` вимкнене | чи лишилось `SEO`, чи зберіглось у задачі |
| `Engineering` + `Git`, потім `Sales` | список показує лише `CRM Training`, `Product Demos` | що сталося з `Git`: очищено, лишилось, блок збереження |

**14.7.** Layout `Incident Resolution Layout`, секція `Incident Details`, сім полів за умовою без
Mandatory і дефолтів, **Save Layout**. Проєкт `Layout QA – Incident` на цьому layout, галочку
приватної копії знято.

**14.8.** Усі правила на layout `Incident Resolution Layout`; умовні — з **Execute On** на
створення і оновлення.

| Rule Name | Rule Type | умова / поля | дії |
|---|---|---|---|
| `IR Rule 1 – External communication` | Conditional | `Requires External Communication?` позначено | **Show fields** і **Set mandatory fields**: Customer Contact Method, Public Response Draft |
| `IR Rule 2 – Complaint Final` | Conditional | `Escalation Stage` **Is** `Final` AND `Incident Type` **Is** `Complaint` | **Show fields** і **Set mandatory fields**: Escalated To; **Disable field**: Customer Contact Method |
| `IR Rule 3 – Escalation Stage except Feedback` | Conditional | `Incident Type` **Is Not** `Feedback` | **Show fields**: Escalation Stage |
| `IR Rule 4 – Contact method by type` | Dependent | **Primary Field** Incident Type → **Dependent Field** Customer Contact Method | Technical → Email, Chat; Billing → Email, Phone; Complaint → Phone, Chat; Feedback → Email |

`Escalated To` окремої дії в Rule 3 не потребує — його показує лише Rule 2. Якщо Rule 2 і Rule 3
довелося тримати в одному правилі на `Incident Type`, умова `Complaint` + `Final` стоїть першою і
показує ще й `Escalation Stage`. У документацію запиши:

- обраний варіант умови Rule 3 і що він робить із порожнім `Incident Type`;
- чи довелося об'єднувати правила і в якому порядку стоять умови;
- чи дав редактор вибрати `Customer Contact Method` у **Disable field** Rule 2;
- результат комбінації `Complaint` + `Final` + позначений чекбокс (конфлікт Rule 1 і Rule 2)
  дослівно, з текстом помилки, якщо є.

Очікування за дев'ятьма комбінаціями — таблиця в розв'язку 14.10.

**14.9.**
1. Проєкт отримав приватну копію — інший layout; правила на оригіналі на нього не діють. Прив'яжи
   `Risk Demo` до `Risk Assessment Layout` (**•••** → **Associate Project**) або створи правила на
   копії.
2. Одне поле не може одночасно мати два значення — умова не виконується ніколи. Потрібно OR (або
   один критерій з двома значеннями).
3. У межах правила виконується тільки перша умова, що збіглася. Для `Compliance` + `Critical`
   спрацює умова 1, і `Review Due Date` не стане обов'язковим, а `Residual Risk Level` не
   з'явиться. Розділи на два правила; якщо редактор цього не дає — постав умову `Compliance` +
   `Critical` першою і дай їй дії обох правил.
4. `Mitigation Plan` обов'язковий завжди — навіть для `Low` і `Medium`, де він схований (людина,
   найімовірніше, не збереже задачу і не побачить чому — перевір), а Rule 3 не зможе вимкнути
   обов'язкове поле. Зніми Mandatory у layout: обов'язковість задає Rule 1.
5. Залежне правило не додає значень, воно фільтрує наявні. Для відділів, крім Engineering, список
   буде порожній. Додай у поле всі одинадцять значень.
6. OR вимкне модуль для будь-якого `Guest` і для будь-якого `Marketing`. Потрібно AND.
7. Навпаки: поля показуються лише для `Feedback`, а для решти типів сховані. Потрібна умова «не
   Feedback» і лише `Escalation Stage` у Show fields (`Escalated To` керує Rule 2).
8. Правила як такі не зламані, але кожна нова задача стартує з `Full`: `NDA Submitted` одразу
   обов'язковий, а тест «Full вмикає NDA» проходить без дії людини. Дефолт у полі-тригері прибери
   або свідомо запиши як вимогу.

**14.10.** `CCM` — Customer Contact Method, `PRD` — Public Response Draft, `ES` — Escalation
Stage, `ET` — Escalated To; `Deadline for Resolution` завжди `V`.

| # | Incident Type | External? | ES (значення) | CCM | PRD | ES (поле) | ET |
|---|---|---|---|---|---|---|---|
| 1 | порожньо | ні | — | — | — | `V` за вимогою | — |
| 2 | Technical | ні | Level 1 | — | — | `V` | — |
| 3 | Technical | так | Level 1 | `V·M`: Email, Chat | `V·M` | `V` | — |
| 4 | Billing | так | Level 2 | `V·M`: Email, Phone | `V·M` | `V` | — |
| 5 | Complaint | ні | Final | — | — | `V` | `V·M` |
| 6 | Complaint | так | Final | конфлікт `M` / `D`; Phone, Chat | `V·M` | `V` | `V·M` |
| 7 | Complaint | так | Level 2 | `V·M`: Phone, Chat | `V·M` | `V` | — |
| 8 | Feedback | так | — | `V·M`: Email | `V·M` | — | — |
| 9 | Feedback | ні | — | — | — | — | — |

Місця, де вимоги суперечать або мовчать:

| місце | що не так |
|---|---|
| рядок 6: Complaint + Final + External | Rule 1 робить `Customer Contact Method` обов'язковим, Rule 2 вимикає; обов'язкове вимкнути не можна |
| рядок 5: Complaint + Final без External | вимкнення з Rule 2 непомітне: поле сховане |
| Rule 3 «Hide» | дії приховування нема; реалізація через Show — відхилення від формулювання |
| рядок 1: порожній Incident Type | вимога не каже, чи видно `Escalation Stage`; результат залежить від варіанта умови |
| зміна Incident Type після вибору контакту | вимога не каже, що робити з недозволеним значенням |
| чекбокс знято після заповнення `Public Response Draft` | вимога не каже, чи зберігається текст схованого поля |

**14.11.** Передбачення — будь-яке, але з аргументом: правило належить layout, а копія — інший
layout. Можливі результати:

- форма не змінюється, правил для копії нема — правила не копіюються; для проєкту з копією їх
  треба створювати заново;
- форма змінюється і в списку є правила для копії — правила копіюються разом із layout; тоді
  кожна копія живе окремо, і зміни в правилах оригіналу до неї не дійдуть.

Обидва — факт для звіту і причина знімати галочку приватної копії для тестових проєктів.
Прибирання: переведи `Layout QA – Risk Copy` на `Risk Assessment Layout` (**•••** → **Associate
Project**); якщо в копії є свої правила, спершу видали їх (layout із правилами не видаляється);
потім видали копію, що лишилась без проєкту. Сам проєкт можна перемістити в кошик, але він і там
лишиться прив'язаним до `Risk Assessment Layout`: перш ніж колись видаляти цей layout, переведи
проєкт на інший.

**14.12.**

| | layout rule | workflow rule | Blueprint |
|---|---|---|---|
| що гарантує | форма не збережеться без плану, коли ризик High/Critical | нічого не блокує; може відреагувати після збереження (лист рецензенту, коли ризик High, а план порожній) | перехід не виконається без плану, якщо поле вимагається під час переходу |
| коли діє | під час заповнення форми (створення, оновлення) | після збереження, на подію або в час | при зміні статусу |
| шляхи створення | форма **Add Task**; інші — треба перевірити | будь-яке збереження, що підпадає під тригер | лише переходи Blueprint |

Порада: layout rule як профілактика на введенні плюс workflow rule як страховка для задач, що
з'явились іншими шляхами (імпорт, автоматизація), — лист, якщо High/Critical без плану. Blueprint
— коли план має вимагатися на конкретному етапі процесу, а не при створенні. Врахуй і стик: дії
Set mandatory fields layout rule під час переходів Blueprint не застосовуються, тож на переході
обов'язковість задає лише сам Blueprint.

---

## Ворота уроку

- [ ] пояснюєш, яку проблему розв'язують layout rules і чим вони відрізняються від workflow rules
  і Blueprint;
- [ ] розрізняєш conditional і dependent правила і наводиш приклад кожного;
- [ ] називаєш дії умовного правила і їхні обмеження: обов'язкове не вимкнути, дефолтної секції
  нема в Show sections, з Is Updated — лише Set mandatory fields;
- [ ] пояснюєш правило «перша умова, що збіглася», коли через нього губляться дії і як
  упорядкувати умови, якщо вимоги доводиться тримати в одному правилі;
- [ ] знаєш ліміти: 35 умов на правило, 200 на layout;
- [ ] реалізуєш «сховати» через інвертований Show і пишеш, чим це відрізняється від вимоги;
- [ ] готуєш layout, поля і тестовий проєкт у правильному порядку і знімаєш галочку приватної
  копії;
- [ ] будуєш таблицю станів форми для будь-якого набору правил;
- [ ] знаходиш у вимогах конфлікти і «невидимі» правила до того, як почнеш тестувати;
- [ ] перевіряєш правила і на створенні, і на оновленні, і при зміні значень до збереження;
- [ ] три layouts із полями і правилами з документа налаштовані в тріалі, скриншоти конфігурації і
  швидких перевірок зібрані;
- [ ] задачі 14.2, 14.9, 14.10 і 14.12 розв'язані без підглядання в розв'язки.
