import { Link } from "wouter";
import type { InitialMapParticipantInput } from "@shared/member-portfolio";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function biaObaCreationUrl(biaId: string) {
  return "/area-aliancas?" + new URLSearchParams({ tab: "oportunidades", tipo: "obas", criar: "true", bia: biaId });
}

type VacancyParticipant = Pick<InitialMapParticipantInput, "participantId" | "titular" | "cotasInvestimento">;

export function hasAddedBiaVacancies(previous: VacancyParticipant[], current: VacancyParticipant[]) {
  const previousQuotas = new Map(previous.filter(row => row.titular === "vaga").map(row => [row.participantId, row.cotasInvestimento ?? 1]));
  return current.some(row => row.titular === "vaga" && (row.cotasInvestimento ?? 1) > (previousQuotas.get(row.participantId) ?? 0));
}

export function BiaObaPrompt({ biaId, open, onOpenChange, onPrepare }: { biaId: string; open: boolean; onOpenChange: (open: boolean) => void; onPrepare?: () => void }) {
  return <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Quer gerar uma OBA?</AlertDialogTitle>
        <AlertDialogDescription>{onPrepare ? "A OBA Oportunidade de aquisição de cotas será criada com as cotas disponíveis deste rascunho." : "Você pode divulgar as cotas disponíveis desta BIA em uma oferta, por convite ou pelo Pulso."}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Agora não</AlertDialogCancel>
        {onPrepare ? <AlertDialogAction onClick={onPrepare}>Salvar e gerar OBA</AlertDialogAction> :
          <AlertDialogAction asChild><Link href={biaObaCreationUrl(biaId)}>Gerar OBA</Link></AlertDialogAction>}
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
