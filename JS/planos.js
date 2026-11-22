const PLANOS = {
  familia: [
    {
      id: "gratuito-familia",
      nome: "Gratuito",
      preco: "0,00",
      limite: 15,
      destaque: false,
      descricao: "Para conhecer o atendimento.",
      recursos: ["15 perguntas por mês", "Biblioteca de temas", "Histórico de conversas"],
    },
    {
      id: "essencial",
      nome: "Essencial",
      preco: "24,90",
      limite: 80,
      destaque: true,
      descricao: "Para o acompanhamento do dia a dia.",
      recursos: ["80 perguntas por mês", "Biblioteca completa", "Histórico de conversas", "Solicitação de consulta"],
    },
    {
      id: "familia-plano",
      nome: "Família",
      preco: "49,90",
      limite: 300,
      destaque: false,
      descricao: "Para quem quer mais apoio no mês.",
      recursos: ["300 perguntas por mês", "Biblioteca completa", "Histórico de conversas", "Solicitação de consulta"],
    },
  ],
  professor: [
    {
      id: "gratuito-professor",
      nome: "Gratuito",
      preco: "0,00",
      limite: 15,
      destaque: false,
      descricao: "Para testar o atendimento em sala.",
      recursos: ["15 perguntas por mês", "Biblioteca de temas", "Histórico de conversas"],
    },
    {
      id: "professor",
      nome: "Professor",
      preco: "49,90",
      limite: 300,
      destaque: true,
      descricao: "Para planejar aulas e lidar com a turma.",
      recursos: ["300 perguntas por mês", "Biblioteca completa", "Histórico de conversas", "Solicitação de consulta"],
    },
    {
      id: "escola-clinica",
      nome: "Escola e clínica",
      preco: "129,90",
      limite: 1000,
      destaque: false,
      descricao: "Para equipes e instituições.",
      recursos: ["1.000 perguntas por mês", "Biblioteca completa", "Solicitação de consulta", "Suporte prioritário"],
    },
  ],
};

const grade = document.getElementById("grade");
const abas = document.querySelectorAll(".aba");
let perfilAtual = localStorage.getItem("kn_perfil_escolhido") || "familia";

function marcarAba() {
  abas.forEach((aba) => {
    const ativa = aba.dataset.perfil === perfilAtual;
    aba.classList.toggle("on", ativa);
    aba.setAttribute("aria-selected", String(ativa));
  });
}

function renderizarPlanos() {
  grade.innerHTML = PLANOS[perfilAtual]
    .map(
      (p) => `
        <article class="plano${p.destaque ? " destaque" : ""}">
          ${p.destaque ? '<span class="selo">Mais escolhido</span>' : ""}
          <h2>${p.nome}</h2>
          <p class="desc">${p.descricao}</p>
          <p class="preco">R$ <strong>${p.preco}</strong><span>/mês</span></p>
          <ul>${p.recursos.map((r) => `<li>${r}</li>`).join("")}</ul>
          <button class="btn-escolher" type="button" data-id="${p.id}">Escolher ${p.nome}</button>
        </article>`
    )
    .join("");
}

abas.forEach((aba) => {
  aba.addEventListener("click", () => {
    perfilAtual = aba.dataset.perfil;
    localStorage.setItem("kn_perfil_escolhido", perfilAtual);
    marcarAba();
    renderizarPlanos();
  });
});

grade.addEventListener("click", (evento) => {
  const botao = evento.target.closest(".btn-escolher");
  if (!botao) return;

  const plano = PLANOS[perfilAtual].find((p) => p.id === botao.dataset.id);
  localStorage.setItem("kn_plano", JSON.stringify({ ...plano, perfil: perfilAtual }));
  window.location.href = "ia.html";
});

document.getElementById("sair").addEventListener("click", async () => {
  await sb.auth.signOut();
  localStorage.removeItem("kn_plano");
  window.location.href = "index.html";
});

// Sem login, volta para a tela de entrada
sb.auth.getSession().then(({ data }) => {
  if (!data.session) {
    window.location.href = "index_1.html";
    return;
  }

  marcarAba();
  renderizarPlanos();
});
