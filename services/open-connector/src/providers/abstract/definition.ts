import type { ProviderDefinition } from "../../core/types.ts";

import { s } from "../../core/json-schema.ts";
import { defineProviderAction } from "../../core/provider-definition.ts";

const service = "abstract";

const checkResult = s.object(
  {
    value: s.nullable(s.boolean({ description: "The boolean result, or null when Abstract could not determine it." })),
    text: s.stringEnum(["TRUE", "FALSE", "UNKNOWN"], {
      description: "The text result returned by Abstract.",
    }),
  },
  {
    required: ["value", "text"],
    description: "A boolean check result returned by Abstract.",
  },
);

/**
 * Abstract provider backed by the public Abstract Email Validation API.
 */
export const provider: ProviderDefinition = {
  service,
  displayName: "Abstract",
  categories: ["Developer Tools", "Data"],
  authTypes: ["api_key"],
  auth: [
    {
      type: "api_key",
      label: "Email Validation API Key",
      placeholder: "ABSTRACT_EMAIL_VALIDATION_API_KEY",
      description:
        "Abstract Email Validation API key sent as the api_key query parameter. Get it from the Email Validation API section of your Abstract dashboard: https://app.abstractapi.com/api/email-validation/dashboard.",
    },
  ],
  homepageUrl: "https://www.abstractapi.com/",
  actions: [
    defineProviderAction(service, {
      name: "validate_email",
      description:
        "Validate an email address with Abstract Email Validation and return deliverability, quality, and risk checks.",
      inputSchema: s.object(
        {
          email: s.email("The email address to validate."),
        },
        {
          required: ["email"],
          description: "The input payload for validating an email address with Abstract.",
        },
      ),
      outputSchema: s.object(
        {
          email: s.string({ description: "The email address returned by Abstract." }),
          autocorrect: s.nullable(
            s.string({ description: "The suggested email correction when Abstract detects a likely typo." }),
          ),
          deliverability: s.stringEnum(["DELIVERABLE", "UNDELIVERABLE", "UNKNOWN"], {
            description: "The deliverability verdict returned by Abstract.",
          }),
          qualityScore: s.number({
            minimum: 0,
            maximum: 1,
            description: "The email quality score between 0 and 1.",
          }),
          isValidFormat: checkResult,
          isFreeEmail: checkResult,
          isDisposableEmail: checkResult,
          isRoleEmail: checkResult,
          isCatchallEmail: checkResult,
          isMxFound: checkResult,
          isSmtpValid: checkResult,
          raw: s.looseObject({}, { description: "The raw response object returned by Abstract." }),
        },
        {
          required: [
            "email",
            "autocorrect",
            "deliverability",
            "qualityScore",
            "isValidFormat",
            "isFreeEmail",
            "isDisposableEmail",
            "isRoleEmail",
            "isCatchallEmail",
            "isMxFound",
            "isSmtpValid",
            "raw",
          ],
          description: "The normalized Abstract email validation response.",
        },
      ),
    }),
  ],
};
