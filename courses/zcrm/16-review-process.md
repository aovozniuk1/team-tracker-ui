# Урок 16. Review Process: перевірка даних на вході

*Після уроку ти пояснюєш, чим рев'ю відрізняється від погодження, налаштовуєш три процеси рев'ю
для Leads — з правилами, рецензентами, діями й причинами відхилення, — впорядковуєш їх і
проганяєш п'ять тестових сценаріїв завдання A18. Для QA рев'ю незвичне тим, що запис на ньому
«зникає» з CRM: треба знати, де його шукати, хто його бачить і що саме доводити.*

---

## 16.1. Що таке Review Process і навіщо він

Більшість функцій CRM працюють із записами, які вже в системі. Review Process стоїть **на вході**:
новий запис, що відповідає умові процесу, спершу мусить пройти перевірку рецензента, і лише тоді
він «потрапляє в CRM» — з'являється у списках модуля й бере участь в автоматизації.

Уяви кредитну компанію, яка щодня отримує сотні заявок з веб-форм та інтеграцій. Без перевірки
заявка з вигаданим доходом пройде весь продажний процес і відвалиться лише на етапі видачі
кредиту — після того, як на неї витратили час агенти й спрацювали автоматизації. Рев'ю тримає
такі записи на порозі, доки людина не підтвердить, що дані правдиві.

Як Zoho це робить:

- **Запис на рев'ю заблокований і невидимий.** Його нема у звичайних списках модуля, навіть в All
  Leads, і на ньому не запускаються workflow rules, погодження чи blueprint. Знайти його можна в
  черзі рецензента і в системному представленні `Leads in Review`.
- **Перевіряють поля, а не запис цілком.** Процес позначає, які поля треба перевірити. Рецензент
  погоджує або відхиляє кожне поле окремо. Одного відхиленого поля досить, щоб відхилити весь
  запис, і рецензент може відхилити запис, не переглянувши решту полів.
- **Лише при створенні.** Рев'ю запускається тільки для нових записів — з веб-форм, API, порталів,
  інтеграцій і створених вручну. Для правок уже наявного запису Zoho радить погодження.
- **Поки чекає — не редагується.** Автор (submitter) не може змінити запис на рев'ю. Відхилений
  запис він може виправити й подати знову — кнопкою **Submit for Review** (так її називає
  довідка); тоді статус стає `Pending for Re-review`.
- **Не вічно.** Записи, що чекають рев'ю понад три місяці, Zoho видаляє автоматично.
- **Перед рев'ю — інші перевірки.** Validation rules, layout rules і схвалення веб-форм
  відпрацьовують раніше, ніж запис піде на рев'ю.

Кілька технічних деталей, корисних тестувальнику: для записів з інтеграцій довідка називає API
v2.1; якщо запис створює API v2, треба явно передати `"process": ["review_process"]`, а через v1
рев'ю не запускається. За FAQ Zoho, рев'ю доступне з редакції Enterprise; у тріалі Zoho One
розділ є.

---

## 16.2. Як Zoho будує процес рев'ю

```
Review Process (модуль + лейаут)
├── WHEN        умова входу; порожня = усі нові записи лейауту
├── FIELD SET   які поля перевіряти
├── RULE 1…5    підкритерій (Based on Criteria) або All Records → хто рецензує
├── Others      усі записи, що не підійшли під жодне правило → хто рецензує
├── Actions     сповіщення, SLA escalation, Functions
└── Reasons     причини відхилення: 3 стандартні + свої
```

**Модуль і лейаут.** Процес прив'язаний до лейауту. Лід, створений в іншому лейауті Leads, у цей
процес не потрапить. На одному модулі може бути кілька процесів.

**Поля для рев'ю.** За новішою статтею довідки можна обрати однорядковий і багаторядковий текст,
Email, Phone, дату й дату-час, число, валюту, десяткове, відсоток, довге ціле, URL, picklist,
multi-select, checkbox і file upload; старіший FAQ Zoho перелічує лише перший набір.

**Lead Source** (picklist) у **FIELD SET** для Leads/Standard
**є** — довідка тут не помиляється. Але два типи полів, які теж мали б підходити за списком,
у FIELD SET не пропонуються: багаторядковий **Description** узагалі не пропонується (пошук за
цим словом у полі «Add Field» не дає жодного варіанта), так само не пропонується композитне поле
адреси (**Address - Country / Region**) — хоча воно ж є звичайним однорядковим текстовим полем як
критерій у RULE. Плануючи FIELD SET, перевіряй кожне поле в живому пошуку «Add Field», а не лише за
типом із довідки.

**Правила й рецензенти.** До 5 правил; у кожному — підкритерій або All Records і рецензенти:
users, roles, groups або record owner, до 5 на правило. Досить рішення **одного** рецензента:
коли він переглянув усі поля, запис виходить з рев'ю й зникає з черг інших. Запис, що не підійшов
під жодне правило, дістається **Others** — так жоден запис не лишається без перевірки.

**Actions.** Сповіщення на подачу (рецензенту), на завершення рев'ю і на відхилення (автору,
рецензенту й адміністраторам CRM); **SLA escalation** — скільки запис може чекати після подачі чи
повторної подачі, перш ніж обраний користувач отримає сповіщення (одиниці: дні, години, хвилини,
робочі дні, робочі години); **Functions** — функції на подачу, завершення, відхилення й повторну
подачу.

**Причини відхилення.** Стандартні: `Invalid entry`, `Data insufficient`, `Data does not match`.
Можна додати свої, всього до 10. Відхиляючи поле, рецензент обирає причину зі списку свого
процесу.

**Кілька процесів — черговість.** Список за замовчуванням стоїть у порядку
**створення, найстаріший угорі** — так само, як і в approval-процесів (жодного контрасту між ними
немає, обидва типи процесів поводяться однаково). Якщо запис підходить під кілька процесів, він іде
за порядком у списку. Порядок змінює **Reorder Processes** (відкривається, показує підказку
«Reordering infers the order of execution»); якщо процеси вже створені в потрібному порядку,
перетягувати нема чого.

**Статуси запису на рев'ю:** `Pending for Review`, `Review in Progress`, `Rejected`,
`Pending for Re-review`. Ще є `Unreviewed` — так позначається запис, який при деактивації процесу
випустили в систему без перевірки.

**Де працюють рецензенти.** **Workqueue → My Jobs → Review Process**. Адміністратори бачать там
усі записи на рев'ю й можуть їх переглядати, навіть не будучи рецензентами. У модулі Leads є
системне представлення `Leads in Review`; хто саме його бачить, довідка описує суперечливо (в
одному місці — рецензенти й адміністратори, в іншому — «не рецензенти») — перевір у тріалі.

**Історія.** На сторінці переглянутого запису: **More → Review History** — дата входу в процес,
переглянуті й повторно переглянуті поля, погоджені поля, дата рев'ю; решта подробиць — у Timeline.
У My Jobs довідка описує ще журнал **Review Logs** (дії Entered, Re-entered, Rejected, Reviewed,
Unreviewed). **Setup → Process Management → Review Processes → Review Analytics** — чотири готові
звіти: середній час очікування, статуси за кількістю записів, статуси полів, причини відхилення.

**Деактивація й видалення.** Видалити процес, у якому є записи на рев'ю, не можна. Вимикаючи
процес із записами, що чекають, Zoho запитає, що з ними робити: відхилити, пропустити в систему
або вивести з процесу й прогнати через інші активні процеси.

---

## 16.3. Review чи Approval

Обидві функції ставлять людину між записом і подальшим процесом, але розв'язують різні задачі.

| | Approval Process | Review Process |
|---|---|---|
| коли запускається | створення та/або редагування | лише створення |
| що оцінюють | запис цілком | окремі поля |
| рішення по полях | нема: все або нічого | кожне поле окремо; одне відхилене — відхилено запис |
| прив'язка до лейауту | ні | так |
| хто вирішує | users, roles, groups, рівні ієрархії, менеджер власника, власник, … | users, roles, groups, record owner |
| скільки людей | до 10 етапів; послідовно чи паралельно | до 5 рецензентів на правило; досить одного |
| запис поза критерієм | просто пропускається | можна віддати на рев'ю через Others |
| строк і ескалація | нема | SLA escalation |
| делегування | є | нема |
| звіти | окремих нема | 4 готові звіти |
| де запис, поки чекає | у списках, із замком | у списках модуля його нема |

З порівняльної таблиці довідки Zoho випливає просте правило вибору: швидка перевірка кількох полів
одним із кількох людей — рев'ю; ретельний розгляд запису кількома керівниками, послідовно чи
паралельно, — погодження. І ще одна межа: рев'ю не вміє реагувати на редагування, тож «перевірити
зміну даних» — завжди погодження.

Коли на одному модулі є і погодження, і рев'ю, порядок їхнього виконання довідка описує
суперечливо: FAQ про погодження каже «спершу рев'ю, потім погодження», FAQ про рев'ю — навпаки.
Для тестів висновок простий: не змішуй їх. Якщо на Leads активний процес погодження, який
чіпляє ті самі ліди (наприклад, на `Cold Call`), вимкни його на час тестів рев'ю — у списку
**Setup → Process Management → Approval Processes** процес вмикається й вимикається значком
статусу (так описує довідка).

---

## 16.4. Де це в тріалі

- **Setup → Process Management → Review Processes**. На порожньому списку — кнопка **Create New
  Process**.
- Вікно **New Review Process**: **Process Name**, **Description**, **Choose Module**, **Choose
  Layout** і **Choose a condition to initiate the rule** (порожня умова = усі записи) → **Next**.
- Далі полотно зліва направо: **WHEN** → **FIELD SET** («Which fields should be reviewed?») →
  **RULE 1** («Mention sub-criteria for users to review»: **Based on Criteria** / **All Records**)
  → **Who Should Review** («Choose Reviewers»).
- Черга рецензента: **Workqueue → My Jobs → Review Process**.

> Вікно створення проходить усе полотно: **WHEN**, **FIELD SET**,
> **RULE 1** (Based on Criteria / All Records), **Who Should Review**, **OTHERS**, **ACTIONS**
> (Notifications, SLA Escalation, Functions), **Configure Reasons For Record Rejection**,
> збереження і **Reorder Processes**. Дія рецензента над окремими полями
> не ховається за жодною кнопкою «Respond»: кожне поле з FIELD SET показує власну маленьку
> іконку одразу біля свого значення (і в короткій картці зверху, і в розділі **Lead Information**
> нижче — та сама іконка скрізь, де поле показане). Клік по ній відкриває невелике вікно **"Do you
> want to approve the field '⟨поле⟩' with value '⟨значення⟩'?"** (без частини «with value…», якщо
> поле порожнє) з необов'язковим **Add Comment** і кнопками **Approve** / **Reject**. Причину
> відхилення тут не питають: вона з'являється окремим вікном лише в момент, коли прийнято рішення
> по *останньому* полю — і тільки якщо серед рішень є хоч одне **Reject**.

---

## 16.5. Покроково: підготовка

1. **Setup → General → Users**: User B і User C активні. (Якщо їх ще нема: Zoho One **Admin Panel
   → User Management → Users → Add User**, призначити CRM, у **Setup → General → Users** задати
   Role і Profile.) User A у завданні — це ти, адміністратор.
2. Модуль **Leads** відкривається, створення ліда доступне.
3. Відкрий форму нового ліда й знайди поля, з якими працюватимеш: **Annual Revenue**, **Email**,
   **Phone**, **Lead Source**, **Country**, **Description**.
4. **Setup → Process Management → Review Processes** відкривається.
5. Гігієна: подивись, чи нема на Leads активних процесів погодження, що чіпляють `Cold Call`, і
   скільки лейаутів має Leads. Процеси створюватимеш на **Standard**, тож і тестові ліди
   створюй у ньому.

**Що побачиш:** на порожньому списку процесів рев'ю — **Create New Process**.

---

## 16.6. Покроково: процес 1 — WF_General_Screening

Ліди з веб-форми перевіряють на повноту. Значення `Web Form` у **Lead Source** тріалу нема, тому
замість нього документ бере `Web Download`.

| що | значення |
|---|---|
| **Process Name** | `WF_General_Screening` |
| **Choose Module** / **Choose Layout** | Leads / Standard |
| умова входу | Lead Source is `Web Download` |
| поля на рев'ю | Email, Phone, Annual Revenue, Company (Description не пропонується у FIELD SET) |
| Rule 1 | Country is `United States` → User B |
| Others | усі інші записи → User C |
| Actions | Send notification on submission ✔, Send notification on review completion ✔ |
| причини відхилення | три стандартні + `Missing Contact Details` |

1. **Create New Process** → заповни **Process Name**, **Description** (наприклад, `Screening of web
   form applicants for data completeness`), **Choose Module** `Leads`, **Choose Layout**
   `Standard`.
2. **Choose a condition to initiate the rule**: **Lead Source** is `Web Download` → **Next**.
   Редактор підписує оператор для picklist словом, як і для тексту — `is`, не символом `=`.
   **Що побачиш:** полотно з блоками **WHEN**, **FIELD SET**, **RULE 1**.
3. **FIELD SET**: обери **Email**, **Phone**, **Annual Revenue**, **Company**. Багаторядкове поле
   **Description** у FIELD SET не пропонується узагалі — пошук за цим словом у полі «Add Field» не
   дає жодного варіанта.
4. **RULE 1** → **Based on Criteria** → **Country** is `United States` (друкуй точно так).
5. **Who Should Review** → **Choose Reviewers** → користувач User B → додай.
6. Для решти записів налаштуй **Others** → User C.
7. **Actions** (у статті довідки цей крок названо **Instant actions**): увімкни сповіщення на
   подачу й на завершення рев'ю. Сповіщення на відхилення **не** вмикай — документ його тут не
   просить, і це дасть тобі негативний кейс.
8. Причини відхилення (за довідкою — посилання **Configure Reasons For Record Rejection**, **+**
   додає рядок): залиш три стандартні й додай `Missing Contact Details`.
9. Збережи процес.
   **Що побачиш:** `WF_General_Screening` у списку процесів рев'ю. Скриншот конфігурації.

---

## 16.7. Покроково: процес 2 — HV_Senior_Review

Заявники з великим доходом проходять додаткову перевірку.

| що | значення |
|---|---|
| **Process Name** | `HV_Senior_Review` |
| **Choose Module** / **Choose Layout** | Leads / Standard |
| умова входу | Annual Revenue більше `100000` |
| поля на рев'ю | Annual Revenue, Email, Lead Source, Title (Country не пропонується у FIELD SET) |
| Rule 1 | Lead Source is `Cold Call` → User B |
| Rule 2 | Lead Source is `Advertisement` → User C |
| Others | усі інші записи → User A (адміністратор) |
| Actions | Send notification on submission ✔, Send notification on rejection ✔, SLA escalation: 2 дні → User A |
| причини відхилення | стандартні + `Revenue Data Unverifiable` |

1. **Create New Process**: `HV_Senior_Review`, Leads, Standard.
2. Умова: **Annual Revenue** — оператор `>` (показаний символом, той самий
   набір `=, !=, <, <=, >, >=, between, not between, is empty, is not empty`, що й у approval
   criteria), значення `100000` (без коми).
3. **FIELD SET**: **Annual Revenue**, **Email**, **Lead Source**, **Title**. Композитне поле
   **Address - Country / Region** не пропонується у FIELD SET цього тріалу (хоча воно ж чудово
   працює як критерій у RULE 1, нижче).
4. **RULE 1**: **Based on Criteria** → **Lead Source** is `Cold Call` → рецензент User B.
5. Додай друге правило: **Lead Source** is `Advertisement` → User C.
6. **Others** → User A.
7. **Actions**: сповіщення на подачу ✔, на відхилення ✔; **SLA escalation** ✔ — період 2 дні,
   кому ескалювати — User A.
8. Причини: стандартні + `Revenue Data Unverifiable`. Збережи.
   **Що побачиш:** два процеси у списку, у порядку створення: `WF_General_Screening`, потім
   `HV_Senior_Review` (найновіший стає **внизу**, не вгорі).

---

## 16.8. Покроково: процес 3 — RJ_Resubmission_Review і порядок

Документ моделює «повторного заявника» статусом ліда. Справжня повторна подача відхиленого запису
— окремий шлях (**Submit for Review**, статус `Pending for Re-review`), а цей процес ловить нові
ліди зі статусом `Not Contacted`. Це умовність тріалу, як і каже документ.

| що | значення |
|---|---|
| **Process Name** | `RJ_Resubmission_Review` |
| **Choose Module** / **Choose Layout** | Leads / Standard |
| умова входу | Lead Status is `Not Contacted` |
| поля на рев'ю | Email, Phone, Company (Description не пропонується у FIELD SET) |
| Rule 1 | **All Records** → User A (адміністратор) |
| Actions | усі три сповіщення: подача, завершення рев'ю, відхилення |
| причини відхилення | додати `Previously Rejected — No Change Detected` і `Incomplete Resubmission` (стандартні не видаляй) |

1. **Create New Process**: `RJ_Resubmission_Review`, Leads, Standard; умова **Lead Status** is `Not
   Contacted`.
2. **FIELD SET**: **Email**, **Phone**, **Company** (багаторядкове поле **Description** у FIELD SET
   взагалі не пропонується — пошук за цим словом у полі «Add Field» не дає жодного варіанта).
3. **RULE 1** → **All Records** → User A. **Others** тут не потрібен: All Records уже покриває все.
4. **Actions**: три сповіщення ✔. Причини: дві нові. Збережи.
5. Перевір порядок на сторінці списку: якщо процеси створювались саме в порядку
   `WF_General_Screening` → `HV_Senior_Review` → `RJ_Resubmission_Review`, список уже стоїть у
   цьому порядку — найстаріший процес лишається вгорі, найновіший стає внизу, а не навпаки. Відкрий
   **Reorder Processes**, щоб переконатись і зробити скриншот (кнопка
   активна в межах одного модуля й лейауту — Leads/Standard, статус фільтра «All»); тут перетягувати
   нічого не треба.
   **Що побачиш:** підказку «Reordering infers the order of execution» і той самий порядок
   `WF_General_Screening → HV_Senior_Review → RJ_Resubmission_Review`. Скриншот списку.

---

## 16.9. Покроково: тестові сценарії

### Дані, які ведуть запис туди, куди треба

Головна пастка A18 — порядок процесів. Запис іде в **перший** процес, під умову якого підходить,
тож для кожного сценарію значення треба підібрати так, щоб він не зачепив процес вище в списку.

| сценарій | Lead Source | Country | Annual Revenue | Lead Status | має потрапити | рецензент |
|---|---|---|---|---|---|---|
| 1 | `Web Download` | `United States` | `50000` | `Attempted to Contact` | WF_General_Screening, Rule 1 | User B |
| 2 | `Cold Call` | `Germany` | `150000` | `Attempted to Contact` | HV_Senior_Review, Rule 1 | User B |
| 3 | `Trade Show` | `Germany` | `20000` | `Not Contacted` | RJ_Resubmission_Review, Rule 1 | User A |
| 5 | `Web Download` | `Germany` | `150000` | `Attempted to Contact` | WF_General_Screening, Others | User C |

Усім лідам заповни **Email**, **Phone** і обов'язкові **Last Name** та **Company** (саме ці поля,
не **Description** — воно не пропонується у FIELD SET цього тріалу): поле, що йде на рев'ю, має
бути заповнене, інакше рецензенту нема що погоджувати. Імена:
`RV1-Approve`, `RV2-RejectRevenue`, `RV3-Partial`, `RV5-Order`. **Lead Status** задавай явно в
кожному ліді: від нього залежить, чи зачепить лід процес RJ. Створюй ліди під адміністратором, а
черги перевіряй під рецензентами.

### Сценарій 1. Погодити запис від початку до кінця

1. Створи `RV1-Approve` з даними таблиці. Збережи.
   **Що побачиш:** у **All Leads** ліда нема; він є в `Leads in Review` зі статусом
   `Pending for Review`; User B отримав лист про подачу.
2. **User B** → **Workqueue → My Jobs → Review Process**.
   **Що побачиш:** `RV1-Approve` у черзі, процес `WF_General_Screening`. Скриншот черги. Під
   User C у його черзі цього ліда нема.
3. Відкрий запис. Кожне поле з FIELD SET показує власну маленьку іконку одразу біля значення —
   клікни її й погодь кожне: **Email**, **Phone**, **Annual Revenue**, **Company**. Вікно, що
   відкривається, питає: **"Do you want to approve the field '⟨поле⟩' with value '⟨значення⟩'?"**,
   з необов'язковим **Add Comment** і кнопками **Approve** / **Reject**.
   **Що побачиш:** після останнього поля (усі чотири погоджені, без жодного відхилення) запис одразу
   виходить з рев'ю, без додаткових вікон; надходить сповіщення про завершення.
4. **Leads → All Leads**.
   **Що побачиш:** `RV1-Approve` у списку. Скриншот сторінки погодженого запису.

### Сценарій 2. Відхилити одне поле

1. Створи `RV2-RejectRevenue` (Cold Call, `150000`).
2. **User B** → **Workqueue → My Jobs → Review Process** → запис.
   **Що побачиш:** процес `HV_Senior_Review`.
3. Пройди всі чотири поля FIELD SET один за одним: на **Annual Revenue** натисни **Reject** (вікно
   на цьому кроці питає тільки підтвердження й необов'язковий коментар, причину ще не питає), інші
   три (**Email**, **Lead Source**, **Title**) — **Approve**.
   **Що побачиш:** щойно прийнято рішення по останньому, четвертому полю, — окреме вікно **"Record is
   going to be rejected"** з підсумком (**N Approved / M Rejected**) і випадним списком **Reason for
   rejecting a record**. Обери `Revenue Data Unverifiable` → **Done**.
   **Що побачиш:** статус запису `Rejected`; лист про відхилення (у цьому процесі сповіщення
   ввімкнене); у Timeline запису — подія з посиланням **View details**, що показує саме обрану
   причину.
4. **Leads → All Leads**.
   **Що побачиш:** `RV2-RejectRevenue` у списку нема. Скриншот сторінки відхиленого запису.

### Сценарій 3. Частковий перегляд

1. Створи `RV3-Partial` (Trade Show, `20000`, Lead Status `Not Contacted`).
2. **Адміністратор** → **Workqueue → My Jobs → Review Process** → запис (процес
   `RJ_Resubmission_Review`).
3. Погодь **Email** і **Phone**, **Company** не чіпай. Повернись до списку черги й
   подивись статус.
   **Що побачиш:** запис досі на рев'ю; за переліком статусів довідки очікувано
   `Review in Progress`. Запиши точний статус, який показує тріал.
4. Відхили **Company** з причиною, наприклад, `Incomplete Resubmission`.
   **Що побачиш:** фінальний статус `Rejected`.

### Сценарій 4. Review History

1. **Leads → All Leads** → `RV1-Approve` → **More** → **Review History**.
   **Що побачиш:** вікно **"Review History — Reviewed"** зі списком, найновіше згори: підсумкове
   **"Record reviewed — by ⟨ти⟩"**, а нижче — по рядку на кожне поле, у зворотному порядку рішень
   (**"Field '⟨поле⟩' approved — by ⟨ти⟩"**). Ім'я рецензента підписане в кожному рядку — це
   саме так, а не «якщо нема — шукай у Timeline», як можна було подумати з довідки. Якщо в
   тебе **Review History** виглядає інакше — знайди рецензента в Timeline і
   запиши обидва факти. Скриншот екрана історії.

### Сценарій 5. Порядок процесів

1. Створи `RV5-Order` (Web Download, `150000`, Country `Germany`) — він підходить і під
   `WF_General_Screening`, і під `HV_Senior_Review`.
   **Що побачиш:** у черзі рев'ю процес запису — `WF_General_Screening`, рецензент — User C через
   Others; у черзі User B (рецензент HV за Cold Call) і серед записів HV його нема.
2. Під User C переглянь і погодь усі поля.
   **Що побачиш:** очікування документа — лише один процес, тож лід має з'явитися в **All Leads**.
   Якщо після WF він опинився в черзі `HV_Senior_Review`, це розбіжність з документом — зафіксуй.

---

## 16.10. Як це тестувати

### Що може зламатися

- **Маршрут.** Rule 1 проти Others: `United States` проти `Germany`; Rule 1 проти Rule 2 у HV.
- **Черговість.** Запис, що підходить під кілька процесів, іде в перший у списку.
- **Невидимість.** Запис на рев'ю не має бути в **All Leads**; погоджений — має.
- **Статуси.** `Pending for Review` → `Review in Progress` → `Rejected`/вихід з рев'ю.
- **Сповіщення за процесом.** У WF відхилення листа не дає (не ввімкнене) — це негативний кейс.
- **Причини.** `Revenue Data Unverifiable` є лише в HV; у WF її в списку бути не повинно.
- **SLA.** Запис, що чекає понад 2 дні в HV, дає ескалацію User A. Чекати два дні — окремий
  довгий кейс; якщо не встигаєш, задокументуй налаштування й очікування.
- **Тільки створення.** Редагування наявного ліда на `Web Download` рев'ю не запускає.
- **Лейаут.** Лід в іншому лейауті Leads у ці процеси не потрапляє.

### Тестуй від імені рецензентів

Адміністратор бачить усі рев'ю й може їх переглянути. Якщо переглядати все під ним, ти не
доведеш, що запис пішов до User B, а не до User C. Тому: запис — під адміністратором, черга й
рішення — під тим рецензентом, якого називає правило, плюс контроль, що в іншого рецензента
запису нема.

### Додаткові кейси

| ID | що перевіряє | дані | очікування |
|---|---|---|---|
| RV-6 | Others у HV | `Partner`, `150000` | HV, Others → User A |
| RV-7 | Rule 2 у HV | `Advertisement`, `150000` | HV, Rule 2 → User C |
| RV-8 | поза всіма процесами | `Trade Show`, `20000`, `Attempted to Contact` | одразу в **All Leads**, без рев'ю |
| RV-9 | правка, а не створення | наявний лід змінити на `Web Download` | рев'ю нема |
| RV-10 | регістр і написання | Web Download, Country `USA` / `united states` | з'ясувати: Rule 1 чи Others |
| RV-11 | WF без сповіщення на відхилення | Web Download, відхилити поле | листа про відхилення нема |
| RV-12 | повторна подача | виправити `RV2-RejectRevenue`, **Submit for Review** | статус `Pending for Re-review` |

RV-10 — дослідницький: документація не каже, чи порівняння чутливе до регістру, тож очікування
тут з'ясовується, а не вгадується. Але «USA» ≠ «United States» у будь-якому разі — для
бізнесу це сигнал, що текстове поле країни — слабке місце маршрутизації.

### Здача

Усе — в Zoho Office Suite, публічне посилання в чат ментору:

| # | що | формат | інструмент |
|---|---|---|---|
| 1 | документ тестових сценаріїв на всі 5 сценаріїв: передумови, кроки, очікуваний результат | документ | Zoho Writer |
| 2 | таблиця тест-кейсів | таблиця | Zoho Sheet |
| 3 | звіт про дефекти, якщо щось знайдено | документ | Zoho Writer |
| 4 | скриншоти або запис екрана: усі 3 налаштовані процеси; **Workqueue → My Jobs** з записами, що чекають; щонайменше один погоджений і один відхилений запис; екран **Review History** | зображення / відео | будь-який інструмент запису |

Приклад сценарію в документі:

```
Scenario 2 — Reject a single field and observe record lock
Preconditions: HV_Senior_Review active, 2nd in order; User B is Rule 1 reviewer.
Test data: Lead RV2-RejectRevenue, Lead Source = Cold Call, Annual Revenue = 150000.
Steps: 1. As admin create the lead. 2. As User B open Workqueue > My Jobs > Review Process.
       3. Reject Annual Revenue with reason "Revenue Data Unverifiable". 4. Open Leads > All Leads.
Expected: record status Rejected; rejection email sent; lead is not listed in All Leads.
```

Стовпці таблиці тест-кейсів, що добре працюють: **TC ID | Scenario | Preconditions | Test Data |
Steps | Expected Result | Actual Result | Status | Evidence**.

---

## 16.11. Типові помилки

**1. Тестові дані без урахування порядку.** Лід для RJ з `Web Download` потрапить у WF, і сценарій
3 «впаде» на порожньому місці.

**2. Пошук ліда в All Leads.** Запис на рев'ю там і не має бути — дивись `Leads in Review` і чергу.

**3. Рев'ю під адміністратором.** Він бачить усе, тож маршрут до User B чи User C не доведено.

**4. Очікування рев'ю на редагування.** Рев'ю — лише для нових записів.

**5. Порожні поля на рев'ю.** Рецензенту нема що погоджувати, а повторна подача, за довідкою,
доступна лише коли всі поля на рев'ю заповнені.

**6. Процеси створені не в тому порядку.** Список за замовчуванням стоїть у порядку створення
(найстаріший угорі); якщо `HV_Senior_Review` випадково створити раніше за `WF_General_Screening`,
сценарій 5 дасть HV замість WF, і без **Reorder Processes** це не виправити.

**7. `USA` замість `United States`.** Rule 1 не спрацює, запис піде в Others.

**8. Активне погодження на тих самих лідах.** Два механізми на одному записі плутають результат —
вимкни погодження на час тестів.

**9. Лід в іншому лейауті.** Процес прив'язаний до Standard.

### Симптом → причина

| симптом | найімовірніша причина |
|---|---|
| новий лід одразу в **All Leads**, без рев'ю | не підійшов під умову жодного процесу, створений в іншому лейауті або процес неактивний |
| лід зник: нема ні в **All Leads**, ні в черзі рецензента | він на рев'ю в іншого рецензента чи в іншому процесі — дивись `Leads in Review` і чергу адміністратора |
| сценарій 1 потрапив до User C | Country не точно `United States` — спрацював Others |
| сценарій 3 потрапив у WF чи HV | у ліда `Web Download` або Annual Revenue понад `100000` |
| сценарій 5 потрапив у HV | `HV_Senior_Review` створено раніше за `WF_General_Screening` (список стоїть у порядку створення) — виправ через **Reorder Processes** |
| у списку причин нема `Revenue Data Unverifiable` | рецензент працює в іншому процесі — причини в кожного процесу свої |
| після відхилення в WF нема листа | так налаштовано: сповіщення на відхилення в WF вимкнене |
| **Description** чи **Country** не пропонується у **FIELD SET** | обмеження типів полів для FIELD SET у цьому тріалі — використовуй Company/Title |
| у **Review History** нема імені рецензента | у тріалі ім'я підписане в кожному рядку — якщо його нема, це розбіжність із твоїм тріалом, а не норма; перевір Timeline і зафіксуй різницю |
| процес не видаляється | у ньому є записи на рев'ю |
| адміністратор бачить запис, призначений User B | для адміністратора це нормально |

---

## 16.12. Що варто запам'ятати

1. Рев'ю — контроль на вході: запис заблокований, невидимий у списках модуля й поза автоматизацією.
2. Запускається лише при створенні; для правок — погодження.
3. Перевіряють поля: одне відхилене поле — відхилений запис.
4. Структура: WHEN → FIELD SET → правила (до 5) + Others → рецензенти (до 5, досить одного).
5. Процеси прив'язані до лейауту; за замовчуванням список стоїть у порядку **створення**
   (найстаріший угорі) — щоб змінити порядок, є **Reorder Processes**.
6. Запис іде в перший процес, під який підходить, — тестові дані підбирай з огляду на порядок.
7. Черга — **Workqueue → My Jobs → Review Process**; запис на рев'ю — ще й у `Leads in Review`.
8. Статуси: `Pending for Review`, `Review in Progress`, `Rejected`, `Pending for Re-review`.
9. **More → Review History** на сторінці запису; подробиці — у Timeline.
10. Маршрут доводиш від імені рецензентів, а не адміністратора.

---

# Задачі

**16.1.** *(порівняй)* Для кожної вимоги обери Review Process чи Approval Process і поясни:
   1. Ліди з веб-форми: менеджер має перевірити email і телефон, перш ніж лід потрапить у роботу.
   2. Знижка понад 15% в угоді потребує підпису двох керівників по черзі.
   3. Зміну платіжної адреси клієнта має підтвердити фінансист.
   4. Заявки з інтеграції: будь-хто з трьох аналітиків перевіряє дохід; якщо заявка лежить понад
      добу — сповістити керівника.

**16.2.** Підготовка (Part 1). Переконайся в **Setup → General → Users**, що User B і User C активні;
що модуль Leads доступний; знайди у формі ліда поля **Annual Revenue**, **Email**, **Phone**, **Lead
Source**, **Country**, **Description**; переконайся, що **Setup → Process Management → Review
Processes** відкривається. Перевір, чи нема на Leads активного погодження, яке чіплятиме ті самі
ліди, і на якому лейауті створюватимеш процеси.

**16.3.** Налаштуй процес `WF_General_Screening` для Leads, лейаут Standard: умова входу **Lead
Source** is `Web Download`; поля на рев'ю Email, Phone, Annual Revenue, Company (Description не
пропонується у FIELD SET цього тріалу); Rule 1 —
**Country** is `United States` → рецензент User B; Others — усі інші → User C; дії — сповіщення на
подачу і на завершення рев'ю; причини — три стандартні плюс `Missing Contact Details`. Збережи й
зроби скриншот.

**16.4.** Налаштуй процес `HV_Senior_Review` для Leads, лейаут Standard: умова **Annual Revenue**
більше `100000`; поля Annual Revenue, Email, Lead Source, Title (композитне поле Address - Country /
Region не пропонується у FIELD SET цього тріалу); Rule 1 — **Lead Source** is
`Cold Call` → User B; Rule 2 — **Lead Source** is `Advertisement` → User C; Others → User A
(адміністратор); дії — сповіщення на подачу і на відхилення, SLA escalation 2 дні з ескалацією до
User A; причини — стандартні плюс `Revenue Data Unverifiable`. Збережи й зроби скриншот.

**16.5.** Налаштуй процес `RJ_Resubmission_Review` для Leads, лейаут Standard: умова **Lead Status**
is `Not Contacted`; поля Email, Phone, Company (Description не пропонується у FIELD SET цього
тріалу); Rule 1 — **All Records** → User A;
дії — усі три сповіщення;
причини — додати `Previously Rejected — No Change Detected` і `Incomplete Resubmission`. Відкрий
**Reorder Processes** і переконайся, що список уже стоїть у порядку `WF_General_Screening` →
`HV_Senior_Review` → `RJ_Resubmission_Review` (порядок створення, змінювати нічого не треба). Зроби
скриншоти процесу й списку.

**16.6.** *(спроєктуй)* Є три процеси з задач 16.3–16.5 у порядку WF → HV → RJ. Підбери значення
**Lead Source**, **Country**, **Annual Revenue** і **Lead Status** для лідів, що мають потрапити:
а) у WF до User B; б) у HV до User B; в) у RJ до адміністратора; г) і під WF, і під HV одночасно;
ґ) у HV через Others. Поясни, чому для (в) не можна брати `Web Download` і дохід понад `100000`.

**16.7.** Сценарії 1 і 2. **1:** створи лід з **Lead Source** `Web Download` і **Country** `United
States`; відкрий **Workqueue → My Jobs**, відкрий запис, що чекає, погодь усі поля по одному й
переконайся, що після повного погодження лід є у списку Leads. **2:** створи лід під умову
`HV_Senior_Review` (**Annual Revenue** понад `100000`, **Lead Source** `Cold Call`); на екрані рев'ю
відхили поле **Annual Revenue** з причиною `Revenue Data Unverifiable`; переконайся, що статус став
`Rejected`, а ліда нема в стандартному списку Leads. Потрібні три процеси в порядку WF → HV → RJ.

**16.8.** Сценарії 3 і 4. **3:** створи лід під умову `RJ_Resubmission_Review`; погодь два поля, одне
лиши; зафіксуй статус рев'ю запису; потім відхили останнє поле й підтвердь фінальний статус. **4:**
обери повністю погоджений лід у модулі Leads, натисни **More** і відкрий **Review History**;
переконайся, що в історії є дата входу в процес, переглянуті поля, рішення і хто рецензував.

**16.9.** Сценарій 5. Створи лід, що одночасно відповідає умовам `WF_General_Screening` і
`HV_Senior_Review`. Переконайся, що він потрапив у перший процес за порядком (`WF_General_Screening`),
а не в другий. Доведи це з черги рев'ю і з того, що сталося після погодження.

**16.10.** *(передбач)* Процеси з задач 16.3–16.5 у порядку WF → HV → RJ (порядок створення — він же
порядок виконання, доки не відкриєш **Reorder Processes** і не зміниш його вручну). Що станеться:
   1. Якби `HV_Senior_Review` створили **раніше** за `WF_General_Screening` (RJ — усе одно останнім),
      і після цього створили лід `Web Download`, `150000`, `Germany`, Lead Status
      `Attempted to Contact`.
   2. Створили лід `Web Download`, Country `USA`.
   3. Наявний лід з `Trade Show` відредагували на `Web Download`.
   4. Створили лід `Advertisement`, `250000`.
   5. Створили лід `Partner`, `20000`, `Attempted to Contact`.
   6. Адміністратор відкрив і погодив усі поля ліда, що чекав User B.

**16.11.** *(знайди помилки)* Колега описав налаштування і план так. Знайди щонайменше п'ять
проблем.

```
HV_Senior_Review: condition Annual Revenue >= 100000; fields: Annual Revenue, Email, Lead Source, Country.
Rule 1: Cold Call -> User B. No Others (records outside rules are skipped anyway).
WF_General_Screening: Send notification on rejection enabled "just in case".
Order: left as created.
Test data for RJ: Lead Source = Web Download, Lead Status = Not Contacted.
All reviews done as admin to save time.
```

**16.12.** Здай A18: документ тестових сценаріїв (усі 5: передумови, кроки, очікуваний результат) у
Zoho Writer; таблиця тест-кейсів у Zoho Sheet; звіт про дефекти в Zoho Writer, якщо щось знайдено;
скриншоти або запис: усі 3 процеси, **Workqueue → My Jobs** з записами, що чекають, щонайменше один
погоджений і один відхилений запис, екран **Review History**. Поділись публічним посиланням у чаті з
ментором.

---

# Розв'язки

**16.1.**
1. Рев'ю: нові записи з веб-форми, перевірка конкретних полів до входу в CRM.
2. Погодження: два керівники послідовно — це етапи і **Sequential**; рев'ю так не вміє.
3. Погодження: це зміна наявного запису, а рев'ю реагує лише на створення.
4. Рев'ю: нові записи з інтеграції, будь-хто з кількох рецензентів, SLA escalation є лише в рев'ю.

**16.2.** Очікування: User B і User C зі статусом активних; форма ліда містить усі шість полів;
**Setup → Process Management → Review Processes** відкривається, на порожньому списку — **Create
New Process**. Якщо на Leads активне погодження на `Cold Call` — вимкни його значком статусу в
списку **Approval Processes** на час тестів і запиши це в передумови. Лейаут — Standard.

**16.3.** Кінцева конфігурація:

```
WF_General_Screening   Leads / Standard
WHEN        Lead Source is Web Download
FIELD SET   Email, Phone, Annual Revenue, Company (Description не пропонується у FIELD SET)
RULE 1      Based on Criteria: Country is United States  → User B
Others      → User C
Actions     [x] Send notification on submission
            [x] Send notification on review completion
            [ ] Send notification on rejection
Reasons     Invalid entry, Data insufficient, Data does not match, Missing Contact Details
```

**16.4.**

```
HV_Senior_Review       Leads / Standard
WHEN        Annual Revenue > 100000
FIELD SET   Annual Revenue, Email, Lead Source, Title (Country не пропонується у FIELD SET)
RULE 1      Lead Source is Cold Call      → User B
RULE 2      Lead Source is Advertisement  → User C
Others      → User A (admin)
Actions     [x] Send notification on submission
            [x] Send notification on rejection
            [x] SLA escalation: 2 days → User A
Reasons     Invalid entry, Data insufficient, Data does not match, Revenue Data Unverifiable
```

**16.5.**

```
RJ_Resubmission_Review Leads / Standard
WHEN        Lead Status is Not Contacted
FIELD SET   Email, Phone, Company (Description не пропонується у FIELD SET цього тріалу)
RULE 1      All Records → User A (admin)
Actions     [x] submission  [x] review completion  [x] rejection
Reasons     Invalid entry, Data insufficient, Data does not match,
            Previously Rejected — No Change Detected, Incomplete Resubmission

Order (список за замовчуванням, порядок створення):
1. WF_General_Screening  2. HV_Senior_Review  3. RJ_Resubmission_Review
```

Порядок уже правильний одразу після створення трьох процесів у цій послідовності — Reorder
Processes нічого не змінює, лише підтверджує (найстаріший процес лишається вгорі, найновіший —
унизу).

**16.6.**

| | Lead Source | Country | Annual Revenue | Lead Status |
|---|---|---|---|---|
| а) WF → User B | `Web Download` | `United States` | будь-який | будь-який |
| б) HV → User B | `Cold Call` | будь-яка | `150000` | будь-який |
| в) RJ → адміністратор | не `Web Download`, наприклад `Trade Show` | будь-яка | не більше `100000` або порожньо | `Not Contacted` |
| г) WF і HV одночасно | `Web Download` | будь-яка | `150000` | будь-який |
| ґ) HV через Others | не `Web Download`, не `Cold Call`, не `Advertisement` — наприклад `Partner` | будь-яка | `150000` | будь-який |

Для (в): WF і HV стоять вище за RJ. `Web Download` відправить лід у WF, дохід понад `100000` — у
HV, і до RJ запис не дійде.

**16.7.** Сценарій 1: лід нема в **All Leads**, він у `Leads in Review` зі статусом
`Pending for Review`; у черзі User B з процесом `WF_General_Screening`, у User C — нема; User B
отримав лист про подачу; після погодження всіх чотирьох полів (кожне — своєю іконкою біля значення)
лід одразу в **All Leads**, надійшло сповіщення про завершення. Сценарій 2: лід у черзі User B з
процесом `HV_Senior_Review`; після рішень по всіх чотирьох полях FIELD SET (**Annual Revenue** —
Reject, решта — Approve) з'являється вікно **"Record is going to be rejected"**, де і обирається
причина `Revenue Data Unverifiable`; статус `Rejected`, лист про відхилення надійшов, у **All
Leads** ліда нема.

**16.8.** Сценарій 3: лід у черзі адміністратора з процесом `RJ_Resubmission_Review`; після двох
погоджених полів запис досі на рев'ю, статус — той, що показав тріал (за довідкою очікувано
`Review in Progress`); рішення по третьому, останньому полю (**Company** — Reject) відкриває вікно
**"Record is going to be rejected"**, де обирається причина, і лише тоді запис стає `Rejected`.
Сценарій 4: **More → Review History** показує вікно **"Review History — Reviewed"** з датою входу,
кожним полем і рішенням по ньому — і ім'я рецензента підписане в **кожному** рядку («by ⟨ім'я⟩»), не
лише в Timeline. Якщо в тебе інакше — це і є розбіжність, кейс FAIL, в **Actual Result** обидва
факти, у звіті про дефекти — різниця з тим, що описано тут. Не пиши «рецензент десь є» — покажи
скриншотом, де саме.

**16.9.** Лід `RV5-Order` (`Web Download`, `150000`, `Germany`): у черзі — процес
`WF_General_Screening`, рецензент User C через Others; у черзі User B нема, процес HV до нього
не застосувався. Після погодження всіх полів під User C лід з'явився в **All Leads** — отже, він
пройшов один процес і в HV не пішов.

**16.10.**
1. Якби `HV_Senior_Review` стояв першим (створений раніше за `WF_General_Screening`), лід під нього
   підходить (Annual Revenue `150000` > `100000`) раніше, ніж продукт встигне перевірити WF: піде в
   `HV_Senior_Review`, а там `Web Download` — не Cold Call і не Advertisement, отже Others →
   адміністратор. До `WF_General_Screening` лід узагалі не дійде.
2. Лід піде у WF, але `USA` — не `United States`: спрацює Others → User C.
3. Нічого: рев'ю не реагує на редагування.
4. `HV_Senior_Review`, Rule 2 → User C.
5. Жоден процес не підходить: лід одразу в **All Leads**.
6. Запис вийде з рев'ю: адміністратор може переглядати будь-які записи. Маршрут до User B цим не
   доведено — тому тести й роблять від імені рецензентів.

**16.11.**
- `>= 100000` замість «більше» — лід рівно з `100000` помилково піде на рев'ю.
- Нема Rule 2 (`Advertisement` → User C) і нема Others → User A.
- «Records outside rules are skipped anyway» — так працює погодження, а не рев'ю: у рев'ю саме
  Others призначає рецензента решті записів; довідка прямо каже, що він існує, щоб перевірено було
  кожен запис.
- У WF увімкнене сповіщення на відхилення, якого документ не просить; зник негативний кейс.
- Порядок не змінено: сценарій 5 дасть HV, а не WF.
- Дані для RJ з `Web Download` потраплять у WF.
- Рев'ю під адміністратором не доводить маршрутизацію.

**16.12.** Склад здачі:
- Writer, `A18 Test Scenarios`: п'ять сценаріїв у форматі прикладу з розділу «Як це тестувати»,
  плюс додаткові кейси RV-6…RV-12, які ти виконав;
- Sheet, `A18 Test Cases`: **TC ID | Scenario | Preconditions | Test Data | Steps | Expected Result
  | Actual Result | Status | Evidence**, по рядку на кейс;
- Writer, `A18 Defect Report` — якщо є FAIL (наприклад, поле очікуваного за довідкою типу не
  пропонується в живому пошуку **Add Field**, хоча за списком типів мало б підійти);
- скриншоти: три конфігурації процесів і список після **Reorder Processes**; черга **Workqueue → My
  Jobs → Review Process** із записами, що чекають; сторінка погодженого `RV1-Approve` і
  відхиленого `RV2-RejectRevenue`; екран **Review History**;
- одне публічне посилання в чаті ментору, перевірене з приватного вікна без входу.

---

## Ворота уроку

- [ ] пояснюєш, що таке рев'ю, де стоїть у житті запису і чому запис на ньому невидимий;
- [ ] відрізняєш рев'ю від погодження за тригером, рівнем рішення, людьми, SLA і делегуванням;
- [ ] кажеш, коли рев'ю не спрацює: редагування, інший лейаут, запис поза умовами;
- [ ] налаштовуєш процес рев'ю без підглядання: умова, поля, правила, Others, дії, причини;
- [ ] пояснюєш, навіщо Others і що буде без нього;
- [ ] знаєш порядок процесів за замовчуванням і навіщо **Reorder Processes**;
- [ ] підбираєш тестові дані так, щоб запис потрапив у задуманий процес і до задуманого рецензента;
- [ ] знаходиш запис на рев'ю: черга в **Workqueue → My Jobs → Review Process**, `Leads in Review`;
- [ ] називаєш статуси рев'ю і що їх змінює;
- [ ] відкриваєш **Review History** і знаєш, що шукати в Timeline;
- [ ] пояснюєш, чому рев'ю під адміністратором не доводить маршрут;
- [ ] три процеси налаштовані, п'ять сценаріїв виконані, документ сценаріїв, таблиця тест-кейсів,
  звіт про дефекти за потреби й скриншоти здані публічним посиланням;
- [ ] задачі 16.6, 16.10 і 16.11 розв'язані без підглядання.
