import { useState, type Dispatch, type SetStateAction } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
export const EMPTY_BIA_INFO = {
    razao_social: "",
    cnpj: "",
    nome_fantasia: "",
    inscricao_estadual: "",
    banco: "",
    agencia: "",
    conta: "",
    tipo_conta: "",
    titular_conta: "",
    chave_pix: "",
    ativo_endereco: "",
    ativo_bairro: "",
    ativo_cidade: "",
    ativo_estado: "",
    ativo_pais: "",
    ativo_qualificacao: "",
    ativo_descricao_adicional: "",
    ativo_area_m2: "",
    ativo_numero: "",
    ativo_complemento: "",
    ativo_cep: "",
    ativo_numero_matricula: "",
    ativo_livro: "",
    ativo_folha: "",
    ativo_cartorio: "",
    ativo_comarca: "",
  };
export type BiaInfoForm = typeof EMPTY_BIA_INFO;
export function BiaInformationFields({infoForm,setInfoForm,active=false,requireAsset=true}:{infoForm:BiaInfoForm;setInfoForm:Dispatch<SetStateAction<BiaInfoForm>>;active?:boolean;requireAsset?:boolean}) {
const [ativoCepLoading,setAtivoCepLoading]=useState(false);
  const handleAtivoCepChange = async (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 8);
    setInfoForm(current => ({ ...current, ativo_cep: digits }));
    if (digits.length !== 8) return;

    setAtivoCepLoading(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await response.json().catch(() => null);
      if (!response.ok || !data || data.erro) return;
      setInfoForm(current => ({
        ...current,
        ativo_cep: digits,
        ativo_endereco: data.logradouro || current.ativo_endereco,
        ativo_bairro: data.bairro || current.ativo_bairro,
        ativo_cidade: data.localidade || current.ativo_cidade,
        ativo_estado: data.uf || current.ativo_estado,
        ativo_pais: current.ativo_pais || "Brasil",
      }));
    } catch (error) {
      console.warn("[bia] Nao foi possivel buscar o CEP do ativo", error);
    } finally {
      setAtivoCepLoading(false);
    }
  };


 return <div className="space-y-6">
              {active && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                  BIA com situação <strong>Ativa</strong>: preencha os campos obrigatórios marcados com *.
                </p>
              )}

              <div className="space-y-3">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Informações do Ativo</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">
                      Qualificação {requireAsset && <span className="text-destructive">*</span>}
                    </label>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={infoForm.ativo_qualificacao}
                      onChange={e => setInfoForm({ ...infoForm, ativo_qualificacao: e.target.value })}
                      placeholder="Casa, galpão, apartamento..."
                      data-testid="input-ativo-qualificacao"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">
                      Área (m²) {requireAsset && <span className="text-destructive">*</span>}
                    </label>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={infoForm.ativo_area_m2}
                      onChange={e => setInfoForm({ ...infoForm, ativo_area_m2: e.target.value })}
                      placeholder="Ex: 120,50"
                      data-testid="input-ativo-area-m2"
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-sm font-medium text-foreground">Descrição adicional</label>
                    <Textarea
                      rows={2}
                      className="text-sm resize-none"
                      value={infoForm.ativo_descricao_adicional}
                      onChange={e => setInfoForm({ ...infoForm, ativo_descricao_adicional: e.target.value })}
                      placeholder="Informação complementar do ativo, se houver"
                      data-testid="input-ativo-descricao-adicional"
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-sm font-medium text-foreground">
                      CEP {requireAsset && <span className="text-destructive">*</span>}
                    </label>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={infoForm.ativo_cep}
                      onChange={e => handleAtivoCepChange(e.target.value)}
                      placeholder="00000-000"
                      inputMode="numeric"
                      data-testid="input-ativo-cep"
                    />
                    {ativoCepLoading && <p className="text-xs text-muted-foreground">Buscando CEP...</p>}
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-sm font-medium text-foreground">
                      Endereço {requireAsset && <span className="text-destructive">*</span>}
                    </label>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={infoForm.ativo_endereco}
                      onChange={e => setInfoForm({ ...infoForm, ativo_endereco: e.target.value })}
                      placeholder="Rua, avenida, estrada..."
                      data-testid="input-ativo-endereco"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">
                      Nº {requireAsset && <span className="text-destructive">*</span>}
                    </label>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={infoForm.ativo_numero}
                      onChange={e => setInfoForm({ ...infoForm, ativo_numero: e.target.value })}
                      placeholder="Número"
                      data-testid="input-ativo-numero"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">
                      Complemento {requireAsset && <span className="text-destructive">*</span>}
                    </label>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={infoForm.ativo_complemento}
                      onChange={e => setInfoForm({ ...infoForm, ativo_complemento: e.target.value })}
                      placeholder="Bloco, unidade, sala..."
                      data-testid="input-ativo-complemento"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">
                      Bairro {requireAsset && <span className="text-destructive">*</span>}
                    </label>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={infoForm.ativo_bairro}
                      onChange={e => setInfoForm({ ...infoForm, ativo_bairro: e.target.value })}
                      placeholder="Bairro"
                      data-testid="input-ativo-bairro"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">
                      Cidade {requireAsset && <span className="text-destructive">*</span>}
                    </label>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={infoForm.ativo_cidade}
                      onChange={e => setInfoForm({ ...infoForm, ativo_cidade: e.target.value })}
                      placeholder="Cidade"
                      data-testid="input-ativo-cidade"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">
                      Estado {requireAsset && <span className="text-destructive">*</span>}
                    </label>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={infoForm.ativo_estado}
                      onChange={e => setInfoForm({ ...infoForm, ativo_estado: e.target.value })}
                      placeholder="UF"
                      data-testid="input-ativo-estado"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">
                      País {requireAsset && <span className="text-destructive">*</span>}
                    </label>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={infoForm.ativo_pais}
                      onChange={e => setInfoForm({ ...infoForm, ativo_pais: e.target.value })}
                      placeholder="País"
                      data-testid="input-ativo-pais"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">
                      Número da matrícula {requireAsset && <span className="text-destructive">*</span>}
                    </label>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={infoForm.ativo_numero_matricula}
                      onChange={e => setInfoForm({ ...infoForm, ativo_numero_matricula: e.target.value })}
                      placeholder="Número da matrícula"
                      data-testid="input-ativo-numero-matricula"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">
                      Livro {requireAsset && <span className="text-destructive">*</span>}
                    </label>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={infoForm.ativo_livro}
                      onChange={e => setInfoForm({ ...infoForm, ativo_livro: e.target.value })}
                      placeholder="Livro"
                      data-testid="input-ativo-livro"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">
                      Folha {requireAsset && <span className="text-destructive">*</span>}
                    </label>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={infoForm.ativo_folha}
                      onChange={e => setInfoForm({ ...infoForm, ativo_folha: e.target.value })}
                      placeholder="Folha"
                      data-testid="input-ativo-folha"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">
                      Cartório {requireAsset && <span className="text-destructive">*</span>}
                    </label>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={infoForm.ativo_cartorio}
                      onChange={e => setInfoForm({ ...infoForm, ativo_cartorio: e.target.value })}
                      placeholder="Cartório de registro"
                      data-testid="input-ativo-cartorio"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">
                      Comarca {requireAsset && <span className="text-destructive">*</span>}
                    </label>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={infoForm.ativo_comarca}
                      onChange={e => setInfoForm({ ...infoForm, ativo_comarca: e.target.value })}
                      placeholder="Comarca do registro"
                      data-testid="input-ativo-comarca"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Dados Comerciais</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">
                      Razão social/Nome {active && <span className="text-destructive">*</span>}
                    </label>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={infoForm.razao_social}
                      onChange={e => setInfoForm({ ...infoForm, razao_social: e.target.value })}
                      placeholder="Razão social ou nome"
                      data-testid="input-razao-social"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">
                      CNPJ/CPF {active && <span className="text-destructive">*</span>}
                    </label>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={infoForm.cnpj}
                      onChange={e => setInfoForm({ ...infoForm, cnpj: e.target.value })}
                      placeholder="00.000.000/0000-00 ou 000.000.000-00"
                      data-testid="input-cnpj-comercial"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">Nome Fantasia</label>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={infoForm.nome_fantasia}
                      onChange={e => setInfoForm({ ...infoForm, nome_fantasia: e.target.value })}
                      placeholder="Nome fantasia"
                      data-testid="input-nome-fantasia"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">Inscrição Estadual</label>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={infoForm.inscricao_estadual}
                      onChange={e => setInfoForm({ ...infoForm, inscricao_estadual: e.target.value })}
                      placeholder="Inscrição estadual"
                      data-testid="input-inscricao-estadual"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Conta Bancária</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">
                      Banco {active && <span className="text-destructive">*</span>}
                    </label>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={infoForm.banco}
                      onChange={e => setInfoForm({ ...infoForm, banco: e.target.value })}
                      placeholder="Nome do banco"
                      data-testid="input-banco"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">Agência</label>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={infoForm.agencia}
                      onChange={e => setInfoForm({ ...infoForm, agencia: e.target.value })}
                      placeholder="0000"
                      data-testid="input-agencia"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">
                      Conta {active && <span className="text-destructive">*</span>}
                    </label>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={infoForm.conta}
                      onChange={e => setInfoForm({ ...infoForm, conta: e.target.value })}
                      placeholder="00000-0"
                      data-testid="input-conta"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">Tipo de Conta</label>
                    <select
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={infoForm.tipo_conta}
                      onChange={e => setInfoForm({ ...infoForm, tipo_conta: e.target.value })}
                      data-testid="select-tipo-conta"
                    >
                      <option value="">Selecione...</option>
                      <option value="corrente">Conta Corrente</option>
                      <option value="poupanca">Conta Poupança</option>
                      <option value="pagamento">Conta de Pagamento</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-sm font-medium text-foreground">
                      Titular da Conta {active && <span className="text-destructive">*</span>}
                    </label>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={infoForm.titular_conta}
                      onChange={e => setInfoForm({ ...infoForm, titular_conta: e.target.value })}
                      placeholder="Nome completo do titular"
                      data-testid="input-titular-conta"
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-sm font-medium text-foreground">Chave PIX</label>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={infoForm.chave_pix}
                      onChange={e => setInfoForm({ ...infoForm, chave_pix: e.target.value })}
                      placeholder="CPF, CNPJ, email ou chave aleatória"
                      data-testid="input-chave-pix"
                    />
                  </div>
                </div>
              </div>
            </div>;
}
