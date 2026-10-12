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
      veiculos: { titulo: "Veículos", mensagem: "Cadastre e consulte os veículos da frota." },
      abastecimentos: { titulo: "Abastecimentos", mensagem: "Registre abastecimentos e acompanhe o consumo em km/l." },
      motoristas: { titulo: "Motoristas", mensagem: "Área de cadastro e consulta de motoristas." },
      mecanica: { titulo: "Mecânica", mensagem: "Área de serviços mecânicos e elétricos." },
      revisao: { titulo: "Revisão", mensagem: "Área de revisões preventivas e corretivas." },
      pecas: { titulo: "Peças", mensagem: "Área de peças e serviços de substituição." },
      relatorios: { titulo: "Relatórios", mensagem: "Área de relatórios de abastecimentos e manutenção." }
    };

    let moduloAtual = "inicio";
    const formatarNumero = (valor, casas = 2) => Number(valor).toLocaleString("pt-BR", {
      minimumFractionDigits: casas, maximumFractionDigits: casas
    });
    const escapar = (valor) => String(valor ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));

    async function carregarVeiculos() {
      const { data, error } = await supabaseClient.from("vehicles")
        .select("id, name, renavam, plate, year, model, color, status, brand")
        .order("name", { ascending: true });
      if (error) throw error;
      return data || [];
    }

    async function renderizarVeiculos() {
      conteudoModulo.innerHTML = `<div class="frota-acoes"><button type="button" class="frota-botao" id="novo-veiculo">+ Novo veículo</button><button type="button" class="frota-botao frota-secundario" id="atualizar-veiculos">Atualizar</button></div><div id="form-veiculo-area"></div><p class="frota-status" id="status-veiculos">Carregando veículos...</p><div class="frota-tabela-wrap"><table class="frota-tabela"><thead><tr><th>Nome</th><th>Placa</th><th>Renavam</th><th>Ano</th><th>Modelo</th><th>Cor</th></tr></thead><tbody id="lista-veiculos"></tbody></table></div>`;
      const areaForm = document.getElementById("form-veiculo-area");
      const status = document.getElementById("status-veiculos");
      const tbody = document.getElementById("lista-veiculos");
      const carregar = async () => {
        status.textContent = "Carregando veículos...";
        try {
          const veiculos = await carregarVeiculos();
          tbody.innerHTML = veiculos.map(v => `<tr><td>${escapar(v.name || v.brand || "—")}</td><td>${escapar(v.plate)}</td><td>${escapar(v.renavam || "—")}</td><td>${escapar(v.year || "—")}</td><td>${escapar(v.model || "—")}</td><td>${escapar(v.color || "—")}</td></tr>`).join("");
          status.textContent = veiculos.length ? `${veiculos.length} veículo(s) cadastrado(s).` : "Nenhum veículo cadastrado ainda.";
        } catch (e) {
          console.error(e); status.textContent = "Não foi possível carregar os veículos. Confira as permissões (RLS) da tabela vehicles.";
        }
      };
      const abrirForm = () => {
        areaForm.innerHTML = `<form id="form-veiculo" class="frota-form"><h4>Cadastro de veículo</h4><div class="frota-campos"><label>Nome<input name="name" required maxlength="120" placeholder="Ex.: Caminhonete 01"></label><label>Renavam<input name="renavam" maxlength="20" placeholder="Renavam"></label><label>Placa<input name="plate" required maxlength="10" placeholder="ABC1D23"></label><label>Ano<input name="year" type="number" min="1900" max="2100" placeholder="2024"></label><label>Modelo<input name="model" required maxlength="100" placeholder="Ex.: S10"></label><label>Cor<input name="color" maxlength="50" placeholder="Branco"></label></div><div class="frota-acoes"><button class="frota-botao" type="submit">Salvar veículo</button><button class="frota-botao frota-secundario" id="cancelar-veiculo" type="button">Cancelar</button></div><p class="frota-status" id="form-veiculo-status"></p></form>`;
        document.getElementById("cancelar-veiculo").addEventListener("click", () => areaForm.replaceChildren());
        document.getElementById("form-veiculo").addEventListener("submit", async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const fd = new FormData(form);
          const aviso = document.getElementById("form-veiculo-status");
          const placa = String(fd.get("plate") || "").trim().toUpperCase();
          const dados = {
            name: String(fd.get("name") || "").trim(),
            renavam: String(fd.get("renavam") || "").trim() || null,
            plate: placa,
            year: fd.get("year") ? Number(fd.get("year")) : null,
            model: String(fd.get("model") || "").trim(),
            color: String(fd.get("color") || "").trim() || null,
            status: "ativo"
          };
          const submit = form.querySelector('[type="submit"]'); submit.disabled = true; aviso.textContent = "Salvando...";
          try {
            const { error } = await supabaseClient.from("vehicles").insert(dados);
            if (error) throw error;
            areaForm.replaceChildren(); await carregar();
          } catch (e) {
            console.error(e); aviso.textContent = e.code === "23505" ? "Já existe um veículo com essa placa." : "Não foi possível salvar. Verifique as políticas RLS e os campos obrigatórios da tabela vehicles.";
            submit.disabled = false;
          }
        });
      };
      document.getElementById("novo-veiculo").addEventListener("click", abrirForm);
      document.getElementById("atualizar-veiculos").addEventListener("click", carregar);
      await carregar();
    }

    async function recalcularConsumoVeiculo(vehicleId) {
      const { data: registros, error } = await supabaseClient.from("fuel_entries")
        .select("id, entry_date, odometer, liters, created_at")
        .eq("vehicle_id", vehicleId)
        .order("entry_date", { ascending: true })
        .order("created_at", { ascending: true })
        .order("id", { ascending: true });
      if (error) throw error;
      let anterior = null;
      for (const registro of (registros || [])) {
        const km = Number(registro.odometer);
        const litros = Number(registro.liters);
        let consumo = null;
        if (anterior && km > Number(anterior.odometer) && litros > 0) {
          consumo = Math.round(((km - Number(anterior.odometer)) / litros) * 100) / 100;
        }
        const { error: erroAtualizacao } = await supabaseClient.from("fuel_entries")
          .update({ consumption: consumo }).eq("id", registro.id);
        if (erroAtualizacao) throw erroAtualizacao;
        anterior = registro;
      }
    }

    async function renderizarAbastecimentos() {
      conteudoModulo.innerHTML = `<div class="frota-acoes"><button type="button" class="frota-botao" id="novo-abastecimento">+ Novo abastecimento</button><button type="button" class="frota-botao frota-secundario" id="atualizar-abastecimentos">Atualizar</button></div><div id="form-abastecimento-area"></div><p class="frota-status" id="status-abastecimentos">Carregando abastecimentos...</p><div class="frota-tabela-wrap"><table class="frota-tabela"><thead><tr><th>Data</th><th>Veículo</th><th>KM</th><th>Litros</th><th>Valor</th><th>Consumo (km/l)</th></tr></thead><tbody id="lista-abastecimentos"></tbody></table></div>`;
      const areaForm = document.getElementById("form-abastecimento-area");
      const status = document.getElementById("status-abastecimentos");
      const tbody = document.getElementById("lista-abastecimentos");
      let veiculos = [];
      try { veiculos = await carregarVeiculos(); } catch (e) { console.error(e); }
      const nomes = new Map(veiculos.map(v => [v.id, v.name || v.brand || v.plate]));
      const carregar = async () => {
        status.textContent = "Carregando abastecimentos...";
        try {
          const { data, error } = await supabaseClient.from("fuel_entries")
            .select("id, vehicle_id, entry_date, odometer, liters, total_value, consumption")
            .order("entry_date", { ascending: false }).order("created_at", { ascending: false });
          if (error) throw error;
          tbody.innerHTML = (data || []).map(r => `<tr><td>${escapar(r.entry_date)}</td><td>${escapar(nomes.get(r.vehicle_id) || "Veículo não localizado")}</td><td>${formatarNumero(r.odometer, 0)}</td><td>${formatarNumero(r.liters)}</td><td>R$ ${formatarNumero(r.total_value)}</td><td>${r.consumption == null ? "INÍCIO" : formatarNumero(r.consumption)}</td></tr>`).join("");
          status.textContent = data?.length ? `${data.length} abastecimento(s) registrado(s).` : "Nenhum abastecimento cadastrado ainda.";
        } catch (e) {
          console.error(e); status.textContent = "Não foi possível carregar abastecimentos. Confira as permissões RLS da tabela fuel_entries.";
        }
      };
      const abrirForm = () => {
        if (!veiculos.length) { areaForm.innerHTML = `<p class="frota-status">Cadastre primeiro um veículo na aba Veículos.</p>`; return; }
        areaForm.innerHTML = `<form id="form-abastecimento" class="frota-form"><h4>Novo abastecimento</h4><div class="frota-campos"><label>Veículo<select name="vehicle_id" required>${veiculos.map(v => `<option value="${escapar(v.id)}">${escapar(v.name || v.brand || v.plate)} — ${escapar(v.plate)}</option>`).join("")}</select></label><label>Data<input name="entry_date" type="date" required></label><label>KM atual<input name="odometer" type="number" min="0" step="0.1" required></label><label>Litros atuais<input name="liters" type="number" min="0.001" step="0.001" required></label><label>Valor total (R$)<input name="total_value" type="number" min="0" step="0.01" required></label></div><div class="frota-acoes"><button class="frota-botao" type="submit">Salvar abastecimento</button><button class="frota-botao frota-secundario" id="cancelar-abastecimento" type="button">Cancelar</button></div><p class="frota-status" id="form-abastecimento-status"></p></form>`;
        const dateInput = areaForm.querySelector('[name="entry_date"]');
        dateInput.value = new Date().toLocaleDateString("en-CA");
        document.getElementById("cancelar-abastecimento").addEventListener("click", () => areaForm.replaceChildren());
        document.getElementById("form-abastecimento").addEventListener("submit", async (event) => {
          event.preventDefault(); const form = event.currentTarget; const fd = new FormData(form);
          const aviso = document.getElementById("form-abastecimento-status"); const submit = form.querySelector('[type="submit"]');
          const dados = { vehicle_id: fd.get("vehicle_id"), entry_date: fd.get("entry_date"), odometer: Number(fd.get("odometer")), liters: Number(fd.get("liters")), total_value: Number(fd.get("total_value")), created_by: usuario.id };
          submit.disabled = true; aviso.textContent = "Salvando e recalculando consumo...";
          try {
            const { error } = await supabaseClient.from("fuel_entries").insert(dados);
            if (error) throw error;
            await recalcularConsumoVeiculo(dados.vehicle_id);
            areaForm.replaceChildren(); await carregar();
          } catch (e) {
            console.error(e); aviso.textContent = "O abastecimento pode ter sido salvo, mas houve falha ao recalcular. Atualize a tela e confira as políticas RLS de fuel_entries.";
            submit.disabled = false;
          }
        });
      };
      document.getElementById("novo-abastecimento").addEventListener("click", abrirForm);
      document.getElementById("atualizar-abastecimentos").addEventListener("click", carregar);
      await carregar();
    }

    function abrirModulo(nomeModulo) {
      const modulo = modulos[nomeModulo];
      if (!modulo) return;
      moduloAtual = nomeModulo;
      if (tituloModulo) tituloModulo.textContent = modulo.titulo;
      if (conteudoModulo) {
        conteudoModulo.replaceChildren();
        const paragrafo = document.createElement("p"); paragrafo.textContent = modulo.mensagem;
        conteudoModulo.appendChild(paragrafo);
      }
      if (boasVindas) boasVindas.hidden = nomeModulo !== "inicio";
      botoesMenu.forEach((botao) => {
        const selecionado = botao.dataset.modulo === nomeModulo;
        botao.classList.toggle("ativo", selecionado);
        if (selecionado) botao.setAttribute("aria-current", "page");
        else botao.removeAttribute("aria-current");
      });
      if (nomeModulo === "veiculos") renderizarVeiculos();
      if (nomeModulo === "abastecimentos") renderizarAbastecimentos();
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
