# Урок 20. Kiosk Studio: розгалуження, дії і тестування A20

*Після уроку ти збираєш багатоекранний кіоск з рішенням, створенням записів і листами, ставиш його
на Home page, проводиш п'ять тестових сценаріїв A20 і здаєш пакет документів. Для QA це урок про
маршрутизацію: кожна гілка — окремий шлях, і перевіряти треба не лише те, що на гілці сталося, а й
те, чого на ній статися не повинно.*

---

## 20.1. Як рішення (Decision) веде потік

У простому кіоску гілку обирає людина — кнопкою. У складному частину розвилок робить сам кіоск:
елемент **Decision** перевіряє дані і спрямовує потік. Умови рішення можуть спиратися на поля
попередніх екранів або на дані CRM (Current Record, GetRecords, запити). Для кожної гілки задаєш
назву і умову (criteria); гілка за замовчуванням (default path) є завжди, і туди йде все, що не
підійшло під жодну умову.

У Kiosk 2 рішення `Route_by_Category` дивиться на поле **Job Category** першого екрана:

| значення Job Category | гілка | наступний екран |
|---|---|---|
| `Technology` | `Technology_Path` | `Technology_Screening` |
| `Finance` | `Finance_Path` | `Finance_Screening` |
| `Sales`, `Other` і будь-що інше | `General_Path` (default) | `General_Intake` |

Три речі, які з цього випливають для тестування:

1. **Помилка в умові мовчазна.** Якщо в умові Finance_Path значення набране інакше, ніж у picklist
   першого екрана, кіоск не впаде — він тихо відправить фінансиста в default path. Далі все
   «працює»: створюється лід, з'являється подяка. Тільки Lead Source не той і лист нікому не пішов.
   Тому кожен тест маршрутизації перевіряє і «з'явився потрібний екран», і «не з'явилися інші».
2. **Умови мають бути взаємовиключними.** Довідка не описує, яку гілку обере кіоск, якщо підійдуть
   дві умови одразу. Тут умови не перетинаються (одне значення picklist не може бути водночас
   Technology і Finance), і так і має бути.
3. **Гілки не зливаються назад** (за FAQ Zoho, цього поки не можна зробити). Тому кожна з трьох гілок
   закінчується власним екраном підтвердження, і їх три: `Confirmation_Tech`, `Confirmation_Finance`,
   `Confirmation_General`. Три копії однакового екрана — три місця, де текст чи merge-поле можуть
   розійтися.

## 20.2. Дії: Create Record і Email Notifications

### Створення запису

Дія **Create records** має два режими (довідка):

- **Predefined Configuration** — запис створюється автоматично під час проходження кіоска. Значення
   полів задаєш наперед: статичним значенням або значенням з поля попереднього екрана. Підходить,
   коли все потрібне для запису відомо з екранів.
- **Via User Input** — під час проходження відкривається Quick Create форма модуля, і людина
   заповнює її сама. Якщо в користувача немає права Create у модулі, крок пропускається, а пов'язані
   значення стають порожніми.

Kiosk 2 використовує Predefined Configuration: кожне потрібне поле ліда зіставляєш з джерелом.

| поле ліда | Technology_Path | Finance_Path | General_Path |
|---|---|---|---|
| First Name | First Name (Basic_Registration) | так само | так само |
| Last Name | Last Name (Basic_Registration) | так само | так само |
| Email | Email Address (Basic_Registration) | так само | так само |
| Phone | Phone Number (Basic_Registration) | так само | так само |
| Lead Source | статичне `Web Download` | статичне `Cold Call` | статичне `Web Research` |
| Description | Additional Notes (Technology_Screening) | Additional Notes (Finance_Screening) | Additional Notes (General_Intake) |
| лист | User B | User C | не надсилається |

Статичне значення для picklist має існувати в полі CRM. У тріалі в Lead Source немає `Other`, тому
для загальної гілки взято `Web Research` — значення, що є в списку. Lead Source тут слугує
«маркером гілки»: за ним у списку лідів видно, якою гілкою пройшов кожен кандидат.

Подивись на таблицю уважно: поля **Years of Experience**, **Primary Technical Skill**,
**Certification or Qualification**, **Finance Specialisation** і **Current Role or Position** кіоск
збирає, але в лід не записує — жодна дія їх не використовує. Для QA це знахідка на рівні вимог:
обов'язкові поля, які нікуди не зберігаються. Її фіксують як спостереження (observation) і
уточнюють у замовника, а не як дефект продукту.

І ще одне поле: **Company**. Кіоск його не збирає. Якщо конфігурація дії Create records вимагатиме
заповнити обов'язкові поля модуля, дай Company статичне значення (наприклад, `Not provided`) і
запиши це як відхилення від завдання.

### Лист

Дія **Email Notifications** надсилає лист: у завданні задано назву дії, одержувача, тему і текст. У
шаблоні листа можна вставляти merge-поля (`${...}`), наприклад ім'я кандидата з першого екрана. У
завданні текст статичний: User B отримає «зареєстровано нового кандидата», але без імені й без
посилання на лід — ще одне спостереження для звіту.

Листи справжні. Кожен тестовий прохід Technology- і Finance-гілки, зокрема через **Test Run**,
надсилає лист User B чи User C.

### Послідовні дії і «успіх», який нічого не доводить

За довідкою, без окремого налаштування дії можуть виконуватися паралельно, а кіоск іде далі, не
чекаючи на них. Опція **Wait for completion** змушує кіоск дочекатися завершення дії перед
наступним кроком. Для більшості дій вона увімкнена сама, а для Activities, Create Record, Webhooks
і Functions її вмикають вручну. Лише з нею результат дії (наприклад, створений запис як
CreatedRecords) доступний на наступних екранах, і лише з нею можна додати окрему гілку на випадок
помилки (Failure path).

Наслідок для тестування: `Registration complete. The candidate record has been created in Zoho
CRM.` — статичний текст, який ти сам написав на екрані. Він не знає, чи створився лід, і в Kiosk 2
не залежить від результату дії. Текст підтвердження — не доказ. Доказ — лід у модулі Leads з
очікуваними значеннями.

**Пастка з увімкненням пізніше.** У тріалі (27.09.2026) підтверджено: якщо вмикаєш Wait for
completion, повертаючись до **вже створеної** дії (а не одразу під час першого налаштування), сам
перемикач ще нічого не зберігає — збереження відбувається лише на останньому екрані дії, натисканням
його власного **Save** (не **Next** саме по собі, і не **Cancel**, який відкидає й перемикач). Якщо
після ввімкнення виходиш через Cancel, дія лишається без Wait for completion, і CreatedRecords
далі недоступний.

### Чий це лід

Завдання не каже, хто стане власником (Lead Owner) створеного ліда. Перевір це на першому ж проході.
Якщо власник — той, хто пройшов кіоск, а ролі обмежують видимість записів, User B може отримати лист
про лід, якого не бачить. Це варто перевірити, увійшовши як User B.

## 20.3. Кіоск на Home page

Вкладка Home має кілька видів, їх перемикають у випадному списку праворуч угорі (довідка):

| вид | що це |
|---|---|
| Classic View | три стандартні компоненти; не налаштовується |
| User's Home Page | особиста сторінка: кожен сам додає компоненти для себе |
| Customized Home Page | сторінка, яку адміністратор створює і відкриває для ролей, профілів, користувачів, груп чи територій |
| Manager's Home Page | сторінка для керівників з підлеглими ролями |

Поточна довідка описує додавання кіоска перетягуванням з набору компонентів:

- **для себе (User's Home Page):** Home → випадний список → User's Home → **More → Add Component** →
   у **Get from** обери **Kiosk** → перетягни кіоск на сторінку;
- **для команди (Customized Home Page):** **Setup → Customization → Customize Home Page** (або Home →
   випадний список → Customize Home Page) → **+ New Home Page** → **Kiosk** → перетягни кіоск →
   розстав компоненти → **Save & Share** → у вікні Edit Properties вкажи назву, опис і з ким
   поділитися → **Save**. Потім переконайся, що сторінка активна (перемикач статусу в списку
   Customize Home Page).

У тріалі цей крок не перевірявся — так його описує довідка Zoho. Стаття довідки про Kiosk Studio
описує той самий крок інакше: More (`...`) → **Add Component** → **Kiosk** → **Next** → **Use**
навпроти кіоска → **Component Name** → **Save**. Якщо твій інтерфейс виглядає так, іди цим шляхом:
результат той самий — компонент із кіоском на Home page.

Для A20 важливі два моменти:

- **Назва компонента.** У тріалі (27.09.2026), шляхом **Customized Home Page** (крок вище), окремого
   поля для назви компонента немає: тайл на сторінці завжди показує власну назву кіоска
   (`CAND IntakeRouter`), а подвійний клік по заголовку його не робить редагованим. Завдання нижче все
   одно просить назвати компонент `New Candidate Registration` — це саме тому, що варто перевірити
   особисто: якщо на твоєму шляху поля для назви немає, запиши це як відхилення, а не як пропущений
   крок.
- **Хто бачить.** User's Home Page — особиста, її бачиш тільки ти. Щоб кіоск бачили User B і User C,
   потрібна Customized Home Page, відкрита їхнім ролям або профілям.

На Home page немає «поточного запису», тож Current Record тут порожній. Kiosk 2 на нього і не
спирається: усі дані він бере з власних екранів.

## 20.4. Покроково: Kiosk 2 — CAND_IntakeRouter

**Мета:** рекрутери і рецепція реєструють звернення кандидата з Home page; кіоск збирає дані,
розводить потік за категорією, створює лід і сповіщає потрібну людину для Technology і Finance.

| параметр | значення |
|---|---|
| Kiosk Name | `CAND_IntakeRouter` |
| Description | `Multi-screen candidate registration and routing kiosk. Branches by job category and creates a Lead record upon submission.` |
| Access Location | компонент CRM Home Page |

Вікно Create Kiosk збігається з тим, що видно в тріалі. Кроки всередині Kiosk Studio описано за
текстом завдання і довідкою Zoho — якщо підпис трохи інший, шукай за змістом. Не користуйся **Test
Run** як основним способом перевірки: кожен прохід створює лід і надсилає лист.

**Крок 1. Створи кіоск.** **Setup → Customization → Kiosk Studio** → **Create Kiosk** (або **Get
Started**, якщо кіосків ще немає). Kiosk Name `CAND_IntakeRouter`, **Unified API Name** (обов'язкове;
наприклад `CAND_IntakeRouter`), Description як вище → **Next**. Модуль задавати не потрібно: кіоск
відкриватимуть з Home page, де поточного запису немає.

**Крок 2. Екран Basic_Registration.** **+** → **Screen** → **Add**, назва `Basic_Registration`.
Елементи в такому порядку:

| # | елемент | Label | налаштування |
|---|---|---|---|
| 1 | Text (Display Element) | — | `Welcome to SwiftHire Candidate Registration. Please complete all mandatory fields to register a new candidate inquiry.` |
| 2 | Field — Single Line | `First Name` | Mandatory |
| 3 | Field — Single Line | `Last Name` | Mandatory |
| 4 | Field — Email | `Email Address` | Mandatory |
| 5 | Field — Phone | `Phone Number` | Mandatory |
| 6 | Field — Pick List (Local) | `Job Category` | Mandatory; значення `Technology`, `Finance`, `Sales`, `Other` |

Одна кнопка: `Continue`.

`Other` тут — значення локального picklist кіоска, воно нікуди в CRM не пишеться, тож це нормально,
що в Lead Source такого значення немає.

**Крок 3. Рішення Route_by_Category.** На гілці після **Continue** натисни **+** і додай
**Decision** з назвою `Route_by_Category`:

| шлях | Name | Criteria |
|---|---|---|
| Condition Path 1 | `Technology_Path` | поле Job Category з екрана Basic_Registration = `Technology` |
| Condition Path 2 | `Finance_Path` | поле Job Category з екрана Basic_Registration = `Finance` |
| Default Path | `General_Path` | усе інше: Sales, Other, будь-яке значення без збігу |

**Що побачиш:** від рішення відходять три гілки — дві умовні і гілка за замовчуванням.

**Крок 4. Екран Technology_Screening (екран 2T).** На гілці `Technology_Path` → **+** → **Screen**
`Technology_Screening`:

| елемент | Label | налаштування |
|---|---|---|
| Text | — | `Technology Role — Additional Screening. Please provide the following details for this candidate.` |
| Field — Number | `Years of Experience` | Mandatory; максимум цифр (Maximum digits allowed) — `2` |
| Field — Single Line | `Primary Technical Skill` | Mandatory |
| Field — Multi-line | `Additional Notes` | не обов'язкове |

Одна кнопка: `Submit Registration`.

**Крок 5. Дії Technology-гілки.** На гілці після **Submit Registration** екрана 2T → **+** →
**Action**.

Дія 1 — **Create records → Predefined Configuration**:

| параметр | значення |
|---|---|
| Action Name | `Create_Lead_Tech` |
| Wait for completion | увімкни одразу — без неї наступна дія (лист) не отримає CreatedRecords |
| Module | Leads |
| Lead Owner | обов'язкове поле — обери значення (наприклад, Logged in User); порожнім не збереже |
| First Name | ← First Name (Basic_Registration) |
| Last Name | ← Last Name (Basic_Registration) |
| Email | ← Email Address (Basic_Registration) |
| Phone | ← Phone Number (Basic_Registration) |
| Lead Source | статичне значення `Web Download` |
| Description | ← Additional Notes (Technology_Screening) |

Далі на тій самій гілці ще раз **+** → дія 2 — **Email Notifications**:

| параметр | значення |
|---|---|
| Action Name | `Notify_UserB_Tech` |
| Execute for record | обов'язкове поле, у тріалі (27.09.2026) підтверджено: три категорії CurrentRecord /
   GetRecords / CreatedRecords, кожна недоступна, якщо джерела немає; обери **CreatedRecords:
   Create_Lead_Tech > CreatedRecord (Leads)** — з'являється лише коли в Create_Lead_Tech увімкнено
   Wait for completion |
| Recipient (To) | User B |
| Email Template | шаблон із темою `New Technology Candidate Registered` і текстом `A new Technology candidate has been registered in Zoho CRM. Please review the lead record at your earliest convenience.` |

У тріалі (27.09.2026) підтверджено: Email Notification не має вбудованих полів Subject/Body — тема й
текст задаєш лише через окремий **Email Template** (Setup → Templates → Email, або кнопка **Create
Template** з вибору шаблону — вона відкривається в новому вікні браузера). Створи шаблон із цими
темою і текстом заздалегідь, потім обери його. У полі одержувача (**To**) варіанти обмежені: «People
Associated with the Module» → Lead (поля запису, як-от Email, Owner) або «Users» → **Logged in
User**/конкретний користувач зі списку користувачів організації — вільного вводу адреси й ролей
User B/User C серед варіантів немає, бо вони не існують як користувачі CRM. Признач одержувачем
**Logged in User**: у своєму тріалі перевіриш весь потік, а в реальній організації сюди підставляють
CRM-користувача, що відповідає за напрям.

**Крок 6. Екран Finance_Screening (екран 2F).** На гілці `Finance_Path` → **+** → **Screen**
`Finance_Screening`:

| елемент | Label | налаштування |
|---|---|---|
| Text | — | `Finance Role — Additional Screening. Please provide the following details for this candidate.` |
| Field — Single Line | `Certification or Qualification` | Mandatory |
| Field — Single Line | `Finance Specialisation` | Mandatory; tooltip (Show tool tip): `Example: Corporate Finance, Risk, Audit, Tax.` |
| Field — Multi-line | `Finance Additional Notes` | не обов'язкове |

Назва поля нотаток тут — не «Additional Notes», а **`Finance Additional Notes`**. У тріалі
(27.09.2026) підтверджено: назви полів мають бути унікальні в межах усього кіоска, а не лише екрана
— друге поле з такою самою назвою, як на Technology_Screening, дає живу помилку «A field with this
name already exists». Те саме для екрана 2G нижче.

Одна кнопка: `Submit Registration`.

**Крок 7. Дії Finance-гілки.** Після **Submit Registration** екрана 2F:

- дія 1 — Create records → Predefined Configuration, Action Name `Create_Lead_Finance`, Wait for
   completion увімкнено одразу, Module Leads, **Lead Owner** обов'язкове (обери значення), те саме
   зіставлення First Name / Last Name / Email / Phone з Basic_Registration, **Lead Source** —
   статичне `Cold Call`, **Description** ← **Finance Additional Notes** (**Finance_Screening**);
- дія 2 — Email Notifications, Action Name `Notify_UserC_Finance`, **Execute for record** →
   CreatedRecords: Create_Lead_Finance > CreatedRecord (Leads), Recipient (To) **User C**, Email
   Template з темою `New Finance Candidate Registered` і текстом `A new Finance candidate has been
   registered in Zoho CRM. Please review the lead record at your earliest convenience.`

Найчастіша помилка тут — зіставити Description з Additional Notes не того екрана. На кожній гілці
своє поле нотаток (з унікальною назвою), і в Finance-дії потрібне саме поле з Finance_Screening.

**Крок 8. Екран General_Intake (екран 2G).** На гілці `General_Path` → **+** → **Screen**
`General_Intake`:

| елемент | Label | налаштування |
|---|---|---|
| Text | — | `General Application — Please provide the following details for this candidate.` |
| Field — Single Line | `Current Role or Position` | не обов'язкове |
| Field — Multi-line | `General Additional Notes` | не обов'язкове (та сама причина унікальності назв — див. крок 6) |

Одна кнопка: `Submit Registration`.

**Крок 9. Дія General-гілки.** Після **Submit Registration** екрана 2G — лише одна дія: Create
records → Predefined Configuration, Action Name `Create_Lead_General`, **Lead Owner** обов'язкове
(обери значення), Module Leads, те саме зіставлення з Basic_Registration, **Lead Source** — статичне
`Web Research`, **Description** ← **General Additional Notes** (**General_Intake**). Листа на цій
гілці немає.

**Крок 10. Екрани підтвердження.** У кінці кожної з трьох гілок, після дій, додай **Screen**. Назви —
унікальні: `Confirmation_Tech`, `Confirmation_Finance`, `Confirmation_General`. Кожен містить:

- Text: `Registration complete. The candidate record has been created in Zoho CRM. Thank you.`
- Field — Single Line з Label `Registered Name` (на Confirmation_Tech), **`Registered Name Finance`**
   (на Confirmation_Finance), **`Registered Name General`** (на Confirmation_General) — та сама
   причина унікальності назв, що й для нотаток: увімкни Merge from module, `#` → екран
   Basic_Registration → **First Name**; Read Only;
- одну кнопку `Close`.

**Що побачиш:** повне дерево кіоска:

```
Basic_Registration → Continue → Route_by_Category
   ├── Technology_Path → Technology_Screening → Submit Registration
   │      → Create_Lead_Tech (Leads, Web Download) → Notify_UserB_Tech → Confirmation_Tech → Close
   ├── Finance_Path → Finance_Screening → Submit Registration
   │      → Create_Lead_Finance (Leads, Cold Call) → Notify_UserC_Finance → Confirmation_Finance → Close
   └── General_Path (default) → General_Intake → Submit Registration
          → Create_Lead_General (Leads, Web Research) → Confirmation_General → Close
```

**Крок 11. Опублікуй.** Натисни **Publish**. У тріалі (27.09.2026) підтверджено: після Publish
Kiosk Studio показує список «Associate with…» (Home Page / Setup Page / Custom Buttons / Record
Detail View / Blueprint / Canvas / Mobile Canvas) — кожен пункт **Associate** відкриває налаштування
в новій вкладці браузера. Якщо нову вкладку відкрити незручно (або її блокує браузер), закрий це
вікно (**I'll do it later**) і онови компонент вручну кроком 12 — результат той самий.

**Крок 12. Компонент на Home page.** Відкрий Home page в режимі налаштування (шляхи — у розділі про
Home page вище), обери **Kiosk** у наборі компонентів (це окрема категорія в лівій панелі, під
іконкою — не плутай з Dashboard Components) і перетягни `CAND_IntakeRouter` на сторінку. У тріалі
(27.09.2026) підтверджено: **окремого поля для назви компонента немає** — тайл на Home page завжди
показує власну назву кіоска (тут — «CAND IntakeRouter»), подвійний клік по заголовку його не робить
редагованим. Просто натисни **Save** (для Customized Home Page — **Save & Share**, поділись з ролями
чи профілями тих, хто тестуватиме, і переконайся, що сторінка активна).

**Що побачиш:** на Home page з'являється компонент з назвою кіоска — **`CAND IntakeRouter`** (не
`New Candidate Registration`: такого окремого поля немає, назва компонента завжди дорівнює назві
кіоска); відкривши його, бачиш перший екран кіоска — текст привітання і поля Basic_Registration.
Перевір, що компонент видимий і доступний твоєму користувачу, а якщо тестуватиме User B чи User C —
і їм.

**Що легко відкотити, а що ні.** Кіоск і компонент змінюються будь-коли (Edit → Publish у Kiosk
Studio; налаштування Home page). Створені під час проб ліди і надіслані листи залишаються:
тестові ліди потім видаляють вручну, листи — ні.

## 20.5. Part 3: п'ять тестових сценаріїв

Для кожного сценарію документуєш передумови, виконані кроки і фактичний результат. Тестові дані
роби впізнаваними й унікальними для кожного проходу: імена `Tech Candidate 01`, `Fin Candidate 01`,
`Gen Candidate 01`, адреси в домені `example.com` (він зарезервований для прикладів і нікому не
належить).

**Test Scenario 1 — простий кіоск: оновлення поля через кнопку, наскрізно.**
Передумови: є кіоск `LC_QuickUpdate` на кнопці `Log Call Outcome` картки ліда; тестовий лід з
відомими Lead Status і Description. Кроки: відкрий лід → **Log Call Outcome** → перевір, що
відкрився екран `Call_Outcome_Entry` і поле Lead Name містить ім'я цього ліда → обери статус у
**Update Lead Status**, введи текст у **Call Notes** → **Save & Close** → перевір екран
`Confirmation` з текстом про успіх → **Close** → відкрий лід знову. Очікувано: Lead Status і
Description дорівнюють введеним у кіоску.

**Test Scenario 2 — простий кіоск: Cancel не змінює запис.**
Передумови ті самі. Кроки: запиши поточні Lead Status і Description → **Log Call Outcome** → заповни
обидва поля → **Cancel** (не Save & Close) → перевір екран `Cancelled` з текстом `No changes were
made.…` → **Close** → відкрий лід. Очікувано: Lead Status і Description такі самі, як до тесту.

**Test Scenario 3 — складний кіоск: Technology-гілка наскрізно.**
Кроки: на Home page відкрий компонент з `CAND_IntakeRouter` → заповни Basic_Registration коректними
значеннями, Job Category = `Technology` → **Continue** → перевір, що з'явився `Technology_Screening`,
а не Finance_Screening чи General_Intake → заповни обов'язкові поля → **Submit Registration** →
перевір підтвердження: Registered Name показує введене ім'я → відкрий модуль Leads. Очікувано:
новий лід зі значеннями з екранів, Lead Source = `Web Download`; User B отримав лист (якщо це можна
перевірити в тріалі).

**Test Scenario 4 — складний кіоск: Finance-гілка і адресат листа.**
Кроки: те саме, Job Category = `Finance` → **Continue** → має з'явитися `Finance_Screening` →
обов'язкові поля → **Submit Registration** → підтвердження → Leads. Очікувано: новий лід з Lead
Source = `Cold Call`; лист отримав User C, а User B — ні.

**Test Scenario 5 — складний кіоск: default path для решти категорій.**
Кроки: Job Category = `Sales` або `Other` → **Continue** → має з'явитися `General_Intake` (кіоск
правильно відправив «чуже» значення в default path) → заповни необов'язкові поля → **Submit
Registration** → підтвердження → Leads. Очікувано: лід з Lead Source = `Web Research`; листів немає.
Найсильніший варіант — пройти обидва значення, `Sales` і `Other`, окремо.

**Як перевіряти листи.** Відкрий скриньки, на які зареєстровано User B і User C, і подивись вхідні
та спам одразу після проходу. Для «User B не отримав» дивишся скриньку User B в той самий момент і
фіксуєш порожній результат. Якщо до скриньки доступу немає, пиши чесно: `Not verifiable in the trial
— no access to the User B mailbox`, а не Pass.

**Про TS3 і «values entered on both screens».** Очікування сценарію звучить як «лід містить значення
з обох екранів». Але за конфігурацією з екрана 2T у лід потрапляє тільки Additional Notes (у
Description); Years of Experience і Primary Technical Skill нікуди не записуються. Тест-кейс має
перевіряти те, що конфігурація справді обіцяє, а розрив між очікуванням і конфігурацією — окреме
спостереження у звіті.

## 20.6. Як це тестувати: понад п'ять сценаріїв

П'ять сценаріїв покривають щасливі шляхи. Ось що варто додати, щоб маршрутизацію справді було
перевірено:

| ідея | що перевіряє | очікування |
|---|---|---|
| кожне з шести полів Basic_Registration порожнє | обов'язковість | Continue не пускає далі |
| Email Address без `@` | формат email | значення не приймається; фактичну реакцію зафіксуй |
| Phone Number з літерами | формат телефону | зафіксуй фактичну реакцію |
| Years of Experience = `0`, `99` | межі поля Number | приймається |
| Years of Experience = `100` (3 цифри), `-1`, `2.5` | Maximum digits = 2, від'ємні, дробові | 3 цифри не приймаються; для решти зафіксуй поведінку |
| Primary Technical Skill порожнє на 2T | обов'язковість на другому екрані | Submit Registration не пускає |
| Additional Notes порожнє | необов'язкове поле | лід створено, Description порожній |
| закрити кіоск після Continue, до Submit | дії лише після Submit | ліда не створено, листа немає |
| двічі той самий email | дублікати | чи створюються два ліди — зафіксуй; для рекрутинг-бази це ризик |
| кирилиця в іменах | кодування | ім'я в ліді й у Registered Name без спотворень |
| User B відкриває Home page | доступ до компонента | бачить компонент, якщо сторінку йому відкрито |
| власник створеного ліда | видимість для адресата листа | User B бачить лід, про який отримав лист |
| Kiosk 1 після змін | регресія | кнопка й оновлення ліда працюють як раніше |

**Дефект чи спостереження.** Дефект — продукт робить не те, що налаштовано (лід на Finance-гілці
отримав `Web Download`, лист пішов не тому адресату). Спостереження — система робить налаштоване, але
налаштоване розходиться з потребою (зібрані й загублені поля, лист без імені кандидата, текст
підтвердження, який «обіцяє» лід навіть без нього). Спостереження йдуть у звіт окремим розділом.

**Test Scenarios document (Zoho Writer).** Для кожного з п'яти сценаріїв: ID і назва, мета,
передумови, тестові дані, кроки, очікуваний результат, фактичний результат, статус (Pass / Fail /
Blocked / Not verifiable), посилання на докази, примітки.

**Test Cases table (Zoho Sheet).** Той самий формат, що й для простого кіоска:

| TC ID | Title | Preconditions | Steps | Expected Result | Actual Result | Status | Evidence |
|---|---|---|---|---|---|---|---|
| A20-TS3-01 | Technology category routes to Technology_Screening and creates a Web Download lead | CAND_IntakeRouter on Home page; User B active | 1. Open New Candidate Registration. 2. Fill Basic_Registration: First Name `Tech`, Last Name `Candidate 01`, `tech01@example.com`, `+380501112233`, Job Category `Technology`. 3. Continue. 4. Enter `5`, `Python`, notes `Strong backend`. 5. Submit Registration. 6. Open Leads. | Step 3: Technology_Screening shown (not 2F/2G). Step 5: Confirmation_Tech, Registered Name = `Tech`. Step 6: new lead with entered name, email, phone, Lead Source = Web Download, Description = `Strong backend`; User B got the email | | | TS3-*.png |
| A20-TS5-02 | Other category goes to the default path, no email | as above; User B and User C mailboxes open | Same flow with `Gen Candidate 02`, Job Category `Other`, notes empty | General_Intake shown; lead with Lead Source = Web Research, empty Description; no email to User B or User C | | | TS5-*.png |

**Defect Report (Zoho Writer).** На кожен дефект: ID, коротка назва, середовище (тріал, EU, дата),
кілька рядків про вплив простими словами («фінансові кандидати маркуються як Web Download, звіт за
джерелами бреше»), передумови, кроки, очікуваний і фактичний результат, серйозність, докази.

## 20.7. Part 4: що здати

Усе створюється в Zoho Office Suite і передається ментору публічним посиланням у чаті. Назва
документа має відповідати назві завдання, тож починай назви з `Kiosk Studio in Zoho CRM (A20)`.
Файли зберігай у WorkDrive (у новому тріалі її спершу додають в **Admin Panel → Applications → Add
Application → WorkDrive**).

| # | Deliverable | Format | Tool |
|---|---|---|---|
| 1 | Test Scenarios document covering all 5 scenarios | Writer document | Zoho Writer |
| 2 | Test Cases table | Spreadsheet | Zoho Sheet |
| 3 | Defect Report documenting any discrepancies observed during testing, if applicable | Writer document | Zoho Writer |
| 4 | Screenshots or screen recording (перелік нижче) | Image or video | Any screen capture tool |

Перелік обов'язкових доказів і звідки їх узяти:

| що показати | де зняти |
|---|---|
| обидва налаштовані кіоски в Kiosk Studio | дерева `LC_QuickUpdate` і `CAND_IntakeRouter` у Kiosk Studio |
| опублікований компонент кіоска на Home page | Home page з компонентом `New Candidate Registration` |
| кастомна кнопка на ліді | картка ліда з кнопкою `Log Call Outcome` |
| щонайменше одне повне проходження Technology-гілки з усіма трьома екранами | Basic_Registration → Technology_Screening → Confirmation_Tech (краще відео) |
| щонайменше одне оновлення поля, підтверджене в ліді після тесту простого кіоска | картка ліда до і після TS1 |

## 20.8. Типові помилки

**1. Умова рішення не збігається зі значенням picklist.** Помилки немає, просто все йде в default
path. Підказка — `Web Research` у лідів, які мали бути Technology чи Finance.

**2. Description з «чужого» Additional Notes.** У Finance-дії обрано поле з Technology_Screening —
Description фінансового ліда порожній.

**3. Merge у Registered Name не з того екрана.** Підтвердження показує порожнє чи чуже ім'я.

**4. Статичне значення Lead Source, якого немає в CRM.** Значення `Other` у тріалі немає — бери
`Web Research`.

**5. Лист на неправильній гілці або не тому адресату.** User B отримує листи про фінансистів — дія
скопійована з Technology-гілки без зміни Recipient.

**6. Однакові назви підтверджень.** Три екрани `Confirmation` не пройдуть: назви мають бути
унікальні.

**7. Компонент на особистій User's Home Page.** Ти кіоск бачиш, User B і User C — ні.

**8. Перевірка через Test Run.** Кожен прохід створює лід і надсилає лист; тестова база
засмічується, а в скриньках User B і User C плутанина.

**9. Довіра до екрана підтвердження.** Текст про успіх статичний і не залежить від результату дії
створення. Перевіряй у модулі Leads.

**10. «Pass» для листа, якого не бачив.** Якщо скриньку User B перевірити не можна, статус — Not
verifiable, а не Pass.

### Симптом → причина

| симптом | найімовірніша причина |
|---|---|
| Technology чи Finance відкриває General_Intake | значення в умові рішення не збігається зі значенням picklist Job Category |
| усі нові ліди мають Lead Source `Web Research` | рішення не спрацьовує — див. рядок вище |
| Description порожній, хоча нотатки вводили | Description зіставлено з Additional Notes іншого екрана |
| Registered Name порожній | merge взято не з Basic_Registration або не з First Name |
| на Finance-гілці лист отримав User B | дія листа скопійована без зміни Recipient |
| листа немає зовсім | неправильна адреса користувача; лист у спамі; дія листа не на тій гілці |
| кіоска немає в наборі компонентів Home page | кіоск не опубліковано або він неактивний |
| User B не бачить компонент | компонент на твоїй User's Home Page; Customized Home Page не відкрита його ролі чи профілю або неактивна |
| Continue пропускає далі з порожнім полем | поле не позначене Mandatory |
| на Years of Experience вводиться `100` | не задано Maximum digits allowed = 2 |
| підтвердження є, а ліда в Leads немає | дія створення не спрацювала; текст підтвердження від неї не залежить |
| у Leads з'явилися дивні тестові ліди | хтось перевіряв кіоск через Test Run |

## 20.9. Що варто запам'ятати

1. Рішення обирає гілку за даними; default path є завжди і ловить усе, що не підійшло.
2. Помилка в умові рішення не падає — потік тихо йде в default path; перевіряй і потрібний екран, і
   відсутність інших.
3. Гілки не зливаються: три гілки — три дії, три екрани підтвердження, три місця для помилки.
4. Create records → Predefined Configuration бере значення з попередніх екранів або статичні;
   статичне значення picklist має існувати в CRM.
5. Поля, які кіоск збирає, але жодна дія не записує, — втрачені дані; це спостереження для звіту.
6. Екран «успіху» не доводить, що запис створено; доказ — сам запис.
7. Листи з кіоска справжні, навіть у Test Run; тестуй зі скриньками, до яких маєш доступ.
8. Кіоск на Home page не має Current Record; щоб його бачили інші, потрібна Customized Home Page,
   відкрита їхнім ролям чи профілям.
9. Тестові дані — унікальні й упізнавані на кожен прохід.
10. Не перевірив — не Pass: для неперевірного пиши Not verifiable з причиною.

---

# Задачі

**20.1.** *(передбач)* Рішення `Route_by_Category`: Technology_Path — Job Category = `Technology`,
Finance_Path — Job Category = `Finanse` (помилка в слові), default — General_Path. Кандидат обирає
на першому екрані `Technology`, потім інший кандидат — `Finance`, третій — `Sales`. Який екран
побачить кожен, з яким Lead Source буде кожен лід і хто отримає листи? Чи впаде щось?

**20.2.** Поясни, чому в Kiosk 2 три окремі екрани підтвердження, а не один спільний. Які ризики це
створює і як їх перевірити тестами?

**20.3.** Створи кіоск `CAND_IntakeRouter` (Unified API Name на твій вибір, опис `Multi-screen
candidate registration and routing kiosk. Branches by job category and creates a Lead record upon
submission.`). Додай екран `Basic_Registration`: Text `Welcome to SwiftHire Candidate Registration.
Please complete all mandatory fields to register a new candidate inquiry.`; обов'язкові Single Line
`First Name` і `Last Name`, Email `Email Address`, Phone `Phone Number`, Pick List (Local) `Job
Category` зі значеннями `Technology`, `Finance`, `Sales`, `Other`; кнопка `Continue`. Після
Continue додай рішення `Route_by_Category` з шляхами `Technology_Path` (Job Category з
Basic_Registration = Technology), `Finance_Path` (= Finance) і default `General_Path`.

**20.4.** У кіоску з рішенням `Route_by_Category` (шляхи Technology_Path, Finance_Path, default
General_Path; перший екран Basic_Registration з First Name, Last Name, Email Address, Phone Number,
Job Category) налаштуй Technology-гілку: екран `Technology_Screening` (Text `Technology Role —
Additional Screening. Please provide the following details for this candidate.`; Number `Years of
Experience`, обов'язкове, максимум 2 цифри; Single Line `Primary Technical Skill`, обов'язкове;
Multi-line `Additional Notes`, необов'язкове; кнопка `Submit Registration`), дію Create records →
Predefined Configuration `Create_Lead_Tech` (Leads; Wait for completion увімкнено одразу; Lead Owner
обов'язкове; First Name, Last Name, Email, Phone з Basic_Registration; Lead Source `Web Download`;
Description ← Additional Notes з Technology_Screening) і дію Email Notifications
`Notify_UserB_Tech` (Execute for record → CreatedRecords: Create_Lead_Tech > CreatedRecord (Leads);
Recipient User B; Email Template з темою `New Technology Candidate Registered` і текстом `A new
Technology candidate has been registered in Zoho CRM. Please review the lead record at your earliest
convenience.`).

**20.5.** У тому ж кіоску налаштуй Finance-гілку: екран `Finance_Screening` (Text `Finance Role —
Additional Screening. Please provide the following details for this candidate.`; Single Line
`Certification or Qualification`, обов'язкове; Single Line `Finance Specialisation`, обов'язкове, з
підказкою `Example: Corporate Finance, Risk, Audit, Tax.`; Multi-line `Finance Additional Notes`
(назва відрізняється від Technology-екрана — назви полів унікальні в межах кіоска), необов'язкове;
кнопка `Submit Registration`), дію `Create_Lead_Finance` (Leads; Lead Owner обов'язкове; ті самі
чотири поля з Basic_Registration; Lead Source `Cold Call`; Description ← Finance Additional Notes з
Finance_Screening) і лист `Notify_UserC_Finance` (Execute for record → CreatedRecords; Recipient
User C; Email Template з темою `New Finance Candidate Registered` і текстом `A new Finance
candidate has been registered in Zoho CRM. Please review the lead record at your earliest
convenience.`).

**20.6.** У тому ж кіоску налаштуй default-гілку General_Path: екран `General_Intake` (Text `General
Application — Please provide the following details for this candidate.`; Single Line `Current Role or
Position`, необов'язкове; Multi-line `General Additional Notes` (знову унікальна назва),
необов'язкове; кнопка `Submit Registration`) і дію `Create_Lead_General` (Leads; Lead Owner
обов'язкове; ті самі чотири поля з Basic_Registration; Lead Source `Web Research`; Description ←
General Additional Notes з General_Intake). Листа на цій гілці немає. Поясни, чому Lead Source тут не
`Other`.

**20.7.** Заверши `CAND_IntakeRouter`: у кінці кожної гілки екран підтвердження (`Confirmation_Tech`,
`Confirmation_Finance`, `Confirmation_General`) з текстом `Registration complete. The candidate record
has been created in Zoho CRM. Thank you.`, полем Single Line `Registered Name` /
`Registered Name Finance` / `Registered Name General` відповідно (унікальна назва на кожному екрані;
merge `#` → Basic_Registration → First Name, Read Only) і кнопкою `Close`. Опублікуй кіоск, додай
його на Home page компонентом Kiosk (назви компонента немає — тайл покаже назву самого кіоска) і
переконайся, що компонент видимий і доступний тобі та тим, хто тестуватиме.

**20.8.** Виконай Test Scenario 1 і Test Scenario 2 для простого кіоска: кіоск `LC_QuickUpdate`
відкривається кнопкою `Log Call Outcome` на картці ліда, показує ім'я ліда в Lead Name, пише обраний
статус у Lead Status і нотатки в Description після Save & Close і нічого не змінює після Cancel.
TS1: наскрізне оновлення з перевіркою картки після. TS2: Cancel, з фіксацією значень до і після.
Оформи обидва в Test Scenarios document і Test Cases table з доказами.

**20.9.** Виконай Test Scenarios 3–5 для `CAND_IntakeRouter` на Home page (Technology → Web Download і
лист User B; Finance → Cold Call і лист лише User C; Sales або Other → General_Intake, Web Research,
без листів). Для кожного: передумови, дані, кроки, фактичний результат, статус, докази; для листів —
перевірка скриньок User B і User C або чесний статус Not verifiable.

**20.10.** *(знайди помилки)* Ось конфігурація колеги. Знайди всі помилки і скажи, як кожна
проявиться під час тестів:
   - у `Create_Lead_Finance`: Description ← Additional Notes (Technology_Screening);
   - `Notify_UserC_Finance`: Recipient = User B;
   - `Create_Lead_General`: Lead Source — статичне `Other`;
   - `Years of Experience`: Maximum digits allowed = 3;
   - на Finance-гілці екран підтвердження названо `Confirmation_Tech`;
   - `Registered Name` на Confirmation_General: merge `#` → General_Intake → Current Role or Position;
   - компонент додано на User's Home Page адміністратора, а TS4 має проходити User C.

**20.11.** Спроєктуй щонайменше вісім додаткових тест-кейсів для `CAND_IntakeRouter` поза п'ятьма
сценаріями завдання (обов'язковість, формати, межі Years of Experience, закриття посеред потоку,
дублікати, доступ, власник ліда, регресія простого кіоска) у форматі TC ID / Title / Preconditions /
Steps / Expected Result.

**20.12.** *(складніша)* У Test Scenario 3 очікуваний результат: «a new Lead record has been created
with the values entered on both screens». Порівняй це з конфігурацією Technology-гілки. Що саме
можна перевірити, чого перевірити не можна, і як оформити розрив у документах?

**20.13.** *(складніша)* Під час TS4 ти бачиш: фінансовий кандидат створився з Lead Source `Web
Download`, а лист отримав User B. Напиши Defect Report: назва, середовище, вплив простими словами,
передумови, кроки, очікуване, фактичне, серйозність, докази і твоя гіпотеза причини.

**20.14.** Збери і здай пакет A20: Test Scenarios document (Writer), Test Cases table (Sheet), Defect
Report (Writer, якщо є розбіжності), скриншоти або відео з обов'язковими доказами. Назви документів
починай з назви завдання, передай ментору публічні посилання в чаті.

---

# Розв'язки

**20.1.** `Technology` → Technology_Screening, Lead Source `Web Download`, лист User B — усе
правильно. `Finance` не збігається з `Finanse`, тому кандидат іде в default path: побачить
General_Intake, лід отримає `Web Research`, листа User C не буде. `Sales` → General_Intake, `Web
Research`, листів немає — як задумано. Нічого не впаде: кіоск «працює», і саме тому помилку легко
пропустити. Її ловить TS4: після Continue має з'явитися Finance_Screening, а з'являється
General_Intake.

**20.2.** Гілки кіоска не можна звести в одну, тому кожна гілка закінчується власним екраном, а
назви екранів мають бути унікальні. Ризики: три копії можуть розійтися — інший текст, merge з іншого
поля, забута кнопка Close, Read Only на одній копії з трьох. Тести: пройти всі три гілки і на кожному
підтвердженні перевірити текст, Registered Name (= введене ім'я) і те, що поле не редагується.

**20.3.** Результат: кіоск `CAND_IntakeRouter` у Kiosk Studio; екран Basic_Registration з шістьма
елементами в заданому порядку (п'ять полів Mandatory) і кнопкою Continue; після Continue — рішення
Route_by_Category з трьома гілками. Модуль задавати не треба. Перевірка на цьому етапі — огляд
дерева і налаштувань кожного поля, без Test Run.

**20.4.** Technology-гілка:

| елемент | налаштування |
|---|---|
| `Technology_Screening` | Text; `Years of Experience` (Number, Mandatory, Maximum digits allowed = 2); `Primary Technical Skill` (Single Line, Mandatory); `Additional Notes` (Multi-line); кнопка `Submit Registration` |
| `Create_Lead_Tech` | Create records → Predefined Configuration; Leads; First Name, Last Name, Email ← Email Address, Phone ← Phone Number з Basic_Registration; Lead Source = `Web Download`; Description ← Additional Notes (Technology_Screening) |
| `Notify_UserB_Tech` | Email Notifications; User B; тема і текст із завдання |

**20.5.** Finance-гілка: `Finance_Screening` з двома обов'язковими Single Line (у `Finance
Specialisation` — Show tool tip з прикладом) і необов'язковим Multi-line; `Create_Lead_Finance` —
Lead Source `Cold Call`, Description ← Additional Notes саме з Finance_Screening;
`Notify_UserC_Finance` — Recipient User C. Контрольне питання до себе: чи не лишилося в Finance-дії
чогось від Technology (Recipient, поле Additional Notes, Lead Source)?

**20.6.** General-гілка: `General_Intake` з двома необов'язковими полями і кнопкою Submit
Registration; `Create_Lead_General` з Lead Source `Web Research` і Description ← Additional Notes з
General_Intake; дії листа немає. Не `Other`, бо Lead Source у тріалі не має такого значення:
статичне значення picklist має існувати в полі CRM. `Web Research` — наявне значення, яке до того ж
відрізняє цю гілку від двох інших.

**20.7.** Три екрани підтвердження з однаковим текстом, полем Registered Name (merge з
Basic_Registration → First Name, Read Only) і кнопкою Close; Publish; компонент `New Candidate
Registration` на Home page. Щоб компонент бачили User B і User C, потрібна Customized Home Page,
відкрита їхнім ролям чи профілям і активна; на особистій User's Home Page його бачиш лише ти. Якщо
на твоєму шляху додавання немає поля для назви компонента — запиши відхилення. Перевірка: Home page
показує компонент із першим екраном кіоска.

**20.8.** TS1: Pass, якщо Lead Name = ім'я ліда, після Save & Close видно Confirmation, а картка ліда
показує обраний статус і введені нотатки в Description. TS2: Pass, якщо після Cancel видно Cancelled
з текстом `No changes were made. The record has not been updated.`, а Lead Status і Description
збігаються з записаними до тесту. Докази: екрани кіоска, картка до і після; для TS1 цей скриншот
закриває вимогу пакета «оновлення поля підтверджене в ліді».

**20.9.**

| сценарій | екран після Continue | лід | листи |
|---|---|---|---|
| TS3, Technology | Technology_Screening | Lead Source `Web Download`, Description = нотатки з 2T | User B — так |
| TS4, Finance | Finance_Screening | Lead Source `Cold Call`, Description = нотатки з 2F | User C — так, User B — ні |
| TS5, Sales / Other | General_Intake | Lead Source `Web Research`, Description = нотатки з 2G (або порожньо) | немає |

На кожному підтвердженні Registered Name = введене ім'я. Для листів — скриншоти скриньок; якщо
доступу немає, статус Not verifiable з причиною. У TS3 окремо зафіксуй, що Years of Experience і
Primary Technical Skill у лід не потрапили (див. 20.12).

**20.10.**

| помилка | як проявиться |
|---|---|
| Finance-дія бере Additional Notes з Technology_Screening | у фінансових лідів Description порожній: на Finance-гілці цей екран не показувався |
| Recipient Finance-листа = User B | у TS4 лист отримує User B, а User C — ні |
| Lead Source `Other` | значення в тріалі немає: налаштувати його не вийде або лід не отримає очікуваного Lead Source — TS5 впаде |
| Maximum digits = 3 | `100` приймається; граничний тест на 3 цифри падає |
| на Finance-гілці екран `Confirmation_Tech` | назва вже зайнята Technology-гілкою, а назви мають бути унікальні — так налаштувати не вийде; якщо ж назви просто переплутали, докази й документація не збігаються з конфігурацією |
| Registered Name з General_Intake → Current Role or Position | підтвердження показує посаду (часто порожню) замість імені |
| компонент на User's Home Page адміністратора | User C не бачить компонента; TS4 від його імені неможливий (Blocked) |

**20.11.** Приклад набору:

| TC ID | Title | Preconditions | Steps | Expected Result |
|---|---|---|---|---|
| A20-K2-01 | First Name is mandatory | Kiosk on Home page | Leave First Name empty, fill the rest, Continue | Kiosk does not proceed |
| A20-K2-02 | Invalid email is rejected | — | Email Address = `tech01example.com`, Continue | Value not accepted; record actual message |
| A20-K2-03 | Years of Experience max 2 digits | Technology path | Enter `100` | Not accepted |
| A20-K2-04 | Years of Experience boundaries | Technology path | Enter `0`, then `99` in separate runs | Accepted; lead created |
| A20-K2-05 | Abandon after Continue creates nothing | — | Fill Screen 1, Continue, close kiosk on 2T | No new lead, no email |
| A20-K2-06 | Duplicate email | Lead `tech01@example.com` exists | Register again with the same email | Record whether a second lead is created; raise duplicate risk |
| A20-K2-07 | Cyrillic name | — | First Name `Олена`, Technology path | Lead and Registered Name show `Олена` correctly |
| A20-K2-08 | User B can open the lead from the email | TS3 done | Log in as User B, find the new lead | Lead visible to User B; if not — observation about owner and visibility |
| A20-K2-09 | Component visible to User C | Customized Home Page shared to User C's profile | Log in as User C, open Home | New Candidate Registration visible |
| A20-K2-10 | Simple kiosk still works | Both kiosks published | Run TS1 again | Same result as TS1 |

**20.12.** Перевірити можна: First Name, Last Name, Email, Phone з першого екрана, Lead Source = `Web
Download` і Description = Additional Notes з 2T. Перевірити не можна: Years of Experience і Primary
Technical Skill — жодна дія їх не записує, тож у ліді їх немає і бути не може. Оформлення: у
тест-кейсі TS3 перелічи конкретні поля, які перевіряєш; в Actual Result — що значення з 2T, крім
Additional Notes, у лід не потрапили; у звіті — спостереження «обов'язкові поля 2T/2F/2G, крім
Additional Notes, не зберігаються», з пропозицією зіставити їх з полями ліда (або дописувати в
Description). Це не дефект продукту — система робить рівно те, що налаштовано.

**20.13.** Приклад:
   - **Title:** Finance candidates are saved with Lead Source "Web Download" and notify User B.
   - **Environment:** Zoho CRM trial (Zoho One, EU), kiosk CAND_IntakeRouter on the Home page, дата.
   - **Impact:** фінансові кандидати маркуються як технологічні: звіти за джерелами хибні, рекрутер
      фінансового напряму (User C) про нових кандидатів не дізнається.
   - **Preconditions:** kiosk published; User B and User C active; mailboxes accessible.
   - **Steps:** 1. Open New Candidate Registration. 2. Fill Screen 1 with `Fin Candidate 01`,
      `fin01@example.com`, Job Category `Finance`. 3. Continue. 4. Fill Finance_Screening. 5. Submit
      Registration. 6. Open the new lead; check both mailboxes.
   - **Expected:** Finance_Screening after Continue; Lead Source `Cold Call`; email to User C only.
   - **Actual:** Lead Source `Web Download`; email received by User B; User C got nothing.
   - **Severity:** High — маршрутизація, заради якої існує кіоск, не працює для цілої категорії.
   - **Evidence:** скриншоти екранів кіоска, картки ліда, обох скриньок; конфігурація дій Finance-гілки.
   - **Hypothesis:** дії Finance-гілки скопійовані з Technology-гілки без змін (Lead Source, Recipient).
      Якщо після Continue показувався Technology_Screening — перевір умови рішення.

**20.14.** Пакет: `Kiosk Studio in Zoho CRM (A20) — Test Scenarios` (Writer, п'ять сценаріїв),
`Kiosk Studio in Zoho CRM (A20) — Test Cases` (Sheet), `Kiosk Studio in Zoho CRM (A20) — Defect
Report` (Writer, якщо були розбіжності; спостереження — окремим розділом), папка з доказами: обидва
кіоски в Kiosk Studio, компонент на Home page, кнопка на ліді, повне проходження Technology-гілки
(три екрани), лід до і після TS1. Усе в WorkDrive; кожне посилання публічне (доступ для всіх, хто
має посилання); одне повідомлення ментору з усіма посиланнями.

---

## Ворота уроку

- [ ] пояснюєш, як рішення обирає гілку і навіщо default path;
- [ ] пояснюєш, чому помилка в умові рішення мовчазна і як тест її ловить;
- [ ] знаєш два режими Create records і що дає Wait for completion;
- [ ] пояснюєш, чому статичне значення picklist має існувати в CRM і чому в тріалі це `Web Research`;
- [ ] знаєш, що екран «успіху» нічого не доводить, і де шукати доказ;
- [ ] розрізняєш User's Home Page і Customized Home Page і знаєш, як дати кіоск User B і User C;
- [ ] без підглядання збираєш `CAND_IntakeRouter`: екрани, рішення, дії, три підтвердження, Publish;
- [ ] ставиш кіоск на Home page компонентом `New Candidate Registration`;
- [ ] проходиш п'ять сценаріїв A20 і перевіряєш листи чесно, зі статусом Not verifiable, коли треба;
- [ ] відрізняєш дефект від спостереження і знаходиш у конфігурації зібрані, але не збережені поля;
- [ ] пишеш Defect Report з впливом простими словами і гіпотезою причини;
- [ ] пакет A20 (Test Scenarios, Test Cases, Defect Report за потреби, докази) зданий публічними
   посиланнями в чаті;
- [ ] задачі 20.10–20.13 розв'язані без підглядання в розв'язки.
