export interface MemberEventRecord {
  id: string;
  title: string;
  description?: string | null;
  link_label?: string | null;
  link_url?: string | null;
  created_at?: string;
  updated_at?: string;
  created_by?: string | null;
  updated_by?: string | null;
}

export interface MemberEventFormState {
  title: string;
  description: string;
  linkLabel: string;
  linkUrl: string;
}

export type MemberEventFormErrorKey =
  | 'titleTooShort'
  | 'titleTooLong'
  | 'descriptionTooLong'
  | 'linkUrlInvalid'
  | 'linkLabelMissing';

export type MemberEventFormErrors = Partial<{
  title: MemberEventFormErrorKey;
  description: MemberEventFormErrorKey;
  linkLabel: MemberEventFormErrorKey;
  linkUrl: MemberEventFormErrorKey;
}>;

export interface MemberEventPayload {
  title: string;
  description: string | null;
  link_label: string | null;
  link_url: string | null;
}

export interface MemberEventValidationResult {
  payload?: MemberEventPayload;
  errors: MemberEventFormErrors;
}

const MAX_TITLE_LENGTH = 160;
const MAX_DESCRIPTION_LENGTH = 1200;

function isValidHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function prepareMemberEventPayload(
  form: MemberEventFormState
): MemberEventValidationResult {
  const errors: MemberEventFormErrors = {};

  const trimmedTitle = form.title.trim();
  if (trimmedTitle.length < 3) {
    errors.title = 'titleTooShort';
  } else if (trimmedTitle.length > MAX_TITLE_LENGTH) {
    errors.title = 'titleTooLong';
  }

  const trimmedDescription = form.description.trim();
  if (trimmedDescription.length > MAX_DESCRIPTION_LENGTH) {
    errors.description = 'descriptionTooLong';
  }

  const trimmedLinkUrl = form.linkUrl.trim();
  const trimmedLinkLabel = form.linkLabel.trim();

  if (trimmedLinkUrl && !isValidHttpUrl(trimmedLinkUrl)) {
    errors.linkUrl = 'linkUrlInvalid';
  }

  if (!trimmedLinkUrl && trimmedLinkLabel) {
    errors.linkLabel = 'linkLabelMissing';
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  const payload: MemberEventPayload = {
    title: trimmedTitle,
    description: trimmedDescription ? trimmedDescription : null,
    link_label: trimmedLinkLabel
      ? trimmedLinkLabel
      : trimmedLinkUrl
      ? trimmedTitle
      : null,
    link_url: trimmedLinkUrl || null,
  };

  return { payload, errors };
}
