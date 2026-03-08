'use strict';

const UUID_UPLOAD_AUDIT_ENDPOINT = '/api/remotes/audits/upload-uuid-injection';

const AUDIT_ERROR_CODES = Object.freeze({
  TARGET_MISSING: 'UUID_AUDIT_TARGET_MISSING',
  FILE_READ_FAILED: 'UUID_AUDIT_FILE_READ_FAILED',
  REPORT_INVALID: 'UUID_AUDIT_REPORT_INVALID',
});

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isValidUploadUuidAuditReport(report) {
  return (
    isObject(report) &&
    report.gate === 'UUID-1' &&
    Array.isArray(report.points) &&
    isObject(report.summary) &&
    typeof report.summary.scannedFiles === 'number' &&
    typeof report.summary.injectionPoints === 'number' &&
    typeof report.summary.uploadPathInjectionPoints === 'number'
  );
}

function createUploadUuidAuditError(code, message, details = null) {
  return {
    ok: false,
    endpoint: UUID_UPLOAD_AUDIT_ENDPOINT,
    error: {
      code,
      message,
      details,
    },
  };
}

function createUploadUuidAuditResponse(report) {
  if (!isValidUploadUuidAuditReport(report)) {
    return createUploadUuidAuditError(
      AUDIT_ERROR_CODES.REPORT_INVALID,
      'Upload UUID audit report is malformed',
      { expectedGate: 'UUID-1' }
    );
  }

  return {
    ok: true,
    endpoint: UUID_UPLOAD_AUDIT_ENDPOINT,
    data: report,
  };
}

module.exports = {
  UUID_UPLOAD_AUDIT_ENDPOINT,
  AUDIT_ERROR_CODES,
  isValidUploadUuidAuditReport,
  createUploadUuidAuditError,
  createUploadUuidAuditResponse,
};


