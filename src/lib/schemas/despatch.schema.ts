import { z } from "zod";

export const despatchItemSchema = z.object({
  product_id: z.string().optional(),
  product_name: z.string().min(1, "Nombre del producto requerido"),
  product_sku: z.string().optional(),
  quantity: z.number().int().min(1, "Cantidad mínima: 1"),
  unit: z.string().min(1).default("NIU"),
});

export const despatchFormSchema = z.object({
  branch_id: z.string().min(1, "Selecciona una sede"),
  motivo_traslado: z.string().min(2, "Motivo requerido"),
  descripcion_motivo: z.string().max(500).optional(),
  fecha_inicio_traslado: z.string().min(1, "Fecha requerida"),
  peso_bruto_total: z.number().min(0, "Peso no puede ser negativo"),
  numero_bultos: z.number().int().min(0),

  remitente_ubigeo: z.string().length(6, "Ubigeo debe tener 6 dígitos"),
  remitente_direccion: z.string().min(1, "Dirección de partida requerida").max(500),
  destino_ubigeo: z.string().length(6, "Ubigeo debe tener 6 dígitos"),
  destino_direccion: z.string().min(1, "Dirección de destino requerida").max(500),

  destinatario_tipo_doc: z.enum(["1", "6"]),
  destinatario_documento: z.string().min(1, "Documento del destinatario requerido"),
  destinatario_nombre: z.string().min(1, "Nombre del destinatario requerido").max(200),

  transportista_tipo_doc: z.enum(["1", "6"]),
  transportista_documento: z.string().min(1, "Documento del transportista requerido"),
  transportista_nombre: z.string().min(1, "Nombre del transportista requerido").max(200),

  conductor_tipo_doc: z.enum(["1", "4"]),
  conductor_documento: z.string().min(1, "Documento del conductor requerido"),
  conductor_nombre: z.string().min(1, "Nombre del conductor requerido").max(200).optional(),
  conductor_licencia: z.string().min(1, "Licencia del conductor requerida").max(20),

  vehiculo_placa: z.string().min(1, "Placa requerida").max(10),
  items: z.array(despatchItemSchema).min(1, "Agrega al menos un bien a transportar"),
});

export type DespatchFormValues = z.infer<typeof despatchFormSchema>;
