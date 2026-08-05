import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDespatchMutations } from "@/hooks/useDespatchMutations";
import { useBranches } from "@/hooks/useBranches";
import { useProducts } from "@/hooks/useProducts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, Loader2, Construction } from "lucide-react";
import type { DespatchFormData, DespatchItemFormData, MotivoTraslado } from "@/lib/types/despatch";
import { MOTIVO_TRASLADO_LABELS } from "@/lib/types/despatch";
import { despatchFormSchema, type DespatchFormValues } from "@/lib/schemas/despatch.schema";
import { sanitizeName, sanitizeNotes, sanitizeAddress, sanitizeDocumentNumber } from "@/lib/sanitize";
import { showError } from "@/utils/toast";

const EMPTY_ITEM: DespatchItemFormData = {
  product_name: "",
  quantity: 1,
  unit: "NIU",
};

export default function CreateDespatch() {
  const navigate = useNavigate();
  const { create, isCreating } = useDespatchMutations();
  const { branches } = useBranches();
  const { products } = useProducts();

  const [branchId, setBranchId] = useState("");
  const [motivo, setMotivo] = useState<MotivoTraslado>("01");
  const [descripcionMotivo, setDescripcionMotivo] = useState("");
  const [fechaTraslado, setFechaTraslado] = useState(new Date().toISOString().split("T")[0]);
  const [pesoBruto, setPesoBruto] = useState("");
  const [numBultos, setNumBultos] = useState("0");

  const [remitenteUbigeo, setRemitenteUbigeo] = useState("");
  const [remitenteDireccion, setRemitenteDireccion] = useState("");
  const [destinoUbigeo, setDestinoUbigeo] = useState("");
  const [destinoDireccion, setDestinoDireccion] = useState("");

  const [destTipoDoc, setDestTipoDoc] = useState("6");
  const [destDocumento, setDestDocumento] = useState("");
  const [destNombre, setDestNombre] = useState("");

  const [transpTipoDoc, setTranspTipoDoc] = useState("6");
  const [transpDocumento, setTranspDocumento] = useState("");
  const [transpNombre, setTranspNombre] = useState("");

  const [condTipoDoc, setCondTipoDoc] = useState("1");
  const [condDocumento, setCondDocumento] = useState("");
  const [condNombre, setCondNombre] = useState("");
  const [condLicencia, setCondLicencia] = useState("");
  const [vehiculoPlaca, setVehiculoPlaca] = useState("");

  const [items, setItems] = useState<DespatchItemFormData[]>([{ ...EMPTY_ITEM }]);

  const addItem = () => setItems([...items, { ...EMPTY_ITEM }]);
  const removeItem = (idx: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== idx));
  };
  const updateItem = (idx: number, field: keyof DespatchItemFormData, value: string | number) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], [field]: value };
    setItems(updated);
  };

  const handleProductSelect = (idx: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      const updated = [...items];
      updated[idx] = {
        ...updated[idx],
        product_id: product.id,
        product_name: product.name,
        product_sku: product.sku,
        unit: product.unit || "NIU",
      };
      setItems(updated);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const formValues: DespatchFormValues = {
      branch_id: branchId,
      motivo_traslado: motivo,
      descripcion_motivo: sanitizeNotes(descripcionMotivo) || MOTIVO_TRASLADO_LABELS[motivo],
      fecha_inicio_traslado: fechaTraslado,
      peso_bruto_total: Number(pesoBruto) || 0,
      numero_bultos: Number(numBultos) || 0,
      remitente_ubigeo: remitenteUbigeo,
      remitente_direccion: sanitizeAddress(remitenteDireccion),
      destino_ubigeo: destinoUbigeo,
      destino_direccion: sanitizeAddress(destinoDireccion),
      destinatario_tipo_doc: destTipoDoc as "1" | "6",
      destinatario_documento: sanitizeDocumentNumber(destDocumento, destTipoDoc === "6" ? "RUC" : "DNI"),
      destinatario_nombre: sanitizeName(destNombre),
      transportista_tipo_doc: transpTipoDoc as "1" | "6",
      transportista_documento: sanitizeDocumentNumber(transpDocumento, transpTipoDoc === "6" ? "RUC" : "DNI"),
      transportista_nombre: sanitizeName(transpNombre),
      conductor_tipo_doc: condTipoDoc as "1" | "4",
      conductor_documento: sanitizeDocumentNumber(condDocumento, condTipoDoc === "1" ? "DNI" : "CE"),
      conductor_nombre: sanitizeName(condNombre),
      conductor_licencia: condLicencia.toUpperCase().slice(0, 20),
      vehiculo_placa: vehiculoPlaca.toUpperCase().replace(/[^A-Z0-9-]/g, ""),
      items: items.filter((i) => i.product_name.trim()),
    };

    const result = despatchFormSchema.safeParse(formValues);
    if (!result.success) {
      const firstError = result.error.errors[0];
      showError(`${firstError.path.join(".")}: ${firstError.message}`);
      return;
    }

    const formData: DespatchFormData = { ...result.data, modalidad_traslado: "01" };

    create(formData, {
      onSuccess: () => navigate("/despatches"),
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/despatches")} className="rounded-xl">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-2xl font-bold">Nueva Guia de Remision</h1>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4">
        <div className="flex items-start gap-3">
          <Construction className="w-6 h-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="font-semibold text-amber-800 dark:text-amber-200 text-sm">Modulo en desarrollo</h3>
            <p className="text-xs text-amber-700 dark:text-amber-300">
              El envio de Guias de Remision Electronica a SUNAT estara disponible proximamente.
              Puedes crear guias y quedaran registradas para envio futuro.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="rounded-xl">
          <CardHeader><CardTitle>General</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Sede</Label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Seleccionar sede" /></SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Motivo de traslado</Label>
              <Select value={motivo} onValueChange={(v) => setMotivo(v as MotivoTraslado)}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(MOTIVO_TRASLADO_LABELS).map(([code, label]) => (
                    <SelectItem key={code} value={code}>{code} - {label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descripcion motivo</Label>
              <Input value={descripcionMotivo} onChange={(e) => setDescripcionMotivo(e.target.value)} placeholder={MOTIVO_TRASLADO_LABELS[motivo]} className="rounded-xl" />
            </div>
            <div>
              <Label>Fecha inicio traslado</Label>
              <Input type="date" value={fechaTraslado} onChange={(e) => setFechaTraslado(e.target.value)} className="rounded-xl" required />
            </div>
            <div>
              <Label>Peso bruto total (kg)</Label>
              <Input type="number" step="0.01" value={pesoBruto} onChange={(e) => setPesoBruto(e.target.value)} className="rounded-xl" required />
            </div>
            <div>
              <Label>Numero de bultos</Label>
              <Input type="number" value={numBultos} onChange={(e) => setNumBultos(e.target.value)} className="rounded-xl" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardHeader><CardTitle>Direccion partida (remitente)</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Ubigeo</Label>
              <Input value={remitenteUbigeo} onChange={(e) => setRemitenteUbigeo(e.target.value)} placeholder="120601" className="rounded-xl" required />
            </div>
            <div>
              <Label>Direccion</Label>
              <Input value={remitenteDireccion} onChange={(e) => setRemitenteDireccion(e.target.value)} placeholder="Jr. Principal 123" className="rounded-xl" required />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardHeader><CardTitle>Direccion llegada (destino)</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Ubigeo</Label>
              <Input value={destinoUbigeo} onChange={(e) => setDestinoUbigeo(e.target.value)} placeholder="120601" className="rounded-xl" required />
            </div>
            <div>
              <Label>Direccion</Label>
              <Input value={destinoDireccion} onChange={(e) => setDestinoDireccion(e.target.value)} placeholder="Av. Destino 456" className="rounded-xl" required />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardHeader><CardTitle>Destinatario</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Tipo documento</Label>
              <Select value={destTipoDoc} onValueChange={setDestTipoDoc}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">RUC (6)</SelectItem>
                  <SelectItem value="1">DNI (1)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Numero documento</Label>
              <Input value={destDocumento} onChange={(e) => setDestDocumento(e.target.value)} className="rounded-xl" required />
            </div>
            <div>
              <Label>Nombre / Razon social</Label>
              <Input value={destNombre} onChange={(e) => setDestNombre(e.target.value)} className="rounded-xl" required />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardHeader><CardTitle>Transportista</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Tipo documento</Label>
              <Select value={transpTipoDoc} onValueChange={setTranspTipoDoc}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">RUC (6)</SelectItem>
                  <SelectItem value="1">DNI (1)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Numero documento</Label>
              <Input value={transpDocumento} onChange={(e) => setTranspDocumento(e.target.value)} className="rounded-xl" required />
            </div>
            <div>
              <Label>Nombre / Razon social</Label>
              <Input value={transpNombre} onChange={(e) => setTranspNombre(e.target.value)} className="rounded-xl" required />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardHeader><CardTitle>Conductor</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Tipo documento</Label>
              <Select value={condTipoDoc} onValueChange={setCondTipoDoc}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">DNI (1)</SelectItem>
                  <SelectItem value="4">CE (4)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Numero documento</Label>
              <Input value={condDocumento} onChange={(e) => setCondDocumento(e.target.value)} className="rounded-xl" required />
            </div>
            <div>
              <Label>Nombre</Label>
              <Input value={condNombre} onChange={(e) => setCondNombre(e.target.value)} className="rounded-xl" required />
            </div>
            <div>
              <Label>Licencia conducir</Label>
              <Input value={condLicencia} onChange={(e) => setCondLicencia(e.target.value)} className="rounded-xl" required />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardHeader><CardTitle>Vehiculo</CardTitle></CardHeader>
          <CardContent>
            <div className="max-w-xs">
              <Label>Placa</Label>
              <Input value={vehiculoPlaca} onChange={(e) => setVehiculoPlaca(e.target.value.toUpperCase())} placeholder="ABC-123" className="rounded-xl" required />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Bienes a transportar</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addItem} className="rounded-xl">
              <Plus className="w-4 h-4 mr-1" />Agregar
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-4">
                  <Label className="text-xs">Producto</Label>
                  <Select value={item.product_id || ""} onValueChange={(v) => handleProductSelect(idx, v)}>
                    <SelectTrigger className="rounded-xl h-9 text-sm"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-3">
                  <Label className="text-xs">Descripcion</Label>
                  <Input value={item.product_name} onChange={(e) => updateItem(idx, "product_name", e.target.value)} className="rounded-xl h-9 text-sm" required />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Cantidad</Label>
                  <Input type="number" value={item.quantity} onChange={(e) => updateItem(idx, "quantity", Number(e.target.value))} className="rounded-xl h-9 text-sm" required min={1} />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Unidad</Label>
                  <Input value={item.unit || "NIU"} onChange={(e) => updateItem(idx, "unit", e.target.value)} className="rounded-xl h-9 text-sm" />
                </div>
                <div className="col-span-1">
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(idx)} disabled={items.length <= 1} className="h-9 w-9">
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate("/despatches")} className="rounded-xl">
            Cancelar
          </Button>
          <Button type="submit" disabled={isCreating} className="rounded-xl bg-orange-600 hover:bg-orange-700">
            {isCreating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {isCreating ? "Creando..." : "Crear Guia T001"}
          </Button>
        </div>
      </form>
    </div>
  );
}
