# Урок 22. A21: тестування Zoho CRM API v8 у Postman

*Після уроку ти сам отримуєш токени OAuth через Self Client, збираєш у Postman середовище і
колекцію з успадкованою авторизацією та оновленням токена, виконуєш 15 тестових задач A21 — від
метаданих до конвертації, COQL і Bulk Read — і здаєш звіти. Головна навичка QA тут: порівнювати
відповідь не лише з очікуванням у завданні, а й з офіційною документацією. Коли вони
розходяться, знахідка стосується документа, а не продукту.*

---

## 22.1. Що перевіряє A21 і як спланувати сесію

**Бізнес-сценарій.** NovaTech Solutions — вигадана B2B-компанія, що продає програмне
забезпечення. Потенційні клієнти заповнюють форму на сайті, і сайт через API створює ліди в Zoho
CRM. Менеджери кваліфікують ліди, додають нотатки й теги, конвертують їх у контакти, акаунти й
угоди і ведуть угоди стадіями — усе через API. Команда даних періодично вивантажує ліди для звітів.
Твоє завдання — перевірити кожен етап на рівні API.

**Обсяг.** Налаштувати OAuth 2.0, зібрати робочий простір Postman і виконати 15 задач з методами
GET, POST, PUT, DELETE і категоріями API: Records, Metadata, Search, COQL, Bulk, Tags, Notes, Lead
Conversion. Результати — артефакти QA в Zoho Writer і Zoho Sheet, передані ментору публічним
посиланням.

**Задачі залежать одна від одної.** Порядок виконання важливий:

```
Task 3 (три ліди) ──> lead-id = Mueller
   ├─> Task 4 (читання), Task 5 (Mueller → Contacted), Task 8 (пошук Mueller)
   └─> Task 9 (конвертація Mueller) ──> contact-id, account-id, deal-id
          ├─> Task 10 (теги угоди), Task 11 (нотатки угоди)
          └─> Task 12 (стадії угоди + задача)
Task 1–2, 6, 7, 13–15 — власні дані, але Task 8 і Task 13 бачать результати попередніх
```

Task 8 шукає ліди зі статусом Contacted — це Mueller після Task 5 і Dubois після Task 7. Task 9
конвертує Mueller, тож пошук має відбутися до конвертації (у завданні так і є).

**Бюджет кредитів.** За таблицею вартості з документації вся сесія — приблизно 120 кредитів: більшість
викликів по 1, конвертація 5, створення Bulk Read — 50. З повторами — кілька сотень. Від добового
ліміту тріалу (60 000) це частки відсотка, але Bulk Read варто запускати свідомо, а не «ще раз про
всяк випадок». Знімок API Dashboard до і після сесії — корисний доказ.

**Повторні прогони ламають очікування.** Дані завдання фіксовані. Другий прогін Task 3 створить ще
трьох таких самих лідів — і пошук Mueller у Task 8 знайде двох. Upsert у Task 7 на другому прогоні
відповість `update` замість `insert`. Перед повтором прибери залишки попереднього прогону або
перевір, що їх немає (наприклад, COQL за email).

**Автоматизація CRM реагує на твої записи.** За документацією v8 запис, створений через API,
запускає пов'язані workflow, якщо не передати `"trigger": []`, а оновлені записи за замовчуванням
потрапляють у review process. Якщо в тріалі вже налаштовані правила, процеси, Blueprint чи cadence
на Leads або Deals, вони спрацюють і на тестових записах. Коли результат дивний — подивись на запис
в інтерфейсі.

**Дати в минулому.** `Closing_Date` 2026-06-30 і `Due_Date` 2026-04-15 з тіл завдання вже минули.
Залиш їх як є, щоб дані збігалися із завданням. Якщо API відхилить минулу дату — це знахідка; якщо
прийме — задача виглядатиме простроченою, і це варто згадати в спостереженнях.

## 22.2. Part 1 — підготовка

1. Увійди в CRM і переконайся, що модулі **Leads**, **Contacts**, **Accounts**, **Deals** і **Tasks**
   активні й відкриваються. Tasks у лівому меню лежить у папці **Activities**, поруч із **Meetings**
   і **Calls**.
2. Завантаж і встанови десктопний **Postman** версії 10 або новішої з
   `https://www.postman.com/downloads/`. Створи безкоштовний акаунт Postman, якщо його немає, — на
   робочу адресу, як і все в навчанні.
3. Відкрий Zoho API Console `https://api-console.zoho.eu/` і переконайся, що входиш своїми даними
   CRM. Консоль саме `.eu`: тріал у європейському дата-центрі.

## 22.3. Part 2 — OAuth 2.0 і Postman: покроково

Усі виклики Zoho CRM API v8 потребують OAuth 2.0. Використовуємо метод **Self Client** — йому не
потрібен розміщений redirect URI.

**Крок 1. Зареєструй Self Client.**

   1. Відкрий `https://api-console.zoho.eu/` і увійди.
   2. **GET STARTED** → обери **Self Client** → **CREATE NOW** → на запит «Are you sure to enable
      self-client?» натисни **OK**.
   3. Відкрий вкладку **Client Secret**, скопіюй **Client ID** і **Client Secret** і збережи їх у
      безпечному місці (менеджер паролів, а не чат і не нотатки на екрані).

**Що побачиш:** Self Client з'являється зліва в списку **Applications** з датою створення; у нього
дві вкладки, **Generate Code** і **Client Secret**. Кнопка GET STARTED є лише в акаунті без
клієнтів. Якщо клієнт уже є, консоль одразу показує **Choose a Client Type** і список
**Applications**. У нашому тріалі (26.09.2026) там уже є **Self Client** від 31 August 2024 —
просто відкрий його, другий створювати не треба.

**Крок 2. Згенеруй grant token.**

   1. На своєму Self Client відкрий вкладку **Generate Code**.
   2. У поле **Scope** встав одним рядком, без пробілів після ком:
      `ZohoCRM.modules.ALL,ZohoCRM.settings.ALL,ZohoCRM.users.ALL,ZohoCRM.org.ALL,ZohoCRM.coql.READ,ZohoCRM.bulk.ALL`
   3. **Code expiry duration** (у завданні й документації — Time Duration) — `10 minutes`; варіанти
      3, 5, 7 і 10 minutes, за замовчуванням 3. **Description** — наприклад, `QA API Testing` (до 250
      символів). Натисни **CREATE**.
   4. Відкриється вікно **Select Portal**: обери портал, потім середовище — **Production**,
      **Sandbox** або **Developer Account** — і організацію в ньому, і натисни **CREATE**. Обери
      продакшн-організацію свого тріалу, а не sandbox (sandbox у тріалі теж є): токени прив'язані до
      організації і середовища. У тріалі 26.09.2026 цей крок не пройдено: код не генерували.
   5. Одразу скопіюй згенерований grant token. Він одноразовий і спливає через обраний строк.

Якщо в Scope є одрук, консоль відповість `Enter a valid scope`.

**Про пошук.** Документація Search Records v8 вимагає, крім скоупу модулів, ще
`ZohoSearch.securesearch.READ`, а в списку завдання його немає. Виконуй завдання як написано. Якщо
Task 8 поверне 401 `OAUTH_SCOPE_MISMATCH`, зафіксуй це як знахідку (неповний список скоупів у
завданні), згенеруй новий grant token з доданим `,ZohoSearch.securesearch.READ`, обміняй його на
токени, онови змінні і повтори Task 8. У звіті — обидва прогони.

**Крок 3. Обміняй grant token на access і refresh token (у Postman).**

   1. Створи новий запит. Метод **POST**, URL `https://accounts.zoho.eu/oauth/v2/token` (тріал у
      дата-центрі EU; акаунти інших регіонів використовують `.com`, `.in`, `.com.au` або `.jp`).
   2. Вкладка **Body** → **x-www-form-urlencoded** → пари ключ-значення:

      | Key | Value |
      |---|---|
      | `grant_type` | `authorization_code` |
      | `client_id` | твій Client ID |
      | `client_secret` | твій Client Secret |
      | `code` | твій grant token |

      Сторінка документації про access і refresh token називає ще `redirect_uri`, але в Self Client
      redirect URI немає, тож цей ключ не передаєш. Та сама сторінка радить передавати параметри в
      тілі як form-data; x-www-form-urlencoded із завдання — теж форма в тілі. Якщо обмін не пройде,
      спробуй **form-data** і запиши це.

   3. Вкладка **Authorization** → **No Auth**. **Send**.
   4. З відповіді збережи `access_token` (живе годину) і `refresh_token` (не спливає).

**Що побачиш** (за документацією): JSON з ключами `access_token`, `refresh_token`, `api_domain`,
`token_type` (`Bearer`) і `expires_in` (`3600`). `token_type` — лише тип токена: у заголовку запитів
до CRM документація CRM API ставить префікс `Zoho-oauthtoken`. `api_domain` — домен, на який
документація радить слати запити; для нашого тріалу він має відповідати `https://www.zohoapis.eu`.
Якщо прийшов інший — використовуй той, що у відповіді, і запиши це. Якщо `expires_in` прийде як
`3600000`, це та сама година в мілісекундах: консоль має для клієнтів налаштування одиниці
`expires_in` («Change the parameter from milliseconds to seconds»).

**Типові помилки:** `invalid_code` — grant token прострочений або вже використаний, згенеруй новий;
`invalid_client` — неправильні Client ID / Secret або різні дата-центри (код з консолі `.eu`, обмін
на `accounts.zoho.com`).

Цей крок — перший обов'язковий доказ пакета («OAuth token generation»). На скриншоті замаж токени і
Client Secret.

**Крок 4. Змінні середовища.** У Postman створи Environment з назвою `Zoho CRM v8 QA`:

| Variable | Value |
|---|---|
| `api-domain` | `https://www.zohoapis.eu` |
| `accounts-url` | `https://accounts.zoho.eu` |
| `access-token` | твій access token |
| `refresh-token` | твій refresh token |
| `client-id` | твій Client ID |
| `client-secret` | твій Client Secret |
| `lead-id` | порожньо — заповниш у Task 3 |
| `contact-id` | порожньо — Task 9 |
| `account-id` | порожньо — Task 9 |
| `deal-id` | порожньо — Task 9 |

Обери це середовище активним у випадному списку праворуч угорі. Для зручності можна додати ще
`temp-lead-id` (Task 6), `note-id` (Task 11) і `bulk-job-id` (Task 14) — завдання їх не вимагає,
але так ID не доведеться вставляти в URL руками.

**Крок 5. Авторизація на рівні колекції.**

   1. Створи Collection `Zoho CRM v8 — QA Assignment`.
   2. Відкрий налаштування колекції → вкладка **Authorization**.
   3. **Type** — **API Key**; **Key** — `Authorization`; **Value** — `Zoho-oauthtoken
      {{access-token}}`; **Add to** — **Header**.
   4. **Save**. Кожен запит колекції тепер успадковує цю авторизацію (у запиті на вкладці
      Authorization стоїть успадкування від батьківського рівня).

**Крок 6. Запит оновлення токена.** Усередині колекції створи POST-запит `Refresh Token`:

   - URL: `{{accounts-url}}/oauth/v2/token`; **Authorization** — **No Auth** (цей запит не повинен
      слати старий токен);
   - **Body** → x-www-form-urlencoded: `grant_type` = `refresh_token`, `refresh_token` =
      `{{refresh-token}}`, `client_id` = `{{client-id}}`, `client_secret` = `{{client-secret}}`;
   - **Scripts → Post-response** (у старіших версіях Postman — вкладка Tests):

```javascript
if (pm.response.code === 200) { pm.environment.set("access-token", pm.response.json().access_token); }
```

Запускай його, щойно отримаєш 401 через прострочений токен. За документацією відповідь на
оновлення містить `access_token`, `expires_in`, `api_domain` і `token_type`, нового refresh token
у ній немає. Сторінка документації Refresh Access Token передає ці чотири параметри в рядку URL
(`{accounts_URL}/oauth/v2/token?refresh_token=…&client_id=…&client_secret=…&grant_type=refresh_token`);
завдання кладе їх у тіло, і так секрет не опиняється в адресі запиту. Якщо запит із тілом не
пройде, спробуй варіант із документації і запиши це. Не запускай оновлення без потреби: з одного
refresh token — не більше 10 нових access token за 10 хвилин, далі `Access Denied`.

Назва помилки для простроченого токена: завдання називає її `INVALID_TOKEN`, а сторінка Token
Validity документації v8 — `INVALID_OAUTHTOKEN`. Записуй той код, який бачиш.

### Загальний чекліст для кожного запиту

**Перед надсиланням:**

- правильний метод;
- шлях з `/crm/v8/` (для Bulk — `/crm/bulk/v8/`, для токенів — `{{accounts-url}}`);
- заголовок Authorization є, токен не прострочений;
- для POST/PUT з JSON — `Content-Type: application/json` (у Postman його ставить Body → raw → JSON);
- у тілі всі обов'язкові поля.

**Після відповіді:**

- HTTP-код;
- структура тіла як у документації: для записів — масив `data` і об'єкт `info` (для метаданих ключі
   інші: `org`, `modules`, `fields`, `tags`);
- поле `status` кожного запису — `success` чи `error`;
- для створення й оновлення повернуто ID;
- значення поле за полем дорівнюють надісланим;
- зміна справді збереглася — перевір окремим GET.

## 22.4. Part 3 — 15 задач: що надіслати і що перевірити

Організуй колекцію по папці на задачу (`Task 01 — Organization`, `Task 02 — Metadata` …) і роби
скриншот кожного запиту з відповіддю. Для кожної задачі нижче — запит, перевірки і нюанси з
документації v8, де вона розходиться з очікуванням завдання.

### Task 1 — дані організації (GET)

`GET {{api-domain}}/crm/v8/org`

Перевір: HTTP 200; у відповіді масив `org`, а в ньому `company_name`, `primary_email`, `currency`,
`time_zone` і `license_details`. Завдання очікує, що `license_details` підтвердить тріал Enterprise.
У прикладі документації цей об'єкт має ключі `paid`, `paid_type`, `trial_type`, `trial_expiry`,
`users_license_purchased` та інші — запиши, що саме повертає твій тріал і що з цього підтверджує
редакцію. Там же є `type` — тип середовища (production, sandbox тощо). Кредитів: 1.

### Task 2 — метадані модулів і полів (GET)

- A: `GET {{api-domain}}/crm/v8/settings/modules`
- B: `GET {{api-domain}}/crm/v8/settings/fields?module=Leads`

Перевір A: масив `modules` містить Leads, Contacts, Accounts, Deals і Tasks, у кожного є `api_name`,
`id` і прапорець редагованості. Завдання називає його `is_editable`, а документація v8 — `editable`.
Запиши, який ключ прийшов; якщо `editable` — це розбіжність у завданні, а не дефект.

Перевір B: масив `fields`; у `Last_Name` — `system_mandatory: true`. Завдання очікує `true` і для
`Company`, але документація v8 каже інше: системно обов'язковий для Leads лише `Last_Name`, а в
прикладі метаданих `Company` має `system_mandatory: false`. До того ж метадані полів не містять
обов'язковості на рівні макета. Якщо `Company` прийде з `false`, це відповідає документації —
фіксуй як розбіжність у завданні. Запиши `data_type` для `Email`, `Phone` і `Description` (у прикладі
документації: `email`, `phone`, `textarea`). Кредитів: 2.

### Task 3 — створення лідів пакетом (POST)

`POST {{api-domain}}/crm/v8/Leads`, Body → raw → JSON:

```json
{
  "data": [
    {
      "Last_Name": "Mueller",
      "First_Name": "Hans",
      "Company": "Deutsche Tech GmbH",
      "Email": "h.mueller@deutschetech.example",
      "Phone": "+49-30-1234567",
      "Lead_Source": "Web Download",
      "Lead_Status": "Not Contacted"
    },
    {
      "Last_Name": "Tanaka",
      "First_Name": "Yuki",
      "Company": "Tokyo Digital Inc.",
      "Email": "y.tanaka@tokyodigital.example",
      "Lead_Source": "External Referral",
      "Lead_Status": "Not Contacted"
    },
    {
      "Last_Name": "Smith",
      "First_Name": "Emily",
      "Company": "Maple Solutions Ltd.",
      "Email": "e.smith@maplesolutions.example",
      "Lead_Source": "Advertisement",
      "Lead_Status": "Not Contacted"
    }
  ]
}
```

Перевір: три об'єкти, кожен з `status: "success"` (і `code: "SUCCESS"`, `message: "record
added"`) та унікальним `details.id`. Відповідь зберігає порядок вхідних записів, тож перший ID —
Mueller: збережи його в `lead-id`. HTTP-код: завдання очікує 200, а таблиця кодів документації
описує 201 як «record added» — запиши фактичний. Значення Lead Source і Lead Status з тіла в тріалі
існують. Кредитів: 1 (1 за кожні 10 записів).

Щоб не копіювати ID руками, додай у Scripts → Post-response:

```javascript
const body = pm.response.json();
pm.test("HTTP 200 or 201", function () {
    pm.expect(pm.response.code).to.be.oneOf([200, 201]);
});
pm.test("three records, each with status success and an id", function () {
    pm.expect(body.data).to.have.lengthOf(3);
    body.data.forEach(function (row) {
        pm.expect(row.status).to.eql("success");
        pm.expect(row.details.id).to.be.a("string");
    });
});
if (body.data && body.data[0] && body.data[0].details) {
    pm.environment.set("lead-id", body.data[0].details.id);
}
```

### Task 4 — читання й перевірка лідів (GET)

- A: `GET {{api-domain}}/crm/v8/Leads/{{lead-id}}`
- B: `GET {{api-domain}}/crm/v8/Leads?fields=Last_Name,Company,Email,Lead_Status&page=1&per_page=5`

Перевір A: HTTP 200; дані збігаються з надісланими в Task 3 поле за полем (First_Name, Last_Name,
Company, Email, Phone, Lead_Source, Lead_Status).

Перевір B: у записах лише чотири запитані поля (поруч із ними документація показує `id`); об'єкт
`info` має `page`, `per_page`, `count`, `more_records`; записів не більше п'яти.

У v8 параметр `fields` обов'язковий, коли читаєш список: той самий запит B без `fields` дасть
`REQUIRED_PARAM_MISSING`. Це хороший додатковий негативний тест. Кредитів: 2.

### Task 5 — оновлення ліда (PUT)

`PUT {{api-domain}}/crm/v8/Leads/{{lead-id}}`:

```json
{ "data": [ { "Lead_Status": "Contacted", "Rating": "Active", "Description": "Follow-up call completed. High interest in Enterprise tier." } ] }
```

Перевір: HTTP 200, `status: "success"` (`message: "record updated"`). Потім GET цього ліда: три поля
оновлені, решта (First_Name, Last_Name, Company, Email, Phone, Lead_Source) — без змін. Значення
`Active` є серед значень Rating. У документації v8 `id` — обов'язковий ключ тіла оновлення; завдання
передає ID лише в URL. Якщо API відповість, що бракує ID, додай `"id": "{{lead-id}}"` в об'єкт і
запиши відхилення. Кредитів: 1 + 1.

### Task 6 — видалення ліда (DELETE)

   1. Створи тимчасовий лід: `POST {{api-domain}}/crm/v8/Leads` з `{ "data": [ { "Last_Name":
      "ToDelete", "Company": "Temp Corp." } ] }` і збережи його ID (`temp-lead-id`).
   2. `DELETE {{api-domain}}/crm/v8/Leads?ids={{temp-lead-id}}` — очікуй HTTP 200 і `status:
      "success"` (`message: "record deleted"`).
   3. `GET {{api-domain}}/crm/v8/Leads/{{temp-lead-id}}` — очікуй помилку, що запису більше немає;
      запиши фактичні код і повідомлення.
   4. Той самий DELETE ще раз — документація описує для вже видаленого запису `INVALID_DATA` (HTTP
      400) з повідомленням `record not deleted`. Запиши фактичну відповідь.

За замовчуванням видалення запускає пов'язані workflow (параметр `wf_trigger`, типово `true`).
Кредитів: близько 4.

### Task 7 — upsert (POST)

A — вставка через upsert, `POST {{api-domain}}/crm/v8/Leads/upsert`:

```json
{
  "data": [ { "Last_Name": "Dubois", "First_Name": "Claire", "Company": "Paris Analytics SARL", "Email": "c.dubois@parisanalytics.example", "Lead_Status": "Not Contacted" } ],
  "duplicate_check_fields": ["Email"]
}
```

B — оновлення через upsert: той самий URL і email, змінений статус:

```json
{
  "data": [ { "Last_Name": "Dubois", "First_Name": "Claire", "Company": "Paris Analytics SARL", "Email": "c.dubois@parisanalytics.example", "Lead_Status": "Contacted" } ],
  "duplicate_check_fields": ["Email"]
}
```

Перевір: A повертає `action: "insert"` (у прикладі документації при цьому `duplicate_field: null`),
B — `action: "update"` і `duplicate_field: "Email"`; дубліката не створено. GET запису (ID з
відповіді A) показує `Lead_Status: "Contacted"`. «Дубліката немає» доведи окремо, наприклад COQL:
`select id, Last_Name from Leads where Email = 'c.dubois@parisanalytics.example'` — рівно один рядок.

Передумова: до запиту A лідів з цим email немає, інакше A сам відповість `update`. Email і так є
системним полем перевірки дублікатів для Leads; `duplicate_check_fields` задає порядок перевірки
явно. Кредитів: 2 + перевірки.

### Task 8 — пошук лідів (GET)

- A: `GET {{api-domain}}/crm/v8/Leads/search?email=h.mueller@deutschetech.example`
- B: `GET {{api-domain}}/crm/v8/Leads/search?criteria=(Lead_Status:equals:Contacted)`
- C: `GET {{api-domain}}/crm/v8/Leads/search?word=Deutsche`
- D: `GET {{api-domain}}/crm/v8/Leads/search?email=nonexistent@fake.example`

Перевір: A повертає Mueller; B — лише ліди зі статусом Contacted (серед них Mueller після Task 5 і
Dubois після Task 7), у кожного результату `Lead_Status` = `Contacted`; C — записи, де «Deutsche» є
в будь-якому полі, що бере участь у пошуку; D — HTTP 204 (No Content) або порожній масив `data`, без
помилки.

Нюанси з документації:

- скоуп `ZohoSearch.securesearch.READ` — див. примітку до кроку 2;
- одразу після створення чи зміни запису пошук може повернути 204 через затримку індексації. Якщо A
   дає 204, повтори через хвилину; якщо потім знаходить — це не дефект, але запиши в спостереження;
- `equals` поводиться як «містить» для всіх типів, крім picklist; `Lead_Status` — picklist, тож тут
   порівняння точне;
- `word` — щонайменше два символи;
- в одному запиті обробляється лише один із параметрів `criteria`, `email`, `phone`, `word`.

Кредитів: 4.

### Task 9 — конвертація ліда в Contact + Account + Deal (POST)

`POST {{api-domain}}/crm/v8/Leads/{{lead-id}}/actions/convert`:

```json
{
  "data": [
    {
      "Deals": {
        "Deal_Name": "NovaTech — Deutsche Tech Enterprise License",
        "Closing_Date": "2026-06-30",
        "Stage": "Qualification",
        "Amount": 50000
      },
      "carry_over_tags": {
        "Contacts": ["Hot Lead"],
        "Accounts": ["Hot Lead"],
        "Deals": ["Hot Lead"]
      }
    }
  ]
}
```

Цей виклик коштує 5 кредитів.

Перевір: HTTP 200; `code: "SUCCESS"`, `message: "The record has been converted successfully"`; у
`details` — об'єкти `Contacts`, `Accounts` і `Deals` з `name` та `id`. Збережи ID у змінні:

```javascript
const d = pm.response.json().data[0].details;
pm.environment.set("contact-id", d.Contacts.id);
pm.environment.set("account-id", d.Accounts.id);
pm.environment.set("deal-id", d.Deals.id);
```

Далі GET нових Contact, Account і Deal (`/crm/v8/Contacts/{{contact-id}}`, `/crm/v8/Accounts/{{account-id}}`,
`/crm/v8/Deals/{{deal-id}}`): ім'я, прізвище, email і телефон контакту — з ліда; назва акаунта
відповідає Company ліда; угода має Deal_Name, Closing_Date, Stage і Amount з тіла і пов'язана з
новими контактом і акаунтом.

Три місця, де завдання і документація розходяться:

- **GET вихідного ліда.** Завдання очікує помилку («лід більше не існує»). Документація Get Records
   v8 має параметр `converted` (отримати лише конвертовані записи) і поля `Converted__s` та
   `Converted_Date_Time` — тобто конвертований лід лишається в системі з позначкою конвертації.
   Виконай `GET /crm/v8/Leads/{{lead-id}}` і запиши рівно те, що прийшло. Якщо запис повернувся —
   подивись позначки конвертації і запиши розбіжність із завданням як спостереження, а не дефект.
- **Перенесення тегів.** `carry_over_tags` переносить теги **з ліда** на нові записи. У попередніх
   задачах лід Mueller тегу `Hot Lead` не отримував, тож за текстом завдання переносити нічого. Щоб
   перевірка мала сенс, до конвертації додай йому тег:
   `POST {{api-domain}}/crm/v8/Leads/{{lead-id}}/actions/add_tags` з
   `{"tags": [{"name": "Hot Lead"}]}`. Якщо API відповість помилкою, бо такого тегу в Leads ще
   немає, спершу створи його: `POST {{api-domain}}/crm/v8/settings/tags?module=Leads` з тим самим
   тілом. Після конвертації перевір поле `Tag` у контакту, акаунта й угоди. Це відхилення від
   завдання — запиши його у звіті. Якщо виконуєш рівно за текстом завдання — запиши, що сталося з
   тегами.
- **Воронки (pipelines).** Документація Convert Lead називає `Pipeline` серед обов'язкових полів
   угоди, а Insert Records уточнює: обов'язковий, коли для Deals увімкнено воронки. У тріалі
   (26.09.2026) воронки не ввімкнено: серед полів Deals на вкладці **API names** поля `Pipeline`
   немає. Якщо до твого прогону їх увімкнуть, конвертація без `Pipeline` може впасти з помилкою про
   відсутнє обов'язкове поле. Тоді додай у блок `Deals` ключ `"Pipeline"` з назвою своєї воронки (у
   прикладі документації — `"Standard (Standard)"`, точне значення візьми зі свого орга) і запиши
   відхилення.

Повторна конвертація того самого ліда — ще один корисний негативний тест: документація описує
помилку `ID_ALREADY_CONVERTED`.

### Task 10 — теги (POST, GET)

- A — створити теги: `POST {{api-domain}}/crm/v8/settings/tags?module=Deals` з
   `{ "tags": [ { "name": "High Value" }, { "name": "Q2 Pipeline" } ] }`
- B — додати теги угоді: `POST {{api-domain}}/crm/v8/Deals/{{deal-id}}/actions/add_tags` з тим самим
   тілом
- C — усі теги модуля: `GET {{api-domain}}/crm/v8/settings/tags?module=Deals`
- D — зняти один тег: `POST {{api-domain}}/crm/v8/Deals/{{deal-id}}/actions/remove_tags` з
   `{ "tags": [ { "name": "Q2 Pipeline" } ] }`

Перевір: A — масив `tags`, у кожного `code: "SUCCESS"`, `message: "tags created successfully"` і
свій `details.id`; B — `message: "tags updated successfully"`, а GET угоди показує обидва теги в
полі `Tag`; C — обидва теги в списку; D — після GET угоди лишився `High Value`, а `Q2 Pipeline`
зник.

Обмеження з документації: назва тегу — до 25 символів, без `<`, `>`, коми і емодзі; для редакції
Zoho One таблиця документації дає 20 тегів на модуль і 5 на запис, хоча примітка на тій самій
сторінці Create Tags каже про 100 і 10: документація тут суперечить сама собі. Негативні ідеї:
створити `High Value` вдруге (документація описує помилку дублікату), назва на 26 символів
(`INVALID_DATA`). Кредитів: близько 6.

### Task 11 — нотатки угоди (POST, GET, PUT, DELETE)

- A — створити: `POST {{api-domain}}/crm/v8/Deals/{{deal-id}}/Notes` з
   `{ "data": [ { "Note_Title": "Qualification Call Summary", "Note_Content": "CTO confirmed budget. Demo scheduled for March 15." } ] }`
- B — прочитати: `GET {{api-domain}}/crm/v8/Deals/{{deal-id}}/Notes`
- C — змінити: `PUT {{api-domain}}/crm/v8/Deals/{{deal-id}}/Notes/{note_id}` з
   `{ "data": [ { "Note_Content": "Updated: Demo completed. Proposal sent." } ] }`
- D — видалити: `DELETE {{api-domain}}/crm/v8/Deals/{{deal-id}}/Notes/{note_id}`

Перевір: A — `code: "SUCCESS"`, `message: "record added"`, унікальний `details.id` (збережи в
`note-id`); B — нотатка з правильними заголовком і текстом; C — `message: "record updated"`, новий
текст підтверджує GET; D — `message: "record deleted"`, GET нотатки більше не показує.

Нюанси з документації v8:

- для читання нотаток параметр `fields` обов'язковий. Якщо B поверне `REQUIRED_PARAM_MISSING`,
   виконай `GET .../Deals/{{deal-id}}/Notes?fields=Note_Title,Note_Content` і запиши відхилення;
- документація Update Notes перелічує адреси `PUT /Notes`, `PUT /Notes/{note_id}` і
   `PUT /{module}/{record_id}/Notes`; адреси з ID нотатки після ID угоди в цьому переліку немає, хоча
   приклад Deluge на тій самій сторінці саме таку адресу використовує. Надішли C як у завданні і
   запиши фактичну відповідь; якщо адресу не прийнято, виконай
   `PUT {{api-domain}}/crm/v8/Notes/{{note-id}}` з тим самим тілом і запиши відхилення. Для DELETE
   адресу завдання документація описує;
- Create Notes називає `Parent_Id` (модуль і ID батьківського запису) обов'язковим ключем тіла.
   Завдання його не передає, бо запис задано в URL. Якщо API вимагатиме — додай за прикладом
   документації і запиши.

Кредитів: близько 6.

### Task 12 — угода стадіями + пов'язана задача (PUT, POST, GET)

A — змінити стадію: `PUT {{api-domain}}/crm/v8/Deals/{{deal-id}}` з
`{ "data": [ { "Stage": "Needs Analysis" } ] }`, потім так само `Value Proposition` →
`Proposal/Price Quote` → `Closed Won`.

B — створити задачу: `POST {{api-domain}}/crm/v8/Tasks`:

```json
{ "data": [ { "Subject": "Send signed contract to Deutsche Tech", "Status": "Not Started", "Priority": "High", "Due_Date": "2026-04-15", "What_Id": "{{deal-id}}", "$se_module": "Deals" } ] }
```

C — пов'язані задачі угоди: `GET {{api-domain}}/crm/v8/Deals/{{deal-id}}/Tasks`

Перевір: кожен PUT повертає `success`; GET після кожного показує нову стадію, а `Amount` (50000) і
`Closing_Date` не змінилися. Задачу створено, і вона є в пов'язаних записах угоди — через C і в
інтерфейсі на картці угоди. Усі чотири стадії, статус `Not Started` і пріоритет `High` у тріалі
існують. Корисна побічна перевірка: у CRM ймовірність (Probability) прив'язана до стадії — подивись,
чи змінилася вона разом зі стадією, і запиши, що побачив.

Нюанси:

- у прикладі документації `What_Id` передається об'єктом `{"id": "..."}`; `$se_module` обов'язковий,
   коли є `What_Id`. Якщо рядкова форма з завдання не пройде, спробуй `"What_Id": {"id":
   "{{deal-id}}"}` і запиши;
- для пов'язаних записів документація вимагає `fields`: за потреби —
   `.../Deals/{{deal-id}}/Tasks?fields=Subject,Status,Priority,Due_Date`. Список з API-ім'ям `Tasks`
   у Deals є: у тріалі (26.09.2026) його показує **API names → Deals** з фільтром `Related Lists`.
   Той самий перелік через API дає `GET {{api-domain}}/crm/v8/settings/related_lists?module=Deals`
   (ключі `api_name` і `href`) — туди й дивись, якщо адресу не прийнято;
- якщо на Deals діє Blueprint по полю Stage або в орзі є воронки, пряма зміна стадії може поводитися
   інакше — читай `code` і `message` і шукай причину в налаштуваннях, а не в API.

Кредитів: близько 10.

### Task 13 — COQL (POST)

Усі запити: `POST {{api-domain}}/crm/v8/coql`, тіло — JSON з ключем `select_query`:

| запит | select_query |
|---|---|
| A — базовий | `select Last_Name, Company, Lead_Status from Leads where Lead_Status is not null limit 10` |
| B — сортування | `select Deal_Name, Stage, Amount from Deals where Amount > 0 order by Amount DESC limit 5` |
| C — JOIN між модулями | `select Last_Name, Account_Name.Account_Name from Contacts where Account_Name.Account_Name is not null limit 10` |
| D — агрегат (GROUP BY) | `select Stage, COUNT(id) as deal_count from Deals where Stage is not null group by Stage` |
| E — негативний (неіснуюче поле) | `select FakeField from Leads where id is not null` |

Перевір: A–D — HTTP 200, масив `data` і об'єкт `info` (`count`, `more_records`); B відсортовано за
Amount за спаданням (перевір порядок очима); C містить назву акаунта через JOIN по lookup (серед
рядків — контакт Mueller з `Deutsche Tech GmbH`); D — кількість угод за стадіями; E — помилка з кодом
на кшталт `INVALID_QUERY` (документація: «The query contains an invalid column name»).

Нагадування з документації: назви агрегатних функцій чутливі до регістру (`COUNT`, а не `count`);
за описом COUNT працює з числовими, lookup- і picklist-полями — якщо D поверне помилку, прочитай
`message` і запиши. Кожен запит з LIMIT до 200 коштує 1 кредит. Кредитів: 5.

### Task 14 — Bulk Read, асинхронний експорт (POST, GET)

Три кроки.

**Крок 1 — створити завдання:** `POST {{api-domain}}/crm/bulk/v8/read`:

```json
{
  "query": {
    "module": { "api_name": "Leads" },
    "fields": ["Last_Name", "First_Name", "Company", "Email", "Lead_Status"],
    "page": 1
  }
}
```

Перевір: HTTP-код (завдання очікує 200; сторінка Create Bulk Read Job його не називає — запиши
фактичний); за документацією — `status: "success"`, `code: "ADDED_SUCCESSFULLY"`, `details.id` (ID
завдання) і `details.state: "ADDED"`. Збережи ID
(`pm.environment.set("bulk-job-id", pm.response.json().data[0].details.id);`). Цей виклик
коштує 50 кредитів.

**Крок 2 — опитати статус** (зачекай 15–30 секунд): `GET {{api-domain}}/crm/bulk/v8/read/{job_id}`.
Дивись на `state`: `ADDED`, `QUEUED` або `IN PROGRESS` — зачекай і повтори; `COMPLETED` — в об'єкті
`result` є `count` і `download_url`.

**Крок 3 — завантажити результат:** `GET {{api-domain}}/crm/bulk/v8/read/{job_id}/result`.
Відповідь — файл. За документацією це ZIP-архів із CSV. У Postman: **Save Response → Save to File**,
дай файлу розширення `.zip`, розпакуй і відкрий CSV. Перевір: рядків стільки, скільки `result.count`;
колонки — `id` (додається автоматично) і п'ять запитаних полів у тому ж порядку; дані збігаються з
лідами в CRM. Окремо звір кількість зі списком Leads в інтерфейсі і запиши, чи потрапили в експорт
конвертовані ліди. Завантажувати результат можна не частіше 10 разів на хвилину і лише протягом
доби після завершення завдання.

### Task 15 — обробка помилок і негативні тести

Виконай кожен сценарій і задокументуй фактичну відповідь:

| сценарій | як надіслати | що очікує завдання | що каже документація v8 |
|---|---|---|---|
| прострочений токен | будь-який GET, у самому запиті Authorization → API Key, Value `Zoho-oauthtoken invalid-token` (перекриває успадкований) | 401, `INVALID_TOKEN` | Token Validity: для недійсного токена — `INVALID_OAUTHTOKEN`; запиши фактичний код |
| неіснуючий ID | `GET {{api-domain}}/crm/v8/Leads/99999999999999999` | код на кшталт `INVALID_DATA` | таблиця кодів: `INVALID_DATA` (400) — «The ID given is invalid» |
| бракує обов'язкового поля | `POST .../crm/v8/Leads` з `{ "data": [ { "First_Name": "NoLastName" } ] }` | `MANDATORY_NOT_FOUND` | `MANDATORY_NOT_FOUND`, HTTP 400; для Leads системно обов'язковий `Last_Name` |
| порожнє тіло | `POST .../crm/v8/Leads` без тіла | 400, `INVALID_DATA` або `UNABLE_TO_PARSE_DATA_TYPE` | Insert Records реакцію на порожнє тіло не описує; `UNABLE_TO_PARSE_DATA_TYPE` (400) є на сторінках видалення з повідомленням «either the request body or parameters is in wrong format»; запиши фактичний |
| зламаний JSON | `POST .../crm/v8/Leads` з тілом `{ "data": [ { broken` | 400, помилка розбору | запиши фактичні код і повідомлення |
| повторне видалення | видали будь-який лід, потім той самий DELETE ще раз | помилка «запису не існує» | `INVALID_DATA` (400), `record not deleted` |

Для всіх: у кожній помилці є `code` і `message`. Порівняй з документацією кодів і помилок
`https://www.zoho.com/crm/developer/docs/api/v8/status-codes.html` і з розділом Possible Errors
відповідного ендпоінта.

## 22.5. Part 4 — що здати

Усе створюється в Zoho Office Suite (Zoho Writer і/або Zoho Sheet) і передається ментору публічним
посиланням у чаті. Назви документів починай з назви завдання — `Testing Zoho CRM API v8 Using
Postman (A21)`; зберігай у WorkDrive.

| # | Deliverable | Format | Tool |
|---|---|---|---|
| 1 | Test Cases table | Spreadsheet | Zoho Sheet |
| 2 | Bug Reports for any defects found | Writer document | Zoho Writer |
| 3 | Test Summary Report with total tests executed, pass/fail count, defect list, observations, and recommendations | Writer document | Zoho Writer |
| 4 | Screenshots or screen recording: OAuth token generation, one full CRUD cycle, upsert (both insert and update), lead conversion, one COQL query, bulk read result, at least two negative tests | Image/Video | Any screen capture tool |
| 5 | Postman Collection export (.json) containing all requests organized into folders per task, plus exported Environment file with all token values removed before sharing | JSON file | Postman |

**Test Cases table.** Рядок на кожну перевірку, не на кожну задачу: у Task 10 чотири запити і
чотири очікування — це чотири рядки.

| TC ID | Task | Method | Endpoint | Request data | Expected Result | Actual Result | Status | Evidence |
|---|---|---|---|---|---|---|---|---|
| A21-T03-01 | 3 | POST | `/crm/v8/Leads` | 3 leads (Mueller, Tanaka, Smith) | 200/201; 3 × `status` = `success`; 3 unique ids | | | T03-01.png |
| A21-T08-04 | 8 | GET | `/crm/v8/Leads/search?email=nonexistent@fake.example` | — | 204 or empty `data`; no error | | | T08-04.png |
| A21-T15-01 | 15 | GET | `/crm/v8/org` | invalid token | 401; error `code` and `message` present (assignment: INVALID_TOKEN; docs: INVALID_OAUTHTOKEN) | | | T15-01.png |

**Bug Reports.** Дефект — поведінка API суперечить його документації: запис створено з іншим
значенням, ніж надіслано; оновлення «success», а GET показує старе; помилка без `code`. На кожен
звіт: назва, середовище (тріал, EU, API v8, версія Postman, дата), вплив простими словами, передумови,
запит (метод, URL, тіло без токена), очікуване з посиланням на документацію, фактичне (код і тіло),
серйозність, докази.

**Test Summary Report.** Обсяг і середовище; скільки перевірок виконано, пройдено, провалено,
заблоковано; список дефектів; спостереження — окремо: розбіжності завдання з документацією (ті, що ти
справді побачив: назва ключа редагованості, обов'язковість Company, 200 чи 201, назва коду для
простроченого токена, поведінка конвертованого ліда, `fields` для нотаток і пов'язаних записів,
скоуп пошуку), затримки індексації, вплив автоматизацій тріалу; рекомендації — наприклад, виправити
очікування в завданні, додати скоуп пошуку, давати унікальні тестові дані для повторних прогонів.

**Докази (пункт 4).** «Повний CRUD-цикл» — створення, читання, оновлення і видалення, найзручніше
— Task 6 разом із Task 3–5. Токени і Client Secret на скриншотах замазані.

**Експорт Postman (пункт 5).** Перед експортом environment очисти значення `access-token`,
`refresh-token` і `client-secret` (краще й `client-id`). Після експорту відкрий обидва JSON у
текстовому редакторі і переконайся, що токенів там немає. Токен, що потрапив у файл чи на
скриншот, вважай скомпрометованим: відклич refresh token і згенеруй нові.

## 22.6. Як це тестувати: погляд QA на A21

**Три джерела очікуваного результату.** Завдання, офіційна документація і фактична поведінка.
Правило роботи:

   1. виконай запит рівно так, як написано в завданні;
   2. запиши фактичну відповідь (код, тіло) і зроби скриншот;
   3. звір із завданням і з документацією ендпоінта;
   4. класифікуй розбіжність.

| завдання | документація | факт | висновок |
|---|---|---|---|
| так | так | так | Pass |
| так | так | ні | дефект продукту → Bug Report |
| ні | так | так | розбіжність у завданні → спостереження і рекомендація |
| — | — | заважає середовище (скоуп, дата-центр, воронки, автоматизації тріалу) | проблема середовища → виправ і повтори, опиши обидва прогони |

Так ти не заведеш «дефект» на продукт, який поводиться рівно за документацією, і не пропустиш
справжній дефект, списавши його на «так написано».

**Ланцюжок через змінні.** Кожен ID, отриманий у відповіді, одразу йде в змінну середовища —
скриптом або руками. Змінна, що лишилася порожньою, дає URL на кшталт `/Leads/` без ID і плутані
помилки далі по ланцюжку. Перевір: наведи курсор на змінну в URL — Postman покаже її значення.

**Твердження замість «подивився очима».** Скрипти `pm.test` перетворюють запит на повторюваний
тест: кожен прогін колекції повторює ті самі перевірки. Приклад для Task 4 B:

```javascript
const body = pm.response.json();
pm.test("no more than 5 records", function () {
    pm.expect(body.data.length).to.be.at.most(5);
});
pm.test("requested fields present, others absent", function () {
    body.data.forEach(function (row) {
        pm.expect(row).to.include.all.keys("id", "Last_Name", "Company", "Email", "Lead_Status");
        pm.expect(row).to.not.have.any.keys("First_Name", "Phone", "Lead_Source");
    });
});
pm.test("info has pagination keys", function () {
    pm.expect(body.info).to.include.all.keys("page", "per_page", "count", "more_records");
});
```

**Кожна зміна — окремим GET.** `success` у відповіді на PUT означає «прийнято», а не «збережено саме
так». Лише GET показує, що записано, і що решта полів не постраждала.

**Негативні тести — не лише Task 15.** Корисні доповнення з документації: список без `fields`
(`REQUIRED_PARAM_MISSING`), повторна конвертація (`ID_ALREADY_CONVERTED`), тег довший за 25 символів
(`INVALID_DATA`), повторне створення тегу, `word` з одного символу, 101 запис в одному запиті.

## 22.7. Типові помилки

**1. Домени `.com`.** Приклади документації написані для США; консоль, акаунти і API для нашого
тріалу — `.eu`.

**2. Grant token «протух», поки налаштовував Postman.** Він живе обраний строк і одноразовий. Спершу
підготуй запит обміну, потім генеруй код.

**3. Обмін токена з успадкованою авторизацією.** Запити на `/oauth/v2/token` мають бути з **No
Auth** — вони не для API CRM.

**4. Не обрано середовище.** Змінні не підставляються, у URL лишаються `{{api-domain}}` і
`{{lead-id}}`.

**5. Порожня змінна ID.** Не зберіг `lead-id` чи `deal-id` — і наступні задачі б'ють у порожнечу.

**6. Задачі не в тому порядку.** Пошук Contacted до Task 5, теги до Task 9 — очікування не
збігаються з даними.

**7. Повторний прогін без прибирання.** Дублікати лідів, upsert відповідає `update`, пошук знаходить
двох Mueller.

**8. «Дефект» на розбіжність завдання з документацією.** Якщо прийшли `editable` замість
`is_editable`, 201 замість 200 чи `Company` з `system_mandatory: false`, продукт поводиться за
документацією, а помиляється очікування в завданні.

**9. Токени в експорті чи на скриншоті.** Environment експортовано з токенами, скриншот обміну
без замазування.

**10. Bulk Read «про всяк випадок».** Кожне нове завдання — 50 кредитів. Опитуй статус наявного
завдання, а не створюй нове.

### Симптом → причина

| симптом | найімовірніша причина |
|---|---|
| у консолі немає GET STARTED, одразу Choose a Client Type | в акаунті вже є клієнт — відкрий Self Client зі списку Applications |
| `invalid_code` при обміні | grant token прострочений або вже використаний |
| `invalid_client` при обміні | неправильні Client ID / Secret або різні дата-центри (консоль `.eu`, обмін на `.com`) |
| 401 на всі запити колекції | access token прожив годину — запусти `Refresh Token` |
| `Refresh Token` відповідає `Access Denied` | понад 10 оновлень з одного refresh token за 10 хвилин |
| 401 `OAUTH_SCOPE_MISMATCH` у Task 8 | немає `ZohoSearch.securesearch.READ` у скоупах токена |
| 400 `REQUIRED_PARAM_MISSING` на GET нотаток чи пов'язаних записів | бракує параметра `fields` |
| URL містить `{{lead-id}}` буквально або закінчується на `/Leads/` | середовище не обрано або змінна порожня |
| Task 8 A повертає 204, хоча лід щойно створено | затримка індексації пошуку — повтори пізніше |
| Task 8 A знаходить двох Mueller | Task 3 запускали двічі |
| Task 7 A відповідає `update` | лід з цим email лишився з попереднього прогону |
| конвертація падає з помилкою обов'язкового поля | в орзі увімкнено воронки — бракує `Pipeline` у блоці `Deals` |
| GET вихідного ліда після конвертації повертає запис | конвертований лід лишається в системі з позначкою конвертації — звір з документацією |
| зміна стадії угоди відхилена | на Deals діє Blueprint по Stage або стадія не з воронки угоди |
| завантажений файл Bulk Read не відкривається | це ZIP-архів — розпакуй CSV |
| `INVALID_QUERY` у COQL-запитах A–D | одрук в API-імені поля або модуля |

## 22.8. Що варто запам'ятати

1. Self Client: api-console.zoho.eu → Client ID/Secret → Generate Code зі скоупами → обмін на
   `accounts.zoho.eu`.
2. Grant token одноразовий і короткий; access token — година; refresh token — до відкликання.
3. Змінні середовища і авторизація на рівні колекції: `Zoho-oauthtoken {{access-token}}`.
4. Запити на токени — з No Auth і тілом x-www-form-urlencoded.
5. ID з відповідей одразу йдуть у змінні; порядок задач важливий.
6. Кожна зміна підтверджується окремим GET.
7. Виконуй як написано, записуй факт, звіряй і з завданням, і з документацією.
8. Розбіжність завдання з документацією — спостереження, а не дефект продукту.
9. Пошук: окремий скоуп, затримка індексації, `equals` як «містить» не для picklist.
10. Bulk Read: три кроки, 50 кредитів за завдання, результат — ZIP із CSV.
11. Токени не потрапляють ні на скриншоти, ні в експортовані файли.

---

# Задачі

*У кожній задачі потрібні: тріал Zoho CRM у дата-центрі EU, Postman з середовищем `Zoho CRM v8
QA` (`api-domain` = `https://www.zohoapis.eu`, `accounts-url` = `https://accounts.zoho.eu`, дійсний
`access-token`) і колекція `Zoho CRM v8 — QA Assignment` з авторизацією `Zoho-oauthtoken
{{access-token}}`. Задачі 22.2–22.3 якраз це середовище і створюють.*

**22.1.** Виконай Part 1 A21: переконайся, що в CRM активні й відкриваються Leads, Contacts,
Accounts, Deals і Tasks; встанови десктопний Postman версії 10 або новішої з
`https://www.postman.com/downloads/` і створи акаунт Postman, якщо його немає; перевір, що
`https://api-console.zoho.eu/` відкривається з твоїми даними CRM.

**22.2.** Виконай кроки 1–3 Part 2:
   1. в `https://api-console.zoho.eu/` створи Self Client (GET STARTED → Self Client → CREATE NOW →
      OK) або відкрий наявний зі списку Applications; на вкладці Client Secret збережи Client ID і
      Client Secret;
   2. на вкладці Generate Code згенеруй grant token зі скоупом
      `ZohoCRM.modules.ALL,ZohoCRM.settings.ALL,ZohoCRM.users.ALL,ZohoCRM.org.ALL,ZohoCRM.coql.READ,ZohoCRM.bulk.ALL`,
      Code expiry duration `10 minutes`, Description `QA API Testing`, CREATE, у вікні Select Portal —
      продакшн-організація тріалу, і одразу скопіюй код;
   3. у Postman надішли `POST https://accounts.zoho.eu/oauth/v2/token`, Body x-www-form-urlencoded:
      `grant_type` = `authorization_code`, `client_id`, `client_secret`, `code`; Authorization — No
      Auth. Збережи `access_token` і `refresh_token`.
   Зроби скриншот обміну з замазаними токенами і секретом. Що означатимуть `invalid_code` і
   `invalid_client`, якщо з'являться?

**22.3.** Виконай кроки 4–6 Part 2:
   1. створи Environment `Zoho CRM v8 QA` зі змінними `api-domain` (`https://www.zohoapis.eu`),
      `accounts-url` (`https://accounts.zoho.eu`), `access-token`, `refresh-token`, `client-id`,
      `client-secret`, а також порожніми `lead-id`, `contact-id`, `account-id`, `deal-id`; зроби його
      активним;
   2. створи Collection `Zoho CRM v8 — QA Assignment` з авторизацією API Key: Key `Authorization`,
      Value `Zoho-oauthtoken {{access-token}}`, Add to Header;
   3. у колекції створи POST-запит `Refresh Token` на `{{accounts-url}}/oauth/v2/token` з No Auth,
      тілом x-www-form-urlencoded (`grant_type` = `refresh_token`, `refresh_token` =
      `{{refresh-token}}`, `client_id` = `{{client-id}}`, `client_secret` = `{{client-secret}}`) і
      скриптом Post-response, що зберігає новий `access_token` у змінну `access-token` при коді 200.
   Перевір, що запит `Refresh Token` оновлює змінну.

**22.4.** Виконай Task 1 і Task 2:
   - Task 1: `GET {{api-domain}}/crm/v8/org` — HTTP 200; є `company_name`, `primary_email`,
      `currency`, `time_zone`, `license_details`; що з `license_details` підтверджує тріал Enterprise?
   - Task 2: A `GET {{api-domain}}/crm/v8/settings/modules` — Leads, Contacts, Accounts, Deals,
      Tasks з `api_name`, `id` і прапорцем редагованості (завдання називає його `is_editable`);
      B `GET {{api-domain}}/crm/v8/settings/fields?module=Leads` — перевір `system_mandatory` у
      `Last_Name` і `Company`, запиши `data_type` для Email, Phone, Description.
   Для кожної розбіжності з завданням скажи, дефект це чи ні і чому.

**22.5.** Виконай Task 3–5:
   - Task 3: `POST {{api-domain}}/crm/v8/Leads` з тілом `{ "data": [ { "Last_Name": "Mueller",
      "First_Name": "Hans", "Company": "Deutsche Tech GmbH", "Email": "h.mueller@deutschetech.example",
      "Phone": "+49-30-1234567", "Lead_Source": "Web Download", "Lead_Status": "Not Contacted" }, {
      "Last_Name": "Tanaka", "First_Name": "Yuki", "Company": "Tokyo Digital Inc.", "Email":
      "y.tanaka@tokyodigital.example", "Lead_Source": "External Referral", "Lead_Status": "Not
      Contacted" }, { "Last_Name": "Smith", "First_Name": "Emily", "Company": "Maple Solutions Ltd.",
      "Email": "e.smith@maplesolutions.example", "Lead_Source": "Advertisement", "Lead_Status": "Not
      Contacted" } ] }` — три об'єкти з `status: "success"` і унікальним ID; перший ID — у `lead-id`;
   - Task 4: A `GET {{api-domain}}/crm/v8/Leads/{{lead-id}}` — дані як у Task 3; B `GET
      {{api-domain}}/crm/v8/Leads?fields=Last_Name,Company,Email,Lead_Status&page=1&per_page=5` —
      лише чотири поля, `info` з `page`, `per_page`, `count`, `more_records`, не більше 5 записів;
   - Task 5: `PUT {{api-domain}}/crm/v8/Leads/{{lead-id}}` з `{ "data": [ { "Lead_Status":
      "Contacted", "Rating": "Active", "Description": "Follow-up call completed. High interest in
      Enterprise tier." } ] }` — `status: "success"`; GET підтверджує три змінені поля й незмінність
      решти.

**22.6.** Виконай Task 6 і Task 7:
   - Task 6: створи тимчасовий лід `{ "data": [ { "Last_Name": "ToDelete", "Company": "Temp Corp." }
      ] }`, збережи ID; `DELETE {{api-domain}}/crm/v8/Leads?ids={цей_ID}` — HTTP 200 і `success`; GET
      на видалений ID — помилка; повторний DELETE — задокументуй відповідь;
   - Task 7: `POST {{api-domain}}/crm/v8/Leads/upsert` з лідом Dubois (First_Name `Claire`, Company
      `Paris Analytics SARL`, Email `c.dubois@parisanalytics.example`, Lead_Status `Not Contacted`) і
      `"duplicate_check_fields": ["Email"]` — очікуй `action: "insert"`; потім той самий запит з
      Lead_Status `Contacted` — очікуй `action: "update"` без дубліката; GET показує `Contacted`.
   Як доведеш, що дубліката справді немає?

**22.7.** Виконай Task 8: A `.../Leads/search?email=h.mueller@deutschetech.example` (Mueller), B
`.../Leads/search?criteria=(Lead_Status:equals:Contacted)` (лише Contacted), C
`.../Leads/search?word=Deutsche` (записи з «Deutsche»), D
`.../Leads/search?email=nonexistent@fake.example` (204 або порожній `data`, без помилки). Усі — від
`{{api-domain}}/crm/v8`. Які ліди мають бути в результаті B, якщо Task 5 і Task 7 уже виконано? Що
робиш, якщо A повертає 204, і що — якщо всі чотири повертають 401 `OAUTH_SCOPE_MISMATCH`?

**22.8.** Виконай Task 9: `POST {{api-domain}}/crm/v8/Leads/{{lead-id}}/actions/convert` з тілом
`{ "data": [ { "Deals": { "Deal_Name": "NovaTech — Deutsche Tech Enterprise License",
"Closing_Date": "2026-06-30", "Stage": "Qualification", "Amount": 50000 }, "carry_over_tags": {
"Contacts": ["Hot Lead"], "Accounts": ["Hot Lead"], "Deals": ["Hot Lead"] } } ] }` (5 кредитів).
Перевір HTTP 200 і ID нового Contact, Account і Deal, збережи їх у `contact-id`, `account-id`,
`deal-id`; зроби GET вихідного ліда (завдання очікує помилку) і GET трьох нових записів (цілісність
даних). Що ти зробиш із тегом `Hot Lead`, щоб перевірка перенесення тегів мала сенс?

**22.9.** Виконай Task 10 і Task 11 для угоди `{{deal-id}}`:
   - Task 10: A `POST {{api-domain}}/crm/v8/settings/tags?module=Deals` з `{ "tags": [ { "name":
      "High Value" }, { "name": "Q2 Pipeline" } ] }`; B `POST
      {{api-domain}}/crm/v8/Deals/{{deal-id}}/actions/add_tags` з тим самим тілом; C `GET
      {{api-domain}}/crm/v8/settings/tags?module=Deals`; D `POST
      {{api-domain}}/crm/v8/Deals/{{deal-id}}/actions/remove_tags` з `{ "tags": [ { "name": "Q2
      Pipeline" } ] }` — після D лишився лише `High Value` (перевір GET);
   - Task 11: A `POST {{api-domain}}/crm/v8/Deals/{{deal-id}}/Notes` з `{ "data": [ { "Note_Title":
      "Qualification Call Summary", "Note_Content": "CTO confirmed budget. Demo scheduled for March
      15." } ] }`; B `GET .../Deals/{{deal-id}}/Notes`; C `PUT .../Deals/{{deal-id}}/Notes/{note_id}` з
      `{ "data": [ { "Note_Content": "Updated: Demo completed. Proposal sent." } ] }`; D `DELETE
      .../Deals/{{deal-id}}/Notes/{note_id}` — кожен крок підтверди GET.

**22.10.** Виконай Task 12 для угоди `{{deal-id}}`: A — чотири `PUT {{api-domain}}/crm/v8/Deals/{{deal-id}}`
зі стадіями `Needs Analysis`, `Value Proposition`, `Proposal/Price Quote`, `Closed Won` (після
кожного GET: стадія змінилася, Amount і Closing_Date — ні); B — `POST {{api-domain}}/crm/v8/Tasks`
з `{ "data": [ { "Subject": "Send signed contract to Deutsche Tech", "Status": "Not Started",
"Priority": "High", "Due_Date": "2026-04-15", "What_Id": "{{deal-id}}", "$se_module": "Deals" } ]
}`; C — `GET {{api-domain}}/crm/v8/Deals/{{deal-id}}/Tasks`: задача є в пов'язаних записах.

**22.11.** Виконай Task 13: п'ять запитів `POST {{api-domain}}/crm/v8/coql` з `select_query`:
A `select Last_Name, Company, Lead_Status from Leads where Lead_Status is not null limit 10`;
B `select Deal_Name, Stage, Amount from Deals where Amount > 0 order by Amount DESC limit 5`;
C `select Last_Name, Account_Name.Account_Name from Contacts where Account_Name.Account_Name is not null limit 10`;
D `select Stage, COUNT(id) as deal_count from Deals where Stage is not null group by Stage`;
E `select FakeField from Leads where id is not null`.
A–D: HTTP 200, `data` і `info`; B за спаданням Amount; C з назвою акаунта через JOIN; D з
кількостями за стадіями; E — помилка з кодом на кшталт `INVALID_QUERY`. Напиши, як саме ти
перевіриш сортування в B.

**22.12.** Виконай Task 14: 1) `POST {{api-domain}}/crm/bulk/v8/read` з `{ "query": { "module": {
"api_name": "Leads" }, "fields": ["Last_Name", "First_Name", "Company", "Email", "Lead_Status"],
"page": 1 } }` — HTTP 200, збережи ID завдання; 2) через 15–30 секунд `GET
{{api-domain}}/crm/bulk/v8/read/{job_id}` — поки `state` `IN PROGRESS`, чекай і повторюй; на
`COMPLETED` у `result` є `count` і `download_url`; 3) `GET
{{api-domain}}/crm/bulk/v8/read/{job_id}/result` — файл: Save Response → Save to File, відкрий і
звір рядки з записами CRM. Скільки кредитів коштує ця задача і чому не варто створювати завдання
повторно?

**22.13.** Виконай Task 15 і задокументуй фактичну відповідь кожного сценарію: недійсний токен у
будь-якому GET (очікується 401, `INVALID_TOKEN`); `GET {{api-domain}}/crm/v8/Leads/99999999999999999`
(код на кшталт `INVALID_DATA`); `POST .../crm/v8/Leads` з `{ "data": [ { "First_Name":
"NoLastName" } ] }` (`MANDATORY_NOT_FOUND`); `POST .../crm/v8/Leads` з порожнім тілом (400,
`INVALID_DATA` або `UNABLE_TO_PARSE_DATA_TYPE`); `POST .../crm/v8/Leads` з тілом `{ "data": [ {
broken` (400, помилка розбору); повторний DELETE уже видаленого ліда (помилка «запису не існує»).
Для всіх перевір наявність `code` і `message` і звір із
`https://www.zoho.com/crm/developer/docs/api/v8/status-codes.html`. Як надіслати недійсний токен,
якщо колекція успадковує авторизацію?

**22.14.** Здай Part 4: Test Cases table (Zoho Sheet); Bug Reports на знайдені дефекти (Zoho Writer);
Test Summary Report із загальною кількістю перевірок, Pass/Fail, списком дефектів, спостереженнями і
рекомендаціями (Zoho Writer); скриншоти або запис: генерація токенів OAuth, один повний CRUD-цикл,
upsert (insert і update), конвертація ліда, один COQL-запит, результат Bulk Read, щонайменше два
негативні тести; експорт Postman Collection (.json) з папками за задачами і експортований
Environment без значень токенів. Передай публічні посилання ментору в чаті.

**22.15.** *(класифікуй)* Для кожної ситуації скажи: дефект продукту, розбіжність у завданні чи
проблема середовища — і що напишеш у звіті:
   1. Task 2 повертає `editable`, а не `is_editable`;
   2. Task 5 відповідає `success`, але GET показує старий `Lead_Status`;
   3. Task 8 повертає 401 `OAUTH_SCOPE_MISMATCH`;
   4. Task 9 падає з помилкою про обов'язкове поле `Pipeline`;
   5. Task 3 повертає 201, а не 200;
   6. Task 13 E повертає HTTP 200 з даними.

**22.16.** *(автоматизація)* Напиши скрипти Post-response для Postman: а) Task 3 — перевірка, що
створено рівно три записи зі `status` `success`, і збереження першого ID в `lead-id`; б) Task 9 —
збереження трьох ID; в) Task 14, крок 2 — перевірка, що `state` — одне з відомих значень, і вивід
стану в консоль.

**22.17.** *(складніша)* Сплануй повторний прогін усієї колекції через тиждень. Що зламається в
очікуваннях, якщо нічого не прибрати, і як підготувати дані, щоб результати були порівнянні? Скільки
кредитів коштуватиме прогін і що з цього — найдорожче?

---

# Розв'язки

**22.1.** Очікування: п'ять модулів відкриваються в інтерфейсі (Tasks — через папку Activities
лівого меню); Postman встановлено (версія 10+), вхід в акаунт виконано;
`https://api-console.zoho.eu/` після входу з даними CRM відкриває консоль: в акаунті без клієнтів —
кнопку **GET STARTED**, а якщо клієнти вже є — екран **Choose a Client Type** і список
**Applications** (у нашому тріалі там уже є Self Client від 31 August 2024). Запиши версію Postman —
вона знадобиться в описі середовища у звітах.

**22.2.** Послідовність: консоль `.eu` → GET STARTED → Self Client → CREATE NOW → OK (або наявний
Self Client зі списку Applications) → Client Secret (скопіювати ID і Secret) → Generate Code (Scope
одним рядком, Code expiry duration 10 minutes, Description) → CREATE → Select Portal: портал,
Production, організація тріалу → CREATE → скопіювати код. Обмін: POST на
`https://accounts.zoho.eu/oauth/v2/token`, x-www-form-urlencoded з чотирма ключами, No Auth. Відповідь
містить `access_token`, `refresh_token`, `api_domain`, `token_type`, `expires_in`. `invalid_code` —
код прострочений або вже використаний: згенерувати новий. `invalid_client` — неправильні ID чи Secret
або змішано дата-центри (консоль `.eu` і обмін на `.com`).

**22.3.** Environment з десятьма змінними, активний; колекція з API Key авторизацією в заголовку;
запит `Refresh Token`:

```javascript
if (pm.response.code === 200) { pm.environment.set("access-token", pm.response.json().access_token); }
```

Перевірка: запам'ятай перші символи `access-token`, запусти `Refresh Token` — значення змінної
змінилося, а будь-який запит колекції проходить з новим токеном. Не запускай оновлення частіше, ніж
треба: понад 10 разів за 10 хвилин — `Access Denied`.

**22.4.** Task 1: HTTP 200, масив `org` з п'ятьма ключами; про редакцію й тріал свідчать ключі
`license_details` (у прикладі документації — `paid`, `paid_type`, `trial_type`, `trial_expiry`
тощо) — випиши фактичні значення. Task 2 A: п'ять модулів з `api_name` і `id`; прапорець
редагованості за документацією називається `editable` — якщо прийшов він, це розбіжність у завданні.
Task 2 B: `Last_Name` — `system_mandatory: true`; `Company` за документацією — `false` (системно
обов'язковий лише `Last_Name`, а обов'язковість на рівні макета метадані не показують) — розбіжність
у завданні, не дефект. `data_type` у прикладі документації: Email — `email`, Phone — `phone`,
Description — `textarea`; запиши фактичні.

**22.5.** Task 3: код 200 або 201 (запиши фактичний; таблиця кодів описує 201 як «record added»), три
елементи `data` з `success`, `SUCCESS`, `record added` і ID; перший — Mueller → `lead-id`. Task 4 A:
значення як у тілі Task 3. Task 4 B: у кожному записі `id` і чотири поля, без First_Name, Phone,
Lead_Source; `info` з чотирма ключами пагінації; `data.length` ≤ 5. Task 5: `success` і `record
updated`; GET: `Lead_Status` = `Contacted`, `Rating` = `Active`, `Description` = новий текст; First_Name
`Hans`, Company `Deutsche Tech GmbH`, Email, Phone і Lead_Source `Web Download` — без змін.

**22.6.** Task 6: створення → ID; DELETE → 200, `success`, `record deleted`; GET → помилка
(запиши код і повідомлення); повторний DELETE → за документацією `INVALID_DATA` з `record not
deleted`. Task 7: A — `action: "insert"`, B — `action: "update"` і `duplicate_field: "Email"`, GET —
`Contacted`. Відсутність дубліката: COQL `select id, Last_Name from Leads where Email =
'c.dubois@parisanalytics.example'` повертає рівно один рядок з тим самим ID, що й у відповіді A (або
пошук за email — одна відповідь, з урахуванням затримки індексації).

**22.7.** B має повернути всі ліди зі статусом Contacted; з даних A21 — щонайменше Mueller (Task 5) і
Dubois (Task 7), плюс інші Contacted-ліди тріалу, якщо є. Кожен результат — `Lead_Status` =
`Contacted`. A повертає 204: зачекай хвилину і повтори — затримка індексації; якщо знаходить, це
спостереження, а не дефект. Усі чотири 401 `OAUTH_SCOPE_MISMATCH`: токену бракує
`ZohoSearch.securesearch.READ` — зафіксуй знахідку, згенеруй новий grant token з доданим скоупом,
обміняй, онови `access-token` і `refresh-token`, повтори Task 8 і опиши обидва прогони.

**22.8.** Очікування: HTTP 200; `code: "SUCCESS"`, `message: "The record has been converted
successfully"`; `details.Contacts.id`, `details.Accounts.id`, `details.Deals.id` → змінні (скрипт у
розділі про Task 9). GET вихідного ліда: запиши фактичне; якщо запис повернувся з позначкою
конвертації — розбіжність із завданням (документація описує конвертовані ліди як записи з
`Converted__s`). GET контакту: Hans Mueller з email і телефоном ліда; акаунт — `Deutsche Tech GmbH`;
угода — `NovaTech — Deutsche Tech Enterprise License`, `2026-06-30`, `Qualification`, `50000`,
пов'язана з контактом і акаунтом. Тег: до конвертації додай лідові `Hot Lead` через
`POST {{api-domain}}/crm/v8/Leads/{{lead-id}}/actions/add_tags` з `{"tags": [{"name": "Hot Lead"}]}`
(якщо тегу в Leads ще немає — спершу створи його через `/settings/tags?module=Leads`), після —
перевір поле `Tag` трьох нових записів і запиши відхилення від завдання. Якщо конвертація впаде
через `Pipeline` — додай його в блок `Deals` і запиши відхилення.

**22.9.** Task 10: A — `tags` з двома `SUCCESS`, `tags created successfully` і двома ID; B — `tags
updated successfully`, GET угоди: `Tag` містить `High Value` і `Q2 Pipeline` (і `Hot Lead`, якщо його
перенесено); C — обидва теги в списку модуля; D — `tags updated successfully`, GET угоди: `High
Value` є, `Q2 Pipeline` немає. Task 11: A — `SUCCESS`, `record added`, ID → `note-id`; B — нотатка з
заголовком `Qualification Call Summary` і текстом (якщо `REQUIRED_PARAM_MISSING` — додай
`?fields=Note_Title,Note_Content`); C — `record updated`, GET показує `Updated: Demo completed.
Proposal sent.` (якщо адресу з ID нотатки не прийнято — `PUT {{api-domain}}/crm/v8/Notes/{{note-id}}`);
D — `record deleted`, GET більше не показує нотатку. Кожне відхилення від адрес завдання — у звіт.

**22.10.** A: чотири `success`, після кожного GET — нова стадія; `Amount` = 50000 і `Closing_Date` =
2026-06-30 незмінні; Probability — записано, чи змінювалася разом зі стадією. B: `success`, ID задачі; якщо рядковий
`What_Id` відхилено — `"What_Id": {"id": "{{deal-id}}"}`. C: задача `Send signed contract to Deutsche
Tech` у пов'язаних записах; якщо `REQUIRED_PARAM_MISSING` — додай
`?fields=Subject,Status,Priority,Due_Date`; якщо адресу не прийнято — знайди API-ім'я списку через
`GET {{api-domain}}/crm/v8/settings/related_lists?module=Deals`. На картці угоди в інтерфейсі задача
теж видна.

**22.11.** A–D: 200, `data` і `info` з `count` і `more_records`. B: сортування перевіряєш так —
випиши Amount з кожного рядка в порядку відповіді і переконайся, що кожне наступне не більше
попереднього (або в скрипті порівняй сусідні елементи). C: у рядках ключ
`Account_Name.Account_Name` з назвою акаунта, зокрема `Deutsche Tech GmbH` для Mueller. D: рядки з
`Stage` і `deal_count`; сума кількостей дорівнює кількості угод зі стадією. E: помилка
`INVALID_QUERY` (невідоме поле) з `message`.

**22.12.** Крок 1: код за завданням 200 (запиши фактичний), `ADDED_SUCCESSFULLY`, `state: "ADDED"`,
ID → `bulk-job-id`. Крок 2: `state`
проходить ADDED / QUEUED / IN PROGRESS → COMPLETED; у `result` — `count` і `download_url`. Крок 3:
ZIP → CSV з колонкою `id` і п'ятьма полями в заданому порядку, рядків = `count`. Вартість: 50 кредитів
за створення завдання плюс по 1 за опитування й завантаження. Нове завдання замість опитування
наявного — ще 50 кредитів без жодної користі.

**22.13.** Недійсний токен: на вкладці Authorization самого запиту обери API Key з Key
`Authorization` і Value `Zoho-oauthtoken invalid-token` — налаштування запиту перекриває
успадковане. Очікування і що записати:

| сценарій | очікування | запиши |
|---|---|---|
| недійсний токен | 401 | фактичний `code` (завдання: `INVALID_TOKEN`, документація: `INVALID_OAUTHTOKEN`) |
| неіснуючий ID | помилка; таблиця кодів описує `INVALID_DATA` | фактичні код і повідомлення |
| без Last_Name | 400 `MANDATORY_NOT_FOUND` | повідомлення і `details` |
| порожнє тіло | 400, `INVALID_DATA` або `UNABLE_TO_PARSE_DATA_TYPE` | який саме |
| зламаний JSON | 400, помилка розбору | код і повідомлення |
| повторний DELETE | `INVALID_DATA`, `record not deleted` | фактичне |

Критерій Pass для кожного: код помилки відповідає документованому, є `code` і `message`, запис не
створено й не змінено.

**22.14.** Пакет: `Testing Zoho CRM API v8 Using Postman (A21) — Test Cases` (Sheet, рядок на
перевірку); `... — Bug Reports` (Writer; якщо дефектів немає — документ із цим висновком або розділ у
підсумку); `... — Test Summary Report` (Writer: обсяг, середовище, кількості, дефекти,
спостереження, рекомендації); докази з переліку пункту 4; експорт колекції `Zoho CRM v8 — QA
Assignment` (.json) і файл environment без токенів (перевірено в текстовому редакторі). Усе в WorkDrive, посилання
публічні, одне повідомлення ментору.

**22.15.**
   1. Розбіжність у завданні: документація v8 називає ключ `editable`. У звіті — спостереження і
      рекомендація виправити очікування.
   2. Дефект продукту: відповідь каже «success», а дані не збереглися — суперечність документованій
      поведінці. Bug Report з обома відповідями (PUT і GET).
   3. Проблема середовища (неповний список скоупів у завданні): документація Search вимагає
      `ZohoSearch.securesearch.READ`. Спостереження, новий токен, повторний прогін.
   4. Проблема середовища: в орзі увімкнено воронки, а тіло завдання не має `Pipeline`, який
      документація називає обов'язковим. Виправити тіло, записати відхилення.
   5. Розбіжність у завданні: таблиця кодів документації описує 201 як «record added». Pass за
      суттю (записи створено), спостереження щодо очікування.
   6. Дефект продукту (або помилка в запиті — спершу перевір, що поля `FakeField` справді немає):
      документація обіцяє `INVALID_QUERY` для невідомого поля. Bug Report.

**22.16.** а)

```javascript
const body = pm.response.json();
pm.test("three records with status success", function () {
    pm.expect(body.data).to.have.lengthOf(3);
    body.data.forEach(function (row) {
        pm.expect(row.status).to.eql("success");
    });
});
if (body.data && body.data[0] && body.data[0].details) {
    pm.environment.set("lead-id", body.data[0].details.id);
}
```

б)

```javascript
const d = pm.response.json().data[0].details;
pm.environment.set("contact-id", d.Contacts.id);
pm.environment.set("account-id", d.Accounts.id);
pm.environment.set("deal-id", d.Deals.id);
```

в)

```javascript
const job = pm.response.json().data[0];
pm.test("job state is known", function () {
    pm.expect(job.state).to.be.oneOf(["ADDED", "QUEUED", "IN PROGRESS", "COMPLETED"]);
});
console.log("bulk job state:", job.state);
```

Невідомий стан (наприклад, збій завдання) провалить тест — саме цього й треба.

**22.17.** Без прибирання: Task 3 створить ще трьох Mueller/Tanaka/Smith — пошук за email у Task 8
знайде кількох, і `lead-id` вказуватиме на нового; Task 7 A відповість `update` замість `insert`;
Task 10 A — імовірна помилка дубліката тегів; Task 9 з новим `lead-id` пройде, але створить ще один акаунт чи
пов'яже з наявним — результати складніше порівнювати. Підготовка: перед прогоном видалити ліди,
контакти, акаунти, угоди, задачі й теги попереднього прогону (знайти їх COQL-запитами за email і
назвами) або додати до email і назв суфікс прогону (`+run2`) і записати це як відхилення від даних
завдання. Вартість — приблизно ті самі 120 кредитів; найдорожче — створення Bulk Read (50),
далі конвертація (5).

---

## Ворота уроку

- [ ] створюєш Self Client у консолі `.eu` і отримуєш токени, не змішуючи дата-центри;
- [ ] пояснюєш, чому grant token треба обміняти одразу і що означають `invalid_code` і `invalid_client`;
- [ ] без підглядання налаштовуєш environment, авторизацію колекції і запит `Refresh Token` зі
   скриптом;
- [ ] знаєш залежності між задачами A21 і виконуєш їх у правильному порядку;
- [ ] зберігаєш ID з відповідей у змінні скриптами `pm.environment.set`;
- [ ] пишеш у Postman твердження `pm.test` для коду, статусів записів і полів;
- [ ] підтверджуєш кожну зміну окремим GET і перевіряєш незмінність решти полів;
- [ ] знаєш нюанси пошуку: скоуп, затримка індексації, `equals` як «містить»;
- [ ] проводиш Bulk Read у три кроки і знаєш його вартість;
- [ ] розрізняєш дефект продукту, розбіжність у завданні і проблему середовища на прикладах A21;
- [ ] виконав усі 15 задач з доказами і записав фактичні відповіді негативних тестів;
- [ ] пакет A21 здано: Test Cases, Bug Reports, Test Summary Report, докази, експорт колекції й
   environment без токенів — публічними посиланнями в чаті;
- [ ] задачі 22.15–22.17 розв'язані без підглядання в розв'язки.
