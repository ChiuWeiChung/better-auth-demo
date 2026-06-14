# Project Overview

## Background

本專案的目標是建立一套企業內部權限管理系統（Role Management System），提供 Organization Head、Role、Function Group 與 Entitlement 的管理能力，並確保系統具備完整的認證（Authentication）、授權（Authorization）以及操作追蹤（Audit Log）機制。

---

## Core Domain Model

```text

Organization Heads (組織層級管理單位)

        ↓

      Roles (組織下的角色)

        ↓

 Function Groups (擁有相關的權限)

        ↓

   Entitlements (權限底下的功能存取項目)

```

## Technical Stack
| Area | Technology |
|---|---|
| Backend | Next.js Route Handler |
| Database | MariaDB |
| Authentication | Better-Auth |
| Authorization | RBAC |
| Logging | Pino |
| API Documentation | Swagger UI |
| Audit Log | audit_logs Table |

---

<!-- | Module | Design Decision | Why  |
|----------|----------|----------|
| API Design | RESTful API |  REST 較簡單且文件生成容易 |
| Database | MariaDB | OrgHead / Roles / Entitlement 關聯明確，需要 Referential Integrity |
| Authentication | Better-Auth + Cookie Session | 只考慮 Internal System，實作簡單、登出可立即失效、不需處理 Refresh Token |
| Authorization | RBAC | 角色與權限劃分明確，開發與維護成本較低 |
| Audit Log | DB Audit Log Table | 相較僅寫入系統 Log，可獨立查詢、保留與稽核 |
| Logging | Pino Logger + EFK | 相較純文字 Log，結構化資料更容易搜尋與分析 | -->

### Database Design


因 Organization Head、Role、Function Group 與 Entitlement 之間具有明確且高度關聯的資料結構，此外透過 Foreign Key Constraint 可避免產生孤兒資料，例如不存在的 Role 被綁定 Entitlement。

| Item | Details |
|---|---|
| Database | MariaDB |
| Database Type | Relational Database |
| Core Tables | `orga_head`, `roles`, `function_groups`, `entitlements` |
| Relationship | Organization Head 擁有多個 Roles；Role 可對應多個 Entitlements；Entitlements 可歸屬於 Function Groups |
| Query Pattern | 透過 Join 查詢 Organization Head 底下的 Roles、Function Groups 與 Entitlements |
| Trade-off | Join 查詢成本較高，但能換取較佳的資料一致性與可維護性 |

#### Core Tables

| Table | Description |
|---|---|
| `organization_heads` | 記錄 Organization Head 資料 |
| `roles` | 記錄 Role 基本資料 |
| `function_groups` | 記錄權限功能群組 |
| `entitlements` | 記錄功能群組底下的權限項目 |
| `audit_logs` | 記錄 Write 操作、安全事件與重要業務事件 |


### Authentication

本專案使用 Better-Auth 作為身份驗證方案，採用 Database-backed Cookie Session 機制管理登入狀態。考量本系統屬於 Internal Admin System，優先考慮 Session 管理的簡單性、安全性以及立即失效（Revocation）能力，因此未採用 JWT Session。

| Item | Details |
|---|---|
| Authentication Solution | Better-Auth |
| Session Strategy | Database-backed Cookie Session |
| Session Storage | MariaDB |
| Authentication Method | Cookie Session |
| Session Validation | Middleware 驗證 Session 是否存在且有效 |
| Why Better-Auth | 提供完整 Authentication 流程，降低自行實作成本 |
| Why Cookie Session | Session 可立即失效，不需管理 Access Token / Refresh Token |
| Why Database-backed Session | Session 狀態集中管理，方便追蹤與撤銷 |
| Trade-off | 每次 Request 需驗證 Session，相較 JWT 會增加資料庫查詢成本 |

#### Authentication Flow

```text
        Client Request
                ↓
┌──────────────────────────────┐
│          Middleware          │
│                              │
│ 1. Check Public Endpoint     │
│ 2. Validate Session Cookie   │
│ 3. Load Session From DB      │
│ 4. Verify Session            │
│                              │
└──────────────────────────────┘
                ↓
    401 Unauthorized (if failed)
                ↓
            API Handler
```

#### Design Decision

| Decision | Reason |
|---|---|
| 使用 Better-Auth | 降低 Authentication 開發與維護成本 |
| 使用 Cookie Session | 適合 Internal System，不需處理 JWT Refresh Flow |
| 使用 Database-backed Session | Session 可立即失效，提升安全性 |
| Middleware 驗證 Session | 集中管理 Authentication 邏輯，避免重複程式碼 |

#### Explanation

本專案屬於企業內部權限管理系統，因此選擇 Database-backed Cookie Session 作為 Authentication 機制。相較於 JWT，Cookie Session 可以更容易做到 Session Revocation，例如管理員停用帳號或使用者登出時，可立即使 Session 失效。此外，透過 Better-Auth 可以快速整合 Authentication 流程，降低自行實作安全機制的風險。

### Authorization

本專案採用 RBAC（Role-Based Access Control）作為授權模型，透過 Role 與 Permission 的關聯管理使用者可存取的 API 與系統功能。所有非公開 API 請求皆會先經過 Middleware 進行權限驗證，驗證通過後才會進入 API Handler 執行業務邏輯。

| Item | Details |
|---|---|
| Authorization Model | RBAC (Role-Based Access Control) |
| Permission Source | Database |
| Validation Layer | Middleware |
| Protected Resources | API Endpoints |
| Permission Assignment | User → Role → Permission |
| Why RBAC | 權限模型清晰、易於管理與擴充 |
| Why Middleware | 集中處理授權邏輯，避免 Controller 重複驗證 |
| Trade-off | 權限規則較固定，彈性低於 ABAC |

#### RBAC Tables

| Table | Purpose |
|---|---|
| `users` | 系統使用者 |
| `system_roles` | 系統角色 |
| `permissions` | 系統權限 |
| `role_permissions` | Role 與 Permission 關聯 |
| `user_roles` (若有) | User 與 Role 關聯 |

#### Authorization Flow

```text
      Client Request
            ↓
┌──────────────────────────────┐
│          Middleware          │
│                              │
│ 1. Check Public Endpoint     │
│ 2. Validate Session          │
│ 3. Load User Permissions     │
│ 4. RBAC Authorization        │
│ 5. Inject Request Headers    │
│                              │
└──────────────────────────────┘
            ↓
    403 Forbidden (if failed)
            ↓
        API Handler
```

#### Header Injection

| Header | Purpose |
|---|---|
| `x-user-id` | 識別當前操作使用者 |
| `x-trace-id` | Request Tracing |
| `x-endpoint` | Log 與 Audit Log 關聯追蹤 |

#### Explanation

本專案選擇 RBAC 作為授權模型，因為需求主要圍繞在 Role 與 Permission 的管理。所有權限驗證統一由 Middleware 處理，避免 Controller 重複撰寫驗證邏輯，同時透過 Header Injection 將 User 與 Trace 資訊傳遞至後續流程，方便 Log 與 Audit Log 的追蹤。

### Request Flow

本專案將 Authentication、Authorization、Request Tracing、Logging 等 Cross-Cutting Concerns 集中於 Middleware 與 Response Handler 層處理，讓 API Handler 專注於業務邏輯（Business Logic）。

```text
Client Request
      ↓
┌──────────────────────────────┐
│          Middleware          │
│                              │
│ 1. Check Public Endpoint     │
│ 2. Validate Session          │
│ 3. RBAC Authorization        │
│ 4. Header Injection          │
│                              │
└──────────────────────────────┘
      ↓
API Handler
      ↓
Business Logic
      ↓
Success / Error Handler
      ↓
Response
```

---

#### Middleware Responsibilities

| Step | Description |
|---|---|
| Check Public Endpoint | 判斷當前 API 是否需要驗證 |
| Validate Session | 驗證 Cookie Session 是否存在且有效 |
| RBAC Authorization | 驗證使用者是否擁有存取權限 |
| Header Injection | 注入 Request Metadata 供後續流程使用 |

---

#### Authentication Flow

```text
Request
      ↓
Check Public Endpoint
      ↓
Public API ?
      ↓
 Yes → Continue
 No
      ↓
Validate Session Cookie
      ↓
Load Session From Database
      ↓
Session Valid ?
      ↓
 Yes → Continue
 No  → 401 Unauthorized
```

---

#### Authorization Flow

```text
Authenticated User
      ↓
Load User Roles
      ↓
Load Permissions
      ↓
Permission Check
      ↓
Authorized ?
      ↓
 Yes → Continue
 No  → 403 Forbidden
```

---

#### Header Injection

驗證通過後，Middleware 會將相關資訊注入 Request Header，供後續流程使用。

| Header | Purpose |
|---|---|
| `x-user-id` | 識別當前操作使用者 |
| `x-trace-id` | Request Tracing |
| `x-endpoint` | API Endpoint 識別 |

---

#### API Handler Responsibilities

API Handler 僅負責業務邏輯：

- SQL Query
- Data Transformation
- Domain Validation
- Business Logic Processing

不負責：

- Authentication
- Authorization
- Logging
- Audit Log
- Response Formatting

---

#### Success Flow

```text
API Handler
      ↓
Business Logic
      ↓
Operation Success
      ↓
successHandler
      ↓
Application Log
      ↓
Audit Log Decision
      ↓
Response
```

---

#### Error Flow

```text
API Handler
      ↓
Business Logic
      ↓
Throw Error
      ↓
errorHandler
      ↓
Error Mapping
      ↓
Application Log
      ↓
Audit Log Decision
      ↓
Response
```

---

#### Design Decision

| Decision | Reason |
|---|---|
| Authentication 放在 Middleware | 避免每個 API 重複驗證 Session |
| Authorization 放在 Middleware | 集中管理權限驗證邏輯 |
| Header Injection | 提供 Log 與 Audit Log 所需資訊 |
| Success / Error Handler | 統一處理 Response 與 Logging |
| API Handler 僅負責 Business Logic | 提高可維護性與可測試性 |

---

#### Oral Explanation

當 Request 進入系統後，會先經過 Middleware。Middleware 負責 Public Endpoint 判斷、Session 驗證、RBAC 權限驗證以及 Header Injection。驗證通過後才會進入 API Handler 執行業務邏輯，例如 SQL Query 或資料轉換。業務邏輯完成後，統一交由 successHandler 或 errorHandler 處理 Response Format、Status Code、Application Log 與 Audit Log 的寫入。

透過這種設計，可以將 Authentication、Authorization、Logging 等 Cross-Cutting Concerns 集中管理，讓 API Handler 專注於 Business Logic，提高系統的一致性與可維護性。


### API Design

負責提供 Organization Head、Role、Function Group 與 Entitlement 相關查詢與管理功能。API 採用 RESTful 設計，並透過統一的 `successHandler` / `errorHandler` 管理 Response、Status Code、Audit Log。


#### Endpoints

| Method | Endpoint | Title | Description |
|---|---|---|---|
| GET | `/api/v1/orgHead/all/roles` | Get All Organization Heads Roles | 取得所有 Organization Heads 底下的 Roles to Entitlements 關聯資料 |
| GET | `/api/v1/orgHead/{orgHead}/roles` | Get Specific Organization Head Roles | 取得特定 Organization Head 底下的 Roles to Entitlements 關聯資料 |
| POST | `/api/v1/roles` | Create Role | 新增 Role，並建立 Role 與 Entitlements 的關聯 |
| PATCH | `/api/v1/roles` | Update Role | 更新 Role。Primitive fields 採 Partial Update；Entitlements collection 採 Replace All Synchronization |
| DELETE | `/api/v1/roles` | Delete Role | 刪除 Role，並處理 Role 與 Entitlements 的關聯資料 |

### Audit Log


本專案實作獨立的 Audit Log 機制，用於追蹤重要業務操作與安全性事件。Audit Log 與 Application Log（EFK）採取分離設計，因為兩者關注的面向不同：Audit Log 著重於「誰在什麼時間做了什麼事」，而 EFK 則著重於系統監控、錯誤排查與可觀測性（Observability）。

| Item | Details |
|---|---|
| Module | Audit Log |
| Storage | `audit_logs` Table |
| Purpose | 記錄重要業務操作與安全性事件 |
| Trigger Point | `successHandler` / `errorHandler` |
| Log Category | Business Event、Security Event |
| Why Separate Table | 與 Application Log 分離，避免業務事件被大量系統 Log 淹沒 |


#### Audit Log Fields

| Field | Purpose |
|---|---|
| id | Audit Log Identifier |
| user_id | 執行操作的使用者 |
| action | 執行的動作 |
| resource | 操作的資源 |
| endpoint | API Endpoint |
| payload | 使用者針對該資源操作的細節 |
| outcome | Security Event or Success or Failed|
| trace_id | Request Trace ID |
| status | Success / Failed |
| created_at | 事件發生時間 |

#### Explanation

Audit Log 的目的並非取代 EFK，而是提供業務操作與安全事件的可追蹤性。例如管理員建立、修改或刪除 Role 時，系統需要記錄是誰在什麼時間執行了什麼操作，以符合稽核需求。相較之下，EFK 更偏向技術層面的 Observability，例如 Exception、Timeout 或 Infrastructure Error。因此我選擇將 Audit Log 獨立存放於資料庫，避免與一般系統 Log 混在一起。

### Success / Error Handler

**Description**

本專案透過 `successHandler` 與 `errorHandler` 集中處理 API 回應、Status Code、Application Log 以及 Audit Log 寫入判斷。  
此設計可避免每個 API Handler 重複撰寫 Response 與 Error Mapping 邏輯，讓 Controller 專注於業務邏輯。

| Item | Details |
|---|---|
| Module | Success / Error Handler |
| Purpose | 統一處理 API Response、Status Code、Logging 與 Audit Log |
| Trigger Point | API Handler 完成業務邏輯後呼叫 |
| Response Format | 統一成功與失敗回應格式 |
| Why | 避免 Controller 重複處理 Response、Status Code、Log 與 Audit Log |
| Benefit | Controller 專注 Business Logic，提高可維護性 |
| Trade-off | 多一層抽象，需要維護 Handler 規則與 Error Mapping |

#### Handler Responsibilities

| Handler | Responsibility |
|---|---|
| `successHandler` | 回傳成功 Response |
| `successHandler` | 決定成功狀態碼 |
| `successHandler` | 記錄成功 Application Log |
| `successHandler` | 針對 Write 操作寫入 Audit Log |
| `errorHandler` | 統一錯誤 Response 格式 |
| `errorHandler` | 將 Error 對應成適當 Status Code |
| `errorHandler` | 記錄錯誤 Application Log |
| `errorHandler` | 依錯誤類型判斷是否寫入 Audit Log |

#### Success Flow

```text
API Handler
      ↓
Business Logic
      ↓
Operation Success
      ↓
successHandler
      ↓
Application Log
      ↓
Audit Log Decision
      ↓
Response
```

#### Error Flow

```text
API Handler
      ↓
Business Logic
      ↓
Throw Error
      ↓
errorHandler
      ↓
Error Mapping
      ↓
Application Log
      ↓
Audit Log Decision
      ↓
Response
```

#### Audit Log Decision

| Scenario | Handler | Write Audit Log |
|---|---|---|
| Create Role Success | `successHandler` | ✅ |
| Update Role Success | `successHandler` | ✅ |
| Delete Role Success | `successHandler` | ✅ |
| Get Roles Success | `successHandler` | ❌ |
| Unauthorized | `errorHandler` | ✅ |
| Forbidden | `errorHandler` | ✅ |
| Business Error | `errorHandler` | ✅ |
| Validation Error | `errorHandler` | ❌ |
| Unhandled Exception | `errorHandler` | ✅ Current Design |

#### Explanation

本專案透過 `successHandler` 與 `errorHandler` 集中管理 API 回應流程。Controller 主要負責業務邏輯，例如查詢資料、資料轉換與呼叫 Service；而成功或失敗後的 Response Format、Status Code、Application Log 與 Audit Log 判斷，則交由 Handler 統一處理。

這樣做的好處是可以避免每個 API 重複撰寫相同的 Response 與 Error Handling 邏輯，也能確保 Audit Log 的寫入規則一致。雖然會多一層抽象，但整體可維護性與一致性會更好。


### Architecture Decisions

本章節整理本專案主要架構決策，說明每個技術選擇背後的原因、替代方案與取捨。重點不只是「使用了什麼技術」，而是「為什麼選擇這個方案，而不是其他方案」。

| Decision Area | Selected Solution | Alternatives | Why This Choice | Trade-off |
|---|---|---|---|---|
| API Design | RESTful API | GraphQL、RPC | CRUD 與查詢需求明確，REST 容易理解，Swagger 支援成熟 | 需要維護多個 Endpoint |
| Backend Framework | Next.js API Route Handler | Express、NestJS、Fastify | 專案前端只需呈現 Swagger UI，API 可直接整合於 Next.js 專案中，降低專案複雜度 | 若未來後端規模變大，可能需要更完整的 Backend Framework |
| Database | MariaDB | MongoDB、DynamoDB | Role、Function Group、Entitlement 關聯性高，適合使用 Relational DB 維護資料一致性 | Join 查詢成本較高，Schema 變更較嚴謹 |
| Authentication | Better-Auth + Database-backed Cookie Session | JWT Session、自建 Auth | 適合 Internal Admin System，Session 可立即失效，且不需自行處理 Access Token / Refresh Token | 每次請求需要驗證 Session，可能增加 DB 查詢成本 |
| Authorization | RBAC | ABAC、ACL | 權限模型清楚，符合企業內部角色權限管理需求 | 權限規則較固定，彈性低於 ABAC |
| Permission Validation | Middleware | 每個 API Handler 個別驗證 | 集中處理 Authentication / Authorization，避免 Controller 重複實作驗證邏輯 | Middleware 邏輯較集中，需維護清楚流程 |
| Request Traceability | `x-user-id` / `x-trace-id` / `x-endpoint` Header Injection | Controller 重新解析 Session、Global Context | API Handler 可直接取得使用者與追蹤資訊，方便 Application Log 與 Audit Log 串接 | Header 數量增加，需要避免被 Client 偽造 |
| Role Basic Fields Update | Partial Update | Replace All | Primitive fields 只更新 Client 傳入欄位，減少 Payload 與不必要更新 | 需要判斷哪些欄位有被傳入 |
| Role-Entitlement Update | Replace All Synchronization | Incremental Update | Entitlements 視為完整權限集合，Client 傳入的陣列即代表最終狀態，避免 Diff 計算錯誤 | 若 Entitlements 數量很大，更新操作量較高 |
| Audit Log | `audit_logs` Table | 僅依賴 EFK | Audit Log 著重業務操作與安全事件，與系統排錯 Log 目的不同 | 增加額外資料表與寫入成本 |
| Application Logging | Pino | Winston、Console Log | 效能佳、輸出 JSON，適合與 EFK 整合 | 功能較精簡，需要自行設計 log format |
| Response Handling | `successHandler` / `errorHandler` | Controller 各自處理 Response | 統一 Response Format、Status Code、Log 與 Audit Log 判斷 | 多一層抽象，需要維護 Handler 規則 |
| API Documentation | Swagger UI | Postman Collection、手寫文件 | 可直接測試 API，降低溝通與驗證成本 | 需要維護 OpenAPI Spec |