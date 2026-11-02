export function financialImportPrompt({today, deterministicLancamentos, categoriaOptions, tipoCppOptions, textContent}: {today:string; deterministicLancamentos:any[]; categoriaOptions:any[]; tipoCppOptions:any[]; textContent:string}) {
  return `Você é um assistente financeiro da BUILT Alliances.
Analise o arquivo e extraia lançamentos financeiros para o fluxo de caixa de uma BIA.
Retorne SOMENTE JSON válido, sem markdown, neste formato:
{"lancamentos":[{"tipo":"entrada|saida","valor":123.45,"data":"YYYY-MM-DD","data_vencimento":"YYYY-MM-DD|null","data_pagamento":"YYYY-MM-DD|null","status":"pendente|agendado|pago|parcial|vencido|cancelado","descricao":"texto curto","categoria_id":123|null,"categoria_nome":"texto|null","tipo_cpp_id":123|null,"tipo_cpp_nome":"texto|null","observacao":"texto curto|null"}],"observacao":"texto curto"}

Regras:
- Crie um lançamento para cada linha, parcela, nota, boleto, recibo ou item financeiro claro.
- Em arquivos de amortização, boleto parcelado, simulação, carnê ou cronograma, cada linha/parcela é um lançamento separado.
- Todo lançamento parcelado deve ter número da parcela na descrição, por exemplo "Parcela 15/49".
- Toda linha com parcela deve preencher data_vencimento com a data de vencimento/amortização da própria linha.
- Quando houver coluna ou texto de status, identifique se está pago, quitado, baixado, liquidado, realizado, agendado/programado ou pendente.
- Se o arquivo for apenas cronograma futuro/simulação sem indicação de pagamento, use status "agendado" para parcelas futuras e "vencido" para parcelas passadas.
- Valor sempre positivo, com até 2 casas decimais. Use tipo "saida" para despesa/pagamento/custo e "entrada" para receita/aporte/reembolso recebido.
- Se o documento tiver valor negativo, converta para valor positivo e ajuste o tipo.
- "data" deve ser a data da parcela/vencimento quando o arquivo for cronograma de parcelas; se não existir, use "${today}".
- "data_vencimento" é a data de vencimento; se não existir, null.
- "data_pagamento" só deve existir quando o arquivo indicar pagamento realizado.
- Se já está pago/quitado/baixado/realizado, status "pago"; se vencimento é futuro e não pago, "pendente" ou "agendado"; se vencimento anterior a ${today} e não pago, "vencido".
- Preencha sempre descricao com um resumo útil e curto do fato: produto/serviço ou finalidade e fornecedor quando constarem no arquivo. Não use apenas "compra", "pagamento", códigos ou o nome do arquivo. Preserve o número da parcela. Não invente fornecedor ou finalidade.
- Sugira categoria_id e categoria_nome a partir da natureza da operação, usando SOMENTE as categorias disponíveis abaixo. Considere nome, descrição e tipo da categoria; não classifique pela modalidade de pagamento (Pix/boleto). Copie o ID e o nome exatos da categoria escolhida.
- Exemplo: alimentos de uma confeitaria não são condomínio, IPTU ou seguros. Se não existir categoria compatível, retorne null e explique brevemente em observacao que é necessário escolher uma categoria.
- Preencha descricao e categoria também para cada parcela da pré-leitura determinística, preservando seu valor, datas e número. Não deixe a classificação apenas na observação geral.
- Use tipo_cpp_id somente quando houver correspondência clara na lista; caso contrário null.
- Limite máximo: 80 lançamentos.

Pré-leitura determinística de parcelas encontrada no arquivo.
Use estes itens como base quando fizerem sentido; não descarte parcelas claras com data e valor:
${JSON.stringify(deterministicLancamentos)}

Categorias disponíveis:
${JSON.stringify(categoriaOptions)}

Tipos CPP disponíveis:
${JSON.stringify(tipoCppOptions)}

ARQUIVO:
${textContent}`;
}
