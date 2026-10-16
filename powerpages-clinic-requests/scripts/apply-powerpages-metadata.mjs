#!/usr/bin/env node
// Copies the Web API site settings and table permissions in powerpages-metadata/
// into .powerpages-site/ so the next `pac pages upload-code-site` deploys them.
//
// Run it AFTER the first upload. That first upload creates .powerpages-site/,
// including web-roles/*.webrole.yml with the role ids Power Pages generated for
// this site. This script reads those ids and fills them into the templates.
//
// Usage:
//   npm run metadata:apply
//   npm run metadata:apply -- --contact-relationship <relationship schema name>
//   npm run metadata:apply -- --force        (overwrite files that already exist)

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE_DIR = join(ROOT, 'powerpages-metadata');
const SITE_DIR = join(ROOT, '.powerpages-site');
const FOLDERS = ['site-settings', 'table-permissions'];
const DEFAULT_CONTACT_RELATIONSHIP = 'cr_appointmentrequest_Contact_contact';

const args = process.argv.slice(2);
const argValue = (name) => {
  const index = args.indexOf(`--${name}`);
  return index !== -1 && index + 1 < args.length ? args[index + 1] : null;
};
const force = args.includes('--force');
const contactRelationship = argValue('contact-relationship') ?? DEFAULT_CONTACT_RELATIONSHIP;

const fail = (message) => {
  console.error(`Error: ${message}`);
  process.exit(1);
};

// Reads the simple "key: value" lines of a pac-generated YAML file.
const readFlatYaml = (filePath) => {
  const result = {};
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = /^([A-Za-z_][\w]*):\s*(.*)$/.exec(line);
    if (match) {
      result[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
    }
  }
  return result;
};

const findRoleId = (roles, flag) => {
  const role = roles.find((item) => String(item[flag]).toLowerCase() === 'true');
  return role ? role.id : null;
};

if (!existsSync(SITE_DIR)) {
  fail('.powerpages-site/ was not found. Run `npm run build` and `pac pages upload-code-site --rootPath .` once first.');
}

const rolesDir = join(SITE_DIR, 'web-roles');
if (!existsSync(rolesDir)) {
  fail('.powerpages-site/web-roles/ was not found. Check that the first upload finished without errors.');
}

const roles = readdirSync(rolesDir)
  .filter((name) => name.endsWith('.webrole.yml'))
  .map((name) => readFlatYaml(join(rolesDir, name)));

const anonymousId = findRoleId(roles, 'anonymoususersrole');
const authenticatedId = findRoleId(roles, 'authenticatedusersrole');
if (!anonymousId || !authenticatedId) {
  fail('Could not find both the Anonymous Users and Authenticated Users web roles in .powerpages-site/web-roles/.');
}

const replacements = {
  __ANONYMOUS_USERS_ROLE_ID__: anonymousId,
  __AUTHENTICATED_USERS_ROLE_ID__: authenticatedId,
  __CONTACT_RELATIONSHIP__: contactRelationship,
};

const fill = (text) =>
  Object.entries(replacements).reduce((output, [token, value]) => output.split(token).join(value), text);

let written = 0;
let skipped = 0;
for (const folder of FOLDERS) {
  const sourceDir = join(TEMPLATE_DIR, folder);
  const targetDir = join(SITE_DIR, folder);
  if (!existsSync(targetDir)) {
    fail(`.powerpages-site/${folder}/ was not found.`);
  }
  const nameKey = folder === 'site-settings' ? 'name' : 'entityname';
  const existingNames = new Set(
    readdirSync(targetDir)
      .filter((name) => name.endsWith('.yml'))
      .map((name) => String(readFlatYaml(join(targetDir, name))[nameKey] ?? '').toLowerCase()),
  );

  for (const fileName of readdirSync(sourceDir).filter((name) => name.endsWith('.yml'))) {
    const content = fill(readFileSync(join(sourceDir, fileName), 'utf8'));
    const recordName = String(readFlatYaml(join(sourceDir, fileName))[nameKey] ?? '').toLowerCase();
    const targetPath = join(targetDir, fileName);
    if (!existsSync(targetPath) && existingNames.has(recordName)) {
      console.log(`skip   ${folder}/${fileName} (a record with this name already exists in another file, edit that file instead)`);
      skipped += 1;
      continue;
    }
    if (existsSync(targetPath) && !force) {
      console.log(`skip   ${folder}/${fileName} (already exists, use --force to overwrite)`);
      skipped += 1;
      continue;
    }
    writeFileSync(targetPath, content, 'utf8');
    console.log(`write  ${folder}/${fileName}`);
    written += 1;
  }
}

console.log(`\nDone. ${written} written, ${skipped} skipped.`);
console.log(`Anonymous Users role: ${anonymousId}`);
console.log(`Authenticated Users role: ${authenticatedId}`);
console.log(`Contact relationship: ${contactRelationship}`);
console.log('Next: npm run build && pac pages upload-code-site --rootPath .');
