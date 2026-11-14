export { HealthReportModal, type HealthReportModalProps } from "./HealthReportModal";
export {
  compileHealthReport,
  containsProhibitedCausalTerms,
  EPISTEMIC_DISCLAIMER,
  NON_CAUSAL_INLINE_NOTE,
  PROHIBITED_CAUSAL_TERMS_SOURCE,
  SOURCE_REFERENCES,
} from "./healthReportCompiler";
export {
  buildHealthReportPdfModel,
  downloadHealthReportPdf,
  healthReportPdfFilename,
  type PdfCell,
  type PdfColor,
  type PdfSection,
} from "./healthReportPdf";
export { generateHealthReportHtml } from "./healthReportTemplates";
export type {
  CompiledHealthReport,
  HealthReportInput,
  HealthReportConcordanceRow,
  HealthReportEnvironmentalRow,
  HealthReportFlightRuleRow,
  HealthReportFlightRuleStep,
  HealthReportMetadata,
  HealthReport,
  HealthReportSourceData,
  HealthReportSourceReference,
  HealthReportSymptomRow,
  HealthReportVitalsRow,
  EnvironmentalStatus,
  VitalStatus,
} from "./types";