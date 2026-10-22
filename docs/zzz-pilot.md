# Piloto ZZZ — dez posições (P2)

Implementado em **22/10/2026** sobre a [prova real P1.3](youkai-selection.md). **P2.1/P2.2 implementados e verificados offline; Primeiro percurso real de dez posições conferido; paradas durante execução ainda pendentes.** O motor compartilhado e o inventário completo pertencem às próximas etapas.

## Percurso e segurança

Usa o `GridNavigator.scan(10)` original: nove posições na primeira linha e uma na segunda, mais o clique de preparação na segunda célula. Normalmente são **11 cliques**, máximo de 41 com retentativas originais. Não emite rolagem. Prepare manualmente a lista no topo, com ao menos dez posições. O total global do cabeçalho não é contagem S/A.

Mantém janela única `ZenlessZoneZero`, cliente 1280×720, escala 100%, integridade compatível e guardas de foco/geometria. Usa o listener público original com F8 explícito. Antes dos inputs pede F8; após esse sinal há cinco segundos. Durante a execução, F8 solicita parada. Libera somente botões pressionados pelo próprio helper.

Reutiliza as APIs públicas de captura/calibração, grade, Tesseract e normalização. Os 260 arquivos upstream continuam conferidos contra o ZIP do SHA `86a8b34511c86ec864d8f40c558789f7ccad4cc9`. Não sobrescreve métodos privados nem incorpora a interface do Youkai. Acrescenta guardas e interpretação local sem reconstruir captura/grade.

## Leitor adaptado

[scripts/zzz_pilot.py](../scripts/zzz_pilot.py) contém o perfil medido para W-Engines 1280×720:

- **Nome:** recorte menor exclui ícones/arte. Preserva OCR bruto e candidato do normalizador; a leitura primária exige score 100 e concordância entre texto/identificador, desconsiderando espaços/pontuação/caixa. Quando ícones contaminam a segunda linha, faz releitura isolada da primeira somente se ela já coincide literalmente com o candidato; essa releitura também exige score 100/concordância literal. Mantém ambos os brutos e scores. No perfil v2, títulos ainda incertos têm releituras ampliadas com máscara de texto branco; títulos quebrados podem combinar a primeira linha estreita com a segunda ampliada. Só aceita concordância literal completa com um identificador do catálogo, desconsiderando caixa/pontuação/espaços. Um score menor no recorte truncado não invalida uma releitura literal completa; nenhum score é convertido em probabilidade. Outras divergências ficam incertas. Score não é probabilidade. Títulos novos/mais longos precisam de conferência.
- **Nível:** preserva atual e limite; exige `Lv. atual/limite` válido nos limites 10/20/30/40/50/60. Não presume limite ausente.
- **Raridade:** preserva S/A/B por `detect_rarity`, com evidência de cor e recusa de amostra cinza/escura. S/A entram no escopo; B fica como observação `excluded-B`; incerteza fica `pending-rarity`.
- **Progressão:** mede os cinco slots de estrelas claras, distinguindo preenchidas, vazias e ilegíveis. Exige sequência válida de 1–5; ausência, brilho insuficiente ou inconsistência retorna nulo/incerto, sem fallback para 1.
- **Lock:** lê a ação da própria tela selecionada: `T Unlock` significa travado; `T Lock`, destravado. Texto ausente/ambíguo fica incerto. Não usa lock da célula 0,0 nem assume falso. Travado foi exercitado em prints; destravado só em teste sintético.

Cada aquisição do piloto exige destaque amarelo na célula esperada, estrelas legíveis e estabilidade de título/faixa de campos em frames consecutivos. Aguarda até quatro segundos e salva tentativas não prontas. Essa heurística recusa a transição escura observada; não garante todo layout/animação e exige prova real. Divergência/timeout preserva a sessão parcial.

A grade original ainda repete cliques/pula painéis iguais. O piloto preserva as posições e pode recuperar uma leitura pulada **somente** a partir de frame estável com a célula esperada visivelmente selecionada, sem novo clique. Sem essa evidência, mantém falha. Não une posições por nome, atributos ou hash. Dez cópias simuladas foram exercitadas com o navegador original; cópias reais ainda precisam de prova.

## Executar

Requer o ambiente de [qualificação](youkai-qualification.md). No ambiente de Cristian, o jogo exigiu integridade 12288; use **PowerShell como Administrador** no ensaio real. Não há elevação automática. O lançador Genshin existente não inicia ZZZ.

```powershell
# W-Engines aberto no topo, inglês, janela 1280x720/100%.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "D:\Repo\gacha-ocr-lab\scripts\pilot-zzz.ps1" -Run
```

Pressione e solte F8 quando solicitado. Após cinco segundos, o processo pede foco ao jogo. Reserve os controles; F8 novamente interrompe. O terminal informa `session.json`; abra `review.html` na mesma pasta e confira destaque, painel e campos. Envie o caminho da sessão para análise.

Sem `-Run` e sem imagem, só confere metadados/acesso, sem captura/foco/inputs. `-Run -Limit 3` permite ensaio deliberado de interrupção, sem repetir a prova anterior como resultado novo.

Para arquivo salvo, sem jogo aberto ou elevação:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "D:\Repo\gacha-ocr-lab\scripts\pilot-zzz.ps1" -ImagePath "D:\Repo\gacha-ocr-lab\examples\ZZZ\1.png" -ClientArea "2,33,1280,720"
```

Captura cliente sem borda usa `-ClientArea "0,0,1280,720"`. O recorte explícito deve caber na imagem e ter 1280×720; não há redimensionamento. `read-youkai-image.ps1` continua disponível para comparação original.

## Saídas e estados

Nova pasta `.cache/youkai-p1/runs/<data-hora-id>-selection/`:

- `session.json`: posições, estados, motivo de parada, fonte upstream, hashes dos arquivos locais do leitor, frames/hashes, cliques solicitados, bruto, candidatos e comparação original.
- `review.html`: imagens, campos/estados/escopo e detalhes de bruto/comparação. Não aprova nem aplica correções.
- `frames/`, `position-XX.png`, `reading-XX/`: originais, recortes adaptados e comparação upstream. `stop-check.json` registra F8 prévio no modo real.

`read` significa processado, inclusive com campos incertos. `scopeCounts` conta decisões de raridade, não itens aprovados. `pilotTraversalComplete` só indica processamento do prefixo. `selectionVerified` por posição é a checagem automática de destaque/estabilidade; `selectionDeliveryVerified` global aguarda revisão posterior. `requiresManualReview` fica verdadeiro; `humanApproved`, `captureComplete` e `inventoryAccepted` não são promovidos automaticamente. Sessões paradas preservam posições não visitadas/capturadas/falhas e frames registrados.

Limites: 180 segundos para permitir novos inputs, 600 frames, sem interromper à força um OCR em andamento. Imagens, resultados, referências e cache ficam fora do Git. Nada é aplicado ao Advisor.

## Verificação — 22/10/2026

- **73 testes aprovados**: 42 novos e 31 regressões de seleção/captura. Casos de progressão 1–5, ausência/brilho, nível/limite, lock, B, seleção em duas linhas, estabilidade/parada, falhas parciais e cópias iguais.
- Integração executa o `GridNavigator.scan(10)` original com controlador/pixels simulados; nove skips por painéis iguais são recuperados em posições distintas apenas com destaque correto. Não emite inputs ao desktop.
- Comando offline exercitado no Windows PowerShell 5.1; JSON, recortes e HTML gerados.
- Nas três referências humanas P1.2, nome, nível/limite, raridade e progressão conferem. Progressão original **1/1/1** passou a **4/2/1**. Lock travado nos três prints tem conferência visual do assistente, sem nova confirmação humana.
- Replay dos três frames da seleção real: o primeiro mantém progressão 1; os dois escurecidos ficam incertos. Sem nova captura/input. Relatório local: `.cache/youkai-p1/p2-regression.json`. Hashes das imagens/resultados originais P1.2 preservados.

Essas imagens orientaram ajustes: são desenvolvimento/regressão, sem avaliação independente. B, nível abaixo de 60, progressões 3/5 e lock destravado ainda não têm referências reais conferidas nesta entrega. Testes upstream P1.1 e JS continuam históricos.

## Primeiro piloto real — 22/10/2026

Cristian executou `pilot-zzz.ps1 -Run` no código `83b1912`, perfil v1. Sessão local: `.cache/youkai-p1/runs/20261022-103315-ea8371b8-selection/`. Foram dez posições processadas, incluindo r1c0, 11 pares de solicitação de pressionamento/liberação, sem retentativas ou rajadas de rolagem. Integridade helper/jogo 12288, `upstreamIncomplete: null`, sem erro de cleanup. O recibo confirma F8 antes dos inputs; não houve parada durante esta execução.

O assistente inspecionou os dez painéis e os cartões destacados em folhas de revisão derivadas dos PNGs. Destaques/posições conferem, painéis estão legíveis, e os dez campos de nível 60/60, raridade S, progressão 1 e lock travado conferem visualmente. Duas posições distintas mostram Weeping Cradle com os mesmos campos e retratos de personagens diferentes: foram preservadas como duas observações, sem fusão. Não são frames idênticos e o caminho de recuperação de skips não foi acionado nessa sessão.

O leitor v1 reconheceu seis nomes e manteve quatro incertos, sem aceitar texto errado: o recorte estreito truncou The Restrained, Ode of Resurrected Wings e as duas Weeping Cradle. A correção v2 amplia apenas as leituras incertas, filtra arte colorida e exige concordância literal; para o nome em duas linhas amplia só a segunda quando necessário. Preserva brutos, crops, candidatos e scores anteriores. A diferença de caixa em `WINGS` também expôs a sensibilidade do normalizador original: a concordância literal completa com o candidato do catálogo prevalece sobre sua sugestão fuzzy divergente, sem eliminar letras extras do OCR.

O replay separado do perfil v2 reconheceu os dez nomes, e os cinco campos conferem com a inspeção visual do assistente nos dez frames. A regressão das três referências humanas e dos três frames P1.3 anteriores também foi preservada. Esses dez frames passaram a desenvolvimento/regressão, sem alegação de avaliação independente.

A revisão separada `pilot-review.json` é vinculada ao SHA-256 do `session.json`. O manifesto e os frames originais são preservados; a correção não é apresentada como nova execução ao vivo. Relatório local do replay: `.cache/youkai-p1/p2-live-pilot-replay.json`, com nova sessão/HTML separados. Conferência dos campos por assistente não é aprovação humana da conta nem aceite do inventário inteiro.

O piloto demonstra percurso limitado e legibilidade neste ambiente, com cópias reais preservadas. Continua sem provar reação real a F8/foco/geometria durante inputs, filtro B em imagem real, percurso completo ou outras resoluções.

## Próximo aceite

1. Concluir o aceite a partir da sessão já conferida e de seu replay corrigido. Não repetir as dez posições sem uma divergência que exija isso.
2. Em ensaio curto separado, testar F8 em curso e recusa de novos inputs ao perder foco/mudar geometria. Analisar cada sessão antes de repetir.
3. Regressar casos novos e corrigir divergências. Obter referências reais de B, nível intermediário, progressão 5 e lock destravado antes de generalizar precisão.
4. Com P2 aceito, iniciar P3: rolagem/fim, contagem S/A independente, duas coletas conferidas e pacote Windows. Consolidação com HSR permanece em P4.
