# Урок 11. Business Rules для issues

*Після уроку ти налаштовуєш business rules для issues у Zoho Projects: знаєш, у якому проєкті вони
живуть, коли прокидаються, як перевіряють умови і в якому порядку виконуються, — і вмієш довести
тестом, що правило робить рівно те, що задумано. Для QA це важливо, бо правило змінює severity чи
assignee мовчки: спрацювало не там або не спрацювало зовсім — помітить лише той, хто перевіряв.*

---

## 11.1. Два світи автоматизації: задачі й issues

У Zoho Projects два види робочих записів, і в кожного своя автоматизація:

| що автоматизуємо | де налаштовується | чим |
|---|---|---|
| задачі (tasks) | **Setup → Automation** | Workflow Rules, Task Blueprint, Macro Rules, Email Alerts, Webhooks |
| issues (баги) | **Setup → Issue Tracker** | Business Rules, SLA, Notifications, Email Templates, Webhooks |

У **Setup → Automation → Workflow Rules** є вкладки Projects, Task, Time Logs, Phases і Users —
вкладки для issues там немає. «Workflow для багів» — це і є business rules; довідка Zoho так і
називає статтю: *Business Rules and Workflow for Issues*.

Розділ **Setup → Issue Tracker** (шестерня Setup у верхньому правому куті) містить: Configuration,
Web To Issues Form, Link Issues, Email Templates, Notifications, Business Rules, Webhooks, SLA.

| пункт | що робить |
|---|---|
| **Business Rules** | коли з issue щось стається (створили, змінили, видалили…) і він відповідає умовам — змінює поля, викликає webhook або функцію |
| **SLA** | часові цілі («закрити за 2 робочі дні») і ескалації, коли ціль під загрозою чи зірвана |
| **Notifications** | стандартні листи про події issue: створено, призначено, закрито, перевідкрито |
| **Email Templates** | шаблони листів для notifications і SLA |
| **Webhooks** | HTTP-запити в зовнішні системи; для issues їх запускає тільки business rule |
| **Link Issues** | які типи зв'язків між issues увімкнені |
| **Configuration** | права клієнтів на issues і пошта, з якої issues приходять листами |
| **Web To Issues Form** | форма для сайту, з якої клієнт подає issue |

**Налаштування issue tracker живуть на рівні проєкту.** Сторінки Business Rules, SLA, Link Issues і
Configuration починаються з поля **Select Project**: спершу обираєш проєкт, і лише тоді бачиш і
створюєш правила саме цього проєкту. Правило, створене для проєкту A, у проєкті B не існує. Це
перше, що ламається в тестах: правило «зникло», а насправді зверху вибрано інший проєкт.

### Що таке business rule

Business rule — це «якщо — то» для issues, яке спрацьовує на подію:

```
ПОДІЯ (Execute On)   →   УМОВИ (Criteria)              →   ДІЇ (Actions)
issue створено           Tags = Client Escalation          Severity = Critical
```

Майстер створення правила має рівно ці три кроки: **1 Rule Details**, **2 Criteria**, **3 Actions**.

Документ підкреслює, що правила можна «нашаровувати»: кілька правил уточнюють обробку одного й того
самого issue. Звідси й головна складність — порядок (розділ 11.6).

Навіщо це команді, за документом:

- **issue одразу там, де треба:** правило призначає чи перепризначає issue на потрібну людину,
  змінює severity чи інші поля, щойно виконано умову;
- **менше ручної роботи:** зникають повторювані дії на кшталт зміни статусу чи тегування
  (документ згадує тут і листи з оновленнями — як їх насправді надсилають, дивись нижче);
- **однакова обробка:** кожен тікет, що підходить під умови, обробляється однаково, і людських
  помилок менше.

Чого business rule не робить:

- **Не забороняє.** Серед дій правила немає «не дозволити»: воно реагує на вже збережені зміни й
  оновлює поля. Хто і в який статус може перевести запис — це workflow статусів у layout issue
  (для задач — Blueprint).
- **Не рахує час.** Серед подій немає «за N днів до дати». Усе про строки — це SLA.
- **Не шле листів окремою дією.** Серед дій довідка називає оновлення полів, webhook, custom function
  і оновлення тікета в Zoho Desk — листа серед них немає. Коли правило змінює поле, лист про цю
  подію («тобі призначено issue») надсилає **Notifications** за своїми налаштуваннями в **Setup →
  Issue Tracker → Notifications**. Власне повідомлення з правила роблять через custom function або
  webhook.
- **Не керує формою.** Показати, сховати чи зробити поле обов'язковим — це layout rules; business
  rule працює вже після збереження.

## 11.2. Поля issue, на яких будуються правила

Правило перевіряє і змінює тільки ті поля, що справді є в issue. Standard layout issue в тріалі
містить поля:

Reporter, Created Time, Associated Team, Assignee, Tags, Last Closed Time, Last Modified Time,
Due Date, Status, Severity, Release Phase, Affected Phase, Module, Classification, Reproducible,
Flag, Rate Per Hour, Cost Per Hour.

**Поля Priority і поля Type в issue немає.** Тому в завданнях замість пріоритету стоїть
**Severity**, а замість типу — **Classification**. Побачиш у постановці «Priority = High» для issue —
це помилка постановки, шукати поле не треба.

| поле | значення |
|---|---|
| **Severity** | `None`, `Show stopper`, `Critical`, `Major`, `Minor` |
| **Classification** | `None`, `Security`, `Crash/Hang`, `Data Loss`, `Performance`, `UI/Usability`, `Other Bug`, `Feature(New)`, `Enhancement` |
| **Status** | є `Open`, `In progress` (з маленькою p), `Closed`; довідка називає ще `To be tested` і `Reopen`. Кожен статус належить до типу Open або Closed |
| **Module** | список модулів проєкту; його наповнюєш сам |
| **Tags** | вільні мітки; за довідкою новий тег народжується, коли вписуєш його в поле і тиснеш Enter — **на практиці це не завжди спрацьовує, дивись нижче** |
| **Flag** | `Internal` / `External` |

**Module** — це не модуль Zoho, а частина продукту, до якої належить баг: Login, Checkout, UI/UX. У
тріалі найнадійніший спосіб додати значення — не Kanban, а **Setup → Customization →
Layouts → Issues → свій layout → відкрий поле Module → Pick List Values → + Add Value**: так само, як
для будь-якого власного picklist-поля. Kanban-вид, згрупований за Module (перемикач виду списку →
Kanban → групування Module), одразу показує по колонці на кожне вже наявне значення; сама кнопка «+»
додавання нового значення просто з колонки в тріалі відкриває форму «Add Issue», а не діалог нового
значення — якщо тобі потрібне саме це, користуйся шляхом через Layouts вище.

**Tags** спільні для всього порталу: той самий тег чіпляється і до проєктів, і до задач, і до issues.
Довідка каже, що теги ввімкнені за замовчуванням.

**Створення нового тега через поле Tags issue може не спрацювати.** Вписуєш `Client Escalation` у
поле **Tags** і тиснеш Enter — і на вже створеному issue через швидке редагування, і в самій формі
створення issue (**New Issues**) — а жодної підказки чи випадайки не з'являється, текст лишається
голим рядком, і після збереження issue поле **Tags** порожнє: тег не створився і не приліпився. У
консолі браузера при цьому з'являється помилка `Uncaught SyntaxError: Failed to execute 'closest' on
'Element': '##zpsSlideItems' is not a valid selector` з обробника `onmouseup`, що закриває спливаючі
вікна, — це схоже на збій самого продукту, а не на помилку дій. Що це означає для завдань розділу:
плануй тег `Client Escalation` заздалегідь через будь-який шлях, що в тебе спрацює (спробуй ще раз
свіжими руками, через мобільний застосунок чи на іншому порталі), і лише тоді переходь до кроків
нижче, які на цей тег спираються. Якщо у твоєму порталі Enter у полі Tags працює як описано в
довідці — чудово, це і є задокументована поведінка; якщо ні — зафіксуй це як розбіжність зі своїми
доказами.

**У кожного проєкту своя приватна копія layout issue.** Власне поле, додане в layout одного
проєкту, в іншому проєкті не з'явиться.

## 11.3. Execute On: коли правило прокидається

**Execute On** обираєш на кроці **Rule Details** разом із **Name**. У тріалі список був такий:

| Execute On | подія | коли брати |
|---|---|---|
| `Issues Creation` | issue створено | класифікувати баг на вході |
| `Issues Updation` | наявний issue змінили і зберегли | реагувати на правки |
| `Issues Creation or Updation` | і те, і інше | стан issue має завжди відповідати правилу |
| `Issues Trash` | issue перемістили в кошик | наприклад, повідомити зовнішню систему |
| `Field Update` | змінилось конкретне поле (його обираєш окремо) | довідка показує приклад: `Field Update` → `Severity` |
| `New Comment` | до issue додали коментар | реакція на обговорення |

У тексті уроку перші три звуться коротко: Creation, Updation, Creation or
Updation; у таблицях налаштувань — повністю, як у списку. У продукті є ще варіант `Issues Deletion`,
але в списку тріалу його не було.

Найчастіша пастка — тригер не збігається з тим, як люди працюють. Тег `Client Escalation` рідко
ставлять у момент створення бага: частіше клієнт дзвонить, коли баг уже тиждень висить. Правило з
Execute On = **Creation** такого issue не побачить ніколи. Тому документ і пише: «Issues Creation (or
Issues Updation, depending on your process)» — спершу подивись на процес, потім обирай тригер.

Чого ні документ, ні довідка не пояснюють і що доведеться з'ясувати тестом:

- **Updation** реагує на будь-яку правку чи тільки на зміну полів із критерію?
- якщо правило з **Updation** саме змінює поле — чи не запускає воно себе вдруге?
- чи вважається «оновленням» перетягування картки в Kanban, масова зміна зі списку, імпорт?

## 11.4. Criteria: умови

На кроці **Criteria** додаєш рядки «поле — оператор — значення». Кілька рядків з'єднуються через
AND (усі мають бути правдою) або OR (досить одного). **Criteria pattern** дозволяє записати
складнішу логіку, наприклад `(1 AND 2) OR 3`, де цифри — номери рядків.

Довідка наводить приклад умови текстом: `Severity is Showstopper and Status is not Closed` (в
інтерфейсі саме значення пишеться `Show stopper`). Тобто оператори на кшталт «is» / «is not».
Точні підписи операторів для кожного поля запиши, коли будуватимеш правило, — вони знадобляться в
звіті.

Окрім стандартних полів, критерій можна будувати на власних полях layout, а також на **Affected
Phase** і **Release Phase** (у довідці вони ще звуться Affected Milestone і Release Milestone).

**Список полів у Criteria ширший за список полів issue.** Селектор поля на
кроці Criteria додатково пропонує `Issues Name`, `Age (days since created)`, `Age (days since due)` і
`Escalation Level` (їх немає серед звичайних полів issue з розділу 11.2), а от `Rate Per Hour` і
`Cost Per Hour` серед критеріїв відсутні, хоч на самому issue вони є. Не дивуйся розбіжності зі
списком полів форми — це різні списки.

**Tags як критерій бачить лише вже наявні теги.** Поле значення для критерію `Tags = …` — це
автодоповнення з існуючих тегів порталу; вписаний новий тег критерій не приймає (`No matches found`,
Enter не створює новий), на відміну від поля Tags у самій формі issue. Тому тег для критерію (`Client
Escalation` тощо) обов'язково має вже існувати — createний заздалегідь на «насіннєвому» issue (крок
11.7.0.3), інакше критерій просто нема з чого вибрати.

На цьому ж кроці стоїть прапорець **Execute the next business rule** — про нього в розділі 11.6.

Умова — перше місце, де ховаються помилки конфігурації:

- **схоже, але не те:** тег `Client Escalation` і тег `Escalation`, модуль `UI/UX` і модуль
  `UI/UX Design`;
- **регістр і пробіли:** `client escalation`, `UI / UX`;
- **порожнє значення:** issue без модуля не має проходити умову `Module = UI/UX`;
- **кілька значень:** issue з трьома тегами, серед яких потрібний;
- **AND замість OR** (і навпаки) у Criteria pattern.

## 11.5. Actions: що правило робить

На кроці **Actions**, за документом і довідкою, доступні:

- **оновлення полів** — обираєш поле і значення. У FAQ довідки прямо названо зміну severity, status,
  module, classification і призначення issue на користувача; у прикладі довідки правило ставить ще
  й **Reproducible** = `Always`;
- **Call webhooks** — викликати webhook (до правила чіпляється один webhook, розділ 11.9);
- **Call Custom Function** — викликати функцію на Deluge; їх створюють у **Setup → Developer Space →
  Custom Functions** з типом Issues;
- оновлення тікета в **Zoho Desk**, якщо Projects інтегровано з Desk.

Якщо замість цих кнопок побачиш **Associate Webhook** і
**Associate Custom Function** — це ті самі дії. Якщо там буде ще й **Associate Email Alert**, правило
вміє надіслати лист і саме; запиши це, бо тоді лист може прийти і від правила, і від Notifications.

Правило зберігаєш кнопкою **Save Rule** — і воно починає працювати.

Керування списком правил:

- **Edit** — змінити правило;
- **Delete** — видалити; це назавжди, відновити нема звідки;
- перетягування + **Save Order** — змінити порядок;
- довідка згадує, що правило можна й деактивувати; де саме перемикач, подивись у своєму списку.

Довідка Zoho описує кнопку старою назвою «Add Rule»; в інтерфейсі зараз — **Create a Business
rule**.

## 11.6. Порядок правил і Execute the next business rule

Коли в проєкті кілька правил, вони застосовуються **за порядком у списку** (довідка: «Business Rules
are applied to bugs based on the rule list order»). Прапорець **Execute the next business rule** у
правилі означає: після цього правила перевір і наступне. Документ пояснює його так: «if you want
multiple rules to run in sequence for the same ticket». Підказки в самому продукті уточнюють: з
прапорцем — «Next business rule with a matching criteria will be executed», без нього — «Next
business rule will not be executed».

Звідси модель, яку ти потім перевіриш тестом:

1. Правила перевіряються згори вниз.
2. Правило, чиї умови не збіглися, пропускається.
3. Перше правило, чиї умови збіглися, виконує свої дії.
4. Якщо в нього прапорця немає — на цьому все. Якщо є — перевірка йде далі тим самим способом.
5. Якщо два правила змінюють одне поле і обидва виконались, лишається значення того, що виконалось
   пізніше.

Приклад. У проєкті два правила:

| # | правило | умова | дія |
|---|---|---|---|
| 1 | `Client Escalation Rule` | Tags = `Client Escalation` | Severity = `Critical` |
| 2 | `Auto-Assign to UI/UX` | Module = `UI/UX` | Assignee = дизайнер |

Новий issue з тегом `Client Escalation` і модулем `UI/UX`:

| порядок у списку | прапорець у верхньому правилі | Severity | Assignee |
|---|---|---|---|
| 1, потім 2 | немає | `Critical` | не змінився |
| 1, потім 2 | є | `Critical` | дизайнер |
| 2, потім 1 | немає | не змінилась | дизайнер |
| 2, потім 1 | є | `Critical` | дизайнер |

Тому документ радить ставити **специфічніші й важливіші правила вище**. Ескалація від клієнта
важливіша за розподіл по модулях, тож вона стоїть першою, а прапорець у ній дозволяє розподілу
теж спрацювати.

Прапорець має сенс лише в правилі, яке стоїть вище: воно «пропускає» перевірку далі. У найнижчому
правилі він нічого не змінює — далі нікого немає.

Ці таблиці — прогноз за описом документа, довідки й підказок продукту, не спостереження. Особливо
п. 5: що буде, коли два правила пишуть в одне поле, не описано ніде. Твоя робота як QA — перевірити
все це в продукті (задача 11.10).

## 11.7. Покроково: Assignment 1 — Client Escalation Rule

**Що вимагає документ.** Правило `Client Escalation Rule`; Execute On — `Creation` (або `Updation`,
залежно від процесу); критерій `Tags = Client Escalation` (або схоже власне поле чи прапорець,
яким позначають критичні тікети); дія — Severity = `Critical`; за бажанням — призначити
конкретного учасника або групу. Перевірка: новий issue з тегом сам отримує `Critical`. Здати:
тест-сценарії, чек-лист, відео і розділ у фінальному звіті.

### Крок 0. Підготовка

1. Відкрий свій навчальний проєкт (наприклад, `QA Training Project – <твоє ім'я>`). Вкладка
   **Issues** може ховатися під **•••** (More Tabs); у налаштуваннях вкладок проєкту вона зветься
   **Bugs**.
2. Відкрий форму створення issue (у довідці кнопка зветься **Submit Issue**), запиши, яке
   значення **Severity** стоїть за замовчуванням і чи є в формі поле **Tags**, і закрий форму без
   збереження.
3. Створи тег. Новий issue `BR1-00 Tag seed`, у **Tags** впиши `Client Escalation` → Enter →
   збережи. Якщо на твоєму порталі тег не приліпився (див. пояснення й консольну помилку в 11.2) —
   зафіксуй факт, спробуй ще раз і, якщо не вийшло, познач цей і всі залежні від тега кроки нижче як
   непройдені через збій продукту, а не пропускай їх мовчки.

   **Що побачиш (за задумом):** issue з тегом `Client Escalation`; Severity та сама, що за
   замовчуванням, — правила ще немає. Цей issue — твій контроль: пізніше він покаже, що правило не
   діє заднім числом.
4. Необов'язкове: для дії «призначити учаснику» потрібен ще один користувач у проєкті — User B (як
   його додати, описано в задачі 11.4).

### Крок 1. Rule Details

**Setup → Issue Tracker → Business Rules** → у **Select Project** обери свій проєкт → **Create a
Business rule**.

| поле | значення |
|---|---|
| **Name** | `Client Escalation Rule` |
| **Execute On** | `Issues Creation` |

Перейди до кроку **Criteria**.

### Крок 2. Criteria

| що | значення |
|---|---|
| поле | **Tags** |
| оператор | рівність («is» — запиши, як він підписаний) |
| значення | `Client Escalation` |
| **Execute the next business rule** | не відмічай (правило поки одне) |

Новий тег через форму issue в тріалі не створюється — критерій
`Tags` лишиться без значення, доки такого тега не існує. Онови критерій на «similar custom
field/flag»: створи власне поле: **Setup → Customization → Layouts → Issues** → layout свого проєкту →
перетягни з **New Fields** поле типу Checkbox і назви його `Client Escalation` — редактор збереже його
сам. Критерій стане «`Client Escalation` відмічено». Власні поля issue — функція плану
Enterprise. Заміну обов'язково запиши у звіт.

### Крок 3. Actions

| дія | значення |
|---|---|
| оновити поле **Severity** | `Critical` |
| необов'язково: оновити поле **Assignee** | User B |

Замість людини можна призначити команду — поле **Associated Team**. Це функція плану Enterprise, і
команду спершу створюють у **Users → Teams → Add Team** (назва, учасники, Team Lead, проєкт).

Натисни **Save Rule**.

**Що побачиш:** `Client Escalation Rule` у списку Business Rules вибраного проєкту.

### Крок 4. Перевірка документа

1. **Issues** → новий issue `BR1-01 Client cannot log in`, у **Tags** — `Client Escalation`,
   Severity не чіпай → збережи.
2. Відкрий issue.

   **Що побачиш:** **Severity** = `Critical`, хоча ти його не вибирав. Якщо додав дію з
   Assignee — там User B.
3. На сторінці issue відкрий вкладку **Activity Stream** (історія змін). Там має бути зміна Severity
   з часом, що збігається з часом створення. Запиши, кому приписано зміну — тобі чи правилу: від
   цього залежить, як читати всі наступні докази.
4. Відкрий `BR1-00 Tag seed`. Очікування: його Severity не змінилась — правило не діє заднім
   числом (issue створили ще до правила).

### Крок 5. «Або Updation»: тег, доданий пізніше

1. Поки Execute On = `Creation`: створи `BR1-02 Tag later` без тегу, збережи; потім додай тег
   `Client Escalation` і збережи ще раз.

   **Очікування:** Severity не змінилась — правило на створення правку не ловить.
2. **Edit** правила → **Execute On** = `Issues Creation or Updation` → **Save Rule**.
3. Створи `BR1-03 Tag later again` без тегу, збережи, потім додай тег і збережи. Очікування:
   Severity стає `Critical`.
4. Відкрий `BR1-02 Tag later` (тег уже є) і збережи правку іншого поля, наприклад опису. Запиши,
   чи правило спрацювало на правку, яка тег не чіпала. Це відповідь на питання з розділу 11.3
   про Updation.

Яку конфігурацію лишити для здачі: `Creation or Updation`, якщо в процесі тег ставлять пізніше, і
пояснення цього в звіті. Якщо наставник хоче буквально `Creation` — поверни його, але у звіті все
одно покажи обидві поведінки.

Що легко відкотити: правило редагується, тестові issues йдуть у кошик. Що не відкотити: **Delete**
правила.

## 11.8. Покроково: Assignment 2 — Auto-Assign to UI/UX

**Що вимагає документ.** Правило `Auto-Assign to UI/UX`; Execute On — `Creation` (або
`Updation`); критерій, наприклад, `Module = UI/UX` або значення Classification (поля Type в issue
немає); дія — автоматично призначити issue на UI/UX lead або окремого дизайнера; за бажанням —
прапорець **Execute the next business rule**, якщо можуть спрацювати кілька правил. Перевірка:
новий issue з `Module = UI/UX` сам призначається на правильну людину. Здати те саме: сценарії,
чек-лист, відео, розділ звіту.

### Крок 0. Підготовка

1. **Дизайнер — окремий користувач.** Якщо призначати issue на себе, тест нічого не доведе: ти і
   так його автор. Потрібен User B, доданий у портал і в проєкт (задача 11.4). У тестах він —
   «UI/UX designer».
2. **Модулі.** Додай у проєкт модулі `UI/UX` (цільовий) і `Backend` (для негативного тесту),
   наприклад через **Issues → Kanban** → тип Kanban **Module** → «+».

   **Що побачиш:** обидва значення в полі **Module** форми issue.
3. Відкрий форму нового issue і запиши, що стоїть в **Assignee** за замовчуванням.

### Кроки 1–3. Правило

**Setup → Issue Tracker → Business Rules** → **Select Project** → **Create a Business rule**.

| крок | поле | значення |
|---|---|---|
| Rule Details | **Name** | `Auto-Assign to UI/UX` |
| Rule Details | **Execute On** | `Issues Creation` |
| Criteria | умова | **Module** · рівність · `UI/UX` |
| Criteria | **Execute the next business rule** | див. нижче |
| Actions | оновити поле **Assignee** | User B |

**Прапорець.** Якщо в проєкті вже є `Client Escalation Rule`, issue з тегом і модулем `UI/UX`
підходить під обидва правила. Хочеш виконати необов'язковий пункт буквально — постав `Auto-Assign
to UI/UX` першим у списку (перетягни, **Save Order**) і відміть прапорець у ньому: тоді такий issue
отримає і дизайнера, і `Critical`. Інший правильний варіант — ескалацію першою з прапорцем у ній
(розділ 11.6). Головне — щоб прапорець стояв у верхньому з двох правил.

Натисни **Save Rule**.

**Що побачиш:** обидва правила в списку проєкту, і видно, котре з них стоїть вище.

Альтернатива до модуля — критерій **Classification** = `UI/Usability` (значення з довідки).
Документ допускає обидва; обери один і назви його у звіті.

### Крок 4. Перевірка

1. Новий issue `BR2-01 Login button misaligned on mobile`, **Module** = `UI/UX`, **Assignee**
   порожній (або значення за замовчуванням) → збережи.

   **Що побачиш:** Assignee = User B. В **Activity Stream** — запис про зміну Assignee.
2. Новий issue `BR2-02 API timeout on save`, **Module** = `Backend` → збережи.

   **Що побачиш:** Assignee не змінився.
3. Увійди як User B → проєкт → **Issues** → вид **My Open** (відкриті issues, призначені на
   поточного користувача). `BR2-01` там є, `BR2-02` — ні. Це і є доказ «правильної людини» з боку
   самої людини.
4. Чи отримає User B лист про призначення — вирішує не правило, а **Setup → Issue Tracker →
   Notifications** цього проєкту. Довідка попереджає: про зміни, які користувач зробив сам, лист
   йому не надсилається. Тому лист перевіряй у ящику User B, коли issue створював ти.

## 11.9. Бонус: webhook з business rule

Webhook — це HTTP-запит, який Zoho Projects надсилає на твою адресу, коли спрацювало правило. Для
issues webhooks створюються в **Setup → Issue Tracker → Webhooks**. Однойменний пункт у **Setup →
Automation** — окремий список для workflow rules і blueprint (задачі, фази, time logs), зі своїми
лімітами; business rule issues бере webhook лише з **Issue Tracker → Webhooks**.

Документ пропонує бонус: додати webhook до одного з двох правил, щоб повідомити зовнішній сервіс
або передати йому дані — Slack, Microsoft Teams чи власну адресу. Для навчального тесту
найпростіша власна адреса-«пастка»: вона показує запит повністю, і видно, що саме надіслав Zoho.

Поля webhook за довідкою:

| поле | що це | обмеження |
|---|---|---|
| **Name** | назва | 100 символів |
| **URL to notify** | адреса, куди йде запит | 1000 символів |
| **Method** | `POST` (за замовчуванням) або `GET` | — |
| **Append issue parameters** | параметри з полів issue: стандартний формат або «user defined» (xml, json…) | 3000 символів |
| **Append custom parameters** | свої пари ключ–значення, наприклад токен | 3000 символів |
| **Preview URL** | як виглядатиме повна адреса | тільки читання |

Обмеження, які треба знати до тестів (за довідкою, якщо не сказано інше):

- webhook викликається **тільки** з business rule;
- до одного правила — **один** webhook; один webhook можна підключити до багатьох правил;
- до 10 параметрів з полів issue і до 5 власних; лише один параметр у форматі user defined;
- до **1000 викликів на день** — на весь портал, а не на один webhook (так каже підказка в
  продукті);
- невдалий виклик **не повторюється**;
- після 10 невдач поспіль webhook **вимикається**. Довідка каже, що листа про це не буде, але в
  продукті є лист «Webhook has been disabled» — тож стан webhook перевіряй у списку, а не в пошті;
- збої видно на сторінці **Webhook Failures**; зберігаються лише останні (довідка каже про 100,
  підказка в продукті — «Only the last 200 Webhook failures will be audited»).

Доступність за довідкою — останній «user based» Enterprise-план; у тріалі пункт **Setup → Issue
Tracker → Webhooks** є.

### Покроково

1. Візьми тестову адресу-«пастку», яка показує вхідні запити (публічний сервіс на кшталт
   webhook.site дає унікальну URL). Адреса публічна — шли туди тільки тестові дані.
2. **Setup → Issue Tracker → Webhooks** → **Add Webhook** (кнопка може зватися й **Create a
   Webhook**):

   | поле | значення |
   |---|---|
   | **Name** | `UI/UX issue to test endpoint` |
   | **URL to notify** | адреса з кроку 1 |
   | **Method** | `POST` |
   | **Append issue parameters** | user defined, значення — JSON-шаблон нижче |

   ```json
   {"issue_key": "${Issue.IssueKey}", "title": "${Issue.IssueTitle}", "severity": "${Issue.Severity}"}
   ```

   Імена плейсхолдерів узяті з прикладу в довідці; повний список показує сам редактор. Натисни
   **Save**.
3. **Setup → Issue Tracker → Business Rules** → `Auto-Assign to UI/UX` → **Edit** → **Actions** →
   **Call webhooks** (або **Associate Webhook**) → обери наявний webhook → **Save Rule**.
4. Створи issue `BR2-W1 Webhook check`, **Module** = `UI/UX`.

   **Що побачиш:** Assignee = User B, а в «пастці» — один новий запит `POST` з ключем і назвою саме
   цього issue.
5. Створи issue з **Module** = `Backend`. Нових запитів у «пастці» бути не повинно.
6. Постав у webhook свідомо хибну адресу (формат лишається правильним: продукт приймає лише
   адреси, що починаються з `http://`, `https://` або `www.`), створи ще один UI/UX-issue.
   Очікування: він створиться і призначиться, бо збій зовнішнього виклику не має чіпати дію з
   полем. Потім поверни адресу.

У форматі user defined шаблон — це значення одного параметра, тож подивись у «пастці», у якому
вигляді він приїхав (тіло запиту, поле форми чи параметр адреси), і запиши це в звіт. Чек-лист
документа для автоматизації формулює очікування так: «Webhook triggers with correct JSON payload.
Provide test endpoint to capture requests».

## 11.10. Як це тестувати

### Що саме доводиш

Для кожного правила — п'ять тверджень:

1. **спрацьовує, коли має:** умова виконана → поле змінилось;
2. **мовчить, коли не має:** інше значення, схоже значення, порожнє значення, інший проєкт;
3. **спрацьовує на правильну подію:** створення, оновлення, те й інше;
4. **правильно поводиться поруч з іншими правилами:** порядок, прапорець, конфлікт полів;
5. **зміна видима й пояснювана:** Activity Stream, колонки в списку issues.

### Матриця «подія × тригер»

| що сталося | Creation | Updation | Creation or Updation |
|---|---|---|---|
| створили issue з тегом | спрацює | не має спрацювати | спрацює |
| додали тег наявному issue | не спрацює | спрацює | спрацює |
| змінили інше поле в issue з тегом | не спрацює | з'ясуй | з'ясуй |
| прибрали тег | Severity лишиться, як була | те саме | те саме |

Останній рядок — не помилка: у правилі немає зворотної дії, і `Critical` після зняття тегу нікуди
не дінеться. Але це варто записати у звіт як поведінку, про яку має знати команда.

### Класи значень критерію

- `Tags = Client Escalation`: точний тег; тег серед кількох; схожий тег (`Escalation`, `Client
  Feedback`); той самий текст іншим регістром (спершу подивись, що робить поле Tags — підставляє
  наявний тег чи створює новий); без тегу.
- `Module = UI/UX`: `UI/UX`; `Backend`; порожній модуль; схожий `UI/UX Design`.

### Точки входу

Issue народжується і змінюється не лише через форму: рядок **Submit Issue** у списку, Kanban
(перетягування між колонками міняє Status, Severity, Module, Classification), масове оновлення зі
списку (Assignee, Tags, Severity, Module…), імпорт з XLS/CSV/XLSX, **Clone**, лист на адресу
проєкту, **Web To Issues Form**, API. Ні документ, ні довідка не кажуть, чи запускає кожна з них
business rules. Візьми дві-три точки, якими реально користуються в команді, і запиши факт.

### Сусіди правила

- Інше правило на ті самі issues — порядок і прапорець (розділ 11.6).
- SLA з умовою на Severity: `Client Escalation Rule` піднімає Severity до `Critical` — і цим може
  ввімкнути SLA для критичних багів. Каскад «правило → SLA» перевір окремо і вирішіть, чи він
  бажаний.
- Лист про призначення приходить від **Notifications**, а не від правила — не приписуй правилу
  чуже.

### Докази

- скріншоти трьох кроків правила і списку правил (з вибраним проєктом і порядком);
- форма issue до збереження і сторінка issue після;
- **Activity Stream** з часом і автором зміни;
- список issues з колонками Severity, Tags, Module, Assignee;
- для Assignment 2 — екран User B з видом **My Open**;
- для webhook — запит у «пастці» з тілом і часом.

### Тест-сценарій у форматі документа

Документ дає формат: Title, Precondition, Steps, Expected Result, Actual Result, Pass/Fail,
Notes/Attachments. Сценарії пишуться англійською, як і весь пакет для здачі:

**Scenario 1**
- Title: New issue tagged "Client Escalation" gets Critical severity automatically
- Precondition:
   - Business rule "Client Escalation Rule" is saved in project "QA Training Project – [Your Name]":
     Execute On = Creation; Criteria: Tags = Client Escalation; Action: Severity = Critical.
   - Tag "Client Escalation" exists.
- Steps:
   1. Open the project → Issues → create issue "BR1-01 Client cannot log in".
   2. In Tags, select "Client Escalation". Leave Severity at its default value.
   3. Save the issue and open it.
   4. Open Activity Stream.
- Expected Result:
   1. Severity = Critical without any manual change.
   2. Activity Stream shows the Severity change at the time of creation.
- Actual Result: [what really happened]
- Pass/Fail: [Pass / Fail]
- Notes/Attachments: screenshots of the form before saving, the issue after saving, Activity Stream.

### Чек-лист

Формат документа — таблиця Checklist Item · Completed (Y/N) · Notes:

| Checklist Item | Completed (Y/N) | Notes |
|---|---|---|
| "Client Escalation Rule" exists in the correct project (Select Project) | | screenshot of the rule list |
| Execute On = Creation (or Creation or Updation, reason stated) | | |
| New issue with tag "Client Escalation" → Severity = Critical | | Scenario 1 |
| New issue without the tag → Severity unchanged | | Scenario 2 |
| Similar tag "Escalation" → no change | | Scenario 3 |
| Tag added after creation: behaviour recorded for Creation and for Creation or Updation | | Scenario 4 |
| Rule does not act in another project | | Scenario 5 |
| Activity Stream shows who changed Severity | | |

### Відео (3–5 хвилин на правило)

1. Конфігурація: **Setup → Issue Tracker → Business Rules**, вибраний проєкт, правило відкрите на
   всіх трьох кроках.
2. Позитив: створення issue, який підходить під умову, і результат на сторінці issue.
3. Негатив: issue, який не підходить, — нічого не змінилось.
4. Доказ: **Activity Stream**; для Assignment 2 — вид **My Open** під User B.
5. Висновок одним реченням: що працює, що з'ясовано про тригер, що не перевірялось.

### Розділ фінального звіту

Документ просить додати результати у фінальний звіт (Summary of Findings → Issues/Discrepancies →
Recommendations → Overall Result). Приклад формулювань:

```
Business Rules (Issue Tracker, project "QA Training Project – [Your Name]")
- Client Escalation Rule: Pass. New issues tagged "Client Escalation" get Critical severity
  on creation. With Execute On = Creation a tag added later does not trigger the rule;
  with Creation or Updation it does.
- Auto-Assign to UI/UX: Pass. New issues with Module = UI/UX are assigned to User B
  (checked from User B's "My Open" view). Issues with other modules stay unassigned.
Issues/Discrepancies: none found / [list].
Recommendations: use "Creation or Updation" for the escalation rule, because the tag is
usually added after creation; keep the escalation rule above the assignment rule.
```

## 11.11. Типові помилки

**1. Не той проєкт у Select Project.** Правило створене, але для іншого проєкту, і тест «падає».
Перший крок будь-якої діагностики — подивитись, який проєкт вибрано.

**2. Execute On = Creation, а тег ставлять пізніше.** Правило бездоганне і ніколи не спрацьовує в
реальному процесі. Тригер обирають під те, як працюють люди.

**3. Шукаєш Priority чи Type.** Їх в issue немає: Severity і Classification.

**4. Призначаєш на себе.** Ти автор issue, і «призначення на правильну людину» так не доводиться.
Потрібен другий користувач.

**5. Значення критерію з одруком.** `UI / UX` замість `UI/UX` — правило валідне і мовчить.
Копіюй значення з поля, а не з пам'яті.

**6. Забутий Save Order.** Порядок перетягнув, не зберіг — правила виконуються в старому порядку.

**7. Прапорець не в тому правилі.** Execute the next business rule впливає на те, що йде нижче.
У найнижчому правилі він нічого не дає.

**8. Правило на Updation «б'ється» з людиною.** Людина свідомо знижує Severity тегованого issue
до `Major`, зберігає — і правило знову ставить `Critical`. Це не баг продукту, а наслідок
конфігурації; його треба знайти тестом і обговорити.

**9. Лист від Notifications вважаєш дією правила.** Правило лише змінює поле; лист про призначення
надсилає Notifications за своїми налаштуваннями.

**10. Delete замість Edit.** Видалене правило не відновити — зроби скріншот налаштувань перед
будь-якою зміною.

### Симптом → причина

| симптом | найімовірніша причина |
|---|---|
| список Business Rules порожній, хоча правило створював | у **Select Project** вибрано інший проєкт |
| правило працює в одному проєкті, а в іншому ні | правила живуть на рівні проєкту |
| тег додали наявному issue — Severity не змінилась | Execute On = `Creation` |
| новий issue з тегом — Severity не змінилась | тег в issue не той (регістр, схожа назва), у критерії інше значення, правило в іншому проєкті |
| людина знизила Severity, а після збереження знову `Critical` | Execute On містить Updation, умова досі виконана |
| спрацювало тільки одне з двох правил | у верхньому правилі не відмічено Execute the next business rule |
| спрацювали обидва, але Assignee «не той» | обидва правила міняють Assignee; найімовірніше, лишилось значення від того, що виконалось пізніше |
| порядок правил «повернувся» | не натиснуто **Save Order** |
| у критерії чи діях немає Priority / Type | таких полів у issue немає |
| у полі Module немає `UI/UX` | значення не створене в цьому проєкті |
| Assignee не став User B | User B не доданий у проєкт або в дії вибрано іншого користувача |
| User B не отримав листа | листи — це **Notifications**; або зміну зробив сам User B |
| вкладки Issues у проєкті не видно | вона під **•••** (More Tabs); у налаштуваннях вкладок зветься Bugs |
| немає **Call webhooks** серед дій | webhook ще не створений у **Setup → Issue Tracker → Webhooks** або план без webhooks |
| webhook раніше працював, а тепер мовчить | вимкнувся після 10 невдач поспіль або портал вичерпав 1000 викликів на день |
| у «пастці» дані не в тому вигляді | стандартний формат замість user defined, або шаблон приїхав значенням параметра |

## 11.12. Що варто запам'ятати

1. Автоматизація issues живе в **Setup → Issue Tracker**, а не в **Setup → Automation**.
2. Business rules — на рівні проєкту: спершу **Select Project**.
3. Правило = **Execute On** → **Criteria** → **Actions**, збереження — **Save Rule**.
4. Шість подій: Creation, Updation, Creation or Updation, Trash, Field Update, New Comment.
   Тригер обирають під реальний процес.
5. В issue немає Priority і Type — є Severity і Classification.
6. Правила йдуть за порядком списку; прапорець у верхньому правилі пускає перевірку далі;
   специфічніше — вище; порядок зберігає **Save Order**.
7. Правило змінює поля й нічого не забороняє: листи про події — Notifications, строки — SLA.
8. Webhook для issues запускається тільки з business rule: один на правило, 1000 викликів на день
   на портал, без повторів.
9. Призначення доводиться другим користувачем, а зміни — вкладкою **Activity Stream**.
10. Кожне правило: позитив, негатив, тригер, сусіди, інший проєкт.

---

# Задачі

**11.1.** *(пояснити)* Колега каже: «Для багів налаштую workflow rule в **Setup → Automation**,
щоб Critical-баги самі призначались на тімліда, а через дві доби без закриття летів лист
менеджеру». Поясни, що тут не так: де насправді налаштовується автоматизація issues, які два різні
механізми потрібні для двох половин цього бажання, і що з цього буде дією правила, а що — листом.

**11.2.** *(прогноз)* У проєкті три правила в такому порядку:

| # | правило | Execute On | умова | дія | Execute the next business rule |
|---|---|---|---|---|---|
| 1 | `Client Escalation Rule` | Creation or Updation | Tags = `Client Escalation` | Severity = `Critical` | так |
| 2 | `Auto-Assign to UI/UX` | Creation | Module = `UI/UX` | Assignee = User B | ні |
| 3 | `Backend to User C` | Creation | Module = `Backend` | Assignee = User C | ні |

Спрогнозуй Severity і Assignee після збереження для чотирьох випадків і поясни кожен:

- a) новий issue: Module `UI/UX`, тег `Client Escalation`, Severity `Minor`;
- b) новий issue: Module `UI/UX`, без тегів, Severity `Minor`;
- c) наявний issue (Module `Backend`, Assignee User C, Severity `Major`, без тегів), йому додають тег
  `Client Escalation` і зберігають;
- d) новий issue: Module `Backend`, тег `Escalation`, Severity `Minor`.

**11.3.** *(знайди помилки)* Тестувальник описав свою роботу: «Проєкт `Mobile App`. У **Setup →
Issue Tracker → Business Rules** (у Select Project стояв `Website`) створив `Client Escalation
Rule`: Execute On `Creation`; умова `Priority` = `High`; дія Severity = `High`, Assignee = я.
Створив issue в `Mobile App`, наступного дня поставив йому тег `Client Escalation`. Severity не
змінилась. Результат: Fail, правило не працює». Знайди всі помилки — і в конфігурації, і в
тесті, і у висновку.

**11.4.** *(підготовка)* Підготуй проєкт до обох завдань. Потрібно:

- навчальний проєкт з вкладкою **Issues**;
- User B — у порталі Projects і в проєкті. Якщо його ще немає: людину додають у Zoho One в **Admin
  Panel → User Management → Users → Add User**, потім у Projects — **Users → Portal Users → Invite
  User** з вибором проєкту (так описує довідка), і користувач
  має прийняти запрошення;
- модулі `UI/UX`, `Backend`, `UI/UX Design`;
- теги `Client Escalation`, `Escalation`, `Client Feedback` (створи їх на одному-двох
  «насіннєвих» issues до того, як з'являться правила).

Запиши: перелік полів форми issue, Severity і Assignee нового issue за замовчуванням, список
**Execute On** так, як він виглядає у твоєму порталі.

**11.5.** *(Assignment 1 — налаштування)* Налаштуй правило рівно за документом: `Client Escalation
Rule`, Execute On `Creation`, критерій `Tags = Client Escalation`, дія Severity = `Critical`, за
бажанням — Assignee = User B. Зроби скріншоти всіх трьох кроків і списку правил.

**11.6.** *(Assignment 1 — перевірка)* У проєкті збережене `Client Escalation Rule` (Execute On
`Creation`, Tags = `Client Escalation` → Severity = `Critical`), є теги `Client Escalation`,
`Escalation`, `Client Feedback`. Виконай перевірку з документа (новий issue з тегом → Severity =
`Critical`) і ще щонайменше чотири сценарії: без тегу; зі схожим тегом; тег серед кількох; тег
доданий пізніше — для `Creation` і для `Creation or Updation`. Для кожного запиши Expected і Actual
і те, що показує **Activity Stream**.

**11.7.** *(Assignment 2 — налаштування і перевірка)* Налаштуй `Auto-Assign to UI/UX` (Execute On
`Creation`, Module = `UI/UX`, Assignee = User B). Виконай перевірку з документа, два негативи
(`Backend`, порожній модуль) і доведи призначення з-під User B.

**11.8.** *(дизайн тестів)* Правило `Auto-Assign to UI/UX`: Execute On `Creation`, Module =
`UI/UX` → Assignee = User B; у проєкті є модулі `UI/UX`, `Backend`, `UI/UX Design` і правило
`Client Escalation Rule`. Склади вісім назв сценаріїв з очікуваним результатом: позитив, три
негативи, тригер, порядок з іншим правилом, дві точки входу. Два з них розпиши повністю у форматі
документа (Title, Precondition, Steps, Expected Result, Actual Result, Pass/Fail,
Notes/Attachments).

**11.9.** *(deliverables)* Збери пакет для обох завдань документа — Assignment 1 (`Client
Escalation Rule`) і Assignment 2 (`Auto-Assign to UI/UX`): тест-сценарії, чек-лист, відео і розділ
фінального звіту (Summary of Findings, Issues/Discrepancies, Recommendations).

**11.10.** *(порядок і прапорець)* В одному проєкті є `Client Escalation Rule` (Tags = `Client
Escalation` → Severity = `Critical`) і `Auto-Assign to UI/UX` (Module = `UI/UX` → Assignee = User
B). Для кожної з чотирьох конфігурацій створи новий issue з тегом `Client Escalation` і модулем
`UI/UX` і запиши Severity та Assignee:

- ескалація першою, прапорця Execute the next business rule у ній немає;
- ескалація першою, прапорець у ній є;
- розподіл першим, прапорця в ньому немає;
- розподіл першим, прапорець у ньому є.

Спершу запиши прогноз, потім порівняй з фактом. Наприкінці залиш ту конфігурацію, яку захистиш у
звіті.

**11.11.** *(бонус: webhook)* Потрібні: правило `Auto-Assign to UI/UX` (або `Client Escalation
Rule`) у навчальному проєкті і тестова адреса, яка показує вхідні HTTP-запити. Створи webhook у
**Setup → Issue Tracker → Webhooks**, підключи його до правила і доведи три речі: запит приходить,
коли правило спрацювало; не приходить, коли не спрацювало; збій адреси не ламає саме правило.

**11.12.** *(складніша: «правило проти людини»)* `Client Escalation Rule` працює на `Creation or
Updation`. Тімлід розібрався з issue з тегом `Client Escalation` і свідомо знижує Severity до
`Major`. Спрогнозуй, що станеться після збереження, перевір і запропонуй два способи дати людині
знизити Severity, не втрачаючи автоматичної ескалації для нових випадків.

---

# Розв'язки

**11.1.**
- Автоматизація issues живе в **Setup → Issue Tracker**, а не в **Setup → Automation**: у Workflow
  Rules немає вкладки для issues. І налаштовується вона для конкретного проєкту — через **Select
  Project**.
- Перша половина («Critical-баги призначаються на тімліда») — **business rule**: Execute On
  `Creation or Updation`, умова Severity = `Critical`, дія Assignee = тімлід. Це дія правила.
- Друга половина («дві доби без закриття — лист менеджеру») — **SLA**: ціль `Close Before` у 2 дні,
  рівень ескалації після цілі на менеджера з шаблоном листа. Business rule так не вміє — серед
  його подій немає часу.
- Листи: від SLA — лист ескалації за шаблоном; лист «тобі призначено issue» тімліду — це
  **Notifications**, окреме налаштування, не дія правила.

**11.2.** За моделлю з розділу 11.6:

| | що відбувається | Severity | Assignee |
|---|---|---|---|
| a | правило 1 збіглося → `Critical`; прапорець → далі; правило 2 збіглося → User B; прапорця немає → стоп | `Critical` | User B |
| b | правило 1 не збіглося → пропуск; правило 2 збіглося → User B; стоп | `Minor` | User B |
| c | це оновлення: правило 1 (є Updation) збіглося → `Critical`; прапорець → далі; правила 2 і 3 працюють лише на створення → пропуск | `Critical` | User C |
| d | тег `Escalation` ≠ `Client Escalation` → правило 1 пропуск; модуль не `UI/UX` → правило 2 пропуск; правило 3 збіглося → User C | `Minor` | User C |

Це прогноз, і його перевіряють: випадок c — заодно тест тригера (правила 2 і 3 на оновлення не
реагують), випадок d — тест точності умови.

**11.3.**
1. Правило створене в проєкті `Website`, а тест ішов у `Mobile App` — правила живуть на рівні
   проєкту.
2. Умова `Priority = High`: поля Priority в issue немає. За документом умова — `Tags = Client
   Escalation`.
3. Дія Severity = `High`: такого значення немає; шкала `None`, `Show stopper`, `Critical`, `Major`,
   `Minor`, а документ вимагає `Critical`.
4. Assignee = сам тестувальник: так не доводиться призначення — він і автор.
5. Тег поставлено наступного дня, а Execute On = `Creation`: навіть правильне правило тут не мало
   спрацювати. Тест перевіряв не те.
6. Висновок «Fail, правило не працює» хибний: зламана конфігурація і сценарій, а не продукт.
   Правильний запис — «конфігурація не відповідає вимогам; тест недійсний; повторити».

**11.4.** Готово, коли:

- у проєкті є вкладка **Issues** (можливо, під **•••**);
- User B видно в полі Assignee форми issue цього проєкту;
- у полі **Module** є `UI/UX`, `Backend`, `UI/UX Design`;
- у полі **Tags** пропонуються три теги;
- записано: поля форми (мають збігатися з переліком у розділі 11.2), Severity і Assignee за
  замовчуванням, список Execute On (порівняй його з таблицею в розділі 11.3).

**11.5.** Конфігурація:

| крок | поле | значення |
|---|---|---|
| Rule Details | **Name** | `Client Escalation Rule` |
| Rule Details | **Execute On** | `Issues Creation` |
| Criteria | умова | **Tags** · рівність · `Client Escalation` |
| Criteria | **Execute the next business rule** | не відмічено |
| Actions | **Severity** | `Critical` |
| Actions | **Assignee** (необов'язково) | User B |

Правило видно у списку проєкту. Якщо Tags у критерії не було — власне поле-Checkbox
`Client Escalation` у layout проєкту, умова «відмічено», заміна описана у звіті.

**11.6.** Очікувані результати:

| сценарій | очікування |
|---|---|
| новий issue з тегом | Severity = `Critical`; в Activity Stream зміна з часом створення |
| новий issue без тегу | Severity за замовчуванням, Activity Stream без зміни Severity |
| тег `Escalation` або `Client Feedback` | без змін |
| `Client Feedback` + `Client Escalation` + `Escalation` | `Critical`, одна зміна Severity в Activity Stream |
| тег доданий пізніше, `Creation` | без змін |
| тег доданий пізніше, `Creation or Updation` | `Critical` після збереження з тегом |
| контроль `BR1-00 Tag seed` | без змін — правило не діє заднім числом |

Якщо якийсь Actual інший — спершу перевір конфігурацію (проєкт, значення тегу, тригер), і лише
потім пиши розбіжність у звіт.

**11.7.** Конфігурація: `Auto-Assign to UI/UX`, Execute On `Creation`, Module = `UI/UX`, Assignee
= User B, **Save Rule**. Результати:

| issue | очікування |
|---|---|
| `BR2-01`, Module `UI/UX` | Assignee = User B, запис в Activity Stream |
| `BR2-02`, Module `Backend` | Assignee без змін |
| модуль порожній | Assignee без змін |
| вид **My Open** під User B | є `BR2-01`, немає `BR2-02` |

**11.8.** Приклад набору:

1. New issue with Module = UI/UX → assigned to User B.
2. New issue with Module = Backend → assignee unchanged.
3. New issue without Module → assignee unchanged.
4. New issue with Module = UI/UX Design → assignee unchanged (no partial match).
5. Existing Backend issue changed to UI/UX, Execute On = Creation → assignee unchanged.
6. Issue with Module = UI/UX and tag "Client Escalation" → result follows rule order and the
   Execute the next business rule checkbox (expected per the order table).
7. Module changed to UI/UX by bulk update from the list view → record whether the rule runs.
8. Issue imported from a file with Module = UI/UX → record whether the rule runs.

Повністю, наприклад:

**Scenario 3**
- Title: Issue without Module is not assigned by the rule
- Precondition: rule "Auto-Assign to UI/UX" is saved (Execute On = Creation; Module = UI/UX →
  Assignee = User B).
- Steps:
   1. Create issue "BR2-03 No module", leave Module and Assignee empty.
   2. Save and open the issue; open Activity Stream.
- Expected Result: Assignee stays empty (or at its default); Activity Stream has no assignee change.
- Actual Result: [ ]
- Pass/Fail: [ ]
- Notes/Attachments: screenshot of the issue and Activity Stream.

**Scenario 5**
- Title: Changing Module to UI/UX on an existing issue does not trigger a Creation rule
- Precondition: rule "Auto-Assign to UI/UX" with Execute On = Creation; issue "BR2-02 API timeout
  on save" exists with Module = Backend and no assignee.
- Steps:
   1. Open "BR2-02 API timeout on save", set Module = UI/UX, save.
   2. Open Activity Stream.
- Expected Result: Module = UI/UX; Assignee unchanged; no rule change in Activity Stream.
- Actual Result: [ ]
- Pass/Fail: [ ]
- Notes/Attachments: screenshot of Activity Stream.

**11.9.** Пакет готовий, коли в ньому є: сценарії для обох правил (позитив, негативи, тригер,
порядок, інший проєкт) у форматі документа з заповненими Actual і Pass/Fail; чек-лист у форматі
Checklist Item · Completed (Y/N) · Notes; відео (конфігурація, позитив, негатив, доказ,
висновок); розділ звіту, де окремо названо, що перевірено, що знайдено і що рекомендовано, —
як у прикладі з розділу «Як це тестувати».

**11.10.** Очікування (issue з тегом і модулем `UI/UX`):

| порядок | прапорець у верхньому правилі | Severity | Assignee |
|---|---|---|---|
| ескалація, потім розподіл | немає | `Critical` | без змін |
| ескалація, потім розподіл | є | `Critical` | User B |
| розподіл, потім ескалація | немає | без змін | User B |
| розподіл, потім ескалація | є | `Critical` | User B |

Після кожної зміни порядку — **Save Order** і новий issue: старий уже оброблений. Якщо факт не
збігся з таблицею, запиши реальну поведінку — вона і є результатом завдання. Для здачі
найзручніше захищати варіант «ескалація першою, прапорець у ній»: специфічніше правило стоїть
вище, і спрацьовують обидва.

**11.11.**
1. **Setup → Issue Tracker → Webhooks → Add Webhook** (або **Create a Webhook**): назва, адреса
   «пастки», `POST`, параметри issue у форматі user defined → **Save**.
2. Правило → **Edit** → **Actions** → **Call webhooks** (або **Associate Webhook**) → наявний webhook
   → **Save Rule**.
3. Докази:
   - UI/UX-issue → один запит у «пастці» з даними цього issue (скріншот запиту з часом);
   - issue з іншим модулем → нових запитів немає (скріншот «пастки» з часом);
   - хибна адреса → issue створений і призначений на User B; збій видно на сторінці Webhook
     Failures (якщо знайшов її — скріншот); адресу повернуто, новий запит знову приходить.
4. У звіт: формат, у якому прийшли дані, і ліміти (1000 викликів на день на портал, без повторів,
   вимкнення після 10 невдач поспіль).

**11.12.** Прогноз: оновлення → умова `Tags = Client Escalation` досі виконана → правило знову
ставить `Critical`. Людина не може знизити Severity, поки тег на місці. Способи:

1. **Тригер на зміну тегу.** Execute On = `Field Update` з полем **Tags** (якщо список полів
   Field Update його пропонує): правило спрацює, коли тег додали, і не заважатиме правкам інших
   полів. Але будь-яка наступна зміна тегів (додали інший тег, а `Client Escalation` лишився)
   запустить його знову — перевір і цей випадок.
2. **Тег як стан, а не ярлик.** Домовитися, що знижуючи Severity, тімлід знімає тег `Client
   Escalation` (ескалація закрита). Правило на `Creation or Updation` тоді не спрацює.

Який би спосіб не обрали — перевір обидва напрямки: нова ескалація досі дає `Critical`, а свідоме
зниження тепер тримається.

---

## Ворота уроку

- [ ] пояснюєш, чим business rule відрізняється від workflow rule задач, SLA, Notifications і layout
  rules;
- [ ] знаходиш **Setup → Issue Tracker → Business Rules** і не забуваєш про **Select Project**;
- [ ] називаєш шість варіантів Execute On і обираєш тригер під реальний процес;
- [ ] знаєш, яких полів в issue немає (Priority, Type), і чим їх замінити;
- [ ] будуєш умову з кількох рядків через AND/OR і Criteria pattern;
- [ ] прогнозуєш результат двох правил за порядком і прапорцем Execute the next business rule;
- [ ] налаштовуєш `Client Escalation Rule` без підглядання;
- [ ] налаштовуєш `Auto-Assign to UI/UX` і доводиш призначення з-під User B;
- [ ] перевіряєш негативи: схоже значення, порожнє значення, інший проєкт, тег доданий пізніше;
- [ ] читаєш **Activity Stream** і відрізняєш зміну від правила і від людини;
- [ ] знаєш, звідки береться лист про призначення і чому правило тут ні до чого;
- [ ] (бонус) налаштовуєш webhook і називаєш його обмеження;
- [ ] пишеш тест-сценарій і чек-лист у форматі документа;
- [ ] здані deliverables Assignment 1 і 2: тест-сценарії, чек-лист, відео, розділ фінального
  звіту;
- [ ] задачі 11.10–11.12 розв'язані без підглядання в розв'язки.
