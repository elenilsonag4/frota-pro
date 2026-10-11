document.addEventListener("DOMContentLoaded", async () => {
  const supabaseClient = window.frotaSupabase;

  const mensagemBoasVindas = document.getElementById(
    "mensagem-boas-vindas"
  );
  const tituloModulo = document.getElementById("titulo-modulo");
  const conteudoModulo = document.getElementById("conteudo-modulo");
  const botaoSair = document.getElementById("botao-sair");
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

    if (mensagemBoasVindas) {
      mensagemBoasVindas.textContent = perfil.full_name
        ? `Bem-vindo, ${perfil.full_name}!`
        : "Bem-vindo ao Frota PRO!";
    }

    const modulos = {
      inicio: {
        titulo: "Início",
        mensagem: "Bem-vindo ao painel de gestão da frota."
      },
      abastecimentos: {
        titulo: "Abastecimentos",
        mensagem: "Aqui ficará o cadastro de veículos e o histórico de abastecimentos."
      },
      motoristas: {
        titulo: "Motoristas",
        mensagem: "Aqui ficará o cadastro e a consulta dos motoristas."
      },
      mecanica: {
        titulo: "Mecânica",
        mensagem: "Aqui ficará o histórico de serviços mecânicos e elétricos."
      },
      revisao: {
        titulo: "Revisão",
        mensagem: "Aqui ficará o controle das revisões preventivas e corretivas."
      },
      pecas: {
        titulo: "Peças",
        mensagem: "Aqui ficará o controle de peças e serviços de substituição."
      },
      relatorios: {
        titulo: "Relatórios",
        mensagem: "Aqui ficarão os relatórios de abastecimentos e manutenção."
      }
    };

    function abrirModulo(nomeModulo) {
      const modulo = modulos[nomeModulo];

      if (!modulo) return;

      if (tituloModulo) {
        tituloModulo.textContent = modulo.titulo;
      }

      if (conteudoModulo) {
        conteudoModulo.replaceChildren();

        const paragrafo = document.createElement("p");
        paragrafo.textContent = modulo.mensagem;
        conteudoModulo.appendChild(paragrafo);
      }

      botoesMenu.forEach((botao) => {
        const selecionado = botao.dataset.modulo === nomeModulo;

        botao.classList.toggle("ativo", selecionado);
        botao.setAttribute("aria-current", selecionado ? "page" : "false");
      });
    }

    botoesMenu.forEach((botao) => {
      botao.addEventListener("click", () => {
        abrirModulo(botao.dataset.modulo);
      });
    });

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
