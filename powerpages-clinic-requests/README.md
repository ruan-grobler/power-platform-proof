# Contoso Clinic appointment requests

A Microsoft Power Pages **code site** (single-page application) built with React, Vite and TypeScript. Patients request an appointment online instead of waiting on hold, the request lands in a Dataverse table with a recorded POPIA consent, and signed-in patients can track every request and its status.

Contoso Clinic is fictional. This project is portfolio proof of Power Pages, Dataverse and Web API skills. It runs fully offline for demos and is ready to upload to a real Power Pages site with the Power Platform CLI (see [SETUP.md](SETUP.md)).

## What it does

- **Public request form** with a short hero: full name, phone, email, preferred date, preferred time of day, reason, and a required POPIA consent checkbox with a plain-language consent line.
- **Validation that matches the clinic's rules:** South African phone numbers (normalised to `+27...`), real dates from tomorrow up to 90 days ahead, no Sundays, sensible length limits.
- **Accessible by design:** every input has a visible label and hint, errors are linked with `aria-describedby`, an error summary takes focus after a failed submit and links to each field, the success screen takes focus, route changes move focus to the page heading, and status badges never rely on colour alone.
- **Success state** with a reference number (for example `CR-1A2B3C4D`) and a summary of what was asked for.
- **My requests** for signed-in portal users: their own requests, newest first, each with a New, Confirmed or Declined badge and what that status means.
- **Power Pages Web API client** with the CSRF token fetch (`/_layout/tokenhtml`, sent as the `__RequestVerificationToken` header), the documented OData headers, one automatic retry when the token expires, and plain-English messages for the documented error codes.
- **Mock adapter** picked automatically on localhost, so `npm run dev` works with seeded data and a demo sign-in, no tenant needed.
- Responsive from 320px up, light and dark themes, no UI library.

## Run it locally

```bash
npm install
npm run dev        # http://localhost:5180 (mock data)
```

Or the production build:

```bash
npm run build
npm run preview    # http://localhost:4180
```

Select **Sign in** to become the demo patient, then open **My requests**. Demo data is kept in this browser only.

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server on port 5180 |
| `npm run build` | Type-check (`tsc -b`) and build to `dist/` |
| `npm run preview` | Serve `dist/` on port 4180 |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Vitest in watch mode |
| `npm run typecheck` | Type-check only |
| `npm run metadata:apply` | After the first upload, copy the Web API site settings and table permissions into `.powerpages-site/` |

## How it works

```
Browser (React SPA)
  |-- AppointmentForm ---> validation.ts (pure, tested)
  |                    \--> RequestsApi.submitRequest
  |-- MyRequestsPage ---> RequestsApi.listMyRequests
  |
  createBackend()  picks one implementation:
  |-- localhost, or no Power Pages portal object ---> mockBackend.ts (seeded, in browser)
  \-- Power Pages host -----------------------------> powerPagesRequests.ts
                                                       \--> powerPagesClient.ts
                                                             GET  /_layout/tokenhtml  (CSRF token)
                                                             POST /_api/cr_appointmentrequests
                                                             GET  /_api/cr_appointmentrequests?$select&$filter&$orderby
```

- **Choosing the data layer.** `VITE_DATA_ADAPTER` can force `mock` or `powerpages`. On `auto` (the default), localhost always uses the mock. Any other host uses the Web API only if Power Pages has injected `window.Microsoft.Dynamic365.Portal`, so a static preview elsewhere still falls back to the mock.
- **Creating a request.** The form's cleaned values are mapped to `cr_appointmentrequest` columns. Consent is stored as a Yes/No plus a timestamp and a consent wording version. Status is never sent; Dataverse defaults it to New. For signed-in users the request is linked to their contact with `cr_Contact@odata.bind`.
- **Reading requests.** `My requests` selects only the columns it needs and filters on `_cr_contact_value`. The Contact-scoped table permission is what actually limits the rows; the filter just keeps intent explicit.
- **All schema names live in one file:** `src/config/dataverse.ts`. Change the publisher prefix or choice values there.

### Security model

| Who | Table permission | Can do |
| --- | --- | --- |
| Anonymous Users | Appointment Request, Global, Create only | Send a request. Cannot read any request. |
| Authenticated Users | Appointment Request, Contact scope, Read, Create, Append | Send a request linked to themselves, read only their own. |
| Authenticated Users | Contact, Self scope, Read, Append to | Allow their own contact to be linked to a request. |

No role has Write or Delete. The Web API fields setting lists every column explicitly (no wildcard). Full steps are in [SETUP.md](SETUP.md).

## Project structure

```
powerpages-clinic-requests/
  index.html
  powerpages.config.json          # read by pac pages upload-code-site
  package.json
  vite.config.ts                  # ports 5180 and 4180, Vitest config
  tsconfig.json, tsconfig.app.json, tsconfig.node.json
  public/favicon.svg
  powerpages-metadata/            # Web API settings and table permissions as code
    site-settings/*.sitesetting.yml
    table-permissions/*.tablepermission.yml
  scripts/apply-powerpages-metadata.mjs
  src/
    main.tsx, App.tsx, router.tsx, styles.css
    config/dataverse.ts           # table, column and choice names
    domain/                       # types, validation, dates, consent text, options
    api/
      powerPagesClient.ts         # token, headers, errors
      powerPagesRequests.ts       # Dataverse mapping and queries
      mockBackend.ts              # offline adapter with seed data
      backend.ts                  # picks mock or Power Pages
    auth/powerPagesAuth.ts        # portal user, sign-in and sign-out
    components/                   # form fields, error summary, status badge, header and footer
    pages/                        # RequestPage, MyRequestsPage, NotFoundPage
    test/fakePowerPages.ts        # in-memory fake of the Power Pages endpoints
    **/*.test.ts                  # Vitest suites
```

## Tests

`npm test` runs 57 tests in four suites:

- `domain/validation.test.ts`: every field rule, South African phone formats, date bounds, Sundays, impossible dates, consent.
- `api/powerPagesClient.test.ts`: token parsing and caching, the exact headers sent, entity ID from `entityid` or `OData-EntityId`, retry on an expired token, no retry on permission errors, error code mapping.
- `api/powerPagesRequests.test.ts`: Dataverse payload mapping, `@odata.bind` for the contact, GUID checks, query building, row mapping, and a full create then list round trip against the fake Power Pages endpoints.
- `api/mockBackend.test.ts`: seed data, contact isolation, anonymous requests staying unreadable, storage failures, demo sign-in, and how the data layer is chosen.

## Deploy (summary)

```bash
npm run build
pac auth create --environment "https://<your-org>.crm.dynamics.com"
pac pages upload-code-site --rootPath .
```

Then reactivate the site in Power Pages, add the site settings and table permissions, and upload again. [SETUP.md](SETUP.md) has every step, including the Dataverse table, the exact site settings and troubleshooting.

## Checked against Microsoft documentation

Checked on 16 October 2026:

- [Create and deploy a single-page application in Power Pages](https://learn.microsoft.com/en-us/power-pages/configure/create-code-sites): `upload-code-site` and `download-code-site`, `powerpages.config.json` fields, `bundleFilePatterns`, blocked `.js` attachments, reactivating an inactive site, `window["Microsoft"].Dynamic365.Portal.User`, the `/_layout/tokenhtml` token pattern and the `/Account/Login/ExternalLogin` sign-in form.
- [pac pages command reference](https://learn.microsoft.com/en-us/power-platform/developer/cli/reference/pages) and [pac auth command reference](https://learn.microsoft.com/en-us/power-platform/developer/cli/reference/auth): parameters for `upload-code-site` and `auth create`.
- [Install PAC CLI with .NET Tool](https://learn.microsoft.com/en-us/power-platform/developer/howto/install-cli-net-tool).
- [Portals Web API overview](https://learn.microsoft.com/en-us/power-pages/configure/web-api-overview): `/_api` route, EntitySetName, `Webapi/<table>/enabled` and `Webapi/<table>/fields`, wildcard deprecation, CSRF requirement.
- [Web API write, update and delete](https://learn.microsoft.com/en-us/power-pages/configure/write-update-delete-operations) and [read operations](https://learn.microsoft.com/en-us/power-pages/configure/read-operations): POST and GET formats, `@odata.bind`, `$select`, `$filter`, `$orderby`, lookup annotations.
- [Compose HTTP requests and handle errors](https://learn.microsoft.com/en-us/power-pages/configure/web-api-http-requests-handle-errors): required headers and the hex error codes.
- [Table permissions](https://learn.microsoft.com/en-us/power-pages/security/table-permissions), [web roles](https://learn.microsoft.com/en-us/power-pages/security/create-web-roles) and [column permissions](https://learn.microsoft.com/en-us/power-pages/security/column-permissions).

The YAML layout for `.powerpages-site/` (file names, `adx_entitypermission_webrole`, scope codes, `contactrelationship`) is not on Learn. It follows Microsoft's [power-pages-samples](https://github.com/microsoft/power-pages-samples) SPA sample and Microsoft's [power-platform-skills](https://github.com/microsoft/power-platform-skills) Power Pages tooling.

## Known limits

- Not deployed. The `pac` commands are documented but were not run, because there is no tenant connection here by design.
- Choice values, the Contact relationship schema name and the `cr_Contact` navigation property are the usual Dataverse defaults. Confirm them in your environment (SETUP.md step 2).
- Append (on the request) and Append to (on the contact) follow standard Dataverse privilege rules. If your site reports error `90040105` or `90040106`, SETUP.md says which side to change.
- The default sign-in uses the site's Entra ID provider. A real patient portal should add a customer identity provider.
