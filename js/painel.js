document.addEventListener("DOMContentLoaded", async () => {
  const supabaseClient = window.frotaSupabase;
  const mensagemBoasVindas = document.getElementById("mensagem-boas-vindas");
  const boasVindas = document.getElementById("boas-vindas");
  const nomeUsuario = document.getElementById("nome-usuario");
  const tituloModulo = document.getElementById("titulo-modulo");
  const conteudoModulo = document.getElementById("conteudo-modulo");
  const botaoSair = document.getElementById("botao-sair");
  const botaoAjustes = document.getElementById("botao-ajustes");
  const painelAjustes = document.getElementById("painel-ajustes");
  const seletorTema = document.getElementById("tema-aplicativo");
  const controleFonte = document.getElementById("tamanho-fonte");
  const valorFonte = document.getElementById("valor-fonte");
  const botoesMenu = document.querySelectorAll(".item-menu");

  function irParaLogin() {
    window.location.replace("index.html");
  }

  if (!supabaseClient) {
    alert("Não foi possível conectar ao sistema. Tente novamente.");
    irParaLogin();
    return;
  }

  try {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error || !data.session) {
      irParaLogin();
      return;
    }

    const usuario = data.session.user;
    const { data: perfil, error: erroPerfil } = await supabaseClient
      .from("profiles")
      .select("full_name, role, active, can_edit")
      .eq("id", usuario.id)
      .maybeSingle();

    if (erroPerfil || !perfil || !perfil.active) {
      await supabaseClient.auth.signOut();
      irParaLogin();
      return;
    }

    const nome = perfil.full_name || usuario.email || "Usuário";
    if (nomeUsuario) nomeUsuario.textContent = nome;
    if (mensagemBoasVindas) mensagemBoasVindas.textContent = `Bem-vindo, ${nome}!`;

    const modulos = {
      inicio: { titulo: "Início", mensagem: "Bem-vindo ao painel de gestão da frota." },
      abastecimentos: { titulo: "Abastecimentos", mensagem: "Área de abastecimentos e cadastro de veículos." },
      motoristas: { titulo: "Motoristas", mensagem: "Área de cadastro e consulta de motoristas." },
      mecanica: { titulo: "Mecânica", mensagem: "Área de serviços mecânicos e elétricos." },
      revisao: { titulo: "Revisão", mensagem: "Área de revisões preventivas e corretivas." },
      pecas: { titulo: "Peças", mensagem: "Área de peças e serviços de substituição." },
      relatorios: { titulo: "Relatórios", mensagem: "Área de relatórios de abastecimentos e manutenção." }
    };

    function abrirModulo(nomeModulo) {
      const modulo = modulos[nomeModulo];
      if (!modulo) return;

      if (tituloModulo) tituloModulo.textContent = modulo.titulo;

      if (conteudoModulo) {
        conteudoModulo.replaceChildren();
        const paragrafo = document.createElement("p");
        paragrafo.textContent = modulo.mensagem;
        conteudoModulo.appendChild(paragrafo);
      }

      if (boasVindas) boasVindas.hidden = nomeModulo !== "inicio";

      botoesMenu.forEach((botao) => {
        const selecionado = botao.dataset.modulo === nomeModulo;
        botao.classList.toggle("ativo", selecionado);
        if (selecionado) botao.setAttribute("aria-current", "page");
        else botao.removeAttribute("aria-current");
      });
    }

    botoesMenu.forEach((botao) => {
      botao.addEventListener("click", () => abrirModulo(botao.dataset.modulo));
    });

    if (botaoAjustes && painelAjustes) {
      botaoAjustes.addEventListener("click", () => {
        painelAjustes.hidden = !painelAjustes.hidden;
      });

      document.addEventListener("click", (event) => {
        if (
          !painelAjustes.hidden &&
          !painelAjustes.contains(event.target) &&
          !botaoAjustes.contains(event.target)
        ) {
          painelAjustes.hidden = true;
        }
      });
    }

    const temaSalvo = localStorage.getItem("frota-tema") || "claro";
    const fonteSalva = localStorage.getItem("frota-fonte") || "16";

    function aplicarTema(tema) {
      const temasValidos = ["claro", "verde", "azul", "escuro"];
      if (!temasValidos.includes(tema)) tema = "claro";
      document.body.classList.remove(
        "tema-claro", "tema-verde", "tema-azul", "tema-escuro"
      );
      document.body.classList.add(`tema-${tema}`);
      if (seletorTema) seletorTema.value = tema;
      localStorage.setItem("frota-tema", tema);
    }

    function aplicarFonte(valor) {
      document.documentElement.style.fontSize = `${valor}px`;
      if (controleFonte) controleFonte.value = valor;
      if (valorFonte) valorFonte.textContent = `${valor} px`;
      localStorage.setItem("frota-fonte", String(valor));
    }

    aplicarTema(temaSalvo);
    aplicarFonte(fonteSalva);

    if (seletorTema) {
      seletorTema.addEventListener("change", () => aplicarTema(seletorTema.value));
    }

    if (controleFonte) {
      controleFonte.addEventListener("input", () => aplicarFonte(controleFonte.value));
    }

    if (botaoSair) {
      botaoSair.addEventListener("click", async () => {
        botaoSair.disabled = true;
        botaoSair.textContent = "Saindo...";
        const { error: erroSaida } = await supabaseClient.auth.signOut();
        if (erroSaida) {
          alert("Não foi possível sair do sistema. Tente novamente.");
          botaoSair.disabled = false;
          botaoSair.textContent = "Sair";
          return;
        }
        irParaLogin();
      });
    }

    abrirModulo("inicio");
  } catch (erro) {
    console.error("Erro ao carregar o painel:", erro);
    alert("Não foi possível carregar o painel. Entre novamente.");
    irParaLogin();
  }
});
