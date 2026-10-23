import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { transformSync } from "esbuild";
import { propertyLaunchForm, propertyLaunchRequest } from "../lib/carteira-launch-form";

test("formulário real de edição preenche, cancela sem escrita, salva uma vez e conserva erro para retentar", async () => {
  const source = readFileSync(new URL("./carteira.tsx", import.meta.url), "utf8");
  const code = transformSync(source.slice(source.indexOf("function NewLaunchDialog"), source.indexOf("function DemandInterestsManager")), { loader: "tsx", jsx: "transform", jsxFactory: "React.createElement" }).code;
  const mutations: any[] = [], requests: any[] = [], changes: any[] = [], toasts: any[] = [];
  let saved = 0, fail = false;
  const primitives = Object.fromEntries(["Dialog", "DialogContent", "DialogHeader", "DialogTitle", "DialogFooter", "Button", "Label", "Input", "Textarea", "Select", "SelectTrigger", "SelectValue", "SelectContent", "SelectItem", "Sparkles", "Paperclip", "Mic", "Loader2", "Trash2"].map((name) => [name, name]));
  const scope = {
    ...primitives, React, propertyLaunchForm, propertyLaunchRequest,
    useToast: () => ({ toast: (item: any) => toasts.push(item) }),
    useState: (initial: any) => [typeof initial === "function" ? initial() : initial, () => {}],
    useEffect: () => {},
    useMutation: (config: any) => {
      const mutation = { isPending: false, mutate: async () => {
        mutation.isPending = true;
        try { const result = await config.mutationFn(); config.onSuccess?.(result); }
        catch (error) { config.onError?.(error); }
        finally { mutation.isPending = false; }
      } };
      mutations.push(mutation); return mutation;
    },
    apiRequest: async (...args: any[]) => { requests.push(args); if (fail) throw new Error("Falha de teste"); return { json: async () => ({}) }; },
  };
  const component = new Function(...Object.keys(scope), `${code}; return NewLaunchDialog;`)(...Object.values(scope));
  const tree = component({ open: true, imovelId: "property", launch: { id: "entry", tipo: "despesa", categoria: "Condomínio", valor: 699.99, data: "2026-10-16", descricao: "Condomínio", status: "pago" }, onOpenChange: (open: boolean) => changes.push(open), onSaved: () => saved++ });
  const nodes: any[] = [];
  function walk(node: any) { if (!node || typeof node !== "object") return; if (Array.isArray(node)) { node.forEach(walk); return; } nodes.push(node); walk(node.props?.children); }
  walk(tree);
  assert.equal(nodes.find((n) => n.type === "DialogTitle").props.children, "Editar lançamento");
  assert.equal(nodes.find((n) => n.props.id === "launch-value").props.value, "699,99");
  assert.equal(nodes.some((n) => n.type === "Sparkles"), false);
  const cancel = nodes.find((n) => n.type === "Button" && n.props.children === "Cancelar");
  cancel.props.onClick(); assert.deepEqual(changes, [false]); assert.equal(requests.length, 0);
  changes.length = 0; mutations[0].isPending = true;
  cancel.props.onClick(); assert.equal(changes.length, 0); mutations[0].isPending = false;
  const save = nodes.find((n) => n.type === "Button" && Array.isArray(n.props.children) && n.props.children.includes("Salvar alterações"));
  fail = true; await save.props.onClick();
  assert.equal(saved, 0); assert.equal(changes.length, 0); assert.equal(toasts.length, 1);
  fail = false; await save.props.onClick();
  assert.equal(saved, 1); assert.deepEqual(changes, [false]);
  assert.equal(requests[1][0], "PATCH"); assert.equal(requests[1][1], "/api/carteira/lancamentos/entry");
  assert.equal(requests[1][2].valor, 699.99);
});

test("edição abre o lançamento selecionado, separa importação e revalida os consumidores", () => {
  const source = readFileSync(new URL("./carteira.tsx", import.meta.url), "utf8");
  assert.match(source, /canCollaborate && <div[^]*?aria-label=\{`Editar lançamento/);
  assert.match(source, /setEditingLaunch\(item\); setLaunchOpen\(true\)/);
  assert.match(source, /setEditingLaunch\(null\); setLaunchOpen\(true\)/);
  assert.match(source, /launch=\{editingLaunch\}/);
  assert.match(source, /propertyLaunchRequest\(form, imovelId, launch\?\.id\)/);
  assert.match(source, /!launch && <section/);
  assert.match(source, /launch \? "Salvar alterações" : "Salvar"/);
  const invalidation = source.slice(source.indexOf("  function invalidateAll()"), source.indexOf("  const editMutation ="));
  for (const key of ["/api/carteira/resumo", "/api/carteira/imoveis", "/api/carteira/lancamentos", "/api/agenda"]) assert.ok(invalidation.includes(key));
  const close = source.slice(source.indexOf("  const close = () =>"), source.indexOf("  const mutation =", source.indexOf("function NewLaunchDialog")));
  assert.doesNotMatch(close, /apiRequest|\.mutate\(/);
});

test("modal base permanece rolável na altura do celular", () => {
  const source = readFileSync(new URL("../components/ui/dialog.tsx", import.meta.url), "utf8");
  assert.match(source, /max-h-\[calc\(100dvh-2rem\)\]/);
  assert.match(source, /overflow-y-auto/);
});

test("rodapé do cadastro assistido acompanha o tema e respeita a área segura", () => {
  const source = readFileSync(new URL("./carteira-assistente.tsx", import.meta.url), "utf8");
  const footer = source.match(/<footer className="([^"]+)">/)?.[1] ?? "";
  assert.match(footer, /bg-background\/95/);
  assert.match(footer, /border-border\/60/);
  assert.match(footer, /env\(safe-area-inset-bottom\)/);
  assert.doesNotMatch(footer, /bg-white/);
});

test("lançamento do imóvel oferece leitura por IA antes do formulário manual", () => {
  const source = readFileSync(new URL("./carteira.tsx", import.meta.url), "utf8");
  const dialog = source.slice(source.indexOf("function NewLaunchDialog"), source.indexOf("function DemandInterestsManager"));
  assert.ok(dialog.indexOf("Leitura com IA") > -1);
  assert.ok(dialog.indexOf("Leitura com IA") < dialog.lastIndexOf("ou preencha manualmente"));
  assert.match(dialog, /Confirmar sugestões/);
});

test("excluir sugestão remove somente a linha selecionada, sem gravar ou excluir registros oficiais", () => {
  const source = readFileSync(new URL("./carteira.tsx", import.meta.url), "utf8");
  const dialog = source.slice(source.indexOf("function NewLaunchDialog"), source.indexOf("function DemandInterestsManager"));
  const button = dialog.match(/<Button[^>]*aria-label=\{`Excluir lançamento[^\n]+/u)?.[0];
  assert.ok(button);
  assert.match(button, /disabled=\{suggestionsMutation\.isPending\}/);
  const handler = button.match(/onClick=\{\(\) => (setSuggestions\(.+\))\}/)?.[1];
  assert.ok(handler);
  const remove = new Function("setSuggestions", "index", handler);
  const repeated = { descricao: "Despesa repetida", valor: 100 };
  const other = { descricao: "Outra despesa", valor: 200 };
  const original = [repeated, repeated, other];
  let remaining = original;
  const setSuggestions = (update: (current: typeof original) => typeof original) => { remaining = update(remaining); };
  remove(setSuggestions, 1);
  assert.deepEqual(remaining, [repeated, other]);
  assert.equal(original.length, 3);
  remove(setSuggestions, 0);
  assert.deepEqual(remaining, [other]);
  remove(setSuggestions, 0);
  assert.deepEqual(remaining, []);
  assert.match(dialog, /suggestions\.length > 0 &&/);
  assert.match(dialog, /Promise\.all\(suggestions\.map/);
});
