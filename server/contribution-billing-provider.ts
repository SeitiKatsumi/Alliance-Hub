import { AsaasTransport, AsaasError } from "./asaas/client";
import { asaasConfig } from "./asaas/config";
import { AsaasStore, type AsaasDatabase } from "./asaas/store";
import { credentialVaultReady, decryptCredential } from "./asaas/credentials";
import { cents, providerPaymentState, safeAsaasUrl } from "../shared/contribution-billing";

export function contributionBillingEnabled(env=process.env) {
  const c=asaasConfig(env);
  return c.configurationValid && c.enabled && c.baasEnabled && c.chargesEnabled && c.productionOperationsEnabled
    && !!c.apiKey && !!c.webhookToken && !!c.webhookUrl && credentialVaultReady(c.credentialEncryptionKey);
}
export async function accountTransport(account:any, db?:AsaasDatabase, env=process.env, fetcher:typeof fetch=fetch) {
  if(!contributionBillingEnabled(env))throw new AsaasError("BILLING_DISABLED","Cobranças aguardam homologação",503);
  if(!account || account.state!=="approved" || !["company","bia"].includes(account.ownership) || !account.external_account_id || !account.owner_id)throw new AsaasError("ACCOUNT_PENDING","Conta recebedora da empresa não habilitada",503);
  const ref=String(account.credential_reference||"");
  let apiKey="";
  if(ref==="database:aes-256-gcm:v1") {
    if(!db)throw new AsaasError("ACCOUNT_CREDENTIAL_PENDING","Cofre da conta recebedora indisponível",503);
    const config=asaasConfig(env), encrypted=await new AsaasStore(db,config.environment).accountCredential(String(account.id));
    if(encrypted)apiKey=decryptCredential(encrypted,config.credentialEncryptionKey);
  } else if(/^ASAAS_(?:SANDBOX|PRODUCTION)_ACCOUNT_[A-Z0-9_]+$/.test(ref) && env[ref]) apiKey=env[ref]!.trim();
  if(!apiKey)throw new AsaasError("ACCOUNT_CREDENTIAL_PENDING","Credencial própria da conta recebedora não configurada",503);
  return new AsaasTransport({...asaasConfig(env),apiKey},fetcher);
}
export class ContributionProvider {
  constructor(private transport:AsaasTransport) {}
  async verifyAccount(account:any) {
    const wallets:any=await this.transport.request("/wallets");
    const status:any=await this.transport.request("/myAccount/status");
    if(!account.wallet_id || !Array.isArray(wallets.data) || !wallets.data.some((w:any)=>w.id===account.wallet_id) || status.general!=="APPROVED")throw new AsaasError("ACCOUNT_MISMATCH","Credencial ou situação da conta recebedora divergente",503);
  }
  private async listed(path:string,reference:string) {
    const result:any=await this.transport.request(`${path}?externalReference=${encodeURIComponent(reference)}&limit=100`);
    if(!Array.isArray(result.data))throw new Error("INVALID_PROVIDER_RESPONSE");
    const items=result.data.filter((r:any)=>r.externalReference===reference);
    if(items.length>1 || result.hasMore===true)throw new Error("DUPLICATE_PROVIDER_REFERENCE");
    return items[0]||null;
  }
  findPayment(reference:string){return this.listed("/payments",reference);}
  findCustomer(reference:string){return this.listed("/customers",reference);}
  async customer(payer:any,reference:string) {
    const document=String(payer.cpf || payer.cnpj || "").replace(/\D/g,"");
    if(!payer.nome || ![11,14].includes(document.length))throw new AsaasError("PAYER_PENDING","Complete nome e CPF/CNPJ do pagador",422);
    const c:any=await this.transport.request("/customers",{method:"POST",body:{name:payer.nome,cpfCnpj:document,email:payer.email||undefined,externalReference:reference,notificationDisabled:true}});
    if(typeof c.id!=="string")throw new Error("INVALID_CUSTOMER_RESPONSE");
    return c;
  }
  async muteCustomer(id:string) {await this.transport.request(`/customers/${id}`,{method:"PUT",body:{notificationDisabled:true}});}
  create(customer:string, reference:string, amount:number,dueDate:string,billingType:string) {return this.transport.request("/payments",{method:"POST",body:{customer,externalReference:reference,value:amount/100,dueDate,billingType,description:"Integralização de aporte BUILT"}});}
  read(id:string){return this.transport.request(`/payments/${id}`);}
  update(id:string,amount:number){return this.transport.request(`/payments/${id}`,{method:"PUT",body:{value:amount/100}});}
  async snapshot(payment:any,expectedReference:string,customerId?:string) {
    if(typeof payment.id!=="string" || payment.externalReference!==expectedReference || (customerId && payment.customer!==customerId))throw new Error("PAYMENT_LINK_MISMATCH");
    const amount=cents(payment.value), state=payment.deleted?"cancelled":providerPaymentState(payment.status);
    const details:any={invoiceUrl:safeAsaasUrl(payment.invoiceUrl),bankSlipUrl:safeAsaasUrl(payment.bankSlipUrl)};
    if(["open","overdue"].includes(state)) {
      if(payment.billingType==="PIX") {
        const qr:any=await this.transport.request(`/payments/${payment.id}/pixQrCode`);
        if(typeof qr.payload==="string" && typeof qr.encodedImage==="string" && /^[A-Za-z0-9+/=]+$/.test(qr.encodedImage) && qr.encodedImage.length<200000) {
          details.pix=qr.payload;details.qrImage=qr.encodedImage;details.expiresAt=qr.expirationDate;
        }
      } else if(payment.billingType==="BOLETO") {
        const code:any=await this.transport.request(`/payments/${payment.id}/identificationField`);
        if(typeof code.identificationField==="string")details.barcode=code.identificationField;
        // Some boleto accounts also offer a Pix QR. Absence must not fabricate or invalidate a boleto.
        try {
          const qr:any=await this.transport.request(`/payments/${payment.id}/pixQrCode`);
          if(typeof qr.payload==="string"&&typeof qr.encodedImage==="string"&&/^[A-Za-z0-9+/=]+$/.test(qr.encodedImage)&&qr.encodedImage.length<200000){details.pix=qr.payload;details.qrImage=qr.encodedImage;details.expiresAt=qr.expirationDate;}
        }catch{details.pixUnavailable=true;}
      }
    }
    return {externalId:payment.id,amount,state,dueDate:String(payment.dueDate).slice(0,10),paidAt:payment.paymentDate||payment.confirmedDate||null,details};
  }
}
