# AGENTS.md — Обязательный стандарт кодирования

**Этот файл ОБЯЗАТЕЛЕН к применению.** Любой код, написанный AI-агентом для этого проекта, должен строго следовать правилам ниже. Нарушения подлежат автоматическому исправлению.

Основано на методологии [Refactoring.Guru](https://refactoring.guru/ru/refactoring) — принципы чистого кода, техники рефакторинга и устранения запахов кода.

---

## 1. Архитектура: Clean Architecture (трёхслойная)

Проект разделён на три слоя. Каждый слой зависит ТОЛЬКО от нижележащего. Доменный слой НЕ должен знать о Tauri, Next.js, React или любой другой инфраструктуре.

```
┌─────────────────────────────────────┐
│  Presentation Layer (UI)            │
│  - React-компоненты (pages/)        │
│  - Состояние UI (consoleOpen, etc.) │
│  - Адаптеры Tauri (tauri-api.ts)   │
├─────────────────────────────────────┤
│  Application Layer (use cases)      │
│  - Сторы (stores/*.ts)             │
│  - Use-case функции                 │
│  - Оркестрация домена + адаптеров  │
├─────────────────────────────────────┤
│  Domain Layer (бизнес-логика)       │
│  - Типы/интерфейсы (core.rs)       │
│  - Бизнес-правила (processes.rs)   │
│  - Абстракции (traits)             │
│  - НЕТ зависимостей от Tauri/React │
└─────────────────────────────────────┘
```

### Rust Backend (src-tauri/src/)

```
src-tauri/src/
├── domain/              # Чистые типы, никаких зависимостей
│   ├── model.rs
│   ├── process.rs
│   └── system.rs
├── application/         # Use cases, оркестрация
│   ├── model_service.rs
│   ├── process_service.rs
│   └── workspace_service.rs
├── infrastructure/      # Адаптеры внешних систем
│   ├── llama_cpp.rs
│   ├── hf_api.rs
│   ├── github_releases.rs
│   └── sqlite_repo.rs
└── presentation/        # Tauri commands (тонкие обёртки)
    ├── model_commands.rs
    ├── process_commands.rs
    └── lib.rs
```

**Запреты:**

- `core.rs` не должен содержать глобальное состояние (`GLOBAL_STATE`). Использовать `tauri::State<AppState>`.
- `commands.rs` не должен превышать 200 строк. Разделять по доменам.
- Доменные типы не импортируют `tauri`, `serde` (только если не для сериализации).

### Frontend (src/)

```
src/
├── stores/              # Zustand stores — каждый < 200 строк
│   ├── models-store.ts
│   ├── instances-store.ts
│   ├── downloads-store.ts
│   ├── workspaces-store.ts
│   ├── profiles-store.ts
│   ├── releases-store.ts
│   ├── notifications-store.ts
│   └── settings-store.ts
├── components/          # React-компоненты
│   ├── features/        # Feature-компоненты (доменные)
│   │   ├── model-list/
│   │   ├── hf-download-dialog/
│   │   └── instance-panel/
│   ├── ui/              # Generic UI (Button, Dialog, etc.)
│   ├── layout/          # Layout-компоненты (AppShell, Sidebar)
│   └── console/         # Компоненты консоли (можно в features)
├── hooks/               # Кастомные React-хуки
├── lib/                 # Утилиты, адаптеры
│   ├── tauri-api.ts     # Адаптер Tauri (фасад)
│   └── logger.ts       # Логирование (фасад)
└── app/                 # Next.js App Router (только layout + routing)
```

**Запреты:**

- `llama-store.ts` (или любой другой файл) не должен превышать 200 строк.
- Сторы НЕ могут вызывать друг друга напрямую. Использовать `subscribe` или события.
- Компоненты НЕ могут обращаться к `window.__TAURI__` напрямую — только через `tauri-api.ts`.

---

## 2. Принципы проектирования (из Refactoring.Guru)

### 2.1 Отсутствие дублирования (DRY)

Любой фрагмент кода существует в единственном экземпляре. Дублирование считается критическим дефектом.

**Исключение:** Дублирование в тестах допускается, если оно улучшает читаемость сценария.

**Техники:** [Extract Method](https://refactoring.guru/ru/extract-method), [Pull Up Method](https://refactoring.guru/ru/pull-up-method), [Form Template Method](https://refactoring.guru/ru/form-template-method)

### 2.2 Маленькие методы (Composing Methods)

Метод не должен превышать 15 строк. Если длиннее — [Extract Method](https://refactoring.guru/ru/extract-method).

Допустимые исключения:

- Методы с одним switch/match на 10+ веток (но не более 30 строк)
- Сложные алгоритмы с пошаговыми комментариями (но не более 50 строк)

**Техники:** [Extract Variable](https://refactoring.guru/ru/extract-variable), [Replace Temp with Query](https://refactoring.guru/ru/replace-temp-with-query), [Replace Method with Method Object](https://refactoring.guru/ru/replace-method-with-method-object), [Substitute Algorithm](https://refactoring.guru/ru/substitute-algorithm)

### 2.3 Маленькие файлы (SRP)

Файл не должен превышать 200 строк. Каждый файл — одна ответственность.

Если класс/файл превышает 200 строк — [Extract Class](https://refactoring.guru/ru/extract-class), [Extract Interface](https://refactoring.guru/ru/extract-interface).

### 2.4 Простые условные выражения

```typescript
// ПЛОХО: вложенный if
if (condition) {
  if (otherCondition) {
    // ...
  }
}

// ХОРОШО: guard clauses + early return
if (!condition) return;
if (!otherCondition) return;
// ...
```

**Техники:** [Replace Nested Conditional with Guard Clauses](https://refactoring.guru/ru/replace-nested-conditional-with-guard-clauses), [Decompose Conditional](https://refactoring.guru/ru/decompose-conditional), [Consolidate Conditional Expression](https://refactoring.guru/ru/consolidate-conditional-expression), [Replace Conditional with Polymorphism](https://refactoring.guru/ru/replace-conditional-with-polymorphism), [Introduce Null Object](https://refactoring.guru/ru/introduce-null-object)

### 2.5 Коммуникация через объекты

Группы данных, которые постоянно передаются вместе — `Data Clumps`. Заменить их на объект.

```typescript
// ПЛОХО: data clumps
function download(repo: string, quant: string, filename: string, sizeGb: number) {}

// ХОРОШО: grouped into object
function download(config: DownloadConfig) {}
```

**Техники:** [Introduce Parameter Object](https://refactoring.guru/ru/introduce-parameter-object), [Preserve Whole Object](https://refactoring.guru/ru/preserve-whole-object)

### 2.6 Инкапсуляция

Поля классов/структур — `private`. Доступ только через методы. Коллекции возвращаются read-only.

**Техники:** [Encapsulate Field](https://refactoring.guru/ru/encapsulate-field), [Encapsulate Collection](https://refactoring.guru/ru/encapsulate-collection), [Self-Encapsulate Field](https://refactoring.guru/ru/self-encapsulate-field), [Hide Delegate](https://refactoring.guru/ru/hide-delegate)

### 2.7 Устранение посредников

Класс не должен быть "пустышкой", которая просто делегирует всё другому классу. Если класс только делегирует — [Remove Middle Man](https://refactoring.guru/ru/remove-middle-man).

### 2.8 Feature Envy

Метод не должен "завидовать" чужому классу — не должен обращаться к полям/методам другого класса больше, чем к своим. [Move Method](https://refactoring.guru/ru/move-method) в нужный класс.

---

## 3. Запахи кода — немедленное исправление

| Запах                                                                               | Симптом                                    | Исправление                               |
| ----------------------------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------- |
| [Long Method](https://refactoring.guru/ru/smells/long-method)                       | > 15 строк                                 | Extract Method                            |
| [Large Class](https://refactoring.guru/ru/smells/large-class)                       | > 200 строк / > 10 методов                 | Extract Class                             |
| [Long Parameter List](https://refactoring.guru/ru/smells/long-parameter-list)       | > 3 параметра                              | Introduce Parameter Object                |
| [Primitive Obsession](https://refactoring.guru/ru/smells/primitive-obsession)       | Строки/числа вместо объектов               | Replace Data Value with Object            |
| [Switch Statements](https://refactoring.guru/ru/smells/switch-statements)           | switch/match по типу                       | Replace Conditional with Polymorphism     |
| [Temporary Field](https://refactoring.guru/ru/smells/temporary-field)               | Поле используется не всегда                | Extract Class                             |
| [Data Clumps](https://refactoring.guru/ru/smells/data-clumps)                       | Повторяющиеся группы данных                | Introduce Parameter Object                |
| [Message Chains](https://refactoring.guru/ru/smells/message-chains)                 | `a.b().c().d()`                            | Hide Delegate                             |
| [Middle Man](https://refactoring.guru/ru/smells/middle-man)                         | Класс-пустышка                             | Remove Middle Man / Inline Class          |
| [Speculative Generality](https://refactoring.guru/ru/smells/speculative-generality) | Код "на всякий случай"                     | Удалить                                   |
| [Dead Code](https://refactoring.guru/ru/smells/dead-code)                           | Неиспользуемые функции/переменные          | Удалить                                   |
| [Shotgun Surgery](https://refactoring.guru/ru/smells/shotgun-surgery)               | Одно изменение — много файлов              | Move Method, Move Field                   |
| [Divergent Change](https://refactoring.guru/ru/smells/divergent-change)             | Один файл меняется по разным причинам      | Extract Class                             |
| [Lazy Class](https://refactoring.guru/ru/smells/lazy-class)                         | Класс почти ничего не делает               | Inline Class / Collapse Hierarchy         |
| [Comments](https://refactoring.guru/ru/smells/comments)                             | Комментарий объясняет "как", а не "почему" | Extract Method (комментарий → имя метода) |

---

## 4. Code Style & Convention

### 4.1 Общие правила

- **Пробелы:** 2 пробела (TypeScript), 4 пробела (Rust)
- **Кавычки:** двойные ("") для строк
- **Точка с запятой:** обязательна
- **Максимальная длина строки:** 120 символов
- **Имя переменной:** должно объяснять, что в ней хранится
- **Имя функции:** должно быть глаголом (`downloadModel`, `findFile`, `refreshList`)
- **Имя класса/типа:** существительное (`ModelService`, `ProcessManager`, `DownloadConfig`)

### 4.2 Rust

```rust
// Типы — PascalCase с полными именами (НЕ: Cfg, а: ModelConfig)
pub struct ModelConfig {
    pub context_size: usize,
    pub gpu_layers: i32,
}

// Функции — snake_case
pub fn download_model(repo: &str, dest: &Path) -> Result<String> {
    // Guard clause
    if !dest.exists() {
        return Err(anyhow!("Destination does not exist"));
    }
    // Early return
    let content = fetch_url(repo).await?;
    Ok(content)
}

// Модули — snake_case, один файл ≤ 200 строк
```

**Правила:**

- `unwrap()` — ТОЛЬКО в тестах или в `main()`. В production — `?`, `match`, `map_err`.
- `expect()` — только с объяснением, почему паника невозможна.
- Параметры-ссылки: `&str` предпочтительнее `&String`, `&[T]` предпочтительнее `&Vec<T>`.
- `use` — группировать: `std`, внешние, `crate::`.
- `as` — только для устранения конфликтов имён.
- AT NIGHT: запрещён `unsafe` без review.
- `Default` impl — обязателен для всех конфигов.

### 4.3 TypeScript / React

```typescript
// Типы — PascalCase, рядом с использованием
interface DownloadConfig {
  repo: string;
  quant: string;
  filename: string;
  sizeGb: number;
}

// Функции — camelCase
function startDownload(config: DownloadConfig): string {
  const { repo, quant, filename } = config;
  if (!isTauri()) throw new Error("Requires Tauri");
  return downloadFile(repo, quant, filename);
}

// Реакт-компонент — PascalCase, рядом в папке
// components/features/model-card/model-card.tsx
export function ModelCard({ model, onSelect }: ModelCardProps) {
  return (
    <div className="..." onClick={() => onSelect(model.id)}>
      <h3>{model.name}</h3>
    </div>
  );
}
```

**Правила:**

- `import type { ... }` — для импорта типов.
- `as` — только в `as const`, кастах типов.
- Zustand store — только через `get()` и `set()`, никаких внешних вызовов.
- React-компоненты — НЕ использовать `any`.
- `useEffect` — с явным массивом зависимостей.
- `useState` — минимально, предпочитать Zustand.

### 4.4 Импорты (TypeScript)

Строгий порядок, разделённый пустой строкой:

```typescript
// 1. Node/Built-in
import { readFile } from "fs";

// 2. External libraries
import { create } from "zustand";
import { Button } from "@/components/ui/button";

// 3. Internal absolute
import { isTauri } from "@/lib/tauri-api";

// 4. Internal relative (ТОЛЬКО в пределах features-папки)
import { formatBytes } from "./utils";
```

### 4.5 Работа с ошибками

```typescript
// TypeScript: typed catch
try {
  await tauri.downloadFile(url, dest, id);
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  log.error(`Download failed: ${message}`);
  set({ status: "failed" });
}
```

```rust
// Rust: anyhow для прикладного кода, thiserror для библиотечного
#[tauri::command]
pub async fn download_file(url: String, dest: String) -> Result<String, String> {
    let content = reqwest::get(&url)
        .await
        .map_err(|e| format!("Network error: {}", e))?;
    // ...
    Ok(dest)
}
```

---

## 5. Паттерны взаимодействия

### 5.1 Frontend ↔ Backend (Tauri)

```
React Component
      │
      ▼
Zustand Store (useLlamaStore)
      │
      ▼
tauri-api.ts (typed wrappers)
      │
      ▼
┌──── Tauri Bridge ────┐
      │
      ▼
Command Handler (commands.rs)
      │
      ▼
Domain Service (processes.rs, etc.)
```

**Правила:**

1. Компоненты НЕ вызывают `invoke()` напрямую.
2. Сторы — единственное место, где вызывается `tauri-api.ts`.
3. `tauri-api.ts` — единственное место, где есть `window.__TAURI__?.core?.invoke`.
4. Каждый вызов Tauri обёрнут в try/catch с обработкой ошибки в сторе.
5. При ошибке: стоп-процесс → уведомление → лог → очистка состояния.

### 5.2 Rust singleton → DI

```rust
// ЗАПРЕЩЕНО:
pub static GLOBAL_STATE: Lazy<GlobalState> = ...;

// РАЗРЕШЕНО:
pub struct AppState {
    pub process_manager: ProcessManager,
    pub model_scanner: ModelScanner,
    pub config: RwLock<AppConfig>,
}

pub fn run() {
    tauri::Builder::default()
        .manage(AppState::new())
        .invoke_handler(...)
        .setup(|app| {
            let state = app.state::<AppState>();
            // ...
        });
}
```

### 5.3 Логирование

```
┌──────────────┐     ┌──────────────┐
│  frontend.ts │────▶│ persistToBack│────▶┌──────────────┐
│  log.info()  │     │ end()         │     │  logger.rs   │
└──────────────┘     └──────────────┘     │  write_fronte│
                                           │  nd_log      │
┌──────────────┐                           └──────┬───────┘
│  Rust code   │──────────────────────────────────▶│
│  log_info!() │    write directly to file         │
└──────────────┘                                   ▼
                                            ┌──────────────┐
                                            │ ~/.llama-     │
                                            │ launcher/logs/│
                                            │ *.log         │
                                            └──────────────┘
```

### 5.4 Хранилище данных

```
┌─────────────────────────────────────┐
│  SQLite (tauri-plugin-sql)          │◀── Rust (models, processes, workspaces)
├─────────────────────────────────────┤
│  localStorage                       │◀── Frontend (hibernation, profiles)
├─────────────────────────────────────┤
│  tauri-plugin-store (config.json)   │◀── Rust (AppConfig)
└─────────────────────────────────────┘
```

**Правила:**

- Rust — единственный источник истины для моделей, процессов, релизов.
- Frontend кэширует данные из Rust в Zustand.
- localStorage — только для frontend-only фич (hibernation, UI preferences).
- Мутации данных ВСЕГДА идут через Tauri invoke → Rust.

---

## 6. Тестирование

### 6.1 Типы тестов

| Тип         | Инструмент | Покрытие            |
| ----------- | ---------- | ------------------- |
| Unit (Rust) | `#[test]`  | ≥ 80% domain layer  |
| Unit (TS)   | vitest     | ≥ 80% stores, utils |
| Integration | cargo test | Core flows          |
| E2E         | Playwright | Критические пути    |

### 6.2 Правила

- Каждый публичный метод стора имеет unit-тест.
- Каждый Tauri command имеет mock-тест (mock Tauri API).
- Для компонентов — Storybook или snapshot-тесты.
- Нет тестов = нет кода.

---

## 7. Процесс рефакторинга (из Refactoring.Guru)

1. **Красный** — тест не проходит или есть запах кода
2. **Зелёный** — минимальное изменение, тест проходит
3. **Рефакторинг** — улучшить код, тест всё ещё проходит

**Категорически запрещено:**

- Рефакторить и добавлять функциональность в одном коммите.
- Делать рефакторинг без тестов.
- Менять API публичных методов без обновления всех потребителей.

---

## 8. Чеклист перед сдачей кода

- [ ] Каждый файл ≤ 200 строк
- [ ] Каждый метод ≤ 15 строк
- [ ] Нет `console.log`, `eprintln!` (кроме отладки)
- [ ] Нет `unwrap()`, `expect()` (кроме тестов)
- [ ] Нет дублирования кода
- [ ] Нет магических чисел (только именованные константы)
- [ ] Все ошибки обработаны (typed catch / Result)
- [ ] TypeScript: нет `any`
- [ ] Rust: нет `unsafe`
- [ ] Комментарии только объясняют "почему" (не "как")
- [ ] Соответствие архитектурным слоям (Clean Architecture)
- [ ] Компоненты не вызывают invoke() напрямую
- [ ] Сторы не превышают лимиты по строкам

---

Этот файл является обязательным к применению для всех AI-агентов, работающих с llama-launcher. Нарушения считаются дефектом и подлежат автоматическому исправлению.
