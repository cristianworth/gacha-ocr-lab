# ROADMAP — coleta útil para o Advisor

Atualizado em **10/11/2026**. Este é o plano único do projeto. [README](../README.md) orienta a entrada, [guia ZZZ](zzz-scan.md) descreve o uso e [AGENTS.md](../AGENTS.md) reúne regras duráveis. A cronologia e os hashes ficam em [evidências ZZZ](zzz-evidence.md).

## Objetivo e escopo

Poupar a digitação de equipamentos úteis ao Advisor, começando por uma coleta ZZZ curta e revisável. O caminho atual é **W-Engines S/A nível 20+ fixo**, em todas as progressões, com filtros/Level decrescente/topo preparados por Cristian. O aplicativo coleta, para nos níveis baixos e preserva pendências. Não precisa automatizar menus, reconciliar cópias entre sessões ou alcançar OCR perfeito para entregar valor.

**HSR:** Cones de Luz com nível atual **>=20**, preparação manual por Cristian. Em 04/11 Cristian reforçou incluir **3 estrelas upados**: preparar sem filtro de estrelas, coletar 3/4/5 estrelas 20+. O corte útil é o nível; raridade não é inferida nem usada para descartar. Nível ilegível permanece pendente. A leitura alternada por linha confere ordenação pelas posições visuais e termina a linha reversa antes de cortar por nível baixo, preservando elegíveis à esquerda.

A direção multijogo permanece **ZZZ → HSR → Genshin → WuWa → NTE**. O motor genérico não é pré-requisito para o primeiro produto útil; a extração compartilhada deve surgir dos dois primeiros usos reais.

**Ordem de execução definida por Cristian:** consolidar ZZZ → melhorar velocidade → **interface simples** → HSR 20+ → demais jogos. A interface começa com ZZZ; HSR fica indisponível até existir um executor real. Planos técnicos: [velocidade](zzz-performance-plan.md) e [interface](desktop-ui-plan.md). Cristian aprovou o protótipo com filho simulado e a coleta integrada: janela, UAC, término e abertura do resultado conferidos no fluxo local. Parada/X têm testes simulados, sem acionamento nessa coleta.

## Estado por entrega

| Parte | Evidência disponível | Estado / pendência |
|---|---|---|
| Base, campos e guardas (P0–P2) | Captura, seleção, cinco campos, F8/foco/geometria conferidos no ambiente inicial | Reaproveitar; não repetir por rotina |
| Percurso intermediário (P3.3-A) | 54 posições/seis linhas/três rodas e linha NEW! conferidas | Encerrado no recorte |
| Fundo da lista (P3.3-B) | 118/118 e dez transições verificadas em 28/10 | Prova de diagnóstico preservada |
| Caminho útil 20+ | Coleta real de 29/10: 34 elegíveis, 35 observados, 34 cliques e uma roda; mesmo conteúdo da base completa | Conferido no jogo |
| Revisão de dados | Três nomes confirmados por Cristian somente nesses campos; resumo revisado separado do bruto | Usar o resumo e investigar dúvidas pontuais, sem revisão obrigatória de 34×5 campos |
| Entrada de duplo clique (P3.4) | Implementada: `scan-zzz.cmd` → `scripts/start-zzz.ps1`; 21 testes e execução real de 01/11 concluída pelo lançador, com 34 elegíveis | Concluída no ambiente local: encerramento, pasta correta e abertura automática do resumo confirmados |
| Distribuição portátil (P3.4) | Pasta/ZIP, 25 testes, relocação e coleta real em `D:\Repo\gacha-ocr-zzz`: 34 elegíveis; 614 hashes íntegros | Concluída para uso local; outro computador e publicação pública fora da validação atual |
| Desempenho ZZZ (P3.5) | Combinação conferida no jogo: 34 itens preservados, 405 imagens/618 arquivos íntegros; tempo ativo 43,78 → 34,04 s (22,2% menor) | Encerrado no ambiente local; entrega de desempenho versionada. Próxima implementação: interface |
| Interface simples (P3.6) | Protótipo aprovado pelo main; 116 testes focados; 34 elegíveis preservados em coleta pela janela; UAC/término/resultado confirmados por Cristian | Concluída no fluxo local para ZZZ; HSR adicionado em P4. Parada/X simulados, não acionados nessa coleta |
| HSR (P4) | Coleta portátil de 04/11: 68 observados, percurso alternado/scroll/log até o corte; original inconclusivo. Replay offline: 67 observados, 66 elegíveis e zero níveis pendentes | Concluído no recorte local; Cristian revisou separadamente três nomes e duas sobreposições, com grafia da posição 41 corrigida em nova revisão. Sem aprovação integral do inventário; raridade/trava não extraídas. [Guia](hsr-scan.md), [evidências](hsr-evidence.md) |
| Outros jogos (P5–P7) | Referências pesquisadas; núcleo multijogo não extraído | Genshin, WuWa e NTE depois dos dois primeiros fluxos e da interface mínima |

Os números acima são do ambiente conferido, não uma estimativa geral de precisão. O usuário prepara Level decrescente; o seletor não é verificado automaticamente. O JSON bruto mantém três nomes `uncertain`; a revisão humana os resolve somente para aquela sessão. `inventoryAccepted` não foi promovido globalmente.

## Entrega atual — entrada simples ZZZ

O lançador implementado:

1. Checar a instalação local sem capturar/controlar o jogo; `-Check` não precisa de UAC nem emite inputs.
2. Abrir console visível como Administrador e pedir confirmação explícita da preparação. Enter continua; 0 cancela. O F8 inicial do scanner permanece.
3. Executar o mesmo S/A 20+ com Level decrescente declarado, guardas e parada antecipada, sem duplicar coleta ou criar configuração nova.
4. Identificar a pasta exclusiva daquela chamada, sem procurar “a mais recente”, e ler o manifesto somente depois do processo encerrar.
5. Abrir `summary.md` no Bloco de Notas, inclusive parcial; usar relatório visual ou pasta/diagnóstico como alternativa quando necessário.

**Limite:** a entrada do repositório usa Python/Tesseract/cache preparados no laboratório; a pasta portátil inclui o runtime e o OCR. Não há instalador. O executável Genshin antigo continua separado.

**Conferência proporcional:** checagem read-only e testes com stubs para instalação ausente, cancelamento, falha, pasta correta e abertura de resultado. A captura em si já foi conferida; quando Cristian usar a nova entrada, observar apenas o lançamento e a saída. Não repetir prefixo, guardas ou travessia até o fundo para aceitar uma mudança de abertura.

**Verificação inicial em 29/10:** 17 testes iniciais e quatro verificações adicionais passaram, cobrindo pasta com espaços/apóstrofo, flags e diretório exatos, parcial com saída zero, falha, ausência de resultado, cancelamento/EOF, argumentos de elevação, abertura/fallback e rejeição de diretório externo, aninhado ou existente. A sintaxe PowerShell e `start-zzz.ps1 -Check` passaram no ambiente real, inclusive partindo de outro diretório. Naquela etapa, UAC, abertura real no Bloco de Notas e coleta pelo duplo clique ainda não haviam sido exercitados interativamente; não houve aquisição no jogo durante a implementação.

**Retorno de uso em 01/11:** Cristian apresentou o encerramento do lançador e a sessão `20261101-195855-9469d5d5-selection`, com saída zero, 34 elegíveis, zero níveis/seleções pendentes, 34 cliques e uma roda. O escopo terminou na posição 35 (nível 0); 83 posições restantes não foram lidas por ordenação. Os cinco campos mantêm valores/estados iguais aos de 29/10, inclusive três nomes incertos. Hashes de 192 imagens e cinco módulos conferidos. Cristian confirmou que o resumo abriu automaticamente no Bloco de Notas, encerrando a pendência de saída do lançador. O gesto de duplo clique e o UAC não foram observados separadamente. Nenhuma aprovação humana foi transferida entre sessões; detalhes em [evidências](zzz-evidence.md#execução-pelo-lançador--01112026).

**Pacote portátil em 01/11:** o mesmo lançador aceita um executável PyInstaller em pasta quando há `portable-build.json`; o caminho do repositório continua usando a venv. Build `20261101-201111-e58b9868`, ZIP de aproximadamente 299 MiB, sem sessões pessoais. Montagem e uso em [guia portátil](zzz-portable.md). Passaram 25 testes focados, pré-checagem da pasta extraída em outro caminho, self-check dos módulos/OCR e leitura offline das posições 1/14/34 com os mesmos cinco campos e zero inputs. Foram conferidos 614 hashes; PATH sem Python/Node, sem venv no pacote. Na verificação inicial, a coleta integrada pelo binário empacotado e outro computador ainda não tinham evidência. A montagem não alterou OCR nem aprovou inventário; não houve commit ou publicação.

**Primeiro uso integrado do portátil:** Cristian executou a pasta `D:\Repo\gacha-ocr-zzz` e informou sucesso. A sessão `20261101-230702-880080ba-selection` encerrou com saída zero, 34 elegíveis, zero níveis/seleções pendentes, 34 cliques e uma roda. Valores/estados dos cinco campos iguais à sessão anterior, incluindo os três nomes incertos. Conferidos 186 hashes de imagens e os 614 arquivos do pacote, sem divergências. P3.4 encerrado no recorte de uso local; não exigir nova aquisição. Não equivale a precisão integral aprovada ou teste em outro computador. [Evidência](zzz-evidence.md#primeiro-uso-integrado-do-portátil--01112026).

**Verificação da consolidação:** 120 testes focados passaram em 106,32 s, nos arquivos `test_zzz_inventory.py`, `test_zzz_inventory_scope.py`, `test_zzz_level_cutoff.py`, `test_zzz_report_save.py`, `test_zzz_launcher.py` e `test_zzz_portable.py`. Pré-checagem real do lançador, sintaxe dos quatro scripts PowerShell envolvidos, links/âncoras locais e `git diff --check` também passaram. Marcador de memória e quatro handoffs preservados por hash e excluídos da publicação. Sem nova coleta, alteração de comportamento, implementação de velocidade/interface ou aprovação adicional de inventário nesta consolidação.

## Próximos recortes

**Experimento de gravação em 02/11, após reavaliação:** protótipo isolado com um gravador e fila de quatro imagens, sem integração ao scanner. Replay pareado das 34 seleções: confirmações 33,41 → 27,72 s; economia 5,69 s, projetando 13% do total ativo, abaixo do mínimo de 20%. Dez testes passaram e 446 imagens mantiveram pixels/hashes. Pausado, sem novo pacote ou teste manual. [Medição e limites](zzz-performance-plan.md#experimento-de-gravação--pausado-após-medição). O ganho no jogo não foi medido; recomendação continua interface antes de HSR.

**Reavaliação de desempenho em 02/11:** Cristian pediu priorizar o maior custo e pausar abaixo de 20% de ganho. A triagem do agendamento das verificações projetou 9–19% no tempo ativo, com limitações de amostragem; foi pausada antes de mudar o scanner ou gerar pacote. [Diagnóstico e limite do modelo](zzz-performance-plan.md#terceiro-recorte--pausado-pelo-limite-de-retorno). P3.5 já validado permanece disponível; a recomendação continua P3.6, sujeita à reavaliação por Cristian.

1. **Consolidação ZZZ — concluída:** commit `fa44553`, publicado em `origin/main` em 01/11. Sem changelog encontrado; versão 0.1.0 mantida, igual ao pacote testado. Marcador de memória, handoffs, modelos, dependências e resultados ficaram fora do commit. P3.4 está validado para uso local; outro Windows e avisos dos binários transitivos do Tesseract só bloqueiam uma futura publicação pública.
2. **P3.5 — desempenho encerrado no recorte local:** sessão real `20261102-193652-86205124-selection`, pacote `20261102-184806-173bed9f`. Tempo ativo 43,78 → 34,04 s (22,2% menor); total incluindo preparação/encerramento 57,29 → 51,11 s. Mesmos valores/estados dos cinco campos nos 34 itens, zero falhas ou gravações pendentes; 405 imagens e 618 arquivos do pacote íntegros. A fila chegou a duas imagens, sem pressão. É evidência local, não garantia geral de velocidade nem aceite humano do inventário. Não há nova coleta pendente. Entrega de desempenho versionada; seguir para P3.6. [Validação final](zzz-performance-plan.md#validação-integrada-final--etapa-encerrada).
3. **P3.6 — interface mínima concluída no fluxo local:** protótipo WinForms aprovado e integração conferida conforme [plano da janela](desktop-ui-plan.md). ZZZ disponível e HSR “em breve”; iniciar, acompanhar, interromper e abrir resultado sem operar prompt. Usa o executor/pacote, mantém foco/UAC/F8 e distingue parcial de sucesso. Entrada `.exe` é chamada simples do CMD. Sessão `20261102-213358-ac9ca5c4-selection`: 34 elegíveis preservados, 400 imagens/622 arquivos íntegros e UAC/término/resultado confirmados por Cristian. Parada/X têm testes simulados; não foram acionados no jogo nessa coleta.
4. **P4 — primeiro percurso HSR útil concluído no ambiente local:** Cones de Luz 3/4/5 estrelas 20+, preparação manual e resumo revisado. Replay das imagens confirmou 66 elegíveis; Cristian revisou cinco campos separadamente, com grafia da posição 41 corrigida em nova revisão. Sem aceite integral do inventário. Fundo físico, raridade/trava como campos extraídos e outro computador permanecem fora deste primeiro recorte; não portar o aplicativo de referência inteiro.
5. **P5–P7 — Genshin, WuWa e NTE:** um por vez, com pesquisa focada e coleta útil primeiro. NTE exige confirmar categoria e suporte em inglês antes de prometer módulo pronto. Experimentos JavaScript permanecem preservados e não definem a nova arquitetura.
6. **P8 — integração mais automática com Advisor:** considerar import/export com diff e aplicação explícita somente quando o uso manual do resumo justificar. Ausência numa coleta filtrada não remove fatos da conta.
7. **P9 — outras categorias:** personagens, discos/artefatos e similares apenas por necessidade explícita.

## Critério de avanço

Uma entrega avança quando reduz trabalho manual, produz saída utilizável com limitações visíveis e conserva as proteções necessárias. Distinguir aquisição, cobertura, precisão e aprovação humana. Pendência honesta pode coexistir com produto útil; palpite silencioso não.

Usar arquivos/replays primeiro e uma intervenção real somente para uma dúvida concreta. Falha deve ser analisada pelos artefatos antes de pedir repetição. Não exigir duas novas coletas até o fundo, revisão manual integral ou uma suíte inteira por rotina. A revisão técnica com o main, quando combinada, segue por Cristian; identificar o chat não autoriza mensagens diretas.

**P5 Genshin — planejamento e primeiro leitor offline (09/11):** armas 3★/4★/5★ de nível atual 20+ com nome, nível atual/máximo e refinamento; Cristian confirmou inclusão das 3★ evoluídas. Preparação: inglês, cliente 1280×720, escala Windows 100%, Weapons no topo e Level decrescente, sem filtro de raridade que exclua armas do escopo. Os exemplos mostram raridades misturadas sob Level: não parar por raridade. O corte antecipado por nível depende de ordenação global declarada ou verificada; nível ilegível ou contradição impede concluir cobertura. Até qualificar o percurso, o piloto é limitado a dez posições, não uma declaração de cobertura. Saída pretendida: resumo revisável, imagens e OCR bruto/pendências em sessão local, sem aplicar ao Advisor.

Etapas: (1) conferir as quatro imagens fornecidas e implementar leitura regional offline, preservando moldura/original e origem; (2) qualificar geometria/seleção e um piloto limitado, preservando guardas, com evidência real de troca de seleção; (3) definir e verificar ordenação, filtro e parada útil antes de percurso completo; (4) integrar à janela e portátil somente após validar executor/saída. O legado 1440×900 é histórico; não presumir que suas coordenadas ou seu corte por raridade se aplicam a 1280×720. Testes offline não comprovam inputs nem precisão independente.

Primeiro leitor offline: `node scripts/genshin-offline.js "examples/Genshin/Prototype Crescent.png" --client 3,30,1280,720` imprime JSON com origem, recortes, bruto e incertezas; informe o retângulo real para imagens com moldura. Nas quatro imagens fornecidas, a leitura reconheceu os quatro nomes, quatro refinamentos e três níveis; o nível do Prototype permaneceu incerto. São exemplos usados para desenvolver o perfil, não avaliação independente. Não há captura, clique ou integração à janela neste recorte.

Na imagem adicional Slingshot, o leitor reconheceu nome, 90/90 e refinamento 5. O contorno legado foi exercitado offline em cinco posições selecionadas e cinco vizinhas não selecionadas; `--slot` recebe retângulo explícito em pixels do cliente. Um frame não confirma movimento nem identifica cópia. O exemplo Slingshot mostra uma lista rolada, inclusive uma linha parcial, sem comprovar o topo ou a ordenação global inteira.

**Piloto 1280×720:** o perfil propõe linhas a partir das faixas de nível, exclui linhas parciais e exige seleção única; continua conservador e sem afirmar cobertura. Um replay com as imagens Aqua/Elegy e OCR real registrou as duas leituras, com inputs simulados. O executor limitado a dez posições verifica Weapons/Level, primeira seleção, 1280×720/96 DPI, integridade e guardas de janela; cada posição precisa de contorno e painel estável em dois frames. F8 interrompe e falhas preservam parcial. Esse replay não valida scroll, precisão geral ou corte 20+.

O seletor da janela do repositório oferece Genshin como piloto, com pasta própria, log, parada cooperativa e abertura do resumo. Entrada: `D:\Repo\gacha-ocr-lab\gacha-ocr.exe`; após atualizar os scripts, feche e reabra a janela. Exige Node.js, dependências e modelo inglês no repositório; pacotes portáteis já extraídos não incluem essa integração.

**Piloto real em 10/11:** sessão `20261110-001946-2f7a1766-selection` encerrou por `pilot-limit`, com dez posições observadas e 30 campos marcados como reconhecidos pelo OCR. As dez capturas vinculadas correspondem aos hashes do manifesto SHA-256 `6253b1b2ab74d4dd0009c606bbc0025e565856b0b3863830c8bf0a2c527eab88`. A sessão é parcial: sem rolagem, corte de nível, cobertura ou aprovação humana do inventário. Não confundir reconhecimento com precisão aprovada. Próximo recorte: planejar e qualificar mudança de linha e rolagem para o percurso 20+, preservando as guardas.
