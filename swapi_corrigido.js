const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

// #Minhas configurações e constantes:
const URL_BASE_API = "https://swapi.dev/api";
const TEMPO_LIMITE_REQUISICAO_PADRAO_MS = 5000;
const PORTA_SERVIDOR = process.env.PORTA || 3000;

const MAX_NAVES_PARA_EXIBIR = 3;
const POPULACAO_MINIMA_PLANETA_FILTRO = 1000000000;
const DIAMETRO_MINIMO_PLANETA_FILTRO = 10000;
const ID_MAX_VEICULO_DESTAQUE_BUSCA = 4;

const cacheDaApi = {};
const configuracaoApp = {
    modoDepuracao: true,
    tempoLimiteRequisicao: TEMPO_LIMITE_REQUISICAO_PADRAO_MS,
};
const estatisticasApp = {
    contadorErros: 0,
    contadorChamadasApi: 0,
    tamanhoTotalDadosRespostaBytes: 0,
    idItemAtual: 1,
};

// #Minhas funç~çoes:
function registrarNoConsole(...mensagens) {
    if (configuracaoApp.modoDepuracao) {
        console.log(...mensagens);
    }
}

function incrementarContadorErrosAplicacao() {
    estatisticasApp.contadorErros++;
}

function adicionarAoTamanhoTotalDadosResposta(dados) {
    estatisticasApp.tamanhoTotalDadosRespostaBytes += JSON.stringify(dados).length;
}

function obterDadosDoCache(caminhoRecurso) {
    if (cacheDaApi[caminhoRecurso]) {
        registrarNoConsole(`Cache HIT para: ${caminhoRecurso}`);
        return cacheDaApi[caminhoRecurso];
    }
    return null;
}

function armazenarDadosNoCache(caminhoRecurso, dados) {
    cacheDaApi[caminhoRecurso] = dados;
    registrarNoConsole(`Cache MISS e armazenado para: ${caminhoRecurso}. Itens no cache: 
        ${Object.keys(cacheDaApi).length}`);
}


function fazerRequisicaoHTTPS(urlCompletaRequisicao, resolverPromessa, rejeitarPromessa, caminhoRecurso) {
    let bufferDadosResposta = "";
    const requisicao = https.get(urlCompletaRequisicao, { rejectUnauthorized: false }, (resposta) => {
        const codigoStatus400 = 400;
        if (resposta.statusCode >= codigoStatus400) {
            incrementarContadorErrosAplicacao();
            return rejeitarPromessa(new Error(`Falha HTTP ${resposta.statusCode} para ${caminhoRecurso}`));
        }
        resposta.on("data", (chunk) => { bufferDadosResposta += chunk; });
        resposta.on("end", () => {
            try {
                const dadosParseados = JSON.parse(bufferDadosResposta);
                armazenarDadosNoCache(caminhoRecurso, dadosParseados);
                adicionarAoTamanhoTotalDadosResposta(dadosParseados); resolverPromessa(dadosParseados);
            } catch (erroParse) {
                incrementarContadorErrosAplicacao();
                rejeitarPromessa(new Error(`Erro ao parsear JSON de ${caminhoRecurso}: ${erroParse.message}`));
            }
        });
        return null;
    });
    requisicao.on("error", (erroRede) => {
        incrementarContadorErrosAplicacao();
        rejeitarPromessa(new Error(`Erro de rede ao buscar ${caminhoRecurso}: ${erroRede.message}`));
    });
    requisicao.setTimeout(configuracaoApp.tempoLimiteRequisicao, () => {
        requisicao.abort(); 
        incrementarContadorErrosAplicacao(); rejeitarPromessa(new Error(`Timeout para ${caminhoRecurso}`));
    });
}

async function buscarRecursoSWAPI(caminhoRecurso) {
    const dadosEmCache = obterDadosDoCache(caminhoRecurso);
    if (dadosEmCache) {
        return dadosEmCache;
    }

    estatisticasApp.contadorChamadasApi++;
    return new Promise((resolver, rejeitar) => {
        const urlRequisicao = `${URL_BASE_API}/${caminhoRecurso}`;
        fazerRequisicaoHTTPS(urlRequisicao, resolver, rejeitar, caminhoRecurso);
    });
}

// #Coisas para aparecer no console:
function exibirDetalhesPersonagemConsole(personagem) {
    console.log("\n--- Personagem ---");
    console.log("Nome:", personagem.name);
    console.log("Altura:", personagem.height);
    console.log("Peso:", personagem.mass);
    console.log("Ano de Nascimento:", personagem.birth_year);
    if (personagem.films && personagem.films.length > 0) {
        console.log("Aparece em", personagem.films.length, "filme(s)");
    }
}

function exibirDetalhesNaveConsole(nave, indiceNave) {
    console.log(`\nNave ${indiceNave + 1}:`);
    console.log("  Nome:", nave.name);
    console.log("  Modelo:", nave.model);
    console.log("  Custo:", nave.cost_in_credits !== "unknown" ? `${nave.cost_in_credits} créditos` : "Desconhecido");
}

function exibirDetalhesPlanetaFiltradoConsole(planeta) {
    console.log(`${planeta.name} - Pop: ${planeta.population},Diâmetro: ${planeta.diameter},Clima: ${planeta.climate}`);
    if (planeta.films && planeta.films.length > 0) {
        console.log(`  Aparece em ${planeta.films.length} filme(s)`);
    }
}

function exibirDetalhesFilmeConsole(filme, indiceFilme) {
    console.log(`\n${indiceFilme + 1}. ${filme.title} (${filme.release_date})`);
    console.log(`   Diretor: ${filme.director}`);
}

function exibirDetalhesVeiculoConsole(veiculo) {
    console.log("\n--- Veículo em Destaque ---");
    console.log("Nome:", veiculo.name);
    console.log("Modelo:", veiculo.model);
    console.log("Custo:", veiculo.cost_in_credits!=="unknown" ? `${veiculo.cost_in_credits} créditos` : "Desconhecido");
}

async function processarDetalhesPersonagem(idPersonagem) {
    const personagem = await buscarRecursoSWAPI(`people/${idPersonagem}`);
    exibirDetalhesPersonagemConsole(personagem);
}

async function processarNaves() {
    const dadosNaves = await buscarRecursoSWAPI("starships/?page=1");
    console.log("\n--- Naves (Starships) ---");
    console.log("Total de Naves:", dadosNaves.count);
    for (let contador = 0; contador < MAX_NAVES_PARA_EXIBIR && contador < dadosNaves.results.length; contador++) {
        exibirDetalhesNaveConsole(dadosNaves.results[contador], contador);
    }
}

async function processarPlanetasGrandesPopulosos() {
    const dadosPlanetas = await buscarRecursoSWAPI("planets/?page=1");
    console.log("\n--- Planetas Grandes e Populosos ---");
    dadosPlanetas.results.forEach(planeta => {
        const populacao = parseInt(planeta.population);
        const diametro = parseInt(planeta.diameter);
        const ehPopuloso = !isNaN(populacao) && populacao > POPULACAO_MINIMA_PLANETA_FILTRO;
        const ehGrande = !isNaN(diametro) && diametro > DIAMETRO_MINIMO_PLANETA_FILTRO;
        if (ehPopuloso && ehGrande) {
            exibirDetalhesPlanetaFiltradoConsole(planeta);
        }
    });
}

function compararFilmesPorDataDeLancamento(filmeMaisAntigo, filmeMaisNovo) {
    return new Date(filmeMaisAntigo.release_date) - new Date(filmeMaisNovo.release_date);
}

async function processarFilmes() {
    const dadosFilmes = await buscarRecursoSWAPI("films/");
    const filmesOrdenados = [...dadosFilmes.results].sort(compararFilmesPorDataDeLancamento);
    console.log("\n--- Filmes Star Wars (Ordem Cronológica de Lançamento) ---");
    filmesOrdenados.forEach(exibirDetalhesFilmeConsole);
}

async function processarVeiculoDestaque() {
    const idVeiculo = (estatisticasApp.idItemAtual % ID_MAX_VEICULO_DESTAQUE_BUSCA) + 1;
    try {
        const veiculo = await buscarRecursoSWAPI(`vehicles/${idVeiculo}`);
        exibirDetalhesVeiculoConsole(veiculo);
    } catch (erro) {
        console.warn(`Aviso: Não foi possível buscar o veículo ${idVeiculo}: ${erro.message}`);
    }
}

function exibirEstatisticasExecucaoConsole() {
    registrarNoConsole("\n--- Estatísticas da Execução ---");
    registrarNoConsole("Chamadas à API nesta execução:", estatisticasApp.contadorChamadasApi);
    registrarNoConsole("Itens no Cache:", Object.keys(cacheDaApi).length);
    registrarNoConsole("Contagem de Erros (total):", estatisticasApp.contadorErros);
}

async function executarProcessamentoPrincipalDadosStarWars() {
    try {
        registrarNoConsole("Iniciando busca de dados Star Wars...");
        await processarDetalhesPersonagem(estatisticasApp.idItemAtual);
        await processarNaves();
        await processarPlanetasGrandesPopulosos();
        await processarFilmes();
        await processarVeiculoDestaque();
        estatisticasApp.idItemAtual++;
        exibirEstatisticasExecucaoConsole();
    } catch (erro) {
        console.error("\nERRO no processamento principal:", erro.message);
    }
}


const INDICE_INICIAL_ARGUMENTOS_REAIS = 2;
const INDICADOR_ITEM_NAO_ENCONTRADO = -1;
function obterTimeoutDosArgumentos(argumentos) {
    const argumentoTimeoutFlag = "--timeout";
    const indiceFlagTimeout = argumentos.indexOf(argumentoTimeoutFlag);
    if (indiceFlagTimeout !== INDICADOR_ITEM_NAO_ENCONTRADO && argumentos[indiceFlagTimeout + 1]) {
        const valorAposFlag = argumentos[indiceFlagTimeout + 1];
        const timeoutNumerico = parseInt(valorAposFlag);

        if (!isNaN(timeoutNumerico) && timeoutNumerico > 0) {
            return timeoutNumerico;
        }
    }
    return null; 
}

function processarArgumentosLinhaComando() {
    const argumentosRecebidos = process.argv.slice(INDICE_INICIAL_ARGUMENTOS_REAIS);

    if (argumentosRecebidos.includes("--no-debug")) {
        configuracaoApp.modoDepuracao = false;
    }

    const timeoutConfigurado = obterTimeoutDosArgumentos(argumentosRecebidos);
    if (timeoutConfigurado !== null) {
        configuracaoApp.tempoLimiteRequisicao = timeoutConfigurado;
    }
}



function manipularRequisicaoPaginaInicial(req, res) {
    const caminhoParaHtml = path.join(__dirname, "index.html");

    fs.readFile(caminhoParaHtml, "utf8", (erro, conteudoHtml) => {
        if (erro) {
            console.error("Erro ao ler arquivo index.html:", erro); // Log do erro no servidor
            // Resposta de erro para o cliente
            const CODIGO_STATUS_ERRO_INTERNO = 500;
            res.writeHead(CODIGO_STATUS_ERRO_INTERNO, { "Content-Type": "text/plain; charset=utf-8" });
            res.end("Erro interno do servidor ao tentar carregar a página inicial.");
            return;
        }
        const CODIGO_STATUS_SUCESSO = 200;
        res.writeHead(CODIGO_STATUS_SUCESSO, { "Content-Type": "text/html; charset=utf-8" });
        res.end(conteudoHtml);
    });
}

async function manipularRequisicaoApi(req, res) {
    executarProcessamentoPrincipalDadosStarWars().catch(erroServidor => {
        console.error("Erro não tratado no servidor:", erroServidor);
    });
    const erro200 = 200;
    res.writeHead(erro200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Requisição /api recebida. Verifique o console do servidor.");
}

function manipularRequisicaoEstatisticas(req, res) {
    const erro200 = 200;
    res.writeHead(erro200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({
        chamadasApi: estatisticasApp.contadorChamadasApi,
        tamanhoCache: Object.keys(cacheDaApi).length,
        erros: estatisticasApp.contadorErros,
        modoDepuracao: configuracaoApp.modoDepuracao,
        tempoLimiteRequisicaoMs: configuracaoApp.tempoLimiteRequisicao
    }));
}

function manipularRecursoNaoEncontrado(req, res) {
    const erro404 = 200;
    res.writeHead(erro404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("404 - Rota não encontrada");
}

const servidor = http.createServer((req, res) => {
    const url = req.url;
    if (url === "/" || url === "/index.html") manipularRequisicaoPaginaInicial(req, res);
    else if (url === "/api") manipularRequisicaoApi(req, res);
    else if (url === "/stats") manipularRequisicaoEstatisticas(req, res);
    else manipularRecursoNaoEncontrado(req, res);
});

// #Esse liga o site:
processarArgumentosLinhaComando();

servidor.listen(PORTA_SERVIDOR, () => {
    console.log(`Servidor (PT) rodando em http://localhost:${PORTA_SERVIDOR}/`);
    if (configuracaoApp.modoDepuracao) console.log("Modo Depuração: ATIVADO");
    console.log(`Timeout requisições: ${configuracaoApp.tempoLimiteRequisicao}ms`);
});
