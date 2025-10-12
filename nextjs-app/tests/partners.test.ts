import { describe, expect, it } from "vitest";
import {
  groupPartnersForMember,
  diagnosePartnerVisibility,
  preparePartnerOfferPayload,
  MOCK_PARTNER_OFFERS,
  type PartnerOfferFormState,
} from "@/lib/partners";

const baseForm: PartnerOfferFormState = {
  title: "Nový partner",
  description: "Krátký popis",
  discountCode: "abc123",
  discountPercentage: 10,
  scope: "local",
  branchId: "praha",
  city: "Praha",
};

describe("partner grouping", () => {
  it("groups partners by scope and member branch", () => {
    const groups = groupPartnersForMember(MOCK_PARTNER_OFFERS, "praha");

    expect(groups.national).toHaveLength(1);
    expect(groups.local).toHaveLength(1);
    expect(groups.excluded).toHaveLength(2);
  });

  it("flags issues when visibility rules are broken", () => {
    const groups = {
      national: [
        {
          ...MOCK_PARTNER_OFFERS[1],
          scope: "local" as const,
        },
      ],
      local: [
        {
          ...MOCK_PARTNER_OFFERS[0],
          scope: "national" as const,
        },
      ],
      excluded: [],
    };

    const diagnostics = diagnosePartnerVisibility("praha", groups);

    expect(diagnostics.hasIssues).toBe(true);
    expect(diagnostics.extraneousLocal).toHaveLength(1);
    expect(diagnostics.extraneousNational).toHaveLength(1);
  });
});

describe("partner offer validation", () => {
  it("returns errors for invalid payloads", () => {
    const { payload, errors } = preparePartnerOfferPayload(
      {
        ...baseForm,
        title: "A",
        discountPercentage: 150,
        branchId: "",
      },
      { scope: "local", branchId: null, allowNational: false }
    );

    expect(payload).toBeUndefined();
    expect(errors.title).toBeDefined();
    expect(errors.discountPercentage).toBeDefined();
    expect(errors.branchId).toBeDefined();
  });

  it("sanitises values for valid payloads", () => {
    const { payload, errors } = preparePartnerOfferPayload(baseForm, {
      scope: "local",
      branchId: "praha",
      allowNational: true,
    });

    expect(errors).toEqual({});
    expect(payload).toMatchObject({
      title: "Nový partner",
      discount_code: "ABC123",
      branch_id: "praha",
    });
  });
});
