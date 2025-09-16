import { getPreferenceValues } from "@raycast/api";
import { CompanyData, RepresentativeInfo, PersonDescription, Preferences } from "../types";
import {
  formatAddress,
  formatField,
  formatSiren,
  formatFrenchNumber,
  getGenderAgreement,
  getLegalFormLabel,
  getRoleName,
  FALLBACK_VALUES,
} from "./utils";
import { formatRepresentativeName, formatCityName } from "./formatting";
import { findGreffeByCodePostal } from "./greffe-lookup";
import { findPhysicalRepresentative, extractSirenFromEnterprise } from "./recursive-representative-search";

type TemplateVariables = Record<string, string>;

interface BuildMarkdownOptions {
  template?: string;
}

const PERSONNE_PHYSIQUE_DEFAULT_TEMPLATE = [
  "{{civility}} {{full_name}}",
  "{{birth_statement}}",
  "{{nationality_line}}",
  "{{personal_address_line}}",
  "N° : {{siren_formatted}}",
].join("\n");

const PERSONNE_MORALE_DEFAULT_TEMPLATE = [
  "**La société {{company_name}}**",
  "",
  "{{share_capital_line}}",
  "{{registration_line}}",
  "{{head_office_line}}",
  "",
  "{{representative_line}}",
].join("\n");

export const AVAILABLE_TEMPLATE_VARIABLES = {
  common: ["company_type", "siren", "siren_formatted", "company_name", "legal_form", "company_header", "company_details"],
  personneMorale: [
    "legal_form",
    "share_capital",
    "share_capital_raw",
    "share_capital_with_currency",
    "share_capital_line",
    "share_capital_currency",
    "company_header",
    "company_details",
    "rcs_city",
    "registration_line",
    "head_office_address",
    "head_office_line",
    "representative_name",
    "representative_role",
    "representative_gender",
    "representative_is_holding",
    "representative_line",
    "holding_representative_name",
    "holding_representative_role",
    "holding_representative_gender",
  ],
  personnePhysique: [
    "civility",
    "first_name",
    "last_name",
    "full_name",
    "birth_date",
    "birth_place",
    "birth_statement",
    "ne_word",
    "nationality",
    "nationality_line",
    "personal_address",
    "personal_address_line",
  ],
} as const;

function getUserTemplate(): string | undefined {
  try {
    const preferences = getPreferenceValues<Preferences>();
    const template = preferences?.outputTemplate;
    if (typeof template === "string" && template.trim().length > 0) {
      return template;
    }
  } catch (error) {
    // Preferences are not available outside Raycast (e.g. during tests)
  }
  return undefined;
}

function renderTemplate(template: string, variables: TemplateVariables): string {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => {
    const value = variables[key];
    return value !== undefined ? value : "";
  });
}

/**
 * Main function to build markdown based on company type.
 */
export function buildMarkdown(data: CompanyData, options?: BuildMarkdownOptions): string {
  const content = data.formality.content;
  const templateOverride = options?.template ?? getUserTemplate();

  if (content.personnePhysique) {
    return buildPersonnePhysiqueMarkdown(data, templateOverride);
  }

  if (content.personneMorale) {
    return buildPersonneMoraleMarkdown(data, templateOverride);
  }

  return "No information to display.";
}

/**
 * Async version of buildMarkdown that supports recursive representative search.
 */
export async function buildMarkdownAsync(data: CompanyData, options?: BuildMarkdownOptions): Promise<string> {
  const content = data.formality.content;
  const templateOverride = options?.template ?? getUserTemplate();

  if (content.personnePhysique) {
    return buildPersonnePhysiqueMarkdown(data, templateOverride);
  }

  if (content.personneMorale) {
    return await buildPersonneMoraleMarkdownAsync(data, templateOverride);
  }

  return "No information to display.";
}

/**
 * Builds markdown for individual entrepreneurs (personnePhysique)
 */
export function buildPersonnePhysiqueMarkdown(data: CompanyData, templateOverride?: string): string {
  const personnePhysique = data.formality.content.personnePhysique!;
  const desc = personnePhysique.identite?.entrepreneur?.descriptionPersonne;

  const civilite = desc?.genre === "2" ? "Madame" : "Monsieur";
  const prenom = (desc?.prenoms || [])[0] || "";
  const nom = desc?.nom || "";
  const fullName = `${prenom} ${nom}`.trim() || FALLBACK_VALUES.REPRESENTATIVE_NAME;

  const ne = desc?.genre === "2" ? "Née" : "Né";
  const dateNaissance = formatField(desc?.dateDeNaissance, FALLBACK_VALUES.BIRTH_DATE);
  const lieuNaissance = formatField(desc?.lieuDeNaissance, FALLBACK_VALUES.BIRTH_PLACE);
  const nationalite = formatField(desc?.nationalite, FALLBACK_VALUES.NATIONALITY);
  const birthStatement = `${ne}(e) le ${dateNaissance} à ${lieuNaissance}`;

  const adresse = personnePhysique.adressePersonne
    ? formatAddress(personnePhysique.adressePersonne)
    : formatAddress(personnePhysique.adresseEntreprise);
  const demeurant = formatField(adresse, FALLBACK_VALUES.ADDRESS);

  const siren = data.formality.siren;
  const sirenFormatted = formatSiren(siren);

  const legalFormCode = data.formality.content.natureCreation?.formeJuridique;
  const legalForm = legalFormCode ? getLegalFormLabel(legalFormCode) : "";

  const companyDetails = [
    birthStatement,
    `De nationalité ${nationalite}`,
    `Demeurant ${demeurant}`,
    `N° : ${sirenFormatted}`,
  ].join("\n");

  const variables: TemplateVariables = {
    company_type: "personne_physique",
    company_name: fullName,
    company_header: `${civilite} ${fullName}`,
    company_details: companyDetails,
    siren,
    siren_formatted: sirenFormatted,
    legal_form: legalForm,
    civility: civilite,
    first_name: prenom,
    last_name: nom,
    full_name: fullName,
    birth_date: dateNaissance,
    birth_place: lieuNaissance,
    birth_statement: birthStatement,
    ne_word: ne,
    nationality: nationalite,
    nationality_line: `De nationalité ${nationalite}`,
    personal_address: demeurant,
    personal_address_line: `Demeurant ${demeurant}`,
    share_capital: "",
    share_capital_raw: "",
    share_capital_with_currency: "",
    share_capital_line: "",
    share_capital_currency: "€",
    rcs_city: "",
    registration_line: "",
    head_office_address: demeurant,
    head_office_line: `Demeurant ${demeurant}`,
    representative_name: fullName,
    representative_role: FALLBACK_VALUES.REPRESENTATIVE_ROLE,
    representative_gender: desc?.genre || "",
    representative_is_holding: "false",
    representative_line: "",
    holding_representative_name: "",
    holding_representative_role: "",
    holding_representative_gender: "",
  };

  const template = templateOverride ?? PERSONNE_PHYSIQUE_DEFAULT_TEMPLATE;
  return renderTemplate(template, variables);
}

/**
 * Builds markdown for corporate entities (personneMorale) - synchronous version.
 */
export function buildPersonneMoraleMarkdown(data: CompanyData, templateOverride?: string): string {
  const content = data.formality.content;
  const personneMorale = content.personneMorale!;

  const representative = extractRepresentativeInfo(personneMorale.composition || {});
  const variables = createPersonneMoraleTemplateVariables(data, representative);

  const template = templateOverride ?? PERSONNE_MORALE_DEFAULT_TEMPLATE;
  return renderTemplate(template, variables);
}

/**
 * Builds markdown for corporate entities (personneMorale) - async version with recursive search.
 */
export async function buildPersonneMoraleMarkdownAsync(
  data: CompanyData,
  templateOverride?: string,
): Promise<string> {
  const content = data.formality.content;
  const personneMorale = content.personneMorale!;

  let representative = extractRepresentativeInfo(personneMorale.composition || {});

  if (representative.isHolding && representative.corporateSiren) {
    console.log(
      `🔍 Attempting recursive search for holding ${representative.name} (SIREN: ${representative.corporateSiren})`,
    );
    try {
      representative = await findPhysicalRepresentative(
        representative.name,
        representative.corporateSiren,
        representative.role,
      );
    } catch (error) {
      console.error(`❌ Failed to find physical representative for ${representative.name}:`, error);
    }
  }

  const variables = createPersonneMoraleTemplateVariables(data, representative);
  const template = templateOverride ?? PERSONNE_MORALE_DEFAULT_TEMPLATE;
  return renderTemplate(template, variables);
}

function createPersonneMoraleTemplateVariables(data: CompanyData, representative: RepresentativeInfo): TemplateVariables {
  const content = data.formality.content;
  const personneMorale = content.personneMorale!;
  const natureCreation = content.natureCreation;

  const siren = data.formality.siren;
  const sirenFormatted = formatSiren(siren);
  const legalFormCode = natureCreation?.formeJuridique;
  const legalForm = legalFormCode ? getLegalFormLabel(legalFormCode) : "";

  const identite = personneMorale.identite;
  const denominationValue = identite?.entreprise?.denomination || personneMorale.denomination;
  const denomination = formatField(denominationValue, FALLBACK_VALUES.MISSING_DATA);
  const shareCapitalValue = identite?.description?.montantCapital ?? personneMorale.capital?.montant;
  const shareCapitalRaw = formatField(shareCapitalValue, FALLBACK_VALUES.MISSING_DATA);
  const shareCapital =
    shareCapitalRaw !== FALLBACK_VALUES.MISSING_DATA ? formatFrenchNumber(shareCapitalRaw) : shareCapitalRaw;
  const shareCapitalWithCurrency = `${shareCapital}\u00A0€`;
  const shareCapitalLine = `${legalForm} au capital de ${shareCapitalWithCurrency}`;

  const address = formatAddress(personneMorale.adresseEntreprise);
  const headOfficeLine = `Dont le siège social est situé ${address}`;

  const codePostal = personneMorale.adresseEntreprise?.adresse?.codePostal;
  const greffeFromData = codePostal ? findGreffeByCodePostal(codePostal) : null;
  const rawRcsCity = greffeFromData || personneMorale.immatriculationRcs?.villeImmatriculation;
  const rcsCity = rawRcsCity ? formatCityName(rawRcsCity) : FALLBACK_VALUES.RCS_CITY;
  const registrationLine = `Immatriculée au RCS de ${rcsCity} sous le n° ${sirenFormatted}`;

  let representativeLine: string;
  let holdingName = representative.holdingRepresentative?.name ?? "";
  let holdingRole = representative.holdingRepresentative?.role ?? "";
  let holdingGender = representative.holdingRepresentative?.gender ?? "";

  if (representative.isHolding && representative.holdingRepresentative) {
    const physicalRep = representative.holdingRepresentative;
    const genderAgreement = getGenderAgreement(physicalRep.gender);
    representativeLine = `Représentée aux fins des présentes par la société ${representative.name} en tant que ${representative.role}, elle-même représentée par ${physicalRep.name} en tant que ${physicalRep.role}, dûment ${genderAgreement}.`;
  } else if (representative.isHolding) {
    representativeLine = `Représentée aux fins des présentes par ${representative.name} en tant que ${representative.role}.`;
    holdingName = "";
    holdingRole = "";
    holdingGender = "";
  } else {
    const genderAgreement = getGenderAgreement(representative.gender);
    representativeLine = `Représentée aux fins des présentes par ${representative.name} en sa qualité de ${representative.role}, dûment ${genderAgreement}.`;
    holdingName = "";
    holdingRole = "";
    holdingGender = "";
  }

  const companyHeader = `**La société ${denomination}**`;
  const companyDetails = [shareCapitalLine, registrationLine, headOfficeLine].join("\n");

  return {
    company_type: "personne_morale",
    company_name: denomination,
    company_header: companyHeader,
    company_details: companyDetails,
    siren,
    siren_formatted: sirenFormatted,
    legal_form: legalForm,
    share_capital: shareCapital,
    share_capital_raw: shareCapitalRaw,
    share_capital_with_currency: shareCapitalWithCurrency,
    share_capital_line: shareCapitalLine,
    share_capital_currency: "€",
    rcs_city: rcsCity,
    registration_line: registrationLine,
    head_office_address: address,
    head_office_line: headOfficeLine,
    representative_name: representative.name,
    representative_role: representative.role,
    representative_gender: representative.gender ?? "",
    representative_is_holding: representative.isHolding ? "true" : "false",
    representative_line: representativeLine,
    holding_representative_name: holdingName,
    holding_representative_role: holdingRole,
    holding_representative_gender: holdingGender,
    civility: "",
    first_name: "",
    last_name: "",
    full_name: denomination,
    birth_date: "",
    birth_place: "",
    birth_statement: "",
    ne_word: "",
    nationality: "",
    nationality_line: "",
    personal_address: address,
    personal_address_line: headOfficeLine,
  };
}

/**
 * Extracts the most relevant representative information from the composition data.
 * Returns the highest-priority representative based on role hierarchy.
 */
export function extractRepresentativeInfo(composition: Record<string, unknown>): RepresentativeInfo {
  const fallback = {
    name: FALLBACK_VALUES.REPRESENTATIVE_NAME,
    role: FALLBACK_VALUES.REPRESENTATIVE_ROLE,
    gender: null,
    isHolding: false,
  };

  const pouvoirs = (composition?.pouvoirs as Record<string, unknown>[]) || [];
  if (!Array.isArray(pouvoirs) || pouvoirs.length === 0) return fallback;

  console.log(
    `📊 Found ${pouvoirs.length} representatives:`,
    pouvoirs.map((p) => ({ role: p.roleEntreprise, type: p.entreprise ? "Company" : "Person" })),
  );

  // Define role priority (highest to lowest priority)
  const rolePriority = ["5132", "73", "51", "30", "53"]; // President, President conseil admin, Manager, General Director

  // First, check if there's a President (5132 or 73) - always prioritize President
  let pouvoir: Record<string, unknown>;
  const president = pouvoirs.find(
    (p: Record<string, unknown>) => p.roleEntreprise === "5132" || p.roleEntreprise === "73",
  );

  if (president) {
    console.log("🎯 Found President - selecting as priority representative", {
      role: president.roleEntreprise,
      isCompany: !!president.entreprise,
    });
    pouvoir = president;
  } else {
    console.log("⚠️ No President found, falling back to priority sorting");
    // Sort representatives by role priority
    const sortedPouvoirs = pouvoirs.sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
      const roleA = a.roleEntreprise as string;
      const roleB = b.roleEntreprise as string;
      const priorityA = rolePriority.indexOf(roleA);
      const priorityB = rolePriority.indexOf(roleB);

      // Higher priority (lower index) comes first, unknown roles go to end
      if (priorityA === -1 && priorityB === -1) return 0;
      if (priorityA === -1) return 1;
      if (priorityB === -1) return -1;
      return priorityA - priorityB;
    });

    pouvoir = sortedPouvoirs[0];
  }

  // Handle individual representative (person) - NEW API FORMAT
  const individu = pouvoir.individu as { descriptionPersonne?: PersonDescription };
  if (individu?.descriptionPersonne) {
    const desc = individu.descriptionPersonne;
    const name = formatRepresentativeName(desc.prenoms || [], desc.nom || "");
    const roleCode = pouvoir.roleEntreprise as string;
    const role = getRoleName(roleCode || "");
    // Genre may not be present in new format, default to null
    const gender = desc.genre === "2" ? "F" : desc.genre === "1" ? "M" : null;

    return { name, role, gender, isHolding: false };
  }

  // Handle individual representative (person) - OLD API FORMAT (fallback)
  const personnePhysique = pouvoir.personnePhysique as { identite?: { descriptionPersonne?: PersonDescription } };
  if (personnePhysique?.identite?.descriptionPersonne) {
    const desc = personnePhysique.identite.descriptionPersonne;
    const name = formatRepresentativeName(desc.prenoms || [], desc.nom || "");
    const roleCode = pouvoir.roleEntreprise as string;
    const role = getRoleName(roleCode || "");
    const gender = desc.genre === "2" ? "F" : "M";

    return { name, role, gender, isHolding: false };
  }

  // Handle corporate representative (company)
  const entreprise = pouvoir.entreprise as Record<string, unknown>;
  if (entreprise?.denomination) {
    const name = (entreprise.denomination as string) || FALLBACK_VALUES.REPRESENTATIVE_NAME;
    const roleCode = pouvoir.roleEntreprise as string;
    const role = getRoleName(roleCode || "");

    console.log(`🏢 Found corporate representative "${name}":`, {
      availableFields: Object.keys(entreprise),
      entrepriseData: entreprise,
    });

    const extractedSiren = extractSirenFromEnterprise(entreprise);
    console.log(`🔍 Extracted SIREN for ${name}: ${extractedSiren}`);

    return { name, role, gender: null, isHolding: true, corporateSiren: extractedSiren };
  }

  return fallback;
}

/**
 * Converts markdown to HTML for rich text copying to applications like Word
 */
export function markdownToHtml(markdown: string): string {
  return (
    markdown
      // Convert bold markdown (**text**) to HTML
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      // Convert italic markdown (*text*) to HTML
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      // Split into lines and wrap each in paragraph tags
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line) => `<p>${line.trim()}</p>`)
      .join("")
  );
}

/**
 * Converts markdown to plain text (fallback for applications that don't support HTML)
 */
export function markdownToPlainText(markdown: string): string {
  return (
    markdown
      // Remove bold markdown (**text**)
      .replace(/\*\*(.*?)\*\*/g, "$1")
      // Remove italic markdown (*text*)
      .replace(/\*(.*?)\*/g, "$1")
      .trim()
  );
}
