import { describe, it, expect } from "vitest";
import { productFormSchema } from "@/lib/schemas";
import { clientFormSchema } from "@/lib/schemas";
import { branchFormSchema } from "@/lib/schemas";
import { despatchFormSchema } from "@/lib/schemas/despatch.schema";

describe("productFormSchema — boundary values", () => {
  const validProduct = {
    name: "Aceite 2T",
    sku: "ACE-001",
    product_family: "productos" as const,
    category_group: "repuestos" as const,
    category: "Lubricantes",
    price_soles: 30,
    cost_soles: 20,
    stock: 50,
    min_stock: 5,
    max_stock: 200,
    unit: "Unidad",
    tax_affectation: "gravado" as const,
    supplier: "",
    description: "",
    image_url: "",
    tags: [] as string[],
    selectedMachineIds: [] as string[],
    priceTiers: [] as { label: string; min_quantity: number; price_soles: number }[],
  };

  it("valida producto correcto", () => {
    expect(productFormSchema.safeParse(validProduct).success).toBe(true);
  });

  it("rechaza nombre vacío", () => {
    expect(productFormSchema.safeParse({ ...validProduct, name: "" }).success).toBe(false);
  });

  it("rechaza nombre vacío (pero acepta 1 carácter)", () => {
    expect(productFormSchema.safeParse({ ...validProduct, name: "" }).success).toBe(false);
    expect(productFormSchema.safeParse({ ...validProduct, name: "A" }).success).toBe(true);
  });

  it("rechaza SKU duplicado (no se valida aquí, es en el servicio)", () => {
    expect(productFormSchema.safeParse(validProduct).success).toBe(true);
  });

  it("rechaza precio negativo", () => {
    expect(productFormSchema.safeParse({ ...validProduct, price_soles: -1 }).success).toBe(false);
  });

  it("rechaza precio 0", () => {
    expect(productFormSchema.safeParse({ ...validProduct, price_soles: 0 }).success).toBe(false);
  });

  it("rechaza min_stock > max_stock", () => {
    expect(productFormSchema.safeParse({ ...validProduct, min_stock: 300, max_stock: 200 }).success).toBe(false);
  });

  it("rechaza nombre muy largo (>200 chars)", () => {
    const long = "A".repeat(201);
    expect(productFormSchema.safeParse({ ...validProduct, name: long }).success).toBe(false);
  });

  it("rechaza tax_affectation inválido", () => {
    expect(productFormSchema.safeParse({ ...validProduct, tax_affectation: "inventado" }).success).toBe(false);
  });

  it("acepta emojis en nombre (Unicode)", () => {
    expect(productFormSchema.safeParse({ ...validProduct, name: "Aceite 🛢️ 2T" }).success).toBe(true);
  });
});

describe("clientFormSchema — RUC/DNI validation", () => {
  const validClient = {
    name: "Juan Pérez",
    document_type: "DNI" as const,
    document_number: "12345678",
    phone: "",
    email: "",
    address: "",
    city: "",
  };

  it("valida cliente correcto", () => {
    expect(clientFormSchema.safeParse(validClient).success).toBe(true);
  });

  it("rechaza nombre vacío", () => {
    expect(clientFormSchema.safeParse({ ...validClient, name: "" }).success).toBe(false);
  });

  it("rechaza tipo documento inválido", () => {
    expect(clientFormSchema.safeParse({ ...validClient, document_type: "PASAPORTE" }).success).toBe(false);
  });

  it("rechaza DNI con menos de 8 dígitos", () => {
    expect(clientFormSchema.safeParse({ ...validClient, document_number: "123" }).success).toBe(false);
  });

  it("rechaza DNI con más de 8 dígitos", () => {
    expect(clientFormSchema.safeParse({ ...validClient, document_number: "123456789" }).success).toBe(false);
  });

  it("acepta RUC de 11 dígitos", () => {
    expect(clientFormSchema.safeParse({ ...validClient, document_type: "RUC", document_number: "20608183672" }).success).toBe(true);
  });

  it("rechaza RUC con letras", () => {
    expect(clientFormSchema.safeParse({ ...validClient, document_type: "RUC", document_number: "20ABC183672" }).success).toBe(false);
  });

  it("rechaza nombre muy largo", () => {
    const long = "A".repeat(201);
    expect(clientFormSchema.safeParse({ ...validClient, name: long }).success).toBe(false);
  });
});

describe("branchFormSchema", () => {
  const validBranch = {
    name: "Sede Pichanaqui",
    code: "PCH",
    type: "pos" as const,
    address: "Jr. Santo Toribio 620",
    phone: "",
    department_code: "",
    province_code: "",
    district_code: "",
    invoice_serie_prefix: "F001",
  };

  it("valida sucursal correcta", () => {
    expect(branchFormSchema.safeParse(validBranch).success).toBe(true);
  });

  it("rechaza tipo inválido", () => {
    expect(branchFormSchema.safeParse({ ...validBranch, type: "oficina" }).success).toBe(false);
  });

  it("rechaza nombre vacío", () => {
    expect(branchFormSchema.safeParse({ ...validBranch, name: "" }).success).toBe(false);
  });
});

describe("despatchFormSchema", () => {
  const validDespatch = {
    branch_id: "branch-1",
    motivo_traslado: "01",
    fecha_inicio_traslado: "2026-07-20",
    peso_bruto_total: 100.5,
    numero_bultos: 5,
    remitente_ubigeo: "120301",
    remitente_direccion: "Jr. Santo Toribio 620",
    destino_ubigeo: "120601",
    destino_direccion: "Av. Destino 456",
    destinatario_tipo_doc: "6" as const,
    destinatario_documento: "20608183672",
    destinatario_nombre: "Cliente Destino SAC",
    transportista_tipo_doc: "6" as const,
    transportista_documento: "20123456789",
    transportista_nombre: "Transportes Andinos",
    conductor_tipo_doc: "1" as const,
    conductor_documento: "12345678",
    conductor_nombre: "Pedro Conductor",
    conductor_licencia: "Q12345678",
    vehiculo_placa: "ABC-123",
    items: [{ product_name: "Aceite 2T", quantity: 10, unit: "NIU" }],
  };

  it("valida guía correcta", () => {
    expect(despatchFormSchema.safeParse(validDespatch).success).toBe(true);
  });

  it("rechaza sin items", () => {
    expect(despatchFormSchema.safeParse({ ...validDespatch, items: [] }).success).toBe(false);
  });

  it("rechaza ubigeo inválido (no 6 dígitos)", () => {
    expect(despatchFormSchema.safeParse({ ...validDespatch, remitente_ubigeo: "123" }).success).toBe(false);
  });

  it("rechaza peso negativo", () => {
    expect(despatchFormSchema.safeParse({ ...validDespatch, peso_bruto_total: -1 }).success).toBe(false);
  });

  it("rechaza sin sede", () => {
    expect(despatchFormSchema.safeParse({ ...validDespatch, branch_id: "" }).success).toBe(false);
  });

  it("rechaza destinatario sin documento", () => {
    expect(despatchFormSchema.safeParse({ ...validDespatch, destinatario_documento: "" }).success).toBe(false);
  });

  it("rechaza item con cantidad 0", () => {
    expect(despatchFormSchema.safeParse({
      ...validDespatch,
      items: [{ product_name: "X", quantity: 0, unit: "NIU" }]
    }).success).toBe(false);
  });
});
