export const MEMBER_DIRECTORY_QUERY_OPTIONS = {
  staleTime: 0,
  refetchOnMount: "always" as const,
  refetchOnWindowFocus: true,
};

export const memberSearchFilter = (_value:string,search:string,keywords?:string[]) => (keywords || []).join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").includes(search.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR")) ? 1 : 0;

export function getMemberDirectoryDisplayName(member: {
  nome?: string;
  nome_completo?: string;
  primeiro_nome?: string;
  sobrenome?: string;
  Nome_de_usuario?: string;
}) {
  return member.nome || member.nome_completo ||
    [member.primeiro_nome, member.sobrenome].filter(Boolean).join(" ") ||
    member.Nome_de_usuario || "—";
}
