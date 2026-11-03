/** Optional declared identifier; format normalization does not verify registration or ownership. */
export function normalizePropertyCib(value:unknown):string {
  if(value==null||value==='') return '';
  if(typeof value!=='string') throw Object.assign(new Error('Informe o CIB como texto ou deixe o campo em branco.'),{status:400});
  const compact=value.trim().toUpperCase().replace(/[.\s-]/g,'');
  if(!compact) return '';
  if(!/^[A-Z0-9]{8}$/.test(compact)) throw Object.assign(new Error('Informe os 8 caracteres do CIB ou deixe o campo em branco. Ex.: ABC1234-5.'),{status:400});
  return `${compact.slice(0,7)}-${compact.slice(7)}`;
}
