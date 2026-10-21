# Power Platform proof projects

A PCF control that turns a due date into a live SLA countdown on a model driven form, and a Power Pages site where clinic patients request an appointment with POPIA consent. Both are pro-code Power Platform builds in strict TypeScript.

![Tests](https://img.shields.io/badge/tests-114%20passing-2EA043?style=flat-square) ![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript&logoColor=white) ![Power Apps PCF](https://img.shields.io/badge/Power%20Apps-PCF%20control-742774?style=flat-square) ![Power Pages](https://img.shields.io/badge/Power%20Pages-code%20site-5C2D91?style=flat-square) ![Dataverse](https://img.shields.io/badge/Dataverse-Web%20API-107C10?style=flat-square) ![Vitest](https://img.shields.io/badge/Vitest-tested-6E9F18?style=flat-square&logo=vitest&logoColor=white) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](LICENSE)

**The result.** 114 automated tests pass (57 per project), both projects typecheck clean, and both production builds succeed. From a fresh run on 21 October 2026, saved in [docs/test-output.txt](docs/test-output.txt).

![Terminal output for both projects. pcf-sla-countdown: lint succeeded, typecheck exit code 0, 57 of 57 tests passed, build compiled successfully with bundle.js 16.8 KiB. powerpages-clinic-requests: typecheck exit code 0, 57 of 57 tests passed, Vite build with JS 254.86 kB, 80.12 kB gzip.](docs/images/test-run.svg)

<sub>An excerpt of [docs/test-output.txt](docs/test-output.txt): the command and result lines of each step, with the npm banners cut.</sub>

## Run them locally

```
cd pcf-sla-countdown && npm install && npm start
```

Opens the PCF test harness at http://localhost:8181.

```
cd powerpages-clinic-requests && npm install && npm run dev
```

Opens the site with mock data at http://localhost:5180.

## The two projects

| Project | What it is | Stack |
|---|---|---|
| [pcf-sla-countdown](pcf-sla-countdown/) | A PCF field control that shows how long is left before a due date, with green, amber, red and overdue states | Power Apps Component Framework, TypeScript, Vitest |
| [powerpages-clinic-requests](powerpages-clinic-requests/) | A Power Pages code site for a fictional clinic, where patients request an appointment (with POPIA consent) and signed-in users see their own requests | Power Pages Web API, React, Vite, TypeScript, Vitest |

Both projects build cleanly and have 57 automated tests each. Each folder has its own README with how to run it locally and how to deploy it to a Dataverse environment with the Power Platform CLI.

## Architecture

```mermaid
flowchart TB
  subgraph PCF["pcf-sla-countdown"]
    direction LR
    F["Model driven form<br/>Date and Time column"] --> C["SlaCountdown<br/>index.ts"]
    C -- "every minute" --> S["computeSla()<br/>pure, unit tested"]
    S --> B["Badge with state<br/>and aria-label"]
  end
  subgraph PP["powerpages-clinic-requests"]
    direction LR
    U["React SPA<br/>request form"] --> V["validation.ts"]
    V --> BE{"createBackend()"}
    BE -- "localhost" --> M["mockBackend.ts<br/>seeded data"]
    BE -- "Power Pages" --> API["powerPagesClient.ts<br/>CSRF token, one retry"]
    API --> T[("Dataverse<br/>cr_appointmentrequest")]
  end
  PCF ~~~ PP
```

## Results

Measured on 21 October 2026 on this repo, Node 24.13.1.

| Check | pcf-sla-countdown | powerpages-clinic-requests |
|---|---|---|
| Automated tests | 57 of 57 pass (2 files) | 57 of 57 pass (4 files) |
| Typecheck | clean | clean |
| Lint | clean (Power Apps ESLint rules) | no linter configured |
| Production build | succeeds, `bundle.js` 16.8 KiB | succeeds, JS 254.86 kB (80.12 kB gzip) |

Test output, pasted from the run:

```
pcf-sla-countdown
 Test Files  2 passed (2)
      Tests  57 passed (57)
   Duration  832ms

powerpages-clinic-requests
 Test Files  4 passed (4)
      Tests  57 passed (57)
   Duration  371ms
```

Where the tests sit:

| Test file | Tests |
|---|---|
| `pcf-sla-countdown/test/sla.test.ts` | 47 |
| `pcf-sla-countdown/test/SlaCountdown.test.ts` | 10 |
| `powerpages-clinic-requests/src/domain/validation.test.ts` | 25 |
| `powerpages-clinic-requests/src/api/powerPagesClient.test.ts` | 12 |
| `powerpages-clinic-requests/src/api/mockBackend.test.ts` | 11 |
| `powerpages-clinic-requests/src/api/powerPagesRequests.test.ts` | 9 |

Every badge colour pair in the PCF control passes WCAG AA, with contrast between 6.15:1 and 11.53:1 (table in [pcf-sla-countdown](pcf-sla-countdown/README.md#states)). On the Power Pages site no web role has Write or Delete, and the Web API fields setting lists every column explicitly.

Built by Ruan Grobler, Microsoft Certified: Power Platform Fundamentals.
