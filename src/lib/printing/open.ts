import type jsPDF from "jspdf";

export async function openPdfInTab(build: () => Promise<jsPDF>): Promise<jsPDF> {
  const w = window.open("", "_blank");
  try {
    const doc = await build();
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    if (w) {
      w.location.href = url;
    } else {
      window.location.href = url;
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return doc;
  } catch (err) {
    if (w && !w.closed) w.close();
    throw err;
  }
}
