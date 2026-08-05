import { Link } from "react-router-dom";
import { Shield, ArrowLeft } from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 mb-8">
          <ArrowLeft className="w-4 h-4" /> Volver a la tienda
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-8 h-8 text-orange-600" />
          <h1 className="text-3xl font-bold">Política de Privacidad</h1>
        </div>

        <p className="text-sm text-muted-foreground mb-8">Última actualización: Julio 2026</p>

        <div className="prose dark:prose-invert max-w-none space-y-6 text-sm">
          <section>
            <h2 className="text-lg font-semibold mb-2">1. Responsable del Tratamiento</h2>
            <p>
              <strong>Katsumoto</strong>, con RUC 20608183672, domicilio en Jr. Santo Toribio 620, Pichanaki, Chanchamayo, Junín, Perú,
              es el responsable del tratamiento de los datos personales que usted proporciona a través de este sitio web.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">2. Datos que Recopilamos</h2>
            <p>Podemos recopilar los siguientes datos personales:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Nombre completo</li>
              <li>Documento de identidad (DNI o RUC)</li>
              <li>Número de teléfono</li>
              <li>Correo electrónico</li>
              <li>Dirección de envío</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">3. Finalidad del Tratamiento</h2>
            <p>Sus datos serán utilizados exclusivamente para:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Procesar y entregar sus pedidos</li>
              <li>Emitir comprobantes de pago electrónicos (facturación SUNAT)</li>
              <li>Comunicarnos con usted sobre el estado de su pedido</li>
              <li>Atender consultas y solicitudes de soporte</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">4. Almacenamiento y Seguridad</h2>
            <p>
              Sus datos se almacenan en servidores seguros de Supabase (PostgreSQL 15) con cifrado en tránsito (TLS 1.3)
              y en reposo. Implementamos Row-Level Security (RLS) para garantizar que solo el personal autorizado
              acceda a su información. Las credenciales fiscales (clave SOL) se almacenan con cifrado AES-256-GCM.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">5. No Compartimos sus Datos</h2>
            <p>
              No vendemos, alquilamos ni compartimos sus datos personales con terceros, excepto cuando sea requerido
              por ley (SUNAT para facturación electrónica) o para cumplir con la entrega de su pedido (empresas de transporte).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">6. Cookies</h2>
            <p>
              Utilizamos cookies técnicas esenciales para el funcionamiento del sitio (carrito de compras, sesión).
              No utilizamos cookies de seguimiento, publicitarias ni de terceros.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">7. Sus Derechos</h2>
            <p>Usted tiene derecho a:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Acceder a sus datos personales</li>
              <li>Solicitar la rectificación de datos inexactos</li>
              <li>Solicitar la supresión de sus datos</li>
              <li>Oponerse al tratamiento de sus datos</li>
            </ul>
            <p className="mt-2">
              Para ejercer estos derechos, contáctenos en{" "}
              <strong>ventas@katsumoto.shop</strong> o al WhatsApp{" "}
              <strong>924 532 277</strong>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">8. Modificaciones</h2>
            <p>
              Nos reservamos el derecho de modificar esta política en cualquier momento. Los cambios serán publicados
              en esta página.
            </p>
          </section>

          <hr className="my-8" />

          <p className="text-muted-foreground">
            Para cualquier consulta sobre esta política:{" "}
            <strong>ventas@katsumoto.shop</strong> | WhatsApp:{" "}
            <strong>+51 924 532 277</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
