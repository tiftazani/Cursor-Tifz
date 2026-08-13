import { AnalystChat } from "@/components/analyst-chat";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Robot Analisa" };

export default function AnalisaPage() {
  return (
    <div>
      <PageHeader
        kicker="Cuan Bot"
        title="Robot analisa emiten"
        subtitle="Ketik kode atau nama saham. Robot membaca teknikal, IHSG, pasar global, dan harga komoditas, lalu menjawab di bubble chat."
      />
      <AnalystChat tall />
    </div>
  );
}
