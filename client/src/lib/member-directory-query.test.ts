import test from "node:test";
import assert from "node:assert/strict";
import { getMemberDirectoryDisplayName, MEMBER_DIRECTORY_QUERY_OPTIONS } from "./member-directory-query";

test("Cadastro Geral revalida a lista ao abrir ou voltar para a tela", () => {
  assert.deepEqual(MEMBER_DIRECTORY_QUERY_OPTIONS, {
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
});

test("Cadastro Geral exibe e pesquisa pelo nome público antes do e-mail de acesso", () => {
  assert.equal(getMemberDirectoryDisplayName({
    nome: "Domingos Batista",
    Nome_de_usuario: "adm1@bnies.com.br",
  }), "Domingos Batista");
});
