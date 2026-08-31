export const MEMBER_DIRECTORY_QUERY_OPTIONS = {
  staleTime: 0,
  refetchOnMount: "always" as const,
  refetchOnWindowFocus: true,
};

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
