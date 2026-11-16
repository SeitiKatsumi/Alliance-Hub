import type { PlannedPayment } from "./bia-payment-plan";

export type OfferQuota = {id:string;numero:number;quantidade:number;tipo:"guardiao"|"multiplicador";pagamentos:PlannedPayment[]};
export type BiaOffer = {
  titulo:string; descricao:string; localizacao:string; imagem:string|null;
  moeda:string; totalQuotas:number; valorOrigem:number; correcao:string;
  quotas:OfferQuota[]; documentos:Array<{id:string;titulo:string;url:string}>;
};
export type BiaOfferView = {oferta:BiaOffer; revisao:number; assinatura:string; validade:string|null; aquisicaoCotas?:boolean};
