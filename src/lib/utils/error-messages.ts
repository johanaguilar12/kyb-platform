import { getDocumentLabel } from './document-labels';

export const errorMessages: Record<string, string> = {
  MISSING_REQUIRED_DOCUMENT: "Missing required document: [Document Name]",
  RFC_MISMATCH: "RFC does not match the registered company RFC",
  LEGAL_NAME_MISMATCH: "Legal name does not match the registered company name",
  DOCUMENT_EXPIRED: "This document has expired",
  CSF_NOT_CURRENT_MONTH: "Tax Status Certificate is not from the current month",
  SAT_CHECK_OUTDATED: "SAT blacklist check is older than 90 days",
  INVALID_PDF: "Unable to read this document. Please upload a valid PDF",
  AI_EXTRACTION_FAILED: "Could not extract data from document. Please try again",
};

export const getErrorMessageMapping: Record<string, string> = {
  MISSING_REQUIRED_DOCUMENT: "Missing Required Document",
  RFC_MISMATCH: "RFC does not match",
  LEGAL_NAME_MISMATCH: "Legal name does not match",
  DOCUMENT_EXPIRED: "Document has expired",
  CSF_NOT_CURRENT_MONTH: "Tax Status Certificate is not from current month",
  SAT_CHECK_OUTDATED: "SAT check is older than 90 days",
};

/**
 * Returns a user-friendly translation for a technical error code.
 * Optionally formats placeholders and includes mismatch context details.
 */
export function getUserFriendlyError(errorCode: string | null | undefined, context?: any): string {
  if (!errorCode) return 'An unknown error occurred';

  let message = errorMessages[errorCode];
  if (!message) {
    return getErrorMessage(errorCode);
  }

  if (context) {
    if (context.documentName) {
      message = message.replace('[Document Name]', context.documentName);
    } else if (context.documentType) {
      message = message.replace('[Document Name]', getDocumentLabel(context.documentType));
    }

    if (context.fileValue !== undefined && context.docValue !== undefined) {
      message += ` (File: ${context.fileValue}, Document: ${context.docValue})`;
    }
  }

  return message;
}

/**
 * Technical error code dictionary mapping to user-friendly status strings.
 */
export function getErrorMessage(code: string | null | undefined): string {
  if (!code) return '';
  if (getErrorMessageMapping[code]) {
    return getErrorMessageMapping[code];
  }
  return code
    .replace(/_/g, ' ')
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
