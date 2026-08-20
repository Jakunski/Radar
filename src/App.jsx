import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Radar, Calendar, Sun, RefreshCw, Sunrise, Mic, Bot,
  AlertTriangle, Trophy, Target, Sparkles, Bell,
  Home, Package, TrendingUp, BarChart2, Clock, ClipboardCheck,
  CheckCircle2, XCircle, ClipboardList, Medal, PartyPopper, ArrowUp, ArrowDown,
  Wallet, PieChart as PieChartIcon, Landmark, Shirt, Zap, ShieldCheck,
  User, CreditCard, Briefcase, Search, RotateCcw, Plus, Pencil, Trash2, AlertCircle,
  Phone, MessageCircle, MoreHorizontal, ImageIcon, ArrowLeftRight, Users, Filter, X,
  Download, Upload, Copy, Shield, LogOut, Eye, EyeOff, ArrowRight,
  FileSpreadsheet, FileText, Printer, Share2, SlidersHorizontal, WifiOff
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, BarChart, Bar, Legend } from "recharts";

const STORAGE_KEY = "radar:producoes";
const ACIONAMENTOS_KEY = "radar:acionamentos";
const OPORTUNIDADES_KEY = "radar:oportunidades_manuais";
const CONSULTORES_KEY = "radar:consultores";
const METAS_INDIVIDUAIS_KEY = "radar:metas_individuais";
const METAS_LOJA_KEY = "radar:metas_loja";
const CONFIG_KEY = "radar:config";

// ---- Dados fixos da loja (viram estado editável no App) ----
const CONSULTORES_PADRAO = [
  { id: "mariana", nome: "Mariana", foto: null },
  { id: "caroline", nome: "Caroline", foto: null },
  { id: "isabela", nome: "Isabela", foto: null },
  { id: "keylane", nome: "Keylane", foto: null },
];
const METAS_MENSAIS_PADRAO = { creditoPessoal: 50000, consignado: 40000, clt: 20000, antecipacao: 12500 };
const META_SEGURO_UNID_PADRAO = 6;
const ELEGIBILIDADE = { seguro: 3, consignado: 3, clt: 2, superConta: 4 };
const META_ACIONAMENTOS_DIA_CONSULTOR = 80;
const DIAS_UTEIS_MES_PADRAO = 22;
const DIAS_UTEIS_PASSADOS_PADRAO = 8;

const PRODUTOS_LANCAMENTO = [
  { id: "creditoPessoal", nome: "Crédito Pessoal" },
  { id: "consignado", nome: "Consignado" },
  { id: "clt", nome: "CLT (Consignado Privado)" },
  { id: "antecipacao", nome: "Antecipação" },
  { id: "seguro", nome: "Seguro" },
];
const TIPOS_CREDITO_PESSOAL = ["SuperConta", "Novo", "Refin"];
const MEDALHAS = ["#F5C518", "#B0B7C3", "#CD7F32"];

// ---- Helpers ----
function todayISO() { return new Date().toISOString().slice(0, 10); }
function mesAtual() { return todayISO().slice(0, 7); }
function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}
// Entende 2.500,00 (BR) / 2500,00 / 2,500.00 (US) / 2500 — sem se confundir com qual é o separador decimal
function parseValorMonetario(str) {
  if (!str) return 0;
  let s = String(str).trim().replace(/[^\d.,]/g, "");
  if (!s) return 0;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", "."); // BR: 2.500,00
    else s = s.replace(/,/g, ""); // US: 2,500.00
  } else if (lastComma > -1) {
    s = s.replace(",", "."); // só vírgula → decimal BR: 2500,00
  }
  return Number(s) || 0;
}
function formatBRLCurto(v) {
  return (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}
function formatBRL(v) {
  return (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function iniciais(nome) { return nome.slice(0, 2).toUpperCase(); }
function horaAgora() { return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); }
function formatCPF(v) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}
function formatTelefone(v) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").trim().replace(/-$/, "");
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").trim().replace(/-$/, "");
}
function ultimosDias(n) {
  const arr = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    arr.push(d.toISOString().slice(0, 10));
  }
  return arr;
}

const inputClass = "w-full rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-xs text-violet-950 outline-none focus:border-violet-400 transition mb-3";

// ============================================================
// APP — estado compartilhado entre todas as telas
// ============================================================
export default function RadarSistema() {
  const [logado, setLogado] = useState(false);
  const [perfil, setPerfil] = useState("supervisora"); // 'supervisora' | 'consultor'
  const [consultorLogadoId, setConsultorLogadoId] = useState(null);
  const [tela, setTela] = useState("matinal");
  const [producoes, setProducoes] = useState([]);
  const [acionamentos, setAcionamentos] = useState([]);
  const [oportunidadesManuais, setOportunidadesManuais] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState(false);
  // indicador de conexão — avisa ANTES de tentar lançar algo com internet ruim
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  useEffect(() => {
    function ficouOnline() { setOnline(true); }
    function ficouOffline() { setOnline(false); }
    window.addEventListener("online", ficouOnline);
    window.addEventListener("offline", ficouOffline);
    return () => {
      window.removeEventListener("online", ficouOnline);
      window.removeEventListener("offline", ficouOffline);
    };
  }, []);

  const [diasUteisMes, setDiasUteisMes] = useState(DIAS_UTEIS_MES_PADRAO);
  const [diasUteisPassados, setDiasUteisPassados] = useState(DIAS_UTEIS_PASSADOS_PADRAO);
  const [consultores, setConsultores] = useState(CONSULTORES_PADRAO);
  const [metasIndividuais, setMetasIndividuais] = useState(() => {
    const obj = {};
    CONSULTORES_PADRAO.forEach((c) => { obj[c.id] = { ...METAS_MENSAIS_PADRAO }; });
    return obj;
  });
  const [metaSeguroUnid, setMetaSeguroUnid] = useState(META_SEGURO_UNID_PADRAO);
  const [supervisorPin, setSupervisorPin] = useState("");
  // ---- bloqueio automático por inatividade ----
  // depois de um tempo sem uso, a tela trava e pede o PIN de novo — protege
  // contra alguém deixar o sistema aberto sem querer num computador
  // compartilhado. Só bloqueia se o perfil logado tiver um PIN configurado
  // (senão não há o que validar pra desbloquear).
  const MINUTOS_INATIVIDADE = 5;
  const [travado, setTravado] = useState(false);
  const ultimaAtividadeRef = useRef(Date.now());
  useEffect(() => {
    function registrarAtividade() { ultimaAtividadeRef.current = Date.now(); }
    ["mousedown", "keydown", "touchstart", "scroll"].forEach((ev) => window.addEventListener(ev, registrarAtividade));
    const intervalo = setInterval(() => {
      const pinDoPerfilAtual = perfil === "supervisora" ? supervisorPin : (consultores.find((c) => c.id === consultorLogadoId)?.pin || "");
      const temPinConfigurado = pinDoPerfilAtual && pinDoPerfilAtual.trim();
      if (logado && temPinConfigurado && !travado && Date.now() - ultimaAtividadeRef.current > MINUTOS_INATIVIDADE * 60 * 1000) {
        setTravado(true);
      }
    }, 15000);
    return () => {
      ["mousedown", "keydown", "touchstart", "scroll"].forEach((ev) => window.removeEventListener(ev, registrarAtividade));
      clearInterval(intervalo);
    };
  }, [logado, perfil, consultorLogadoId, supervisorPin, consultores, travado]);
  function desbloquear() {
    ultimaAtividadeRef.current = Date.now();
    setTravado(false);
  }
  const [supervisorFoto, setSupervisorFoto] = useState(null);
  const [metaLojaPorProduto, setMetaLojaPorProduto] = useState(() => {
    const obj = {};
    Object.keys(METAS_MENSAIS_PADRAO).forEach((pid) => { obj[pid] = METAS_MENSAIS_PADRAO[pid] * CONSULTORES_PADRAO.length; });
    return obj;
  });

  // Busca uma chave tentando algumas vezes se for erro de CONEXÃO
  // (rede instável, offline, timeout). Erro de "não existe" não tenta de
  // novo — aí sim é porque a chave nunca foi salva. Isso evita que uma
  // falha momentânea de internet faça a tela parecer "vazia" quando na
  // verdade os dados continuam salvos no banco.
  async function buscarComRetentativa(key, tentativas = 4) {
    for (let i = 0; i < tentativas; i++) {
      try {
        return await window.storage.get(key, false);
      } catch (e) {
        if (e?.isNetworkError && i < tentativas - 1) {
          await new Promise((r) => setTimeout(r, 800 * (i + 1)));
          continue;
        }
        if (e?.isNetworkError) throw e; // esgotou as tentativas
        return null; // não existe mesmo — tudo bem, é primeira vez
      }
    }
  }

  useEffect(() => {
    (async () => {
      let falhaDeConexao = false;
      try {
        const r1 = await buscarComRetentativa(STORAGE_KEY);
        setProducoes(r1 ? JSON.parse(r1.value) : []);
      } catch (e) { falhaDeConexao = true; }
      try {
        const r2 = await buscarComRetentativa(ACIONAMENTOS_KEY);
        setAcionamentos(r2 ? JSON.parse(r2.value) : []);
      } catch (e) { falhaDeConexao = true; }
      try {
        const r3 = await buscarComRetentativa(OPORTUNIDADES_KEY);
        setOportunidadesManuais(r3 ? JSON.parse(r3.value) : []);
      } catch (e) { falhaDeConexao = true; }
      try {
        const r4 = await buscarComRetentativa(CONSULTORES_KEY);
        if (r4) setConsultores(JSON.parse(r4.value));
      } catch (e) { falhaDeConexao = true; }
      try {
        const r5 = await buscarComRetentativa(METAS_INDIVIDUAIS_KEY);
        if (r5) setMetasIndividuais(JSON.parse(r5.value));
      } catch (e) { falhaDeConexao = true; }
      try {
        const r6 = await buscarComRetentativa(METAS_LOJA_KEY);
        if (r6) setMetaLojaPorProduto(JSON.parse(r6.value));
      } catch (e) { falhaDeConexao = true; }
      try {
        const r7 = await buscarComRetentativa(CONFIG_KEY);
        if (r7) {
          const cfg = JSON.parse(r7.value);
          if (cfg.diasUteisMes) setDiasUteisMes(cfg.diasUteisMes);
          if (cfg.diasUteisPassados !== undefined) setDiasUteisPassados(cfg.diasUteisPassados);
          if (cfg.metaSeguroUnid !== undefined) setMetaSeguroUnid(cfg.metaSeguroUnid);
          if (cfg.supervisorPin !== undefined) setSupervisorPin(cfg.supervisorPin);
          if (cfg.supervisorFoto !== undefined) setSupervisorFoto(cfg.supervisorFoto);
        }
      } catch (e) { falhaDeConexao = true; }
      setErroCarregamento(falhaDeConexao);
      try {
        const sessaoSalva = window.localStorage.getItem("radar:sessao");
        if (sessaoSalva) {
          const s = JSON.parse(sessaoSalva);
          setPerfil(s.perfil || "supervisora");
          setConsultorLogadoId(s.consultorLogadoId || null);
          setTela(s.perfil === "consultor" ? "minhaProducao" : "matinal");
          setLogado(true);
        }
      } catch (e) { /* sem sessão salva, mostra o login normalmente */ }
      setLoading(false);
    })();
  }, []);

  // salvamento resistente (tenta 2x, mas SEMPRE atualiza o estado local na hora —
  // é por isso que as telas ficam em sincronia mesmo se o armazenamento falhar)
  async function persistir(key, novaLista, tentativa = 1) {
    try {
      if (typeof window === "undefined" || !window.storage) throw new Error("Armazenamento indisponível.");
      const resultado = await window.storage.set(key, JSON.stringify(novaLista), false);
      if (!resultado) throw new Error("Resposta vazia do armazenamento.");
      return { ok: true };
    } catch (e) {
      if (tentativa < 2) {
        await new Promise((r) => setTimeout(r, 500));
        return persistir(key, novaLista, tentativa + 1);
      }
      return { ok: false, erro: e?.message || "erro desconhecido" };
    }
  }

  async function salvarProducoes(novaLista) {
    // Camada de segurança: antes de sobrescrever, comparamos com o que
    // está REALMENTE salvo no banco agora (não com a tela local, que pode
    // estar desatualizada/incompleta por falha de carregamento). Se a nova
    // lista tiver bem menos itens que o banco, pedimos confirmação extra —
    // isso teria evitado o incidente de produções apagadas.
    try {
      const atual = await window.storage.get(STORAGE_KEY, false);
      if (atual) {
        const listaAtualBanco = JSON.parse(atual.value);
        const diferenca = listaAtualBanco.length - novaLista.length;
        if (diferenca >= 3 && novaLista.length < listaAtualBanco.length * 0.8) {
          const confirmou = window.confirm(
            `Atenção: o banco tem ${listaAtualBanco.length} produções salvas, mas essa ação deixaria apenas ${novaLista.length}.\n\n` +
            `Isso normalmente indica que a tela não carregou tudo corretamente (ex.: falha de internet), e salvar agora apagaria ${diferenca} produções de verdade.\n\n` +
            `Recomendamos: cancelar, atualizar a página (F5) e tentar de novo.\n\nDeseja mesmo continuar e salvar assim mesmo?`
          );
          if (!confirmou) return { ok: false, erro: "Cancelado por segurança — quantidade de produções caiu demais." };
        }
        // guarda a versão atual do banco como backup antes de sobrescrever
        await window.storage.set(STORAGE_KEY + ":backup_anterior", atual.value, false);
      }
    } catch (e) { /* se essa checagem falhar, não travamos o salvamento normal */ }
    setProducoes(novaLista); // atualiza todas as telas imediatamente
    return persistir(STORAGE_KEY, novaLista);
  }

  // Pra ADICIONAR/EDITAR/EXCLUIR uma única produção com várias pessoas
  // usando o sistema ao mesmo tempo em computadores diferentes: usamos uma
  // atualização ATÔMICA do banco (ler + mudar + salvar como uma coisa só,
  // garantida pelo Firestore). Se duas pessoas salvarem no mesmo instante,
  // o banco processa uma de cada vez e NENHUMA fica de fora — diferente de
  // buscar e salvar em passos separados, onde uma podia sobrescrever a
  // outra se caíssem no mesmo segundo.
  async function salvarProducaoUnica(funcaoMudanca) {
    try {
      // guarda um backup da versão de antes, best-effort (não trava o salvamento se falhar)
      try {
        const antes = await window.storage.get(STORAGE_KEY, false);
        if (antes) await window.storage.set(STORAGE_KEY + ":backup_anterior", antes.value, false);
      } catch (e) { /* segue mesmo assim */ }
      const r = await window.storage.updateAtomico(STORAGE_KEY, funcaoMudanca);
      setProducoes(r.value); // atualiza a tela com o que realmente ficou salvo no banco
      return { ok: true };
    } catch (e) {
      return { ok: false, erro: e?.message || String(e) };
    }
  }
  async function salvarAcionamentos(novaLista) {
    setAcionamentos(novaLista);
    return persistir(ACIONAMENTOS_KEY, novaLista);
  }
  // mesma proteção atômica dos lançamentos de produção
  async function salvarAcionamentoUnico(funcaoMudanca) {
    try {
      const r = await window.storage.updateAtomico(ACIONAMENTOS_KEY, funcaoMudanca);
      setAcionamentos(r.value);
      return { ok: true };
    } catch (e) {
      return { ok: false, erro: e?.message || String(e) };
    }
  }
  async function salvarOportunidades(novaLista) {
    setOportunidadesManuais(novaLista);
    return persistir(OPORTUNIDADES_KEY, novaLista);
  }

  // ---- gerenciamento de consultores e metas individuais (agora com persistência real) ----
  async function adicionarConsultor(nome, externo = false) {
    const id = `${nome.toLowerCase().trim().replace(/\s+/g, "-")}-${Date.now()}`;
    try {
      const rc = await window.storage.updateAtomico(CONSULTORES_KEY, (lista) => [...(lista || []), { id, nome: nome.trim(), foto: null, externo, pin: "" }]);
      setConsultores(rc.value);
    } catch (e) { /* mantemos o botão respondendo mesmo se a persistência remota falhar */ }
    try {
      const rm = await window.storage.updateAtomico(METAS_INDIVIDUAIS_KEY, (obj) => {
        const base = (Array.isArray(obj) ? {} : obj) || {};
        return { ...base, [id]: { creditoPessoal: 0, consignado: 0, clt: 0, antecipacao: 0 } };
      });
      setMetasIndividuais(rm.value);
    } catch (e) {}
  }
  async function removerConsultor(id) {
    try {
      const rc = await window.storage.updateAtomico(CONSULTORES_KEY, (lista) => (lista || []).filter((c) => c.id !== id));
      setConsultores(rc.value);
    } catch (e) {}
    try {
      const rm = await window.storage.updateAtomico(METAS_INDIVIDUAIS_KEY, (obj) => {
        const base = { ...((Array.isArray(obj) ? {} : obj) || {}) };
        delete base[id];
        return base;
      });
      setMetasIndividuais(rm.value);
    } catch (e) {}
  }
  async function atualizarFotoConsultor(id, fotoDataUrl) {
    try {
      const r = await window.storage.updateAtomico(CONSULTORES_KEY, (lista) => (lista || []).map((c) => (c.id === id ? { ...c, foto: fotoDataUrl } : c)));
      setConsultores(r.value);
    } catch (e) {}
  }
  async function atualizarConsultorCampo(id, campo, valor) {
    try {
      const r = await window.storage.updateAtomico(CONSULTORES_KEY, (lista) => (lista || []).map((c) => (c.id === id ? { ...c, [campo]: valor } : c)));
      setConsultores(r.value);
      return { ok: true };
    } catch (e) {
      return { ok: false, erro: e?.message || String(e) };
    }
  }
  async function atualizarMetaIndividual(id, produtoId, valor) {
    try {
      const r = await window.storage.updateAtomico(METAS_INDIVIDUAIS_KEY, (obj) => {
        const base = (Array.isArray(obj) ? {} : obj) || {};
        return { ...base, [id]: { ...(base[id] || {}), [produtoId]: Number(valor) || 0 } };
      });
      setMetasIndividuais(r.value);
    } catch (e) {}
  }

  // ---- cálculos compartilhados (usados por Matinal, Painel e Parcial) ----
  const mesRef = mesAtual();
  const producoesMes = useMemo(() => producoes.filter((p) => (p.data || "").slice(0, 7) === mesRef), [producoes, mesRef]);
  // só "Pago" entra nos números oficiais (Matinal, Painel, Elegibilidade). "Digitado" ainda não confirmado
  // pela supervisora. Lançamentos antigos sem status (de antes dessa função existir) contam como pagos,
  // pra não sumir produção que já estava valendo.
  const producoesMesPagas = useMemo(() => producoesMes.filter((p) => !p.status || p.status === "pago"), [producoesMes]);

  // consultores "de loja" = não-externos. Só eles entram na meta/Mix oficial da loja.
  const consultoresLoja = consultores.filter((c) => !c.externo);

  function totalMesConsultorProduto(consultorId, produtoId) {
    return producoesMesPagas.filter((p) => p.consultorId === consultorId && p.produto === produtoId)
      .reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
  }
  function totalMesConsultorMix(consultorId) {
    return ["creditoPessoal", "consignado", "clt", "antecipacao"].reduce((s, prod) => s + totalMesConsultorProduto(consultorId, prod), 0);
  }
  const producaoMesLojaGlobal = consultoresLoja.reduce((acc, c) => acc + totalMesConsultorMix(c.id), 0);
  function contratosMesConsultorProduto(consultorId, produtoId) {
    return producoesMesPagas.filter((p) => p.consultorId === consultorId && p.produto === produtoId).length;
  }
  // SuperConta conta por CPF único — mesmo cliente lançado 2x não conta em dobro
  function superContasUnicasMesConsultor(consultorId) {
    const cpfs = producoesMesPagas
      .filter((p) => p.consultorId === consultorId && p.produto === "creditoPessoal" && p.tipoCredito === "SuperConta")
      .map((p) => (p.cpf || "").replace(/\D/g, ""))
      .filter(Boolean);
    return new Set(cpfs).size;
  }
  // meta individual: cada consultor tem a sua própria, diferente de colega pra colega
  function metaIndividualConsultorProduto(consultorId, produtoId) {
    return (metasIndividuais[consultorId] || {})[produtoId] || 0;
  }
  function metaIndividualConsultorMix(consultorId) {
    return ["creditoPessoal", "consignado", "clt", "antecipacao"].reduce((s, p) => s + metaIndividualConsultorProduto(consultorId, p), 0);
  }
  // meta da loja por produto: valor oficial definido em Configurações (independente da soma das individuais)
  function metaLojaProdutoTotal(produtoId) {
    return Number(metaLojaPorProduto[produtoId]) || 0;
  }
  async function atualizarMetaLojaProduto(produtoId, valor) {
    try {
      const r = await window.storage.updateAtomico(METAS_LOJA_KEY, (obj) => {
        const base = (Array.isArray(obj) ? {} : obj) || {};
        return { ...base, [produtoId]: Number(valor) || 0 };
      });
      setMetaLojaPorProduto(r.value);
    } catch (e) {}
  }
  // salva os 4 produtos de uma vez só — evita o bug de chamadas sequenciais lerem
  // o mesmo estado "velho" e se sobrescreverem umas às outras
  async function atualizarMetaLojaTodos(novoObjeto) {
    const limpo = {
      creditoPessoal: Number(novoObjeto.creditoPessoal) || 0,
      consignado: Number(novoObjeto.consignado) || 0,
      clt: Number(novoObjeto.clt) || 0,
      antecipacao: Number(novoObjeto.antecipacao) || 0,
    };
    try {
      const r = await window.storage.updateAtomico(METAS_LOJA_KEY, () => limpo);
      setMetaLojaPorProduto(r.value);
    } catch (e) {
      setMetaLojaPorProduto(limpo); // mantém a tela atualizada mesmo se a persistência remota falhar
    }
  }
  const metaLojaMix = ["creditoPessoal", "consignado", "clt", "antecipacao"].reduce((s, p) => s + metaLojaProdutoTotal(p), 0);

  async function salvarConfig(novoDiasUteisMes, novoDiasUteisPassados, novoMetaSeguroUnid, novoSupervisorPin, novoSupervisorFoto) {
    if (novoDiasUteisMes !== undefined) setDiasUteisMes(novoDiasUteisMes);
    if (novoDiasUteisPassados !== undefined) setDiasUteisPassados(novoDiasUteisPassados);
    if (novoMetaSeguroUnid !== undefined) setMetaSeguroUnid(novoMetaSeguroUnid);
    if (novoSupervisorPin !== undefined) setSupervisorPin(novoSupervisorPin);
    if (novoSupervisorFoto !== undefined) setSupervisorFoto(novoSupervisorFoto);
    // atualização atômica: lê o que está de verdade no banco, mescla só os
    // campos que mudaram, e salva — evita perder configuração por causa de
    // duas mudanças salvas quase juntas (ex.: PIN + dias úteis)
    try {
      const r = await window.storage.updateAtomico(CONFIG_KEY, (atual) => {
        const base = (atual && typeof atual === "object" && !Array.isArray(atual)) ? atual : {};
        return {
          diasUteisMes: novoDiasUteisMes ?? base.diasUteisMes ?? diasUteisMes,
          diasUteisPassados: novoDiasUteisPassados ?? base.diasUteisPassados ?? diasUteisPassados,
          metaSeguroUnid: novoMetaSeguroUnid ?? base.metaSeguroUnid ?? metaSeguroUnid,
          supervisorPin: novoSupervisorPin ?? base.supervisorPin ?? supervisorPin,
          supervisorFoto: novoSupervisorFoto ?? base.supervisorFoto ?? supervisorFoto,
        };
      });
      return { ok: true, valor: r.value };
    } catch (e) {
      return { ok: false, erro: e?.message || "Não consegui salvar. Verifique sua conexão e tente de novo." };
    }
  }


  const ctx = {
    producoes, acionamentos, oportunidadesManuais, loading, diasUteisMes, diasUteisPassados,
    consultores, consultoresLoja, adicionarConsultor, removerConsultor, atualizarFotoConsultor, atualizarConsultorCampo,
    metasIndividuais, atualizarMetaIndividual, metaSeguroUnid,
    metaLojaPorProduto, atualizarMetaLojaProduto, atualizarMetaLojaTodos, metaLojaMix,
    salvarProducoes, salvarProducaoUnica, salvarAcionamentos, salvarAcionamentoUnico, salvarOportunidades, totalMesConsultorProduto, totalMesConsultorMix, contratosMesConsultorProduto,
    superContasUnicasMesConsultor, metaIndividualConsultorProduto, metaIndividualConsultorMix, metaLojaProdutoTotal,
    supervisorPin, supervisorFoto, salvarConfig,
  };

  const telasPermitidasConsultor = ["minhaProducao", "producao", "radarComercial"];
  const telaEfetiva = perfil === "consultor" && !telasPermitidasConsultor.includes(tela) ? "minhaProducao" : tela;
  const consultorLogado = consultores.find((c) => c.id === consultorLogadoId);

  function entrar(perfilEscolhido, consultorId) {
    setPerfil(perfilEscolhido);
    setConsultorLogadoId(consultorId || null);
    setTela(perfilEscolhido === "consultor" ? "minhaProducao" : "matinal");
    setLogado(true);
    try {
      window.localStorage.setItem("radar:sessao", JSON.stringify({ perfil: perfilEscolhido, consultorLogadoId: consultorId || null }));
    } catch (e) { /* se der erro, só não persiste a sessão — não trava o login */ }
  }
  function sair() {
    setLogado(false);
    setPerfil("supervisora");
    setConsultorLogadoId(null);
    try { window.localStorage.removeItem("radar:sessao"); } catch (e) {}
  }

  // lembrete de backup manual — só pra supervisora, uma vez por semana,
  // com opção de adiar por hoje sem incomodar de novo até o dia seguinte
  const [lembreteBackupAdiado, setLembreteBackupAdiado] = useState(false);
  const mostrarLembreteBackup = (() => {
    if (perfil !== "supervisora" || !logado || lembreteBackupAdiado) return false;
    try {
      const ultimo = window.localStorage.getItem("radar:ultimoBackupManual");
      const adiadoAte = window.localStorage.getItem("radar:lembreteBackupAdiadoAte");
      if (adiadoAte && new Date(adiadoAte) > new Date()) return false;
      if (!ultimo) return true;
      const diasDesde = (Date.now() - new Date(ultimo).getTime()) / (1000 * 60 * 60 * 24);
      return diasDesde >= 7;
    } catch (e) { return false; }
  })();
  function adiarLembreteBackup() {
    try {
      const amanha = new Date(); amanha.setDate(amanha.getDate() + 1);
      window.localStorage.setItem("radar:lembreteBackupAdiadoAte", amanha.toISOString());
    } catch (e) {}
    setLembreteBackupAdiado(true);
  }

  if (!logado) {
    return <TelaLogin onEntrar={entrar} producaoMesLoja={producaoMesLojaGlobal} metaLojaMix={metaLojaMix} consultores={consultores} supervisorPin={supervisorPin} />;
  }

  if (travado) {
    const pinEsperado = perfil === "supervisora" ? supervisorPin : (consultores.find((c) => c.id === consultorLogadoId)?.pin || "");
    const nomeAtual = perfil === "supervisora" ? "Letícia — Supervisora" : (consultores.find((c) => c.id === consultorLogadoId)?.nome || "Consultor(a)");
    return <TelaBloqueada nome={nomeAtual} pinEsperado={pinEsperado} onDesbloquear={desbloquear} onSair={sair} />;
  }

  return (
    <div className="min-h-screen w-full bg-violet-50 flex font-[Inter,sans-serif]">
      <Sidebar tela={telaEfetiva} setTela={setTela} onSair={sair} perfil={perfil} consultorLogado={consultorLogado} supervisorFoto={supervisorFoto} salvarConfig={salvarConfig} />
      <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {!online && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <WifiOff size={16} className="flex-shrink-0" />
            <span><strong>Sem conexão com a internet.</strong> Espera a conexão voltar antes de lançar produção — lançamentos feitos agora podem não salvar.</span>
          </div>
        )}
        {erroCarregamento && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertTriangle size={16} className="flex-shrink-0" />
            <span>
              <strong>Não consegui carregar todos os dados.</strong> Isso costuma ser conexão instável — seus dados continuam salvos, não foram apagados.
              {" "}
              <button type="button" onClick={() => window.location.reload()} className="underline font-semibold">Tentar de novo</button>
            </span>
          </div>
        )}
        {mostrarLembreteBackup && (
          <div className="flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-700">
            <Shield size={16} className="flex-shrink-0" />
            <span className="flex-1">
              <strong>Que tal exportar um backup?</strong> Faz mais de uma semana desde o último backup manual salvo.
              {" "}
              <button type="button" onClick={() => setTela("backup")} className="underline font-semibold">Ir para Backup</button>
            </span>
            <button type="button" onClick={adiarLembreteBackup} className="text-violet-400 hover:text-violet-600 flex-shrink-0"><X size={16} /></button>
          </div>
        )}
        <MobileNav tela={telaEfetiva} setTela={setTela} perfil={perfil} />
        {perfil === "consultor" ? (
          <>
            {telaEfetiva === "minhaProducao" && <TelaMinhaProducao {...ctx} consultorLogadoId={consultorLogadoId} />}
            {telaEfetiva === "producao" && <TelaCentralProducao {...ctx} consultorFixoId={consultorLogadoId} />}
            {telaEfetiva === "radarComercial" && <TelaRadarComercial {...ctx} consultorFixoId={consultorLogadoId} />}
          </>
        ) : (
          <>
            {telaEfetiva === "matinal" && <TelaMatinal {...ctx} />}
            {telaEfetiva === "painel" && <TelaPainelEstrategico {...ctx} />}
            {telaEfetiva === "parcial" && <TelaParcialDia {...ctx} />}
            {telaEfetiva === "producao" && <TelaCentralProducao {...ctx} />}
            {telaEfetiva === "radarComercial" && <TelaRadarComercial {...ctx} />}
            {telaEfetiva === "backup" && <TelaBackup {...ctx} />}
            {telaEfetiva === "config" && <TelaConfiguracoes {...ctx} />}
            {telaEfetiva === "relatorios" && <TelaRelatorios {...ctx} />}
          </>
        )}
      </main>
    </div>
  );
}

function MobileNav({ tela, setTela, perfil }) {
  const itensSupervisora = [
    { id: "matinal", icon: <Sun size={14} />, label: "Matinal" },
    { id: "painel", icon: <BarChart2 size={14} />, label: "Painel Estratégico" },
    { id: "parcial", icon: <TrendingUp size={14} />, label: "Parcial do Dia" },
    { id: "producao", icon: <Package size={14} />, label: "Central de Produção" },
    { id: "radarComercial", icon: <Radar size={14} />, label: "Radar Comercial" },
    { id: "relatorios", icon: <FileText size={14} />, label: "Relatórios" },
    { id: "backup", icon: <Shield size={14} />, label: "Backup" },
    { id: "config", icon: <Home size={14} />, label: "Configurações" },
  ];
  const itensConsultor = [
    { id: "minhaProducao", icon: <Sun size={14} />, label: "Minha Produção" },
    { id: "producao", icon: <Package size={14} />, label: "Lançar Produção" },
    { id: "radarComercial", icon: <Radar size={14} />, label: "Meus Clientes" },
  ];
  const itens = perfil === "consultor" ? itensConsultor : itensSupervisora;
  return (
    <div className="lg:hidden -mx-4 sm:-mx-6 px-4 sm:px-6 mb-1">
      <div className="flex gap-2 overflow-x-auto pb-2 -mb-2 scrollbar-hide">
        {itens.map((it) => (
          <button key={it.id} onClick={() => setTela(it.id)}
            className={`flex items-center gap-1.5 shrink-0 rounded-xl px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition ${tela === it.id ? "bg-violet-600 text-white shadow-md" : "bg-white text-slate-500 border border-violet-100"}`}>
            {it.icon}{it.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Sidebar({ tela, setTela, onSair, perfil, consultorLogado, supervisorFoto, salvarConfig }) {
  const itensSupervisora = [
    { id: "matinal", icon: <Sun size={16} />, label: "Matinal" },
    { id: "painel", icon: <BarChart2 size={16} />, label: "Painel Estratégico" },
    { id: "parcial", icon: <TrendingUp size={16} />, label: "Parcial do Dia" },
    { id: "producao", icon: <Package size={16} />, label: "Central de Produção" },
    { id: "radarComercial", icon: <Radar size={16} />, label: "Radar Comercial" },
    { id: "relatorios", icon: <FileText size={16} />, label: "Relatórios" },
    { id: "backup", icon: <Shield size={16} />, label: "Backup" },
    { id: "config", icon: <Home size={16} />, label: "Configurações" },
  ];
  const itensConsultor = [
    { id: "minhaProducao", icon: <Sun size={16} />, label: "Minha Produção" },
    { id: "producao", icon: <Package size={16} />, label: "Lançar Produção" },
    { id: "radarComercial", icon: <Radar size={16} />, label: "Meus Clientes" },
  ];
  const itens = perfil === "consultor" ? itensConsultor : itensSupervisora;
  return (
    <aside className="hidden lg:flex flex-col w-60 shrink-0 bg-gradient-to-b from-violet-950 to-violet-900 text-white px-5 py-6">
      <div className="flex items-center gap-2.5 mb-1">
        <RadarMiniLogo />
        <div className="leading-tight">
          <span className="text-lg font-extrabold tracking-tight block">RADAR</span>
          <span className="text-[9px] text-violet-300 tracking-wide">GESTÃO COMERCIAL</span>
        </div>
      </div>
      <p className="text-[11px] text-violet-300 mb-6 mt-2 leading-snug">Transformando dados em decisões.</p>

      {perfil === "consultor" && consultorLogado && (
        <div className="flex items-center gap-2.5 rounded-xl bg-white/10 border border-white/10 px-3 py-2.5 mb-4">
          <Avatar nome={consultorLogado.nome} foto={consultorLogado.foto} size={30} />
          <div className="leading-tight">
            <p className="text-xs font-bold text-white">{consultorLogado.nome}</p>
            <p className="text-[10px] text-violet-300">Consultor</p>
          </div>
        </div>
      )}

      {perfil === "supervisora" && (
        <div className="flex items-center gap-2.5 rounded-xl bg-white/10 border border-white/10 px-3 py-2.5 mb-4">
          <label className="relative cursor-pointer group shrink-0">
            <Avatar nome="Letícia" foto={supervisorFoto} size={44} />
            <input type="file" accept="image/*" className="hidden" onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file || !salvarConfig) return;
              const reader = new FileReader();
              reader.onload = () => salvarConfig(undefined, undefined, undefined, undefined, reader.result);
              reader.readAsDataURL(file);
            }} />
            <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-violet-600 text-white flex items-center justify-center text-[8px] group-hover:bg-violet-700 border border-violet-900">
              <Pencil size={8} />
            </span>
          </label>
          <div className="leading-tight">
            <p className="text-xs font-bold text-white">Letícia</p>
            <p className="text-[10px] text-violet-300">Supervisora</p>
          </div>
        </div>
      )}

      <nav className="flex flex-col gap-1 text-sm">
        {itens.map((it) => (
          <button key={it.id} onClick={() => setTela(it.id)}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition text-left ${tela === it.id ? "bg-violet-600 text-white font-semibold shadow-lg" : "text-violet-300 hover:bg-white/5"}`}>
            {it.icon}<span className="text-sm">{it.label}</span>
          </button>
        ))}
      </nav>

      <div className="mt-auto pt-6 space-y-3">
        <div className="rounded-2xl bg-gradient-to-br from-orange-500/20 to-violet-600/20 border border-white/10 p-4 text-center">
          <div className="mx-auto w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center mb-2 shadow-lg">
            <Target size={18} className="text-white" />
          </div>
          <p className="text-[11px] font-bold text-orange-400 tracking-wide">NOSSA MISSÃO</p>
          <p className="text-xs text-violet-100 mt-1 leading-snug">Atingir metas com foco, disciplina e consistência.</p>
        </div>
        <button onClick={onSair} className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/10 text-violet-300 hover:text-white hover:bg-white/5 px-3 py-2.5 text-xs font-semibold transition">
          <LogOut size={14} /> Sair
        </button>
      </div>
    </aside>
  );
}

// ============================================================
// TELA: LOGIN
// ============================================================
function TelaBloqueada({ nome, pinEsperado, onDesbloquear, onSair }) {
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState("");
  const [mostrarPin, setMostrarPin] = useState(false);

  function tentar(e) {
    e.preventDefault();
    if (pin !== pinEsperado) {
      setErro("PIN incorreto.");
      setPin("");
      return;
    }
    onDesbloquear();
  }

  return (
    <div className="min-h-screen w-full bg-violet-950/95 backdrop-blur-sm flex items-center justify-center p-4 font-[Inter,sans-serif]">
      <form onSubmit={tentar} className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 w-full max-w-xs text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center mx-auto">
          <Shield size={26} className="text-violet-600" />
        </div>
        <div>
          <h1 className="text-base font-extrabold text-violet-950">Sessão bloqueada</h1>
          <p className="text-xs text-slate-400 mt-1">Por inatividade. Digite o PIN de <strong>{nome}</strong> para continuar.</p>
        </div>
        <div className="relative">
          <input
            type={mostrarPin ? "text" : "password"} inputMode="numeric" maxLength={6} autoFocus
            value={pin} onChange={(e) => { setPin(e.target.value.replace(/\D/g, "")); setErro(""); }}
            placeholder="PIN"
            className="w-full text-center tracking-[0.5em] text-lg font-bold rounded-xl border border-violet-100 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-violet-300"
          />
          <button type="button" onClick={() => setMostrarPin(!mostrarPin)} className="absolute right-3 top-1/2 -translate-y-1/2 text-violet-300 hover:text-violet-600 transition">
            {mostrarPin ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {erro && <p className="text-xs font-semibold text-red-600">{erro}</p>}
        <button type="submit" className="w-full rounded-xl bg-violet-600 text-white py-3 text-sm font-bold hover:bg-violet-700 transition">Desbloquear</button>
        <button type="button" onClick={onSair} className="w-full text-xs text-slate-400 hover:text-slate-600 transition flex items-center justify-center gap-1.5">
          <LogOut size={12} /> Sair e trocar de usuário
        </button>
      </form>
    </div>
  );
}

function TelaLogin({ onEntrar, producaoMesLoja, metaLojaMix, consultores, supervisorPin }) {
  const [perfilEscolhido, setPerfilEscolhido] = useState("supervisora");
  const [consultorEscolhidoId, setConsultorEscolhidoId] = useState("");
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState("");
  const pctMes = metaLojaMix > 0 ? Math.round((producaoMesLoja / metaLojaMix) * 100) : 0;

  function entrar(e) {
    e.preventDefault();
    if (perfilEscolhido === "consultor" && !consultorEscolhidoId) {
      setErro("Selecione qual consultor é você.");
      return;
    }
    // valida o PIN só se um PIN tiver sido configurado em Configurações — assim não trava
    // ninguém enquanto o PIN ainda não foi definido pela primeira vez.
    if (perfilEscolhido === "supervisora") {
      if (supervisorPin && supervisorPin.trim() && senha !== supervisorPin) {
        setErro("PIN incorreto.");
        return;
      }
    } else {
      const consultor = consultores.find((c) => c.id === consultorEscolhidoId);
      if (consultor?.pin && consultor.pin.trim() && senha !== consultor.pin) {
        setErro("PIN incorreto.");
        return;
      }
    }
    setErro("");
    onEntrar(perfilEscolhido, consultorEscolhidoId);
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-violet-100 via-violet-50 to-orange-50 flex flex-col p-4 sm:p-8 relative overflow-x-hidden overflow-y-auto font-[Inter,sans-serif]">
      <style>{`
        @keyframes radarSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes radarPing { 0% { transform: scale(0.55); opacity: 0.65; } 80% { opacity: 0; } 100% { transform: scale(1.35); opacity: 0; } }
        @keyframes radarCore { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
        .radar-sweep-group { transform-origin: 50% 50%; animation: radarSpin 3.2s linear infinite; }
        .radar-ping { transform-origin: 50% 50%; animation: radarPing 2.6s ease-out infinite; }
        .radar-core { animation: radarCore 1.6s ease-in-out infinite; }
      `}</style>

      <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-violet-400 opacity-20 blur-3xl" />
      <div className="absolute -bottom-24 -right-10 w-[28rem] h-[28rem] rounded-full bg-orange-400 opacity-20 blur-3xl" />
      <div className="absolute top-6 right-6 sm:top-10 sm:right-10 grid grid-cols-5 gap-2 opacity-40">
        {Array.from({ length: 20 }).map((_, i) => <span key={i} className="w-1.5 h-1.5 rounded-full bg-violet-500" />)}
      </div>

      <div className="flex-1 w-full flex items-center justify-center py-6">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center z-10">
        <div className="flex flex-col items-center lg:items-start text-center lg:text-left relative pb-16 lg:pb-24">
          <div className="relative z-10">
            <RadarLogoGrande />
          </div>

          <h1 className="mt-6 text-4xl sm:text-5xl font-extrabold tracking-tight text-violet-950 flex items-baseline gap-2 select-none">
            <span>R</span><span>A</span><span>D</span>
            <span className="relative">A<span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-orange-500" /></span>
            <span>R</span>
          </h1>
          <p className="mt-1 text-xs sm:text-sm tracking-[0.35em] font-semibold text-violet-600 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />GESTÃO COMERCIAL<span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
          </p>
          <p className="mt-4 text-lg text-violet-700">
            Transformando <span className="text-orange-500 font-semibold">dados</span> em <span className="text-orange-500 font-semibold">decisões.</span>
          </p>

          <div className="mt-8 w-full max-w-sm bg-white/85 backdrop-blur rounded-2xl border border-violet-100 shadow-lg p-5 relative z-10">
            <p className="text-[11px] font-bold tracking-wider text-violet-500 mb-4">PAINEL RESUMO</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col items-center text-center gap-1.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-100 to-violet-200 flex items-center justify-center shadow-sm"><Target size={18} className="text-violet-600" /></div>
                <p className="text-[9px] font-bold tracking-wide text-slate-400">META DA LOJA</p>
                <p className="text-sm font-extrabold text-violet-950">{formatBRL(metaLojaMix)}</p>
                <p className="text-[10px] text-violet-300">Este mês</p>
              </div>
              <div className="flex flex-col items-center text-center gap-1.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center shadow-sm"><TrendingUp size={18} className="text-orange-500" /></div>
                <p className="text-[9px] font-bold tracking-wide text-slate-400">PRODUÇÃO MÊS</p>
                <p className="text-sm font-extrabold text-orange-500">{formatBRL(producaoMesLoja)}</p>
                <p className="text-[10px] text-violet-300">{pctMes}% da meta</p>
              </div>
              <div className="flex flex-col items-center text-center gap-1.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-100 to-violet-200 flex items-center justify-center shadow-sm"><Users size={18} className="text-violet-600" /></div>
                <p className="text-[9px] font-bold tracking-wide text-slate-400">CONSULTORES</p>
                <p className="text-sm font-extrabold text-violet-950">{consultores.filter((c) => !c.externo).length}</p>
                <p className="text-[10px] text-violet-300">Ativos</p>
              </div>
            </div>
          </div>

          <div className="mt-8 flex items-center gap-2 text-violet-600 relative z-10">
            <span className="text-2xl leading-none font-serif">"</span>
            <p className="text-sm">Quem mede, <span className="text-orange-500 font-semibold">evolui.</span></p>
            <span className="text-2xl leading-none font-serif">"</span>
          </div>

          <RadarIlustracaoGrande />
        </div>

        <div className="w-full bg-white rounded-3xl shadow-xl p-7 sm:p-10">
          <div className="flex items-center gap-2 text-[11px] font-bold tracking-wider text-violet-600">
            <ShieldCheck size={14} /> ACESSO AO SISTEMA
          </div>
          <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-violet-950 leading-tight">
            Bem-vindo ao<br /><span className="tracking-tight">CENTRO DE OPERAÇÕES</span>
          </h2>
          <div className="mt-3 h-1 w-14 rounded-full bg-orange-500" />

          <div className="mt-6 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => { setPerfilEscolhido("supervisora"); setErro(""); }}
              className={`rounded-xl px-3 py-3 text-xs font-bold border-2 transition ${perfilEscolhido === "supervisora" ? "border-violet-600 bg-violet-50 text-violet-700" : "border-violet-100 text-slate-400"}`}>
              Sou Supervisor
            </button>
            <button type="button" onClick={() => { setPerfilEscolhido("consultor"); setErro(""); }}
              className={`rounded-xl px-3 py-3 text-xs font-bold border-2 transition ${perfilEscolhido === "consultor" ? "border-violet-600 bg-violet-50 text-violet-700" : "border-violet-100 text-slate-400"}`}>
              Sou Consultor
            </button>
          </div>

          <form className="mt-6 space-y-5" onSubmit={entrar}>
            {perfilEscolhido === "consultor" ? (
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-violet-900 mb-1.5"><Users size={13} /> QUAL CONSULTOR É VOCÊ?</label>
                <select value={consultorEscolhidoId} onChange={(e) => setConsultorEscolhidoId(e.target.value)}
                  className="w-full rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm text-violet-950 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 transition">
                  <option value="">Selecione seu nome</option>
                  {consultores.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
            ) : (
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-violet-900 mb-1.5"><User size={13} /> USUÁRIO</label>
                <div className="flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm text-violet-950">
                  <ShieldCheck size={15} className="text-violet-400" /> Letícia — Supervisora
                </div>
              </div>
            )}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-violet-900 mb-1.5"><CreditCard size={13} /> PIN DE ACESSO</label>
              <div className="relative">
                <input type={mostrarSenha ? "text" : "password"} inputMode="numeric" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Digite seu PIN"
                  className="w-full rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 pr-11 text-sm text-violet-950 placeholder:text-violet-300 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 transition" />
                <button type="button" onClick={() => setMostrarSenha(!mostrarSenha)} className="absolute right-4 top-1/2 -translate-y-1/2 text-violet-300 hover:text-violet-600 transition">
                  {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {erro && <p className="text-xs text-red-500 font-semibold flex items-center gap-1.5"><AlertCircle size={13} /> {erro}</p>}
            <button type="submit"
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-400 py-3.5 text-sm font-bold tracking-wide text-white shadow-md hover:brightness-105 active:scale-[0.99] transition">
              ENTRAR NO SISTEMA <ArrowRight size={16} />
            </button>
          </form>
        </div>
      </div>
      </div>

      <div className="w-full shrink-0">
        <svg viewBox="0 0 1536 90" preserveAspectRatio="none" className="w-full h-14 sm:h-16 block">
          <defs>
            <linearGradient id="footerFillLogin" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#2E1065" /><stop offset="100%" stopColor="#4C1D95" />
            </linearGradient>
          </defs>
          <path d="M0,55 C 380,10 1100,95 1536,25 L1536,90 L0,90 Z" fill="url(#footerFillLogin)" />
          <path d="M0,55 C 380,10 1100,95 1536,25" fill="none" stroke="#F5851F" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <div className="relative flex items-center justify-center gap-2 text-[10px] sm:text-[11px] text-violet-200 pb-2.5 sm:pb-3 -mt-2 bg-violet-900">
          © 2026 <span className="text-white font-semibold">RADAR</span> • Gestão Comercial
          <span className="mx-1 opacity-40">|</span><ShieldCheck size={12} /> Versão 1.0.0
        </div>
      </div>
    </div>
  );
}

function RadarIlustracaoGrande() {
  return (
    <div className="absolute left-[-8%] bottom-[-6%] w-[140%] sm:w-[120%] max-w-none aspect-square opacity-70 pointer-events-none select-none z-0">
      <svg viewBox="0 0 400 400" className="w-full h-full">
        <defs>
          <radialGradient id="bigRadarFadeSis" cx="30%" cy="70%" r="70%">
            <stop offset="0%" stopColor="#6D4FD1" stopOpacity="0.35" /><stop offset="60%" stopColor="#6D4FD1" stopOpacity="0.08" /><stop offset="100%" stopColor="#6D4FD1" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="bigBeamSis" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8B74D6" stopOpacity="0.5" /><stop offset="100%" stopColor="#8B74D6" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[170, 130, 90, 50].map((r, i) => (
          <circle key={r} cx="130" cy="330" r={r} fill={i === 0 ? "url(#bigRadarFadeSis)" : "none"} stroke="#8B74D6" strokeWidth="1" opacity={0.35 - i * 0.05} />
        ))}
        <path d="M 130 330 L 60 260 A 170 170 0 0 1 260 200 Z" fill="url(#bigBeamSis)" />
        <line x1="130" y1="330" x2="260" y2="200" stroke="#8B74D6" strokeWidth="1.5" opacity="0.5" />
        <circle cx="130" cy="330" r="7" fill="none" stroke="#F5851F" strokeWidth="2.5" />
        <circle cx="130" cy="330" r="2.5" fill="#F5851F" />
        {[[60, 300, "#F5851F", 3], [225, 355, "#6D4FD1", 3.5], [255, 300, "#6D4FD1", 2.5], [95, 385, "#6D4FD1", 2.5], [175, 175, "#8B74D6", 2]].map(([cx, cy, fill, r], i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill={fill} opacity="0.7" />
        ))}
      </svg>
    </div>
  );
}

function RadarLogoGrande() {
  return (
    <div className="relative w-28 h-28 sm:w-32 sm:h-32">
      <svg viewBox="0 0 100 100" className="relative w-full h-full">
        <defs>
          <linearGradient id="sweepGradientSis" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#F5851F" stopOpacity="0" /><stop offset="100%" stopColor="#F5851F" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id="ringGradientSis" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6D4FD1" /><stop offset="100%" stopColor="#8B74D6" />
          </linearGradient>
        </defs>
        {[46, 36, 26, 16].map((r, i) => (
          <circle key={r} cx="50" cy="50" r={r} fill="none" stroke="url(#ringGradientSis)" strokeWidth="1.2" opacity={0.3 + i * 0.14} />
        ))}
        <line x1="50" y1="6" x2="50" y2="94" stroke="#B7A6E8" strokeWidth="0.6" opacity="0.35" />
        <line x1="6" y1="50" x2="94" y2="50" stroke="#B7A6E8" strokeWidth="0.6" opacity="0.35" />
        <circle className="radar-ping" cx="50" cy="50" r="20" fill="none" stroke="#F5851F" strokeWidth="1.5" style={{ animationDelay: "0s" }} />
        <circle className="radar-ping" cx="50" cy="50" r="20" fill="none" stroke="#6D4FD1" strokeWidth="1.5" style={{ animationDelay: "0.9s" }} />
        {[[50, 4], [50, 96], [4, 50], [96, 50], [22, 22], [78, 22], [22, 78], [78, 78]].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="2" fill="#6D4FD1" opacity="0.5" />
        ))}
        <g className="radar-sweep-group">
          <path d="M 50 50 L 50 4 A 46 46 0 0 1 82 18 Z" fill="url(#sweepGradientSis)" opacity="0.55" />
          <line x1="50" y1="50" x2="50" y2="4" stroke="#F5851F" strokeWidth="2.4" strokeLinecap="round" />
        </g>
        <circle className="radar-core" cx="50" cy="50" r="5" fill="#F5851F" />
      </svg>
    </div>
  );
}

// ============================================================
// TELA: MINHA PRODUÇÃO (perfil consultor)
// ============================================================
function TelaMinhaProducao({ consultorLogadoId, consultores, consultoresLoja, metaIndividualConsultorProduto, metaIndividualConsultorMix, diasUteisMes, diasUteisPassados, producoes, totalMesConsultorProduto }) {
  const consultor = consultores.find((c) => c.id === consultorLogadoId);
  const diasUteisRestantes = Math.max(diasUteisMes - diasUteisPassados, 0);
  const ritmoIdeal = diasUteisMes > 0 ? Math.round((diasUteisPassados / diasUteisMes) * 100) : 0;

  if (!consultor) {
    return <p className="text-sm text-slate-500">Consultor não encontrado. Fale com seu supervisor.</p>;
  }

  // "Minha Produção" mostra TUDO que a consultora lançou, digitado ou pago —
  // pra ela sempre ver o próprio esforço. Só a Matinal/Painel exigem "Pago".
  const mesRef = mesAtual();
  const minhasProducoesMes = useMemo(
    () => producoes.filter((p) => p.consultorId === consultorLogadoId && (p.data || "").slice(0, 7) === mesRef),
    [producoes, consultorLogadoId, mesRef]
  );
  function totalProduto(pid) {
    return minhasProducoesMes.filter((p) => p.produto === pid).reduce((s, p) => s + (Number(p.valor) || 0), 0);
  }
  function totalMixConsultor() {
    return ["creditoPessoal", "consignado", "clt", "antecipacao"].reduce((s, pid) => s + totalProduto(pid), 0);
  }
  function contratosProduto(pid) {
    return minhasProducoesMes.filter((p) => p.produto === pid).length;
  }
  function superContasUnicas() {
    const cpfs = minhasProducoesMes.filter((p) => p.produto === "creditoPessoal" && p.tipoCredito === "SuperConta")
      .map((p) => (p.cpf || "").replace(/\D/g, "")).filter(Boolean);
    return new Set(cpfs).size;
  }

  const total = totalMixConsultor();
  const metaMix = metaIndividualConsultorMix(consultor.id);
  const pct = metaMix > 0 ? Math.round((total / metaMix) * 100) : 0;
  const falta = Math.max(metaMix - total, 0);
  const diaria = diasUteisRestantes > 0 ? falta / diasUteisRestantes : 0;
  const projecao = diasUteisPassados > 0 ? (total / diasUteisPassados) * diasUteisMes : total;
  const status = pct >= ritmoIdeal ? { label: "No ritmo", color: "#22C55E" } : pct >= ritmoIdeal - 15 ? { label: "Atenção", color: "#F5A623" } : { label: "Abaixo do ritmo", color: "#EF4444" };

  const produtosDetalhe = ["creditoPessoal", "consignado", "clt", "antecipacao"].map((pid) => {
    const nome = { creditoPessoal: "Crédito Pessoal", consignado: "Consignado", clt: "CLT", antecipacao: "Antecipação" }[pid];
    const metaP = metaIndividualConsultorProduto(consultor.id, pid);
    const realP = totalProduto(pid);
    const faltaP = Math.max(metaP - realP, 0);
    const diariaP = diasUteisRestantes > 0 ? faltaP / diasUteisRestantes : 0;
    const pctP = metaP > 0 ? Math.round((realP / metaP) * 100) : 0;
    return { id: pid, nome, metaP, realP, faltaP, diariaP, pctP };
  });

  const superContas = superContasUnicas();
  const seguros = contratosProduto("seguro");
  const consignados = contratosProduto("consignado");
  const clts = contratosProduto("clt");
  const elegivel = superContas >= ELEGIBILIDADE.superConta && seguros >= ELEGIBILIDADE.seguro && consignados >= ELEGIBILIDADE.consignado && clts >= ELEGIBILIDADE.clt;

  const minhasProducoesRecentes = [...minhasProducoesMes].sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0)).slice(0, 5);

  // ---- produto que mais precisa de atenção (menor % da meta) ----
  const produtoFoco = produtosDetalhe.filter((p) => p.metaP > 0).sort((a, b) => a.pctP - b.pctP)[0] || null;

  // ---- frase motivacional: muda todo dia, mas fica igual o dia inteiro ----
  const FRASES_MOTIVACIONAIS = [
    "Cada cliente atendido hoje é um passo mais perto da sua meta. Bora! 🚀",
    "Consistência vence intensidade. Um contrato de cada vez. 💪",
    "Seu esforço de hoje é o resultado de amanhã. Confia no processo!",
    "Grandes vendedores não nascem prontos — eles insistem um pouco mais todo dia.",
    "Foco no que você controla: suas ligações, suas abordagens, sua atitude. O resultado vem.",
    "Hoje é uma nova chance de bater sua própria marca. Vai com tudo! 🔥",
    "Não compare seu capítulo 1 com o capítulo 20 de outra pessoa. Siga seu ritmo, sem parar.",
    "O 'não' de hoje pode virar o 'sim' de amanhã, se você continuar tentando.",
    "Sua meta não é um teto, é só o ponto de partida. Supere-se!",
    "Disciplina é escolher entre o que você quer agora e o que você quer mais. Foco na meta!",
  ];
  const seedFrase = (todayISO() + consultorLogadoId).split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const fraseDoDia = FRASES_MOTIVACIONAIS[seedFrase % FRASES_MOTIVACIONAIS.length];

  // ---- liderança: em quais produtos esse consultor é o 1º colocado da loja ----
  const produtosLideranca = ["creditoPessoal", "consignado", "clt", "antecipacao"]
    .map((pid) => {
      const nome = { creditoPessoal: "Crédito Pessoal", consignado: "Consignado", clt: "CLT", antecipacao: "Antecipação" }[pid];
      const ranking = (consultoresLoja || [])
        .map((c) => ({ id: c.id, valor: totalMesConsultorProduto(c.id, pid) }))
        .sort((a, b) => b.valor - a.valor);
      const meuValor = totalMesConsultorProduto(consultorLogadoId, pid);
      const souLider = ranking.length > 0 && ranking[0].id === consultorLogadoId && meuValor > 0;
      return souLider ? { pid, nome } : null;
    })
    .filter(Boolean);

  return (
    <>
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-950 via-violet-900 to-violet-800 px-5 sm:px-7 py-6 text-white">
        <div className="absolute -right-10 -top-10 w-52 h-52 rounded-full bg-orange-500 opacity-20 blur-3xl" />
        <div className="absolute -left-10 -bottom-16 w-52 h-52 rounded-full bg-violet-500 opacity-30 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <Avatar nome={consultor.nome} foto={consultor.foto} size={52} />
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">{saudacao()}, {consultor.nome}! 👋</h1>
            <p className="text-sm text-violet-200 mt-1">Aqui está a sua produção do mês.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kpi icon={<Package size={16} />} label="MINHA PRODUÇÃO" value={formatBRL(total)} sub="Este mês (Mix)" />
        <Kpi icon={<Target size={16} />} label="MINHA META" value={formatBRL(metaMix)} sub="Mix" />
        <Kpi icon={<TrendingUp size={16} />} label="% ATINGIDO" value={`${pct}%`} sub="do mês" accent="orange" />
        <Kpi icon={<Clock size={16} />} label="DIÁRIA NECESSÁRIA" value={formatBRL(diaria)} sub={`Próx. ${diasUteisRestantes} dias úteis`} accent="orange" />
      </div>

      {produtosLideranca.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-4 sm:px-5 py-3.5 flex items-start gap-2.5">
          <Trophy size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs sm:text-sm font-semibold text-amber-800">
            Você é a 1ª colocada da loja em {produtosLideranca.map((p) => p.nome).join(" e ")} este mês! 🏆
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-violet-100 bg-gradient-to-r from-violet-50 to-white px-4 sm:px-5 py-3.5 flex items-start gap-2.5">
        <Sparkles size={18} className="text-violet-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs sm:text-sm font-medium text-violet-800 italic">{fraseDoDia}</p>
      </div>

      {produtoFoco && produtoFoco.pctP < 100 && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 sm:px-5 py-3.5 flex items-start gap-2.5">
          <Target size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs sm:text-sm text-red-700">
            <strong>Foco sugerido: {produtoFoco.nome}.</strong> Está em {produtoFoco.pctP}% da meta — faltam {formatBRL(produtoFoco.faltaP)} ({formatBRL(produtoFoco.diariaP)}/dia útil).
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-violet-100 bg-white p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-extrabold text-violet-950">Detalhamento por Produto</h2>
          <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: status.color }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: status.color }} />{status.label}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[520px]">
            <thead>
              <tr className="text-left text-[10px] font-bold tracking-wide text-slate-400 border-b border-violet-100">
                <th className="py-2 pr-3">Produto</th><th className="py-2 pr-3 text-right">Meta</th><th className="py-2 pr-3 text-right">Realizado</th>
                <th className="py-2 pr-3 text-right">Falta</th><th className="py-2 pr-3 text-right">%</th><th className="py-2 pl-3 text-right">Diária</th>
              </tr>
            </thead>
            <tbody>
              {produtosDetalhe.map((p) => {
                const cor = p.pctP >= 100 ? "#22C55E" : p.pctP >= 60 ? "#F5A623" : "#EF4444";
                return (
                  <tr key={p.id} className="border-t border-violet-50">
                    <td className="py-2.5 pr-3 font-medium text-violet-950">{p.nome}</td>
                    <td className="py-2.5 pr-3 text-right text-slate-500">{formatBRL(p.metaP)}</td>
                    <td className="py-2.5 pr-3 text-right font-semibold text-violet-950">{formatBRL(p.realP)}</td>
                    <td className="py-2.5 pr-3 text-right text-slate-500">{formatBRL(p.faltaP)}</td>
                    <td className="py-2.5 pr-3 text-right font-bold" style={{ color: cor }}>{p.pctP}%</td>
                    <td className="py-2.5 pl-3 text-right font-bold text-orange-500">{formatBRL(p.diariaP)}</td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-violet-200">
                <td className="py-2.5 pr-3 font-bold text-violet-950">Total (Mix)</td>
                <td className="py-2.5 pr-3 text-right font-bold text-slate-500">{formatBRL(metaMix)}</td>
                <td className="py-2.5 pr-3 text-right font-bold text-violet-600">{formatBRL(total)}</td>
                <td className="py-2.5 pr-3 text-right font-bold text-slate-500">{formatBRL(falta)}</td>
                <td className="py-2.5 pr-3 text-right font-bold text-orange-500">{pct}%</td>
                <td className="py-2.5 pl-3 text-right font-bold" style={{ color: projecao >= metaMix ? "#16A34A" : "#C2760F" }}>{formatBRL(projecao)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-violet-300 mt-2 text-right">A última coluna do total mostra a projeção pro fim do mês.</p>
      </div>

      <div className="rounded-2xl border border-violet-100 bg-white p-4 sm:p-5">
        <h2 className="text-sm font-extrabold text-violet-950 mb-1 flex items-center gap-2"><ClipboardList size={16} className="text-violet-600" /> Minha Elegibilidade ao Comissionamento</h2>
        <p className="text-[11px] text-slate-400 mb-4">Contagem por número de contratos no mês. SuperConta conta por CPF único.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <ElegibItem label="SuperConta" atual={superContas} meta={ELEGIBILIDADE.superConta} />
          <ElegibItem label="Seguro" atual={seguros} meta={ELEGIBILIDADE.seguro} />
          <ElegibItem label="Consignado" atual={consignados} meta={ELEGIBILIDADE.consignado} />
          <ElegibItem label="CLT" atual={clts} meta={ELEGIBILIDADE.clt} />
        </div>
        {elegivel ? (
          <p className="flex items-center gap-1.5 text-sm font-bold text-green-600"><CheckCircle2 size={16} /> Você está elegível ao comissionamento!</p>
        ) : (
          <p className="flex items-center gap-1.5 text-sm font-bold text-amber-600"><XCircle size={16} /> Ainda faltam contratos para ficar elegível.</p>
        )}
      </div>

      <div className="rounded-2xl border border-violet-100 bg-white p-4 sm:p-5">
        <h2 className="text-sm font-extrabold text-violet-950 mb-4">Meus Últimos Lançamentos</h2>
        {minhasProducoesRecentes.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">Você ainda não lançou nenhuma produção este mês.</p>
        ) : (
          <div className="space-y-2">
            {minhasProducoesRecentes.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl bg-violet-50 px-3.5 py-2.5">
                <div>
                  <p className="text-xs font-semibold text-violet-950">{p.cliente}</p>
                  <p className="text-[10px] text-slate-400">{NOMES_PRODUTO[p.produto] || p.produto} · {formatarDataBR(p.data)}</p>
                </div>
                <span className="text-xs font-bold text-violet-600">
                  {p.produto === "seguro" ? (p.valor > 0 ? `${formatBRL(p.valor)} (prêmio)` : "1 unidade") : formatBRL(p.valor)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function ElegibItem({ label, atual, meta }) {
  const ok = atual >= meta;
  return (
    <div className={`rounded-xl border px-3 py-3 text-center ${ok ? "bg-green-50 border-green-100" : "bg-amber-50 border-amber-100"}`}>
      <p className="text-[10px] font-bold text-slate-500">{label}</p>
      <p className={`text-lg font-extrabold ${ok ? "text-green-600" : "text-amber-600"}`}>{atual}/{meta}</p>
    </div>
  );
}

// ============================================================
// TELA: MATINAL
// ============================================================
function TelaMatinal({ producoes, diasUteisMes, diasUteisPassados, salvarConfig, totalMesConsultorProduto, totalMesConsultorMix, contratosMesConsultorProduto, superContasUnicasMesConsultor, loading, consultoresLoja, metaIndividualConsultorProduto, metaIndividualConsultorMix, metaLojaProdutoTotal, metaLojaMix, metaSeguroUnid }) {
  const consultores = consultoresLoja;
  const diasUteisRestantes = Math.max(diasUteisMes - diasUteisPassados, 0);
  const ritmoIdeal = diasUteisMes > 0 ? Math.round((diasUteisPassados / diasUteisMes) * 100) : 0;
  const metaMixMensalTotal = metaLojaMix;
  const producaoMesLoja = consultores.reduce((acc, c) => acc + totalMesConsultorMix(c.id), 0);
  const faltaMesLoja = Math.max(metaMixMensalTotal - producaoMesLoja, 0);
  const pctMes = metaMixMensalTotal > 0 ? Math.round((producaoMesLoja / metaMixMensalTotal) * 100) : 0;

  function metaProdutoTotal(produtoId) {
    if (produtoId === "mix") return metaMixMensalTotal;
    return metaLojaProdutoTotal(produtoId);
  }
  function producaoProdutoTotal(produtoId) {
    if (produtoId === "mix") return producaoMesLoja;
    return consultores.reduce((acc, c) => acc + totalMesConsultorProduto(c.id, produtoId), 0);
  }

  const PRODUTOS_META = [
    { id: "creditoPessoal", nome: "Crédito Pessoal", icon: Wallet },
    { id: "mix", nome: "Mix", icon: PieChartIcon, isRollup: true },
    { id: "consignado", nome: "Consignado", icon: Landmark },
    { id: "clt", nome: "CLT", icon: Shirt },
    { id: "antecipacao", nome: "Antecipação", icon: Zap },
  ];

  const ranking = useMemo(() => {
    return consultores.map((c) => {
      const total = totalMesConsultorMix(c.id);
      const metaC = metaIndividualConsultorMix(c.id);
      const pct = metaC > 0 ? Math.round((total / metaC) * 100) : 0;
      return { ...c, total, pct, metaIndividual: metaC };
    }).sort((a, b) => b.total - a.total);
  }, [producoes]);
  const lider = ranking[0];

  return (
    <>
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-950 via-violet-900 to-violet-800 px-5 sm:px-7 py-6 text-white">
        <div className="absolute -right-10 -top-10 w-52 h-52 rounded-full bg-orange-500 opacity-20 blur-3xl" />
        <div className="absolute -left-10 -bottom-16 w-52 h-52 rounded-full bg-violet-500 opacity-30 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold flex items-center gap-2 text-white">{saudacao()}, Letícia! <span>👋</span></h1>
            <p className="text-sm text-violet-200 mt-1">{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</p>
            <p className="text-sm text-violet-100 mt-1">Vamos juntos transformar metas em conquistas!</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition"><Bell size={16} /></button>
            <div className="w-9 h-9 rounded-full bg-orange-500 flex items-center justify-center font-bold text-sm">LO</div>
          </div>
        </div>
        <div className="relative mt-5 flex items-start gap-3 rounded-2xl bg-white/10 backdrop-blur border border-white/10 px-4 py-3 max-w-xl">
          <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center shrink-0"><Sparkles size={16} className="text-white" /></div>
          <p className="text-xs sm:text-sm text-violet-50 leading-relaxed">
            {producaoMesLoja === 0 ? "Pulse: ainda não há produção lançada este mês. Assim que a equipe começar a lançar, trago aqui as principais oportunidades do dia."
              : `Pulse: a loja está em ${pctMes}% da meta do mês. Foco em ${lider?.nome || "toda a equipe"} para acelerar o Mix.`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-violet-100 bg-white p-4 sm:p-5">
          <div className="flex items-center gap-2 text-violet-600 font-bold text-sm mb-4"><Calendar size={17} /> Calendário Comercial</div>
          <div className="flex items-end gap-2 mb-3">
            <span className="text-3xl font-extrabold text-violet-950">{diasUteisPassados}º</span>
            <span className="text-sm text-slate-500 pb-1">dia útil de {diasUteisMes}</span>
          </div>
          <div className="flex flex-wrap gap-3 mb-3">
            <label className="flex items-center gap-1.5 text-[11px] text-slate-400">Dias úteis no mês
              <input type="number" min={1} value={diasUteisMes} onChange={(e) => salvarConfig(Math.max(1, Number(e.target.value) || 1))}
                className="w-14 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-xs font-bold text-violet-950 text-center outline-none focus:border-violet-500" />
            </label>
            <label className="flex items-center gap-1.5 text-[11px] text-slate-400">Já passados
              <input type="number" min={0} value={diasUteisPassados} onChange={(e) => salvarConfig(undefined, Math.max(0, Number(e.target.value) || 0))}
                className="w-14 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-xs font-bold text-violet-950 text-center outline-none focus:border-violet-500" />
            </label>
          </div>
          <p className="text-xs text-slate-500 mb-2">Dias úteis restantes: <span className="font-bold text-violet-950">{diasUteisRestantes}</span></p>
          <span className={`inline-block text-[11px] font-bold px-3 py-1 rounded-full ${pctMes >= ritmoIdeal ? "bg-green-100 text-green-600" : "bg-amber-50 text-amber-700"}`}>
            {pctMes >= ritmoIdeal ? "DENTRO DO ESPERADO" : "ABAIXO DO RITMO"}
          </span>
        </div>

        <div className="rounded-2xl border border-violet-100 bg-white p-4 sm:p-5">
          <div className="flex items-center gap-2 text-violet-600 font-bold text-sm mb-4"><BarChart2 size={17} /> Projeção da Loja (até hoje)</div>
          <table className="w-full text-xs">
            <thead><tr className="text-left text-slate-400"><th className="pb-2 font-semibold">Produto</th><th className="pb-2 font-semibold text-right">Deveria estar</th><th className="pb-2 font-semibold text-right">Realizado</th><th className="pb-2 font-semibold text-right">Diferença</th></tr></thead>
            <tbody>
              {["creditoPessoal", "mix", "consignado", "clt", "antecipacao"].map((pid) => {
                const nome = { creditoPessoal: "Crédito Pessoal", mix: "Mix", consignado: "Consignado", clt: "CLT", antecipacao: "Antecipação" }[pid];
                const metaTotal = metaProdutoTotal(pid);
                const deveria = (metaTotal / diasUteisMes) * diasUteisPassados;
                const realizado = producaoProdutoTotal(pid);
                const dif = realizado - deveria;
                return (
                  <tr key={pid} className="border-t border-violet-100">
                    <td className="py-2 font-medium text-violet-950">{nome}</td>
                    <td className="py-2 text-right text-slate-500">{formatBRL(deveria)}</td>
                    <td className="py-2 text-right text-violet-950 font-semibold">{formatBRL(realizado)}</td>
                    <td className={`py-2 text-right font-bold ${dif >= 0 ? "text-green-600" : "text-red-500"}`}>{dif >= 0 ? "+" : ""}{formatBRL(dif)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="rounded-2xl border border-violet-100 bg-white p-4 sm:p-5">
          <div className="flex items-center gap-2 text-violet-600 font-bold text-sm mb-4">
            <Target size={17} /> Foco do dia <span className="text-[10px] font-normal text-violet-300">(definido pelo Pulse)</span>
          </div>
          <ul className="space-y-2.5 text-xs text-slate-600">
            {ranking.filter((r) => r.pct < ritmoIdeal).length === 0 ? (
              <li className="text-slate-400">Toda a equipe está dentro do ritmo esperado. 🎉</li>
            ) : ranking.filter((r) => r.pct < ritmoIdeal).map((r) => (
              <li key={r.id} className="flex items-start gap-2">
                <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />
                <span><b>{r.nome}</b> precisa acelerar o Mix — está em {r.pct}% da meta.</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-extrabold text-violet-950 mb-3">Meta da Loja (Mensal)</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {PRODUTOS_META.map((p) => {
            const meta = metaProdutoTotal(p.id);
            const realizado = producaoProdutoTotal(p.id);
            const pct = meta > 0 ? Math.round((realizado / meta) * 100) : 0;
            const Icon = p.icon;
            return (
              <div key={p.id} className={`rounded-2xl p-4 border ${p.isRollup ? "bg-gradient-to-br from-violet-600 to-violet-400 border-transparent text-white" : "bg-white border-violet-100"}`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${p.isRollup ? "bg-white/20" : "bg-violet-100"}`}><Icon size={17} className={p.isRollup ? "text-white" : "text-violet-600"} /></div>
                <p className={`text-[10px] font-bold tracking-wide ${p.isRollup ? "text-white/80" : "text-slate-400"}`}>{p.nome.toUpperCase()}</p>
                <p className="text-lg font-extrabold mt-0.5">{formatBRL(meta)}</p>
                <p className={`text-[11px] mt-0.5 ${p.isRollup ? "text-white/80" : "text-violet-300"}`}>{formatBRL(realizado)} ({pct}%)</p>
                <div className={`h-1.5 rounded-full mt-2 overflow-hidden ${p.isRollup ? "bg-white/20" : "bg-violet-100"}`}>
                  <div className={`h-full rounded-full ${p.isRollup ? "bg-orange-500" : "bg-violet-600"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-extrabold text-violet-950 mb-3">Painel dos Consultores — Diárias</h2>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {consultores.map((c) => {
            const total = totalMesConsultorMix(c.id);
            const metaC = metaIndividualConsultorMix(c.id);
            const pct = metaC > 0 ? Math.round((total / metaC) * 100) : 0;
            const status = pct >= ritmoIdeal ? { label: "No ritmo", color: "#22C55E" } : pct >= ritmoIdeal - 15 ? { label: "Atenção", color: "#F5A623" } : { label: "Abaixo do ritmo", color: "#EF4444" };
            return (
              <div key={c.id} className="rounded-2xl border border-violet-100 bg-white p-5">
                <div className="flex items-center gap-3 mb-4">
                  <Avatar nome={c.nome} foto={c.foto} size={44} />
                  <div>
                    <p className="font-bold text-violet-950 text-base">{c.nome}</p>
                    <p className="flex items-center gap-1 text-xs font-semibold" style={{ color: status.color }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: status.color }} />{status.label}
                    </p>
                  </div>
                </div>
                <div className="overflow-x-auto -mx-1 px-1">
                <table className="w-full text-xs min-w-[480px]">
                  <thead><tr className="text-slate-400"><th className="text-left font-semibold pb-2">Produto</th><th className="text-right font-semibold pb-2">Meta</th><th className="text-right font-semibold pb-2">Realiz.</th><th className="text-right font-semibold pb-2">Falta</th><th className="text-right font-semibold pb-2">Projeção</th><th className="text-right font-semibold pb-2">Diária</th></tr></thead>
                  <tbody>
                    {["creditoPessoal", "consignado", "clt", "antecipacao"].map((pid) => {
                      const nome = { creditoPessoal: "Créd. Pessoal", consignado: "Consignado", clt: "CLT", antecipacao: "Antecip." }[pid];
                      const metaPC = metaIndividualConsultorProduto(c.id, pid);
                      const realC = totalMesConsultorProduto(c.id, pid);
                      const faltaC = Math.max(metaPC - realC, 0);
                      const diariaC = diasUteisRestantes > 0 ? faltaC / diasUteisRestantes : 0;
                      const projecaoC = diasUteisPassados > 0 ? (realC / diasUteisPassados) * diasUteisMes : realC;
                      const pctC = metaPC > 0 ? (realC / metaPC) * 100 : 0;
                      const pctProjC = metaPC > 0 ? (projecaoC / metaPC) * 100 : 0;
                      const dotColor = pctC >= 100 ? "#22C55E" : pctC >= 60 ? "#F5A623" : "#EF4444";
                      const projColor = pctProjC >= 100 ? "#16A34A" : pctProjC >= 80 ? "#C2760F" : "#EF4444";
                      return (
                        <tr key={pid} className="border-t border-violet-50">
                          <td className="py-2 text-violet-950 whitespace-nowrap">{nome}</td>
                          <td className="py-2 text-right text-slate-500">{formatBRL(metaPC)}</td>
                          <td className="py-2 text-right font-semibold text-violet-950">{formatBRL(realC)}</td>
                          <td className="py-2 text-right text-slate-500">{formatBRL(faltaC)}</td>
                          <td className="py-2 text-right font-semibold" style={{ color: projColor }}>{formatBRL(projecaoC)}</td>
                          <td className="py-2 text-right font-bold">
                            <span className="inline-flex items-center gap-1 justify-end" style={{ color: dotColor }}>{formatBRL(diariaC)}<span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: dotColor }} /></span>
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="border-t-2 border-violet-200">
                      <td className="py-2 font-bold text-violet-950 whitespace-nowrap">Total (Mix)</td>
                      <td className="py-2 text-right font-bold text-slate-500">{formatBRL(metaC)}</td>
                      <td className="py-2 text-right font-bold text-violet-600">{formatBRL(total)}</td>
                      <td className="py-2 text-right font-bold text-slate-500">{formatBRL(Math.max(metaC - total, 0))}</td>
                      <td className="py-2 text-right font-bold" style={{ color: (diasUteisPassados > 0 ? (total / diasUteisPassados) * diasUteisMes : total) >= metaC ? "#16A34A" : "#C2760F" }}>
                        {formatBRL(diasUteisPassados > 0 ? (total / diasUteisPassados) * diasUteisMes : total)}
                      </td>
                      <td className="py-2 text-right font-bold text-orange-500">{pct}%</td>
                    </tr>
                  </tbody>
                </table>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <RankingPanel ranking={ranking} />
        <div className="rounded-2xl border border-violet-100 bg-white p-5 flex flex-col items-center text-center justify-center">
          <div className="flex items-center gap-2 text-violet-600 font-bold text-sm self-start mb-4"><PartyPopper size={17} /> Destaque do dia</div>
          {lider && lider.total > 0 ? (
            <>
              <Avatar nome={lider.nome} foto={lider.foto} size={56} className="mb-3" />
              <p className="font-extrabold text-violet-950">Parabéns, {lider.nome}! 🎉</p>
              <p className="text-xs text-slate-500 mt-1">Primeira colocada em produção (Mix)! Continue assim, você inspira a equipe.</p>
            </>
          ) : <p className="text-xs text-slate-400">O destaque do dia aparece assim que houver produção lançada.</p>}
        </div>
        <div className="rounded-2xl border border-violet-100 bg-white p-5">
          <div className="flex items-center gap-2 text-violet-600 font-bold text-sm mb-4"><Radar size={17} /> Ritmo da Loja (Mix)</div>
          <div className="flex items-center gap-4">
            <RitmoGauge pct={pctMes} />
            <div className="text-xs space-y-1.5 flex-1">
              <p className="flex justify-between"><span className="text-slate-400">Meta do mês</span><span className="font-bold text-violet-950">{formatBRL(metaMixMensalTotal)}</span></p>
              <p className="flex justify-between"><span className="text-slate-400">Realizado</span><span className="font-bold text-violet-950">{formatBRL(producaoMesLoja)}</span></p>
              <p className="flex justify-between"><span className="text-slate-400">Falta p/ meta</span><span className="font-bold text-violet-950">{formatBRL(faltaMesLoja)}</span></p>
              <p className="flex justify-between"><span className="text-slate-400">Ritmo ideal</span><span className="font-bold text-violet-600">{ritmoIdeal}%</span></p>
              <span className={`inline-block mt-1 text-[10px] font-bold px-2.5 py-1 rounded-full ${pctMes >= ritmoIdeal ? "bg-green-100 text-green-600" : "bg-amber-50 text-amber-700"}`}>{pctMes >= ritmoIdeal ? "DENTRO DO ESPERADO" : "ABAIXO DO ESPERADO"}</span>
            </div>
          </div>
        </div>
      </div>

      <ElegibilidadePanel contratosMesConsultorProduto={contratosMesConsultorProduto} consultores={consultores} superContasUnicasMesConsultor={superContasUnicasMesConsultor} />
    </>
  );
}

// ============================================================
// TELA: PAINEL ESTRATÉGICO
// ============================================================
function TelaPainelEstrategico({ producoes, diasUteisMes, diasUteisPassados, totalMesConsultorProduto, totalMesConsultorMix, contratosMesConsultorProduto, loading, consultoresLoja, metaIndividualConsultorProduto, metaIndividualConsultorMix, metaLojaProdutoTotal, metaLojaMix, metaSeguroUnid }) {
  const consultores = consultoresLoja;
  const diasUteisRestantes = Math.max(diasUteisMes - diasUteisPassados, 0);
  const ritmoIdeal = diasUteisMes > 0 ? Math.round((diasUteisPassados / diasUteisMes) * 100) : 0;
  const metaMixMensalTotal = metaLojaMix;
  const producaoMesLoja = consultores.reduce((acc, c) => acc + totalMesConsultorMix(c.id), 0);
  const faltaMesLoja = Math.max(metaMixMensalTotal - producaoMesLoja, 0);
  const pctMes = metaMixMensalTotal > 0 ? Math.round((producaoMesLoja / metaMixMensalTotal) * 100) : 0;
  const diariaNecessaria = diasUteisRestantes > 0 ? faltaMesLoja / diasUteisRestantes : 0;
  const projecaoMes = diasUteisPassados > 0 ? (producaoMesLoja / diasUteisPassados) * diasUteisMes : producaoMesLoja;
  const pctProjecao = metaMixMensalTotal > 0 ? Math.round((projecaoMes / metaMixMensalTotal) * 100) : 0;

  function metaProdutoTotal(produtoId) {
    if (produtoId === "mix") return metaMixMensalTotal;
    if (produtoId === "seguro") return metaSeguroUnid * consultores.length;
    return metaLojaProdutoTotal(produtoId);
  }
  function producaoProdutoTotal(produtoId) {
    if (produtoId === "mix") return producaoMesLoja;
    if (produtoId === "seguro") return consultores.reduce((acc, c) => acc + contratosMesConsultorProduto(c.id, "seguro"), 0);
    return consultores.reduce((acc, c) => acc + totalMesConsultorProduto(c.id, produtoId), 0);
  }

  const PRODUTOS_DESEMPENHO = [
    { id: "creditoPessoal", nome: "Crédito Pessoal", icon: Wallet },
    { id: "mix", nome: "Mix", icon: PieChartIcon, isRollup: true },
    { id: "consignado", nome: "Consignado", icon: Landmark },
    { id: "clt", nome: "CLT (Consignado Privado)", icon: Shirt },
    { id: "antecipacao", nome: "Antecipações", icon: Zap },
    { id: "seguro", nome: "Seguros", icon: ShieldCheck, isUnidade: true },
  ];

  const desempenhoProdutos = PRODUTOS_DESEMPENHO.map((p) => {
    const meta = metaProdutoTotal(p.id);
    const realizado = producaoProdutoTotal(p.id);
    const pct = meta > 0 ? Math.round((realizado / meta) * 100) : 0;
    const status = pct >= 80 ? { label: "Bom", color: "#22C55E" } : pct >= 50 ? { label: "Atenção", color: "#F5A623" } : { label: "Crítico", color: "#EF4444" };
    return { ...p, meta, realizado, pct, status };
  });

  const ranking = useMemo(() => {
    return consultores.map((c) => {
      const total = totalMesConsultorMix(c.id);
      const metaC = metaIndividualConsultorMix(c.id);
      const pct = metaC > 0 ? Math.round((total / metaC) * 100) : 0;
      const projecao = diasUteisPassados > 0 ? (total / diasUteisPassados) * diasUteisMes : total;
      const falta = Math.max(metaC - total, 0);
      const diaria = diasUteisRestantes > 0 ? falta / diasUteisRestantes : 0;
      const porProduto = ["creditoPessoal", "consignado", "clt", "antecipacao"].map((pid) => {
        const val = totalMesConsultorProduto(c.id, pid);
        const metaP = metaIndividualConsultorProduto(c.id, pid);
        const pctP = metaP > 0 ? val / metaP : 0;
        const nomes = { creditoPessoal: "Crédito Pessoal", consignado: "Consignado", clt: "CLT", antecipacao: "Antecipação" };
        return { id: pid, nome: nomes[pid], pctP };
      });
      const maisForte = [...porProduto].sort((a, b) => b.pctP - a.pctP)[0];
      const maisFraco = [...porProduto].sort((a, b) => a.pctP - b.pctP)[0];
      return { ...c, total, pct, projecao, falta, diaria, maisForte, maisFraco, metaIndividual: metaC };
    }).sort((a, b) => b.total - a.total);
  }, [producoes]);

  const lider = ranking[0];
  const semDados = !loading && producaoMesLoja === 0;

  const producoesMesArr = useMemo(() => producoes.filter((p) => (p.data || "").slice(0, 7) === mesAtual()), [producoes]);
  const maiorContrato = useMemo(() => {
    if (producoesMesArr.length === 0) return null;
    const maior = [...producoesMesArr].sort((a, b) => (Number(b.valor) || 0) - (Number(a.valor) || 0))[0];
    const consultor = consultores.find((c) => c.id === maior.consultorId);
    return { valor: Number(maior.valor) || 0, consultor: consultor?.nome || "—" };
  }, [producoesMesArr]);
  const melhorEmSeguros = useMemo(() => {
    return consultores.map((c) => ({ ...c, seguros: contratosMesConsultorProduto(c.id, "seguro") })).sort((a, b) => b.seguros - a.seguros)[0];
  }, [producoes]);

  const consultoresAbaixo = ranking.filter((r) => r.pct < ritmoIdeal);

  return (
    <>
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-950 via-violet-900 to-violet-800 px-5 sm:px-7 py-6 text-white">
        <div className="absolute -right-10 -top-10 w-52 h-52 rounded-full bg-orange-500 opacity-20 blur-3xl" />
        <div className="absolute -left-10 -bottom-16 w-52 h-52 rounded-full bg-violet-500 opacity-30 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">PAINEL ESTRATÉGICO</h1>
            <p className="text-sm text-violet-200 mt-1">Central de comando da operação. Onde cada decisão gera resultado.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur border border-white/10 px-3 py-2">
              <Calendar size={14} className="text-violet-200" />
              <div className="leading-tight"><p className="text-xs font-bold text-white">AGOSTO/2026</p><p className="text-[10px] text-violet-300">Mês corrente</p></div>
            </div>
            <button className="flex items-center gap-1.5 rounded-xl bg-orange-500 text-white px-3.5 py-2.5 text-xs font-bold hover:bg-orange-600 transition"><Mic size={14} /> MODO MATINAL</button>
            <button className="flex items-center gap-1.5 rounded-xl bg-white/10 border border-white/10 px-3 py-2 text-xs text-violet-100 hover:bg-white/20 transition"><RefreshCw size={13} /> Atualizar</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi icon={<Package size={16} />} label="PRODUÇÃO DA LOJA" value={formatBRL(producaoMesLoja)} sub="Mês (Mix)" />
        <Kpi icon={<Target size={16} />} label="META DO MÊS" value={formatBRL(metaMixMensalTotal)} sub="Mix" />
        <Kpi icon={<TrendingUp size={16} />} label="% ATINGIDO" value={`${pctMes}%`} sub="do mês" accent="orange" />
        <Kpi icon={<AlertTriangle size={16} />} label="FALTA" value={formatBRL(faltaMesLoja)} sub={faltaMesLoja === 0 ? "Meta batida" : "Para a meta"} />
        <Kpi icon={<Clock size={16} />} label="DIÁRIA NECESSÁRIA" value={formatBRL(diariaNecessaria)} sub={`Próx. ${diasUteisRestantes} dias úteis`} />
        <Kpi icon={<BarChart2 size={16} />} label="PROJEÇÃO DO MÊS" value={formatBRL(projecaoMes)} sub={`${pctProjecao}% da meta`} accent="orange" />
      </div>

      <div className="rounded-2xl bg-violet-600 p-4 sm:p-5 flex items-start gap-4 text-white">
        <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center shrink-0"><Bot size={24} /></div>
        <div>
          <p className="text-[11px] font-bold tracking-wide text-violet-100 mb-1">O PULSE TEM UMA DICA PARA VOCÊ</p>
          {semDados ? (
            <p className="text-sm leading-relaxed text-violet-50">Ainda não há produção lançada este mês. Assim que a equipe começar a lançar na Central de Produção, o Radar passa a gerar aqui um resumo automático da operação.</p>
          ) : (
            <p className="text-sm leading-relaxed text-violet-50">
              A operação está projetando <b>{pctProjecao}%</b> da meta. {desempenhoProdutos.find(p => p.id === "creditoPessoal").status.label !== "Bom" ? "O Crédito Pessoal ainda exige atenção. " : ""}
              {consultoresAbaixo.length > 0 ? <>Fique de olho em <b>{consultoresAbaixo.map(c => c.nome).join(" e ")}</b>, abaixo do ritmo esperado.</> : "Toda a equipe está dentro do ritmo esperado."}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-violet-100 bg-white p-4 sm:p-5">
          <div className="flex items-center gap-2 text-violet-950 font-bold text-sm mb-4"><Bell size={16} className="text-orange-500" /> ALERTAS DA OPERAÇÃO</div>
          <div className="space-y-3">
            {desempenhoProdutos.filter((p) => p.status.label !== "Bom").slice(0, 2).map((p) => (
              <AlertaItem key={p.id} color={p.status.color}>{p.nome} {p.status.label === "Crítico" ? "está crítico" : "abaixo da projeção da loja"}.</AlertaItem>
            ))}
            {consultoresAbaixo.slice(0, 2).map((r) => (
              <AlertaItem key={r.id} color="#F5A623"><b>{r.nome}</b> precisa vender {formatBRL(r.diaria)} hoje para manter o ritmo.</AlertaItem>
            ))}
            {desempenhoProdutos.filter((p) => p.status.label !== "Bom").length === 0 && consultoresAbaixo.length === 0 && (
              <p className="text-xs text-slate-400">Nenhum alerta no momento — operação dentro do esperado.</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-violet-100 bg-white p-4 sm:p-5 flex flex-col items-center">
          <p className="text-sm font-bold text-violet-950 mb-2 self-start">PROJEÇÃO DA LOJA</p>
          <Gauge pct={pctProjecao} />
          <p className="text-3xl font-extrabold text-violet-950 -mt-2">{pctProjecao}%</p>
          <p className="text-xs text-slate-400 mb-3">Projeção para o mês</p>
          <span className={`text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 ${pctProjecao >= 100 ? "bg-green-100 text-green-600" : "bg-amber-50 text-amber-700"}`}>
            <ClipboardCheck size={13} /> {pctProjecao >= 100 ? "DENTRO DA META" : "ABAIXO DA META"}
          </span>
        </div>

        <div className="rounded-2xl border border-violet-100 bg-white p-4 sm:p-5">
          <p className="text-sm font-bold text-violet-950 mb-4">DESEMPENHO POR PRODUTO</p>
          <div className="space-y-3.5">
            {desempenhoProdutos.map((p) => {
              const Icon = p.icon;
              return (
                <div key={p.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0"><Icon size={15} className="text-violet-600" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-violet-950 truncate">{p.nome}</span>
                      <span className="flex items-center gap-1.5 shrink-0 ml-2">
                        <span className="font-bold" style={{ color: p.status.color }}>{p.pct}%</span>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: p.status.color }} />
                        <span className="text-[10px] font-semibold" style={{ color: p.status.color }}>{p.status.label}</span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-violet-100 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.min(p.pct, 100)}%`, background: p.status.color }} /></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-violet-100 bg-white p-4 sm:p-5">
          <div className="flex items-center gap-2 text-violet-950 font-bold text-sm mb-4"><ClipboardList size={16} className="text-violet-600" /> PLANO DE AÇÃO DO DIA</div>
          <ul className="space-y-2.5 text-xs text-slate-600">
            {desempenhoProdutos.filter((p) => p.status.label !== "Bom").map((p) => (
              <li key={p.id} className="flex items-start gap-2"><ClipboardCheck size={14} className="text-violet-600 mt-0.5 shrink-0" /> Priorizar {p.nome} nas próximas abordagens.</li>
            ))}
            {consultoresAbaixo.length > 0 && (
              <li className="flex items-start gap-2"><ClipboardCheck size={14} className="text-violet-600 mt-0.5 shrink-0" /> {consultoresAbaixo.map(c => c.nome).join(" e ")} precisa{consultoresAbaixo.length === 1 ? "" : "m"} acelerar a produção.</li>
            )}
            {desempenhoProdutos.filter((p) => p.status.label === "Bom").length === desempenhoProdutos.length && consultoresAbaixo.length === 0 && (
              <li className="text-slate-400">Sem pontos de atenção — mantenha o ritmo atual.</li>
            )}
          </ul>
        </div>
        <div className="rounded-2xl border border-violet-100 bg-white p-4 sm:p-5">
          <div className="flex items-center gap-2 text-violet-950 font-bold text-sm mb-4"><Trophy size={16} className="text-orange-500" /> DESTAQUES DO DIA</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <Destaque icon={<Medal size={18} />} label="MELHOR CONSULTORA" valor={lider && lider.total > 0 ? lider.nome : "—"} sub={lider && lider.total > 0 ? `${lider.pct}%` : "Sem dados"} />
            <Destaque icon={<Trophy size={18} />} label="MAIOR CONTRATO" valor={maiorContrato ? formatBRL(maiorContrato.valor) : "—"} sub={maiorContrato ? maiorContrato.consultor : "Sem dados"} />
            <Destaque icon={<ShieldCheck size={18} />} label="MELHOR EM SEGUROS" valor={melhorEmSeguros && melhorEmSeguros.seguros > 0 ? melhorEmSeguros.nome : "—"} sub={melhorEmSeguros && melhorEmSeguros.seguros > 0 ? `${melhorEmSeguros.seguros} vendas` : "Sem dados"} />
            <Destaque icon={<Medal size={18} />} label="MAIOR EVOLUÇÃO" valor="—" sub="Em breve" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {ranking.map((r) => {
          const corPct = r.pct >= 100 ? "#22C55E" : r.pct >= ritmoIdeal ? "#F5A623" : "#EF4444";
          return (
            <div key={r.id} className="rounded-2xl border border-violet-100 bg-white p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <Avatar nome={r.nome} foto={r.foto} size={36} />
                  <p className="font-bold text-violet-950 text-sm">{r.nome}</p>
                </div>
                <span className="flex items-center gap-1 text-xs font-bold" style={{ color: corPct }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: corPct }} />{r.pct}%</span>
              </div>
              <div className="space-y-1 text-xs mb-3">
                <p className="flex justify-between"><span className="text-slate-400">Produção</span><span className="font-semibold text-violet-950">{formatBRL(r.total)}</span></p>
                <p className="flex justify-between"><span className="text-slate-400">Meta</span><span className="text-slate-600">{formatBRL(r.metaIndividual)}</span></p>
                <p className="flex justify-between"><span className="text-slate-400">Projeção</span><span className="font-semibold" style={{ color: r.projecao >= r.metaIndividual ? "#16A34A" : "#C2760F" }}>{formatBRL(r.projecao)}</span></p>
                <p className="flex justify-between"><span className="text-slate-400">Diária</span><span className="font-bold text-orange-500">{formatBRL(r.diaria)}</span></p>
              </div>
              <div className="space-y-1 text-[11px] border-t border-violet-50 pt-2.5">
                <p className="flex items-center justify-between"><span className="text-slate-400">Mais forte</span><span className="flex items-center gap-1 font-semibold text-green-600">{r.maisForte?.nome} <ArrowUp size={12} /></span></p>
                <p className="flex items-center justify-between"><span className="text-slate-400">Mais fraco</span><span className="flex items-center gap-1 font-semibold text-red-500">{r.maisFraco?.nome} <ArrowDown size={12} /></span></p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl bg-violet-950 text-white text-center py-4 text-sm font-medium">Liderar é transformar dados em ação e pessoas em resultados! 💜</div>
    </>
  );
}

// ============================================================
// TELA: PARCIAL DO DIA
// ============================================================
function TelaParcialDia({ producoes, acionamentos, salvarAcionamentos, salvarAcionamentoUnico, consultores, consultoresLoja, metaLojaProdutoTotal, metaLojaMix }) {
  const [periodo, setPeriodo] = useState("hoje");
  const [produtoFiltro, setProdutoFiltro] = useState("todos");
  const [fConsultor, setFConsultor] = useState("");
  const [fTipo, setFTipo] = useState("ligacao");
  const [fQtd, setFQtd] = useState(1);
  const [fObs, setFObs] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState(null);
  const [editandoAcionamentoId, setEditandoAcionamentoId] = useState(null);
  const [gerandoImagem, setGerandoImagem] = useState(false);

  async function gerarImagem() {
    setGerandoImagem(true);
    try {
      if (!window.html2canvas) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
          script.onload = resolve;
          script.onerror = () => reject(new Error("Não foi possível carregar a ferramenta de imagem."));
          document.body.appendChild(script);
        });
      }
      const elemento = document.getElementById("parcial-resumo-print");
      if (!elemento) throw new Error("Área de resumo não encontrada.");
      const canvas = await window.html2canvas(elemento, { backgroundColor: "#ffffff", scale: 2, useCORS: true });
      const link = document.createElement("a");
      link.download = `parcial-do-dia-${todayISO()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (e) {
      alert("Não foi possível gerar a imagem agora. Tenta de novo em alguns segundos.");
    } finally {
      setGerandoImagem(false);
    }
  }

  const PRODUTOS = [
    { id: "creditoPessoal", nome: "Crédito Pessoal", icon: Wallet },
    { id: "consignado", nome: "Consignado", icon: Landmark },
    { id: "clt", nome: "CLT", icon: Shirt },
    { id: "antecipacao", nome: "Antecipação", icon: Zap },
    { id: "mix", nome: "Mix", icon: PieChartIcon, isRollup: true },
  ];

  const hoje = todayISO();
  const diasPeriodo = periodo === "hoje" ? [hoje] : ultimosDias(7);
  const producoesPeriodo = useMemo(() => producoes.filter((p) => diasPeriodo.includes(p.data)), [producoes, periodo]);
  const acionamentosPeriodo = useMemo(() => acionamentos.filter((a) => diasPeriodo.includes(a.data)), [acionamentos, periodo]);

  function totalConsultorProduto(consultorId, produtoId) {
    return producoesPeriodo.filter((p) => p.consultorId === consultorId && p.produto === produtoId).reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
  }
  function totalConsultorMix(consultorId) {
    return ["creditoPessoal", "consignado", "clt", "antecipacao"].reduce((s, prod) => s + totalConsultorProduto(consultorId, prod), 0);
  }
  function acionamentosConsultor(consultorId) {
    return acionamentosPeriodo.filter((a) => a.consultorId === consultorId).reduce((s, a) => s + a.quantidade, 0);
  }

  const fatorPeriodo = periodo === "hoje" ? 1 : 5;
  function metaProduto(produtoId) {
    if (produtoId === "mix") return (metaLojaMix / DIAS_UTEIS_MES_PADRAO) * fatorPeriodo;
    return (metaLojaProdutoTotal(produtoId) / DIAS_UTEIS_MES_PADRAO) * fatorPeriodo;
  }
  function realizadoProduto(produtoId) {
    if (produtoId === "mix") return consultoresLoja.reduce((acc, c) => acc + totalConsultorMix(c.id), 0);
    return consultoresLoja.reduce((acc, c) => acc + totalConsultorProduto(c.id, produtoId), 0);
  }

  const producaoLojaPeriodo = realizadoProduto("mix");
  const metaLojaPeriodo = metaProduto("mix");
  const pctLoja = metaLojaPeriodo > 0 ? Math.round((producaoLojaPeriodo / metaLojaPeriodo) * 100) : 0;
  const metaAcionamentosLoja = META_ACIONAMENTOS_DIA_CONSULTOR * consultoresLoja.length * fatorPeriodo;
  const totalAcionamentos = acionamentosPeriodo.reduce((s, a) => s + a.quantidade, 0);
  const pctAcionamentos = metaAcionamentosLoja > 0 ? Math.round((totalAcionamentos / metaAcionamentosLoja) * 100) : 0;

  async function registrarAcionamento() {
    if (!fConsultor) return setMensagem({ tipo: "erro", texto: "Selecione um consultor antes de registrar." });
    if (!fQtd || fQtd <= 0) return setMensagem({ tipo: "erro", texto: "Informe uma quantidade válida (maior que 0)." });
    setSalvando(true); setMensagem(null);
    const idAlvo = editandoAcionamentoId;
    const r = await salvarAcionamentoUnico((listaFresca) => {
      if (idAlvo) {
        return listaFresca.map((a) => a.id === idAlvo
          ? { ...a, consultorId: fConsultor, tipo: fTipo, quantidade: fQtd, observacao: fObs }
          : a);
      }
      const novo = { id: `${Date.now()}`, consultorId: fConsultor, tipo: fTipo, quantidade: fQtd, observacao: fObs, data: hoje };
      return [...listaFresca, novo];
    });
    if (r.ok) setMensagem({ tipo: "sucesso", texto: editandoAcionamentoId ? "Acionamento atualizado!" : "Acionamento registrado com sucesso!" });
    else setMensagem({ tipo: "erro", texto: `Salvo nesta sessão (${r.erro}), mas pode não persistir ao recarregar.` });
    setFQtd(1); setFObs(""); setFConsultor(""); setEditandoAcionamentoId(null);
    setSalvando(false);
    setTimeout(() => setMensagem(null), 6000);
  }

  function editarAcionamento(a) {
    setFConsultor(a.consultorId); setFTipo(a.tipo); setFQtd(a.quantidade); setFObs(a.observacao || "");
    setEditandoAcionamentoId(a.id);
  }

  async function excluirAcionamento(id) {
    await salvarAcionamentoUnico((listaFresca) => listaFresca.filter((a) => a.id !== id));
    if (editandoAcionamentoId === id) { setEditandoAcionamentoId(null); setFQtd(1); setFObs(""); setFConsultor(""); }
  }

  const evolucaoData = useMemo(() => {
    const horas = ["08h", "09h", "10h", "11h", "12h", "13h", "14h", "15h", "16h", "17h", "18h"];
    const agora = new Date().getHours();
    return horas.map((h, i) => {
      const hourNum = 8 + i;
      const metaAcum = (metaLojaPeriodo / 10) * i;
      const realizadoAcum = hourNum <= agora ? Math.min(producaoLojaPeriodo, (producaoLojaPeriodo / Math.max(agora - 8, 1)) * i) : null;
      return { hora: h, meta: Math.round(metaAcum), realizado: realizadoAcum !== null ? Math.round(realizadoAcum) : null };
    });
  }, [producaoLojaPeriodo, metaLojaPeriodo]);

  const alertas = useMemo(() => {
    const lista = [];
    PRODUTOS.forEach((p) => {
      const meta = metaProduto(p.id);
      const real = realizadoProduto(p.id);
      const pct = meta > 0 ? (real / meta) * 100 : 0;
      if (pct < 50) lista.push({ cor: "#EF4444", texto: `${p.nome} abaixo do esperado — realizado ${Math.round(pct)}% da meta do período.` });
    });
    consultoresLoja.forEach((c) => {
      const falta = META_ACIONAMENTOS_DIA_CONSULTOR * fatorPeriodo - acionamentosConsultor(c.id);
      if (falta > 0) lista.push({ cor: "#F5A623", texto: `Faltam ${falta} acionamentos de ${c.nome} para a meta do período.` });
    });
    return lista.slice(0, 5);
  }, [producoesPeriodo, acionamentosPeriodo]);

  return (
    <>
      <div id="parcial-resumo-print" className="space-y-5">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-950 via-violet-900 to-violet-800 px-5 sm:px-7 py-6 text-white">
        <div className="absolute -right-10 -top-10 w-52 h-52 rounded-full bg-orange-500 opacity-20 blur-3xl" />
        <div className="absolute -left-10 -bottom-16 w-52 h-52 rounded-full bg-violet-500 opacity-30 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">PARCIAL DO DIA</h1>
            <p className="text-sm text-violet-200 mt-1">Acompanhe em tempo real a produção e os acionamentos do dia.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur border border-white/10 px-3 py-2">
              <Calendar size={14} className="text-violet-200" />
              <p className="text-xs font-bold text-white">{new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</p>
            </div>
            <button className="flex items-center gap-1.5 rounded-xl bg-white/10 border border-white/10 px-3 py-2 text-xs text-violet-100 hover:bg-white/20 transition"><ArrowLeftRight size={13} /> Comparar com ontem</button>
            <button onClick={gerarImagem} disabled={gerandoImagem} className="flex items-center gap-1.5 rounded-xl bg-orange-500 text-white px-3.5 py-2.5 text-xs font-bold hover:bg-orange-600 transition disabled:opacity-60">
              <ImageIcon size={14} /> {gerandoImagem ? "Gerando..." : "Gerar imagem"}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-xl bg-white border border-violet-100 p-1">
          {["hoje", "semana"].map((p) => (
            <button key={p} onClick={() => setPeriodo(p)} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${periodo === p ? "bg-violet-600 text-white" : "text-slate-500"}`}>{p === "hoje" ? "Hoje" : "Semana"}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <FiltroChip label="Todos" active={produtoFiltro === "todos"} onClick={() => setProdutoFiltro("todos")} />
          {PRODUTOS.filter(p => !p.isRollup).map((p) => <FiltroChip key={p.id} label={p.nome} active={produtoFiltro === p.id} onClick={() => setProdutoFiltro(p.id)} />)}
          <FiltroChip label="Mix" active={produtoFiltro === "mix"} onClick={() => setProdutoFiltro("mix")} />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-5">
        <div className="space-y-5">
          <div>
            <h2 className="text-sm font-extrabold text-violet-950 mb-3">Produção da Loja — {periodo === "hoje" ? "Hoje" : "Semana"}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {PRODUTOS.map((p) => {
                const meta = metaProduto(p.id);
                const real = realizadoProduto(p.id);
                const pct = meta > 0 ? Math.round((real / meta) * 100) : 0;
                const Icon = p.icon;
                const status = pct >= 100 ? { label: "Meta batida!", color: "#22C55E" } : pct >= 70 ? { label: "No ritmo", color: "#22C55E" } : pct >= 40 ? { label: "Atenção", color: "#F5A623" } : { label: "Crítico", color: "#EF4444" };
                return (
                  <div key={p.id} className={`rounded-2xl p-4 border ${p.isRollup ? "bg-gradient-to-br from-violet-600 to-violet-400 border-transparent text-white" : "bg-white border-violet-100"}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2.5 ${p.isRollup ? "bg-white/20" : "bg-violet-100"}`}><Icon size={15} className={p.isRollup ? "text-white" : "text-violet-600"} /></div>
                    <p className={`text-[10px] font-bold tracking-wide ${p.isRollup ? "text-white/80" : "text-slate-400"}`}>{p.nome.toUpperCase()}</p>
                    <p className={`text-[10px] ${p.isRollup ? "text-white/70" : "text-violet-300"}`}>Meta: {formatBRL(meta)}</p>
                    <p className="text-lg font-extrabold mt-1">{formatBRL(real)}</p>
                    <div className={`h-1.5 rounded-full mt-2 overflow-hidden ${p.isRollup ? "bg-white/20" : "bg-violet-100"}`}><div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: p.isRollup ? "#F5851F" : status.color }} /></div>
                    <p className="flex items-center gap-1 text-[10px] font-semibold mt-1.5" style={{ color: p.isRollup ? "#FDE9D0" : status.color }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: p.isRollup ? "#FDE9D0" : status.color }} />{pct}% · {status.label}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-extrabold text-violet-950 mb-3">Desempenho dos Consultores — {periodo === "hoje" ? "Hoje" : "Semana"}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {consultores.map((c) => {
                const totalMix = totalConsultorMix(c.id);
                const metaMix = metaProduto("mix") / (consultoresLoja.length || 1);
                const pctMix = metaMix > 0 ? Math.round((totalMix / metaMix) * 100) : 0;
                const status = c.externo
                  ? { label: "Externo", color: "#8B74D6" }
                  : pctMix >= 70 ? { label: "No ritmo", color: "#22C55E" } : pctMix >= 40 ? { label: "Atenção", color: "#F5A623" } : { label: "Abaixo", color: "#EF4444" };
                const chamadas = acionamentosConsultor(c.id);
                const metaChamadas = META_ACIONAMENTOS_DIA_CONSULTOR * fatorPeriodo;
                const pctChamadas = metaChamadas > 0 ? Math.round((chamadas / metaChamadas) * 100) : 0;
                const produtosMostrar = produtoFiltro === "todos" ? PRODUTOS.filter(p => !p.isRollup) : PRODUTOS.filter(p => p.id === produtoFiltro && !p.isRollup);
                return (
                  <div key={c.id} className="rounded-2xl border border-violet-100 bg-white p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar nome={c.nome} foto={c.foto} size={36} />
                        <p className="font-bold text-violet-950 text-sm">{c.nome}</p>
                      </div>
                      <span className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: status.color }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: status.color }} />{status.label}</span>
                    </div>
                    {c.externo && (
                      <p className="text-[10px] text-violet-400 -mt-2 mb-2">Consultor externo — produção não entra na meta/produção da loja.</p>
                    )}
                    <table className="w-full text-[11px] mb-3">
                      <thead><tr className="text-slate-400"><th className="text-left font-semibold pb-1">Produto</th>{!c.externo && <th className="text-right font-semibold pb-1">Meta</th>}<th className="text-right font-semibold pb-1">{c.externo ? "Vendido" : "Realiz."}</th>{!c.externo && <th className="text-right font-semibold pb-1">%</th>}</tr></thead>
                      <tbody>
                        {produtosMostrar.map((p) => {
                          const metaP = metaProduto(p.id) / (consultoresLoja.length || 1);
                          const realP = totalConsultorProduto(c.id, p.id);
                          const pctP = metaP > 0 ? Math.round((realP / metaP) * 100) : 0;
                          const dot = pctP >= 100 ? "#22C55E" : pctP >= 50 ? "#F5A623" : "#EF4444";
                          return (
                            <tr key={p.id} className="border-t border-violet-50">
                              <td className="py-1 text-violet-950">{p.nome}</td>
                              {!c.externo && <td className="py-1 text-right text-slate-500">{formatBRL(metaP)}</td>}
                              <td className="py-1 text-right font-semibold text-violet-950">{formatBRL(realP)}</td>
                              {!c.externo && <td className="py-1 text-right font-bold" style={{ color: dot }}>{pctP}%</td>}
                            </tr>
                          );
                        })}
                        <tr className="border-t-2 border-violet-200">
                          <td className="py-1 font-bold text-violet-950">Total (Mix)</td>
                          {!c.externo && <td className="py-1 text-right font-bold text-slate-500">{formatBRL(metaMix)}</td>}
                          <td className="py-1 text-right font-bold text-violet-600">{formatBRL(totalMix)}</td>
                          {!c.externo && <td className="py-1 text-right font-bold text-orange-500">{pctMix}%</td>}
                        </tr>
                      </tbody>
                    </table>
                    <div className="flex items-center justify-between rounded-xl bg-violet-50 px-3 py-2">
                      <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Phone size={12} className="text-violet-600" /> Ligações/Acionamentos</p>
                      <p className="text-xs font-bold text-violet-950">{chamadas} <span className="text-slate-400 font-normal">/ {metaChamadas} ({pctChamadas}%)</span></p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-violet-100 bg-white p-4 sm:p-5">
            <h3 className="text-sm font-bold text-violet-950 mb-3">Evolução da Produção da Loja (Mix)</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evolucaoData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EDE9FE" />
                  <XAxis dataKey="hora" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(v) => formatBRLCurto(v)} />
                  <Tooltip formatter={(v) => formatBRL(v)} />
                  <Line type="monotone" dataKey="meta" stroke="#C4B5FD" strokeDasharray="5 5" dot={false} name="Meta diária acumulada" />
                  <Line type="monotone" dataKey="realizado" stroke="#7C3AED" strokeWidth={2.5} dot={{ r: 3 }} name="Realizado" connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-violet-300 mt-2">Estimativa com base na distribuição da produção ao longo do horário comercial (08h–18h).</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-violet-100 bg-white p-4">
            <p className="text-xs font-bold text-violet-950 mb-3">Resumo do Período — Loja</p>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[11px] text-slate-400">Produção (Mix)</p>
                <p className="text-lg font-extrabold text-violet-950">{formatBRL(producaoLojaPeriodo)}</p>
                <p className="text-[11px] text-slate-400">Meta: {formatBRL(metaLojaPeriodo)}</p>
              </div>
              <MiniGauge pct={pctLoja} />
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-violet-50">
              <div>
                <p className="text-[11px] text-slate-400 flex items-center gap-1"><Phone size={11} /> Acionamentos</p>
                <p className="text-lg font-extrabold text-violet-950">{totalAcionamentos}</p>
                <p className="text-[11px] text-slate-400">Meta: {metaAcionamentosLoja}</p>
              </div>
              <MiniGauge pct={pctAcionamentos} color="#F5851F" />
            </div>
          </div>

          <div className="rounded-2xl border border-violet-100 bg-white p-4">
            <p className="text-xs font-bold text-violet-950 mb-3">Lançar Acionamentos</p>
            <label className="block text-[11px] text-slate-400 mb-1">Consultor</label>
            <select value={fConsultor} onChange={(e) => setFConsultor(e.target.value)} className="w-full rounded-lg border border-violet-100 bg-violet-50 px-2.5 py-2 text-xs text-violet-950 mb-3 outline-none focus:border-violet-400">
              <option value="">Selecione o consultor</option>
              {consultores.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <label className="block text-[11px] text-slate-400 mb-1">Tipo de contato</label>
            <div className="flex gap-1.5 mb-3">
              {[{ id: "ligacao", label: "Ligação", icon: Phone }, { id: "whatsapp", label: "WhatsApp", icon: MessageCircle }, { id: "outros", label: "Outros", icon: MoreHorizontal }].map((t) => {
                const Icon = t.icon;
                return (
                  <button key={t.id} onClick={() => setFTipo(t.id)} className={`flex-1 flex items-center justify-center gap-1 rounded-lg py-1.5 text-[10px] font-semibold border transition ${fTipo === t.id ? "bg-violet-600 text-white border-violet-600" : "border-violet-100 text-slate-500"}`}><Icon size={12} /> {t.label}</button>
                );
              })}
            </div>
            <label className="block text-[11px] text-slate-400 mb-1">Quantidade</label>
            <input type="number" min={1} value={fQtd} onChange={(e) => setFQtd(Math.max(1, Number(e.target.value) || 1))} placeholder="Ex.: 15"
              className="w-full rounded-lg border border-violet-100 bg-violet-50 px-2.5 py-2 text-sm font-bold text-violet-950 mb-3 outline-none focus:border-violet-400" />
            <label className="block text-[11px] text-slate-400 mb-1">Observação (opcional)</label>
            <textarea value={fObs} onChange={(e) => setFObs(e.target.value)} rows={2} placeholder="Ex.: Cliente solicitou retorno..."
              className="w-full rounded-lg border border-violet-100 bg-violet-50 px-2.5 py-2 text-xs text-violet-950 mb-3 outline-none focus:border-violet-400 resize-none" />
            <div className="flex gap-2">
              <button onClick={registrarAcionamento} disabled={salvando} className="flex-1 rounded-xl bg-violet-600 text-white text-xs font-bold py-2.5 disabled:opacity-40 hover:bg-violet-700 transition">{salvando ? "Salvando..." : editandoAcionamentoId ? "Salvar Alteração" : "Registrar Acionamento"}</button>
              {editandoAcionamentoId && (
                <button onClick={() => { setEditandoAcionamentoId(null); setFQtd(1); setFObs(""); setFConsultor(""); }} className="rounded-xl border border-violet-100 text-violet-600 text-xs font-bold px-3 hover:bg-violet-50 transition">Cancelar</button>
              )}
            </div>
            {mensagem && <p className={`mt-2 text-[11px] font-semibold ${mensagem.tipo === "sucesso" ? "text-green-600" : "text-red-500"}`}>{mensagem.texto}</p>}

            {acionamentosPeriodo.length > 0 && (
              <div className="mt-4 pt-4 border-t border-violet-50">
                <p className="text-[11px] font-bold text-slate-400 mb-2">Lançamentos ({periodo === "hoje" ? "hoje" : "semana"})</p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {[...acionamentosPeriodo].reverse().map((a) => (
                    <div key={a.id} className={`flex items-center justify-between gap-2 text-[11px] rounded-lg px-2.5 py-1.5 ${editandoAcionamentoId === a.id ? "bg-violet-100 ring-1 ring-violet-400" : "bg-violet-50"}`}>
                      <div className="min-w-0">
                        <p className="font-semibold text-violet-950 truncate">{consultores.find((c) => c.id === a.consultorId)?.nome || "—"} · {a.quantidade}x {a.tipo === "ligacao" ? "Ligação" : a.tipo === "whatsapp" ? "WhatsApp" : "Outros"}</p>
                        {a.observacao && <p className="text-slate-400 truncate">{a.observacao}</p>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => editarAcionamento(a)} className="w-6 h-6 rounded-lg border border-violet-100 flex items-center justify-center text-violet-600 hover:bg-white transition"><Pencil size={11} /></button>
                        <button onClick={() => excluirAcionamento(a.id)} className="w-6 h-6 rounded-lg border border-red-100 flex items-center justify-center text-red-500 hover:bg-red-50 transition"><Trash2 size={11} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-violet-100 bg-white p-4">
            <p className="text-xs font-bold text-violet-950 mb-3">{periodo === "hoje" ? "Hoje" : "Semana"} por consultor</p>
            <div className="space-y-2">
              {consultores.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">{c.nome}</span>
                  <span className="flex items-center gap-1 font-bold text-violet-950">{acionamentosConsultor(c.id)} <Phone size={11} className="text-violet-400" /></span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-violet-950 p-4 text-white">
            <p className="text-xs font-bold flex items-center gap-1.5 mb-3"><Bell size={13} className="text-orange-400" /> Principais Alertas</p>
            {alertas.length === 0 ? <p className="text-[11px] text-violet-200">Nenhum alerta no momento.</p> : (
              <div className="space-y-2.5">
                {alertas.map((a, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11px] text-violet-100"><AlertTriangle size={12} className="mt-0.5 shrink-0" style={{ color: a.cor }} />{a.texto}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </>
  );
}

// ============================================================
// TELA: CENTRAL DE PRODUÇÃO
// ============================================================
const CAMPOS_VAZIOS = {
  cliente: "", cpf: "", telefone: "", adesao: "", data: todayISO(),
  produto: "", valor: "", consultorId: "",
  tipoCredito: "", proximoRefin: "", possuiOferta: "sim", status: "digitado",
};

function TelaCentralProducao({ producoes, salvarProducoes, salvarProducaoUnica, consultores, consultorFixoId }) {
  const [campos, setCampos] = useState(() => consultorFixoId ? { ...CAMPOS_VAZIOS, consultorId: consultorFixoId } : CAMPOS_VAZIOS);
  const [editandoId, setEditandoId] = useState(null);
  const [busca, setBusca] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState(null);

  const producoesVisiveis = consultorFixoId ? producoes.filter((p) => p.consultorId === consultorFixoId) : producoes;

  const producoesFiltradas = useMemo(
    () => [...producoesVisiveis].filter((p) => {
      if (!busca.trim()) return true;
      const q = busca.toLowerCase();
      return p.cliente?.toLowerCase().includes(q) || p.cpf?.includes(q) || p.adesao?.toLowerCase().includes(q);
    }).sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0)),
    [producoesVisiveis, busca]
  );

  function limparCampos() { setCampos(consultorFixoId ? { ...CAMPOS_VAZIOS, consultorId: consultorFixoId } : CAMPOS_VAZIOS); setEditandoId(null); }

  async function registrarProducao() {
    if (!campos.cliente.trim()) return setMensagem({ tipo: "erro", texto: "Informe o nome do cliente." });
    if (!campos.cpf.trim()) return setMensagem({ tipo: "erro", texto: "Informe o CPF do cliente." });
    if (!campos.telefone.trim()) return setMensagem({ tipo: "erro", texto: "Informe o telefone do cliente." });
    if (!campos.adesao.trim()) return setMensagem({ tipo: "erro", texto: "Informe o número da adesão." });
    if (!campos.data) return setMensagem({ tipo: "erro", texto: "Informe a data da produção." });
    if (!campos.produto) return setMensagem({ tipo: "erro", texto: "Selecione o produto." });
    if (!campos.consultorId) return setMensagem({ tipo: "erro", texto: "Selecione o consultor responsável." });
    if (campos.produto !== "seguro" && (!campos.valor || parseValorMonetario(campos.valor) <= 0)) return setMensagem({ tipo: "erro", texto: "Informe o valor liberado." });

    setSalvando(true); setMensagem(null);

    // checa duplicidade de adesão contra a versão mais recente do banco —
    // importante com várias pessoas lançando ao mesmo tempo em telas diferentes
    if (!editandoId) {
      try {
        const atual = await window.storage.get(STORAGE_KEY, false);
        const listaFresca = atual ? JSON.parse(atual.value) : producoes;
        const duplicada = listaFresca.find((p) => p.adesao.trim() === campos.adesao.trim());
        if (duplicada) {
          const nomeCons = consultores.find((c) => c.id === duplicada.consultorId)?.nome || duplicada.consultorId;
          const confirmou = window.confirm(
            `Atenção: a adesão "${campos.adesao.trim()}" já foi lançada por ${nomeCons} em ${duplicada.data} (${duplicada.hora}).\n\n` +
            `Deseja lançar mesmo assim?`
          );
          if (!confirmou) { setSalvando(false); return; }
        }
      } catch (e) { /* se não conseguir checar, segue normalmente sem travar o lançamento */ }
    }

    const quemEstaMexendo = consultorFixoId
      ? (consultores.find((c) => c.id === consultorFixoId)?.nome || "Consultor(a)")
      : "Supervisora";

    const registro = {
      id: editandoId || `${Date.now()}`,
      data: campos.data,
      criadoEm: editandoId ? producoes.find((p) => p.id === editandoId)?.criadoEm || Date.now() : Date.now(),
      hora: editandoId ? producoes.find((p) => p.id === editandoId)?.hora || horaAgora() : horaAgora(),
      cliente: campos.cliente.trim(), cpf: campos.cpf.trim(), telefone: campos.telefone.trim(), adesao: campos.adesao.trim(),
      produto: campos.produto, valor: parseValorMonetario(campos.valor), consultorId: campos.consultorId,
      tipoCredito: campos.produto === "creditoPessoal" ? campos.tipoCredito : "",
      proximoRefin: campos.produto === "creditoPessoal" ? campos.proximoRefin : "",
      possuiOferta: campos.produto === "creditoPessoal" ? campos.possuiOferta : "",
      // status "digitado" só vira "pago" quando a supervisora confirma o pagamento (só ela edita isso)
      status: campos.status || "digitado",
      // rastro de quem lançou/editou, pra manter transparência com vários usuários no sistema
      criadoPor: editandoId ? (producoes.find((p) => p.id === editandoId)?.criadoPor || quemEstaMexendo) : quemEstaMexendo,
      ...(editandoId ? { editadoPor: quemEstaMexendo, editadoEm: new Date().toISOString() } : {}),
    };

    const idAlvo = editandoId;
    const r = await salvarProducaoUnica((listaFresca) =>
      idAlvo ? listaFresca.map((p) => (p.id === idAlvo ? registro : p)) : [...listaFresca, registro]
    );
    if (r.ok) setMensagem({ tipo: "sucesso", texto: editandoId ? "Produção atualizada! Já refletida na Matinal, Painel e Parcial." : "Produção registrada! Já refletida na Matinal, Painel e Parcial." });
    else setMensagem({ tipo: "erro", texto: `Salvo nesta sessão (${r.erro}) — já aparece nas outras telas agora, mas pode não persistir ao recarregar.` });
    limparCampos();
    setSalvando(false);
    setTimeout(() => setMensagem(null), 7000);
  }

  function editar(p) {
    setCampos({ cliente: p.cliente, cpf: p.cpf, telefone: p.telefone, adesao: p.adesao, data: p.data || todayISO(),
      produto: p.produto, valor: p.valor, consultorId: p.consultorId,
      tipoCredito: p.tipoCredito || "", proximoRefin: p.proximoRefin || "", possuiOferta: p.possuiOferta || "sim",
      status: p.status || "digitado" });
    setEditandoId(p.id);
  }

  async function excluir(id) {
    const r = await salvarProducaoUnica((listaFresca) => listaFresca.filter((p) => p.id !== id));
    if (!r.ok) setMensagem({ tipo: "erro", texto: `Excluído aqui, mas não confirmado no armazenamento (${r.erro}).` });
    setTimeout(() => setMensagem(null), 5000);
  }

  const nomeProduto = (id) => PRODUTOS_LANCAMENTO.find((p) => p.id === id)?.nome || id;
  const nomeConsultor = (id) => consultores.find((c) => c.id === id)?.nome || id;
  const formatarData = (d) => d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "–";

  return (
    <>
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-950 via-violet-900 to-violet-800 px-5 sm:px-7 py-6 text-white">
        <div className="absolute -right-10 -top-10 w-52 h-52 rounded-full bg-orange-500 opacity-20 blur-3xl" />
        <div className="absolute -left-10 -bottom-16 w-52 h-52 rounded-full bg-violet-500 opacity-30 blur-3xl" />
        <div className="relative">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">CENTRAL DE PRODUÇÃO</h1>
          <p className="text-sm text-violet-200 mt-1">Registre aqui apenas as produções pagas.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-violet-100 bg-white p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <h2 className="text-sm font-extrabold text-violet-950 flex items-center gap-2"><Plus size={16} className="text-violet-600" />{editandoId ? "Editar Produção" : "Registrar Nova Produção"}</h2>
          <div className="flex gap-2">
            <button onClick={limparCampos} className="flex items-center gap-1.5 rounded-xl border border-violet-100 px-3 py-2 text-xs font-semibold text-slate-500 hover:border-violet-300 transition"><RotateCcw size={13} /> Limpar Campos</button>
            <button onClick={registrarProducao} disabled={salvando} className="flex items-center gap-1.5 rounded-xl bg-violet-600 text-white px-4 py-2 text-xs font-bold hover:bg-violet-700 disabled:opacity-40 transition"><Plus size={13} /> {salvando ? "Salvando..." : editandoId ? "Salvar Alterações" : "Registrar Produção"}</button>
          </div>
        </div>

        {mensagem && (
          <div className={`mb-5 flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-xs font-medium ${mensagem.tipo === "sucesso" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
            {mensagem.tipo === "sucesso" ? <CheckCircle2 size={15} className="shrink-0 mt-0.5" /> : <AlertCircle size={15} className="shrink-0 mt-0.5" />}
            {mensagem.texto}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-bold text-violet-950 mb-3"><User size={14} className="text-violet-600" /> Dados do Cliente</p>
            <Campo label="Nome do Cliente *"><input value={campos.cliente} onChange={(e) => setCampos({ ...campos, cliente: e.target.value })} placeholder="Digite o nome do cliente" className={inputClass} /></Campo>
            <Campo label="CPF *"><input value={campos.cpf} onChange={(e) => setCampos({ ...campos, cpf: formatCPF(e.target.value) })} placeholder="000.000.000-00" className={inputClass} /></Campo>
            <Campo label="Telefone *"><input value={campos.telefone} onChange={(e) => setCampos({ ...campos, telefone: formatTelefone(e.target.value) })} placeholder="(17) 99999-9999" className={inputClass} /></Campo>
            <Campo label="Nº da Adesão *"><input value={campos.adesao} onChange={(e) => setCampos({ ...campos, adesao: e.target.value })} placeholder="Digite o número da adesão" className={inputClass} /></Campo>
          </div>

          <div>
            <p className="flex items-center gap-1.5 text-xs font-bold text-violet-950 mb-3"><Briefcase size={14} className="text-violet-600" /> Dados da Operação</p>
            <Campo label="Data da Produção *">
              <input type="date" value={campos.data} onChange={(e) => setCampos({ ...campos, data: e.target.value })} className={inputClass} />
            </Campo>
            <Campo label="Produto *">
              <select value={campos.produto} onChange={(e) => setCampos({ ...campos, produto: e.target.value })} className={inputClass}>
                <option value="">Selecione o produto</option>
                {PRODUTOS_LANCAMENTO.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </Campo>
            <Campo label={campos.produto === "seguro" ? "Valor do Prêmio (opcional)" : "Valor Liberado (R$) *"}>
              <input
                type="text"
                inputMode="decimal"
                value={campos.valor}
                onChange={(e) => {
                  // aceita dígitos e separadores de milhar/decimal — o
                  // ÚLTIMO separador digitado é sempre tratado como decimal,
                  // e qualquer separador anterior a ele é removido (era só
                  // separador de milhar, ex.: "1.500,00" → mantém "1500,00").
                  let v = e.target.value.replace(/[^0-9.,]/g, "");
                  const seps = v.match(/[.,]/g);
                  if (seps && seps.length > 1) {
                    const ultimoSep = seps[seps.length - 1];
                    const posUltimo = v.lastIndexOf(ultimoSep);
                    const parteInteira = v.slice(0, posUltimo).replace(/[.,]/g, "");
                    const parteDecimal = v.slice(posUltimo + 1).replace(/[.,]/g, "");
                    v = parteInteira + ultimoSep + parteDecimal;
                  }
                  setCampos({ ...campos, valor: v });
                }}
                placeholder="0,00"
                className={inputClass}
              />
            </Campo>

            {campos.produto === "creditoPessoal" && (
              <div className="mt-4 rounded-xl bg-violet-50 border border-violet-100 p-3.5">
                <p className="text-[11px] text-violet-500 mb-3 flex items-center gap-1.5"><CreditCard size={12} /> Campos específicos de Crédito Pessoal</p>
                <Campo label="Tipo de Crédito *">
                  <select value={campos.tipoCredito} onChange={(e) => setCampos({ ...campos, tipoCredito: e.target.value })} className={inputClass}>
                    <option value="">Selecione o tipo</option>
                    {TIPOS_CREDITO_PESSOAL.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Campo>
                <Campo label="Data do Próximo Refinanciamento"><input type="date" value={campos.proximoRefin} onChange={(e) => setCampos({ ...campos, proximoRefin: e.target.value })} className={inputClass} /></Campo>
                <Campo label="Ainda possui oferta?">
                  <div className="flex gap-4 mt-1">
                    {["sim", "nao"].map((v) => (
                      <label key={v} className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                        <input type="radio" name="oferta" checked={campos.possuiOferta === v} onChange={() => setCampos({ ...campos, possuiOferta: v })} className="accent-violet-600" />{v === "sim" ? "Sim" : "Não"}
                      </label>
                    ))}
                  </div>
                </Campo>
              </div>
            )}
          </div>

          <div>
            <p className="flex items-center gap-1.5 text-xs font-bold text-violet-950 mb-3"><Wallet size={14} className="text-violet-600" /> Consultor Responsável</p>
            {consultorFixoId ? (
              <div className="flex items-center gap-2 rounded-lg border border-violet-100 bg-violet-50 px-3 py-2.5 text-xs text-violet-950">
                <Avatar nome={consultores.find((c) => c.id === consultorFixoId)?.nome || ""} foto={consultores.find((c) => c.id === consultorFixoId)?.foto} size={20} />
                {consultores.find((c) => c.id === consultorFixoId)?.nome} <span className="text-violet-300">(você)</span>
              </div>
            ) : (
              <Campo label="Consultor *">
                <select value={campos.consultorId} onChange={(e) => setCampos({ ...campos, consultorId: e.target.value })} className={inputClass}>
                  <option value="">Selecione o consultor</option>
                  {consultores.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </Campo>
            )}
          </div>

          {/* visível pra todo mundo — supervisora e consultor(a) — na criação e na edição. */}
          <div className="mt-4">
            <p className="block text-[11px] text-slate-400 mb-1">Status</p>
            <div className="flex gap-1.5 max-w-xs">
              <button type="button" onClick={() => setCampos({ ...campos, status: "digitado" })}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold border transition ${(campos.status || "digitado") === "digitado" ? "bg-amber-500 text-white border-amber-500" : "border-violet-100 text-slate-500"}`}>
                <Clock size={13} /> Digitado
              </button>
              <button type="button" onClick={() => setCampos({ ...campos, status: "pago" })}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold border transition ${campos.status === "pago" ? "bg-green-600 text-white border-green-600" : "border-violet-100 text-slate-500"}`}>
                <CheckCircle2 size={13} /> Pago
              </button>
            </div>
          </div>
        </div>
        <p className="text-[11px] text-violet-300 mt-4">* Campos obrigatórios</p>
      </div>

      <div className="rounded-2xl border border-violet-100 bg-white p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-extrabold text-violet-950">Produções Registradas ({producoesFiltradas.length})</h3>
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-violet-300" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, CPF ou adesão..." className="w-full rounded-xl border border-violet-100 bg-violet-50 pl-9 pr-3 py-2 text-xs text-violet-950 outline-none focus:border-violet-400" />
          </div>
        </div>

        {producoesFiltradas.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">Nenhuma produção registrada ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[780px]">
              <thead>
                <tr className="text-left text-[10px] font-bold tracking-wide text-slate-400 border-b border-violet-100">
                  <th className="py-2 pr-3">#</th><th className="py-2 pr-3">Cliente</th><th className="py-2 pr-3">Data</th><th className="py-2 pr-3">Produto</th>
                  <th className="py-2 pr-3">Tipo</th><th className="py-2 pr-3">Valor</th><th className="py-2 pr-3">Consultor</th><th className="py-2 pr-3">Status</th><th className="py-2 pl-3 text-right sticky right-0 bg-white">Ações</th>
                </tr>
              </thead>
              <tbody>
                {producoesFiltradas.map((p, i) => (
                  <tr key={p.id} className="border-b border-violet-50">
                    <td className="py-2.5 pr-3 text-slate-400">{i + 1}</td>
                    <td className="py-2.5 pr-3 font-semibold text-violet-950 whitespace-nowrap">
                      {p.cliente}
                      {p.criadoPor && (
                        <p className="text-[9px] font-normal text-slate-400 mt-0.5">
                          {p.editadoPor ? `editado por ${p.editadoPor}` : `lançado por ${p.criadoPor}`}
                        </p>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-slate-500 whitespace-nowrap">{formatarData(p.data)}</td>
                    <td className="py-2.5 pr-3 text-violet-950 whitespace-nowrap">{nomeProduto(p.produto)}</td>
                    <td className="py-2.5 pr-3 text-slate-500">{p.tipoCredito || "–"}</td>
                    <td className="py-2.5 pr-3 font-bold text-violet-600 whitespace-nowrap">
                      {p.produto === "seguro" ? (p.valor > 0 ? `${formatBRL(p.valor)} (prêmio)` : "1 unidade") : formatBRL(p.valor)}
                    </td>
                    <td className="py-2.5 pr-3 text-slate-600 whitespace-nowrap">{nomeConsultor(p.consultorId)}</td>
                    <td className="py-2.5 pr-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${(!p.status || p.status === "digitado") ? "bg-amber-50 text-amber-600" : "bg-green-50 text-green-600"}`}>
                        {(!p.status || p.status === "digitado") ? "Digitado" : "Pago"}
                      </span>
                    </td>
                    <td className="py-2.5 pl-3 sticky right-0 bg-white">
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => editar(p)} className="w-7 h-7 rounded-lg border border-violet-100 flex items-center justify-center text-violet-600 hover:bg-violet-50 transition"><Pencil size={12} /></button>
                        <button onClick={() => excluir(p.id)} className="w-7 h-7 rounded-lg border border-red-100 flex items-center justify-center text-red-500 hover:bg-red-50 transition"><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function Campo({ label, children }) {
  return <div><label className="block text-[11px] text-slate-400 mb-1">{label}</label>{children}</div>;
}

// ============================================================
// TELA: CONFIGURAÇÕES
// ============================================================
function TelaConfiguracoes({ diasUteisMes, diasUteisPassados, salvarConfig, consultores, adicionarConsultor, removerConsultor, atualizarFotoConsultor, atualizarConsultorCampo, metasIndividuais, atualizarMetaIndividual, metaSeguroUnid, metaLojaPorProduto, atualizarMetaLojaProduto, atualizarMetaLojaTodos, metaLojaMix, metaIndividualConsultorMix, supervisorPin, superContasUnicasMesConsultor }) {
  const [aba, setAba] = useState("metaLoja");
  const [metaLojaRascunho, setMetaLojaRascunho] = useState(metaLojaPorProduto);
  const [seguroRascunho, setSeguroRascunho] = useState(metaSeguroUnid);
  const [pinRascunho, setPinRascunho] = useState(supervisorPin || "");
  const [salvo, setSalvo] = useState(null);
  const [novoNome, setNovoNome] = useState("");
  const [novoExterno, setNovoExterno] = useState(false);
  const [consultorExpandido, setConsultorExpandido] = useState(null);
  const [pinsVisiveis, setPinsVisiveis] = useState({});
  const [mostrarPinSupervisor, setMostrarPinSupervisor] = useState(false);
  const [pinSalvo, setPinSalvo] = useState(null);

  const abas = [
    { id: "geral", label: "Geral" },
    { id: "metaLoja", label: "Meta da Loja" },
    { id: "individuais", label: "Metas Individuais" },
    { id: "consultores", label: "Consultores" },
    { id: "agenda", label: "Agenda e Calendário" },
  ];

  function salvarMetaLoja() {
    atualizarMetaLojaTodos(metaLojaRascunho);
    salvarConfig(undefined, undefined, Number(seguroRascunho) || 0);
    setSalvo("loja");
    setTimeout(() => setSalvo(null), 3000);
  }

  const mixRascunhoTotal = ["creditoPessoal", "consignado", "clt", "antecipacao"].reduce((s, pid) => s + (Number(metaLojaRascunho[pid]) || 0), 0);
  const somaIndividuais = consultores.filter((c) => !c.externo).reduce((acc, c) => acc + metaIndividualConsultorMix(c.id), 0);
  const diferencaLoja = mixRascunhoTotal - somaIndividuais;

  function handleAdicionar() {
    if (!novoNome.trim()) return;
    adicionarConsultor(novoNome.trim(), novoExterno);
    setNovoNome("");
    setNovoExterno(false);
  }

  function handleFoto(id, file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => atualizarFotoConsultor(id, reader.result);
    reader.readAsDataURL(file);
  }

  return (
    <>
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-950 via-violet-900 to-violet-800 px-5 sm:px-7 py-6 text-white">
        <div className="absolute -right-10 -top-10 w-52 h-52 rounded-full bg-orange-500 opacity-20 blur-3xl" />
        <div className="absolute -left-10 -bottom-16 w-52 h-52 rounded-full bg-violet-500 opacity-30 blur-3xl" />
        <div className="relative">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">CONFIGURAÇÕES</h1>
          <p className="text-sm text-violet-200 mt-1">Gerencie as configurações da loja, metas, consultores e calendário.</p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {abas.map((a) => (
          <button key={a.id} onClick={() => setAba(a.id)}
            className={`shrink-0 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap transition ${aba === a.id ? "bg-violet-600 text-white" : "bg-white text-slate-500 border border-violet-100"}`}>
            {a.label}
          </button>
        ))}
      </div>

      {aba === "geral" && (
        <div className="rounded-2xl border border-violet-100 bg-white p-4 sm:p-6">
          <h2 className="text-sm font-extrabold text-violet-950 mb-4 flex items-center gap-2"><Home size={16} className="text-violet-600" /> Informações da Loja</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Campo label="Nome da Loja"><input defaultValue="Help" placeholder="Nome da loja" className={inputClass} /></Campo>
            <Campo label="Supervisor(a) Responsável"><input defaultValue="Letícia" placeholder="Nome do supervisor" className={inputClass} /></Campo>
            <Campo label="Endereço"><input placeholder="Endereço da loja" className={inputClass} /></Campo>
            <Campo label="Telefone"><input placeholder="(17) 0000-0000" className={inputClass} /></Campo>
          </div>
          <p className="text-[11px] text-violet-300 mt-2">Esses campos ainda são apenas visuais — se você quiser, posso conectá-los de verdade em uma próxima etapa.</p>

          <div className="mt-6 pt-6 border-t border-violet-100">
            <h2 className="text-sm font-extrabold text-violet-950 mb-1 flex items-center gap-2"><ShieldCheck size={16} className="text-violet-600" /> Seu PIN de Acesso (Supervisor)</h2>
            <p className="text-[11px] text-slate-400 mb-3">Esse é o PIN que você usa pra entrar como Supervisor. Enquanto estiver em branco, qualquer PIN funciona.</p>
            <div className="flex items-end gap-3">
              <Campo label="PIN (4 a 6 dígitos)">
                <div className="relative max-w-[160px]">
                  <input type={mostrarPinSupervisor ? "text" : "password"} inputMode="numeric" maxLength={6} value={pinRascunho} onChange={(e) => setPinRascunho(e.target.value.replace(/\D/g, ""))}
                    placeholder="Ex: 1234" className={inputClass + " mb-0 pr-9"} />
                  <button type="button" onClick={() => setMostrarPinSupervisor(!mostrarPinSupervisor)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-violet-300 hover:text-violet-600 transition">
                    {mostrarPinSupervisor ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </Campo>
              <button onClick={async () => {
                setSalvo("pin-salvando");
                const r = await salvarConfig(undefined, undefined, undefined, pinRascunho);
                setSalvo(r.ok ? "pin" : "pin-erro");
                setTimeout(() => setSalvo(null), r.ok ? 3000 : 6000);
              }}
                className="rounded-xl bg-violet-600 text-white px-4 py-2.5 text-xs font-bold hover:bg-violet-700 transition disabled:opacity-60" disabled={salvo === "pin-salvando"}>
                {salvo === "pin-salvando" ? "Salvando..." : "Salvar PIN"}
              </button>
            </div>
            {salvo === "pin" && <div className="mt-3 text-xs font-medium rounded-lg px-3 py-2 bg-green-50 text-green-700 flex items-center gap-2 max-w-xs"><CheckCircle2 size={14} /> PIN atualizado e confirmado no banco!</div>}
            {salvo === "pin-erro" && <div className="mt-3 text-xs font-medium rounded-lg px-3 py-2 bg-red-50 text-red-700 flex items-center gap-2 max-w-sm"><AlertTriangle size={14} className="flex-shrink-0" /> Não consegui confirmar o salvamento no banco (conexão instável). O PIN pode NÃO ter sido atualizado — tente de novo.</div>}
          </div>
        </div>
      )}

      {aba === "metaLoja" && (
        <div className="rounded-2xl border border-violet-100 bg-white p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
            <h2 className="text-sm font-extrabold text-violet-950 flex items-center gap-2"><Target size={16} className="text-violet-600" /> Meta Oficial da Loja — por Produto</h2>
            <button onClick={salvarMetaLoja} className="rounded-xl bg-violet-600 text-white px-4 py-2 text-xs font-bold hover:bg-violet-700 transition">Salvar</button>
          </div>
          <p className="text-[11px] text-slate-400 mb-4">
            Defina a meta da loja produto por produto. O Mix é a soma automática dos quatro. Esses números aparecem em Matinal, Painel Estratégico e Parcial do Dia — independente das metas individuais de cada consultor.
          </p>

          {salvo === "loja" && <div className="mb-4 text-xs font-medium rounded-lg px-3 py-2 bg-green-50 text-green-700 flex items-center gap-2"><CheckCircle2 size={14} /> Meta da loja atualizada em todas as telas!</div>}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <Campo label="Crédito Pessoal (R$/mês)">
              <input type="number" min="0" value={metaLojaRascunho.creditoPessoal} onChange={(e) => setMetaLojaRascunho({ ...metaLojaRascunho, creditoPessoal: e.target.value })} className={inputClass} />
            </Campo>
            <Campo label="Consignado (R$/mês)">
              <input type="number" min="0" value={metaLojaRascunho.consignado} onChange={(e) => setMetaLojaRascunho({ ...metaLojaRascunho, consignado: e.target.value })} className={inputClass} />
            </Campo>
            <Campo label="CLT / Consignado Privado (R$/mês)">
              <input type="number" min="0" value={metaLojaRascunho.clt} onChange={(e) => setMetaLojaRascunho({ ...metaLojaRascunho, clt: e.target.value })} className={inputClass} />
            </Campo>
            <Campo label="Antecipação (R$/mês)">
              <input type="number" min="0" value={metaLojaRascunho.antecipacao} onChange={(e) => setMetaLojaRascunho({ ...metaLojaRascunho, antecipacao: e.target.value })} className={inputClass} />
            </Campo>
          </div>

          <Campo label="Seguro — meta em unidades (por consultor/mês)">
            <input type="number" min="0" value={seguroRascunho} onChange={(e) => setSeguroRascunho(e.target.value)} className={inputClass + " max-w-[200px]"} />
          </Campo>

          <div className="rounded-xl bg-violet-600 px-4 py-3.5 flex items-center justify-between mt-3">
            <span className="text-xs text-violet-100 font-semibold">Meta de Mix da Loja (soma automática)</span>
            <span className="text-lg font-extrabold text-white">{formatBRL(mixRascunhoTotal)}</span>
          </div>

          <div className="rounded-xl bg-violet-50 border border-violet-100 px-4 py-3 flex items-center justify-between mt-2">
            <span className="text-xs text-violet-500 font-semibold">Soma das metas individuais (referência)</span>
            <span className="text-sm font-extrabold text-violet-950">{formatBRL(somaIndividuais)}</span>
          </div>
          <div className={`rounded-xl border px-4 py-3 flex items-center justify-between mt-2 ${diferencaLoja === 0 ? "bg-green-50 border-green-100" : "bg-amber-50 border-amber-100"}`}>
            <span className={`text-xs font-semibold ${diferencaLoja === 0 ? "text-green-600" : "text-amber-700"}`}>
              {diferencaLoja === 0 ? "Meta da loja bate exatamente com a soma das individuais" : diferencaLoja > 0 ? "Meta da loja está acima da soma das individuais" : "Soma das individuais passa da meta da loja"}
            </span>
            <span className={`text-sm font-extrabold ${diferencaLoja === 0 ? "text-green-600" : "text-amber-700"}`}>{diferencaLoja >= 0 ? "+" : ""}{formatBRL(diferencaLoja)}</span>
          </div>

          <p className="text-[11px] text-violet-300 mt-4">
            Critério de elegibilidade ao comissionamento (SuperConta {ELEGIBILIDADE.superConta}, Seguro {ELEGIBILIDADE.seguro}, Consignado {ELEGIBILIDADE.consignado}, CLT {ELEGIBILIDADE.clt} contratos — SuperConta conta só CPFs diferentes) ainda é fixo para todas — posso deixar editável se você quiser.
          </p>
        </div>
      )}

      {aba === "individuais" && (
        <div className="rounded-2xl border border-violet-100 bg-white p-4 sm:p-6">
          <h2 className="text-sm font-extrabold text-violet-950 mb-1 flex items-center gap-2"><Target size={16} className="text-violet-600" /> Metas Individuais por Consultor</h2>
          <p className="text-[11px] text-slate-400 mb-4">Consultores novos podem ter meta menor; os mais antigos, maior. Cada uma tem sua própria meta por produto.</p>

          <div className="space-y-3">
            {consultores.map((c) => {
              const m = metasIndividuais[c.id] || { creditoPessoal: 0, consignado: 0, clt: 0, antecipacao: 0 };
              const mixC = metaIndividualConsultorMix(c.id);
              return (
                <div key={c.id} className="rounded-xl border border-violet-100 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar nome={c.nome} foto={c.foto} size={32} />
                      <p className="text-sm font-bold text-violet-950">{c.nome}</p>
                    </div>
                    <span className="text-xs font-extrabold text-violet-600">{formatBRL(mixC)} <span className="text-[10px] font-normal text-slate-400">/mês (Mix)</span></span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Campo label="Crédito Pessoal">
                      <input type="number" min="0" value={m.creditoPessoal} onChange={(e) => atualizarMetaIndividual(c.id, "creditoPessoal", e.target.value)} className={inputClass + " mb-0"} />
                    </Campo>
                    <Campo label="Consignado">
                      <input type="number" min="0" value={m.consignado} onChange={(e) => atualizarMetaIndividual(c.id, "consignado", e.target.value)} className={inputClass + " mb-0"} />
                    </Campo>
                    <Campo label="CLT">
                      <input type="number" min="0" value={m.clt} onChange={(e) => atualizarMetaIndividual(c.id, "clt", e.target.value)} className={inputClass + " mb-0"} />
                    </Campo>
                    <Campo label="Antecipação">
                      <input type="number" min="0" value={m.antecipacao} onChange={(e) => atualizarMetaIndividual(c.id, "antecipacao", e.target.value)} className={inputClass + " mb-0"} />
                    </Campo>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-violet-300 mt-3">As mudanças aqui são salvas automaticamente, sem precisar de botão — já refletem nas outras telas.</p>
        </div>
      )}

      {aba === "consultores" && (
        <div className="rounded-2xl border border-violet-100 bg-white p-4 sm:p-6">
          <h2 className="text-sm font-extrabold text-violet-950 mb-4 flex items-center gap-2"><Users size={16} className="text-violet-600" /> Consultores da Loja</h2>

          <div className="rounded-xl bg-violet-50 border border-violet-100 px-4 py-3 mb-4">
            <div className="flex flex-wrap gap-2 mb-2">
              <input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Nome do novo consultor"
                className="flex-1 min-w-[200px] rounded-lg border border-violet-100 bg-white px-3 py-2 text-xs text-violet-950 outline-none focus:border-violet-400" />
              <button onClick={handleAdicionar} className="flex items-center gap-1.5 rounded-xl bg-violet-600 text-white px-4 py-2 text-xs font-bold hover:bg-violet-700 transition">
                <Plus size={13} /> Adicionar
              </button>
            </div>
            <label className="flex items-center gap-2 text-[11px] text-violet-600 cursor-pointer">
              <input type="checkbox" checked={novoExterno} onChange={(e) => setNovoExterno(e.target.checked)} className="accent-violet-600" />
              Consultor externo (venda repassada — <b>não entra</b> na meta/produção da loja)
            </label>
          </div>

          <div className="space-y-2.5">
            {consultores.map((c) => (
              <div key={c.id} className="rounded-xl border border-violet-100 px-4 py-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <label className="relative cursor-pointer group">
                      <Avatar nome={c.nome} foto={c.foto} size={40} />
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFoto(c.id, e.target.files?.[0])} />
                      <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-violet-600 text-white flex items-center justify-center text-[8px] group-hover:bg-violet-700">
                        <Pencil size={8} />
                      </span>
                    </label>
                    <div>
                      <p className="text-sm font-semibold text-violet-950 flex items-center gap-1.5">
                        {c.nome}
                        {c.externo && <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full">EXTERNO</span>}
                      </p>
                      <p className="text-[10px] text-slate-400">Toque na foto para alterar</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setConsultorExpandido(consultorExpandido === c.id ? null : c.id)} className="text-[11px] font-semibold text-violet-600 hover:underline">
                      Detalhes
                    </button>
                    <button onClick={() => removerConsultor(c.id)} className="w-7 h-7 rounded-lg border border-red-100 flex items-center justify-center text-red-500 hover:bg-red-50 transition">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                {consultorExpandido === c.id && (
                  <div className="mt-3 pt-3 border-t border-violet-50 space-y-3">
                    <label className="flex items-center gap-2 text-[11px] text-violet-600 cursor-pointer">
                      <input type="checkbox" checked={!!c.externo} onChange={(e) => atualizarConsultorCampo(c.id, "externo", e.target.checked)} className="accent-violet-600" />
                      Consultor externo (não entra na meta/produção da loja)
                    </label>
                    <Campo label="PIN de acesso (4 a 6 dígitos)">
                      <div className="flex items-end gap-2">
                        <div className="relative max-w-[140px]">
                          <input type={pinsVisiveis[c.id] ? "text" : "password"} inputMode="numeric" maxLength={6} value={c.pin || ""}
                            onChange={(e) => atualizarConsultorCampo(c.id, "pin", e.target.value.replace(/\D/g, ""))}
                            placeholder="Ex.: 1234" className={inputClass + " mb-0 pr-9"} />
                          <button type="button" onClick={() => setPinsVisiveis((v) => ({ ...v, [c.id]: !v[c.id] }))}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-violet-300 hover:text-violet-600 transition">
                            {pinsVisiveis[c.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                        <button onClick={async () => {
                          setPinSalvo(`${c.id}-salvando`);
                          const r = await atualizarConsultorCampo(c.id, "pin", c.pin || "");
                          setPinSalvo(r?.ok === false ? `${c.id}-erro` : c.id);
                          setTimeout(() => setPinSalvo(null), r?.ok === false ? 6000 : 2500);
                        }} disabled={pinSalvo === `${c.id}-salvando`}
                          className="rounded-xl bg-violet-600 text-white px-3 py-2.5 text-[11px] font-bold hover:bg-violet-700 transition disabled:opacity-60">
                          {pinSalvo === `${c.id}-salvando` ? "Salvando..." : "Salvar PIN"}
                        </button>
                      </div>
                      {pinSalvo === c.id && <p className="text-[10px] text-green-600 font-semibold mt-1.5 flex items-center gap-1"><CheckCircle2 size={11} /> PIN salvo e confirmado no banco!</p>}
                      {pinSalvo === `${c.id}-erro` && <p className="text-[10px] text-red-600 font-semibold mt-1.5 flex items-center gap-1"><AlertTriangle size={11} className="flex-shrink-0" /> Não confirmei o salvamento (conexão instável) — tente de novo.</p>}
                    </Campo>
                    {!c.externo && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {["creditoPessoal", "consignado", "clt", "antecipacao"].map((pid) => (
                          <Campo key={pid} label={{ creditoPessoal: "Créd. Pessoal", consignado: "Consignado", clt: "CLT", antecipacao: "Antecipação" }[pid]}>
                            <input type="number" min="0" value={(metasIndividuais[c.id] || {})[pid] || 0} onChange={(e) => atualizarMetaIndividual(c.id, pid, e.target.value)} className={inputClass + " mb-0"} />
                          </Campo>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {consultores.length === 0 && <p className="text-xs text-slate-400 py-4 text-center">Nenhum consultor cadastrado.</p>}
          </div>
        </div>
      )}

      {aba === "agenda" && (
        <div className="rounded-2xl border border-violet-100 bg-white p-4 sm:p-6">
          <h2 className="text-sm font-extrabold text-violet-950 mb-4 flex items-center gap-2"><Calendar size={16} className="text-violet-600" /> Calendário Comercial</h2>
          <p className="text-[11px] text-slate-400 mb-4">Esse é o mesmo calendário usado na Matinal — alterar aqui atualiza lá também.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
            <Campo label="Dias úteis no mês">
              <input type="number" min={1} value={diasUteisMes} onChange={(e) => salvarConfig(Math.max(1, Number(e.target.value) || 1))} className={inputClass} />
            </Campo>
            <Campo label="Dias úteis já passados">
              <input type="number" min={0} value={diasUteisPassados} onChange={(e) => salvarConfig(undefined, Math.max(0, Number(e.target.value) || 0))} className={inputClass} />
            </Campo>
          </div>
          <div className="rounded-xl bg-violet-50 border border-violet-100 px-4 py-3 mt-4 text-[11px] text-violet-500">
            Feriados e horários de funcionamento ainda não estão disponíveis — posso construir isso na próxima etapa.
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================
// TELA: RELATÓRIOS
// ============================================================
const CORES_PRODUTO = { creditoPessoal: "#6D4FD1", mix: "#8B5CF6", consignado: "#22C55E", clt: "#F5A623", antecipacao: "#EF4444", seguro: "#0EA5E9" };
const NOMES_PRODUTO = { creditoPessoal: "Crédito Pessoal", consignado: "Consignado", clt: "CLT", antecipacao: "Antecipação", seguro: "Seguro" };

function diasEntre(inicioISO, fimISO) {
  const arr = [];
  let d = new Date(inicioISO + "T00:00:00");
  const fim = new Date(fimISO + "T00:00:00");
  while (d <= fim) {
    arr.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return arr;
}
function diasUteisEntre(inicioISO, fimISO) {
  return diasEntre(inicioISO, fimISO).filter((d) => {
    const dow = new Date(d + "T00:00:00").getDay();
    return dow !== 0 && dow !== 6;
  }).length;
}
function formatarDataCurta(d) {
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function TelaRelatorios({ producoes, acionamentos, consultores, metaLojaProdutoTotal, metaSeguroUnid }) {
  const idsExternos = new Set(consultores.filter((c) => c.externo).map((c) => c.id));
  const consultoresLoja = consultores.filter((c) => !c.externo);
  const [periodo, setPeriodo] = useState("mes");
  const [dataInicioCustom, setDataInicioCustom] = useState(todayISO());
  const [dataFimCustom, setDataFimCustom] = useState(todayISO());
  const [filtroConsultor, setFiltroConsultor] = useState("todos");
  const [filtroProduto, setFiltroProduto] = useState("todos");

  const hoje = todayISO();

  const [inicio, fim] = useMemo(() => {
    const d = new Date();
    if (periodo === "hoje") return [hoje, hoje];
    if (periodo === "ontem") {
      const ontem = new Date(d); ontem.setDate(d.getDate() - 1);
      const s = ontem.toISOString().slice(0, 10);
      return [s, s];
    }
    if (periodo === "semana") {
      const seteAtras = new Date(d); seteAtras.setDate(d.getDate() - 6);
      return [seteAtras.toISOString().slice(0, 10), hoje];
    }
    if (periodo === "mes") {
      return [`${mesAtual()}-01`, hoje];
    }
    return [dataInicioCustom, dataFimCustom];
  }, [periodo, dataInicioCustom, dataFimCustom]);

  const diasDoPeriodo = useMemo(() => diasEntre(inicio, fim), [inicio, fim]);
  const diasUteisPeriodo = useMemo(() => Math.max(diasUteisEntre(inicio, fim), 1), [inicio, fim]);

  // período anterior de mesma duração, para comparação
  const [inicioAnterior, fimAnterior] = useMemo(() => {
    const qtdDias = diasDoPeriodo.length;
    const fimAnt = new Date(inicio + "T00:00:00"); fimAnt.setDate(fimAnt.getDate() - 1);
    const inicioAnt = new Date(fimAnt); inicioAnt.setDate(fimAnt.getDate() - (qtdDias - 1));
    return [inicioAnt.toISOString().slice(0, 10), fimAnt.toISOString().slice(0, 10)];
  }, [inicio, diasDoPeriodo.length]);

  function filtrarProducoes(lista, ini, f) {
    return lista.filter((p) => {
      if (p.data < ini || p.data > f) return false;
      if (filtroConsultor !== "todos" && p.consultorId !== filtroConsultor) return false;
      // na visão "Todos os Consultores", externos não entram na produção/meta da loja
      if (filtroConsultor === "todos" && idsExternos.has(p.consultorId)) return false;
      if (filtroProduto !== "todos" && p.produto !== filtroProduto) return false;
      return true;
    });
  }

  const producoesPeriodo = useMemo(() => filtrarProducoes(producoes, inicio, fim), [producoes, inicio, fim, filtroConsultor, filtroProduto]);
  const producoesPeriodoAnterior = useMemo(() => filtrarProducoes(producoes, inicioAnterior, fimAnterior), [producoes, inicioAnterior, fimAnterior, filtroConsultor, filtroProduto]);
  const acionamentosPeriodo = useMemo(() => acionamentos.filter((a) => a.data >= inicio && a.data <= fim && (filtroConsultor === "todos" || a.consultorId === filtroConsultor)), [acionamentos, inicio, fim, filtroConsultor]);

  function totalProduto(lista, produtoId) {
    return lista.filter((p) => p.produto === produtoId).reduce((s, p) => s + (Number(p.valor) || 0), 0);
  }
  function contratosProduto(lista, produtoId) {
    return lista.filter((p) => p.produto === produtoId).length;
  }
  function totalMix(lista) {
    return ["creditoPessoal", "consignado", "clt", "antecipacao"].reduce((s, p) => s + totalProduto(lista, p), 0);
  }

  const produtos = ["creditoPessoal", "consignado", "clt", "antecipacao"];
  const totalGeral = totalMix(producoesPeriodo);
  const totalGeralAnterior = totalMix(producoesPeriodoAnterior);
  const variacaoTotal = totalGeralAnterior > 0 ? Math.round(((totalGeral - totalGeralAnterior) / totalGeralAnterior) * 100) : null;

  function metaDoPeriodo(produtoId) {
    const metaMensal = produtoId === "mix"
      ? produtos.reduce((s, p) => s + metaLojaProdutoTotal(p), 0)
      : metaLojaProdutoTotal(produtoId);
    return (metaMensal / DIAS_UTEIS_MES_PADRAO) * diasUteisPeriodo;
  }
  const metaSeguroPeriodo = ((metaSeguroUnid * consultoresLoja.length) / DIAS_UTEIS_MES_PADRAO) * diasUteisPeriodo;
  const metaAcionamentosPeriodo = META_ACIONAMENTOS_DIA_CONSULTOR * consultoresLoja.length * diasUteisPeriodo;

  const cardsResumo = [
    { id: "total", nome: "Produção Total", valor: totalGeral, meta: metaDoPeriodo("mix"), variacao: variacaoTotal },
    ...produtos.map((pid) => {
      const v = totalProduto(producoesPeriodo, pid);
      const vAnt = totalProduto(producoesPeriodoAnterior, pid);
      const variacao = vAnt > 0 ? Math.round(((v - vAnt) / vAnt) * 100) : null;
      return { id: pid, nome: NOMES_PRODUTO[pid], valor: v, meta: metaDoPeriodo(pid), variacao };
    }),
  ];
  const seguroQtd = contratosProduto(producoesPeriodo, "seguro");
  const seguroQtdAnterior = contratosProduto(producoesPeriodoAnterior, "seguro");
  const variacaoSeguro = seguroQtdAnterior > 0 ? Math.round(((seguroQtd - seguroQtdAnterior) / seguroQtdAnterior) * 100) : null;
  const totalAcionamentos = acionamentosPeriodo.reduce((s, a) => s + a.quantidade, 0);

  // evolução diária
  const evolucao = useMemo(() => {
    let acumMeta = 0, acumReal = 0;
    const metaDiariaLoja = metaDoPeriodo("mix") / diasDoPeriodo.length;
    return diasDoPeriodo.map((d) => {
      const realizadoDia = totalMix(producoesPeriodo.filter((p) => p.data === d));
      acumMeta += metaDiariaLoja;
      acumReal += realizadoDia;
      return { data: formatarDataCurta(d), meta: Math.round(acumMeta), realizado: Math.round(acumReal) };
    });
  }, [producoesPeriodo, diasDoPeriodo]);

  // produção por consultor
  const producaoPorConsultor = useMemo(() => {
    return consultoresLoja.map((c) => ({
      nome: c.nome,
      valor: totalMix(producoesPeriodo.filter((p) => p.consultorId === c.id)),
    })).sort((a, b) => b.valor - a.valor);
  }, [producoesPeriodo, consultoresLoja]);

  // produção por produto (para o gráfico de pizza)
  const producaoPorProdutoPizza = produtos.map((pid) => ({ name: NOMES_PRODUTO[pid], value: totalProduto(producoesPeriodo, pid), cor: CORES_PRODUTO[pid] })).filter((d) => d.value > 0);

  function exportarCSV() {
    const linhas = [["Consultor", ...produtos.map((p) => NOMES_PRODUTO[p]), "Seguro (unid.)", "Total Produção"]];
    consultores.forEach((c) => {
      const lista = producoesPeriodo.filter((p) => p.consultorId === c.id);
      const valores = produtos.map((pid) => totalProduto(lista, pid).toFixed(2));
      linhas.push([c.nome, ...valores, contratosProduto(lista, "seguro"), totalMix(lista).toFixed(2)]);
    });
    const csv = linhas.map((l) => l.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `radar-relatorio-${inicio}-a-${fim}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function compartilhar() {
    const texto = `RADAR — Relatório (${formatarDataCurta(inicio)} a ${formatarDataCurta(fim)})\nProdução total: ${formatBRL(totalGeral)}\nMeta do período: ${formatBRL(metaDoPeriodo("mix"))}`;
    try {
      if (navigator.share) await navigator.share({ text: texto });
      else { await navigator.clipboard.writeText(texto); alert("Resumo copiado para a área de transferência!"); }
    } catch (e) {}
  }

  const dicaPulse = totalGeral === 0
    ? "Nenhuma produção lançada nesse período ainda."
    : `A loja produziu ${formatBRL(totalGeral)} no período (${metaDoPeriodo("mix") > 0 ? Math.round((totalGeral / metaDoPeriodo("mix")) * 100) : 0}% da meta proporcional). ${producaoPorConsultor[0] ? `${producaoPorConsultor[0].nome} lidera com ${formatBRL(producaoPorConsultor[0].valor)}.` : ""}`;

  return (
    <>
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-950 via-violet-900 to-violet-800 px-5 sm:px-7 py-6 text-white">
        <div className="absolute -right-10 -top-10 w-52 h-52 rounded-full bg-orange-500 opacity-20 blur-3xl" />
        <div className="absolute -left-10 -bottom-16 w-52 h-52 rounded-full bg-violet-500 opacity-30 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">RELATÓRIOS</h1>
            <p className="text-sm text-violet-200 mt-1">Análises completas da produção e desempenho da loja e da equipe.</p>
          </div>
          <button onClick={compartilhar} className="flex items-center gap-1.5 rounded-xl bg-orange-500 text-white px-3.5 py-2.5 text-xs font-bold hover:bg-orange-600 transition">
            <Bot size={14} /> Relatório do Pulse
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-violet-600 p-4 flex items-start gap-3 text-white">
        <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0"><Bot size={18} /></div>
        <p className="text-xs sm:text-sm text-violet-50 leading-relaxed">{dicaPulse}</p>
      </div>

      {/* FILTROS */}
      <div className="rounded-2xl border border-violet-100 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {[{ id: "hoje", label: "Hoje" }, { id: "ontem", label: "Ontem" }, { id: "semana", label: "Semana" }, { id: "mes", label: "Mês" }, { id: "personalizado", label: "Personalizado" }].map((p) => (
            <button key={p.id} onClick={() => setPeriodo(p.id)}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${periodo === p.id ? "bg-violet-600 text-white" : "bg-violet-50 text-slate-500 border border-violet-100"}`}>
              {p.label}
            </button>
          ))}
        </div>

        {periodo === "personalizado" && (
          <div className="flex flex-wrap gap-3 mb-3">
            <label className="flex items-center gap-1.5 text-[11px] text-slate-400">De
              <input type="date" value={dataInicioCustom} onChange={(e) => setDataInicioCustom(e.target.value)} className="rounded-lg border border-violet-100 bg-violet-50 px-2 py-1.5 text-xs text-violet-950" />
            </label>
            <label className="flex items-center gap-1.5 text-[11px] text-slate-400">Até
              <input type="date" value={dataFimCustom} onChange={(e) => setDataFimCustom(e.target.value)} className="rounded-lg border border-violet-100 bg-violet-50 px-2 py-1.5 text-xs text-violet-950" />
            </label>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <select value={filtroConsultor} onChange={(e) => setFiltroConsultor(e.target.value)} className="rounded-xl border border-violet-100 bg-violet-50 px-3 py-2 text-xs text-violet-950 outline-none focus:border-violet-400">
            <option value="todos">Todos os Consultores</option>
            {consultores.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <select value={filtroProduto} onChange={(e) => setFiltroProduto(e.target.value)} className="rounded-xl border border-violet-100 bg-violet-50 px-3 py-2 text-xs text-violet-950 outline-none focus:border-violet-400">
            <option value="todos">Todos os Produtos</option>
            {[...produtos, "seguro"].map((pid) => <option key={pid} value={pid}>{NOMES_PRODUTO[pid]}</option>)}
          </select>
          <span className="text-[11px] text-violet-400 flex items-center px-2">
            {formatarDataCurta(inicio)} — {formatarDataCurta(fim)} ({diasDoPeriodo.length} dia{diasDoPeriodo.length > 1 ? "s" : ""})
          </span>
        </div>
      </div>

      {/* CARDS RESUMO */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {cardsResumo.map((c) => {
          const pct = c.meta > 0 ? Math.round((c.valor / c.meta) * 100) : 0;
          return (
            <div key={c.id} className="bg-white rounded-2xl border border-violet-100 p-3.5">
              <p className="text-[9px] font-bold tracking-wide text-slate-400">{c.nome.toUpperCase()}</p>
              <p className="text-base font-extrabold text-violet-950 mt-0.5">{formatBRL(c.valor)}</p>
              <p className="text-[10px] text-violet-300">Meta: {formatBRL(c.meta)}</p>
              <div className="h-1.5 rounded-full bg-violet-100 mt-2 overflow-hidden"><div className="h-full rounded-full bg-violet-600" style={{ width: `${Math.min(pct, 100)}%` }} /></div>
              <p className="flex items-center justify-between text-[10px] mt-1.5">
                <span className="font-bold text-violet-600">{pct}%</span>
                {c.variacao !== null && (
                  <span className={`font-semibold flex items-center gap-0.5 ${c.variacao >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {c.variacao >= 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}{Math.abs(c.variacao)}% vs anterior
                  </span>
                )}
              </p>
            </div>
          );
        })}
        <div className="bg-white rounded-2xl border border-violet-100 p-3.5">
          <p className="text-[9px] font-bold tracking-wide text-slate-400">SEGURO (UNID.)</p>
          <p className="text-base font-extrabold text-violet-950 mt-0.5">{seguroQtd}</p>
          <p className="text-[10px] text-violet-300">Meta: {Math.round(metaSeguroPeriodo)} unid.</p>
          <div className="h-1.5 rounded-full bg-violet-100 mt-2 overflow-hidden"><div className="h-full rounded-full bg-sky-500" style={{ width: `${Math.min(metaSeguroPeriodo > 0 ? (seguroQtd / metaSeguroPeriodo) * 100 : 0, 100)}%` }} /></div>
          {variacaoSeguro !== null && (
            <p className={`text-[10px] font-semibold mt-1.5 flex items-center gap-0.5 ${variacaoSeguro >= 0 ? "text-green-600" : "text-red-500"}`}>
              {variacaoSeguro >= 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}{Math.abs(variacaoSeguro)}% vs anterior
            </p>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-violet-100 p-3.5">
          <p className="text-[9px] font-bold tracking-wide text-slate-400">ACIONAMENTOS</p>
          <p className="text-base font-extrabold text-violet-950 mt-0.5">{totalAcionamentos}</p>
          <p className="text-[10px] text-violet-300">Meta: {metaAcionamentosPeriodo}</p>
          <div className="h-1.5 rounded-full bg-violet-100 mt-2 overflow-hidden"><div className="h-full rounded-full bg-orange-500" style={{ width: `${Math.min(metaAcionamentosPeriodo > 0 ? (totalAcionamentos / metaAcionamentosPeriodo) * 100 : 0, 100)}%` }} /></div>
        </div>
      </div>

      {/* GRÁFICOS */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-violet-100 bg-white p-4 sm:p-5">
          <h3 className="text-sm font-bold text-violet-950 mb-3">Evolução da Produção (R$)</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolucao} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EDE9FE" />
                <XAxis dataKey="data" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(v) => formatBRLCurto(v)} />
                <Tooltip formatter={(v) => formatBRL(v)} />
                <Line type="monotone" dataKey="meta" stroke="#C4B5FD" strokeDasharray="5 5" dot={false} name="Meta acumulada" />
                <Line type="monotone" dataKey="realizado" stroke="#7C3AED" strokeWidth={2.5} dot={{ r: 2 }} name="Realizado" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-violet-100 bg-white p-4 sm:p-5">
          <h3 className="text-sm font-bold text-violet-950 mb-3">Produção por Produto</h3>
          {producaoPorProdutoPizza.length === 0 ? (
            <p className="text-xs text-slate-400 py-16 text-center">Sem dados no período.</p>
          ) : (
            <div className="h-56 flex items-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={producaoPorProdutoPizza} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {producaoPorProdutoPizza.map((d, i) => <Cell key={i} fill={d.cor} />)}
                  </Pie>
                  <Tooltip formatter={(v) => formatBRL(v)} />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-violet-100 bg-white p-4 sm:p-5">
          <h3 className="text-sm font-bold text-violet-950 mb-3">Produção por Consultor (R$)</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={producaoPorConsultor} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EDE9FE" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(v) => formatBRLCurto(v)} />
                <YAxis type="category" dataKey="nome" tick={{ fontSize: 11, fill: "#2A1B54" }} axisLine={false} tickLine={false} width={70} />
                <Tooltip formatter={(v) => formatBRL(v)} />
                <Bar dataKey="valor" fill="#6D4FD1" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <RankingPanel ranking={producaoPorConsultor.map((c, i) => ({ id: i, nome: c.nome, total: c.valor, pct: totalGeral > 0 ? Math.round((c.valor / (totalGeral || 1)) * 100) : 0 }))} />
      </div>

      {/* DETALHAMENTO */}
      <div className="rounded-2xl border border-violet-100 bg-white p-4 sm:p-6">
        <h3 className="text-sm font-extrabold text-violet-950 mb-4">Detalhamento da Produção</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[720px]">
            <thead>
              <tr className="text-left text-[10px] font-bold tracking-wide text-slate-400 border-b border-violet-100">
                <th className="py-2 pr-3">Consultor</th>
                {produtos.map((pid) => <th key={pid} className="py-2 pr-3 text-right">{NOMES_PRODUTO[pid]}</th>)}
                <th className="py-2 pr-3 text-right">Seguro (unid.)</th>
                <th className="py-2 pl-3 text-right">Total Produção</th>
              </tr>
            </thead>
            <tbody>
              {consultores.map((c) => {
                const lista = producoesPeriodo.filter((p) => p.consultorId === c.id);
                const total = totalMix(lista);
                return (
                  <tr key={c.id} className="border-t border-violet-50">
                    <td className="py-2.5 pr-3 font-semibold text-violet-950 whitespace-nowrap flex items-center gap-2"><Avatar nome={c.nome} foto={c.foto} size={22} />{c.nome}</td>
                    {produtos.map((pid) => <td key={pid} className="py-2.5 pr-3 text-right text-slate-600">{formatBRL(totalProduto(lista, pid))}</td>)}
                    <td className="py-2.5 pr-3 text-right text-slate-600">{contratosProduto(lista, "seguro")}</td>
                    <td className="py-2.5 pl-3 text-right font-bold text-violet-600">{formatBRL(total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={exportarCSV} className="flex items-center gap-1.5 rounded-xl bg-white border border-violet-100 px-4 py-2.5 text-xs font-bold text-violet-600 hover:border-violet-400 transition">
          <FileSpreadsheet size={14} /> Exportar Excel (CSV)
        </button>
        <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded-xl bg-white border border-violet-100 px-4 py-2.5 text-xs font-bold text-violet-600 hover:border-violet-400 transition">
          <Printer size={14} /> Imprimir
        </button>
        <button onClick={compartilhar} className="flex items-center gap-1.5 rounded-xl bg-white border border-violet-100 px-4 py-2.5 text-xs font-bold text-violet-600 hover:border-violet-400 transition">
          <Share2 size={14} /> Compartilhar
        </button>
      </div>
    </>
  );
}

// ============================================================
// TELA: BACKUP
// ============================================================
function TelaBackup({ producoes, acionamentos, oportunidadesManuais, salvarProducoes, salvarAcionamentos, salvarOportunidades }) {
  const [textoImportar, setTextoImportar] = useState("");
  const [mensagem, setMensagem] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const [backupSeguranca, setBackupSeguranca] = useState(null);
  const [carregandoBackup, setCarregandoBackup] = useState(false);

  async function buscarBackupSeguranca() {
    setCarregandoBackup(true);
    setMensagem(null);
    try {
      const r = await window.storage.get(STORAGE_KEY + ":backup_anterior", false);
      const lista = r ? JSON.parse(r.value) : [];
      setBackupSeguranca(lista);
    } catch (e) {
      setBackupSeguranca([]);
      setMensagem({ tipo: "erro", texto: "Ainda não existe um backup automático salvo (só passa a existir a partir do primeiro salvamento depois dessa atualização)." });
    }
    setCarregandoBackup(false);
  }

  async function restaurarBackupSeguranca() {
    if (!backupSeguranca) return;
    await salvarProducoes(backupSeguranca);
    setMensagem({ tipo: "sucesso", texto: `Restaurado! ${backupSeguranca.length} produções recuperadas do backup automático.` });
    setBackupSeguranca(null);
  }

  const dadosAtuais = { producoes, acionamentos, oportunidadesManuais, exportadoEm: new Date().toISOString() };
  const jsonExport = JSON.stringify(dadosAtuais, null, 2);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(jsonExport);
      setCopiado(true);
      try { window.localStorage.setItem("radar:ultimoBackupManual", new Date().toISOString()); } catch (e) {}
      setTimeout(() => setCopiado(false), 2500);
    } catch (e) {
      setMensagem({ tipo: "erro", texto: "Não consegui copiar automaticamente. Selecione o texto manualmente." });
    }
  }

  async function restaurar() {
    setMensagem(null);
    let dados;
    try {
      dados = JSON.parse(textoImportar);
    } catch (e) {
      return setMensagem({ tipo: "erro", texto: "Esse texto não é um backup válido (JSON inválido)." });
    }
    if (!dados.producoes && !dados.acionamentos && !dados.oportunidadesManuais) {
      return setMensagem({ tipo: "erro", texto: "Esse texto não parece um backup do RADAR." });
    }
    await salvarProducoes(Array.isArray(dados.producoes) ? dados.producoes : []);
    await salvarAcionamentos(Array.isArray(dados.acionamentos) ? dados.acionamentos : []);
    await salvarOportunidades(Array.isArray(dados.oportunidadesManuais) ? dados.oportunidadesManuais : []);
    setMensagem({ tipo: "sucesso", texto: "Dados restaurados! Todas as telas já estão atualizadas." });
    setTextoImportar("");
  }

  return (
    <>
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-950 via-violet-900 to-violet-800 px-5 sm:px-7 py-6 text-white">
        <div className="absolute -right-10 -top-10 w-52 h-52 rounded-full bg-orange-500 opacity-20 blur-3xl" />
        <div className="absolute -left-10 -bottom-16 w-52 h-52 rounded-full bg-violet-500 opacity-30 blur-3xl" />
        <div className="relative">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2"><Shield size={26} /> BACKUP</h1>
          <p className="text-sm text-violet-200 mt-1">Guarde uma cópia dos seus dados de teste enquanto o salvamento automático está instável.</p>
        </div>
      </div>

      <div className="rounded-2xl bg-amber-50 border border-amber-100 px-4 py-3 text-xs text-amber-700 flex items-start gap-2">
        <AlertCircle size={14} className="shrink-0 mt-0.5" />
        O salvamento automático (nuvem) está instável no momento. Use esta tela pra copiar seus dados antes de fechar, e colar de volta quando reabrir o sistema.
      </div>

      <div className="rounded-2xl border border-violet-100 bg-white p-4 sm:p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-extrabold text-violet-950 flex items-center gap-2"><Shield size={16} className="text-green-600" /> Backup automático de segurança</h2>
          <button onClick={buscarBackupSeguranca} disabled={carregandoBackup} className="flex items-center gap-1.5 rounded-xl bg-green-600 text-white px-3.5 py-2 text-xs font-bold hover:bg-green-700 transition disabled:opacity-50">
            <RefreshCw size={13} /> {carregandoBackup ? "Buscando..." : "Ver última cópia salva"}
          </button>
        </div>
        <p className="text-[11px] text-slate-400 mb-3">
          A cada vez que uma produção é salva, o sistema guarda uma cópia da versão anterior automaticamente — sem você precisar fazer nada. Use aqui se precisar recuperar depois de algum problema.
        </p>
        {backupSeguranca !== null && (
          <div className="rounded-xl bg-violet-50 border border-violet-100 px-3 py-3 space-y-2">
            <p className="text-xs font-bold text-violet-950">{backupSeguranca.length} produções encontradas nesse backup.</p>
            {backupSeguranca.length > 0 && (
              <button onClick={restaurarBackupSeguranca} className="flex items-center gap-1.5 rounded-xl bg-violet-600 text-white px-3.5 py-2 text-xs font-bold hover:bg-violet-700 transition">
                <Upload size={13} /> Restaurar essa versão agora
              </button>
            )}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-violet-100 bg-white p-4 sm:p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-extrabold text-violet-950 flex items-center gap-2"><Download size={16} className="text-violet-600" /> Exportar dados atuais</h2>
          <button onClick={copiar} className="flex items-center gap-1.5 rounded-xl bg-violet-600 text-white px-3.5 py-2 text-xs font-bold hover:bg-violet-700 transition">
            <Copy size={13} /> {copiado ? "Copiado!" : "Copiar tudo"}
          </button>
        </div>
        <p className="text-[11px] text-slate-400 mb-3">
          {producoes.length} produções · {acionamentos.length} acionamentos · {oportunidadesManuais.length} oportunidades manuais
        </p>
        <textarea readOnly value={jsonExport} rows={8}
          className="w-full rounded-xl border border-violet-100 bg-violet-50 px-3 py-2.5 text-[11px] font-mono text-violet-950 outline-none resize-none" />
        <p className="text-[11px] text-violet-300 mt-2">Cole esse texto num bloco de notas ou WhatsApp pra você mesma, como cópia de segurança.</p>
      </div>

      <div className="rounded-2xl border border-violet-100 bg-white p-4 sm:p-6">
        <h2 className="text-sm font-extrabold text-violet-950 flex items-center gap-2 mb-3"><Upload size={16} className="text-violet-600" /> Restaurar dados</h2>
        {mensagem && (
          <div className={`mb-3 text-xs font-medium rounded-lg px-3 py-2 ${mensagem.tipo === "sucesso" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{mensagem.texto}</div>
        )}
        <textarea value={textoImportar} onChange={(e) => setTextoImportar(e.target.value)} rows={8}
          placeholder="Cole aqui o backup que você copiou anteriormente..."
          className="w-full rounded-xl border border-violet-100 bg-violet-50 px-3 py-2.5 text-[11px] font-mono text-violet-950 outline-none resize-none mb-3" />
        <button onClick={restaurar} disabled={!textoImportar.trim()} className="rounded-xl bg-violet-600 text-white px-4 py-2 text-xs font-bold hover:bg-violet-700 disabled:opacity-40 transition">
          Restaurar dados
        </button>
        <p className="text-[11px] text-red-400 mt-2">Atenção: isso substitui os dados que estão na tela agora pelos do texto colado.</p>
      </div>
    </>
  );
}

// ============================================================
// TELA: RADAR COMERCIAL
// ============================================================
const OPORTUNIDADE_VAZIA = { cliente: "", cpf: "", telefone: "", produto: "creditoPessoal", consultorId: "", liberaEm: "", oferta: "sim" };

function diasAte(dataISO) {
  if (!dataISO) return null;
  const hoje = new Date(todayISO() + "T00:00:00");
  const alvo = new Date(dataISO + "T00:00:00");
  return Math.round((alvo - hoje) / 86400000);
}
function formatarDataBR(d) {
  return d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "–";
}
function prioridadePorDias(dias) {
  if (dias === null) return { label: "Baixa", cor: "#94A3B8" };
  if (dias <= 7) return { label: "Alta", cor: "#EF4444" };
  if (dias <= 15) return { label: "Média", cor: "#F5A623" };
  return { label: "Baixa", cor: "#94A3B8" };
}

function TelaRadarComercial({ producoes, oportunidadesManuais, salvarOportunidades, consultores, consultorFixoId }) {
  const [filtroConsultor, setFiltroConsultor] = useState("todos");
  const [filtroPrioridade, setFiltroPrioridade] = useState("todas");
  const [filtroRapido, setFiltroRapido] = useState(null); // 'oferta' | 'proximos15' | null
  const [busca, setBusca] = useState("");
  const [mostrarForm, setMostrarForm] = useState(false);
  const [novoCliente, setNovoCliente] = useState(() => consultorFixoId ? { ...OPORTUNIDADE_VAZIA, consultorId: consultorFixoId } : OPORTUNIDADE_VAZIA);
  const [mensagem, setMensagem] = useState(null);

  // Oportunidades derivadas de Crédito Pessoal com data de próximo refin preenchida
  const oportunidadesDaProducao = useMemo(() => {
    return producoes
      .filter((p) => p.produto === "creditoPessoal" && p.proximoRefin)
      .map((p) => ({
        id: `prod-${p.id}`,
        origem: "producao",
        cliente: p.cliente, cpf: p.cpf, telefone: p.telefone, adesao: p.adesao,
        produtoLabel: `Crédito Pessoal ${p.tipoCredito ? `(${p.tipoCredito})` : ""}`.trim(),
        valorPotencial: Number(p.valor) || 0,
        liberaEm: p.proximoRefin,
        ofertaManual: p.possuiOferta === "sim",
        consultorId: p.consultorId,
      }));
  }, [producoes]);

  const oportunidadesManuaisFormatadas = oportunidadesManuais.map((o) => ({
    ...o, origem: "manual", produtoLabel: nomeProdutoOportunidade(o.produto), valorPotencial: 0,
    liberaEm: o.liberaEm || null, ofertaManual: o.oferta === "sim",
  }));

  // Oferta conta como disponível se foi marcada manualmente OU se a data de liberação já chegou
  const todasOportunidadesBase = [...oportunidadesDaProducao, ...oportunidadesManuaisFormatadas].map((o) => {
    const dias = diasAte(o.liberaEm);
    const dataChegou = dias !== null && dias <= 0;
    return { ...o, oferta: o.ofertaManual || dataChegou, ofertaPorData: dataChegou && !o.ofertaManual };
  });

  // se o acesso é de um consultor, ele só enxerga os próprios clientes
  const todasOportunidades = consultorFixoId ? todasOportunidadesBase.filter((o) => o.consultorId === consultorFixoId) : todasOportunidadesBase;

  const oportunidadesFiltradas = todasOportunidades.filter((o) => {
    if (!consultorFixoId && filtroConsultor !== "todos" && o.consultorId !== filtroConsultor) return false;
    const dias = diasAte(o.liberaEm);
    const prio = prioridadePorDias(dias);
    if (filtroPrioridade !== "todas" && prio.label !== filtroPrioridade) return false;
    if (filtroRapido === "oferta" && !o.oferta) return false;
    if (filtroRapido === "proximos15" && !(dias !== null && dias >= 0 && dias <= 15)) return false;
    if (filtroRapido === "prioridadeAlta" && !(dias !== null && dias <= 7)) return false;
    if (busca.trim()) {
      const q = busca.toLowerCase();
      if (!o.cliente?.toLowerCase().includes(q) && !o.cpf?.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => (diasAte(a.liberaEm) ?? 999) - (diasAte(b.liberaEm) ?? 999));

  const comOferta = todasOportunidades.filter((o) => o.oferta).length;
  const liberamEm15 = todasOportunidades.filter((o) => { const d = diasAte(o.liberaEm); return d !== null && d >= 0 && d <= 15; }).length;
  const valorPotencialTotal = todasOportunidades.reduce((acc, o) => acc + (o.valorPotencial || 0), 0);
  const prioridadeAltaTotal = todasOportunidades.filter((o) => { const d = diasAte(o.liberaEm); return d !== null && d <= 7; }).length;
  const proximaLiberacao = [...todasOportunidades].filter(o => o.liberaEm).sort((a, b) => diasAte(a.liberaEm) - diasAte(b.liberaEm))[0];

  async function adicionarClienteManual() {
    if (!novoCliente.cliente.trim()) return setMensagem({ tipo: "erro", texto: "Informe o nome do cliente." });
    if (!novoCliente.consultorId) return setMensagem({ tipo: "erro", texto: "Selecione o consultor." });
    const registro = { id: `manual-${Date.now()}`, ...novoCliente };
    const novaLista = [...oportunidadesManuais, registro];
    const r = await salvarOportunidades(novaLista);
    setMensagem(r.ok ? { tipo: "sucesso", texto: "Cliente adicionado!" } : { tipo: "erro", texto: `Salvo nesta sessão (${r.erro}).` });
    setNovoCliente(consultorFixoId ? { ...OPORTUNIDADE_VAZIA, consultorId: consultorFixoId } : OPORTUNIDADE_VAZIA);
    setMostrarForm(false);
    setTimeout(() => setMensagem(null), 5000);
  }

  async function removerManual(id) {
    const novaLista = oportunidadesManuais.filter((o) => o.id !== id);
    await salvarOportunidades(novaLista);
  }

  const nomeConsultor = (id) => consultores.find((c) => c.id === id)?.nome || "—";
  function whatsappLink(telefone) {
    const numeros = (telefone || "").replace(/\D/g, "");
    return `https://wa.me/55${numeros}`;
  }

  return (
    <>
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-950 via-violet-900 to-violet-800 px-5 sm:px-7 py-6 text-white">
        <div className="absolute -right-10 -top-10 w-52 h-52 rounded-full bg-orange-500 opacity-20 blur-3xl" />
        <div className="absolute -left-10 -bottom-16 w-52 h-52 rounded-full bg-violet-500 opacity-30 blur-3xl" />
        <div className="relative">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">RADAR COMERCIAL</h1>
          <p className="text-sm text-violet-200 mt-1">Sua carteira de clientes, com ofertas e oportunidades de recompra em destaque.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button onClick={() => setFiltroRapido(null)} className="text-left">
          <Kpi icon={<Users size={16} />} label="CLIENTES CARTEIRA" value={`${todasOportunidades.length}`} sub="Toque para ver todas" ativo={filtroRapido === null} />
        </button>
        <button onClick={() => setFiltroRapido(filtroRapido === "oferta" ? null : "oferta")} className="text-left">
          <Kpi icon={<CheckCircle2 size={16} />} label="COM OFERTA" value={`${comOferta}`} sub="Toque para filtrar" accent="orange" ativo={filtroRapido === "oferta"} />
        </button>
        <button onClick={() => setFiltroRapido(filtroRapido === "proximos15" ? null : "proximos15")} className="text-left">
          <Kpi icon={<Clock size={16} />} label="CLIENTES: REFIN EM 15 DIAS" value={`${liberamEm15}`} sub="Toque para ver esses clientes" ativo={filtroRapido === "proximos15"} />
        </button>
        <button onClick={() => setFiltroRapido(filtroRapido === "prioridadeAlta" ? null : "prioridadeAlta")} className="text-left">
          <Kpi icon={<AlertTriangle size={16} />} label="PRIORIDADE ALTA" value={`${prioridadeAltaTotal}`} sub="Toque para ver esses clientes" accent="orange" ativo={filtroRapido === "prioridadeAlta"} />
        </button>
      </div>

      {filtroRapido && (
        <div className="flex items-center gap-2 -mt-3">
          <span className="text-[11px] text-violet-500">
            Filtrando por: <b>{filtroRapido === "oferta" ? "Com oferta disponível" : filtroRapido === "prioridadeAlta" ? "Prioridade alta (refin em até 7 dias)" : "Liberam em até 15 dias"}</b>
          </span>
          <button onClick={() => setFiltroRapido(null)} className="text-[11px] text-violet-600 font-semibold flex items-center gap-1 hover:underline">
            <X size={12} /> Limpar
          </button>
        </div>
      )}

      {proximaLiberacao && (
        <div className="rounded-2xl bg-violet-600 p-4 flex items-start gap-3 text-white">
          <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0"><Bot size={18} /></div>
          <p className="text-xs sm:text-sm text-violet-50 leading-relaxed">
            <b>Dica do Pulse:</b> o cliente <b>{proximaLiberacao.cliente}</b> {proximaLiberacao.cpf ? <>(CPF {proximaLiberacao.cpf}) </> : null}
            está próximo de liberar um refinanciamento, em {formatarDataBR(proximaLiberacao.liberaEm)}. Que tal falar com ele(a) hoje?
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-violet-100 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {!consultorFixoId && (
            <select value={filtroConsultor} onChange={(e) => setFiltroConsultor(e.target.value)} className="rounded-xl border border-violet-100 bg-violet-50 px-3 py-2 text-xs text-violet-950 outline-none focus:border-violet-400">
              <option value="todos">Todos os Consultores</option>
              {consultores.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          )}
          <select value={filtroPrioridade} onChange={(e) => setFiltroPrioridade(e.target.value)} className="rounded-xl border border-violet-100 bg-violet-50 px-3 py-2 text-xs text-violet-950 outline-none focus:border-violet-400">
            <option value="todas">Prioridade: Todas</option>
            <option value="Alta">Alta</option>
            <option value="Média">Média</option>
            <option value="Baixa">Baixa</option>
          </select>
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-violet-300" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, CPF ou adesão..." className="w-full rounded-xl border border-violet-100 bg-violet-50 pl-9 pr-3 py-2 text-xs text-violet-950 outline-none focus:border-violet-400" />
          </div>
          <button onClick={() => setMostrarForm(!mostrarForm)} className="flex items-center gap-1.5 rounded-xl bg-violet-600 text-white px-3.5 py-2 text-xs font-bold hover:bg-violet-700 transition ml-auto">
            <Plus size={13} /> Adicionar Cliente (Manual)
          </button>
        </div>

        <div className="rounded-xl bg-violet-50 border border-violet-100 px-3.5 py-2.5 text-[11px] text-violet-500 mb-4 flex items-center gap-2">
          <AlertCircle size={13} className="shrink-0" />
          Clientes com "Data do Próximo Refinanciamento" entram aqui automaticamente ao lançar Crédito Pessoal na Central de Produção.
        </div>

        {mostrarForm && (
          <div className="rounded-xl bg-violet-50 border border-violet-100 p-4 mb-4">
            {mensagem && (
              <div className={`mb-3 text-xs font-medium rounded-lg px-3 py-2 ${mensagem.tipo === "sucesso" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{mensagem.texto}</div>
            )}
            <div className={`grid grid-cols-1 sm:grid-cols-2 ${consultorFixoId ? "lg:grid-cols-5" : "lg:grid-cols-6"} gap-3`}>
              <input value={novoCliente.cliente} onChange={(e) => setNovoCliente({ ...novoCliente, cliente: e.target.value })} placeholder="Nome do Cliente *" className={inputClass + " mb-0"} />
              <input value={novoCliente.cpf} onChange={(e) => setNovoCliente({ ...novoCliente, cpf: formatCPF(e.target.value) })} placeholder="CPF" className={inputClass + " mb-0"} />
              <input value={novoCliente.telefone} onChange={(e) => setNovoCliente({ ...novoCliente, telefone: formatTelefone(e.target.value) })} placeholder="Telefone" className={inputClass + " mb-0"} />
              <select value={novoCliente.produto} onChange={(e) => setNovoCliente({ ...novoCliente, produto: e.target.value })} className={inputClass + " mb-0"}>
                {PRODUTOS_LANCAMENTO.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
              {!consultorFixoId && (
                <select value={novoCliente.consultorId} onChange={(e) => setNovoCliente({ ...novoCliente, consultorId: e.target.value })} className={inputClass + " mb-0"}>
                  <option value="">Consultor *</option>
                  {consultores.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              )}
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Data de liberação do refin</label>
                <input type="date" value={novoCliente.liberaEm} onChange={(e) => setNovoCliente({ ...novoCliente, liberaEm: e.target.value })} className={inputClass + " mb-0"} />
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-[10px] text-slate-400 mb-1.5">Já possui oferta disponível?</label>
              <div className="flex gap-4">
                {["sim", "nao"].map((v) => (
                  <label key={v} className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                    <input type="radio" name="ofertaManual" checked={novoCliente.oferta === v} onChange={() => setNovoCliente({ ...novoCliente, oferta: v })} className="accent-violet-600" />
                    {v === "sim" ? "Sim" : "Não"}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <button onClick={adicionarClienteManual} className="rounded-xl bg-violet-600 text-white px-4 py-2 text-xs font-bold hover:bg-violet-700 transition">Adicionar Cliente</button>
              <button onClick={() => setMostrarForm(false)} className="rounded-xl border border-violet-200 px-4 py-2 text-xs font-semibold text-slate-500">Cancelar</button>
            </div>
          </div>
        )}

        {oportunidadesFiltradas.length === 0 ? (
          <p className="text-xs text-slate-400 py-8 text-center">Nenhum cliente encontrado com esses filtros.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[820px]">
              <thead>
                <tr className="text-left text-[10px] font-bold tracking-wide text-slate-400 border-b border-violet-100">
                  <th className="py-2 pr-3">Cliente</th><th className="py-2 pr-3">CPF</th><th className="py-2 pr-3">Produto</th>
                  <th className="py-2 pr-3">Valor do Contrato</th><th className="py-2 pr-3">Refin previsto para</th><th className="py-2 pr-3">Oferta</th>
                  <th className="py-2 pr-3">Prioridade</th><th className="py-2 pr-3">Consultor</th><th className="py-2 pl-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {oportunidadesFiltradas.map((o) => {
                  const dias = diasAte(o.liberaEm);
                  const prio = prioridadePorDias(dias);
                  return (
                    <tr key={o.id} className="border-b border-violet-50">
                      <td className="py-2.5 pr-3 font-semibold text-violet-950 whitespace-nowrap">{o.cliente}</td>
                      <td className="py-2.5 pr-3 text-slate-500 whitespace-nowrap">{o.cpf || "–"}</td>
                      <td className="py-2.5 pr-3 text-violet-950 whitespace-nowrap">{o.produtoLabel}</td>
                      <td className="py-2.5 pr-3 font-bold text-violet-600 whitespace-nowrap">{o.valorPotencial > 0 ? formatBRL(o.valorPotencial) : "–"}</td>
                      <td className="py-2.5 pr-3 whitespace-nowrap">
                        {o.liberaEm ? <span className={dias <= 7 ? "text-red-500 font-semibold" : "text-slate-600"}>{dias === 0 ? "Hoje" : dias === 1 ? "Amanhã" : dias > 0 ? `${dias} dias` : formatarDataBR(o.liberaEm)}</span> : "–"}
                      </td>
                      <td className="py-2.5 pr-3">
                        {o.oferta ? (
                          <span className="text-green-600 font-semibold flex items-center gap-1">
                            Sim {o.ofertaPorData && <span className="text-[9px] text-violet-400 font-normal">(por data)</span>}
                          </span>
                        ) : <span className="text-slate-400">Não</span>}
                      </td>
                      <td className="py-2.5 pr-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: prio.cor + "20", color: prio.cor }}>{prio.label}</span></td>
                      <td className="py-2.5 pr-3 text-slate-600 whitespace-nowrap">{nomeConsultor(o.consultorId)}</td>
                      <td className="py-2.5 pl-3">
                        <div className="flex justify-end gap-1.5">
                          {o.telefone && (
                            <>
                              <a href={`tel:${o.telefone}`} className="w-7 h-7 rounded-lg border border-violet-100 flex items-center justify-center text-violet-600 hover:bg-violet-50 transition"><Phone size={12} /></a>
                              <a href={whatsappLink(o.telefone)} target="_blank" rel="noopener noreferrer" className="w-7 h-7 rounded-lg border border-green-100 flex items-center justify-center text-green-600 hover:bg-green-50 transition"><MessageCircle size={12} /></a>
                            </>
                          )}
                          {o.origem === "manual" && (
                            <button onClick={() => removerManual(o.id)} className="w-7 h-7 rounded-lg border border-red-100 flex items-center justify-center text-red-500 hover:bg-red-50 transition"><Trash2 size={12} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
function nomeProdutoOportunidade(id) {
  return PRODUTOS_LANCAMENTO.find((p) => p.id === id)?.nome || id;
}

// ============================================================
// COMPONENTES REUTILIZÁVEIS
// ============================================================
function Kpi({ icon, label, value, sub, accent = "purple", ativo }) {
  return (
    <div className={`bg-white rounded-2xl border p-3.5 transition ${ativo ? "border-violet-500 ring-2 ring-violet-200" : "border-violet-100"}`}>
      <div className={`flex items-center gap-1.5 mb-2 ${accent === "orange" ? "text-orange-500" : "text-violet-600"}`}>{icon}</div>
      <p className="text-[9px] font-bold tracking-wide text-slate-400">{label}</p>
      <p className="text-base sm:text-lg font-extrabold text-violet-950 leading-tight mt-0.5 truncate">{value}</p>
      <p className="text-[10px] text-violet-300 mt-0.5">{sub}</p>
    </div>
  );
}
function AlertaItem({ color, children }) {
  return <div className="flex items-start gap-2.5 text-xs text-slate-600"><AlertTriangle size={14} className="mt-0.5 shrink-0" style={{ color }} /><p className="leading-relaxed">{children}</p></div>;
}
function Destaque({ icon, label, valor, sub }) {
  return (
    <div className="rounded-xl bg-violet-50 p-3">
      <div className="w-8 h-8 mx-auto rounded-full bg-white flex items-center justify-center text-orange-500 mb-1.5 shadow-sm">{icon}</div>
      <p className="text-[9px] font-bold text-slate-400 tracking-wide">{label}</p>
      <p className="text-xs font-extrabold text-violet-950 mt-0.5 truncate">{valor}</p>
      <p className="text-[10px] text-violet-400">{sub}</p>
    </div>
  );
}
function RankingPanel({ ranking }) {
  const max = Math.max(...ranking.map((r) => r.total), 1);
  return (
    <div className="rounded-2xl border border-violet-100 bg-white p-5">
      <div className="flex items-center gap-2 mb-4"><Trophy size={18} className="text-orange-500" /><h3 className="font-extrabold text-violet-950 text-sm">Ranking de Produção (Mix)</h3></div>
      <div className="space-y-2.5">
        {ranking.map((r, i) => {
          const medalha = MEDALHAS[i];
          const largura = Math.max((r.total / max) * 100, 3);
          return (
            <div key={r.id} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center font-extrabold text-xs shrink-0" style={{ background: medalha ? medalha : "#EEE9FB", color: medalha ? "#3A2C63" : "#8577A8" }}>{medalha ? <Medal size={15} /> : `${i + 1}º`}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-xs mb-1"><span className="font-semibold text-violet-950 truncate">{r.nome}</span><span className="font-bold text-violet-600 shrink-0 ml-2">{formatBRL(r.total)} · {r.pct}%</span></div>
                <div className="h-2 rounded-full bg-violet-100 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-violet-600 to-orange-500" style={{ width: `${largura}%` }} /></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
function RitmoGauge({ pct }) {
  const clamped = Math.min(Math.max(pct, 0), 100);
  const r = 32, c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;
  return (
    <svg width="88" height="88" viewBox="0 0 88 88" className="shrink-0">
      <circle cx="44" cy="44" r={r} fill="none" stroke="#F1EEFC" strokeWidth="9" />
      <circle cx="44" cy="44" r={r} fill="none" stroke="#6D4FD1" strokeWidth="9" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} transform="rotate(-90 44 44)" />
      <text x="44" y="49" textAnchor="middle" fontSize="17" fontWeight="800" fill="#2A1B54">{clamped}%</text>
    </svg>
  );
}
function Gauge({ pct }) {
  const clamped = Math.min(Math.max(pct, 0), 120);
  const angle = (clamped / 120) * 180;
  const rad = ((180 - angle) * Math.PI) / 180;
  const cx = 90, cy = 90, r = 70;
  const needleX = cx + r * 0.85 * Math.cos(rad);
  const needleY = cy - r * 0.85 * Math.sin(rad);
  return (
    <svg width="180" height="105" viewBox="0 0 180 105">
      <path d="M 20 90 A 70 70 0 0 1 60 27" fill="none" stroke="#EF4444" strokeWidth="14" strokeLinecap="round" />
      <path d="M 60 27 A 70 70 0 0 1 120 27" fill="none" stroke="#F5A623" strokeWidth="14" />
      <path d="M 120 27 A 70 70 0 0 1 160 90" fill="none" stroke="#22C55E" strokeWidth="14" strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={needleX} y2={needleY} stroke="#2A1B54" strokeWidth="3" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="6" fill="#2A1B54" />
    </svg>
  );
}
function MiniGauge({ pct, color = "#7C3AED" }) {
  const clamped = Math.min(Math.max(pct, 0), 100);
  const r = 20, c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;
  return (
    <svg width="56" height="56" viewBox="0 0 56 56">
      <circle cx="28" cy="28" r={r} fill="none" stroke="#F1EEFC" strokeWidth="6" />
      <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} transform="rotate(-90 28 28)" />
      <text x="28" y="32" textAnchor="middle" fontSize="11" fontWeight="800" fill="#2A1B54">{clamped}%</text>
    </svg>
  );
}
function FiltroChip({ label, active, onClick }) {
  return <button onClick={onClick} className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition ${active ? "bg-violet-600 text-white border-violet-600" : "bg-white text-slate-500 border-violet-100 hover:border-violet-300"}`}>{label}</button>;
}
function ElegibilidadePanel({ contratosMesConsultorProduto, consultores, superContasUnicasMesConsultor }) {
  return (
    <div className="rounded-2xl border border-violet-100 bg-white p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-1"><ClipboardList size={17} className="text-violet-600" /><h3 className="font-bold text-violet-950 text-sm">Elegibilidade ao Comissionamento</h3></div>
      <p className="text-[11px] text-violet-300 mb-4">Contagem por número de contratos no mês — não considera o valor em R$. SuperConta conta por CPF único (cliente repetido não conta 2x).</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[620px]">
          <thead><tr className="text-left text-[10px] font-bold tracking-wide text-slate-400"><th className="py-2 pr-3">CONSULTORA</th><th className="py-2 px-3 text-center">SUPERCONTA (meta {ELEGIBILIDADE.superConta})</th><th className="py-2 px-3 text-center">SEGURO (meta {ELEGIBILIDADE.seguro})</th><th className="py-2 px-3 text-center">CONSIGNADO (meta {ELEGIBILIDADE.consignado})</th><th className="py-2 px-3 text-center">CLT (meta {ELEGIBILIDADE.clt})</th><th className="py-2 pl-3 text-center">SITUAÇÃO</th></tr></thead>
          <tbody>
            {consultores.map((c) => {
              const superConta = superContasUnicasMesConsultor(c.id);
              const seguro = contratosMesConsultorProduto(c.id, "seguro");
              const consignado = contratosMesConsultorProduto(c.id, "consignado");
              const clt = contratosMesConsultorProduto(c.id, "clt");
              const elegivel = superConta >= ELEGIBILIDADE.superConta && seguro >= ELEGIBILIDADE.seguro && consignado >= ELEGIBILIDADE.consignado && clt >= ELEGIBILIDADE.clt;
              return (
                <tr key={c.id} className="border-t border-violet-50">
                  <td className="py-2.5 pr-3 font-medium text-violet-950">{c.nome}</td>
                  <td className="py-2.5 px-3 text-center"><ContagemBadge atual={superConta} meta={ELEGIBILIDADE.superConta} /></td>
                  <td className="py-2.5 px-3 text-center"><ContagemBadge atual={seguro} meta={ELEGIBILIDADE.seguro} /></td>
                  <td className="py-2.5 px-3 text-center"><ContagemBadge atual={consignado} meta={ELEGIBILIDADE.consignado} /></td>
                  <td className="py-2.5 px-3 text-center"><ContagemBadge atual={clt} meta={ELEGIBILIDADE.clt} /></td>
                  <td className="py-2.5 pl-3 text-center">{elegivel ? <span className="inline-flex items-center gap-1 text-green-600 font-semibold text-xs"><CheckCircle2 size={14} /> Elegível</span> : <span className="inline-flex items-center gap-1 text-red-500 font-semibold text-xs"><XCircle size={14} /> Pendente</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function ContagemBadge({ atual, meta }) {
  const ok = atual >= meta;
  return <span className={`inline-block min-w-[52px] rounded-lg px-2 py-1 text-xs font-bold ${ok ? "bg-green-100 text-green-600" : "bg-amber-50 text-amber-700"}`}>{atual}/{meta}</span>;
}
function Avatar({ nome, foto, size = 36, className = "" }) {
  if (foto) {
    return (
      <img src={foto} alt={nome} className={`rounded-full object-cover shrink-0 ${className}`} style={{ width: size, height: size }} />
    );
  }
  return (
    <div className={`rounded-full bg-gradient-to-br from-violet-600 to-orange-500 flex items-center justify-center text-white font-bold shrink-0 ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.34 }}>
      {iniciais(nome)}
    </div>
  );
}

function RadarMiniLogo() {
  return (
    <div className="relative w-10 h-10">
      <div className="absolute -inset-2 rounded-full bg-orange-500 opacity-30 blur-lg" />
      <svg viewBox="0 0 100 100" className="relative w-full h-full">
        <defs><linearGradient id="miniRingApp" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#A78BFA" /><stop offset="100%" stopColor="#6D4FD1" /></linearGradient></defs>
        {[46, 32, 18].map((r, i) => <circle key={r} cx="50" cy="50" r={r} fill="none" stroke="url(#miniRingApp)" strokeWidth="4.5" opacity={0.55 + i * 0.15} />)}
        <line x1="50" y1="50" x2="80" y2="20" stroke="#F5851F" strokeWidth="6" strokeLinecap="round" />
        <circle cx="50" cy="50" r="7" fill="#F5851F" />
      </svg>
    </div>
  );
}
