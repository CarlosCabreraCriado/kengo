// Type-only shim para la cadena transitiva `convex/_generated/api` →
// `convex/pdf/actions.ts` → `pdfkit/js/pdfkit.standalone`. pdfkit es
// server-only (Convex); el import type aquí no añade runtime al bundle.
declare module "pdfkit/js/pdfkit.standalone" {
  import type PDFDocument from "pdfkit";
  export default PDFDocument;
}
