import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { MEMBER_DIRECTORY_QUERY_OPTIONS, getMemberDirectoryDisplayName, memberSearchFilter } from "@/lib/member-directory-query";
import { copyTextToClipboard } from "@/lib/clipboard";
import { formatBuiltInviteMessage } from "@/lib/invite-message";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "./ui/command";

export function BiaLegalPersonField({label,value,onChange,disabled=false}:{label:string;value:string;onChange:(name:string)=>void;disabled?:boolean}) {
  const id=useId();
  const [open,setOpen]=useState(false),[search,setSearch]=useState(""),[inviteOpen,setInviteOpen]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const [invite,setInvite]=useState<{link:string;expires_at:string}|null>(null);
  const members=useQuery<any[]>({queryKey:["/api/membros"],...MEMBER_DIRECTORY_QUERY_OPTIONS,enabled:open && !disabled});
  const names=Array.from(new Set((members.data || []).map(getMemberDirectoryDisplayName).filter(name=>name!=="—"))).sort((a,b)=>a.localeCompare(b,"pt-BR",{sensitivity:"base"}));
  const expired=!!invite && new Date(invite.expires_at).getTime()<=Date.now();
  const select=(name:string)=>{if(!disabled){onChange(name);setOpen(false);}};
  async function generate() {
    if(disabled || busy)return;
    setBusy(true);setMessage("");setInvite(null);
    try {
      const data=await (await apiRequest("POST","/api/meu-convite",{tipo:"unificado",force:false})).json();
      if(typeof data.link!=="string" || !/^https?:\/\//i.test(data.link) || !Number.isFinite(Date.parse(data.expires_at)))throw new Error("Não foi possível obter um convite válido. Tente novamente.");
      setInvite({link:data.link,expires_at:data.expires_at});
      void queryClient.invalidateQueries({queryKey:["/api/meu-convite"]});
    }catch(error:any){setMessage(error.message || "Não foi possível gerar o convite.");}
    finally{setBusy(false);}
  }
  return <div className="min-w-0 space-y-2">
    <label htmlFor={id}>{label}</label>
    <Popover open={open && !disabled} onOpenChange={next=>{if(!disabled){setOpen(next);if(next)setSearch("");}}}>
      <PopoverTrigger asChild><Button id={id} type="button" variant="outline" role="combobox" aria-expanded={open && !disabled} disabled={disabled} className="w-full justify-between font-normal"><span className="truncate">{value || "Busque ou digite o nome"}</span><span aria-hidden="true">⌄</span></Button></PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0">
        <Command filter={memberSearchFilter}><CommandInput aria-label={`Buscar ${label.replace(' *','')}`} placeholder="Buscar por nome…" value={search} onValueChange={setSearch} maxLength={4000}/><CommandList>
          <CommandEmpty>{members.isFetching?"Carregando nomes…":members.isError?"Não foi possível carregar os nomes.":"Nenhum nome encontrado na rede."}</CommandEmpty>
          {names.map(name=><CommandItem key={name} value={name} keywords={[name]} onSelect={()=>select(name)}>{name}</CommandItem>)}
        </CommandList></Command>
        <div className="space-y-2 border-t p-2">
          {members.isError && <Button type="button" variant="ghost" size="sm" onClick={()=>members.refetch()}>Tentar novamente</Button>}
          {search.trim() && <Button type="button" variant="outline" className="h-auto w-full whitespace-normal break-words text-left" onClick={()=>select(search.trim())}>Usar nome digitado: {search.trim()}</Button>}
          {value && <Button type="button" variant="ghost" size="sm" onClick={()=>select("")}>Limpar nome</Button>}
        </div>
      </PopoverContent>
    </Popover>
    {!disabled && <Button type="button" variant="ghost" size="sm" className="h-auto whitespace-normal p-0 text-left text-primary hover:underline" aria-expanded={inviteOpen} aria-controls={`${id}-invite`} onClick={()=>setInviteOpen(!inviteOpen)}>Não está na rede? Convidar</Button>}
    {inviteOpen && !disabled && <div id={`${id}-invite`} className="space-y-2 rounded-md border bg-muted/20 p-3 text-sm">
      <p>Digite o nome acima e compartilhe um convite para a rede. O convite não atribui funções nem participação nesta BIA.</p>
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={generate}>{busy?"Gerando…":invite?"Atualizar convite":"Gerar convite para a rede"}</Button>
      {invite && <><label className="block">Link do convite<Input readOnly value={invite.link} onFocus={e=>e.target.select()}/></label><p className="text-xs text-muted-foreground">{expired?"Convite expirado. Gere novamente.":`Convite individual, válido até ${new Date(invite.expires_at).toLocaleString("pt-BR")}.`}</p><Button type="button" variant="outline" size="sm" disabled={expired || busy} onClick={async()=>{if(new Date(invite.expires_at).getTime()<=Date.now()){setMessage("Convite expirado. Gere novamente.");return;}setMessage(await copyTextToClipboard(formatBuiltInviteMessage(invite.link,invite.expires_at))?"Convite copiado. Compartilhe com a pessoa.":"Não foi possível copiar. Selecione e copie o link acima.");}}>Copiar convite</Button></>}
      {message && <p role="status" className="break-words text-sm">{message}</p>}
    </div>}
  </div>;
}
