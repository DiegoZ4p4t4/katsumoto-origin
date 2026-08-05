import { Link } from "react-router-dom";
import { FileText, ArrowLeft } from "lucide-react";

export default function TermsOfUse() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 mb-8">
          <ArrowLeft className="w-4 h-4" /> Volver a la tienda
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <FileText className="w-8 h-8 text-orange-600" />
          <h1 className="text-3xl font-bold">Términos de Uso</h1>
        </div>

        <p className="text-sm text-muted-foreground mb-8">Última actualización: Julio 2026</p>

        <div className="prose dark:prose-invert max-w-none space-y-6 text-sm">
          <section>
            <h2 className="text-lg font-semibold mb-2">1. Aceptación de los Términos</h2>
            <p>
              Al acceder y utilizar este sitio web (<strong>katsumoto.shop</strong>), usted acepta estos términos de uso
              en su totalidad. Si no está de acuerdo, no utilice este sitio.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">2. Productos y Precios</h2>
            <p>
              Todos los precios están expresados en Soles peruanos (PEN) e incluyen IGV donde corresponda según la
              normativa tributaria vigente (Ley del IGV — D. Leg. 821). Para clientes en zona de Amazonía, se aplica
              la exoneración del IGV conforme a la Ley 27037. Los precios pueden cambiar sin previo aviso.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">3. Pedidos y Pagos</h2>
            <p>
              Al realizar un pedido, usted se compromete a proporcionar información veraz y completa. Nos reservamos
              el derecho de cancelar pedidos que no puedan ser verificados. Los métodos de pago aceptados son:
              efectivo contra entrega, transferencia bancaria, Yape y Plin.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">4. Envíos y Entregas</h2>
            <p>
              Realizamos despachos a todo el Perú. Los tiempos de entrega son estimados y pueden variar según la
              ubicación y disponibilidad de transporte. Katsumoto no se hace responsable por demoras causadas por
              terceros (empresas de transporte, condiciones climáticas, etc.).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">5. Garantía</h2>
            <p>
              Todos nuestros productos cuentan con garantía contra defectos de fabricación. El plazo y condiciones
              específicas varían según el producto. La garantía no cubre daños por uso incorrecto, desgaste normal
              o modificaciones no autorizadas.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">6. Propiedad Intelectual</h2>
            <p>
              Todo el contenido de este sitio (textos, imágenes, logos, código fuente) es propiedad de Katsumoto
              y está protegido por las leyes de propiedad intelectual peruanas e internacionales.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">7. Limitación de Responsabilidad</h2>
            <p>
              Katsumoto no será responsable por daños indirectos, incidentales o consecuentes derivados del uso
              o la imposibilidad de uso de este sitio web o de los productos adquiridos.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">8. Legislación Aplicable</h2>
            <p>
              Estos términos se rigen por las leyes de la República del Perú. Cualquier disputa será resuelta
              ante los tribunales competentes de Chanchamayo, Junín.
            </p>
          </section>

          <hr className="my-8" />

          <p className="text-muted-foreground">
            <strong>Katsumoto</strong> — RUC 20608183672<br />
            Jr. Santo Toribio 620, Pichanaki, Chanchamayo, Junín, Perú
          </p>
        </div>
      </div>
    </div>
  );
}
