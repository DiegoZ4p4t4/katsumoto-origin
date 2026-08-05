export const STORE_CONFIG = {
  name: "Katsumoto",
  tagline: "Repuestos y Maquinaria",
  phone: "936 309 003",
  phoneHref: "tel:+51936309003",
  wasaNumber: "51924532277",
  wasaDisplay: "WhatsApp: 924 532 277",
  whatsappNumber: "51924532277",
  whatsappDisplay: "WhatsApp: 924 532 277",
  whatsappMessage: "Hola, me interesa un producto de la tienda Katsumoto. ¿Podrían asesorarme?",
  email: "ventas@katsumoto.pe",
  ruc: "20608183672",
  address: "Jr. Santo Toribio 620, Pichanaki - Chanchamayo",
  addressMapUrl: "https://maps.google.com/?q=Jr.+Santo+Toribio+620+Pichanaki+Chanchamayo+Junin",
  schedule: "Lun–Sáb: 7:30 AM – 6:00 PM",
  scheduleSun: "Dom: 8:00 AM – 4:00 PM",
  city: "Pichanaki",
  version: "v2.1",
} as const;

export function getWhatsAppUrl(message?: string): string {
  const msg = message || STORE_CONFIG.whatsappMessage;
  return `https://wa.me/${STORE_CONFIG.whatsappNumber}?text=${encodeURIComponent(msg)}`;
}
