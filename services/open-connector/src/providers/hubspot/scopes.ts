export const hubspotContactsReadScope = "crm.objects.contacts.read";
export const hubspotContactsWriteScope = "crm.objects.contacts.write";
export const hubspotCompaniesReadScope = "crm.objects.companies.read";
export const hubspotCompaniesWriteScope = "crm.objects.companies.write";
export const hubspotDealsReadScope = "crm.objects.deals.read";
export const hubspotDealsWriteScope = "crm.objects.deals.write";
export const hubspotSchemasContactsReadScope = "crm.schemas.contacts.read";
export const hubspotSchemasCompaniesReadScope = "crm.schemas.companies.read";
export const hubspotSchemasDealsReadScope = "crm.schemas.deals.read";

export const hubspotSchemaReadScopes: string[] = [
  hubspotSchemasContactsReadScope,
  hubspotSchemasCompaniesReadScope,
  hubspotSchemasDealsReadScope,
];

export const hubspotOAuthScopes: string[] = [
  hubspotContactsReadScope,
  hubspotContactsWriteScope,
  hubspotCompaniesReadScope,
  hubspotCompaniesWriteScope,
  hubspotDealsReadScope,
  hubspotDealsWriteScope,
  ...hubspotSchemaReadScopes,
];
