import pg from "pg";

const DIRECTUS_URL = "https://app.builtalliances.com";
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN!;
const DATABASE_URL = process.env.DATABASE_URL!;

async function fetchAll(collection: string) {
  const res = await fetch(`${DIRECTUS_URL}/items/${collection}?limit=-1&fields=*`, {
    headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
  });
  const json = await res.json();
  return json.data || [];
}

async function main() {
  console.log("Connecting to PostgreSQL...");
  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();

  try {
    console.log("Fetching data from Directus...");
    const [membrosData, biasData, fluxoData, opasData, categoriasData, tiposCppData] = await Promise.all([
      fetchAll("cadastro_geral"),
      fetchAll("bias_projetos"),
      fetchAll("fluxo_caixa"),
      fetchAll("tipos_oportunidades"),
      fetchAll("Categorias"),
      fetchAll("Tipos_CPP"),
    ]);

    console.log(`Found: ${membrosData.length} membros, ${biasData.length} bias, ${fluxoData.length} fluxo, ${opasData.length} oportunidades, ${categoriasData.length} categorias, ${tiposCppData.length} tipos_cpp`);

    await client.query("BEGIN");

    console.log("Clearing existing data...");
    await client.query("DELETE FROM fluxo_caixa");
    await client.query("DELETE FROM oportunidades");
    await client.query("DELETE FROM bias_projetos");
    await client.query("DELETE FROM membros");
    await client.query("DELETE FROM categorias");
    await client.query("DELETE FROM tipos_cpp");

    console.log("Importing categorias...");
    for (const cat of categoriasData) {
      await client.query(
        `INSERT INTO categorias (id, nome, descricao) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
        [cat.id, cat.Nome_da_categoria || "Sem nome", cat.Descricao_das_categorias || null]
      );
    }
    if (categoriasData.length > 0) {
      const maxId = Math.max(...categoriasData.map((c: any) => c.id));
      await client.query(`SELECT setval('categorias_id_seq', $1, true)`, [maxId]);
    }

    console.log("Importing tipos_cpp...");
    for (const cpp of tiposCppData) {
      await client.query(
        `INSERT INTO tipos_cpp (id, nome, descricao) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
        [cpp.id, cpp.Nome || "Sem nome", cpp.Descricao || null]
      );
    }
    if (tiposCppData.length > 0) {
      const maxId = Math.max(...tiposCppData.map((c: any) => c.id));
      await client.query(`SELECT setval('tipos_cpp_id_seq', $1, true)`, [maxId]);
    }

    console.log("Importing membros (cadastro_geral)...");
    for (const m of membrosData) {
      await client.query(
        `INSERT INTO membros (id, nome, email, telefone, whatsapp, cidade, estado, empresa, cargo) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO NOTHING`,
        [m.id, m.nome, m.email, m.telefone, m.whatsapp, m.cidade, m.estado, m.empresa, m.cargo || m.responsavel_cargo]
      );
    }

    console.log("Importing bias_projetos...");
    for (const b of biasData) {
      await client.query(
        `INSERT INTO bias_projetos (id, nome_bia, objetivo_alianca, observacoes, localizacao,
         autor_bia, aliado_built, diretor_alianca, diretor_execucao, diretor_comercial, diretor_capital,
         valor_origem, divisor_multiplicador,
         perc_autor_opa, cpp_autor_opa, perc_aliado_built, cpp_aliado_built,
         perc_built, cpp_built, perc_dir_tecnico, cpp_dir_tecnico,
         perc_dir_obras, cpp_dir_obras, perc_dir_comercial, cpp_dir_comercial,
         perc_dir_capital, cpp_dir_capital,
         custo_origem_bia, custo_final_previsto, valor_realizado_venda,
         comissao_prevista_corretor, ir_previsto, resultado_liquido, lucro_previsto)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34)
         ON CONFLICT (id) DO NOTHING`,
        [
          b.id, b.nome_bia, b.objetivo_alianca, b.observacoes, b.localizacao,
          b.autor_bia, b.aliado_built, b.diretor_alianca, b.diretor_execucao, b.diretor_comercial, b.diretor_capital,
          b.valor_origem, b.divisor_multiplicador,
          b.perc_autor_opa, b.cpp_autor_opa, b.perc_aliado_built, b.cpp_aliado_built,
          b.perc_built, b.cpp_built, b.perc_dir_tecnico, b.cpp_dir_tecnico,
          b.perc_dir_obras, b.cpp_dir_obras, b.perc_dir_comercial, b.cpp_dir_comercial,
          b.perc_dir_capital, b.cpp_dir_capital,
          b.custo_origem_bia, b.custo_final_previsto, b.valor_realizado_venda,
          b.comissao_prevista_corretor, b.ir_previsto, b.resultado_liquido, b.lucro_previsto
        ]
      );
    }

    console.log("Importing fluxo_caixa...");
    for (const f of fluxoData) {
      const catId = f.Categoria && f.Categoria.length > 0 ? (typeof f.Categoria[0] === "object" ? f.Categoria[0].id : f.Categoria[0]) : null;
      const cppId = f.tipo_de_cpp && f.tipo_de_cpp.length > 0 ? (typeof f.tipo_de_cpp[0] === "object" ? f.tipo_de_cpp[0].id : f.tipo_de_cpp[0]) : null;
      const favId = f.Favorecido && f.Favorecido.length > 0 ? (typeof f.Favorecido[0] === "object" ? f.Favorecido[0].id : f.Favorecido[0]) : null;
      const biaId = typeof f.bia === "object" ? f.bia?.id : f.bia;
      const membroId = typeof f.membro_responsavel === "object" ? f.membro_responsavel?.id : f.membro_responsavel;

      await client.query(
        `INSERT INTO fluxo_caixa (id, bia_id, tipo, valor, data, descricao, membro_responsavel_id, categoria_id, tipo_cpp_id, favorecido_id, anexos)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (id) DO NOTHING`,
        [f.id, biaId, f.tipo, f.valor, f.data, f.descricao, membroId, catId ? String(catId) : null, cppId ? String(cppId) : null, favId, f.Anexos || []]
      );
    }

    console.log("Importing oportunidades (tipos_oportunidades)...");
    for (const o of opasData) {
      const biaId = typeof o.bia === "object" ? o.bia?.id : o.bia;
      await client.query(
        `INSERT INTO oportunidades (id, nome_oportunidade, tipo, bia_id, valor_origem_opa, objetivo_alianca, nucleo_alianca, pais, descricao, perfil_aliado)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (id) DO NOTHING`,
        [o.id, o.nome_oportunidade, o.tipo, biaId, o.valor_origem_opa, o.objetivo_alianca, o.nucleo_alianca, o.pais, o.descricao, o.perfil_aliado]
      );
    }

    await client.query("COMMIT");
    console.log("Migration complete!");
    console.log(`Imported: ${membrosData.length} membros, ${biasData.length} bias, ${fluxoData.length} fluxo_caixa, ${opasData.length} oportunidades, ${categoriasData.length} categorias, ${tiposCppData.length} tipos_cpp`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
