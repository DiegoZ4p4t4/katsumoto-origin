import type { DbRecord } from "../../types.ts";
import { ensureArray, escapeXml, formatAmount } from "../helpers.ts";

function buildNamespaces(kind: "credit-note" | "debit-note"): string {
  const xmlns = kind === "credit-note"
    ? "urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2"
    : "urn:oasis:names:specification:ubl:schema:xsd:DebitNote-2";

  return [
    `xmlns="${xmlns}"`,
    'xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"',
    'xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"',
    'xmlns:ccts="urn:un:unece:uncefact:documentation:2"',
    'xmlns:ds="http://www.w3.org/2000/09/xmldsig#"',
    'xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"',
    'xmlns:qdt="urn:oasis:names:specification:ubl:schema:xsd:QualifiedDatatypes-2"',
    'xmlns:sac="urn:sunat:names:specification:ubl:peru:schema:xsd:SunatAggregateComponents-1"',
    'xmlns:udt="urn:un:unece:uncefact:data:specification:UnqualifiedDataTypesSchemaModule:2"',
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
  ].join(" ");
}

function buildLegendExtensionXml(legends: DbRecord[]): string {
  if (!legends || legends.length === 0) return "";
  const props = legends.map((legend) => `
      <sac:AdditionalProperty>
        <cbc:ID>${escapeXml(legend.code)}</cbc:ID>
        <cbc:Value>${escapeXml(legend.value)}</cbc:Value>
      </sac:AdditionalProperty>`).join("");
  return `
    <ext:UBLExtension>
      <ext:ExtensionContent>
        <sac:AdditionalInformation>${props}
        </sac:AdditionalInformation>
      </ext:ExtensionContent>
    </ext:UBLExtension>`;
}

function buildLineXml(
  kind: "credit-note" | "debit-note",
  items: DbRecord[],
  moneda: string,
): string {
  const lineTag = kind === "credit-note"
    ? "cac:CreditNoteLine"
    : "cac:DebitNoteLine";
  const qtyTag = kind === "credit-note"
    ? "cbc:CreditedQuantity"
    : "cbc:DebitedQuantity";

  return ensureArray(items).map((item, index) => {
    const tipAfeIgv = escapeXml(item.tip_afe_igv || "10");
    const tributo = tipAfeIgv === "10" ? { id: "1000", name: "IGV", code: "VAT" }
      : tipAfeIgv === "20" ? { id: "9997", name: "EXO", code: "VAT" }
      : tipAfeIgv === "30" ? { id: "9998", name: "INA", code: "FRE" }
      : tipAfeIgv === "40" ? { id: "9995", name: "EXP", code: "FRE" }
      : { id: "1000", name: "IGV", code: "VAT" };

    return `
  <${lineTag}>
    <cbc:ID>${index + 1}</cbc:ID>
    <${qtyTag} unitCode="${escapeXml(item.unidad || "NIU")}">${
    formatAmount(item.cantidad, 2)
  }</${qtyTag}>
    <cbc:LineExtensionAmount currencyID="${moneda}">${
    formatAmount(item.mto_valor_venta)
  }</cbc:LineExtensionAmount>
    <cac:PricingReference>
      <cac:AlternativeConditionPrice>
        <cbc:PriceAmount currencyID="${moneda}">${
    formatAmount(item.mto_precio_unitario, 6)
  }</cbc:PriceAmount>
        <cbc:PriceTypeCode>01</cbc:PriceTypeCode>
      </cac:AlternativeConditionPrice>
    </cac:PricingReference>
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="${moneda}">${
    formatAmount(item.total_impuestos)
  }</cbc:TaxAmount>
      <cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="${moneda}">${
    formatAmount(item.mto_base_igv)
  }</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="${moneda}">${
    formatAmount(item.igv)
  }</cbc:TaxAmount>
        <cac:TaxCategory>
          <cbc:Percent>${formatAmount(item.porcentaje_igv, 2)}</cbc:Percent>
          <cbc:TaxExemptionReasonCode>${tipAfeIgv}</cbc:TaxExemptionReasonCode>
          <cac:TaxScheme>
            <cbc:ID>${tributo.id}</cbc:ID>
            <cbc:Name>${tributo.name}</cbc:Name>
            <cbc:TaxTypeCode>${tributo.code}</cbc:TaxTypeCode>
          </cac:TaxScheme>
        </cac:TaxCategory>
      </cac:TaxSubtotal>
    </cac:TaxTotal>
    <cac:Item>
      <cbc:Description>${escapeXml(item.descripcion)}</cbc:Description>
      <cac:SellersItemIdentification>
        <cbc:ID>${escapeXml(item.codigo || "")}</cbc:ID>
      </cac:SellersItemIdentification>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="${moneda}">${
    formatAmount(item.mto_valor_unitario, 6)
  }</cbc:PriceAmount>
    </cac:Price>
  </${lineTag}>`;
  }).join("");
}

function buildNoteTaxSubtotals(document: DbRecord, moneda: string): string {
  const subtotals: string[] = [];

  const gravadas = Number(document.mto_oper_gravadas) || 0;
  const exoneradas = Number(document.mto_oper_exoneradas) || 0;
  const inafectas = Number(document.mto_oper_inafectas) || 0;

  if (gravadas > 0) {
    subtotals.push(`
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${moneda}">${formatAmount(gravadas)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${moneda}">${formatAmount(document.mto_igv)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:Percent>18.00</cbc:Percent>
        <cbc:TaxExemptionReasonCode>10</cbc:TaxExemptionReasonCode>
        <cac:TaxScheme>
          <cbc:ID>1000</cbc:ID>
          <cbc:Name>IGV</cbc:Name>
          <cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>`);
  }

  if (exoneradas > 0) {
    subtotals.push(`
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${moneda}">${formatAmount(exoneradas)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${moneda}">0.00</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:Percent>0.00</cbc:Percent>
        <cbc:TaxExemptionReasonCode>20</cbc:TaxExemptionReasonCode>
        <cac:TaxScheme>
          <cbc:ID>9997</cbc:ID>
          <cbc:Name>EXO</cbc:Name>
          <cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>`);
  }

  if (inafectas > 0) {
    subtotals.push(`
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${moneda}">${formatAmount(inafectas)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${moneda}">0.00</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:Percent>0.00</cbc:Percent>
        <cbc:TaxExemptionReasonCode>30</cbc:TaxExemptionReasonCode>
        <cac:TaxScheme>
          <cbc:ID>9998</cbc:ID>
          <cbc:Name>INA</cbc:Name>
          <cbc:TaxTypeCode>FRE</cbc:TaxTypeCode>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>`);
  }

  if (subtotals.length === 0) {
    subtotals.push(`
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${moneda}">0.00</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${moneda}">0.00</cbc:TaxAmount>
      <cac:TaxCategory>
        <cac:TaxScheme>
          <cbc:ID>1000</cbc:ID>
          <cbc:Name>IGV</cbc:Name>
          <cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>`);
  }

  return subtotals.join("");
}

function buildMonetaryTotalXml(
  kind: "credit-note" | "debit-note",
  document: DbRecord,
  moneda: string,
): string {
  const totalTag = kind === "credit-note"
    ? "cac:LegalMonetaryTotal"
    : "cac:RequestedMonetaryTotal";

  const lineExtension = Number(document.mto_oper_gravadas || 0)
    + Number(document.mto_oper_exoneradas || 0)
    + Number(document.mto_oper_inafectas || 0)
    + Number(document.mto_oper_exportacion || 0);
  const taxInclusive = Number(document.mto_imp_venta || 0);

  return `
  <${totalTag}>
    <cbc:LineExtensionAmount currencyID="${moneda}">${formatAmount(lineExtension)}</cbc:LineExtensionAmount>
    <cbc:TaxInclusiveAmount currencyID="${moneda}">${formatAmount(taxInclusive)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${moneda}">${formatAmount(taxInclusive)}</cbc:PayableAmount>
  </${totalTag}>`;
}

export function buildNoteXml(
  document: DbRecord,
  credentials: DbRecord,
  kind: "credit-note" | "debit-note",
): string {
  const rootTag = kind === "credit-note" ? "CreditNote" : "DebitNote";
  const customer = (document.client as DbRecord) || {};
  const items = ensureArray(document.detalles as DbRecord[]);
  const legends = ensureArray(document.leyendas as DbRecord[]);
  const moneda = escapeXml(document.moneda || "PEN");

  return `<?xml version="1.0" encoding="UTF-8"?>
<${rootTag} ${buildNamespaces(kind)}>
  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionContent/>
    </ext:UBLExtension>${buildLegendExtensionXml(legends)}
  </ext:UBLExtensions>
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>2.0</cbc:CustomizationID>
  <cbc:ID>${escapeXml(document.serie)}-${
    escapeXml(document.correlativo)
  }</cbc:ID>
  <cbc:IssueDate>${escapeXml(document.fecha_emision)}</cbc:IssueDate>
  <cbc:DocumentCurrencyCode>${moneda}</cbc:DocumentCurrencyCode>
  <cac:DiscrepancyResponse>
    <cbc:ReferenceID>${escapeXml(document.num_doc_afectado)}</cbc:ReferenceID>
    <cbc:ResponseCode>${escapeXml(document.cod_motivo)}</cbc:ResponseCode>
    <cbc:Description>${escapeXml(document.des_motivo)}</cbc:Description>
  </cac:DiscrepancyResponse>
  <cac:BillingReference>
    <cac:InvoiceDocumentReference>
      <cbc:ID>${escapeXml(document.num_doc_afectado)}</cbc:ID>
      <cbc:DocumentTypeCode>${
    escapeXml(document.tipo_doc_afectado || "01")
  }</cbc:DocumentTypeCode>
    </cac:InvoiceDocumentReference>
  </cac:BillingReference>
  <cac:Signature>
    <cbc:ID>${escapeXml(credentials.ruc)}</cbc:ID>
    <cac:SignatoryParty>
      <cac:PartyIdentification>
        <cbc:ID>${escapeXml(credentials.ruc)}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>${escapeXml(credentials.razon_social)}</cbc:Name>
      </cac:PartyName>
    </cac:SignatoryParty>
    <cac:DigitalSignatureAttachment>
      <cac:ExternalReference>
        <cbc:URI>#SignatureSP</cbc:URI>
      </cac:ExternalReference>
    </cac:DigitalSignatureAttachment>
  </cac:Signature>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="6">${escapeXml(credentials.ruc)}</cbc:ID>
      </cac:PartyIdentification>${
    credentials.nombre_comercial
      ? `
      <cac:PartyName>
        <cbc:Name>${escapeXml(String(credentials.nombre_comercial))}</cbc:Name>
      </cac:PartyName>`
      : ""
  }
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escapeXml(String(credentials.razon_social))}</cbc:RegistrationName>
        <cac:RegistrationAddress>
          <cbc:ID>${escapeXml(String(credentials.ubigeo || "150101"))}</cbc:ID>
          <cbc:AddressTypeCode>0000</cbc:AddressTypeCode>
          <cbc:CityName>${escapeXml(String(credentials.provincia || "LIMA"))}</cbc:CityName>
          <cbc:CountrySubentity>${escapeXml(String(credentials.departamento || "LIMA"))}</cbc:CountrySubentity>
          <cbc:District>${escapeXml(String(credentials.distrito || "LIMA"))}</cbc:District>
          <cac:AddressLine>
            <cbc:Line>${escapeXml(String(credentials.direccion || "-"))}</cbc:Line>
          </cac:AddressLine>
          <cac:Country>
            <cbc:IdentificationCode>PE</cbc:IdentificationCode>
          </cac:Country>
        </cac:RegistrationAddress>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="${escapeXml(customer.tipo_documento)}">${
    escapeXml(customer.numero_documento)
  }</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${
    escapeXml(customer.razon_social || "")
  }</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${moneda}">${
    formatAmount(document.total_impuestos)
  }</cbc:TaxAmount>${buildNoteTaxSubtotals(document, moneda)}
  </cac:TaxTotal>${buildMonetaryTotalXml(kind, document, moneda)}${
    buildLineXml(kind, items, moneda)
  }
</${rootTag}>`;
}
