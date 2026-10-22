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

Sem `-Run` e sem imagem, só confere metadados/acesso, sem captura/foco/inputs. `-Run -Limit 3` continua sendo uma coleta normal curta. Para validar interrupção, use o modo explícito `-Run -TestStop` abaixo.

Para arquivo salvo, sem jogo aberto ou elevação:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "D:\Repo\gacha-ocr-lab\scripts\pilot-zzz.ps1" -ImagePath "D:\Repo\gacha-ocr-lab\examples\ZZZ\1.png" -ClientArea "2,33,1280,720"
```

Captura cliente sem borda usa `-ClientArea "0,0,1280,720"`. O recorte explícito deve caber na imagem e ter 1280×720; não há redimensionamento. `read-youkai-image.ps1` continua disponível para comparação original.

## Teste explícito de parada F8

**Objetivo:** interromper uma sessão que já começou, antes dos itens seguintes. Existem dois momentos distintos de F8.

1. Deixar ZZZ em W-Engines, no topo, inglês, janela 1280×720/100%. Abrir PowerShell como Administrador.
2. Executar:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "D:\Repo\gacha-ocr-lab\scripts\pilot-zzz.ps1" -Run -TestStop
```

3. Na primeira solicitação, pressionar e soltar **F8 uma vez**. Isso apenas confirma que a tecla é detectada.
4. Esperar os cinco segundos e a seleção/leitura do primeiro item. O processo então **para de clicar e aguarda**, imprime `STOP TEST PAUSED` e solicita um beep curto. Manter o jogo em primeiro plano; não usar Alt+Tab para procurar a mensagem no terminal. Se não ouvir o som, a pausa no primeiro item continua sendo a indicação visual.
5. Nessa pausa, pressionar e soltar **F8 novamente**, em até 30 segundos. A sessão deve encerrar com resultado parcial, sem continuar para as próximas leituras. O clique de preparação original acontece antes da primeira leitura.
6. Enviar **só o caminho de `session.json`** informado ao final. Se não houver caminho, enviar a mensagem de erro.

**Resultado esperado:** terminal mostra `STOP TEST PASSED`; relatório com `status: stopped`, `stopObservedDuringRun: true`, `stopTest.passed: true`, prefixo incompleto e nenhum novo pressionamento após a observação do sinal. A primeira leitura já salva permanece disponível. O comando não exige acertar uma janela curta entre cliques; ele espera o segundo sinal. Se houver apenas o F8 inicial, após 30 segundos registra `stopTest.passed: false` e o motivo, sem transformar uma coleta normal em prova de parada.

Esse teste comprova F8; perdas de foco/geometria exigem ensaios próprios. O beep também retornou sucesso na execução real registrada abaixo; a detecção da tecla não depende dele.

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

O piloto demonstra percurso limitado e legibilidade neste ambiente, com cópias reais preservadas. Essa coleta de dez posições não exercitou F8/foco/geometria durante o fluxo. O F8 foi conferido posteriormente na sessão registrada abaixo. A perda de foco também foi conferida posteriormente. Movimentação da janela também foi conferida posteriormente. Filtro B em imagem real, percurso completo, mudança real de tamanho/DPI e outras resoluções continuam pendentes.

## Próximo aceite

1. Concluir o aceite a partir da sessão já conferida e de seu replay corrigido. Não repetir as dez posições sem uma divergência que exija isso.
2. F8 em curso, perda de foco e movimentação da janela confirmados em sessões separadas. Não repetir por rotina; seguir para a transição limitada P3.2.
3. Regressar casos novos e corrigir divergências. Obter referências reais de B, nível intermediário, progressão 5 e lock destravado antes de generalizar precisão.
4. Com P2 aceito, iniciar P3: rolagem/fim, contagem S/A independente, duas coletas conferidas e pacote Windows. Consolidação com HSR permanece em P4.

## Sessão curta posterior — 22/10/2026

Sessão `.cache/youkai-p1/runs/20261022-105744-926f1c32-selection/`: três posições concluídas, quatro pares de pressionamento/liberação, todos os campos conferidos visualmente pelo assistente e 22 hashes de frames verificados. Os nomes do perfil v2 conferem sem correção adicional. O relatório registra `prefix-read`, prefixo completo e `stopObservedDuringRun: false`.

Cristian esclareceu que apertou apenas o F8 inicial. Portanto foi uma coleta normal bem-sucedida, e não um teste de interrupção nem uma falha demonstrada do listener. A revisão `session-review.json` é separada e vinculada ao hash do manifesto. Os hashes do código correspondem ao commit `66fc626` com finais de linha CRLF. Não houve alteração do manifesto original nem aprovação humana dos campos.

Foi criado `-TestStop` para tornar o segundo sinal explícito e aguardá-lo. O primeiro recorte de implementação P3.2, [uma transição de grade](zzz-transition.md), também foi preparado; sua execução real continua pendente.

## Segundo F8 confirmado — 22/10/2026

Sessão real `.cache/youkai-p1/runs/20261022-113802-38781f4a-selection/`, código `a2239e4`, perfil v2: `status: stopped`, `reason: F8`, `stopTest.passed: true`. A pausa explícita foi alcançada após a primeira leitura e recebeu o segundo sinal. Houve dois pares de pressionamento/liberação (preparação na segunda célula e seleção da primeira), ambos anteriores à pausa; a contagem permaneceu em dois após observar F8. Não houve erro de cleanup. Isso comprova encerramento por F8 nesse ponto do fluxo, sem medir latência de interrupção durante um botão pressionado.

A primeira leitura e sua imagem permanecem salvas: Steel Cushion, S, 60/60, progressão 1, travado, com destaque na primeira célula; campos conferidos visualmente pelo assistente. A segunda posição `captured-pending` é evidência do clique de preparação anterior, sem leitura aceita; a terceira permanece `not-visited`. Prefixo incompleto e inventário não aceito são os estados esperados.

Foram conferidos os hashes dos 13 frames e da imagem da posição, os hashes dos dois módulos do leitor contra o checkout CRLF de `a2239e4` e 260 arquivos upstream contra o ZIP fixado. A revisão separada `stop-test-review.json` está vinculada ao SHA-256 `ba5abf1ad5a8bb5176b5b3fe50656d99f6f3ec55e9fd67b77e59f7424171aced` do manifesto original, preservado. Não houve nova aprovação humana dos campos. Não é necessário repetir F8 nem o piloto de dez posições por rotina.

## Perda de foco — roteiro já validado

**Objetivo já exercitado na sessão abaixo:** verificar que o scanner encerra quando outro aplicativo recebe o foco, antes de ampliar o percurso. Não repetir por rotina; manter o roteiro como referência de regressão.

1. Deixar W-Engines no topo, inglês, janela 1280×720/100%; abrir PowerShell como Administrador.
2. Executar uma coleta curta normal:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "D:\Repo\gacha-ocr-lab\scripts\pilot-zzz.ps1" -Run -Limit 3
```

3. Pressionar e soltar F8 na confirmação inicial. Esperar os cinco segundos e o jogo receber foco automaticamente.
4. Assim que o mouse começar a selecionar os cartões sozinho, usar **Alt+Tab uma vez para o PowerShell**. Manter o PowerShell em primeiro plano até o comando encerrar. Não pressionar o segundo F8 neste ensaio, para distinguir os motivos.
5. Esperar `session.json` e enviar apenas seu caminho. Se a coleta terminar antes do Alt+Tab, enviar a sessão mesmo assim; analisar antes de repetir.

**Esperado:** `status: stopped`, motivo `game-focus-lost`, sem continuar cliques no outro aplicativo. Leituras já concluídas permanecem salvas; se a perda ocorrer antes da primeira leitura, zero leituras é aceitável. Uma liberação de botão já pressionado é cleanup permitido. Se houver cliques continuados, usar F8 para interromper e informar isso junto ao caminho. Não há beep de pausa neste comando. A mudança de geometria será outro ensaio; a transição de P3.2 continua preparada para a etapa seguinte.

## Perda de foco confirmada — 22/10/2026

Sessão `.cache/youkai-p1/runs/20261022-115151-d35db31b-selection/`: encerrou com `status: stopped`, `reason: game-focus-lost`, dois pares de pressionamento/liberação e zero leituras concluídas. O primeiro clique prepara a segunda célula; o segundo seleciona a primeira, cujo painel ainda estava estabilizando quando a guarda recusou continuar. Dez frames e a sessão parcial ficaram preservados, sem erro de cleanup. Zero leituras é esperado neste ponto da interrupção; não indica falha de OCR. `stopObservedDuringRun: false` descreve o evento do listener F8, não a ausência de encerramento por outra guarda.

Os dez hashes de frames foram conferidos, assim como 260 arquivos upstream contra o ZIP fixado e os hashes dos módulos do leitor contra o checkout CRLF de `d8c5a23`. Revisão separada em `focus-test-review.json`, vinculada ao manifesto SHA-256 `1ca99f42df66b6f7ba1f20fecd8e6d9240cb610da03ae7a4f97e1632b5d43441`, sem reescrever a sessão. O último frame foi inspecionado pelo assistente; não há leitura nem aprovação de item nessa sessão.

Esse relatório histórico não tem instante/snapshot da mudança de foco; confirma o caminho de parada e o log final de ações, sem medir latência ou o instante exato do Alt+Tab. As próximas sessões registram `guardStop`: motivo, instante monotônico e contagens de pressionamentos/movimentos observados na primeira recusa, além da comparação dessas contagens no encerramento. Isso continua sendo observação de software, sem tornar atômicas a consulta de janela e a emissão nativa de input.

## Mudança de geometria com pausa — roteiro já validado

**Objetivo:** recusar continuar com coordenadas antigas após mover a janela. O scanner espera parado depois de ler o primeiro item; não é necessário disputar o mouse durante as seleções.

1. Deixar W-Engines no topo, inglês, janela 1280×720, escala Windows 100%. Abrir PowerShell como Administrador.
2. Executar:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "D:\Repo\gacha-ocr-lab\scripts\pilot-zzz.ps1" -Run -TestGeometry
```

3. Pressionar e soltar F8 apenas na confirmação inicial. Esperar os cinco segundos e a primeira leitura. Na pausa, o comando solicita um beep e imprime `GEOMETRY TEST PAUSED`. Manter o jogo em primeiro plano; não usar Alt+Tab para procurar a mensagem. O primeiro cartão selecionado e o mouse parado indicam a pausa caso o som não seja audível.
4. Nessa pausa, em até 30 segundos, arrastar **a barra de título da janela do jogo** alguns centímetros e soltar. Manter o jogo em primeiro plano e evitar maximizar/encostar nas bordas da tela. Não mudar resolução nem escala; mover a janela já testa a origem das coordenadas.
5. O scanner deve encerrar. Só depois voltar ao PowerShell e enviar o caminho de `session.json`.

**Esperado:** `GEOMETRY TEST PASSED`, `status: stopped`, `reason: game-geometry-or-DPI-changed`, `geometryTest.passed: true`, primeira leitura preservada e nenhum novo pressionamento após a observação. `windowChange` registra área cliente/DPI esperados e observados. O modo termina em todos os resultados e nunca retoma a coleta após a pausa.

Alt+Tab, F8, listener indisponível ou nenhuma mudança em 30 segundos encerram sem aprovar este teste. Se houver qualquer comportamento inesperado, usar F8 e enviar a sessão com essa informação. Não repetir sem análise. Mover a janela é o caso real pedido; mudança de tamanho/DPI tem cobertura simulada, sem alegar validação ao vivo de todos os casos.

Implementação conferida por **102 testes aprovados**, incluindo os 89 anteriores e 13 casos adicionais: posição/tamanho/DPI pelo fluxo com Win32 simulado, foco/F8 distintos de geometria, tempo esgotado, sessão parcial, restrição de argumentos e registro da primeira recusa. Nenhum input nativo foi emitido pelos testes. A movimentação real da janela foi validada na sessão abaixo. Executar agora a transição limitada de [P3.2](zzz-transition.md); P3.3 depende dessa evidência.

## Movimentação da janela confirmada — 22/10/2026

Sessão `.cache/youkai-p1/runs/20261022-120911-985f905a-selection/`, leitor do commit `94d1158`: `geometryTest.passed: true`, `status: stopped`, motivo `game-geometry-or-DPI-changed`. A guarda detectou a origem cliente saindo de `(320,191)` para `(328,193)`, mantendo 1280×720 e DPI 96. Após a observação, as contagens permaneceram em dois pressionamentos e 71 movimentos de mouse solicitados pelo scanner. Houve dois pares de pressionamento/liberação anteriores à pausa e nenhum erro de cleanup. A parada pode ocorrer no primeiro deslocamento do arraste; não é necessário completar um movimento grande para a guarda recusar continuar. O relatório não mede latência desde o início da ação humana.

Uma leitura permaneceu salva: Steel Cushion, S, 60/60, progressão 1, travado, com destaque na primeira célula; campos conferidos visualmente pelo assistente. A posição `captured-pending` é do clique de preparação anterior. Foram conferidos 13 hashes de frames, a imagem da posição, os hashes dos módulos do leitor e 260 arquivos upstream. A revisão separada `geometry-test-review.json` está vinculada ao SHA-256 `920636a381be21ece785e457267e1bfc5f870c1b08f0c6b093fcd3b323dd8af3` do manifesto, preservado.

Com essa evidência, os ensaios reais de F8, foco e origem das coordenadas estão conferidos no ambiente inicial. Mudança de tamanho/DPI continua simulada; não há aprovação humana de inventário nem percurso completo aceito. Não repetir os ensaios por rotina. O próximo passo é a [primeira transição real](zzz-transition.md), sem implementação adicional antes de medir seu comportamento.
