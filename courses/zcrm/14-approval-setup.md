# Урок 14. Approval process: правила, етапи, дії

*Після уроку ти налаштовуєш approval process на новому екрані Zoho — правила, критерії, етапи,
загальний порядок погодження, фінальні дії, редагування записів, що чекають, і rule admins — і
наперед кажеш, який запис буде заблоковано, хто його погоджує і що станеться після рішення. Для QA
це особлива автоматизація: вона зупиняє людей. Помилка тут або блокує бізнес, або пропускає без
контролю саме те, що мали контролювати.*

---

## 14.1. Що таке approval process

Approval process — правило, яке автоматично **блокує запис** і відправляє його на рішення
погоджувачам, коли запис відповідає заданим умовам. Замість «напиши керівнику в чат, щоб глянув»
система сама ловить запис, блокує його й ставить у чергу потрібним людям.

Потік простий:

```
запис збережено → відповідає умові → заблокований, чекає рішення
   → погоджувач: Approve / Reject (або Delegate — передати іншому)
   → дії після погодження або після відхилення → запис розблоковано
```

Поки запис чекає, його не можна конвертувати, видалити чи вільно редагувати — у цьому весь сенс.
У тріалі (26.09.2026) банер запису показує не слово «Waiting for Approval», а лічильник: **«Waiting
for your response: 0/N»** (N — кількість етапів) поруч зі значком замка; кнопки конвертації й
видалення вимкнені, а погоджувач отримує лист і може відповісти прямо з картки
(**Respond**: approve, delegate, reject).

**Де погоджувачі бачать свою чергу.** **Workqueue** (вкладка поруч із Home) → розділ **My Jobs**:
там погодження (Approvals), переходи Blueprint і review process. Окремого модуля чи вкладки Approvals
у головній навігації тріалу нема. За підказкою в самому Workqueue, розділ **My Jobs** з'являється,
коли є що погоджувати; пошук CRM знаходить і «Approvals waiting for you».

**Хто стоїть над погоджувачами.** Адміністратор або призначений **rule admin** може будь-коли
втрутитися й забрати запис, що чекає, на себе (Takeover).

**Де налаштовують.** **Setup → Process Management → Approval Processes**. Потрібен дозвіл **Manage
Automation**; для team modules процеси можуть створювати їхні адміністратори.

## 14.2. Коли потрібне погодження

Коротка відповідь документа: коли запис, що дійшов до певного стану, несе достатньо ризику,
грошей чи вимог відповідності, щоб на нього подивилась друга пара очей.

Типові випадки:
- **Великі угоди й знижки.** Угода на велику суму чи незвична знижка — керівник підтверджує до того,
  як умови пообіцяють клієнту.
- **Ворота кваліфікації лідів.** Ліди з холодних дзвінків спершу перевіряють, а потім пускають у
  конвертацію й роботу.
- **Цілісність даних і відповідність.** Зміна чутливого поля (адреса рахунку, сума контракту,
  категорія клієнта) заморожується, поки уповноважена людина не підтвердить.
- Загалом — будь-яка політика «цей тип запису має погодити не той, хто його створив чи змінив».
  Замість навчання й надії правило живе в самій CRM.

**Не плутай із сусідами:**

| механізм | що робить | головна відмінність від погодження |
|---|---|---|
| Workflow rule | реагує на подію дією | нічого не блокує й рішення людини не чекає |
| Blueprint | веде процес над одним полем: переходи, власники переходів, обов'язкові дані | керує рухом по станах; запис одночасно веде лише один Blueprint (у тріалі перевіряли) |
| Review process | перевіряє записи на вході в CRM, поле за полем, до того як їх побачать процеси | працює з окремими полями й per layout; має SLA і звіти; делегувати не можна |
| Approval process | блокує весь запис до рішення | рішення «все або нічого» на весь запис; можна делегувати; до 10 етапів у правилі |

Порядок автоматизацій на записі (довідка): Assignment rule → Review process → Scoring rules →
Workflow rule → Connected workflows → Approval process → Blueprint. Тобто workflow rules встигають
відпрацювати й змінити поля *до* того, як погодження перевірить критерій.

## 14.3. Як Zoho будує процес

Zoho перебудувала екран налаштування погоджень. Нові організації (зокрема тріали) отримують новий
екран одразу; решту переведуть до 15 лютого 2027 року. Поведінка погоджень не змінилась — змінився
лише спосіб налаштування. Повернутися до старого екрана після переходу не можна.

Структура на новому екрані:

```
Approval process: назва, модуль, Send for Approval on
└── Rule 1 … Rule n          (запис бере перше правило, під яке підійшов)
    ├── Approval Criteria    (обов'язкова; без неї етапи не додаються)
    ├── Approval Stages      (до 10)
    │   └── Stage: погоджувачі, Assign Task for Approvers,
    │       Action on Approval: Update fields, Record Modification Settings
    ├── Overall approval flow   (з'являється від 2 етапів)
    ├── Final Actions: Action on Final Approval / Action on Rejection
    └── Assign Admins → Rule Admin Settings (rule admins)
```

**Порядок має значення двічі.** Процеси одного модуля перевіряються в порядку списку (за
замовчуванням — у порядку створення): запис іде в перший процес, під критерії якого підійшов. Так
само з правилами всередині процесу. За довідкою, порядок процесів змінюють у списку, вибравши модуль
(**Reorder Processes**), а порядок правил — **Reorder Rules** (є, коли правил кілька). Тому перед
новим процесом подивись, які вже є для цього модуля.

## 14.4. Екран налаштування, блок за блоком

### Вікно Create Approval Process

**Setup → Process Management → Approval Processes** → **Create Approval Process**. Вікно має поля
(перевірено в тріалі):

| поле | що це |
|---|---|
| **Approval Process Name** | назва процесу |
| **Description** | опис |
| **Module** | модуль; угоди — це **Deals** (Potentials — стара назва в API) |
| **Send for Approval on** | `Create Record` / `Edit Record` / `Create or Edit Record` |

**Next** відкриває редактор. Ліворуч — **Execute On** і **Execute By** зі списком правил (`Rule 1`
уже створене) та **Add Rule**. Праворуч — назва правила, **Approval Criteria**, **Approval Stages** і
**Final Actions**. Угорі праворуч — **Assign Admins**. Кнопки — **Cancel**, **Save and Close**,
**Save**.

### Approval Criteria

Критерій правила: які записи йдуть на погодження. Для числових і валютних полів оператори показані
символами: `=`, `!=`, `<`, `<=`, `>`, `>=`, `between`, `not between`, `is empty`, `is not empty`, а
біля значення — валюта організації (у тріалі це `UAH`). Для picklist і текстових полів у тріалі
(26.09.2026) оператори показані саме словами — `is`, `isn't`, `contains`, `doesn't contain`,
`starts with`, `ends with`, `is empty`, `is not empty` — так само, як у workflow rules. Кілька рядків
критерію об'єднуються шаблоном, як у workflow rules.

Критерій перевіряє **стан запису після збереження**, а не те, що саме змінилось. Для процесів на
редагування це важливо — детальніше в розділі про тестування.

### Approval Stages

**Add Approval Stage** → **Choose Approver Type**:

| тип | хто погоджує |
|---|---|
| **User** | конкретний користувач (або кілька) |
| **Role** | користувачі з роллю; обираєш Anyone (будь-хто з них) або Everyone (усі) |
| **Group** | учасники групи; так само Anyone або Everyone |
| **Levels** | керівники вище власника запису в ієрархії, на задану кількість рівнів |
| **Record Owner's Manager(Role)** | керівник власника запису за ієрархією ролей (у тріалі саме без пробілу перед дужкою) |
| **Record Owner** | сам власник запису |
| **User Lookup Field** | користувач із поля-lookup запису (за довідкою — у ранньому доступі) |

Картка етапу (перевірено в тріалі): назва етапу, погоджувач, **Assign Task for Approvers** (задача
погоджувачу, коли запис надходить), **Action on Approval: Update fields** (оновлення поля саме на
погодженні цього етапу) і **Record Modification Settings**:
- [ ] **Allow approvers to edit pending approval records** — **All Fields** або **Selected Fields**
  (до 25 полів): що погоджувач може виправити, перш ніж вирішити;
- [x] **Allow users to edit rejected records** — **All Fields**: що користувачі (зокрема власник)
  можуть виправити у відхиленому записі, щоб подати його знову.

Це й типові значення: погоджувачі не редагують запис, що чекає, а відхилений запис користувачі
(зокрема власник) можуть редагувати повністю.

Кілька правил із довідки, що впливають на тести:
- якщо в обраній ролі нема жодного користувача, запис на цьому рівні погоджується автоматично;
- якщо погоджувач — власник запису, а його акаунт неактивний чи видалений, запис погоджується
  автоматично;
- погоджувачі отримують системний лист, коли запис надходить на погодження.

### Overall approval flow

Коли етапів два й більше, під ними з'являється **Overall approval flow**:

У тріалі (26.09.2026) вибір носить точну назву **"Approve a Record when"**, і в кожному варіанті
продукт додає уточнення в дужках:

| вибір | коли правило завершується погодженням |
|---|---|
| **At least one stage is approved (Anyone)** | досить погодження будь-якого одного етапу |
| **All stages are approved (Everyone)** → **Parallel** | "Records are sent to all approval stages simultaneously, allowing them to take action in parallel." — етапи отримують запис одночасно, порядок не важливий |
| **All stages are approved (Everyone)** → **Sequential** | "Records are sent for approval stages in a defined order. Each approver can take action only after the previous one, starting from the first stage." — етап 2 отримує запис лише після погодження етапу 1 |

За довідкою, коли обираєш загальний порядок, іноді з'являється вікно про Record Modification
Settings: перенести налаштування етапу на рівень усього правила (**Move to Overall Record
Modification Settings Level**) чи скинути (**Discard**). У тріалі (26.09.2026), на правилі з
типовими налаштуваннями обох етапів, це вікно **не з'явилось** — перехід на Sequential відбувся без
запиту. Натомість під етапами з'явився блок **«By default a rejection should: Reject only the
current stage»** (випадаючий список) і прапорець **«Notify all previous approvers»** (обидва — за
замовчуванням, не чіпали); довідка також описує варіанти відхилити всі попередні етапи або дати
погоджувачу обрати етап — у тріалі перевірявся лише типовий варіант.

### Final Actions

| блок | дії (перевірено в тріалі) | коли виконуються |
|---|---|---|
| **Action on Final Approval** | Assign Task, Update fields, Email Notifications, Webhooks, Functions | після остаточного погодження правила |
| **Action on Rejection** | Update fields, Email Notifications, Webhooks, Functions | після відхилення |

Різниця з **Action on Approval** в етапі: та виконується, коли погоджено *цей етап*; фінальні
дії — коли погоджено *все правило*. Для правила з одним етапом різниці на око не буде, для
Sequential із двох етапів — буде.

Як налаштовуються дії (довідка):
- **Update fields** → створити оновлення поля: назва, модуль, поле, значення (або **Set as Empty**)
  → **Save and Associate**; можна обрати вже створене й натиснути **Associate**.
- **Email Notifications** → **New Alert**: назва, отримувачі (люди з запису — наприклад, власник;
  учасники погодження; користувачі, ролі, групи), шаблон листа, адреси From і Reply To → зберегти й
  прив'язати. Шаблон має існувати заздалегідь або бути створений по ходу; шаблони живуть у **Setup →
  Customization → Templates → Email Templates**.
- На погодження чи відхилення — по одному webhook і одній функції; на відхилення — до трьох листів.

### Assign Admins і Takeover

**Assign Admins** (угорі праворуч) → **Rule Admin Settings** (перевірено в тріалі):
- **Rule Admins** — хто може діяти замість погоджувачів у цьому правилі (лише користувачі, до 15);
- **Allow rule admins to edit pending approval records** — чи можуть rule admins редагувати запис,
  що чекає (за довідкою — усі поля або ті, що задані в Record Modification Settings);
- **Notify actual approvers when rule admins respond** — як повідомити справжніх погоджувачів, що за
  них відповів rule admin (за довідкою — листом чи в застосунку);
- підказка на екрані: якщо rule admins не призначено, відповідати може будь-який адміністратор.

**Takeover** — забрати запис, що чекає, на себе й вирішити замість погоджувача. Кнопка — у картці
запису. Без rule admins це може будь-який користувач із профілем Administrator; щойно rule admins
призначено — лише вони.

### Що ще варто знати про життя запису

- На погодження йдуть записи, створені чи змінені *після* створення процесу. Старі записи, що
  відповідають критерію, не заблокуються, поки їх не змінять.
- Погоджений запис може потрапити на погодження знову: якщо процес на `Edit Record` чи `Create or
  Edit Record`, а після редагування запис відповідає критерію, він знову блокується й чекає.
- Зміни в правилі не зачіпають записи, які вже чекали на момент зміни (зокрема зміни дій).
- Нові rule admins, додані пізніше, бачать і можуть забрати записи, що вже чекають.
- Вимкнули процес — записи, що вже чекають, лишаються на погодженні; видалили процес — вони
  розблоковуються, а дії погодження й відхилення не виконуються.
- Відхилений запис можна подати знову (**Resubmit**) протягом 180 днів. Поданий знову запис спершу
  перевіряється на критерії процесу, з якого його відхилили, потім — на всі інші правила; не
  підійшов нікуди — розблоковується.

## 14.5. Покроково: A17, розділи 1–3 — контекст і підготовка

**Про завдання.** Ти самостійно налаштовуєш у тріалі три сценарії погодження, потім проганяєш
наскрізні тестові потоки й готуєш QA-документи. Цей урок — налаштування (розділи 1–4 завдання);
виконання потоків і здача — окремий етап.

**Бізнес-контекст — TechNova Solutions**, B2B-софт середнього розміру:

| сценарій | правило бізнесу | модуль |
|---|---|---|
| A — High-Value Deal Approval | угода з Amount понад $10,000 має бути погоджена, перш ніж продажі закриватимуть угоду; захист від неперевірених знижок і умов | Deals |
| B — New Lead Source Validation | лід із Lead Source `Cold Call` проходить погодження, перш ніж його можна конвертувати в Contact чи Deal | Leads |
| C — Contact Modification Lock | коли в наявному контакті Mailing Address - Country / Region змінюють на будь-що, крім `United States`, зміна потребує погодження (комплаєнс-перевірка даних клієнта з-за кордону) | Contacts |

Усі три сценарії вкладаються в обмеження тріалу: лише модулі Leads, Contacts і Deals.

**3.1. Акаунт і користувачі.**
1. Ти працюєш під акаунтом із профілем Administrator.
2. Потрібні ще двоє користувачів CRM: **User B** — основний погоджувач, **User C** — власник записів,
   який відправляє їх на погодження. Тріал CRM стартує з одним користувачем; у Zoho One їх додають
   у **Admin Panel → User Management → Users → Add User** (кнопка **+ New User** у CRM лише відкриває
   цю сторінку).
3. Переконайся, що обом призначено CRM, а в **Setup → General → Users** задані роль і профіль
   (для цього завдання підійде профіль Standard).
4. Обидва акаунти мають бути активні й підтверджені: людина прийняла запрошення й може увійти.

Поки User B і User C не додані, у виборі погоджувача буде тільки твій акаунт — налаштувати сценарії
не вийде.

**3.2. Модулі й поля.**
- Leads, Contacts і Deals видно в навігації й вони відкриваються.
- У Deals є поле **Amount**.
- У Leads picklist **Lead Source** містить `Cold Call` (у тріалі є).
- У Contacts є поле **Mailing Address - Country / Region** (у тріалі є).

**3.3. Доступ до погоджень.** **Setup** (шестерня вгорі праворуч) **→ Process Management → Approval
Processes** відкривається. Якщо розділу нема — зупинись і напиши ментору.

**Ще дві речі перед стартом:**
- подивись список процесів: якщо для Deals, Leads чи Contacts уже є процеси з твоїх експериментів,
  вони можуть перехопити записи раніше за нові;
- для сценарію A створи шаблон листа для Deals про відхилення угоди (**Setup → Customization →
  Templates → Email Templates**) — знадобиться для сповіщення власнику.

## 14.6. Покроково: сценарій A — High-Value Deal Review

Мета: процес у Deals, що спрацьовує, коли угоду з Amount понад 10000 створюють або редагують.

Що легко відкотити: процес можна вимкнути чи видалити. Але видалення розблоковує записи, що чекали,
без дій погодження чи відхилення, а зміни в правилі не зачіпають записи, що вже чекають. Тож правити
налаштування краще, поки в процесі ніхто не чекає, а після правок тестувати на нових записах.

1. **Setup → Process Management → Approval Processes** → **Create Approval Process**.
   **Що побачиш:** вікно з полями **Approval Process Name**, **Description**, **Module**, **Send
   for Approval on**.
2. Заповни:

   | поле | значення |
   |---|---|
   | **Approval Process Name** | `High-Value Deal Review` |
   | **Description** | `Requires approval for any deal with an amount exceeding $10,000.` |
   | **Module** | `Deals` |
   | **Send for Approval on** | `Create or Edit Record` |

   **Next**.
   **Що побачиш:** редактор із `Rule 1` ліворуч (**Execute By**) і блоками **Approval Criteria**,
   **Approval Stages**, **Final Actions**. **Add Rule** не натискай — одного правила досить.
3. **Approval Criteria**: **Amount** `>` `10000`. Знак `$` у документі — бізнес-формулювання:
   значення вводиш у валюті організації (у тріалі біля поля видно `UAH`).
   *[SCREENSHOT REQUIRED: Approval Criteria configuration]*
4. **Approval Stages** → **Add Approval Stage** → **Choose Approver Type**: **User** → User B.
   **Що побачиш:** картку етапу з погоджувачем, **Assign Task for Approvers**, **Action on Approval:
   Update fields** і **Record Modification Settings**. Назву етапу можна дати осмислену, наприклад
   `User B review`.
5. **Final Actions → Action on Final Approval → Update fields**: створи оновлення поля
   (назва, наприклад, `Deal Stage to Needs Analysis`), поле **Stage**, значення `Needs Analysis`.
6. **Final Actions → Action on Rejection → Email Notifications** → **New Alert**: назва, наприклад,
   `Deal rejected - owner`; отримувач — власник запису (Record Owner); шаблон — підготовлений лист
   про відхилення угоди. Збережи й прив'яжи.
   *[SCREENSHOT REQUIRED: Email notification configuration]*
7. **Record Modification Settings** етапу: **Allow approvers to edit pending approval records**
   залиш **знятим** — запис, що чекає, лишається заблокованим. **Allow users to edit rejected
   records** залиш як є (стоїть, All Fields): так власник зможе виправити відхилену угоду й подати
   знову.
8. **Assign Admins** не чіпай — rule admins у цьому сценарії не потрібні.
9. **Save**. Відкрий список **Approval Processes** і переконайся, що `High-Value Deal Review` там і
   має статус Active.
   *[SCREENSHOT REQUIRED: Active approval process in list view]*

## 14.7. Покроково: сценарій B — Cold Call Lead Validation

Мета: процес у Leads, що вимагає погодження, коли лід створюють із джерелом `Cold Call`. Потік
двоетапний і послідовний: спершу User B, потім адміністратор.

1. **Create Approval Process**:

   | поле | значення |
   |---|---|
   | **Approval Process Name** | `Cold Call Lead Validation` |
   | **Description** | `Routes Cold Call leads through an approval stage before pipeline entry.` |
   | **Module** | `Leads` |
   | **Send for Approval on** | `Create Record` |

   **Next**.
2. У `Rule 1` → **Approval Criteria**: **Lead Source** `is` `Cold Call`.
   *[SCREENSHOT REQUIRED: Criteria setup for Leads module]*
3. **Add Approval Stage** → **User** → User B. Це етап 1 (назва, наприклад, `Stage 1 - User B`).
4. Ще раз **Add Approval Stage** → **User** → твій акаунт адміністратора. Це етап 2 (`Stage 2 -
   Administrator`). Zoho не дозволяє призначити **того самого** користувача погоджувачем двох різних
   етапів одного правила: якщо User B і адміністратор — один і той самий обліковий запис, продукт
   покаже помилку «The selected approver is already assigned to Stage 1. Please choose a different
   approver.» (перевірено в тріалі 26.09.2026) — для другого етапу знадобиться справді інший
   користувач; типом **Record Owner** замість **User** можна обійти цю перевірку технічно (він
   резолвиться в того самого власника запису), але це не доводить погодження різними людьми.
   **Очікування (довідка):** під етапами з'являється **Overall approval flow**.
5. **Overall approval flow**: **All stages are approved**, потім **Sequential**. Так User B погоджує
   першим, і лише після нього запис отримує адміністратор. Якщо вискочить вікно про Record
   Modification Settings — у сценарії B налаштування лишаються типовими, тож обирай варіант, що
   скидає до типових (**Discard**), і запиши, що саме пропонувало вікно.
   *[SCREENSHOT REQUIRED: the two approval stages and the Overall approval flow (All stages are
   approved, Sequential)]*
6. **Final Actions → Action on Final Approval → Update fields**: **Lead Status** = `Contacted`.
7. **Final Actions → Action on Rejection → Update fields**: **Lead Status** = `Not Contacted`.
8. **Record Modification Settings** етапів і **Assign Admins** — за замовчуванням.
9. **Save** і переконайся в списку, що процес активний.
   *[SCREENSHOT REQUIRED]*

Чому саме фінальні дії: **Lead Status** має змінитися, коли погоджено *все* правило. Якби
`Contacted` стояв в **Action on Approval** етапу 1, статус змінився б ще до рішення адміністратора.

## 14.8. Покроково: сценарій C — Cross-Border Contact Edit Review

Мета: процес у Contacts, що блокує запис на погодження, коли Mailing Address - Country / Region змінюють на будь-що,
крім `United States`. Сценарій показує Record Modification Settings і Takeover від rule admin.

1. **Create Approval Process**:

   | поле | значення |
   |---|---|
   | **Approval Process Name** | `Cross-Border Contact Edit Review` |
   | **Description** | `Triggers a compliance approval when a Contact's Mailing Address - Country / Region is set to a non-US value.` |
   | **Module** | `Contacts` |
   | **Send for Approval on** | `Edit Record` |

   **Next**.
2. У `Rule 1` → **Approval Criteria**: **Mailing Address - Country / Region** `isn't` `United States`.
   *[SCREENSHOT REQUIRED: Criteria setup]*
3. **Add Approval Stage** → **User** → User B.
4. **Record Modification Settings** етапу: постав **Allow approvers to edit pending approval
   records**, обери **Selected Fields** і тільки поле **Mailing Address - Country / Region**. Так погоджувач зможе
   виправити країну, перш ніж погодити чи відхилити, але решта полів для нього закрита.
   *[SCREENSHOT REQUIRED: Record Modification Settings — Selected Fields]*
5. **Assign Admins** (угорі праворуч) → **Rule Admin Settings**: у **Rule Admins** додай свій акаунт
   адміністратора; постав **Allow rule admins to edit pending approval records** і обери **All
   Fields**. **Notify actual approvers when rule admins respond** документ не задає — залиш типове
   значення й запиши, яке воно.
   *[SCREENSHOT REQUIRED: Rule Admin Settings]*
6. **Save** і переконайся в списку, що процес активний.

Після цього в правилі сценарію C Takeover може зробити тільки rule admin — тобто ти. У сценаріях A і
B rule admins нема, тож там відповісти за погоджувача може будь-який адміністратор.

## 14.9. Як це тестувати

**Що вимагають розділи 1–4.** Три процеси створено й активовано, кожен крок із позначкою
[SCREENSHOT REQUIRED] знято. Скриншоти згодом підуть у папку доказів `Evidence_Screenshots`.

Але QA не чекає виконання, щоб думати про ризики: читай конфігурацію як специфікацію й шукай місця,
де вона робить не те, що каже бізнес.

**1. Межа й валюта (A).** `>` строгий: угода рівно на `10000` на погодження не піде, `10001` — піде.
Бізнес каже «greater than $10,000» — межа збігається, але перевір її тестом. Валюта — організації
(`UAH` у тріалі), а не долари з тексту.

**2. Критерій бачить стан, а не зміну (A і C).** Процес на редагування перевіряє, чи запис *після
збереження* відповідає критерію. Контакт, у якого країна вже `Germany`, відповідає критерію
`Mailing Address - Country / Region isn't United States` при будь-якому редагуванні — навіть коли змінили лише телефон.
Бізнес-правило C каже «коли країну *змінюють*». Так само погоджена угода на `15000` з `Create or Edit
Record` відповідає критерію при кожному наступному редагуванні. Довідка прямо каже, що погоджений
запис через редагування може знову потрапити на погодження, якщо процес на `Edit Record` чи `Create
or Edit Record`. Отже, конфігурація ширша за правило бізнесу: кожна дрібна правка знову блокує
запис. Підтверди тестом і запиши як спостереження для звіту.

**3. Діра «тільки створення» (B).** `Send for Approval on: Create Record`: лід, створений як `Web
Download` і потім змінений на `Cold Call`, погодження не проходить — а бізнес-правило каже, що
*будь-який* лід із `Cold Call` має пройти його до конвертації. Тест: створи лід з іншим джерелом,
зміни на `Cold Call`, спробуй конвертувати.

**4. Порожнє значення (C).** У тріалі (26.09.2026) значення для **Mailing Address - Country / Region**
обирають зі списку країн (пошуковий picker, а не вільний текст) — увести `USA`, `US` чи `united
states` вручну через інтерфейс не вийде, тож типова помилка з варіантами написання країни в UI не
трапляється. Лишається дослідницький випадок: контакт із **порожнім** значенням поля — чи піде він
на погодження за критерієм «isn't United States»; результат — у звіт. Якщо запис приходить в обхід
UI (API, імпорт) із нестандартним значенням країни, це окремий, ширший ризик — не гарантований цим
picker'ом.

**5. Видимість змін.** Для B створюй тестові ліди з **Lead Status**, що не збігається з очікуваним
(наприклад, `Attempted to Contact`), інакше `Not Contacted` після відхилення нічого не доведе. Для A —
угоди з **Stage**, відмінним від `Needs Analysis`.

**6. Порядок і сусіди.** Workflow rules відпрацьовують перед погодженням і можуть змінити поля так,
що запис підпаде під критерій (або вийде з-під нього). Якщо на Deals є Blueprint на **Stage**,
фінальне оновлення `Stage = Needs Analysis` — ризик того самого типу, що й workflow-оновлення:
пряме записування поля, яким керує процес. Перевір окремо.

**7. Хто що може.** User B у сценарії C редагує тільки Mailing Address - Country / Region, rule admin — усе. У сценарії
C Takeover робить лише rule admin; у A і B — будь-який адміністратор. Кожне «може» варто перевірити
разом із «не може».

**8. Послідовність (B).** У власній черзі адміністратора як погоджувача лід не має з'явитися, поки
User B не погодив. Не сплутай із загальним переглядом: за довідкою, адміністратор бачить і чужі
записи, що чекають, — це окремий перемикач виду в My Jobs (у довідці — «View records that are
awaiting approval by other users»). Лід, що чекає, не можна конвертувати.

**9. Гігієна даних.** Зміни в правилі не зачіпають записи, що вже чекають. Змінив конфігурацію —
тестуй на нових записах.

**Зразок тест-кейса у форматі документа** (TC ID | Test Flow | Steps Summary | Expected Result |
Actual Result | Status):

| TC ID | Test Flow | Steps Summary | Expected Result | Actual Result | Status (PASS / FAIL / BLOCKED) |
|---|---|---|---|---|---|
| TC-A-01 | A-1: Approve a Deal with Amount > 10000 | User C створює угоду з Amount `15000`; User B у **Workqueue → My Jobs → Approvals** погоджує з коментарем `Approved for review stage.` | після збереження угода заблокована й чекає погодження; після погодження **Stage** = `Needs Analysis`, запис розблоковано | … | … |
| TC-A-X1 | Boundary: Amount = 10000 | User C створює угоду з Amount `10000` | погодження не запускається, угода зберігається звичайно | … | … |

---

## 14.10. Типові помилки

**1. Шукають Add Approval Process.** Кнопка називається **Create Approval Process**.

**2. Шукають модуль Potentials.** У списку модулів — **Deals**.

**3. Налаштовують до появи User B і User C.** У виборі погоджувача тільки твій акаунт.

**4. Етап без критерію.** Approval Criteria обов'язкова — без неї етапи не додаються.

**5. At least one замість All stages.** У сценарії B лід погоджується вже після User B, адміністратор
не потрібен.

**6. Parallel замість Sequential.** Адміністратор отримує лід одночасно з User B.

**7. Оновлення Lead Status в етапі замість фінальних дій.** Статус змінюється після етапу 1, до
рішення адміністратора.

**8. All Fields замість Selected Fields.** Погоджувач у сценарії C може змінити будь-яке поле.

**9. Лист без шаблону.** Сповіщення про відхилення не зібрати, поки нема шаблону листа.

**10. Правлять правило й перевіряють на старому записі.** Записи, що вже чекають, живуть за старою
версією.

### Симптом → причина

| симптом | найімовірніша причина |
|---|---|
| не знаходиш **Add Approval Process** | кнопка — **Create Approval Process** |
| у списку модулів нема Potentials | модуль показується як Deals |
| у виборі погоджувача лише ти | User B і User C не додані в Zoho One або їм не призначено CRM |
| не виходить додати етап | не задано Approval Criteria |
| нема блоку **Overall approval flow** | у правилі один етап |
| адміністратор бачить лід одночасно з User B | **Parallel** замість **Sequential** |
| лід погоджено одразу після User B | **At least one stage is approved** замість **All stages are approved** |
| Lead Status змінився до рішення адміністратора | оновлення стоїть в **Action on Approval** етапу 1, а не у фінальних діях |
| угода на `10000` не пішла на погодження | оператор `>` строгий — так і має бути |
| угода на `15000` не пішла на погодження | процес неактивний; інший процес Deals вище в списку забрав запис; не той **Send for Approval on** |
| лід, змінений на `Cold Call`, не пішов на погодження | **Send for Approval on**: `Create Record` — редагування не перевіряється |
| контакт із `Germany` іде на погодження при зміні телефону | критерій перевіряє стан запису, а не зміну поля |
| User B не може змінити Mailing Address - Country / Region в записі, що чекає | не поставлено **Allow approvers to edit pending approval records** або в **Selected Fields** нема Mailing Address - Country / Region |
| User B може змінити будь-яке поле | **All Fields** замість **Selected Fields** |
| інший адміністратор не бачить **Takeover** у сценарії C | призначено rule admins — забрати запис можуть лише вони |
| правка правила не змінила поведінку для запису, що вже чекає | зміни не діють на записи, які вже чекали |
| видалив процес — записи розблокувались без дій | так працює видалення процесу |

---

## 14.11. Що варто запам'ятати

1. Approval process блокує весь запис до рішення людини; поки запис чекає — ні конвертації, ні
   видалення, ні вільного редагування.
2. Процес → правила → етапи. Запис бере перший процес і перше правило, під які підійшов.
3. Approval Criteria обов'язкова, перевіряє стан запису після збереження, а числові оператори —
   символи.
4. Погоджувачі: User, Role, Group, Levels, Record Owner's Manager (Role), Record Owner, User Lookup
   Field; для ролей і груп — Anyone або Everyone.
5. Від двох етапів — Overall approval flow: At least one stage is approved або All stages are
   approved → Parallel / Sequential.
6. Action on Approval етапу — на погодженні етапу; Final Actions — після остаточного погодження або
   відхилення.
7. Типово погоджувачі не редагують запис, що чекає, а відхилений користувачі (зокрема власник)
   можуть редагувати повністю.
8. Rule admins: з ними Takeover — лише їхній; без них відповідати може будь-який адміністратор.
9. Погоджувачі працюють у **Workqueue → My Jobs → Approvals** або кнопкою **Respond** у картці.
10. Новий екран налаштування — для нових організацій одразу, для всіх до 15.02.2027; поведінка
    погоджень та сама.

---

# Задачі

*Для практичних задач потрібен тріал із правами адміністратора і двома додатковими користувачами
CRM: User B (погоджувач) і User C (власник записів).*

**14.1.** Обери механізм — workflow rule, Blueprint, review process чи approval process — і поясни
вибір:
а) «Ліди з вебформ перевіряти поле за полем, перш ніж вони взагалі потраплять у CRM»;
б) «Угоду з сумою понад ліміт має погодити керівник, до того її не можна змінювати»;
в) «Коли угода закрита, створити задачу на рахунок»;
г) «Угода рухається лише по етапах `Qualification → Proposal → Closed Won`, без перескоків».

**14.2.** Процес у Deals: **Send for Approval on** `Create or Edit Record`, критерій **Amount** `>`
`10000`, один етап (User B). Передбач, чи піде угода на погодження, і поясни:
а) нова угода, Amount `10000`;
б) нова угода, Amount `10001`;
в) нова угода без Amount;
г) нова угода на `5000`, потім Amount змінено на `20000`;
д) угода на `15000`, уже погоджена, в ній змінили опис.

**14.3.** Правило з двома етапами: етап 1 — User B, етап 2 — Administrator. Для кожного варіанту
**Overall approval flow** опиши, хто й коли отримає запис і після чого правило вважається
погодженим: а) **At least one stage is approved**; б) **All stages are approved** + **Parallel**;
в) **All stages are approved** + **Sequential**.

**14.4.** Знайди помилки. Колега налаштував «Cold Call Lead Validation» так: **Send for Approval on**
`Create or Edit Record`; етап 1 — User B з **Action on Approval: Update fields** → **Lead Status** =
`Contacted`; етап 2 — Administrator; **Overall approval flow** — **At least one stage is approved**;
**Action on Rejection** порожній. Порівняй із вимогами (створення ліда з `Cold Call`, User B, потім
адміністратор по черзі, після остаточного погодження `Contacted`, після відхилення `Not Contacted`).

**14.5.** *(A17, розділ 3)* Підготуй середовище:
- ти працюєш під профілем Administrator;
- User B (основний погоджувач) і User C (власник, що відправляє записи) додані в **Admin Panel →
  User Management → Users → Add User**, їм призначено CRM, у **Setup → General → Users** задані роль
  і профіль, обидва активні й підтверджені;
- Leads, Contacts і Deals видно в навігації; у Deals є **Amount**; у **Lead Source** є `Cold Call`;
  у Contacts є **Mailing Address - Country / Region**;
- **Setup → Process Management → Approval Processes** доступний (якщо ні — напиши ментору).

**14.6.** *(A17, сценарій A)* Налаштуй процес: **Module** `Deals`, **Approval Process Name**
`High-Value Deal Review`, **Description** `Requires approval for any deal with an amount exceeding
$10,000.`, **Send for Approval on** `Create or Edit Record`; у `Rule 1` критерій **Amount** `>`
`10000` *[SCREENSHOT REQUIRED: Approval Criteria configuration]*; етап — тип **User**, User B;
**Action on Final Approval** → **Update fields** → **Stage** = `Needs Analysis`; **Action on
Rejection** → **Email Notifications** → нове сповіщення власнику запису про відхилення угоди
*[SCREENSHOT REQUIRED: Email notification configuration]*; **Allow approvers to edit pending
approval records** не ставити; rule admins не призначати. **Save** і перевір, що процес активний
*[SCREENSHOT REQUIRED: Active approval process in list view]*.

**14.7.** *(A17, сценарій B)* Налаштуй процес: **Module** `Leads`, **Approval Process Name** `Cold
Call Lead Validation`, **Description** `Routes Cold Call leads through an approval stage before
pipeline entry.`, **Send for Approval on** `Create Record`; у `Rule 1` критерій **Lead Source** `is`
`Cold Call` *[SCREENSHOT REQUIRED: Criteria setup for Leads module]*; етап 1 — **User** User B, етап 2
— **User** Administrator; **Overall approval flow** — **All stages are approved**, **Sequential**
*[SCREENSHOT REQUIRED: the two approval stages and the Overall approval flow (All stages are
approved, Sequential)]*; **Action on Final Approval** → **Update fields** → **Lead Status** =
`Contacted`; **Action on Rejection** → **Update fields** → **Lead Status** = `Not Contacted`; Record
Modification Settings і Assign Admins — типові. **Save**, процес активний *[SCREENSHOT REQUIRED]*.

**14.8.** *(A17, сценарій C)* Налаштуй процес: **Module** `Contacts`, **Approval Process Name**
`Cross-Border Contact Edit Review`, **Description** `Triggers a compliance approval when a Contact's
Mailing Address - Country / Region is set to a non-US value.`, **Send for Approval on** `Edit Record`; у `Rule 1`
критерій **Mailing Address - Country / Region** `isn't` `United States` *[SCREENSHOT REQUIRED: Criteria setup]*; етап —
**User** User B; у Record Modification Settings етапу — **Allow approvers to edit pending approval
records** → **Selected Fields** → тільки **Mailing Address - Country / Region** *[SCREENSHOT REQUIRED: Record
Modification Settings — Selected Fields]*; **Assign Admins** → **Rule Admin Settings**: rule admin —
акаунт Administrator, **Allow rule admins to edit pending approval records** → **All Fields**
*[SCREENSHOT REQUIRED: Rule Admin Settings]*. **Save**, процес активний.

**14.9.** Спроєктуй шість додаткових тест-кейсів (по два на сценарій) — негативні чи граничні, яких
нема в основних потоках завдання, — у форматі TC ID | Test Flow | Steps Summary | Expected Result.
Для кожного поясни, яку помилку конфігурації чи розрив із бізнес-правилом він ловить.

**14.10.** *(складніша)* Розбір розривів. Для кожного сценарію порівняй бізнес-правило TechNova з
тим, що реально перевіряє налаштований процес. Знайди щонайменше по одному розриву, оціни ризик і
запропонуй, як його закрити, — не змінюючи налаштування, яких вимагає завдання (пропозиція йде у
звіт).

---

# Розв'язки

**14.1.**
а) **Review process**: перевірка на вході в CRM, поле за полем, до того як запис побачать інші
процеси.
б) **Approval process**: потрібне рішення людини й блокування запису до нього.
в) **Workflow rule**: реакція на подію без рішення людини — `Edit`, умова на закриту стадію, дія —
задача.
г) **Blueprint**: дозволені переходи між значеннями одного поля (Stage), без перескоків.

**14.2.**
а) Ні: `>` строгий, 10000 не більше за 10000.
б) Так.
в) Найімовірніше, ні: порожнє поле не більше за 10000. Довідка цього випадку не описує — це
граничний тест, перевір.
г) Так: процес перевіряє і редагування, а після зміни угода відповідає критерію.
д) Так: процес на `Create or Edit Record`, після редагування Amount досі більше 10000, а критерій
бачить стан запису, а не те, що змінили. Довідка це підтверджує: погоджений запис через редагування
може знову потрапити на погодження. Для бізнесу це означає, що кожна дрібна правка великої угоди
блокує її знову, — це варто обговорити. Перевір тестом і запиши фактичну поведінку.

**14.3.**
а) Запис отримують обидва етапи; правило погоджено, щойно погодив будь-який один із них.
б) Обидва отримують запис одночасно; правило погоджено, коли погодили обидва, у будь-якому порядку.
в) Спершу запис отримує лише User B; після його погодження — адміністратор; правило погоджено після
адміністратора. Саме це потрібно в сценарії B.

**14.4.** Помилки:
1. **Send for Approval on** `Create or Edit Record` замість `Create Record` — процес ширший за
   специфікацію.
2. `Contacted` в **Action on Approval** етапу 1 — статус зміниться після User B, до рішення
   адміністратора. Має бути в **Action on Final Approval**.
3. **At least one stage is approved** — лід погоджується вже після User B. Має бути **All stages are
   approved** + **Sequential**.
4. **Action on Rejection** порожній — має бути **Update fields** → **Lead Status** = `Not Contacted`.

**14.5.** Готово, коли: у CRM три активні підтверджені користувачі; User B і User C мають CRM, роль і
профіль (наприклад, Standard); під ними можна увійти; при виборі погоджувача в етапі видно обох; у
Deals є Amount, у Lead Source — `Cold Call`, у Contacts — Mailing Address - Country / Region; сторінка **Approval
Processes** відкривається. Корисно: окремий профіль браузера чи приватне вікно на кожного
користувача, щоб потім перемикатися без виходу з акаунта.

**14.6.** Кінцевий стан `High-Value Deal Review`:

| блок | значення |
|---|---|
| **Module** / **Send for Approval on** | `Deals` / `Create or Edit Record` |
| `Rule 1` → **Approval Criteria** | **Amount** `>` `10000` (валюта організації) |
| **Approval Stages** | 1 етап: **User** → User B |
| **Record Modification Settings** | approvers — не редагують; rejected — власник редагує All Fields (типово) |
| **Action on Final Approval** | **Update fields**: **Stage** = `Needs Analysis` |
| **Action on Rejection** | **Email Notifications**: сповіщення власнику запису за шаблоном про відхилення |
| **Assign Admins** | не налаштовано |
| статус у списку | Active |

Скриншоти: критерій, налаштування листа, процес у списку зі статусом Active.

**14.7.** Кінцевий стан `Cold Call Lead Validation`:

| блок | значення |
|---|---|
| **Module** / **Send for Approval on** | `Leads` / `Create Record` |
| `Rule 1` → **Approval Criteria** | **Lead Source** `is` `Cold Call` |
| **Approval Stages** | етап 1: **User** → User B; етап 2: **User** → Administrator |
| **Overall approval flow** | **All stages are approved** → **Sequential** |
| **Action on Final Approval** | **Update fields**: **Lead Status** = `Contacted` |
| **Action on Rejection** | **Update fields**: **Lead Status** = `Not Contacted` |
| **Record Modification Settings**, **Assign Admins** | типові |
| статус у списку | Active |

Скриншоти: критерій, два етапи з Overall approval flow, процес у списку.

**14.8.** Кінцевий стан `Cross-Border Contact Edit Review`:

| блок | значення |
|---|---|
| **Module** / **Send for Approval on** | `Contacts` / `Edit Record` |
| `Rule 1` → **Approval Criteria** | **Mailing Address - Country / Region** `isn't` `United States` |
| **Approval Stages** | 1 етап: **User** → User B |
| **Record Modification Settings** | **Allow approvers to edit pending approval records** → **Selected Fields**: **Mailing Address - Country / Region** |
| **Rule Admin Settings** | **Rule Admins**: Administrator; **Allow rule admins to edit pending approval records** → **All Fields**; сповіщення погоджувачів — типове (записане) |
| статус у списку | Active |

Наслідок: User B у записі, що чекає, змінює лише Mailing Address - Country / Region; ти як rule admin — будь-яке поле і
можеш забрати запис через **Takeover** у картці.

**14.9.** Приклад:

| TC ID | Test Flow | Steps Summary | Expected Result |
|---|---|---|---|
| TC-A-X1 | A, межа | User C створює угоду з Amount `10000` | погодження нема (`>` строгий) |
| TC-A-X2 | A, повторне редагування | погоджену угоду на `15000` User C редагує (опис) | угода знову заблокована й чекає погодження (так описує довідка) — підтвердити |
| TC-B-X1 | B, діра редагування | лід `Web Download` → змінити на `Cold Call` → спробувати конвертувати | погодження нема; конвертація доступна — розрив із бізнес-правилом |
| TC-B-X2 | B, блок конвертації | лід `Cold Call`, що чекає, — спробувати конвертувати | конвертація недоступна, поки лід чекає |
| TC-C-X1 | C, не та зміна | контакт із `Germany`, погоджений раніше, — змінити телефон | контакт знову йде на погодження, хоча країну не змінювали (критерій бачить стан) — підтвердити |
| TC-C-X2 | C, права погоджувача | User B у записі, що чекає, намагається змінити телефон | телефон не редагується, Mailing Address - Country / Region — редагується |

Ловлять: строгий оператор; повторне спрацювання на редагування; прогалину `Create Record`; блок
конвертації; розрив «стан проти зміни»; межі Selected Fields.

**14.10.**
- **A.** Бізнес: погодження *до закриття угоди*. Процес: блокує великі угоди при створенні й
  кожному редагуванні. Розрив: погоджується не закриття, а сам факт великої суми, тож кожна правка
  великої угоди знову блокує її (довідка описує повторне потрапляння погодженого запису на
  погодження). Ризик — тертя для продажів і черга в погоджувача. Пропозиція: визначити, що саме
  погоджується (умови угоди чи її закриття), і за потреби додати в критерій етап угоди.
- **B.** Бізнес: будь-який лід із `Cold Call` проходить погодження до конвертації. Процес: лише
  створені з `Cold Call`. Розрив: лід, змінений на `Cold Call` пізніше, обходить погодження. Ризик —
  середній (обхід без жодного сигналу). Пропозиція: `Create or Edit Record` або окреме правило на
  редагування — з тестом на повторні блокування.
- **C.** Бізнес: погодження, коли країну *змінюють* на не-США. Процес: будь-яке редагування контакта
  з не-US країною (і, можливо, з порожньою — окремо перевіряється). Розрив: зайві погодження й
  навантаження на User B, адже критерій реагує на будь-яку правку контакту, а не лише на зміну
  країни. Пропозиція: обговорити, чи потрібне погодження на кожне редагування, чи лише коли саме
  поле країни змінилось.

---

## Ворота уроку

- [ ] пояснюєш, що робить approval process із записом і чим він відрізняється від workflow rule,
  Blueprint і review process;
- [ ] малюєш по пам'яті структуру: процес → правила → критерій, етапи, загальний порядок, фінальні
  дії, rule admins;
- [ ] пояснюєш, чому порядок процесів і правил має значення;
- [ ] заповнюєш вікно **Create Approval Process** і обираєш **Send for Approval on** під вимогу;
- [ ] пам'ятаєш, що Approval Criteria обов'язкова, а числові оператори — символи;
- [ ] називаєш сім типів погоджувачів і що дають Anyone та Everyone;
- [ ] передбачаєш поведінку для At least one / All stages + Parallel / Sequential;
- [ ] розрізняєш Action on Approval етапу і Final Actions;
- [ ] пояснюєш типові Record Modification Settings і що змінює Selected Fields;
- [ ] пояснюєш rule admins, Takeover і що змінюється, коли rule admins призначено;
- [ ] знаєш, де погоджувачі бачать чергу (**Workqueue → My Jobs → Approvals**, **Respond** у картці);
- [ ] бачиш у конфігураціях A17 розриви з бізнес-правилами: межа `>`, «стан, а не зміна»,
  «тільки створення»;
- [ ] три процеси A17 налаштовані, активні, усі скриншоти [SCREENSHOT REQUIRED] зняті;
- [ ] задачі 14.4, 14.9 і 14.10 розв'язані без підглядання.
