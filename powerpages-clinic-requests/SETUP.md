# Setup and deployment

This guide takes the project from this folder to a live Power Pages code site backed by Dataverse.

Status: the commands below were checked against Microsoft Learn on 16 October 2026. They are documented here but have **not** been run from this repository. Nothing has been uploaded, published or deployed.

Contents

1. What you need
2. Create the Dataverse table
3. Build and test locally
4. Sign in with the Power Platform CLI
5. Upload the code site
6. Activate the site
7. Web API site settings
8. Web roles and table permissions
9. Sign-in for patients
10. Check it works on the live site
11. Troubleshooting
12. Optional hardening
13. Local preview

---

## 1. What you need

- A Power Platform environment with Dataverse and Power Pages, and admin rights on it.
- A Power Pages site on version 9.7.4.x or later (the minimum for code sites).
- Power Platform CLI (PAC CLI) version 1.44.x or later.
  - Windows: the Power Platform Tools VS Code extension or the Windows MSI.
  - macOS or Linux: install .NET (10.0 is recommended), then run:

    ```bash
    dotnet tool install --global Microsoft.PowerApps.CLI.Tool
    ```

  - Check the version by running `pac` on its own. The version is on the second line.
- Node.js 22.12 or later, and npm.
- JavaScript uploads allowed in the environment. Some environments block `.js` attachments by default. If yours does, see step 5.

---

## 2. Create the Dataverse table

Create the table in [Power Apps](https://make.powerapps.com) (Tables, New table), ideally inside a solution so it can move between environments.

**Table**

| Setting | Value |
| --- | --- |
| Display name | Appointment Request |
| Plural name | Appointment Requests |
| Schema (logical) name | `cr_appointmentrequest` |
| EntitySetName (used in `/_api/` URLs) | `cr_appointmentrequests` |
| Primary column | Name, `cr_name` |
| Record ownership | User or team (the default), so staff can assign requests |

The `cr` prefix comes from your solution publisher. If your prefix is different, use yours everywhere below and update `src/config/dataverse.ts`. To confirm the EntitySetName: in Power Apps, open the table, select **...** then **Advanced**, **Tools**, **Copy set name**.

**Columns**

| Display name | Logical name | Data type | Required | Notes |
| --- | --- | --- | --- | --- |
| Name | `cr_name` | Single line of text, max 100 | Business required | Primary column. The patient's full name. |
| Phone | `cr_phone` | Single line of text (Phone format), max 20 | Business required | Saved as E.164, for example `+27825550134`. |
| Email | `cr_email` | Single line of text (Email format), max 100 | Business required | Saved in lower case. |
| Preferred date | `cr_preferreddate` | Date only, behaviour **Date only** | Business required | Sent as `YYYY-MM-DD`. "Date only" behaviour stops time zones moving the date. |
| Preferred time | `cr_timewindow` | Choice | Business required | Morning = `100000000`, Afternoon = `100000001`, Late afternoon = `100000002`. |
| Reason | `cr_reason` | Multiple lines of text, max 1000 or more | Business required | The form allows up to 1000 characters. |
| POPIA consent | `cr_popiaconsent` | Yes/No, default No | Business required | The form only submits when this is Yes. |
| Consent timestamp | `cr_consenttimestamp` | Date and time | Optional | When the person ticked the box. Dataverse `createdon` is the server record. |
| Consent version | `cr_consentversion` | Single line of text, max 50 | Optional | Which consent wording they agreed to, for example `popia-2026-10-v1`. |
| Status | `cr_status` | Choice, default **New** | Business required | New = `100000000`, Confirmed = `100000001`, Declined = `100000002`. |
| Contact | `cr_contact` | Lookup to Contact | Optional | Set for signed-in patients. Empty for anonymous requests. |

About the choice values: Dataverse numbers choice options from your publisher's option value prefix. The values above assume the common `10000` prefix. If Dataverse gives you different numbers, change `timeWindowValues` and `statusValues` in `src/config/dataverse.ts`.

**Two names to write down** (you need them in steps 7 and 8):

1. **Contact relationship schema name.** Open the table, then **Relationships**, and find the many-to-one relationship that the Contact lookup created. It usually looks like `cr_appointmentrequest_Contact_contact`.
2. **Contact navigation property.** This is the case-sensitive name used with `@odata.bind` when the app sets the lookup. For a custom lookup it is usually the lookup's schema name, `cr_Contact`. To confirm it on the live site, read one row with `GET /_api/cr_appointmentrequests?$select=_cr_contact_value&$top=1` and look at the `_cr_contact_value@Microsoft.Dynamics.CRM.associatednavigationproperty` annotation. If it is different, update `contactNavigationProperty` in `src/config/dataverse.ts` and the fields site setting in step 7.

Clinic staff work the queue (and change Status to Confirmed or Declined) in a model-driven app or the Power Pages Management app. That part is standard Dataverse and not covered here.

---

## 3. Build and test locally

From this folder:

```bash
npm ci
npm test
npm run build
```

`npm run build` type-checks the project and writes the site to `dist/`:

```
dist/index.html
dist/favicon.svg
dist/assets/index-<hash>.js
dist/assets/index-<hash>.css
```

`powerpages.config.json` tells the CLI where these files are:

```json
{
  "$schema": "https://www.schemastore.org/powerpages.config.json",
  "siteName": "Contoso Clinic Requests",
  "compiledPath": "dist",
  "defaultLandingPage": "index.html",
  "bundleFilePatterns": ["index-*.js", "index-*.css"],
  "includeSource": false
}
```

`bundleFilePatterns` lets each upload delete the previous hashed bundles before it uploads the new ones, so old files do not pile up in the site's web files. If you later add code splitting (more hashed files), add a pattern for each new file name.

---

## 4. Sign in with the Power Platform CLI

Create an auth profile for the target environment. The `--environment` value can be the environment ID, URL, unique name or partial name.

```bash
pac auth create --environment "https://<your-org>.crm.dynamics.com"
```

If no browser can open on this machine (for example in a remote shell), use the device code flow:

```bash
pac auth create --environment "https://<your-org>.crm.dynamics.com" --deviceCode
```

Check which profile is active:

```bash
pac auth who
pac auth list
```

---

## 5. Upload the code site

Run this from the project root (the folder that holds `powerpages.config.json`):

```bash
npm run build
pac pages upload-code-site --rootPath .
```

Because `powerpages.config.json` is present, `--rootPath` is the only parameter needed. The explicit form, which does the same thing, is:

```bash
pac pages upload-code-site --rootPath . --compiledPath ./dist --siteName "Contoso Clinic Requests"
```

Command-line values win over values in `powerpages.config.json`.

What to expect:

- The first upload creates the site and adds a `.powerpages-site/` folder to this project. It holds the site's web roles, site settings and table permissions as YAML. Commit it.
- Use `upload-code-site` for this project every time, not `pac pages upload`.

If the upload fails with **"Import failed: The attachment is either not a valid type or is too large. It cannot be uploaded or downloaded."**, the environment blocks `.js` files:

1. Sign in to the [Power Platform admin center](https://admin.powerplatform.microsoft.com/).
2. Select **Manage**, then **Environments**, then your environment.
3. Select **Settings**, expand **Product**, select **Privacy + Security**.
4. In **Blocked Attachments**, remove `js`, then select **Save**.
5. Run the upload again.

---

## 6. Activate the site

1. Go to [Power Pages](https://make.powerpages.microsoft.com/).
2. Select **Inactive sites**, find **Contoso Clinic Requests**, select **Reactivate**.
3. When it is active, open the site URL to check it loads.

Later `upload-code-site` runs update the active site automatically.

---

## 7. Web API site settings

The Web API is off for every table until you turn it on. Use the table **logical name** (`cr_appointmentrequest`) in site settings, not the EntitySetName.

**Exact settings**

| Site setting name | Value |
| --- | --- |
| `Webapi/cr_appointmentrequest/enabled` | `true` |
| `Webapi/cr_appointmentrequest/fields` | `_cr_contact_value,cr_appointmentrequestid,cr_consenttimestamp,cr_consentversion,cr_Contact,cr_email,cr_name,cr_phone,cr_popiaconsent,cr_preferreddate,cr_reason,cr_status,cr_timewindow,createdon` |

Why the fields value looks like this:

- The wildcard `*` is deprecated for `Webapi/<table>/fields`, and requests against tables configured with `*` fail. Every column must be listed.
- Ordinary columns use their logical name, for example `cr_email`.
- The Contact lookup appears twice: `_cr_contact_value` is how the app reads and filters it, and `cr_Contact` is the navigation property the app writes with `cr_Contact@odata.bind`. If your navigation property is different (step 2), change it here too.
- `cr_status` is listed so "My requests" can read it. The app never sends a status; Dataverse defaults new rows to New. See step 12 to stop web users setting it.

`Webapi/error/innererror` defaults to `false`. Set it to `true` only while you debug, then remove it or set it back to `false`.

No Web API settings are needed for the `contact` table, because the app never calls `/_api/contacts`. It only references the signed-in contact in `@odata.bind`.

**How to add them**

Option A, Portal Management app:

1. In the design studio select **...** (More items), then **Portal Management**.
2. Go to **Website**, **Site Settings**, **New**.
3. Enter the Name, choose the Website, enter the Value, save. Repeat for the second setting.

Option B, as code (after the first upload):

```bash
npm run metadata:apply -- --contact-relationship <relationship schema name from step 2>
npm run build
pac pages upload-code-site --rootPath .
```

`npm run metadata:apply` copies the templates in `powerpages-metadata/` into `.powerpages-site/site-settings/` and `.powerpages-site/table-permissions/`, filling in the web role IDs that Power Pages generated for your site (read from `.powerpages-site/web-roles/`). It never overwrites an existing file unless you add `--force`. Review the files with `git diff` before you upload.

---

## 8. Web roles and table permissions

Every new site has two default web roles: **Anonymous Users** (people who are not signed in) and **Authenticated Users** (everyone who is signed in). The Web API enforces table permissions on every call, so these three permissions are the whole security model for this app.

| Permission name | Table | Access type | Privileges | Web role | Relationship |
| --- | --- | --- | --- | --- | --- |
| Appointment requests anonymous create | Appointment Request (`cr_appointmentrequest`) | Global | Create | Anonymous Users | None |
| Appointment requests own contact | Appointment Request (`cr_appointmentrequest`) | Contact | Read, Create, Append | Authenticated Users | The Contact relationship from step 2 |
| Contact self append to | Contact (`contact`) | Self | Read, Append to | Authenticated Users | None |

What each one does:

- **Anonymous create.** Anyone can send a request. There is **no Read**, so an anonymous visitor can never list or open any request, including their own. Global scope is safe here only because Create is the single privilege.
- **Own contact.** A signed-in patient can create a request and read back only requests whose Contact lookup points at their own contact record. **Append** lets them set the Contact lookup on the new request.
- **Contact self append to.** **Append to** lets a request be linked to the signed-in patient's own contact record, and only that record (Self scope). Read is limited to their own contact.

There is no Write or Delete anywhere. Patients cannot change or remove a request after sending it.

**How to add them in the design studio**

1. Open the site in [Power Pages](https://make.powerpages.microsoft.com/), select **Edit**.
2. Select **Security**, then **Table permissions**, then **New permission**.
3. Enter the name, choose the table and the access type from the table above.
4. For the Contact access type, choose the relationship between Contact and Appointment Request.
5. Tick the privileges, select **Add roles**, choose the web role, then **Save**.
6. Repeat for the other two permissions.

If a new relationship does not show up, publish your Dataverse customisations, select **Sync** in the design studio, and reload the page.

**As code**

`npm run metadata:apply` (step 7, Option B) writes the same three permissions to `.powerpages-site/table-permissions/`. The templates use these values:

| Field | Values used |
| --- | --- |
| `scope` | Global `756150000`, Contact `756150001`, Self `756150004` |
| `adx_entitypermission_webrole` | The Anonymous Users or Authenticated Users role ID from `.powerpages-site/web-roles/` |
| `contactrelationship` | The relationship schema name from step 2 |

Then build and upload again. If the YAML that `pac` wrote for your site uses different key names from the templates, follow the `pac` files and adjust the templates, or use the design studio instead.

---

## 9. Sign-in for patients

Each new site already has a Microsoft Entra ID identity provider. The app signs in the way the Microsoft Learn SPA sample does: it fetches the CSRF token, then posts a hidden form to `/Account/Login/ExternalLogin` with that token and the provider `https://login.windows.net/<tenantId>/` (the tenant comes from `window.Microsoft.Dynamic365.Portal.tenant`). Sign out goes to `/Account/Login/LogOff?returnUrl=%2F`.

Patients do not have accounts in your Entra tenant, so for a real clinic add a customer-facing provider under **Security**, **Identity providers** (for example Microsoft Entra External ID). Then build with that provider's value:

```bash
VITE_LOGIN_PROVIDER="<provider value from the identity provider settings>" npm run build
pac pages upload-code-site --rootPath .
```

After sign-in, Power Pages fills `window.Microsoft.Dynamic365.Portal.User` with the user's details, including `contactId`. The app uses that ID to link new requests and to load "My requests". If `contactId` is empty after sign-in, check the identity provider's claims mapping so a contact is created for the user.

---

## 10. Check it works on the live site

| Check | Expected result |
| --- | --- |
| Signed out, submit the form | Success screen with a reference. A new row in Dataverse with Status New and Contact empty. |
| Signed out, open `/_api/cr_appointmentrequests?$select=cr_name` | No rows come back (an access error or an empty list). Anonymous users have no Read. |
| Signed in, submit the form | A new row with Contact set to the signed-in contact. |
| Signed in, open My requests | Only your own requests, newest first, each with a status badge. |
| Sign in as a second user | None of the first user's requests are visible. |
| Staff set a request to Confirmed or Declined | The badge changes after a page refresh. |

---

## 11. Troubleshooting

The Web API returns a hex error code in `error.code`. The app shows a plain message to the patient and logs the full error to the browser console.

| Code or status | Meaning | Fix |
| --- | --- | --- |
| `90040101` | A column is not enabled for the Web API | Add it to `Webapi/cr_appointmentrequest/fields`. |
| `90040103` | No Create permission | Check the two Appointment Request permissions and their roles. |
| `90040105` | Missing Append | Add Append to the "own contact" permission. |
| `90040106` | Missing Append to | Add Append to on the Contact Self permission. |
| `90040107` | CSRF token rejected | The app fetches a fresh token and retries once. If it persists, refresh the page. |
| `401` | Missing request verification token or session cookie | Refresh the page and sign in again. |
| `404` | The table is not exposed, or the EntitySetName is wrong | Check `Webapi/cr_appointmentrequest/enabled` and `entitySetName` in `src/config/dataverse.ts`. |

Upload problems:

- **Blocked `.js` attachments:** see step 5.
- **An error that says `.html` attachments are blocked:** Microsoft's own Power Pages tooling notes that this message can be misleading and is caused by a stale `.powerpages-site/<environment-host>-manifest.yml`. Delete that one manifest file and upload again. Do not unblock `.html`.

---

## 12. Optional hardening

- **Stop web users setting Status.** The fields setting has to include `cr_status` so patients can read it. To make it read-only for web roles, add column permissions in the Portal Management app (**Security**, **Web Roles**, a role, **Column Permission Profiles**) with Read only on `cr_status`. Column permissions only apply to the Web API, and they are not applied on sites that use the enhanced authorization model; use Dataverse column security profiles there.
- **Anonymous access governance.** If an admin has used Power Platform governance controls to turn off anonymous access for this site, anonymous requests will fail. In that case remove the anonymous permission and ask patients to sign in first.
- **Keep `Webapi/error/innererror` off** in production.
- **Abuse protection.** The anonymous form can be spammed. Consider the Power Pages Web Application Firewall rules and a Power Automate flow that flags suspicious bursts.

---

## 13. Local preview

No tenant, sign-in or network is needed.

```bash
npm install
npm run dev
```

Open http://localhost:5180. On localhost the app always uses the offline mock adapter, with seeded requests in New, Confirmed and Declined. Select **Sign in** to become the demo patient and open **My requests**.

To preview the production build instead:

```bash
npm run build
npm run preview
```

Open http://localhost:4180.

To force a data layer, set `VITE_DATA_ADAPTER` to `mock` or `powerpages` when you run or build (the default is `auto`).

Calling the real Web API from localhost is possible, but Microsoft only supports it for development environments and it needs extra setup: Entra ID v1 bearer authentication (ADAL.js, because MSAL uses v2), the `Authentication/BearerAuthentication/*` site settings, a public site, and a Vite proxy for `/_api`. This project does not wire that up; the mock covers local work.
