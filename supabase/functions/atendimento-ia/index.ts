import { PROMPT_SISTEMA, montarContexto } from "./prompt-sistema.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Modelo definido no orçamento (OpenRouter). Troque pela variável MODELO_IA, sem alterar o código.
const MODELO = Deno.env.get("MODELO_IA") ?? "openai/gpt-6.1-sol";
const CHAVE = Deno.env.get("OPENROUTER_API_KEY") ?? "";

const PERFIS = ["familia", "professor"];
const FAIXAS = ["4-6", "7-9", "10-12"];
const LIMITE_POR_MINUTO = 10;

const MSG_RISCO =
  "Sinto muito que isso esteja acontecendo. Este chat não consegue avaliar nem acompanhar situações de risco. " +
  "Se houver perigo imediato, ligue 190 (Polícia Militar) ou 192 (SAMU). " +
  "Para denunciar violência contra crianças, use o Disque 100. " +
  "Você também pode procurar o Conselho Tutelar da sua cidade ou o CVV pelo 188 para apoio emocional. " +
  "Se possível, fique com um adulto de confiança.";

const MSG_DADOS =
  "Por segurança, não envie nomes, telefones, e-mails, endereços ou documentos. " +
  "Reformule sua dúvida de forma geral, sem dados pessoais.";

const MSG_ERRO = "Não consegui responder agora. Tente novamente em instantes.";

// Expressões em texto sem acento e em minúsculas
const RISCO =
  /se machuc|machucar-se|machucando|suicid|abus|violenc|espanc|risco imediato|emergenc|quer morrer|se matar|nao quer viver|nao quero viver|sexual/;

// E-mail, CPF e telefone
const DADOS =
  /[\w.+-]+@[\w-]+\.[\w.]+|\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b|\(?\d{2}\)?\s?9?\d{4}-?\d{4}/;

// Assuntos que pedem avaliação individual: o front oferece marcar consulta
const SENSIVEL =
  /diagnost|laudo|persist|regress|perd(e|eu|eram) habilidade|sofriment|ansied|bullying|intimid|exclus|depress|tdah|autis|dislex|discalc|nao aprende|dificuldade grave/;

const normalizar = (texto: string) =>
  texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// Limite simples por IP (memória desta instância; para algo mais firme, use o banco)
const janela = new Map<string, { inicio: number; total: number }>();

function excedeuLimite(ip: string): boolean {
  const agora = Date.now();
  const registro = janela.get(ip);

  if (!registro || agora - registro.inicio > 60_000) {
    janela.set(ip, { inicio: agora, total: 1 });
    return false;
  }

  registro.total++;
  return registro.total > LIMITE_POR_MINUTO;
}

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  if (req.method !== "POST") {
    return json({ erro: "Método não permitido." }, 405);
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "desconhecido";
  if (excedeuLimite(ip)) {
    return json({ erro: "Muitas perguntas em pouco tempo. Aguarde um minuto." }, 429);
  }

  let corpo: { pergunta?: unknown; perfil?: unknown; faixa?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return json({ erro: "Requisição inválida." }, 400);
  }

  const pergunta = typeof corpo.pergunta === "string" ? corpo.pergunta.trim() : "";
  const perfil = String(corpo.perfil ?? "");
  const faixa = String(corpo.faixa ?? "");

  if (pergunta.length < 3 || pergunta.length > 320 || !PERFIS.includes(perfil) || !FAIXAS.includes(faixa)) {
    return json({ erro: "Dados inválidos." }, 400);
  }

  // Risco: resposta fixa, sem chamar o modelo
  if (RISCO.test(normalizar(pergunta))) {
    return json({ resposta: MSG_RISCO, risco: true });
  }

  // Dados pessoais: pede para reformular, sem chamar o modelo
  if (DADOS.test(pergunta)) {
    return json({ resposta: MSG_DADOS });
  }

  try {
    const retorno = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CHAVE}`,
        "Content-Type": "application/json",
        "X-Title": "Katia Neves Expert",
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: 800,
        temperature: 0.3,
        messages: [
          { role: "system", content: PROMPT_SISTEMA },
          { role: "system", content: montarContexto(perfil, faixa) },
          { role: "user", content: pergunta },
        ],
      }),
    });

    const dados = await retorno.json();
    const resposta = dados?.choices?.[0]?.message?.content?.trim();

    if (!retorno.ok || !resposta) {
      console.error("Falha no modelo:", retorno.status, JSON.stringify(dados));
      return json({ erro: MSG_ERRO }, 502);
    }

    return json({ resposta, sugerirConsulta: SENSIVEL.test(normalizar(pergunta)) });
  } catch (erro) {
    console.error(erro);
    return json({ erro: MSG_ERRO }, 502);
  }
});
