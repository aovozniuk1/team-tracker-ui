# Урок 12. SLA для issues

*Після уроку ти налаштовуєш SLA для issues у Zoho Projects: ціль у календарному чи робочому часі й
до чотирьох рівнів ескалації з листами за шаблоном — і вмієш перевірити те, що станеться через
дні, а не через секунди. Для QA це окремий клас тестів: результат настає в майбутньому, залежить
від робочого календаря й порядку SLA, а «лист не прийшов» має з півдесятка можливих причин.*

---

## 12.1. SLA: обіцянка з годинником

SLA (Service Level Agreement) — домовленість про те, як швидко команда закриває issue. У Zoho
Projects це правило з трьох частин:

- **які issues** воно охоплює (умови);
- **яка ціль у часі** («закрити до…»);
- **що робити**, коли ціль під загрозою чи зірвана (рівні ескалації: листи, дії, адресати).

SLA застосовується до issue автоматично, щойно той відповідає умовам. Документ пояснює, навіщо це
бізнесу: і команда, і клієнт знають, як швидко реагують на проблему; ескалації йдуть самі —
повідомити людей, змінити статуси, підняти питання на керівництво; видно, які issues наближаються
до порушення.

Не плутай SLA із сусідами:

| механізм | що це | коли діє |
|---|---|---|
| **business rule** | реакція на подію: issue створили чи змінили → оновити поля | одразу при збереженні |
| **SLA** | ціль у часі + ескалації для всіх відповідних issues | коли настає час рівня |
| поле **Due Date** | дата, яку людина ставить конкретному issue | само нічого не робить |
| **Reminder** | нагадування на конкретному issue: за Due Date або на дату | у заданий момент |

SLA — це політика для цілого класу issues. Due Date і Reminder — налаштування одного issue.

**Де живе.** **Setup → Issue Tracker → SLA** (шестерня Setup у верхньому правому куті). Як і
business rules, SLA налаштовуються на рівні проєкту: сторінка починається з поля **Select
Project**, і SLA проєкту A не діє на issues проєкту B. Кнопка створення — **Create an SLA**
(довідка Zoho ще називає її «Create SLA»).

## 12.2. Майстер SLA: Create → Add targets → Escalate

Майстер має три кроки: **1 Create**, **2 Add targets**, **3 Escalate**.

### Крок Create

| поле | що вказуєш |
|---|---|
| **Name** | назва SLA |
| **Execute On** | коли SLA перевіряє, чи застосуватися до issue: `Creation`, `Updation`, `Creation or Updation`, `Field Update` |

У списку ці варіанти можуть мати префікс `Issues` (`Issues Creation or Updation`), як у business
rules. Далі — кнопка **Add targets for this SLA**.

`Creation or Updation` важливий для реального процесу: баг часто створюють як `Major`, а через
годину піднімають до `Critical`. SLA тільки на `Creation` такого бага не охопить.

### Крок Add targets

**Умови** — які issues потрапляють під SLA. Документ згадує поля Severity, Modified Date, Release
Phase; довідка — ще Last Closed Date. Умов може бути кілька (продукт дозволяє до 10).

**Ціль** складається з кількох налаштувань:

| налаштування | що означає |
|---|---|
| **Target Action**: **Close Before** / **Resolve Before** | що вважається виконанням цілі: закрити або «розв'язати» issue |
| **Target Field** | поле-дата, до якого прив'язана ціль |
| **Target Time** | скільки часу дається |
| **Calendar Hours** / **Project Business Hours** | яким годинником рахувати: цілодобово чи лише в робочий час проєкту |

У тріалі (26.09.2026) перемикач підписаний саме **Calendar Hours** / **Project Business Hours** (зі
словом Project — це робочий календар, прив'язаний до проєкту; сам проєкт показує свій календар у
Project Information → Business Hours). **Target Field** для обох Target Action — і Close Before, і
Resolve Before — у тріалі пропонує рівно один варіант, **Due Date**; жодного «Created Time» чи
подібного там нема. Отже ціль завжди рахується від поля Due Date самого issue, а не від часу
створення — постав Due Date заздалегідь на тестовому issue, інакше ціль порахувати нема з чого.
**Target Time** — не довільна пара «число + одиниця», а список готових варіантів: `1 hour`, `2
hours`, `4 hours`, `6 hours`, `12 hours`, `1 day` … `15 days`, і **Custom** (там уже можна вписати
своє число з одиницею).

**Close Before** ескалює, якщо issue не закрили вчасно. Кожен статус issue належить до типу Open
або Closed, тож «закрито» логічно читається як «статус типу Closed»; чи рахує SLA закриттям
будь-який статус цього типу, а не лише `Closed`, — перевір тестом.

**Resolve Before** ескалює, якщо issue не «resolved» вчасно. Для нього в **Target Field** в тріалі
з'явився той самий єдиний варіант **Due Date** (не «Projected Close Date» — такого власного поля в
тестовому layout нема; приклад документа працює, лише якщо таке поле створити самому). Що саме Zoho
вважає «resolved», довідка не пояснює. Тому в завданнях цього уроку береш **Close Before**: закриття
легко довести статусом.

### Крок Escalate

До **чотирьох рівнів** ескалації — форма прямо так і пише: «SPECIFY WHEN AND WHOM TO ESCALATE (YOU
CAN ADD UP TO 4 LEVELS IN AN SLA)»; наступний рівень додає кнопка **Add More Escalations**. Кожен
рівень:

| налаштування | що означає |
|---|---|
| **Escalate on** | рівно три варіанти: **On Time**, **Before**, **After** |
| **Duration** (лише при Before/After) | готовий список: `30 minutes`, `1 hour`, `2/4/6/12/24 hours`, `2/3/4/5 days`, `1 Week`, `2 Weeks`, **Custom** (своє число, Hours або Days) |
| **Escalate to** | чекбокси **Project Owner**, **Assignee**, **Reporter**, **Followers** + окреме поле «Escalate to the following Project/Client Users» |
| **Email Template** | наявний шаблон або **Create new email template** тут же (відкриває форму Name/Subject/Insert Placeholder/текст; після Save шаблон одразу підставляється в поле) |
| дії | до 10 дій, кожна — рядок «поле = значення» |

**Пастка з Duration, перевірена на практиці.** У списку Duration нема простого варіанту «1 день»: після
`12 hours` одразу йде `24 hours`, а «1 day» серед готових значень відсутній — наступний крок угору вже
`2 days`. Якщо треба рівно «за 1 день до цілі», бери **Custom** і впиши `1` `Days` — вибір `24 hours`
при Business Hours дасть зовсім інший момент (розділ 12.4).

Рівень «Before» — це попередження, рівень «After» — ескалація вже простроченої цілі, «On Time» —
рівно в момент цілі. Зберігаєш кнопкою **Save**.

**Важливо: пустий рядок дії блокує збереження без жодної помилки.** Якщо в «Actions on Escalation»
лишити рядок `-Select- = ` незаповненим (типове значення за замовчуванням), **Save** не спрацює — ні
переходу далі, ні тексту помилки не буде. Перед збереженням прибери порожній рядок кнопкою «−» поруч
із ним (або заповни його) — перевірено двічі, обидва рази це й було причиною «Save нічого не робить».

**Escalate to через User PickList.** Довідка дозволяє обрати адресатів і «з розділу User
PickList», підказка в продукті — «any user in the User PickList». Найімовірніше, так ескалюють не
одній фіксованій людині, а тому, хто вказаний у полі issue типу User Pick List (наприклад, власне
поле `QA Manager` у layout issue). Як це виглядає в редакторі, у тріалі не перевірялось — якщо
знадобиться, перевір на тестовому issue.

## 12.3. Умови й порядок: одна SLA на issue

Довідка формулює головне правило так: issue відстежується за **першою** SLA у списку, під умови
якої він підходить. Підказка в самому продукті каже те саме: «When there are multiple SLAs, the
first SLA which matches the criteria is executed». Тобто:

- на issue діє щонайбільше одна SLA;
- якщо умови двох SLA перетинаються, нижня для спільних issues **не діє ніколи**;
- порядок змінюєш перетягуванням і фіксуєш **Save Order**;
- **Activate / Deactivate** вмикає і вимикає SLA без видалення; **Edit** і **Delete** — у тому
  самому списку.

Специфічніша SLA — вище, загальніша — нижче. Інакше загальна «з'їсть» усі issues.

### Стабільні й мінливі поля

Документ радить будувати SLA на умовах, які зазвичай не змінюються протягом життя issue: Title,
Reporter, Module. Довідка каже ще прямолінійніше: хороша SLA спирається на сталі параметри (Title,
Reporter, Module, дата подання), а **Status, Severity, Is it Reproducible — змінюються**.

Обидва завдання цього уроку будують SLA саме на **Severity**. Це не заборона, а ризик, і його
треба протестувати: що буде з ціллю й ескалаціями, коли Severity підняли чи знизили вже після того,
як SLA застосувалась. Ні документ, ні довідка відповіді не дають.

## 12.4. Час: Calendar і Business hours

**Calendar** — цілодобовий годинник: 2 дні = 48 годин, вихідні рахуються.

**Business hours** — лише робочий час за робочим календарем порталу: **Setup → Portal Configuration
→ Business Calendar**. Там задаються робочі години на кожен день і перерви, списки свят, а на
вкладці Date & Time Settings — робочі дні й вихідні (так описує довідка). План Enterprise дозволяє
до трьох робочих календарів. У тріалі (26.09.2026) розклад за замовчуванням називався
`Standard Business Hours`, з режимом «Same hours every day»: за графіком у редакторі — Пн–Пт
приблизно 09:00–18:00, Сб і Нд без робочих годин. Часовий пояс порталу — **Europe/Kyiv** (видно в
**Setup → Portal Configuration → Configuration**, поле Time Zone). Кожен проєкт показує свій
календар у власній картці (Project Information → Business Hours) — у тестового проєкту це той самий
`Standard Business Hours`. Яким саме календарем користується SLA, коли їх кілька, довідка не каже.

Перш ніж рахувати цілі, відкрий Business Calendar і **запиши робочі дні й години**. Від них
залежить кожна дата в твоїх тестах.

### Приклад розрахунку

Припустимо, робочий календар такий: понеділок–п'ятниця, 09:00–17:00, свят немає. Вважаємо, що
робочий день — 8 робочих годин, тож «2 Business Days» = 16 робочих годин. Ціль «закрити за 2 дні»:

| issue створено | **Calendar** (48 год) | **Business hours** (16 роб. год) |
|---|---|---|
| середа 10:00 | п'ятниця 10:00 | п'ятниця 10:00 |
| середа 19:00 | п'ятниця 19:00 | п'ятниця 17:00 |
| п'ятниця 15:00 | неділя 15:00 | вівторок 15:00 |
| субота 11:00 | понеділок 11:00 | вівторок 17:00 |

Як читати другий рядок: о 19:00 робочий день уже скінчився, відлік починається в четвер о 09:00,
четвер — 8 годин, п'ятниця — ще 8, ціль — п'ятниця 17:00. Третій рядок: п'ятниця дає 2 години,
понеділок — 8, вівторок з 09:00 до 15:00 — ще 6.

Це модель, а не опис продукту: як Zoho рахує залишок дня і межу «рівно о 17:00», документ не
визначає. Твій тест порівнює модель з тим, що показав issue, і записує факт.

### «За 1 день до цілі»

Рівень «1 Day before» теж можна рахувати по-різному. Ціль — понеділок 10:00:

| як рахувати «1 день до» | момент рівня |
|---|---|
| 1 робочий день = 8 робочих годин | п'ятниця 10:00 |
| 24 календарні години | неділя 10:00 |
| 24 **робочі** години | середа 10:00 — три робочі дні до цілі |

Третій рядок — пастка. Якщо задати рівень як «24 години до цілі» і годинник робочий, попередження
прийде в момент створення issue з ціллю через 3 дні. Тому одиницю рівня обирай «дні», якщо вона є,
і перевір показаний час рівня.

Ще дві дрібниці, які ламають розрахунки: часовий пояс (запиши, у якому поясі портал показує час
тобі і в якому працює робочий календар) і формат дат (у тріалі — `dd-MM-yyyy`, тож `05-10-2026` —
це 5 жовтня; сам формат задається в Business Calendar на вкладці Date & Time Settings).

## 12.5. Де видно SLA і ескалації

| де | що там | джерело |
|---|---|---|
| список issues | кольорова позначка ескалації біля issue; колір — рівень | довідка |
| сторінка issue | іконка рівня ескалації | довідка |
| вид **Escalated Issues** у списку issues | усі ескальовані issues за вибраними рівнями | довідка |
| **Feed** проєкту і сповіщення (**Notifications**) | запис про ескалацію, коли SLA порушена або близька до порушення | документ + довідка |
| пошта адресатів рівня | лист за шаблоном рівня | документ |
| **Reports** проєкту → звіт про ескалації по власниках (у довідці — Issue Owner Escalation Report, у продукті назва на кшталт «Escalation by Assignee») | скільки ескалацій у кожного власника | довідка (Premium, Enterprise) |

Для тестів це означає: доказ ескалації — не лише лист. Лист може загубитися в спамі чи прийти не
тому, а позначка на issue і вид **Escalated Issues** покажуть, що рівень спрацював.

## 12.6. Шаблони листів для ескалацій

Шаблони для issues створюються в **Setup → Issue Tracker → Email Templates**: обираєш проєкт →
кнопка створення (на кшталт **Create an Email Template**; довідка називає її «Add Email Template»).
Що каже довідка:

- **Name** і **Subject** обов'язкові; Subject стає темою листа, текст редактора — тілом;
- **Insert Placeholder** вставляє дані issue: ключ, назву, Assignee, **Escalation Level** тощо —
  у тему й у текст;
- у листах ескалації SLA плейсхолдер Action Performer підставляється іменем власника проєкту;
- якщо шаблон, прив'язаний до SLA, видалити — піде стандартний шаблон;
- шаблони для issues — функція плану Enterprise.

Шаблон можна створити і прямо з кроку **Escalate** («choose an existing Email Template or create a
new one»).

**Кожному рівню — своя тема.** Коли всі листи тестів падають в одну-дві скриньки, тільки тема
скаже, який рівень якої SLA прийшов. Шаблони для завдань цього уроку:

| шаблон (Name) | Subject | зміст |
|---|---|---|
| `SLA Critical – breach` | `[SLA breach] ` + ключ + назва issue | Critical issue не закрито за 2 робочі дні; рівень ескалації |
| `SLA Show stopper – L1` | `[SLA L1] ` + ключ + назва issue | до цілі лишився 1 день |
| `SLA Show stopper – L2` | `[SLA L2] ` + ключ + назва issue | ціль настала, issue відкритий |

## 12.7. Покроково: Assignment 3 — Critical Bug SLA

**Що вимагає документ.** **Setup → Issue Tracker → SLA**, свій проєкт, **Create an SLA**; Name
`Critical Bug SLA`; Execute On `Creation or Updation`; у **Add targets for this SLA** — Severity =
`Critical`; ціль **Close Before** або **Resolve Before** з лімітом, наприклад 2 Business Days;
один чи кілька рівнів ескалації (наприклад, ескалація менеджеру, якщо не закрито до строку); Email
Template, щоб сповістити потрібних людей. Тест: створити Critical-баг, лишити відкритим і після
строку перевірити сповіщення чи листи ескалації. Очікування: Critical-баги, не закриті за 2 робочі
дні, запускають ескалацію і сповіщення. Здати: тест-сценарії, чек-лист, відео і розділ фінального
звіту.

### Крок 0. Підготовка

1. **Робочий календар.** **Setup → Portal Configuration → Business Calendar** — запиши робочі дні,
   години і часовий пояс.
2. **Люди.** Assignee тестових issues — User B, «менеджер» — User C; обидва мають бути в проєкті і
   з доступом до пошти. Якщо когось немає: людину додають у Zoho One (**Admin Panel → User
   Management → Users → Add User**), а в Projects — **Users → Portal Users → Invite User** з
   вибором проєкту (так описує довідка; у тріалі цей шлях не перевірявся). Без User C менеджером
   буде Project Owner, тобто ти.
3. **Шаблон.** `SLA Critical – breach` (розділ 12.6).
4. **Чистий список.** **Setup → Issue Tracker → SLA** → свій проєкт: переконайся, що немає іншої
   активної SLA, яка вище в списку ловить Critical-баги, — інакше твоя не застосується.

### Крок 1. Create

**Setup → Issue Tracker → SLA** → **Select Project** → **Create an SLA**.

| поле | значення |
|---|---|
| **Name** | `Critical Bug SLA` |
| **Execute On** | `Creation or Updation` |

→ **Add targets for this SLA**.

### Крок 2. Add targets

| налаштування | значення |
|---|---|
| умова | **Severity** · рівність · `Critical` |
| **Target Action** | **Close Before** |
| **Target Field** | час створення issue, якщо він є у списку (у Standard layout поле зветься `Created Time`); запиши, що обрав |
| **Target Time** | `2`, одиниця — дні |
| годинник | **Business hours** |

### Крок 3. Escalate

| налаштування | значення |
|---|---|
| **Escalate on** | у момент цілі (варіант на кшталт **On Time** або нульовий зсув), інакше найменший зсув після цілі (наприклад, 1 година після) |
| **Escalate to** | User C (менеджер) |
| **Email Template** | `SLA Critical – breach` |

За бажанням додай ще один рівень **перед** ціллю (наприклад, за 2 години до неї) на Assignee зі
своїм шаблоном-попередженням. Документ дозволяє «one or more» рівнів.

Натисни **Save**.

**Що побачиш:** `Critical Bug SLA` у списку SLA проєкту. Перевір, що вона активна і стоїть у
списку там, де треба.

### Крок 4. Перевірка документа

Спершу вибери день: з Business hours і ціллю в 2 дні issue, створений у понеділок чи вівторок
зранку, дасть ціль у середу чи четвер того ж тижня. Issue, створений у п'ятницю, чекатиме через
вихідні.

1. Створи `SLA3-01 Checkout crashes on submit`: **Severity** = `Critical`, **Assignee** = User B.
   Запиши час створення до хвилини.
2. Відкрий issue і список issues.

   **Очікування:** за документом, ціль і рівні ескалації SLA видно у списку issues і на сторінці
   issue. Запиши, що саме показано одразу після створення (позначка, ціль, час рівнів), і порівняй
   ціль з власним розрахунком.
3. Не редагуй і не закривай `SLA3-01` до кінця тесту: правка може змусити SLA переоцінити issue.
4. Після моменту рівня перевір: лист у скриньці User C з темою `[SLA breach] …`; запис у **Feed**
   проєкту; `SLA3-01` у виді **Escalated Issues**; колір позначки в списку.
5. Контроль без SLA: `SLA3-02 Typo on settings page` з **Severity** = `Major` — позначки SLA
   немає, листів немає.
6. Контроль закриття: `SLA3-03 Fixed in time` з **Severity** = `Critical` закрий задовго до цілі —
   ескалацій і листів немає.

Що легко відкотити: SLA редагується, вимикається (**Deactivate**) і видаляється; тестові issues йдуть
у кошик. Що дорого: тест на дні — якщо змінив SLA чи issue посеред очікування, чекати доведеться
знову.

## 12.8. Покроково: Assignment 4 — High-Priority Multi-Escalation

**Що вимагає документ.** Нова SLA `High-Priority Multi-Escalation`; Execute On `Creation or
Updation`; умова, наприклад, Severity = `Show stopper` (поля Priority в issue немає); ціль —
закрити або розв'язати за 3 Business Days; рівні: **Level 1** — за 1 день до строку, сповіщає
Assignee; **Level 2** — у день строку, сповіщає власника проєкту. Тест: створити Show stopper issue,
лишити відкритим і стежити за сповіщеннями, коли наближається кожен рівень. Очікування: система
ескалює крок за кроком — спершу на Assignee, потім на керівництво, якщо issue досі не закрито. Здати
те саме: сценарії, чек-лист, відео, розділ звіту.

«Due date» у цьому завданні — **ціль SLA**, а не поле **Due Date** issue. Щоб це довести, у тесті
можна поставити Due Date далеко в майбутнє: ціль SLA від нього не залежить, якщо Target Field —
час створення.

### Крок 0. Підготовка

1. Шаблони `SLA Show stopper – L1` і `SLA Show stopper – L2` (розділ 12.6).
2. Assignee тестових issues — User B; **Project Owner** — ти. Перевір власника проєкту в даних
   проєкту (поле Owner). Два різні адресати — єдиний спосіб довести «спершу Assignee, потім
   керівництво» не лише темою листа.
3. Робочий календар уже записаний (розділ 12.7, крок 0).

### Налаштування

**Setup → Issue Tracker → SLA** → **Select Project** → **Create an SLA**.

| крок | налаштування | значення |
|---|---|---|
| Create | **Name** | `High-Priority Multi-Escalation` |
| Create | **Execute On** | `Creation or Updation` |
| Add targets | умова | **Severity** · рівність · `Show stopper` |
| Add targets | **Target Action** | **Close Before** |
| Add targets | **Target Field** | те саме поле часу створення, що й у `Critical Bug SLA` |
| Add targets | **Target Time** | `3`, одиниця — дні |
| Add targets | годинник | **Business hours** |
| Escalate | Level 1: **Escalate on** | 1 день **до** цілі (варіант на кшталт **Before**; одиниця — дні, якщо є) |
| Escalate | Level 1: **Escalate to** | **Assignee** |
| Escalate | Level 1: **Email Template** | `SLA Show stopper – L1` |
| Escalate | Level 2: **Escalate on** | у момент цілі (варіант на кшталт **On Time** або нульовий зсув) |
| Escalate | Level 2: **Escalate to** | **Project Owner** |
| Escalate | Level 2: **Email Template** | `SLA Show stopper – L2` |

**Перевірено наживо (27.09.2026).** Варіант «у момент цілі» в списку **Escalate on** справді є —
називається **On Time**, окремого зсуву ставити не треба. А от у списку **Duration** для **Before**
пункту «1 day» немає: після `24 hours` одразу йде `2 days`. Щоб рівень спрацював за добу до цілі,
бери `24 hours` (або **Custom**, якщо потрібна інша одиниця) — і все одно звіряй показаний час
Level 1 з часом створення issue, а не покладайся на назву пункту.

Рядок **Actions on Escalation** виглядає необов'язковим (підпис «до 10 дій»), але лишити його на
`-Select-` не можна: **Save** тоді мовчки не спрацьовує, лише на мить з'являється toast «Please
select an action», який легко пропустити. Обери будь-яке поле й значення для кожного рівня —
інакше не збережеться вся SLA, а не тільки цей рівень.

Кнопка **Add More Escalations** справді розкриває повний **Level 2** з тим самим набором полів, що
й Level 1 — це стабільно спрацьовує і одразу при створенні SLA, і в режимі **Edit**. Але є пастка:
якщо додати Level 2 через **Edit** до вже збереженої SLA, яка досі мала лише Level 1, і натиснути
**Save** — запит повертає успіх, проте новий рівень не зберігається: після повторного відкриття
видно знову тільки Level 1 (відтворено двічі). Тому обидва рівні надійніше задавати одразу під час
первинного створення SLA, а не дописувати другий рівень пізніше окремим **Edit**.

Натисни **Save**.

**Що побачиш:** SLA у списку поруч із `Critical Bug SLA`. Їхні умови не перетинаються (`Critical` і
`Show stopper` — різні значення), тож порядок між ними тут ні на що не впливає.

### Перевірка

1. У понеділок зранку створи `SLA4-01 Payment page returns 500`: **Severity** = `Show stopper`,
   **Assignee** = User B. Запиши час створення.

   **Очікування:** за документом, на сторінці issue видно ціль і рівні ескалації. За прикладом
   календаря з розділу 12.4 (Пн–Пт, 09:00–17:00) issue від понеділка 10:00 має ціль у четвер о
   10:00, Level 1 — у середу о 10:00, Level 2 — у четвер о 10:00. Порівняй зі своїм календарем.
2. Не чіпай issue. У момент Level 1 перевір скриньку User B (`[SLA L1] …`), **Feed**, позначку в
   списку.
3. У момент Level 2 перевір свою скриньку (`[SLA L2] …`), **Feed**, вид **Escalated Issues**,
   зміну кольору позначки.
4. Порядок: лист L1 прийшов раніше за L2, і кожен — своєму адресатові.
5. Контроль «закрито між рівнями»: `SLA4-02 Closed between levels`, `Show stopper`, закрий після
   листа L1, але до цілі — листа L2 бути не повинно.
6. Необов'язково: issue, створений у середу, розведе робочий і календарний «день до» (п'ятниця
   проти неділі, розділ 12.4) — побачиш, як продукт трактує «1 Day before».

**Помітка для звіту.** `Show stopper` — найвища severity, але в цих двох завданнях вона отримує
3 робочі дні, а `Critical` — 2. Найгірші баги мають більше часу, ніж просто критичні. Це варто
винести в Recommendations: зазвичай найсуворіша ціль у найвищої severity.

## 12.9. Як це тестувати

### Тест, що триває дні

Ціль у 2–3 робочі дні означає, що буквальний тест документа займає пів тижня. Щоб не чекати
всліпу, розведи два шари:

1. **Буквальна SLA** — рівно як у документі (дні, Business hours). На ній доводиш: ціль пораховано
   правильно, і в свій час рівні справді спрацювали.
2. **Швидка тестова SLA** — та сама механіка в годинах, щоб побачити рівні, адресатів і шаблони
   того ж дня. Наприклад, `Critical Bug SLA – fast test`:

   | налаштування | значення |
   |---|---|
   | умови | Severity = `Critical` **AND** Module = `SLA Fast` |
   | ціль | **Close Before**, 2 години, **Calendar** |
   | Level 1 | 1 година до цілі → **Assignee** |
   | Level 2 | 1 година після цілі → User C |

   Постав її **вище** за `Critical Bug SLA` і натисни **Save Order**. Спрацює правило першого збігу:
   Critical-баги з модулем `SLA Fast` (додай такий модуль у проєкт) потраплять у швидку SLA, усі
   інші — у буквальну. Module документ і довідка наводять як стале поле для умов SLA; якщо серед
   полів умови його не буде, візьми інше стале поле зі списку і так само познач ним тестові
   issues. Годинник **Calendar**, щоб швидкий тест не «переїхав» на завтра через кінець робочого
   дня. Після тестів — **Deactivate**, і у звіті назви її допоміжною.

Правила на час очікування:

- записуй час створення кожного тестового issue до хвилини — усі очікування рахуються від нього;
- не редагуй тестові issues і не перезберігай SLA, поки чекаєш: чи переоцінюється ціль після
  правки, невідомо, і тест стане нечитабельним;
- точність планувальника SLA ніде не описана — записуй фактичну затримку листа відносно
  розрахункового часу;
- тріал обмежений у часі: тести на дні запускай на початку робочого тижня і якомога раніше.

### Що доводиш

Для кожної SLA:

1. **застосовується до правильних issues:** потрібна severity — так; інші severity — ні; інший
   проєкт — ні;
2. **ціль пораховано правильно:** Calendar чи Business hours, вихідні, створення після робочого дня;
3. **рівні спрацьовують** у свій час, у правильному порядку, правильним адресатам, з правильним
   шаблоном;
4. **немає ескалації, коли issue закрили вчасно;**
5. **поведінка при змінах записана:** severity підняли чи знизили, змінили Assignee, закрили і
   перевідкрили, перемістили в кошик;
6. **порядок і перемикач:** перша SLA в списку перехоплює issue; вимкнена SLA не діє.

### Негативи й межі

| випадок | очікування | звідки |
|---|---|---|
| issue `Major` для `Critical Bug SLA` | SLA немає | умова |
| issue `Show stopper` для `Critical Bug SLA` | `Critical Bug SLA` не застосовується: `Show stopper` — інше значення, не «Critical і вище» | умова рівності |
| issue в іншому проєкті | SLA немає | SLA на рівні проєкту |
| `Major` → `Critical` через день після створення | SLA застосовується; від чого рахується ціль — з'ясуй: якщо від створення, ціль може бути вже близько або в минулому | Execute On + Target Field |
| `Critical` → `Major` після застосування SLA | з'ясуй: ціль знімається чи ескалації тривають | довідка лише попереджає, що Severity мінлива |
| Assignee порожній у момент Level 1 | з'ясуй, чи йде лист комусь | не описано |
| Assignee змінили до Level 1 | з'ясуй, чи отримує лист новий Assignee | не описано |
| закрили до цілі | ескалацій немає | Close Before |
| закрили між Level 1 і Level 2 | Level 2 не приходить | Close Before |
| закрили статусом типу Closed, відмінним від `Closed` | з'ясуй, чи вважається закриттям | тип статусу |
| закрили і перевідкрили | з'ясуй: стара ціль, нова ціль чи без SLA | не описано |
| issue в кошику | очікувано без листів — перевір | не описано |
| SLA вимкнули, поки ціль чекала | з'ясуй, чи приходять листи | не описано |

Рядки «з'ясуй» — не помилки постановки. Це саме те, чого команда не знає і що знайде тільки
тест. Кожен такий факт іде у звіт.

### Докази

- скріншоти трьох кроків SLA, списку SLA з порядком і станом (активна/неактивна);
- записаний робочий календар порталу;
- таблиця «issue — час створення — розрахована ціль — показана ціль — час рівнів»;
- листи з видимим часом отримання, темою й адресатом;
- **Feed**, вид **Escalated Issues**, позначка в списку до і після рівня;
- для контрольних issues — ті самі місця, де ескалації немає.

### Тест-сценарій у форматі документа

Формат документа: Title, Precondition, Steps, Expected Result, Actual Result, Pass/Fail,
Notes/Attachments. Сценарії для здачі пишуться англійською:

**Scenario 1**
- Title: Open Critical issue is escalated to the manager after the 2-business-day target
- Precondition:
   - SLA "Critical Bug SLA" is active in project "QA Training Project – [Your Name]": Execute On =
     Creation or Updation; target: Severity = Critical; Close Before, 2 days, Business hours;
     escalation level at the target → User C, template "SLA Critical – breach".
   - Portal business hours are recorded in the test data.
   - No other active SLA above it matches Critical issues.
- Steps:
   1. On a working-day morning create issue "SLA3-01 Checkout crashes on submit": Severity =
      Critical, Assignee = User B. Record the creation time.
   2. Open the issue and record the SLA target shown.
   3. Do not edit or close the issue.
   4. After the escalation time, check User C's mailbox, the project Feed, the Escalated Issues
      view and the escalation mark in the list.
- Expected Result:
   1. The SLA is applied on creation; the target = creation time + 2 business days.
   2. Nothing is escalated before the target.
   3. After the target: User C receives an email with subject `[SLA breach] <key> <title>`;
      the escalation appears in Feed; the issue is listed in Escalated Issues.
- Actual Result: [what really happened, with times]
- Pass/Fail: [Pass / Fail]
- Notes/Attachments: target calculation, screenshots of the issue, email, Feed, Escalated Issues.

### Чек-лист

| Checklist Item | Completed (Y/N) | Notes |
|---|---|---|
| "Critical Bug SLA" is in the correct project, active, in the right order | | screenshot of the SLA list |
| Execute On = Creation or Updation | | |
| Target: Severity = Critical; Close Before; 2 days; Business hours | | |
| Escalation level after the target → manager, template "SLA Critical – breach" | | |
| Target shown on a new Critical issue matches the calculation | | business hours recorded |
| Major issue gets no SLA | | |
| Open Critical issue escalates after the target; email received | | time of the email |
| Critical issue closed before the target is not escalated | | |
| "High-Priority Multi-Escalation": Level 1 to Assignee one day before the target | | |
| Level 2 to Project Owner at the target, after Level 1 | | |
| Show stopper issue closed between levels gets no Level 2 | | |
| Helper "fast test" SLA is deactivated before hand-in | | |

### Відео (3–5 хвилин на SLA)

Ескалації настають через дні, тож відео монтується з того, що зібрано:

1. Конфігурація: **Setup → Issue Tracker → SLA**, вибраний проєкт, SLA відкрита на всіх трьох
   кроках; робочий календар.
2. Тестовий issue: час створення і показана ціль.
3. Негатив: issue з іншою severity — без SLA; закритий вчасно — без ескалації.
4. Ескалація: листи в скриньках з часом отримання, **Feed**, **Escalated Issues**; для
   Assignment 4 — два листи, два адресати, правильний порядок.
5. Якщо буквальна ескалація ще не настала на момент запису — покажи швидку SLA наживо, а буквальну
   допиши до відео, коли вона спрацює.

### Розділ фінального звіту

```
SLA (Issue Tracker, project "QA Training Project – [Your Name]")
Business hours: [days and hours from Business Calendar], time zone [ ].
- Critical Bug SLA: Pass. Target shown = creation + 2 business days (weekend skipped).
  Open Critical issue escalated to User C at [time]; email, Feed and Escalated Issues confirmed.
  Major issues get no SLA; a Critical issue closed in time was not escalated.
- High-Priority Multi-Escalation: Pass. Level 1 email to the Assignee at [time],
  Level 2 email to the Project Owner at [time]; the issue closed between levels got no Level 2.
Issues/Discrepancies: [e.g. email delay of N minutes; behaviour after a severity change].
Recommendations: Show stopper issues get 3 business days while Critical get 2 — consider
a stricter target for Show stopper; SLAs rely on Severity, which changes during the issue's
life — agree what should happen after a downgrade.
```

## 12.10. Типові помилки

**1. Не той проєкт.** SLA створена для іншого проєкту в **Select Project** — issues її не бачать.

**2. Дві SLA з перетином умов.** Нижня для спільних issues не діє ніколи: спрацьовує перша в списку.

**3. Calendar замість Business hours** (або навпаки). Ціль з'їжджає на вихідні чи на кілька днів.

**4. «1 день до» заданий годинами.** При 8-годинному робочому дні 24 робочі години — це три робочі
дні; для цілі в 3 дні попередження приходить одразу.

**5. Due Date вважаєш ціллю SLA.** Поле Due Date — окрема річ; ціль SLA рахується за Target Field і
Target Time.

**6. Усі листи одній людині з однаковою темою.** Assignee = Project Owner = ти, шаблони з однаковим
Subject — і вже не довести, який рівень кому пішов.

**7. Тестовий issue створено в п'ятницю ввечері.** Тест чекатиме через вихідні.

**8. Правка тестового issue посеред очікування.** Невідомо, чи переоцінить SLA ціль — тест стає
нечитабельним.

**9. Швидка тестова SLA лишилась увімкненою.** У звіті й у проєкті висить зайве правило, яке
перехоплює issues.

**10. SLA на Severity без тесту зміни severity.** Саме Severity, за довідкою, змінюється протягом
життя issue — і саме цей випадок ніхто, крім тебе, не перевірить.

**11. Шукаєш Priority.** В issue його немає; «high-priority» у завданні — це `Show stopper` у полі
Severity.

### Симптом → причина

| симптом | найімовірніша причина |
|---|---|
| SLA «зникла» зі списку | у **Select Project** інший проєкт |
| issue `Critical`, а SLA не застосувалась | SLA вимкнена; вище в списку інша SLA з перетином умов; issue в іншому проєкті; Execute On не покриває подію (підняли severity, а стоїть тільки `Creation`) |
| issue `Show stopper` не отримав `Critical Bug SLA` | умова — рівність, `Show stopper` ≠ `Critical` |
| ціль на день-два пізніше, ніж рахував | Business hours: вихідні, кінець робочого дня, інший робочий календар |
| ціль у вихідний | годинник **Calendar** |
| попередження прийшло одразу після створення | «1 день до» задано як 24 години в робочому часі |
| лист не прийшов, а позначка на issue змінилась | лист у спамі, в іншій скриньці або адресат — інша людина, ніж ти думаєш |
| лист не прийшов і позначка не змінилась | ще не настав час; issue закрили чи змінили severity; SLA вимкнена |
| обидва рівні прийшли одній людині | Assignee і Project Owner — одна людина |
| не зрозуміло, який рівень прийшов | однаковий Subject у шаблонах рівнів |
| лист прийшов на годину пізніше за розрахунок | затримка планувальника або часовий пояс — запиши фактичну різницю |
| закрили issue, а ескалація все одно прийшла | статус не типу Closed або закрили вже після моменту рівня |
| швидка тестова SLA чіпляється до всіх Critical | немає додаткової умови (Module = `SLA Fast`) |
| швидка тестова SLA не чіпляється взагалі | вона нижче за буквальну — буквальна перехопила issue першою |

## 12.11. Що варто запам'ятати

1. SLA = умови + ціль у часі + рівні ескалації; живе в **Setup → Issue Tracker → SLA** і
   налаштовується для проєкту через **Select Project**.
2. Три кроки майстра: **Create** (Name, Execute On) → **Add targets** (умови, Close/Resolve Before,
   Target Field, Target Time, Calendar/Business hours) → **Escalate** (Escalate on, Escalate to,
   Email Template, дії) → **Save**.
3. До чотирьох рівнів ескалації і до 10 дій.
4. На issue діє перша SLA в списку, під умови якої він підходить; порядок — **Save Order**;
   **Activate / Deactivate** без видалення.
5. Severity — мінливе поле; SLA на ньому треба тестувати на зміну severity.
6. Business hours рахуються за **Business Calendar** порталу — запиши його, перш ніж рахувати цілі.
7. «1 день до цілі» в робочому часі — не 24 години.
8. Ескалацію доводять не лише листом: позначка в списку, сторінка issue, **Escalated Issues**,
   **Feed**.
9. Кожному рівню — свій шаблон із власним Subject і, де можна, своя людина.
10. Тест на дні: буквальна SLA + швидка тестова SLA з додатковою умовою вище в списку; тестові
    issues не чіпати, поки чекаєш.

---

# Задачі

**12.1.** *(пояснити)* Менеджер питає: «Навіщо нам SLA, якщо в кожного бага є Due Date і можна
поставити Reminder? І чому б не зробити все business rule?» Поясни різницю між SLA, Due Date,
Reminder і business rule і наведи один приклад, де без SLA не обійтися.

**12.2.** *(порахувати)* Робочий календар (умовний, для задачі): понеділок–п'ятниця, 09:00–17:00,
свят немає; робочий день — 8 робочих годин.

- a) SLA «закрити за 2 дні». Для issues, створених у середу 10:00, середу 19:00, п'ятницю 15:00 і
  суботу 11:00, порахуй ціль у режимі **Calendar** і в режимі **Business hours**.
- b) SLA «закрити за 3 дні», **Business hours**, рівень «за 1 день до цілі». Для issues, створених
  у понеділок 10:00 і в середу 10:00, порахуй ціль і момент рівня трьома способами: 8 робочих
  годин до цілі, 24 календарні години до цілі, 24 робочі години до цілі. Який спосіб небезпечний і
  чому?

**12.3.** *(прогноз)* У проєкті три активні SLA в такому порядку:

| # | SLA | умови | ціль |
|---|---|---|---|
| 1 | `Critical Bug SLA – fast test` | Severity = `Critical` AND Module = `SLA Fast` | 2 години, Calendar |
| 2 | `Critical Bug SLA` | Severity = `Critical` | 2 дні, Business hours |
| 3 | `High-Priority Multi-Escalation` | Severity = `Show stopper` | 3 дні, Business hours |

Яка SLA дістанеться кожному новому issue?

- a) `Critical`, Module `SLA Fast`;
- b) `Critical`, Module `Backend`;
- c) `Show stopper`, Module `SLA Fast`;
- d) `Major`, без модуля;
- e) SLA 1 перетягнули в самий низ списку (**Save Order**), новий issue `Critical`, Module
  `SLA Fast`;
- f) повернули початковий порядок, `Critical Bug SLA` вимкнули (**Deactivate**), новий issue
  `Critical`, Module `Backend`.

**12.4.** *(знайди помилки)* Опис налаштування і тесту: «SLA `Critical Bug SLA` створена в проєкті
`Website`, тестуємо в `Mobile App`. Execute On `Creation`. Умова Severity = `Critical`. Resolve
Before, 2 дні, Calendar. Один рівень: за 1 годину до цілі → Project Owner, шаблон той самий, що в
SLA для Show stopper. Assignee тестового issue — я, власник проєкту — теж я. Тестовий issue створено
в п'ятницю о 16:00; через годину я змінив йому Severity на `Major`, щоб не заважав, і чекаю листа
про ескалацію». Знайди всі помилки й ризики.

**12.5.** *(підготовка)* Підготуй проєкт до обох SLA. Потрібно:

- записати робочий календар порталу (**Setup → Portal Configuration → Business Calendar**): робочі
  дні, години, часовий пояс;
- User B (Assignee) і User C (менеджер) у проєкті — якщо їх немає, додай людей у Zoho One (**Admin
  Panel → User Management → Users → Add User**) і запроси в портал Projects з вибором проєкту
  (**Users → Portal Users → Invite User**);
- переконатися, що власник проєкту (Project Owner) — ти;
- створити в **Setup → Issue Tracker → Email Templates** три шаблони: `SLA Critical – breach`,
  `SLA Show stopper – L1`, `SLA Show stopper – L2`, з різними Subject і плейсхолдерами ключа й
  назви issue;
- додати в проєкт модуль `SLA Fast`;
- переконатися, що в проєкті немає інших активних SLA на Critical чи Show stopper.

**12.6.** *(Assignment 3 — налаштування)* Налаштуй SLA рівно за документом: `Critical Bug SLA`,
Execute On `Creation or Updation`, умова Severity = `Critical`, **Close Before** за 2 дні в
**Business hours**, рівень ескалації на менеджера (User C), якщо issue не закрито до цілі, шаблон
`SLA Critical – breach`. Зроби скріншоти трьох кроків і списку SLA.

**12.7.** *(Assignment 3 — перевірка)* Проведи тест документа: створи Critical-баг
`SLA3-01 Checkout crashes on submit` з Assignee User B, лиши відкритим і після строку перевір
листи та сповіщення. Додай два контролі: `Major`-issue без SLA і Critical-issue, закритий до цілі.
Щоб побачити ескалацію того ж дня, збери швидку тестову SLA (Severity = `Critical` AND Module =
`SLA Fast`, 2 години Calendar, рівні за 1 годину до і через 1 годину після цілі) вище за
`Critical Bug SLA` і проведи на ній ті самі перевірки. Склади таблицю «issue — час створення —
розрахована ціль — показана ціль — фактичний час листа».

**12.8.** *(Assignment 4 — налаштування)* Налаштуй `High-Priority Multi-Escalation`: Execute On
`Creation or Updation`; умова Severity = `Show stopper`; **Close Before** за 3 дні в **Business
hours**; Level 1 — за 1 день до цілі на Assignee з шаблоном `SLA Show stopper – L1`; Level 2 — у
момент цілі на Project Owner з шаблоном `SLA Show stopper – L2`. Запиши, як редактор дозволив
задати «1 день до» і «у момент цілі».

**12.9.** *(Assignment 4 — перевірка)* У проєкті активна `High-Priority Multi-Escalation`
(Severity = `Show stopper`, Close Before за 3 дні в Business hours; Level 1 за 1 день до цілі →
Assignee; Level 2 у момент цілі → Project Owner, тобто ти). Створи Show stopper issue
`SLA4-01 Payment page returns 500` з Assignee User B, лиши відкритим і доведи: Level 1 прийшов
User B раніше, ніж Level 2 прийшов тобі; кожен лист — зі своїм шаблоном; ескалація видна в
**Feed** і в **Escalated Issues**. Контроль: `SLA4-02 Closed between levels`, закритий після
Level 1 і до цілі, не отримує Level 2.

**12.10.** *(дизайн тестів)* У проєкті дві SLA: `Critical Bug SLA` (Severity = `Critical`, 2 дні,
Business hours, ескалація менеджеру після цілі) і `High-Priority Multi-Escalation` (Severity =
`Show stopper`, 3 дні, Business hours, Level 1 на Assignee за день до цілі, Level 2 на Project
Owner у момент цілі). Склади десять сценаріїв (назва + очікування або «з'ясувати»):
застосування, негатив за severity, інший проєкт, ціль у Business hours через вихідні, порядок
рівнів, закриття між рівнями, підняття severity після створення, зниження severity після
застосування SLA, порожній Assignee, вимкнення SLA під час очікування. Два з них розпиши повністю у
форматі документа (Title, Precondition, Steps, Expected Result, Actual Result, Pass/Fail,
Notes/Attachments).

**12.11.** *(deliverables)* Збери пакет для обох завдань документа — Assignment 3 (`Critical Bug
SLA`) і Assignment 4 (`High-Priority Multi-Escalation`): тест-сценарії, чек-лист, відео і розділ
фінального звіту (Summary of Findings, Issues/Discrepancies, Recommendations). Перед здачею вимкни
швидку тестову SLA.

**12.12.** *(складніша: severity змінилась на ходу)* У проєкті активні `Critical Bug SLA`
(Severity = `Critical`, 2 дні) і `High-Priority Multi-Escalation` (Severity = `Show stopper`, 3
дні), обидві з Execute On `Creation or Updation` і Business hours; робочий календар —
понеділок–п'ятниця, 09:00–17:00. Issue створено як `Critical` у понеділок 10:00, у вівторок 10:00
його підняли до `Show stopper`. Які гіпотези про поведінку продукту тут можливі?
Спроєктуй тест, який їх розрізнить: що і коли записуєш, які докази потрібні. І окремо: що з цього
випадку варто сказати бізнесу, навіть не запускаючи тесту?

---

# Розв'язки

**12.1.**
- **Due Date** — дата на одному issue, яку ставить людина; сама по собі нічого не робить.
- **Reminder** — нагадування на одному issue (за Due Date або на конкретну дату); його теж ставлять
  руками.
- **Business rule** — реагує на подію (створили, змінили) і одразу змінює поля; про час не знає.
- **SLA** — політика для всіх issues, що підходять під умови: ставить ціль автоматично, стежить
  за часом і ескалює, коли ціль під загрозою чи зірвана.
- Приклад: «кожен Critical-баг має бути закритий за 2 робочі дні, інакше лист менеджеру». Ні Due
  Date, ні Reminder не спрацюють, якщо людина їх не поставила, а business rule не вміє чекати.

**12.2.**
a)

| створено | Calendar | Business hours |
|---|---|---|
| середа 10:00 | п'ятниця 10:00 | п'ятниця 10:00 |
| середа 19:00 | п'ятниця 19:00 | п'ятниця 17:00 |
| п'ятниця 15:00 | неділя 15:00 | вівторок 15:00 |
| субота 11:00 | понеділок 11:00 | вівторок 17:00 |

b) Ціль «3 дні» = 24 робочі години.

| створено | ціль | 8 роб. год до цілі | 24 календ. год до цілі | 24 роб. год до цілі |
|---|---|---|---|---|
| понеділок 10:00 | четвер 10:00 | середа 10:00 | середа 10:00 | понеділок 10:00 |
| середа 10:00 | понеділок 10:00 | п'ятниця 10:00 | неділя 10:00 | середа 10:00 |

Небезпечний третій спосіб: «24 години» в робочому часі — це три робочі дні, тобто весь строк.
Попередження збігається з моментом створення issue і нічого не попереджає. Другий спосіб дає
попередження у вихідний, коли його ніхто не прочитає. Для issue від понеділка всі «людські»
способи збігаються — тому для тесту трактування «1 Day before» і потрібен issue від середи.

**12.3.** За правилом першого збігу:

| | SLA | чому |
|---|---|---|
| a | 1 | підходить під 1, вона перша |
| b | 2 | під 1 не підходить (модуль), під 2 — так |
| c | 3 | під 1 не підходить (severity), під 2 теж, під 3 — так |
| d | немає | жодна умова не виконана |
| e | 2 | під 2 підходить і вона тепер вище; швидка SLA не застосується ніколи |
| f | немає | 1 не підходить (модуль), 2 вимкнена, 3 — інша severity |

Випадок e — типова пастка з допоміжною SLA: вона має стояти вище за загальну.

**12.4.**
1. SLA створена в проєкті `Website`, а тест іде в `Mobile App` — SLA на рівні проєкту.
2. Execute On `Creation` — документ вимагає `Creation or Updation`; issues, підняті до `Critical`
   пізніше, не охопить.
3. **Calendar** замість **Business hours** — документ говорить про 2 Business Days.
4. Resolve Before допустимий за документом, але що таке «resolved», ніде не визначено; для цілі
   «закрити» надійніше **Close Before**.
5. Єдиний рівень — **до** цілі і на Project Owner: це попередження, а вимога документа —
   ескалація менеджеру, якщо не закрито до строку, тобто рівень після цілі.
6. Шаблон спільний з іншою SLA — листи не розрізнити.
7. Assignee і Project Owner — одна людина: не довести, хто що отримав.
8. П'ятниця 16:00 з Calendar-ціллю в 2 дні — ціль у неділю 16:00; з Business hours очікування
   пішло б через вихідні. Невдалий день старту.
9. Зміна Severity на `Major`: issue більше не підходить під умову, і тест перестав перевіряти те,
   що мав. Що станеться з уже застосованою SLA — окреме питання, яке треба тестувати свідомо, а не
   випадково.

**12.5.** Готово, коли: календар записаний (дні, години, пояс); User B і User C є в полі Assignee
issues цього проєкту; у даних проєкту Owner — ти; три шаблони є в **Email Templates** проєкту і
мають різні Subject; модуль `SLA Fast` є в полі Module; у списку SLA проєкту немає нічого, що
перехоплює Critical чи Show stopper.

**12.6.**

| крок | налаштування | значення |
|---|---|---|
| Create | **Name** | `Critical Bug SLA` |
| Create | **Execute On** | `Creation or Updation` |
| Add targets | умова | Severity · рівність · `Critical` |
| Add targets | **Target Action** | **Close Before** |
| Add targets | **Target Field** | час створення issue (записано, як він зветься в списку) |
| Add targets | **Target Time** | 2 дні |
| Add targets | годинник | **Business hours** |
| Escalate | **Escalate on** | у момент цілі (**On Time** або нульовий зсув) або найменший зсув після неї |
| Escalate | **Escalate to** | User C |
| Escalate | **Email Template** | `SLA Critical – breach` |

SLA активна, у списку проєкту, вище за неї немає SLA з перетином умов.

**12.7.** Очікування:

| issue | SLA | що має статися |
|---|---|---|
| `SLA3-01`, `Critical` | `Critical Bug SLA` | ціль = створення + 2 робочі дні; після цілі — лист User C, **Feed**, **Escalated Issues** |
| `SLA3-02`, `Major` | немає | ні позначки, ні листів |
| `SLA3-03`, `Critical`, закритий до цілі | `Critical Bug SLA` | ескалацій немає |
| `SLA3-F1`, `Critical`, Module `SLA Fast` | швидка | через ~1 год — лист User B (Level 1), через ~3 год — лист User C (Level 2) |

Таблиця часу — головний доказ: розрахована і показана ціль мають збігтися за записаним календарем;
різниця між розрахунковим і фактичним часом листа записується як спостереження про планувальник.
Якщо показана ціль не збіглася з розрахунком — спершу перевір **Target Field** і годинник, потім
пиши розбіжність.

**12.8.**

| крок | налаштування | значення |
|---|---|---|
| Create | **Name** | `High-Priority Multi-Escalation` |
| Create | **Execute On** | `Creation or Updation` |
| Add targets | умова | Severity · рівність · `Show stopper` |
| Add targets | **Target Action** | **Close Before** |
| Add targets | **Target Field** | той самий час створення issue |
| Add targets | **Target Time** | 3 дні |
| Add targets | годинник | **Business hours** |
| Escalate | Level 1 | 1 день до цілі → **Assignee** → `SLA Show stopper – L1` |
| Escalate | Level 2 | у момент цілі → **Project Owner** → `SLA Show stopper – L2` |

У звіт: як саме задано «1 день до» (дні чи години) і чи вдалося задати Level 2 у момент цілі
(варіант на кшталт **On Time** чи нульовий зсув); якщо ні — який зсув після цілі поставлено.

**12.9.** Доведено, коли:

- на сторінці `SLA4-01` видно ціль і час обох рівнів, і вони збігаються з розрахунком;
- лист `[SLA L1] …` у скриньці User B, час — момент Level 1;
- лист `[SLA L2] …` у твоїй скриньці, час — момент Level 2, пізніше за L1;
- у **Feed** і **Escalated Issues** видно ескалацію, позначка в списку змінила колір між рівнями;
- `SLA4-02` отримав L1, а L2 — ні, бо закритий до цілі.

**12.10.** Приклад набору:

1. New Critical issue gets "Critical Bug SLA"; target = creation + 2 business days.
2. New Major issue gets no SLA.
3. Critical issue in another project gets no SLA.
4. Critical issue created on Friday afternoon: target skips the weekend.
5. Show stopper issue: Level 1 to the Assignee before Level 2 to the Project Owner.
6. Show stopper issue closed between Level 1 and Level 2 gets no Level 2.
7. Major issue raised to Critical a day later: SLA applied; record from which moment the target
   is counted.
8. Critical issue lowered to Major after the SLA is applied: record whether escalation continues.
9. Critical issue without an Assignee at Level 1 time: record who (if anyone) is notified.
10. SLA deactivated while a target is pending: record whether the escalation still fires.

Повністю, наприклад:

**Scenario 6**
- Title: Show stopper issue closed between Level 1 and Level 2 gets no Level 2 escalation
- Precondition: SLA "High-Priority Multi-Escalation" is active (Severity = Show stopper; Close
  Before 3 days, Business hours; Level 1 one day before → Assignee; Level 2 at the target →
  Project Owner).
- Steps:
   1. Create issue "SLA4-02 Closed between levels": Severity = Show stopper, Assignee = User B.
   2. Wait for the Level 1 email in User B's mailbox.
   3. Close the issue before the target time. Record the time.
   4. After the Level 2 time, check the Project Owner's mailbox, Feed and Escalated Issues.
- Expected Result: Level 1 email received; no Level 2 email; no Level 2 escalation in Feed.
- Actual Result: [ ]
- Pass/Fail: [ ]
- Notes/Attachments: screenshots of the Level 1 email, the issue history with the closing time,
  the mailbox after the Level 2 time.

**Scenario 8**
- Title: Lowering severity after the SLA is applied — escalation behaviour is recorded
- Precondition: SLA "Critical Bug SLA" is active; helper "fast test" SLA is active above it.
- Steps:
   1. Create issue "SLA3-F2 Downgrade": Severity = Critical, Module = SLA Fast, Assignee = User B.
   2. Check that the fast SLA is applied (target shown).
   3. Change Severity to Major before Level 1. Record the time.
   4. After the Level 2 time, check the issue's escalation mark, both mailboxes and Feed.
- Expected Result: to be established — record whether the SLA mark disappears and whether any
  escalation emails arrive.
- Actual Result: [ ]
- Pass/Fail: not applicable — observation; the fact goes to Issues/Discrepancies or
  Recommendations.
- Notes/Attachments: screenshots before and after the change, mailboxes.

**12.11.** Пакет готовий, коли в ньому є: сценарії з заповненими Actual і Pass/Fail (зокрема
таблиця часу для кожного тестового issue); чек-лист у форматі документа; відео (конфігурація,
ціль на issue, негатив, листи й **Escalated Issues**); розділ звіту з робочим календарем, фактами
по обох SLA, розбіжностями і рекомендаціями; швидка тестова SLA вимкнена і названа у звіті
допоміжною.

**12.12.** Можливі гіпотези:

1. **SLA не змінюється.** Issue лишається під `Critical Bug SLA` з ціллю середа 10:00.
2. **SLA перемикається, ціль від створення.** Issue переходить під `High-Priority
   Multi-Escalation`, ціль = понеділок 10:00 + 3 робочі дні = четвер 10:00.
3. **SLA перемикається, ціль від зміни.** Ціль = вівторок 10:00 + 3 робочі дні = п'ятниця 10:00.

Тест:

- до зміни: скріншот сторінки issue і списку (яка SLA, ціль, час рівнів);
- одразу після зміни: те саме — чи змінилася назва SLA, ціль, рівні;
- далі — листи: з темою `[SLA breach]` (гіпотеза 1) чи `[SLA L1]`/`[SLA L2]` (гіпотези 2 і 3), і
  їхній час: середа, четвер чи п'ятниця;
- **Feed** і **Escalated Issues** у кожен з цих моментів.

Різні теми шаблонів і різні цілі (середа, четвер, п'ятниця) дозволяють розрізнити всі три
гіпотези одним прогоном.

Що сказати бізнесу без тесту: за такою конфігурацією **підняття severity до `Show stopper` може
дати багові більше часу**, ніж він мав як `Critical` (3 дні замість 2). Це суперечить здоровому
глузду: гірший баг має отримувати суворішу ціль. Рекомендація — переглянути цілі або поводження
при зміні severity.

---

## Ворота уроку

- [ ] пояснюєш, чим SLA відрізняється від business rule, Due Date і Reminder;
- [ ] знаходиш **Setup → Issue Tracker → SLA** і не забуваєш про **Select Project**;
- [ ] проходиш три кроки майстра і знаєш, що налаштовується на кожному;
- [ ] пояснюєш Close Before і Resolve Before і чому в завданнях обрано Close Before;
- [ ] рахуєш ціль у Calendar і Business hours, з вихідними й створенням після робочого дня;
- [ ] пояснюєш, чому «1 день до цілі» в робочому часі — не 24 години;
- [ ] пояснюєш правило першого збігу і що стається з SLA нижче в списку;
- [ ] створюєш шаблони листів з окремим Subject для кожного рівня;
- [ ] налаштовуєш `Critical Bug SLA` без підглядання;
- [ ] налаштовуєш `High-Priority Multi-Escalation` з двома рівнями і двома адресатами;
- [ ] будуєш швидку тестову SLA, яка не заважає буквальній;
- [ ] плануєш тест на кілька днів: коли створити issue, коли й що перевірити, що не чіпати;
- [ ] знаходиш докази ескалації: позначка в списку, сторінка issue, **Escalated Issues**, **Feed**,
  листи;
- [ ] бачиш ризик SLA на мінливому полі Severity і тестуєш його;
- [ ] здані deliverables Assignment 3 і 4: тест-сценарії, чек-лист, відео, розділ фінального
  звіту;
- [ ] задачі 12.10–12.12 розв'язані без підглядання в розв'язки.
