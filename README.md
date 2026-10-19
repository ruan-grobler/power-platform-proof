# Power Platform proof projects

Two small, tested builds that show pro-code work alongside Microsoft Power Platform:

| Project | What it is | Stack |
|---|---|---|
| [pcf-sla-countdown](pcf-sla-countdown/) | A PCF field control that shows how long is left before a due date, with green, amber, red and overdue states | Power Apps Component Framework, TypeScript, Vitest |
| [powerpages-clinic-requests](powerpages-clinic-requests/) | A Power Pages code site where patients request an appointment (with POPIA consent) and signed-in users see their own requests | Power Pages Web API, React, Vite, TypeScript, Vitest |

Both projects build cleanly and have 57 automated tests each. Each folder has its own README with how to run it locally and how to deploy it to a Dataverse environment with the Power Platform CLI.

## Run them locally

```
cd pcf-sla-countdown && npm install && npm start
```

Opens the PCF test harness at http://localhost:8181.

```
cd powerpages-clinic-requests && npm install && npm run dev
```

Opens the site with mock data at http://localhost:5180.

Built by Ruan Grobler, Microsoft Certified: Power Platform Fundamentals.
