import { randomUUID } from 'node:crypto';

// Internal repository only. Never mount this protocol as an unauthenticated API.
// Route/domain authorization stays in the existing callers, including MAP locks.
export interface Queryable { query(sql: string, params?: any[]): Promise<{rows: any[]}> }
export type Column = {table_name:string;column_name:string;udt_name:string;column_default?:string|null;data_type?:string;is_nullable?:string;character_maximum_length?:number|null};
export type Relation = {many_collection:string;many_field:string;one_collection:string;one_field:string|null;junction_field:string|null;one_deselect_action?:string};
export type Catalog = {columns:Column[]; primaryKeys:{table_name:string;column_name:string}[];relations:Relation[];fields:any[]};
export const NATIVE_COLLECTIONS = new Set([
  'cadastro_geral','cadastro_geral_especialidades','cadastro_geral_especialidades_1','especialidades',
  'Comunidade','comunidade_membros','comunidade_bias','bias_projetos','bias_nucleos_aliancas',
  'bias_projetos_cadastro_geral','bias_projetos_participantes','bias_projetos_files','bias_projetos_tipos_oportunidades',
  'fluxo_caixa','fluxo_caixa_categorias','fluxo_caixa_favorecidos','fluxo_caixa_files','fluxo_caixa_tipos_cpp',
  'Categorias','Tipos_CPP','funcoes_aliancas','funil_de_conversao','selos','tipos_oportunidades',
  'tipos_oportunidades_anexos','tipos_oportunidades_especialidades','tipos_oportunidades_files',
  'tipos_oportunidades_files_1','tipos_oportunidades_files_2','tipos_oportunidades_imagens',
  'estudos_viabilidade','land_bank_assets','nucleo_tecnico_docs','directus_files',
]);
export class NativeDataError extends Error {
  constructor(public status:number, message:string, public code='INVALID_PAYLOAD') { super(message); }
}
const invalid = (message:string):never => { throw new NativeDataError(400,message); };
export const ident = (name:string) => '"'+name.replace(/"/g,'""')+'"';
const table = (name:string) => `built_legacy.${ident(name)}`;
const obj = (v:any):v is Record<string,any> => v !== null && typeof v==='object' && !Array.isArray(v);
const forbiddenKey = (s:string) => ['__proto__','prototype','constructor'].includes(s);

export function parseNativeQuery(params:URLSearchParams) {
  const filter:Record<string,any> = Object.create(null);
  for(const [key,value] of params) {
    if(key==='filter') {
      let parsed:any; try { parsed=JSON.parse(value); } catch { invalid('Filtro inválido.'); }
      if(!obj(parsed)) invalid('Filtro inválido.');
      for(const [k,v] of Object.entries(parsed)) {if(forbiddenKey(k))invalid('Filtro inválido.');filter[k]=v;}
    } else if(key.startsWith('filter[')) {
      const parts=[...key.matchAll(/\[([^\]]+)\]/g)].map(m=>m[1]);
      if(!parts.length||parts.length>12||parts.some(forbiddenKey)||`filter${parts.map(p=>'['+p+']').join('')}`!==key)invalid('Filtro inválido.');
      let current=filter;
      parts.forEach((p,i)=>{ if(i===parts.length-1)current[p]=value;else {current[p]??=Object.create(null);if(!obj(current[p]))invalid('Filtro conflitante.');current=current[p];} });
    } else if(!['fields','sort','limit','offset','page','meta'].includes(key)) invalid(`Consulta não suportada: ${key}`);
  }
  const last=(key:string,fallback:string)=>params.getAll(key).at(-1)??fallback;
  const limit=Number(last('limit','100')); const offset=Number(last('offset','0'));
  const page=Number(last('page','1'));
  if(!Number.isInteger(limit)||limit < -1||limit>100000||!Number.isInteger(offset)||offset<0||!Number.isInteger(page)||page<1)invalid('Paginação inválida.');
  return {filter, fields:last('fields','*'),sort:last('sort',''),limit,offset:offset+(page-1)*Math.max(0,limit)};
}

export class NativeDataStore {
  constructor(readonly db:Queryable, readonly catalog:Catalog) {}
  collection(name:string) {
    if(!NATIVE_COLLECTIONS.has(name)||!this.catalog.columns.some(c=>c.table_name===name))throw new NativeDataError(404,'Coleção indisponível.','NOT_FOUND');
    return name;
  }
  columns(name:string) {this.collection(name);return this.catalog.columns.filter(c=>c.table_name===name);}
  primary(name:string) {this.collection(name);const p=this.catalog.primaryKeys.filter(c=>c.table_name===name);if(p.length!==1)invalid('Chave não suportada.');return p[0].column_name;}
  column(name:string,field:string):Column {const col=this.columns(name).find(c=>c.column_name===field);if(!col)return invalid(`Campo indisponível: ${field}`);return col;}
  relation(name:string,field:string) {
    const direct=this.catalog.relations.find(r=>r.many_collection===name&&r.many_field===field&&NATIVE_COLLECTIONS.has(r.one_collection));
    if(direct)return {definition:direct,target:direct.one_collection,many:false,local:direct.many_field,foreign:this.primary(direct.one_collection)};
    const inverse=this.catalog.relations.find(r=>r.one_collection===name&&r.one_field===field&&NATIVE_COLLECTIONS.has(r.many_collection));
    if(inverse)return {definition:inverse,target:inverse.many_collection,many:true,local:this.primary(name),foreign:inverse.many_field};
    return null;
  }
  private where(name:string, filter:any, values:any[], alias='t', depth=0):string {
    if(depth>8||!obj(filter))invalid('Filtro inválido.');
    const bind=(v:any)=>{values.push(v);return '$'+values.length;};
    const pieces=Object.entries(filter).map(([key,value]):string=>{
      if(key==='_and'||key==='_or') {
        const children=Array.isArray(value)?value:obj(value)?Object.values(value):invalid('Filtro inválido.');
        if(!children.length)return key==='_and'?'TRUE':'FALSE';
        return '('+children.map(v=>this.where(name,v,values,alias,depth+1)).join(key==='_and'?' AND ':' OR ')+')';
      }
      const rel=this.relation(name,key);
      if(rel&&obj(value)&&Object.keys(value).some(k=>!k.startsWith('_'))) {
        const next='r'+depth+'_'+values.length;
        return `EXISTS (SELECT 1 FROM ${table(rel.target)} ${ident(next)} WHERE ${ident(next)}.${ident(rel.foreign)} = ${ident(alias)}.${ident(rel.local)} AND ${this.where(rel.target,value,values,next,depth+1)})`;
      }
      this.column(name,key);
      const lhs=`${ident(alias)}.${ident(key)}`;
      if(!obj(value))invalid('Operador de filtro ausente.');
      return '('+Object.entries(value as Record<string,any>).map(([operator,v])=>{
        if(operator==='_null'||operator==='_nnull')return `${lhs} IS ${(String(v)==='true')===(operator==='_null')?'':'NOT '}NULL`;
        if(operator==='_eq'||operator==='_neq')return v===null?`${lhs} IS ${operator==='_neq'?'NOT ':''}NULL`:`${lhs} ${operator==='_eq'?'=':'<>'} ${bind(v)}`;
        if(operator==='_in'||operator==='_nin') {const list=Array.isArray(v)?v:String(v).split(',');if(!list.length)return operator==='_in'?'FALSE':'TRUE';if(list.length>10000)invalid('Filtro muito grande.');return `${lhs} ${operator==='_nin'?'NOT ':''}IN (${list.map(bind).join(',')})`;}
        if(operator==='_contains'||operator==='_icontains')return `${lhs}::text ${operator==='_icontains'?'ILIKE':'LIKE'} ${bind('%'+String(v).replace(/[\\%_]/g,'\\$&')+'%')}`;
        const ops:Record<string,string>={_gt:'>',_gte:'>=',_lt:'<',_lte:'<='};
        if(ops[operator])return `${lhs} ${ops[operator]} ${bind(v)}`;
        return invalid('Operador de filtro não suportado.');
      }).join(' AND ')+')';
    });
    return pieces.join(' AND ')||'TRUE';
  }
  async read(name:string, query:ReturnType<typeof parseNativeQuery>, depth=0):Promise<any[]> {
    this.collection(name);if(depth>6)invalid('Expansão muito profunda.');
    const values:any[]=[];const where=this.where(name,query.filter,values);
    const sort=query.sort?query.sort.split(',').map(field=>{const desc=field.startsWith('-');const f=desc?field.slice(1):field;this.column(name,f);return ident(f)+(desc?' DESC':' ASC');}).join(','):ident(this.primary(name));
    const rows=(await this.db.query(`SELECT * FROM ${table(name)} t WHERE ${where} ORDER BY ${sort}${query.limit<0?'':` LIMIT ${query.limit}`} OFFSET ${query.offset}`,values)).rows;
    return this.project(name,rows,query.fields,depth);
  }
  async project(name:string, rows:any[], fields:string, depth=0):Promise<any[]> {
    const selections=new Map<string,string[]>();
    for(const path of fields.split(',').filter(Boolean)) {
      const [key,...rest]=path.split('.');
      if(key==='*') {
        for(const c of this.columns(name)) selections.set(c.column_name,rest);
        for(const r of this.catalog.relations.filter(r=>r.one_collection===name&&r.one_field&&NATIVE_COLLECTIONS.has(r.many_collection)))selections.set(r.one_field!,rest);
      } else {const existing=selections.get(key)||[];selections.set(key,[...existing,...(rest.length?[rest.join('.')]:[])]);}
    }
    const output=rows.map(()=>({} as any));
    for(const [key,nested] of selections) {
      const rel=this.relation(name,key);
      if(rel&&(nested.length||rel.many)) {
        const ids=[...new Set(rows.map(r=>r[rel.local]).filter(v=>v!==null&&v!==undefined))];
        const childFields=nested.length?nested.join(','):this.primary(rel.target);
        // Hydrate in batches from raw child rows; never recursively load implicit aliases.
        const raw=ids.length?(await this.db.query(`SELECT * FROM ${table(rel.target)} WHERE ${ident(rel.foreign)} IN (${ids.map((_,i)=>'$'+(i+1)).join(',')})`,ids)).rows:[];
        if(depth>=6&&nested.length)invalid('Expansão muito profunda.');
        const projected=nested.length?await this.project(rel.target,raw,childFields,depth+1):raw.map(r=>r[this.primary(rel.target)]);
        rows.forEach((r,i)=>{const matches=raw.flatMap((c,j)=>String(c[rel.foreign])===String(r[rel.local])?[projected[j]]:[]);output[i][key]=rel.many?matches:matches[0]??null;});
      } else {
        const col=this.column(name,key);
        const json=this.catalog.fields.find(f=>f.collection===name&&f.field===key)?.special?.includes('cast-json');
        rows.forEach((r,i)=>{let v=r[key];if(v!=null&&json&&typeof v==='string'){try{v=JSON.parse(v);}catch{throw new NativeDataError(500,'Dado JSON legado inválido.');}}
          if(v instanceof Date&&col.udt_name==='date')v=`${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,'0')}-${String(v.getDate()).padStart(2,'0')}`;
          if(v!=null&&['numeric','float4','float8','int2','int4'].includes(col.udt_name))v=Number(v);output[i][key]=v;});
      }
    }
    return output;
  }
  private encode(name:string,key:string,value:any) {
    const col=this.column(name,key);
    const json=this.catalog.fields.find(f=>f.collection===name&&f.field===key)?.special?.includes('cast-json');
    if(value!==null&&(json||['json','jsonb'].includes(col.udt_name)))return JSON.stringify(value);
    if(obj(value)||Array.isArray(value))invalid(`Valor inválido: ${key}`);
    return value;
  }
  async save(name:string,data:any,id?:any,depth=0):Promise<any> {
    if(depth>6||!obj(data))invalid('Gravação inválida.');
    const pk=this.primary(name);const scalar:Record<string,any>={};const nested:Record<string,any>={};
    if(id!==undefined) {
      const existing=await this.db.query(`SELECT ${ident(pk)} FROM ${table(name)} WHERE ${ident(pk)}=$1 FOR UPDATE`,[id]);
      if(!existing.rows.length)throw new NativeDataError(404,'Registro não encontrado.','NOT_FOUND');
    }
    for(const [key,v] of Object.entries(data)) {
      const rel=this.relation(name,key);
      if(rel?.many)nested[key]=v;
      else if(rel&&obj(v))scalar[key]=(await this.save(rel.target,v,v[this.primary(rel.target)],depth+1))[this.primary(rel.target)];
      else scalar[key]=this.encode(name,key,v);
    }
    if(id!==undefined&&scalar[pk]!==undefined&&String(scalar[pk])!==String(id))invalid('Não é permitido alterar o identificador.');
    for(const f of this.catalog.fields.filter(f=>f.collection===name)) {
      if(f.special?.includes('date-updated')||(id===undefined&&f.special?.includes('date-created')))scalar[f.field]=new Date().toISOString();
    }
    if(id===undefined&&!scalar[pk]&&this.column(name,pk).udt_name==='uuid')scalar[pk]=randomUUID();
    const keys=Object.keys(scalar), values=Object.values(scalar);let row:any;
    if(id===undefined)row=(await this.db.query(keys.length?`INSERT INTO ${table(name)} (${keys.map(ident).join(',')}) VALUES (${keys.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING *`:`INSERT INTO ${table(name)} DEFAULT VALUES RETURNING *`,values)).rows[0];
    else if(keys.length)row=(await this.db.query(`UPDATE ${table(name)} SET ${keys.map((k,i)=>ident(k)+'=$'+(i+1)).join(',')} WHERE ${ident(pk)}=$${keys.length+1} RETURNING *`,[...values,id])).rows[0];
    else row=(await this.db.query(`SELECT * FROM ${table(name)} WHERE ${ident(pk)}=$1`,[id])).rows[0];
    for(const [key,value] of Object.entries(nested))await this.saveMany(name,row[pk],key,value,depth+1);
    return row;
  }
  private async saveMany(parent:string,parentId:any,field:string,value:any,depth:number) {
    const rel=this.relation(parent,field)!;const child=rel.target, pk=this.primary(child);
    const current=(await this.db.query(`SELECT * FROM ${table(child)} WHERE ${ident(rel.foreign)}=$1 FOR UPDATE`,[parentId])).rows;
    const replacement=Array.isArray(value);
    if(!replacement&&(!obj(value)||Object.keys(value).some(k=>!['create','update','delete'].includes(k))))invalid('Relação inválida.');
    const items=replacement?value:[...(value.create||[]),...(value.update||[])];
    if(!Array.isArray(items)||items.length>10000)invalid('Relação muito grande.');
    const kept=new Set<string>();
    for(const item of items) {
      const payload=obj(item)?{...item}:{[pk]:item};
      let existingId=payload[pk];
      if(existingId===undefined&&rel.definition.junction_field) {
        const junction=rel.definition.junction_field;
        const target=obj(payload[junction])?payload[junction].id:payload[junction];
        if(target!=null)existingId=current.find(r=>String(r[junction])===String(target))?.[pk];
      }
      if(existingId!==undefined&&!current.some(r=>String(r[pk])===String(existingId)))invalid('Vínculo não pertence ao registro.');
      const saved=await this.save(child,{...payload,[rel.foreign]:parentId},existingId,depth);
      if(!current.some(r=>String(r[pk])===String(saved[pk])))current.push(saved);
      kept.add(String(saved[pk]));
    }
    const remove=replacement?current.filter(r=>!kept.has(String(r[pk]))).map(r=>r[pk]):value.delete||[];
    if(!Array.isArray(remove))invalid('Exclusão de vínculo inválida.');
    for(const id of remove) {
      if(!current.some(r=>String(r[pk])===String(id)))invalid('Vínculo não pertence ao registro.');
      if(rel.definition.one_deselect_action==='delete')await this.remove(child,id);
      else await this.db.query(`UPDATE ${table(child)} SET ${ident(rel.foreign)}=NULL WHERE ${ident(pk)}=$1 AND ${ident(rel.foreign)}=$2`,[id,parentId]);
    }
  }
  async remove(name:string,id:any) {const pk=this.primary(name);await this.db.query(`DELETE FROM ${table(name)} WHERE ${ident(pk)}=$1`,[id]);}
}

export async function loadNativeCatalog(db:Queryable):Promise<Catalog> {
  const columns=(await db.query("SELECT table_name,column_name,udt_name,data_type,column_default,is_nullable,character_maximum_length FROM information_schema.columns WHERE table_schema='built_legacy' ORDER BY ordinal_position")).rows;
  const primaryKeys=(await db.query("SELECT tc.table_name,kcu.column_name FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu USING(constraint_catalog,constraint_schema,constraint_name) WHERE tc.table_schema='built_legacy' AND tc.constraint_type='PRIMARY KEY'")).rows;
  const relations=(await db.query('SELECT many_collection,many_field,one_collection,one_field,junction_field,one_deselect_action FROM built_legacy.directus_relations')).rows;
  const fields=(await db.query('SELECT collection,field,special,interface,options,required,readonly FROM built_legacy.directus_fields')).rows;
  return {columns,primaryKeys,relations,fields};
}
