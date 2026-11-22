const CHAVE_PLANO = "kn_plano";

const BIBLIOTECA = [
  { tema: "Rotina", pergunta: "Como organizar a rotina de estudos?" },
  { tema: "Aprendizagem e leitura", pergunta: "Como ajudar na leitura e na escrita?" },
  { tema: "Atenção e organização", pergunta: "Meu filho se distrai muito, o que fazer?" },
  { tema: "Emoções", pergunta: "Como ajudar com emoções e frustrações?" },
  { tema: "Convivência", pergunta: "Como melhorar a convivência com os colegas?" },
  { tema: "Quando buscar ajuda", pergunta: "Quando buscar ajuda profissional?" },
];

const NOMES_PERFIL = {
  familia: "Pais e responsáveis",
  professor: "Professores e educadores",
};

const NOMES_FAIXA = {
  "4-6": "4 a 6 anos",
  "7-9": "7 a 9 anos",
  "10-12": "10 a 12 anos",
};

const $ = (id) => document.getElementById(id);
const normalizar = (texto) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

let usuario = null;
let plano = null;
let conversas = [];
let conversaAtual = null;
let enviando = false;

const chaveConversas = () => `kn_conversas_${usuario.id}`;
const mesAtual = () => new Date().toISOString().slice(0, 7);
const chaveUso = () => `kn_uso_${usuario.id}_${mesAtual()}`;
const usoAtual = () => Number(localStorage.getItem(chaveUso()) || 0);

function carregarConversas() {
  try {
    return JSON.parse(localStorage.getItem(chaveConversas()) || "[]");
  } catch {
    return [];
  }
}

function salvarConversas() {
  localStorage.setItem(chaveConversas(), JSON.stringify(conversas));
}

function rolarConversa() {
  const area = $("conteudo");
  area.scrollTop = area.scrollHeight;
}

function atualizarTopo() {
  $("topPerfil").textContent = `${NOMES_PERFIL[$("perfil").value]} · ${NOMES_FAIXA[$("faixa").value]}`;
}

function atualizarUso() {
  const usado = usoAtual();
  $("usoTexto").textContent = `${usado} de ${plano.limite} perguntas neste mês`;
  $("barraUso").style.width = Math.min(100, (usado / plano.limite) * 100) + "%";
}

function mostrarAviso(texto) {
  const aviso = $("avisoLimite");
  aviso.textContent = texto;
  aviso.hidden = false;
  clearTimeout(mostrarAviso.timer);
  mostrarAviso.timer = setTimeout(() => (aviso.hidden = true), 6000);
}

function atualizarOverlay() {
  const aberto = !$("modalConsulta").hidden || $("sidebar").classList.contains("aberta");
  $("overlay").hidden = !aberto;
}

function abrirSidebar() {
  $("sidebar").classList.add("aberta");
  atualizarOverlay();
}

function fecharSidebar() {
  $("sidebar").classList.remove("aberta");
  atualizarOverlay();
}

function abrirConsulta() {
  fecharSidebar();
  $("modalConsulta").hidden = false;
  $("consultaStatus").textContent = "";
  atualizarOverlay();
  $("nomeResp").focus();
}

function fecharConsulta() {
  $("modalConsulta").hidden = true;
  atualizarOverlay();
}

function renderBiblioteca() {
  const termo = normalizar($("busca").value);
  const lista = $("biblioteca");
  lista.replaceChildren();

  BIBLIOTECA.filter((item) => normalizar(item.tema + " " + item.pergunta).includes(termo)).forEach((item) => {
    const li = document.createElement("li");
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "side-item";
    botao.dataset.pergunta = item.pergunta;
    botao.textContent = item.tema;
    li.append(botao);
    lista.append(li);
  });
}

function renderHistorico() {
  const termo = normalizar($("busca").value);
  const lista = $("historico");
  lista.replaceChildren();

  const itens = conversas
    .filter((c) => normalizar(c.titulo).includes(termo))
    .sort((a, b) => b.criada.localeCompare(a.criada));

  if (!itens.length) {
    const vazio = document.createElement("li");
    vazio.className = "side-vazio";
    vazio.textContent = termo ? "Nenhuma conversa encontrada." : "Suas conversas aparecem aqui.";
    lista.append(vazio);
    return;
  }

  itens.forEach((c) => {
    const li = document.createElement("li");
    li.className = "item-historico" + (conversaAtual && conversaAtual.id === c.id ? " ativo" : "");

    const abrir = document.createElement("button");
    abrir.type = "button";
    abrir.className = "side-item";
    abrir.dataset.id = c.id;
    abrir.textContent = c.titulo;

    const apagar = document.createElement("button");
    apagar.type = "button";
    apagar.className = "apagar";
    apagar.dataset.apagar = c.id;
    apagar.setAttribute("aria-label", "Apagar conversa");
    apagar.textContent = "×";

    li.append(abrir, apagar);
    lista.append(li);
  });
}

function criarMensagem(m) {
  const linha = document.createElement("div");
  linha.className = `linha ${m.tipo}`;

  if (m.tipo === "bot") {
    const avatar = document.createElement("div");
    avatar.className = "avatar-kn";
    avatar.textContent = "KN";
    linha.append(avatar);
  }

  const corpo = document.createElement("div");
  corpo.className = "corpo";

  const bolha = document.createElement("div");
  bolha.className = `bolha ${m.tipo}${m.erro ? " erro" : ""}`;
  bolha.textContent = m.texto;
  corpo.append(bolha);

  if (m.consulta) {
    const card = document.createElement("div");
    card.className = "card-consulta";
    card.innerHTML =
      '<p>Este assunto pede avaliação individual. Quer marcar uma consulta com a Kátia?</p>' +
      '<button class="btn-primary" type="button" data-acao="consulta">Marcar consulta</button>';
    corpo.append(card);
  }

  linha.append(corpo);
  return linha;
}

function renderMensagens() {
  const lista = $("mensagens");
  lista.replaceChildren();

  const msgs = conversaAtual ? conversaAtual.mensagens : [];
  $("vazio").hidden = msgs.length > 0;
  msgs.forEach((m) => lista.append(criarMensagem(m)));
  rolarConversa();
}

function adicionarMensagem(m, conversa = conversaAtual) {
  conversa.mensagens.push(m);
  salvarConversas();

  if (conversaAtual && conversa.id === conversaAtual.id) {
    $("vazio").hidden = true;
    $("mensagens").append(criarMensagem(m));
    rolarConversa();
  }
}

function criarConversa(primeiraPergunta) {
  const conversa = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    titulo: primeiraPergunta.slice(0, 60),
    criada: new Date().toISOString(),
    perfil: $("perfil").value,
    faixa: $("faixa").value,
    mensagens: [],
  };

  conversas.push(conversa);
  conversaAtual = conversa;
  salvarConversas();
  renderHistorico();
  return conversa;
}

function novaConversa() {
  conversaAtual = null;
  renderMensagens();
  renderHistorico();
  fecharSidebar();
  $("pergunta").focus();
}

function abrirConversa(id) {
  const conversa = conversas.find((c) => c.id === id);
  if (!conversa) return;

  conversaAtual = conversa;
  $("perfil").value = conversa.perfil;
  $("faixa").value = conversa.faixa;
  atualizarTopo();
  renderMensagens();
  renderHistorico();
  fecharSidebar();
}

function apagarConversa(id) {
  conversas = conversas.filter((c) => c.id !== id);
  salvarConversas();

  if (conversaAtual && conversaAtual.id === id) {
    novaConversa();
  } else {
    renderHistorico();
  }
}

function criarDigitando() {
  const indicador = document.createElement("div");
  indicador.className = "linha bot";
  indicador.setAttribute("aria-label", "A assistente está respondendo");
  indicador.innerHTML = '<div class="avatar-kn">KN</div><div class="digitando"><span></span><span></span><span></span></div>';
  return indicador;
}

function bloquearEnvio(estado) {
  $("enviar").disabled = estado;
}

function ajustarAltura() {
  const campo = $("pergunta");
  campo.style.height = "auto";
  campo.style.height = Math.min(campo.scrollHeight, 160) + "px";
}

async function enviar(texto) {
  const pergunta = texto.trim();
  if (!pergunta || enviando) return;

  if (usoAtual() >= plano.limite) {
    mostrarAviso("Você usou todas as perguntas do seu plano neste mês. Mude de plano para continuar.");
    return;
  }

  const conversa = conversaAtual || criarConversa(pergunta);
  adicionarMensagem({ tipo: "user", texto: pergunta }, conversa);

  $("pergunta").value = "";
  ajustarAltura();
  enviando = true;
  bloquearEnvio(true);

  const digitando = criarDigitando();
  $("mensagens").append(digitando);
  rolarConversa();

  try {
    const { data, error } = await sb.functions.invoke("atendimento-ia", {
      body: {
        pergunta,
        perfil: $("perfil").value,
        faixa: $("faixa").value,
      },
    });

    if (error) throw error;

    localStorage.setItem(chaveUso(), usoAtual() + 1);
    atualizarUso();
    digitando.remove();
    adicionarMensagem({ tipo: "bot", texto: data.resposta, consulta: Boolean(data.sugerirConsulta) }, conversa);
  } catch (erro) {
    console.error(erro);
    digitando.remove();
    adicionarMensagem(
      { tipo: "bot", texto: "Não consegui responder agora. Tente novamente em instantes.", erro: true },
      conversa
    );
  } finally {
    enviando = false;
    bloquearEnvio(false);
    $("pergunta").focus();
  }
}

function renderChipsVazio() {
  const area = $("chipsVazio");
  BIBLIOTECA.slice(0, 4).forEach((item) => {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "chip";
    botao.dataset.pergunta = item.pergunta;
    botao.textContent = item.pergunta;
    area.append(botao);
  });
}

async function enviarConsulta(evento) {
  evento.preventDefault();

  const dados = {
    user_id: usuario.id,
    nome: $("nomeResp").value.trim(),
    contato: $("contatoResp").value.trim(),
    modalidade: $("modalidade").value,
    periodo: $("periodo").value,
    data_preferida: $("dataPreferida").value || null,
    motivo: $("motivo").value.trim(),
    perfil: plano.perfil,
  };

  const status = $("consultaStatus");
  if (!dados.nome || !dados.contato || !dados.motivo) {
    status.textContent = "Preencha nome, contato e o motivo.";
    return;
  }

  const botao = $("enviarConsulta");
  botao.disabled = true;
  botao.textContent = "Enviando...";

  const { error } = await sb.from("consultas").insert(dados);

  botao.disabled = false;
  botao.textContent = "Enviar solicitação";

  if (error) {
    console.error(error);
    status.textContent = "Não foi possível enviar agora. Tente novamente.";
    return;
  }

  $("formConsulta").reset();
  status.textContent = "Recebemos sua solicitação! A Kátia entrará em contato pelo contato informado.";
}

async function iniciar() {
  const { data } = await sb.auth.getSession();
  if (!data.session) {
    window.location.href = "index_1.html";
    return;
  }

  usuario = data.session.user;
  plano = JSON.parse(localStorage.getItem(CHAVE_PLANO) || "null");
  if (!plano) {
    window.location.href = "planos.html";
    return;
  }

  conversas = carregarConversas();
  $("contaEmail").textContent = usuario.email;
  $("planoNome").textContent = plano.nome;
  $("perfil").value = plano.perfil;
  $("dataPreferida").min = new Date().toISOString().slice(0, 10);

  renderChipsVazio();
  atualizarTopo();
  atualizarUso();
  renderBiblioteca();
  renderHistorico();
  renderMensagens();
}

// Eventos
$("busca").addEventListener("input", () => {
  renderBiblioteca();
  renderHistorico();
});

$("novaConversa").addEventListener("click", novaConversa);
$("abrirSidebar").addEventListener("click", abrirSidebar);
$("fecharSidebar").addEventListener("click", fecharSidebar);
$("abrirConsulta").addEventListener("click", abrirConsulta);
$("fecharConsulta").addEventListener("click", fecharConsulta);
$("overlay").addEventListener("click", () => {
  fecharSidebar();
  fecharConsulta();
});

$("historico").addEventListener("click", (evento) => {
  const apagar = evento.target.closest("[data-apagar]");
  if (apagar) {
    apagarConversa(apagar.dataset.apagar);
    return;
  }

  const abrir = evento.target.closest("[data-id]");
  if (abrir) abrirConversa(abrir.dataset.id);
});

document.addEventListener("click", (evento) => {
  const pergunta = evento.target.closest("[data-pergunta]");
  if (pergunta) {
    fecharSidebar();
    enviar(pergunta.dataset.pergunta);
    return;
  }

  if (evento.target.closest("[data-acao='consulta']")) {
    abrirConsulta();
  }
});

$("form").addEventListener("submit", (evento) => {
  evento.preventDefault();
  enviar($("pergunta").value);
});

$("pergunta").addEventListener("keydown", (evento) => {
  if (evento.key === "Enter" && !evento.shiftKey) {
    evento.preventDefault();
    $("form").requestSubmit();
  }
});

$("pergunta").addEventListener("input", ajustarAltura);

$("perfil").addEventListener("change", atualizarTopo);
$("faixa").addEventListener("change", atualizarTopo);

$("formConsulta").addEventListener("submit", enviarConsulta);

$("sair").addEventListener("click", async () => {
  await sb.auth.signOut();
  localStorage.removeItem(CHAVE_PLANO);
  window.location.href = "index.html";
});

iniciar();
