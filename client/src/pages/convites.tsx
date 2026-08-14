import ComunidadePage from "@/pages/comunidade";

export default function ConvitesPage({ embedded = false }: { embedded?: boolean }) {
  return <ComunidadePage convitesOnly embedded={embedded} />;
}
