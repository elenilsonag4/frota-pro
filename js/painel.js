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
      .select("full_name, role, active, can_edit, can_access_finance")
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
      estoque: { titulo: "Estoque", mensagem: "Entradas, saídas e saldo de peças." },
      financeiro: { titulo: "Financeiro", mensagem: "Despesas agrupadas por veículo." },
      relatorios: { titulo: "Relatórios", mensagem: "Área de relatórios de abastecimentos e manutenção." }
    };

    const menuFinanceiro = document.getElementById("menu-financeiro");
    const perfilAdmin = /^(admin|administrador|administrator)$/i.test(String(perfil.role || ""));
    const podeFinanceiro = perfilAdmin || perfil.can_access_finance === true;
    if (menuFinanceiro) menuFinanceiro.hidden = !podeFinanceiro;

    let moduloAtual = "inicio";
    const formatarNumero = (valor, casas = 2) => Number(valor).toLocaleString("pt-BR", {
      minimumFractionDigits: casas, maximumFractionDigits: casas
    });
    const escapar = (valor) => String(valor ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));

    function abrirJanelaRelatorio(modulo, modoInicial = null) {
      document.getElementById('frota-modal-relatorio')?.remove();
      const modal=document.createElement('div'); modal.id='frota-modal-relatorio'; modal.className='frota-modal-relatorio';
      const revisao=modulo==='revisao';
      modal.innerHTML=`<div class="frota-modal-cartao" role="dialog" aria-modal="true" aria-labelledby="titulo-modal-relatorio"><button type="button" class="frota-modal-fechar" aria-label="Fechar">×</button><h3 id="titulo-modal-relatorio">Relatório — ${escapar(modulos[modulo]?.titulo||modulo)}</h3>${revisao?'<label>Tipo de revisão<select id="relatorio-tipo-revisao"><option value="Preventiva">Preventiva</option><option value="Corretiva">Corretiva</option><option value="Ambos">Ambos</option></select></label>':''}${modoInicial ? '' : '<div class="frota-modal-acoes"><button type="button" class="frota-botao" data-relatorio="geral">Geral</button><button type="button" class="frota-botao frota-secundario" data-relatorio="seletivo">Seletivo</button></div>'}<p class="frota-status">${modoInicial==='seletivo'?'Selecione o veículo para gerar o relatório seletivo.': 'Geral inclui todos os veículos. Seletivo permite escolher um veículo.'}</p><div id="relatorio-selecao-veiculo" ${modoInicial==='seletivo'?'':'hidden'}><label>Veículo<select id="relatorio-veiculo"><option value="">Carregando veículos…</option></select></label><button type="button" class="frota-botao" id="confirmar-relatorio-seletivo">Gerar PDF</button></div></div>`;
      document.body.appendChild(modal);
      const fechar=()=>modal.remove(); modal.querySelector('.frota-modal-fechar').onclick=fechar; modal.addEventListener('click',e=>{if(e.target===modal)fechar()});
      async function gerar(tipo,veiculoId=null){
        const status=modal.querySelector('.frota-status'); status.textContent='Preparando relatório…';
        try {
          const specs={abastecimentos:{table:'fuel_entries',select:'*',date:'entry_date',title:'Abastecimentos'},mecanica:{table:'mechanical_services',select:'*',date:'service_date',title:'Mecânica'},revisao:{table:'revisions',select:'*',date:'completed_date',title:'Revisão'},pecas:{table:'stock_movements',select:'*',date:'movement_date',title:'Peças'},estoque:{table:'stock_balances',select:'*',date:'name',title:'Estoque'}};
          const spec=specs[modulo]; if(!spec) throw new Error('Relatório não disponível para esta área.');
          let query=supabaseClient.from(spec.table).select(spec.select);
          if(modulo==='revisao'){const t=document.getElementById('relatorio-tipo-revisao').value;if(t!=='Ambos')query=query.eq('revision_type',t)}
          if(veiculoId && ['abastecimentos','mecanica','revisao'].includes(modulo)) query=query.eq('vehicle_id',veiculoId);
          const {data,error}=await query; if(error)throw error;
          let rows=data||[];
          if(veiculoId && ['pecas','estoque'].includes(modulo)) rows=rows.filter(r=>String(r.vehicle_id||'')===String(veiculoId));
          const vs=await carregarVeiculos(), ms=await carregarMotoristas(), vm=new Map(vs.map(v=>[String(v.id),v.name||v.plate||'Veículo'])), mm=new Map(ms.map(v=>[String(v.id),v.name||v.full_name||'Motorista']));
          rows.sort((a,b)=>String(a[spec.date]||'').localeCompare(String(b[spec.date]||'')));
          const keys=rows.length?Object.keys(rows[0]).filter(k=>!['id','created_by','updated_at'].includes(k)):[];
          const fmt=k=>k.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
          const cell=(r,k)=>{let v=r[k];if(k==='vehicle_id')v=vm.get(String(v))||'—';if(k==='driver_id')v=mm.get(String(v))||'—';if(v==null||v==='')return '—';if(typeof v==='object')return JSON.stringify(v);return String(v)};
          const html=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${spec.title} — ${tipo==='geral'?'Geral':'Seletivo'}</title><style>body{font:12px Arial,sans-serif;color:#222;margin:22px}h1{font-size:20px;margin-bottom:4px}p{color:#555}table{width:100%;border-collapse:collapse;table-layout:fixed;margin-top:16px}th,td{border:1px solid #bbb;padding:5px;overflow-wrap:anywhere;text-align:left}th{background:#e8eef3}thead{display:table-header-group}@media print{body{margin:12mm}button{display:none}}</style></head><body><h1>Frota PRO — ${spec.title}</h1><p>Relatório ${tipo==='geral'?'Geral':'Seletivo'}${revisao?' — '+document.getElementById('relatorio-tipo-revisao').value:''} • Emitido em ${new Date().toLocaleString('pt-BR')}</p><table><thead><tr>${keys.map(k=>`<th>${fmt(k)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${keys.map(k=>`<td>${escapar(cell(r,k))}</td>`).join('')}</tr>`).join('')}</tbody></table><p>${rows.length} registro(s).</p><script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`;
          const w=window.open('','_blank'); if(!w)throw new Error('O navegador bloqueou a janela do relatório. Permita pop-ups para gerar o PDF.'); w.document.open();w.document.write(html);w.document.close();fechar();
        }catch(e){console.error(e);status.textContent='Não foi possível gerar o relatório: '+e.message}
      }
      const prepararSeletivo=async()=>{const area=modal.querySelector('#relatorio-selecao-veiculo');area.hidden=false;const sel=modal.querySelector('#relatorio-veiculo');try{const vs=await carregarVeiculos();sel.innerHTML='<option value="">Selecione um veículo</option>'+vs.map(v=>`<option value="${escapar(v.id)}">${escapar(v.name||v.plate||'Veículo')}</option>`).join('')}catch(e){sel.innerHTML='<option value="">Erro ao carregar veículos</option>'}};
      const btnGeral=modal.querySelector('[data-relatorio="geral"]');if(btnGeral)btnGeral.onclick=()=>gerar('geral');
      const btnSeletivo=modal.querySelector('[data-relatorio="seletivo"]');if(btnSeletivo)btnSeletivo.onclick=prepararSeletivo;
      if(modoInicial==='geral')gerar('geral');else if(modoInicial==='seletivo')prepararSeletivo();
      modal.querySelector('#confirmar-relatorio-seletivo').onclick=()=>{const id=modal.querySelector('#relatorio-veiculo').value;if(!id){modal.querySelector('.frota-status').textContent='Selecione um veículo.';return}gerar('seletivo',id)};
    }


    async function carregarVeiculos() {
      const { data, error } = await supabaseClient.from("vehicles")
        .select("id, name, renavam, plate, year, model, color, status, brand")
        .order("name", { ascending: true });
      if (error) throw error;
      return data || [];
    }

    async function renderizarVeiculos() {
      conteudoModulo.innerHTML = `<div class="frota-acoes"><button type="button" class="frota-botao" id="novo-veiculo">+ Novo veículo</button><button type="button" class="frota-botao frota-secundario" id="atualizar-veiculos" title="Atualizar" aria-label="Atualizar">↻</button></div><div id="form-veiculo-area"></div><p class="frota-status" id="status-veiculos">Carregando veículos...</p><div class="frota-tabela-wrap"><table class="frota-tabela"><thead><tr><th>Nome</th><th>Placa</th><th>Renavam</th><th>Ano</th><th>Modelo</th><th>Cor</th><th>Ações</th></tr></thead><tbody id="lista-veiculos"></tbody></table></div>`;
      const areaForm = document.getElementById("form-veiculo-area"), status = document.getElementById("status-veiculos"), tbody = document.getElementById("lista-veiculos");
      const carregar = async () => {
        status.textContent = "Carregando veículos...";
        try {
          const veiculos = await carregarVeiculos();
          tbody.innerHTML = veiculos.map(v => `<tr><td>${escapar(v.name || v.brand || "—")}</td><td>${escapar(v.plate)}</td><td>${escapar(v.renavam || "—")}</td><td>${escapar(v.year || "—")}</td><td>${escapar(v.model || "—")}</td><td>${escapar(v.color || "—")}</td><td class="frota-acoes-linha"><button type="button" class="frota-icone-acao" data-editar-veiculo="${escapar(v.id)}" title="Editar veículo" aria-label="Editar veículo">✏️</button><button type="button" class="frota-icone-acao frota-excluir" data-excluir-veiculo="${escapar(v.id)}" title="Excluir veículo" aria-label="Excluir veículo">🗑️</button></td></tr>`).join("");
          status.textContent = veiculos.length ? `${veiculos.length} veículo(s) cadastrado(s).` : "Nenhum veículo cadastrado ainda.";
          tbody.querySelectorAll('[data-editar-veiculo]').forEach(b => b.addEventListener('click', () => abrirForm(veiculos.find(v => v.id === b.dataset.editarVeiculo))));
          tbody.querySelectorAll('[data-excluir-veiculo]').forEach(b => b.addEventListener('click', async () => {
            const v = veiculos.find(x => x.id === b.dataset.excluirVeiculo); if (!v || !confirm(`Excluir o veículo ${v.name || v.plate}? Esta ação não poderá ser desfeita.`)) return;
            const { error } = await supabaseClient.from('vehicles').delete().eq('id', v.id);
            if (error) { alert('Não foi possível excluir. Verifique se há abastecimentos ou manutenções vinculados a este veículo.'); console.error(error); return; }
            await carregar();
          }));
        } catch (e) { console.error(e); status.textContent = "Não foi possível carregar os veículos. Confira as permissões (RLS) da tabela vehicles."; }
      };
      const abrirForm = (veiculo = null) => {
        areaForm.innerHTML = `<form id="form-veiculo" class="frota-form"><h4>${veiculo ? 'Editar veículo' : 'Cadastro de veículo'}</h4><div class="frota-campos"><label>Nome<input name="name" required maxlength="120" placeholder="Ex.: Caminhonete 01"></label><label>Renavam<input name="renavam" maxlength="20" placeholder="Renavam"></label><label>Placa<input name="plate" required maxlength="10" placeholder="ABC1D23"></label><label>Ano<input name="year" type="number" min="1900" max="2100" placeholder="2024"></label><label>Modelo<input name="model" required maxlength="100" placeholder="Ex.: S10"></label><label>Cor<input name="color" maxlength="50" placeholder="Branco"></label></div><div class="frota-acoes"><button class="frota-botao" type="submit">${veiculo ? 'Salvar alterações' : 'Salvar veículo'}</button><button class="frota-botao frota-secundario" id="cancelar-veiculo" type="button">Cancelar</button></div><p class="frota-status" id="form-veiculo-status"></p></form>`;
        const form = document.getElementById('form-veiculo');
        if (veiculo) for (const k of ['name','renavam','plate','year','model','color']) form.elements[k].value = veiculo[k] ?? '';
        document.getElementById("cancelar-veiculo").addEventListener("click", () => areaForm.replaceChildren());
        form.addEventListener("submit", async (event) => {
          event.preventDefault(); const fd = new FormData(form), aviso = document.getElementById("form-veiculo-status"), submit = form.querySelector('[type="submit"]');
          const dados = { name:String(fd.get('name')||'').trim(), renavam:String(fd.get('renavam')||'').trim()||null, plate:String(fd.get('plate')||'').trim().toUpperCase(), year:fd.get('year')?Number(fd.get('year')):null, model:String(fd.get('model')||'').trim(), color:String(fd.get('color')||'').trim()||null, status:veiculo?.status || 'ativo' };
          submit.disabled = true; aviso.textContent = 'Salvando...';
          try { const result = veiculo ? await supabaseClient.from('vehicles').update(dados).eq('id',veiculo.id) : await supabaseClient.from('vehicles').insert(dados); if (result.error) throw result.error; areaForm.replaceChildren(); await carregar(); }
          catch(e) { console.error(e); aviso.textContent = e.code === '23505' ? 'Já existe um veículo com essa placa.' : 'Não foi possível salvar. Confira as permissões RLS e as colunas da tabela vehicles.'; submit.disabled = false; }
        });
      };
      document.getElementById("novo-veiculo").addEventListener("click", () => abrirForm());
      document.getElementById("atualizar-veiculos").addEventListener("click", carregar); await carregar();
    }

    async function carregarMotoristas() {
      const { data, error } = await supabaseClient.from('drivers').select('*').order('name', {ascending:true});
      if (error) throw error; return data || [];
    }

    function formatarDataLocal(valor) {
      if (!valor) return '—';
      const data = new Date(`${valor}T12:00:00`);
      return Number.isNaN(data.getTime()) ? '—' : data.toLocaleDateString('pt-BR');
    }

    function alarmeCnh(validade) {
      if (!validade) return '<span class="frota-alarme frota-alarme-neutro">Sem validade</span>';
      const hoje = new Date(); hoje.setHours(0,0,0,0);
      const venc = new Date(`${validade}T00:00:00`);
      const dias = Math.ceil((venc - hoje) / 86400000);
      if (dias < 0) return `<span class="frota-alarme frota-alarme-vencido">Vencida há ${Math.abs(dias)} dia(s)</span>`;
      if (dias <= 90) return `<span class="frota-alarme frota-alarme-alerta">${dias === 0 ? 'Vence hoje' : `Vence em ${dias} dia(s)`}</span>`;
      return `<span class="frota-alarme frota-alarme-ok">Em dia</span>`;
    }

    async function renderizarMotoristas() {
      conteudoModulo.innerHTML = `<div class="frota-acoes"><button type="button" class="frota-botao" id="novo-motorista">+ Novo motorista</button><button type="button" class="frota-botao frota-secundario" id="atualizar-motoristas" title="Atualizar" aria-label="Atualizar">↻</button></div><div id="form-motorista-area"></div><p class="frota-status" id="status-motoristas">Carregando motoristas...</p><div class="frota-tabela-wrap"><table class="frota-tabela"><thead><tr><th>Nome</th><th>D.N.</th><th>Telefone</th><th>CNH</th><th>Validade</th><th>Alarme</th><th>Ações</th></tr></thead><tbody id="lista-motoristas"></tbody></table></div>`;
      const area = document.getElementById('form-motorista-area'), status = document.getElementById('status-motoristas'), tbody = document.getElementById('lista-motoristas');
      const carregar = async () => {
        try {
          const motoristas = await carregarMotoristas();
          tbody.innerHTML = motoristas.map(m => `<tr><td>${escapar(m.name || '—')}</td><td>${formatarDataLocal(m.birth_date)}</td><td>${escapar(m.phone || '—')}</td><td>${escapar(m.cnh || m.document_number || '—')}</td><td>${formatarDataLocal(m.cnh_expiry)}</td><td>${alarmeCnh(m.cnh_expiry)}</td><td class="frota-acoes-linha"><button type="button" class="frota-icone-acao" data-editar-motorista="${escapar(m.id)}" title="Editar motorista" aria-label="Editar motorista">✏️</button><button type="button" class="frota-icone-acao frota-excluir" data-excluir-motorista="${escapar(m.id)}" title="Excluir motorista" aria-label="Excluir motorista">🗑️</button></td></tr>`).join('');
          status.textContent = motoristas.length ? `${motoristas.length} motorista(s) cadastrado(s).` : 'Nenhum motorista cadastrado ainda.';
          tbody.querySelectorAll('[data-editar-motorista]').forEach(b => b.addEventListener('click',()=>abrirForm(motoristas.find(m=>m.id===b.dataset.editarMotorista))));
          tbody.querySelectorAll('[data-excluir-motorista]').forEach(b => b.addEventListener('click',async()=>{const m=motoristas.find(x=>x.id===b.dataset.excluirMotorista);if(!m||!confirm(`Excluir o motorista ${m.name||'selecionado'}?`))return;const {error}=await supabaseClient.from('drivers').delete().eq('id',m.id);if(error){alert('Não foi possível excluir. Se o motorista estiver vinculado a abastecimentos, preserve o cadastro e marque-o como inativo.');console.error(error);return;}await carregar();}));
        } catch(e) { console.error(e); status.textContent = 'Não foi possível carregar motoristas. Confirme as colunas da tabela drivers e as permissões RLS.'; }
      };
      const abrirForm = (motorista=null) => {
        area.innerHTML = `<form id="form-motorista" class="frota-form"><h4>${motorista?'Editar motorista':'Cadastro de motorista'}</h4><div class="frota-campos"><label>Nome<input name="name" required maxlength="150" placeholder="Nome completo"></label><label>D.N. (data de nascimento)<input name="birth_date" type="date"></label><label>Telefone<input name="phone" type="tel" maxlength="30" placeholder="Telefone para contato"></label><label>CNH<input name="cnh" maxlength="30" placeholder="Número da CNH"></label><label>Validade da CNH<input name="cnh_expiry" type="date"></label></div><div class="frota-acoes"><button class="frota-botao" type="submit">${motorista?'Salvar alterações':'Salvar motorista'}</button><button class="frota-botao frota-secundario" id="cancelar-motorista" type="button">Cancelar</button></div><p class="frota-status" id="form-motorista-status"></p></form>`;
        const form=document.getElementById('form-motorista');
        if(motorista){form.elements.name.value=motorista.name||'';form.elements.birth_date.value=motorista.birth_date||'';form.elements.phone.value=motorista.phone||'';form.elements.cnh.value=motorista.cnh||'';form.elements.cnh_expiry.value=motorista.cnh_expiry||'';}
        document.getElementById('cancelar-motorista').addEventListener('click',()=>area.replaceChildren());
        form.addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(form),aviso=document.getElementById('form-motorista-status'),submit=form.querySelector('[type="submit"]');const dados={name:String(fd.get('name')||'').trim(),birth_date:String(fd.get('birth_date')||'')||null,phone:String(fd.get('phone')||'').trim()||null,cnh:String(fd.get('cnh')||'').trim()||null,cnh_expiry:String(fd.get('cnh_expiry')||'')||null};submit.disabled=true;aviso.textContent='Salvando...';try{const result=motorista?await supabaseClient.from('drivers').update(dados).eq('id',motorista.id):await supabaseClient.from('drivers').insert(dados);if(result.error)throw result.error;area.replaceChildren();await carregar();}catch(err){console.error(err);aviso.textContent='Não foi possível salvar. Confirme se executou o SQL das colunas birth_date, cnh e cnh_expiry e se as políticas RLS permitem gravação.';submit.disabled=false;}});
      };
      document.getElementById('novo-motorista').addEventListener('click',()=>abrirForm()); document.getElementById('atualizar-motoristas').addEventListener('click',carregar); await carregar();
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
      conteudoModulo.innerHTML = `<div class="frota-acoes"><button type="button" class="frota-botao" id="novo-abastecimento">+ Novo abastecimento</button><button type="button" class="frota-botao frota-secundario frota-atualizar-icone" id="atualizar-abastecimentos" title="Atualizar" aria-label="Atualizar">↻</button></div><div id="form-abastecimento-area"></div><p class="frota-status" id="status-abastecimentos">Carregando abastecimentos...</p><div class="frota-tabela-wrap"><table class="frota-tabela"><thead><tr><th>Data</th><th>Veículo</th><th>KM</th><th>Litros</th><th>Valor</th><th>Motorista</th><th>Consumo (km/l)</th><th>Ações</th></tr></thead><tbody id="lista-abastecimentos"></tbody></table></div>`;
      const areaForm = document.getElementById("form-abastecimento-area");
      const status = document.getElementById("status-abastecimentos");
      const tbody = document.getElementById("lista-abastecimentos");
      let veiculos = [], motoristas = [], registrosAtuais = [];
      try { veiculos = await carregarVeiculos(); } catch (e) { console.error(e); }
      try { motoristas = await carregarMotoristas(); } catch (e) { console.error('Motoristas não carregados:', e); }
      const nomes = new Map(veiculos.map(v => [v.id, v.name || v.brand || v.plate]));

      const carregar = async () => {
        status.textContent = "Carregando abastecimentos...";
        try {
          const { data, error } = await supabaseClient.from("fuel_entries")
            .select("id, vehicle_id, driver_id, entry_date, odometer, liters, total_value, consumption, created_at")
            .order("entry_date", { ascending: false }).order("created_at", { ascending: false });
          if (error) throw error;
          registrosAtuais = data || [];
          const nomesMotoristas = new Map(motoristas.map(m => [m.id, m.name || m.full_name || "Motorista"]));
          tbody.innerHTML = registrosAtuais.map(r => `<tr><td>${escapar(formatarDataLocal(r.entry_date))}</td><td>${escapar(nomes.get(r.vehicle_id) || "Veículo não localizado")}</td><td>${formatarNumero(r.odometer, 0)}</td><td>${formatarNumero(r.liters)}</td><td>R$ ${formatarNumero(r.total_value)}</td><td>${escapar(nomesMotoristas.get(r.driver_id) || "—")}</td><td>${r.consumption == null ? "INÍCIO" : formatarNumero(r.consumption)}</td><td class="frota-acoes-linha"><button type="button" class="frota-icone-acao" data-editar-abastecimento="${escapar(r.id)}" title="Editar abastecimento" aria-label="Editar abastecimento">✏️</button><button type="button" class="frota-icone-acao frota-excluir" data-excluir-abastecimento="${escapar(r.id)}" title="Excluir abastecimento" aria-label="Excluir abastecimento">🗑️</button></td></tr>`).join("");
          status.textContent = registrosAtuais.length ? `${registrosAtuais.length} abastecimento(s) registrado(s).` : "Nenhum abastecimento cadastrado ainda.";
          tbody.querySelectorAll('[data-editar-abastecimento]').forEach(b => b.addEventListener('click', () => abrirForm(registrosAtuais.find(r => r.id === b.dataset.editarAbastecimento))));
          tbody.querySelectorAll('[data-excluir-abastecimento]').forEach(b => b.addEventListener('click', async () => {
            const registro = registrosAtuais.find(r => r.id === b.dataset.excluirAbastecimento);
            if (!registro || !confirm('Excluir este abastecimento? O consumo do veículo será recalculado. Esta ação não poderá ser desfeita.')) return;
            b.disabled = true;
            try {
              const { error } = await supabaseClient.from('fuel_entries').delete().eq('id', registro.id);
              if (error) throw error;
              await recalcularConsumoVeiculo(registro.vehicle_id);
              await carregar();
            } catch (e) {
              console.error(e); alert(`Não foi possível excluir o abastecimento. Verifique as permissões da tabela fuel_entries. ${e.message || ''}`); b.disabled = false;
            }
          }));
        } catch (e) {
          console.error(e); status.textContent = "Não foi possível carregar abastecimentos. Confira as permissões RLS da tabela fuel_entries.";
        }
      };

      const abrirForm = (registro = null) => {
        if (!veiculos.length) { areaForm.innerHTML = `<p class="frota-status">Cadastre primeiro um veículo na aba Veículos.</p>`; return; }
        const editando = Boolean(registro);
        areaForm.innerHTML = `<form id="form-abastecimento" class="frota-form"><h4>${editando ? 'Editar abastecimento' : 'Novo abastecimento'}</h4><div class="frota-campos"><label>Veículo<select name="vehicle_id" required>${veiculos.map(v => `<option value="${escapar(v.id)}">${escapar(v.name || v.brand || v.plate)} — ${escapar(v.plate)}</option>`).join("")}</select></label><label>Data<input name="entry_date" type="date" required></label><label>KM atual<input name="odometer" type="number" min="0" step="0.1" required></label><label>Litros atuais<input name="liters" type="number" min="0.001" step="0.001" required></label><label>Valor total (R$)<input name="total_value" type="number" min="0" step="0.01" required></label><label>Motorista<select name="driver_id" required><option value="">Selecione o motorista</option>${motoristas.map(m => `<option value="${escapar(m.id)}">${escapar(m.name || m.full_name || "Motorista")}</option>`).join("")}</select></label></div><div class="frota-acoes"><button class="frota-botao" type="submit">${editando ? 'Salvar alterações' : 'Salvar abastecimento'}</button><button class="frota-botao frota-secundario" id="cancelar-abastecimento" type="button">Cancelar</button></div><p class="frota-status" id="form-abastecimento-status"></p></form>`;
        const form = document.getElementById('form-abastecimento');
        if (registro) {
          form.elements.vehicle_id.value = registro.vehicle_id || '';
          form.elements.driver_id.value = registro.driver_id || '';
          form.elements.entry_date.value = registro.entry_date || '';
          form.elements.odometer.value = registro.odometer ?? '';
          form.elements.liters.value = registro.liters ?? '';
          form.elements.total_value.value = registro.total_value ?? '';
        } else {
          form.elements.entry_date.value = new Date().toLocaleDateString("en-CA");
        }
        document.getElementById("cancelar-abastecimento").addEventListener("click", () => areaForm.replaceChildren());
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          const fd = new FormData(form), aviso = document.getElementById("form-abastecimento-status"), submit = form.querySelector('[type="submit"]');
          const dados = { vehicle_id: String(fd.get("vehicle_id")), driver_id: String(fd.get("driver_id")), entry_date: String(fd.get("entry_date")), odometer: Number(fd.get("odometer")), liters: Number(fd.get("liters")), total_value: Number(fd.get("total_value")) };
          submit.disabled = true; aviso.textContent = "Salvando e recalculando consumo...";
          try {
            let erro;
            if (editando) {
              const resultado = await supabaseClient.from("fuel_entries").update(dados).eq("id", registro.id);
              erro = resultado.error;
            } else {
              dados.created_by = usuario.id;
              const resultado = await supabaseClient.from("fuel_entries").insert(dados);
              erro = resultado.error;
            }
            if (erro) throw erro;
            if (editando && registro.vehicle_id !== dados.vehicle_id) await recalcularConsumoVeiculo(registro.vehicle_id);
            await recalcularConsumoVeiculo(dados.vehicle_id);
            areaForm.replaceChildren(); await carregar();
          } catch (e) {
            console.error(e); aviso.textContent = `Não foi possível salvar ou recalcular. Confira as permissões RLS de fuel_entries. ${e.message || ''}`;
            submit.disabled = false;
          }
        });
      };
      document.getElementById("novo-abastecimento").addEventListener("click", () => abrirForm());
      document.getElementById("atualizar-abastecimentos").addEventListener("click", carregar);
      await carregar();
    }


    async function renderizarManutencao(tipo) {
      const config = {
        mecanica: { tabela: "mechanical_services", titulo: "Mecânica", plural: "serviço mecânico", campos: [
          ["service_date","Data","date",true],["vehicle_id","Veículo","vehicle",true],["odometer","Quilometragem (KM)","number",false],["description","Serviço (motor/parte elétrica)","text",true],["provider","Oficina / responsável","text",false],["total_value","Valor total (R$)","number",true],["status","Situação","select",true],["notes","Observações","textarea",false]
        ], colunas:["service_date","vehicle_id","odometer","description","provider","total_value","status"] },
        revisao: { tabela:"revisions", titulo:"Revisão", plural:"revisão", campos:[
          ["revision_type","Tipo","selecttipo",true],["vehicle_id","Veículo","vehicle",true],["description","Itens/serviços (óleo, filtros, freios)","text",true],["due_date","Data prevista","date",false],["due_odometer","KM previsto","number",false],["completed_date","Data realizada","date",false],["completed_odometer","KM realizado","number",false],["status","Situação","select",true],["total_value","Valor total (R$)","number",true],["notes","Observações","textarea",false]
        ], colunas:["revision_type","vehicle_id","description","due_date","due_odometer","completed_date","completed_odometer","status","total_value"] }
      }[tipo];
      if (!config) return;
      conteudoModulo.innerHTML = `<div class="frota-acoes"><button type="button" class="frota-botao" id="novo-manutencao">+ Novo ${config.plural}</button><button type="button" class="frota-botao frota-secundario frota-atualizar-icone" id="atualizar-manutencao" title="Atualizar" aria-label="Atualizar">↻</button></div><div id="form-manutencao-area"></div><p class="frota-status" id="status-manutencao">Carregando...</p><div class="frota-tabela-wrap"><table class="frota-tabela"><thead><tr><th>Data</th><th>Veículo</th><th>Descrição</th><th>KM</th><th>Valor</th><th>Situação</th><th>Ações</th></tr></thead><tbody id="lista-manutencao"></tbody></table></div>`;
      const area=document.getElementById("form-manutencao-area"), status=document.getElementById("status-manutencao"), tbody=document.getElementById("lista-manutencao");
      let veiculos=[];
      try { veiculos=await carregarVeiculos(); } catch(e) { status.textContent="Não foi possível carregar veículos."; return; }
      const nomes=new Map(veiculos.map(v=>[v.id,v.name||v.brand||v.plate||"Veículo"]));
      const fmtData=v=>v?new Date(v+"T00:00:00").toLocaleDateString("pt-BR"):"—";
      const valor=v=>v==null?"—":`R$ ${formatarNumero(v)}`;
      async function carregar() {
        status.textContent="Carregando...";
        let q=supabaseClient.from(config.tabela).select("*").order(tipo==="mecanica"?"service_date":tipo==="revisao"?"due_date":"created_at",{ascending:false});
        const {data,error}=await q;
        if(error){status.textContent=`Erro ao carregar: ${error.message}`;return;}
        tbody.innerHTML=(data||[]).map(r=>`<tr><td>${escapar(fmtData(r.service_date||r.due_date||r.completed_date))}</td><td>${escapar(nomes.get(r.vehicle_id)||"—")}</td><td>${escapar(r.description||"—")}</td><td>${escapar(r.odometer??r.completed_odometer??r.due_odometer??"—")}</td><td>${escapar(valor(r.total_value))}</td><td>${escapar(r.status||"—")}</td><td class="frota-acoes-linha"><button type="button" class="frota-icone-acao" data-edit="${escapar(r.id)}" title="Editar">✏️</button><button type="button" class="frota-icone-acao frota-excluir" data-del="${escapar(r.id)}" title="Excluir">🗑️</button></td></tr>`).join("");
        status.textContent=(data||[]).length?`${data.length} registro(s).`:"Nenhum registro encontrado.";
      }
      function abrirForm(registro=null){
        const campos=config.campos.map(([key,label,type,required])=>{
          const val=registro?.[key]??(key==="status"?"Pendente":key==="revision_type"?"Preventiva":"");
          let input="";
          if(type==="vehicle") input=`<select name="${key}" required><option value="">Selecione</option>${veiculos.map(v=>`<option value="${escapar(v.id)}" ${val===v.id?"selected":""}>${escapar(v.name||v.brand||v.plate||"Veículo")}</option>`).join("")}</select>`;
          else if(type==="select") input=`<select name="${key}" ${required?"required":""}><option value="Pendente" ${val==="Pendente"?"selected":""}>Pendente</option><option value="Em andamento" ${val==="Em andamento"?"selected":""}>Em andamento</option><option value="Concluído" ${val==="Concluído"?"selected":""}>Concluído</option><option value="Cancelado" ${val==="Cancelado"?"selected":""}>Cancelado</option></select>`;
          else if(type==="selecttipo") input=`<select name="${key}" required><option ${val==="Preventiva"?"selected":""}>Preventiva</option><option ${val==="Corretiva"?"selected":""}>Corretiva</option></select>`;
          else if(type==="textarea") input=`<textarea name="${key}">${escapar(val)}</textarea>`;
          else input=`<input name="${key}" type="${type}" ${type==="number"?'step="0.01" min="0"':""} value="${escapar(val)}" ${required?"required":""}>`;
          return `<label>${label}${input}</label>`;
        }).join("");
        area.innerHTML=`<form class="frota-form"><h3>${registro?"Editar":"Novo"} ${config.plural}</h3><div class="frota-campos">${campos}</div><p class="frota-status" id="status-form-manutencao"></p><div class="frota-acoes"><button class="frota-botao" type="submit">Salvar</button><button class="frota-botao frota-secundario" id="cancelar-manutencao" type="button">Cancelar</button></div></form>`;
        area.querySelector("#cancelar-manutencao").onclick=()=>area.replaceChildren();
        area.querySelector("form").onsubmit=async e=>{
          e.preventDefault(); const form=e.currentTarget, fd=new FormData(form), dados={};
          for(const [key] of config.campos){let v=fd.get(key); if(["odometer","due_odometer","completed_odometer","total_value"].includes(key)) v=v===""?null:Number(v); else if(["due_date","completed_date","service_date"].includes(key)) v=v||null; else v=String(v??"").trim()||null; dados[key]=v;}
          if(!registro) dados.created_by=usuario.id;
          const aviso=form.querySelector("#status-form-manutencao"); aviso.textContent="Salvando...";
          try {const result=registro?await supabaseClient.from(config.tabela).update(dados).eq("id",registro.id):await supabaseClient.from(config.tabela).insert(dados); if(result.error) throw result.error; area.replaceChildren(); await carregar();}
          catch(err){aviso.textContent=`Erro ao salvar: ${err.message}`;}
        };
      }
      document.getElementById("novo-manutencao").onclick=()=>abrirForm();
      document.getElementById("atualizar-manutencao").onclick=carregar;
      tbody.onclick=async e=>{const edit=e.target.closest("[data-edit]"), del=e.target.closest("[data-del]"); if(edit){const {data,error}=await supabaseClient.from(config.tabela).select("*").eq("id",edit.dataset.edit).single();if(error){alert(error.message);return;}abrirForm(data);} if(del&&confirm("Confirma excluir este registro?")){const {error}=await supabaseClient.from(config.tabela).delete().eq("id",del.dataset.del);if(error)alert(`Não foi possível excluir: ${error.message}`);else carregar();}};
      await carregar();
    }

    async function renderizarPecas() {
      conteudoModulo.innerHTML=`<div class="frota-acoes"><button class="frota-botao" id="nova-peca" type="button">+ Nova peça</button><button class="frota-botao frota-secundario frota-atualizar-icone" id="atualizar-pecas" type="button" title="Atualizar" aria-label="Atualizar">↻</button></div><div id="form-peca-area"></div><p class="frota-status" id="status-pecas">Carregando...</p><div class="frota-tabela-wrap"><table class="frota-tabela"><thead><tr><th>Código</th><th>Peça</th><th>Unidade</th><th>Estoque mínimo</th><th>Ativa</th><th>Ações</th></tr></thead><tbody id="lista-pecas"></tbody></table></div><p>Esta tela cadastra o catálogo de peças. O histórico de instalação por veículo será implementado separadamente para não misturar estoque com serviços.</p>`;
      const area=document.getElementById("form-peca-area"),status=document.getElementById("status-pecas"),tbody=document.getElementById("lista-pecas");
      async function carregar(){const {data,error}=await supabaseClient.from("parts").select("*").order("name");if(error){status.textContent=`Erro ao carregar: ${error.message}`;return;}tbody.innerHTML=(data||[]).map(p=>`<tr><td>${escapar(p.code||"—")}</td><td>${escapar(p.name)}</td><td>${escapar(p.unit)}</td><td>${escapar(p.min_stock)}</td><td>${p.active?"Sim":"Não"}</td><td class="frota-acoes-linha"><button class="frota-icone-acao" data-edit-peca="${escapar(p.id)}" type="button">✏️</button><button class="frota-icone-acao frota-excluir" data-del-peca="${escapar(p.id)}" type="button">🗑️</button></td></tr>`).join("");status.textContent=(data||[]).length?`${data.length} peça(s).`:"Nenhuma peça cadastrada.";}
      function abrirForm(p=null){area.innerHTML=`<form class="frota-form"><h3>${p?"Editar":"Nova"} peça</h3><div class="frota-campos"><label>Código<input name="code" value="${escapar(p?.code||"")}"></label><label>Nome da peça<input name="name" required value="${escapar(p?.name||"")}"></label><label>Unidade<input name="unit" required value="${escapar(p?.unit||"unidade")}"></label><label>Estoque mínimo<input name="min_stock" type="number" min="0" step="0.01" required value="${escapar(p?.min_stock??0)}"></label><label>Ativa<select name="active"><option value="true" ${p?.active!==false?"selected":""}>Sim</option><option value="false" ${p?.active===false?"selected":""}>Não</option></select></label><label>Observações<textarea name="notes">${escapar(p?.notes||"")}</textarea></label></div><p class="frota-status"></p><div class="frota-acoes"><button class="frota-botao" type="submit">Salvar</button><button class="frota-botao frota-secundario" id="cancelar-peca" type="button">Cancelar</button></div></form>`;area.querySelector("#cancelar-peca").onclick=()=>area.replaceChildren();area.querySelector("form").onsubmit=async e=>{e.preventDefault();const f=e.currentTarget,fd=new FormData(f),dados={code:String(fd.get("code")||"").trim()||null,name:String(fd.get("name")||"").trim(),unit:String(fd.get("unit")||"unidade").trim(),min_stock:Number(fd.get("min_stock")||0),active:fd.get("active")==="true",notes:String(fd.get("notes")||"").trim()||null};const aviso=f.querySelector(".frota-status");try{const r=p?await supabaseClient.from("parts").update(dados).eq("id",p.id):await supabaseClient.from("parts").insert(dados);if(r.error)throw r.error;area.replaceChildren();await carregar();}catch(err){aviso.textContent=`Erro ao salvar: ${err.message}`;}};}
      document.getElementById("nova-peca").onclick=()=>abrirForm();document.getElementById("atualizar-pecas").onclick=carregar;
      tbody.onclick=async e=>{const ed=e.target.closest("[data-edit-peca]"),del=e.target.closest("[data-del-peca]");if(ed){const {data,error}=await supabaseClient.from("parts").select("*").eq("id",ed.dataset.editPeca).single();if(error){alert(error.message);return;}abrirForm(data);}if(del&&confirm("Confirma excluir esta peça do catálogo?")){const {error}=await supabaseClient.from("parts").delete().eq("id",del.dataset.delPeca);if(error)alert(`Não foi possível excluir: ${error.message}`);else carregar();}};
      await carregar();
    }

    async function renderizarEstoque() {
      conteudoModulo.innerHTML = `<div class="frota-acoes"><button type="button" class="frota-botao" id="nova-movimentacao">+ Registrar movimentação</button><button type="button" class="frota-botao frota-secundario frota-atualizar-icone" id="atualizar-estoque" title="Atualizar" aria-label="Atualizar">↻</button></div><div id="form-mov-estoque"></div><p class="frota-status" id="status-estoque">Carregando estoque...</p><div class="frota-tabela-wrap"><table class="frota-tabela"><thead><tr><th>Peça</th><th>Unidade</th><th>Estoque mínimo</th><th>Saldo</th><th>Situação</th></tr></thead><tbody id="lista-saldo-estoque"></tbody></table></div><button type="button" class="frota-botao frota-secundario" id="abrir-recentes-estoque">Recentes</button><div id="modal-recentes-estoque" class="frota-modal-relatorio" hidden><div class="frota-modal-cartao" role="dialog" aria-modal="true"><button type="button" class="frota-modal-fechar" id="fechar-recentes-estoque" aria-label="Fechar">×</button><h3>Movimentações recentes</h3><div class="frota-tabela-wrap"><table class="frota-tabela"><thead><tr><th>Data</th><th>Peça</th><th>Tipo</th><th>Quantidade</th><th>Valor unitário</th><th>Veículo</th></tr></thead><tbody id="lista-mov-estoque"></tbody></table></div></div></div>`;
      const status=document.getElementById('status-estoque'),saldo=document.getElementById('lista-saldo-estoque'),mov=document.getElementById('lista-mov-estoque'),form=document.getElementById('form-mov-estoque');
      const fmt=n=>Number(n||0).toLocaleString('pt-BR',{maximumFractionDigits:3});
      async function carregar(){
        status.textContent='Consultando saldos e movimentações...';
        const [b,m,p,v]=await Promise.all([
          supabaseClient.from('stock_balances').select('*').order('name'),
          supabaseClient.from('stock_movements').select('id,part_id,movement_type,quantity,movement_date,unit_value,vehicle_id,reference').order('movement_date',{ascending:false}).limit(100),
          supabaseClient.from('parts').select('id,name,unit,min_stock'),
          carregarVeiculos()
        ]);
        if(b.error){status.textContent=`Erro ao carregar saldos: ${b.error.message}. Execute a migração SQL incluída no ZIP.`;return;}
        if(m.error){status.textContent=`Erro ao carregar movimentações: ${m.error.message}`;return;}
        saldo.innerHTML=(b.data||[]).map(x=>`<tr><td>${escapar(x.name)}</td><td>${escapar(x.unit||'un')}</td><td>${fmt(x.min_stock)}</td><td>${fmt(x.quantity_on_hand)}</td><td>${Number(x.quantity_on_hand)<Number(x.min_stock)?'Repor':'OK'}</td></tr>`).join('');
        const pn=new Map((p.data||[]).map(x=>[String(x.id),x.name])),vn=new Map((v||[]).map(x=>[String(x.id),x.name||x.plate||'Veículo']));
        mov.innerHTML=(m.data||[]).map(x=>`<tr><td>${escapar(x.movement_date||'—')}</td><td>${escapar(pn.get(String(x.part_id))||'—')}</td><td>${escapar(x.movement_type)}</td><td>${fmt(x.quantity)}</td><td>${moedaLocal(x.unit_value)}</td><td>${escapar(vn.get(String(x.vehicle_id))||'—')}</td></tr>`).join('');
        status.textContent=`${(b.data||[]).length} produto(s); ${(m.data||[]).length} movimentação(ões) recentes.`;
      }
      function moedaLocal(n){return Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
      document.getElementById('nova-movimentacao').onclick=async()=>{
        const {data:parts,error}=await supabaseClient.from('parts').select('id,name,unit').eq('active',true).order('name');
        if(error){alert(`Não foi possível carregar peças: ${error.message}`);return;}
        let vehicles=[];try{vehicles=await carregarVeiculos()}catch{}
        form.innerHTML=`<form class="frota-form"><h3>Movimentação de estoque</h3><div class="frota-campos"><label>Peça<select name="part_id" required><option value="">Selecione</option>${(parts||[]).map(x=>`<option value="${escapar(x.id)}">${escapar(x.name)}</option>`).join('')}</select></label><label>Tipo<select name="movement_type"><option value="entrada">Entrada</option><option value="saida">Saída / aplicação</option><option value="ajuste">Ajuste positivo</option></select></label><label>Quantidade<input name="quantity" type="number" min="0.001" step="0.001" required></label><label>Data<input name="movement_date" type="date" value="${new Date().toISOString().slice(0,10)}" required></label><label>Valor unitário (R$)<input name="unit_value" type="number" min="0" step="0.01" value="0" required></label><label>Veículo (se aplicação)<select name="vehicle_id"><option value="">Nenhum</option>${vehicles.map(x=>`<option value="${escapar(x.id)}">${escapar(x.name||x.plate||'Veículo')}</option>`).join('')}</select></label><label>Referência<input name="reference"></label><label>Observações<input name="notes"></label></div><p class="frota-status"></p><div class="frota-acoes"><button class="frota-botao" type="submit">Salvar</button><button class="frota-botao frota-secundario" type="button" id="cancelar-mov">Cancelar</button></div></form>`;
        form.querySelector('#cancelar-mov').onclick=()=>form.replaceChildren();
        form.querySelector('form').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget,fd=new FormData(f),data={part_id:fd.get('part_id'),movement_type:fd.get('movement_type'),quantity:Number(fd.get('quantity')),movement_date:fd.get('movement_date'),unit_value:Number(fd.get('unit_value')),vehicle_id:fd.get('vehicle_id')||null,reference:fd.get('reference')||null,notes:fd.get('notes')||null};const msg=f.querySelector('.frota-status');const {error}=await supabaseClient.from('stock_movements').insert(data);if(error){msg.textContent=`Erro ao salvar: ${error.message}`;return;}form.replaceChildren();await carregar();};
      };
      document.getElementById('atualizar-estoque').onclick=carregar; document.getElementById('abrir-recentes-estoque').onclick=()=>document.getElementById('modal-recentes-estoque').hidden=false; document.getElementById('fechar-recentes-estoque').onclick=()=>document.getElementById('modal-recentes-estoque').hidden=true; await carregar();
    }

    async function renderizarFinanceiro() {
      if (!podeFinanceiro) { conteudoModulo.innerHTML='<p class="frota-status">Acesso restrito. Solicite autorização ao administrador.</p>'; return; }
      conteudoModulo.innerHTML='<div class="frota-acoes"><button type="button" class="frota-botao frota-secundario" id="atualizar-financeiro" title="Atualizar" aria-label="Atualizar">↻</button></div><p class="frota-status" id="status-financeiro">Carregando despesas...</p><div id="lista-financeiro"></div>';
      const status=document.getElementById('status-financeiro'),lista=document.getElementById('lista-financeiro');
      async function carregar(){
        status.textContent='Consultando despesas registradas...';
        const [veiculos,mec,rev,eventos,abast]=await Promise.all([
          carregarVeiculos(),supabaseClient.from('mechanical_services').select('vehicle_id,service_date,total_value,description'),
          supabaseClient.from('revisions').select('vehicle_id,completed_date,due_date,total_value,description'),
          supabaseClient.from('maintenance_event_totals').select('*'),supabaseClient.from('fuel_entries').select('vehicle_id,date,total_value,amount,fuel_cost')
        ]);
        const err=[mec,rev,eventos,abast].find(x=>x.error);if(err){status.textContent=`Erro ao consultar dados financeiros: ${err.error.message}`;return;}
        const rows=[];for(const v of veiculos){const records=[];
          (mec.data||[]).filter(x=>String(x.vehicle_id)===String(v.id)).forEach(x=>records.push({date:x.service_date,type:'Mecânica',desc:x.description,value:Number(x.total_value||0)}));
          (rev.data||[]).filter(x=>String(x.vehicle_id)===String(v.id)).forEach(x=>records.push({date:x.completed_date||x.due_date,type:'Revisão',desc:x.description,value:Number(x.total_value||0)}));
          (eventos.data||[]).filter(x=>String(x.vehicle_id)===String(v.id)).forEach(x=>records.push({date:x.event_date,type:x.event_type,desc:x.description,value:Number(x.total_value||0)}));
          (abast.data||[]).filter(x=>String(x.vehicle_id)===String(v.id)).forEach(x=>records.push({date:x.date,type:'Abastecimento',desc:'Abastecimento',value:Number(x.total_value??x.fuel_cost??x.amount??0)}));
          if(records.length){records.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));const total=records.reduce((s,x)=>s+x.value,0);rows.push(`<section class="frota-financeiro-veiculo"><h3>${escapar(v.name||v.plate||'Veículo')} — Total: ${total.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</h3><div class="frota-tabela-wrap"><table class="frota-tabela"><thead><tr><th>Data</th><th>Categoria</th><th>Descrição</th><th>Valor</th></tr></thead><tbody>${records.map(x=>`<tr><td>${escapar(x.date||'—')}</td><td>${escapar(x.type)}</td><td>${escapar(x.desc||'—')}</td><td>${x.value.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td></tr>`).join('')}</tbody></table></div></section>`);}}
        lista.innerHTML=rows.join('');status.textContent=`Financeiro carregado para ${rows.length} veículo(s). Valores refletem somente registros com valor monetário disponível.`;
      }
      document.getElementById('atualizar-financeiro').onclick=carregar;await carregar();
    }

    let graficosRelatorios = [];
    async function renderizarRelatorios() {
      conteudoModulo.innerHTML = `
        <div class="frota-acoes frota-relatorios-linha"><strong>Relatórios</strong><span class="frota-acoes-espacador"></span><button type="button" class="frota-botao" id="botao-graficos-relatorios">Gráficos</button></div>
        <section class="frota-relatorios-modulos" aria-label="Relatórios por módulo">
          <p>Escolha a área para gerar um relatório em PDF:</p>
          <div class="frota-acoes frota-botoes-relatorio-modulo">
            <button type="button" class="frota-botao" data-abrir-relatorio="abastecimentos">Abastecimentos</button>
            <button type="button" class="frota-botao" data-abrir-relatorio="mecanica">Mecânica</button>
            <button type="button" class="frota-botao" data-abrir-relatorio="revisao">Revisão</button>
            <button type="button" class="frota-botao" data-abrir-relatorio="pecas">Peças</button>
            <button type="button" class="frota-botao" data-abrir-relatorio="estoque">Estoque</button>
          </div>
        </section>
        <section id="relatorio-modulo-painel" class="frota-relatorio-modulo-painel" hidden></section>
        <section class="frota-relatorios-graficos" hidden>
          <div class="frota-acoes frota-filtros-graficos">
            <label>Formato do gráfico<select id="tipo-grafico"><option value="pizza">Pizza</option><option value="coluna">Coluna</option></select></label>
            <label>Dados exibidos<select id="dados-grafico"><option value="consumo">Consumo</option><option value="manutencao">Manutenção</option><option value="ambos">Ambos</option></select></label>
            <button type="button" class="frota-botao frota-secundario" id="atualizar-graficos" title="Atualizar" aria-label="Atualizar">↻</button>
          </div>
          <p class="frota-status" id="status-graficos">Carregando dados reais do Supabase...</p>
          <div id="painel-graficos" class="frota-graficos-grid"></div>
        </section>`;
      const secaoGraficos=conteudoModulo.querySelector('.frota-relatorios-graficos');
      secaoGraficos.hidden=true;
      document.getElementById('botao-graficos-relatorios').onclick=async()=>{
        const abrir=secaoGraficos.hidden; secaoGraficos.hidden=!abrir;
        if(abrir){ if(!secaoGraficos.dataset.carregado){ dados=await carregarDados(); desenhar(dados); secaoGraficos.dataset.carregado='1'; } secaoGraficos.scrollIntoView({behavior:'smooth',block:'start'}); }
      };
      const painelModulo=document.getElementById('relatorio-modulo-painel');
      const nomesRelatorio={abastecimentos:'Abastecimentos',mecanica:'Mecânica',revisao:'Revisão',pecas:'Peças',estoque:'Estoque'};
      conteudoModulo.querySelectorAll('[data-abrir-relatorio]').forEach(botao => {
        botao.addEventListener('click', async () => {
          const modulo=botao.dataset.abrirRelatorio;
          conteudoModulo.querySelectorAll('[data-abrir-relatorio]').forEach(b=>b.classList.toggle('ativo',b===botao));
          painelModulo.hidden=false;
          painelModulo.innerHTML=`<h3>${nomesRelatorio[modulo]}</h3>${modulo==='revisao'?'<label class="frota-relatorio-tipo">Tipo de revisão<select id="relatorio-tipo-inline"><option>Preventiva</option><option>Corretiva</option><option>Ambos</option></select></label>':''}<div class="frota-gerar-pdf-linha"><label>Gerar PDF<select id="relatorio-pdf-tipo"><option value="">Escolha Geral ou Seletivo</option><option value="geral">Geral</option><option value="seletivo">Seletivo</option></select></label></div><p class="frota-status" id="status-tabela-relatorio">Carregando tabela…</p><div id="tabela-relatorio-inline" class="frota-tabela-wrap"></div>`;
          const spec={abastecimentos:{table:'fuel_entries',date:'entry_date'},mecanica:{table:'mechanical_services',date:'service_date'},revisao:{table:'revisions',date:'completed_date'},pecas:{table:'stock_movements',date:'movement_date'},estoque:{table:'stock_balances',date:'name'}}[modulo];
          const statusTabela=document.getElementById('status-tabela-relatorio'), destino=document.getElementById('tabela-relatorio-inline');
          try{
            let q=supabaseClient.from(spec.table).select('*');
            if(modulo==='revisao'){const tipo=document.getElementById('relatorio-tipo-inline').value;if(tipo!=='Ambos')q=q.eq('revision_type',tipo);}
            const {data,error}=await q;if(error)throw error;let rows=data||[];
            if(spec.date)rows.sort((a,b)=>String(b[spec.date]||'').localeCompare(String(a[spec.date]||'')));
            const keys=rows.length?Object.keys(rows[0]).filter(k=>!['id','created_by','updated_at'].includes(k)):[];
            const fmt=k=>k.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
            const cell=(r,k)=>{const v=r[k];return v==null||v===''?'—':typeof v==='object'?JSON.stringify(v):String(v)};
            destino.innerHTML=rows.length?`<table class="frota-tabela"><thead><tr>${keys.map(k=>`<th>${escapar(fmt(k))}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${keys.map(k=>`<td>${escapar(cell(r,k))}</td>`).join('')}</tr>`).join('')}</tbody></table>`:'<p>Nenhum registro encontrado.</p>';
            statusTabela.textContent=`${rows.length} registro(s).`;
          }catch(e){console.error(e);statusTabela.textContent='Não foi possível carregar a tabela: '+e.message;}
          document.getElementById('relatorio-pdf-tipo').onchange=e=>{const tipo=e.target.value;if(tipo)abrirJanelaRelatorio(modulo,tipo);e.target.value='';};
        });
      });
      let dados=null;
      const status = document.getElementById('status-graficos');
      const painel = document.getElementById('painel-graficos');
      const moeda = n => Number(n || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
      async function buscar(tabela, campos) {
        const {data,error}=await supabaseClient.from(tabela).select(campos);
        if(error) throw new Error(`${tabela}: ${error.message}`);
        return data || [];
      }
      async function carregarDados() {
        status.textContent='Consultando abastecimentos e manutenção...';
        try {
          const [veiculos,abast,mecanica,revisoes,pecas]=await Promise.all([
            buscar('vehicles','id,name,plate'),
            buscar('fuel_entries','vehicle_id,consumption'),
            buscar('mechanical_services','vehicle_id,total_value,service_date'),
            buscar('revisions','vehicle_id,total_value,completed_date,due_date'),
            buscar('stock_movements','part_id,movement_type,quantity,unit_value,movement_date,reference,notes')
          ]);
          const nomes=new Map(veiculos.map(v=>[String(v.id),v.name || v.plate || 'Veículo']));
          const porVeiculo=new Map();
          const linha=id=>{const k=String(id||'sem-veiculo');if(!porVeiculo.has(k))porVeiculo.set(k,{nome:nomes.get(k)||'Veículo não identificado',consumos:[],mecanica:0,revisao:0,pecas:0});return porVeiculo.get(k);};
          abast.forEach(r=>{const x=linha(r.vehicle_id);if(Number(r.consumption)>0)x.consumos.push(Number(r.consumption));});
          mecanica.forEach(r=>linha(r.vehicle_id).mecanica+=Number(r.total_value||0));
          revisoes.forEach(r=>linha(r.vehicle_id).revisao+=Number(r.total_value||0));
          // Movimentos de saída representam aplicação/consumo de estoque. Entradas não contam como despesa aplicada.
          const saidas=pecas.filter(r=>/saida|saída|aplica|consumo|out/i.test(String(r.movement_type||'')) && /vehicle|veículo|placa|frota/i.test(String(r.reference||'')+' '+String(r.notes||'')));
          // unit_value é o custo por unidade registrado no movimento.
          saidas.forEach(r=>{const custo=Number(r.quantity||0)*Number(r.unit_value||0); if(custo>0){const texto=String(r.reference||'')+' '+String(r.notes||'');const v=veiculos.find(v=>texto.toLowerCase().includes(String(v.plate||'').toLowerCase())||texto.toLowerCase().includes(String(v.name||'').toLowerCase()));if(v)linha(v.id).pecas+=custo;}});
          const linhas=[...porVeiculo.values()].sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
          return {linhas, avisos: ['fuel_entries.total_value/amount e stock_movements.vehicle_id dependem do esquema instalado.']};
        } catch(e) { console.error(e); status.textContent=`Não foi possível montar os gráficos com os dados reais: ${e.message}. Confira os nomes das colunas e as permissões RLS.`; return null; }
      }
      function desenhar(dados) {
        if(!dados)return;
        graficosRelatorios.forEach(g=>g.destroy());graficosRelatorios=[];painel.replaceChildren();
        const tipo=document.getElementById('tipo-grafico').value,modo=document.getElementById('dados-grafico').value;
        const itens=dados.linhas;
        const cores={consumo:'#3b82f6',mecanica:'#1d4ed8',revisao:'#60a5fa',pecas:'#93c5fd'};
        function criarCartao(titulo, labels, datasets, pie=false){
          const card=document.createElement('article');card.className='frota-grafico-card';
          const h=document.createElement('h4');h.textContent=titulo;card.appendChild(h);
          const wrap=document.createElement('div');wrap.className='frota-canvas-wrap';const canvas=document.createElement('canvas');canvas.setAttribute('aria-label',titulo);wrap.appendChild(canvas);card.appendChild(wrap);painel.appendChild(card);
          const chart=new Chart(canvas,{type:pie?'pie':'bar',data:{labels,datasets:datasets.map(d=>({...d,backgroundColor:d.backgroundColor||cores[d.key]||'#3b82f6',borderWidth:1}))},options:{responsive:true,maintainAspectRatio:false,indexAxis:tipo==='coluna'?'x':'y',plugins:{legend:{position:pie?'bottom':'top'},tooltip:{callbacks:{label:c=>`${c.dataset.label||c.label}: ${c.dataset.key==='consumo'?Number(c.raw).toLocaleString('pt-BR',{maximumFractionDigits:2})+' km/l':moeda(c.raw)}`}}},scales:pie?{}:{x:{beginAtZero:true,stacked:false},y:{beginAtZero:true,stacked:false}}}});graficosRelatorios.push(chart);
        }
        if(modo==='consumo'||modo==='ambos'){
          const vals=itens.map(x=>x.consumos.length?x.consumos.reduce((a,b)=>a+b,0)/x.consumos.length:0);
          if(tipo==='pizza') criarCartao('Consumo médio por veículo (km/l)',itens.map(x=>x.nome),[{label:'Consumo médio',key:'consumo',data:vals,backgroundColor:itens.map((_,i)=>['#1d4ed8','#3b82f6','#60a5fa','#93c5fd','#bfdbfe'][i%5])}],true);
          else criarCartao('Consumo médio por veículo (km/l)',itens.map(x=>x.nome),[{label:'Consumo médio (km/l)',key:'consumo',data:vals,backgroundColor:cores.consumo}],false);
        }
        if(modo==='manutencao'||modo==='ambos'){
          const labels=itens.map(x=>x.nome), ds=[{label:'Mecânica',key:'mecanica',data:itens.map(x=>x.mecanica),backgroundColor:'#1d4ed8'},{label:'Revisão',key:'revisao',data:itens.map(x=>x.revisao),backgroundColor:'#3b82f6'},{label:'Peças',key:'pecas',data:itens.map(x=>x.pecas),backgroundColor:'#93c5fd'}];
          if(tipo==='pizza'){
            const soma=k=>itens.reduce((a,x)=>a+x[k],0);
            criarCartao('Gastos de manutenção por categoria', ['Mecânica','Revisão','Peças'],[{label:'Gastos',key:'valor',data:[soma('mecanica'),soma('revisao'),soma('pecas')],backgroundColor:['#1d4ed8','#3b82f6','#93c5fd']}],true);
          } else criarCartao('Gastos por veículo — categorias lado a lado',labels,ds,false);
        }
        status.textContent=itens.length?`Gráficos atualizados com ${itens.length} veículo(s). Consumo é média dos registros válidos; gastos são valores registrados.`:'Não há dados para exibir.';
      }
      document.getElementById('tipo-grafico').addEventListener('change',()=>desenhar(dados));
      document.getElementById('dados-grafico').addEventListener('change',()=>desenhar(dados));
      document.getElementById('atualizar-graficos').addEventListener('click',async()=>{dados=await carregarDados();desenhar(dados);});
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
      if (nomeModulo === "motoristas") renderizarMotoristas();
      if (nomeModulo === "abastecimentos") renderizarAbastecimentos();
      if (nomeModulo === "mecanica") renderizarManutencao("mecanica");
      if (nomeModulo === "revisao") renderizarManutencao("revisao");
      if (nomeModulo === "pecas") renderizarPecas();
      if (nomeModulo === "estoque") renderizarEstoque();
      if (nomeModulo === "financeiro") renderizarFinanceiro();
      if (nomeModulo === "relatorios") renderizarRelatorios();
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
