export type PartnerScope = 'national' | 'local';

export interface PartnerBranchInfo {
  id: string;
  name: string;
  city?: string | null;
}

export interface PartnerOfferRecord {
  id: string;
  title: string;
  description?: string | null;
  discount_code?: string | null;
  discount_percentage?: number | null;
  scope: PartnerScope;
  branch_id?: string | null;
  city?: string | null;
  active?: boolean | null;
  branch?: PartnerBranchInfo | null;
  created_at?: string;
  updated_at?: string;
  created_by?: string | null;
  updated_by?: string | null;
  creator?: {
    full_name?: string | null;
    email?: string | null;
  } | null;
  updater?: {
    full_name?: string | null;
    email?: string | null;
  } | null;
}

export interface PartnerOfferFormState {
  title: string;
  description: string;
  discountCode: string;
  discountPercentage: number;
  scope: PartnerScope;
  branchId: string;
  city: string;
}

export type PartnerOfferFormErrors = Partial<{
  title: string;
  description: string;
  discountCode: string;
  discountPercentage: string;
  scope: string;
  branchId: string;
  city: string;
}>;

export interface PartnerOfferPayload {
  title: string;
  description: string | null;
  discount_code: string | null;
  discount_percentage: number | null;
  scope: PartnerScope;
  branch_id: string | null;
  city: string | null;
}

export interface PartnerOfferValidationContext {
  scope: PartnerScope;
  branchId: string | null;
  allowNational: boolean;
}

export interface PartnerOfferValidationResult {
  payload?: PartnerOfferPayload;
  errors: PartnerOfferFormErrors;
}

const MAX_DESCRIPTION_LENGTH = 500;

export function preparePartnerOfferPayload(
  form: PartnerOfferFormState,
  context: PartnerOfferValidationContext
): PartnerOfferValidationResult {
  const errors: PartnerOfferFormErrors = {};

  const trimmedTitle = form.title.trim();
  if (trimmedTitle.length < 3) {
    errors.title = 'Název musí mít alespoň 3 znaky.';
  }

  if (!context.allowNational && context.scope === 'national') {
    errors.scope = 'Tento účet může přidávat pouze lokální nabídky.';
  }

  const effectiveScope: PartnerScope = context.allowNational ? context.scope : 'local';

  const trimmedDescription = form.description.trim();
  if (trimmedDescription.length > MAX_DESCRIPTION_LENGTH) {
    errors.description = `Popis může mít maximálně ${MAX_DESCRIPTION_LENGTH} znaků.`;
  }

  const trimmedCode = form.discountCode.trim();
  if (trimmedCode.length > 64) {
    errors.discountCode = 'Slevový kód může mít maximálně 64 znaků.';
  }

  const sanitizedPercentage = Number.isFinite(form.discountPercentage)
    ? Number(form.discountPercentage)
    : NaN;

  if (!Number.isNaN(sanitizedPercentage)) {
    if (sanitizedPercentage < 0 || sanitizedPercentage > 100) {
      errors.discountPercentage = 'Sleva musí být v rozmezí 0 až 100 %.';
    }
  }

  const trimmedCity = form.city.trim();

  const normalizedBranchId = effectiveScope === 'local' ? (context.branchId || form.branchId || '') : '';
  if (effectiveScope === 'local' && !normalizedBranchId) {
    errors.branchId = 'Lokální nabídka musí mít vybranou pobočku.';
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  const payload: PartnerOfferPayload = {
    title: trimmedTitle,
    description: trimmedDescription ? trimmedDescription : null,
    discount_code: trimmedCode ? trimmedCode.toUpperCase() : null,
    discount_percentage: Number.isNaN(sanitizedPercentage) ? null : sanitizedPercentage,
    scope: effectiveScope,
    branch_id: effectiveScope === 'local' ? (normalizedBranchId || null) : null,
    city: trimmedCity || null,
  };

  return { payload, errors };
}

export interface PartnerGroups {
  national: PartnerOfferRecord[];
  local: PartnerOfferRecord[];
  excluded: PartnerOfferRecord[];
}

export function groupPartnersForMember(
  partners: PartnerOfferRecord[],
  memberBranchId: string | null
): PartnerGroups {
  const groups: PartnerGroups = {
    national: [],
    local: [],
    excluded: [],
  };

  partners.forEach((partner) => {
    if (partner.active === false) {
      groups.excluded.push(partner);
      return;
    }

    if (partner.scope === 'national') {
      groups.national.push(partner);
      return;
    }

    if (
      partner.scope === 'local' &&
      partner.branch_id &&
      memberBranchId &&
      partner.branch_id === memberBranchId
    ) {
      groups.local.push(partner);
      return;
    }

    groups.excluded.push(partner);
  });

  return groups;
}

export interface PartnerVisibilityDiagnostics {
  hasIssues: boolean;
  checked: boolean;
  extraneousLocal: PartnerOfferRecord[];
  extraneousNational: PartnerOfferRecord[];
  hiddenEligible: PartnerOfferRecord[];
}

export function diagnosePartnerVisibility(
  memberBranchId: string | null,
  groups: PartnerGroups
): PartnerVisibilityDiagnostics {
  const extraneousLocal = groups.local.filter((offer) => offer.scope !== 'local');
  const extraneousNational = groups.national.filter((offer) => offer.scope !== 'national');
  const hiddenEligible = groups.excluded.filter(
    (offer) => offer.scope === 'local' && !!memberBranchId && offer.branch_id === memberBranchId
  );

  const hasIssues =
    extraneousLocal.length > 0 || extraneousNational.length > 0 || hiddenEligible.length > 0;

  return {
    hasIssues,
    checked: Boolean(memberBranchId),
    extraneousLocal,
    extraneousNational,
    hiddenEligible,
  };
}

export const MOCK_PARTNER_OFFERS: PartnerOfferRecord[] = [
  {
    id: '1',
    title: 'Celorepublikový partner',
    scope: 'national',
    discount_percentage: 15,
    active: true,
  },
  {
    id: '2',
    title: 'Praha Coffee',
    scope: 'local',
    branch_id: 'praha',
    discount_percentage: 10,
    active: true,
    city: 'Praha',
  },
  {
    id: '3',
    title: 'Brno Bookstore',
    scope: 'local',
    branch_id: 'brno',
    discount_percentage: 12,
    active: true,
  },
  {
    id: '4',
    title: 'Archivní nabídka',
    scope: 'local',
    branch_id: 'praha',
    active: false,
  },
];
