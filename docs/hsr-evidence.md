# HSR — evidências e investigação

## Inicialização do primeiro piloto — 03/11/2026

Cristian informou a parada em `.cache/hsr/runs/20261103-200333-eadb83c9-selection`. O processo já havia encerrado: `exit-code.txt=2`, somente log e recibo presentes, sem manifesto ou captura. O leitor não chegou à espera por F8.

Confirmada falha em `scan-hsr.ps1`: uma expressão `if` desembrulhava o array inicial de um elemento em `string`. O `+=` posterior concatenava o caminho do script e os argumentos em uma única string, produzindo chamada nativa inválida. A correção mantém o array por fora da expressão. O log também passa a preservar stderr nativo antes de registrar e avaliar o código de saída; antes, a janela mostrava somente a mensagem genérica do adaptador.

Cinco testes do lançador passaram em 5,18 s com Windows PowerShell: roteamento do app, recusa de diretório existente, processo nativo real recebendo os seis argumentos separados nos modos repositório/portátil (caminho com espaços/apóstrofo) e preservação de stderr/código 2 em falha nativa. O executável de teste só imprime argumentos; não captura nem envia inputs. Isso corrige a inicialização, mas não valida o perfil vivo, OCR ou avanço HSR. Os arquivos da tentativa foram preservados; aguarda-se o piloto de três posições após a correção.

## Primeiro frame HSR 1280×720 — 03/11/2026

Tentativa `.cache/hsr/runs/20261103-201719-b34c349e-selection`: F8 confirmado, cliente 1280×720/DPI 96 e integridade compatíveis, saída 1 por `selection-delivery-or-panel-stability-unconfirmed`. Zero D/cliques/rolagens, nenhuma observação registrada. Manifesto e `unconfirmed-start.png` preservados; imagem SHA256 `c71f9aa945de3ed3759a14219b690c33305a77f497ec9dcfb34256747da351ef`.

O primeiro cartão está selecionado com borda em `[91,90,91,108]` (x,y,largura,altura). O detector começava em 15% da altura (y=108), cortava o topo da borda e devolvia seleção ausente. Corrigida somente a região de busca para manter a borda inteira, preservando tamanho/formato, quatro lados e unicidade. Os limites da seleção inicial foram restringidos para rejeitar segunda coluna/linha; a espera agora distingue seleção ausente/ambígua, avanço não confirmado e painel instável, com evidência no manifesto.

Replay da mesma imagem também mostrou o ícone do Caminho entrando no recorte da frase e caracteres decorativos no recorte da ordenação. Ajustados o recorte textual do Caminho e o rótulo de ordenação; sem flexibilizar concordância/valores. A imagem passa a confirmar nome **On the Fall of an Aeon**, nível **80/80** e sobreposição **5**, sem nova captura/inputs. O rótulo real é **Rarity**, rejeitado corretamente para o corte por nível; próxima tentativa requer mudar para **Lv decrescente** e selecionar o primeiro Cone no topo.

Replay técnico em `.cache/hsr/analyses/20261103-start-selection-b34c349e/replay.json`. A repetição de um único frame confirma geometria/leitura nesse arquivo; não demonstra estabilidade de uma sequência viva nem entrega da próxima seleção por D. Piloto de três posições permanece pendente.

## Ordenação e nível 80 — 04/11/2026

Sessão `20261104-112817-c395b86c-selection`, encerrada com saída 1 por `prepare-Light-Cone-tab-and-Lv-sort`: zero observações e zero D/cliques/rolagens. `before.png` (SHA256 `a11a50d4111ecc0d476f0f739ce29d4e80e65ad82254c13d5ff244a65781f91d`) mostra **Rarity**, confirmado pelas duas leituras do cabeçalho. O nível máximo 80 já é aceito; a parada ocorreu antes de ler os campos dos Cones.

Replay offline dessa imagem reconheceu literalmente `80/80` nas duas variantes, mas revelou uma falha independente na âncora do painel: o fundo translúcido interferia na frase e no nome dourado do Caminho. O perfil 16:9 agora recorta somente a frase branca fixa completa `The following effects only work on characters of the Path of`, com limiares 170/180; mantém concordância de duas leituras e exige a frase inteira. Não extrai nem deduz o Caminho. O perfil legado mantém seu contrato anterior.

Após o ajuste, as duas imagens reais já preservadas confirmam âncora, **On the Fall of an Aeon**, **80/80** e sobreposição **5**; ambas continuam rejeitando Rarity. Replays antes/depois em `.cache/hsr/analyses/20261104-preparation-c395b86c/`. Passaram 37 testes HSR/leitor/lançador em 11,21 s. Nenhuma nova captura ou input durante o diagnóstico, sem alteração dos originais ou aprovação humana dos campos. Ainda falta piloto vivo com **Lv decrescente**, confirmação dos avanços por D e validação do portátil.

## Primeiro avanço real por D — 04/11/2026

Sessão `20261104-113747-49388685-selection`: rótulo **Lv.** confirmado nas duas leituras, cliente 1280×720 e integridades compatíveis. Três posições capturadas, dois pedidos D com liberação registrada, zero cliques/rolagens e nenhuma falha de guarda. Bordas selecionadas em `[92,90,90,108]`, `[184,90,91,108]` e `[277,90,91,108]`, com nomes distintos nos respectivos painéis. Isso confirma os dois avanços, sem comprovar ainda troca de linha ou corte 20+.

O original encerrou com saída 1, `light-cone-panel-anchor-unconfirmed` na terceira posição. A frase branca estava correta, mas o nome dourado **The Hunt** começava na mesma linha e gerava `|` em uma variante. Na segunda posição, o recorte apertado da sobreposição gerava `1.` em ambas. A correção separa pixels coloridos antes de preparar a âncora branca e acrescenta margem branca na leitura do dígito; não tolera texto extra, não usa catálogo e não inventa valores.

Replay separado em `.cache/hsr/analyses/20261104-delivery-49388685/`, sem inputs ou novas capturas:

| Posição | Nome literal | Nível | Sobreposição após ajuste |
|---|---|---|---|
| 1 | On the Fall of an Aeon | 80/80 | 5 |
| 2 | Thus Burns the Dawn | 80/80 | 1 |
| 3 | Cruising in the Stellar Sea | 80/80 | 5 |

Os três arquivos mantêm os hashes do manifesto original: `57b0bedc9b579f519264bc30985760721fbebf6c357d8cbbd7b20e9e7621225e`, `2e3f58a51afc26c0b00aebe431a5701267808578efabc820d4a1258c4f5e0b1c`, `0c0af403c322282a57cb508f20dfefe3a2763e676faa12d79be56fe82c37db35`. O replay do percurso com esses frames termina no limite de três, com três elegíveis, sem campos pendentes e sem alegar cobertura. O original permanece parcial, sem reescrita ou aprovação humana. Próximas validações: percurso ampliado incluindo troca de linha/corte 20+ e portátil.

Verificação da entrega: 138 testes passaram em 73,18 s, cobrindo leitor/percurso/lançador HSR, formulário com loop real, lançadores/portátil ZZZ, guardas/parada externa, gravação e processamento diferido. Os dois frames HSR anteriores também continuam reconhecidos após o filtro de cor/margem. São testes/replays, sem nova aquisição ZZZ/HSR ou medição de precisão. Não há changelog no projeto; versão 0.1.0 mantida nesta entrega em validação.

## Percurso ampliado — implementação de 04/11/2026

Cristian confirmou “Validado os 3 cones estão corretos.”, referindo-se aos três nomes/níveis/sobreposições exibidos no replay. Revisão separada em `.cache/hsr/analyses/20261104-delivery-49388685/human-review.json`, vinculada por hash ao original, replay e imagens; nove campos confirmados nessas posições, sem aceitar o inventário inteiro ou transferir a confirmação para outra sessão.

A janela deixa o limite piloto de três e passa a encaminhar 2000 posições como limite de segurança do executor já existente. O término útil continua no primeiro nível confiável abaixo de 20, sem níveis pendentes ou contradição de ordem; contador não comprova fundo físico. O resumo identifica explicitamente a posição/nível fora do escopo que causou o corte, sem incluí-la entre os elegíveis.

Simulação de 41 posições com detecção/espera reais em imagens sintéticas, teclado stub e relógio controlado: 40 elegíveis (incluindo nível 20), 40 D liberados, trocas de linha e permanência da linha selecionada durante deslocamento da lista; posição 41 nível 1 encerra, 211 posições restantes não lidas por ordenação. Testes rejeitam salto de linha, coluna incorreta e seleção sem avanço. Isso não substitui validação desses movimentos no jogo.

O worker permite anexar uma imagem salva ao `--self-check` para conferir o leitor HSR congelado sem captura/input; o caminho antigo de self-check e o lançamento ZZZ são preservados. A montagem é nova, sem substituir pacotes ou resultados anteriores. O teste vivo seguinte deve usar a pasta exata indicada da montagem, com a janela antiga fechada; conferir percurso e pacote juntos, sem repetir um piloto curto por rotina.

Passaram 70 testes distintos: percurso/leitor/interface (64 casos em 66,27 s), lançador/self-check (sete em 4,09 s, cinco já presentes no primeiro grupo) e portátil (quatro em 1,08 s). `git diff --check` sem erros. Versão 0.1.0 mantida; segue sem changelog no projeto.

Build `20261104-115200-d27a0d9d`, ZIP SHA256 `08393632033e524e767501a1219854cd6161b046f10f80598716cef5c53f345a`, 313.512.136 bytes. Extraído sem sobrescrita para `D:\Repo\gacha-ocr-lab\.cache\hsr-ready-20261104\gacha-ocr-zzz`; 632 hashes e hashes dos módulos comparados ao fonte, sem divergências. Sem sessões pessoais. Checagens EXE/PowerShell e três imagens pelo worker congelado passaram com PATH restrito, sem Python de desenvolvimento no caminho, sem captura/input. Registro em `.cache/hsr/analyses/20261104-expanded-portable/verification.json`. Esta é validação offline/relocação; troca de linha, corte 20+ e coleta pelo portátil continuam pendentes no jogo.

## Borda direita e correção A/S — 04/11/2026

Sessão portátil `20261104-115815-5d673308-selection`: oito observações elegíveis, nível 80/80 e três campos reconhecidos em todas; zero níveis ou campos pendentes, zero cliques/rodas, oito pedidos D/liberações. A oitava tentativa não deslocou a seleção `[741,91,91,107]`; saída 1, `selection-advance-unconfirmed`, guardas sem falha. Imagens/manifesto preservados e 632 arquivos do pacote íntegros. Diagnóstico separado em `.cache/hsr/analyses/20261104-first-row-5d673308/diagnosis.json`.

Cristian pressionou D manualmente e confirmou que permanece no oitavo Cone, com W/A/S disponíveis. Observação humana separada em `manual-navigation-observation.json` na mesma análise; não aprova campos OCR nem indica fundo da lista. O inventário continua nas linhas inferiores. A hipótese anterior de D trocar automaticamente de linha estava errada; a simulação de D com wrap não validava esse comportamento do jogo.

Correção: o perfil de oito colunas usa D até a borda, retorna com sete A pela linha já lida e então usa S na primeira coluna. Assim, uma última linha curta não faz S cair numa coluna inexistente. Retornos não geram observações duplicadas nem alteram os níveis observados; cada tecla exige guarda, liberação e confirmação direcional/estabilidade antes da seguinte. Quando S mantém o contorno por deslocamento do viewport, exige também translação ascendente de uma linha na grade; painel diferente ou contorno estático sozinho não basta. Falha mantém parcial e imagem de diagnóstico. Orçamento de teclas inclui os sete retornos por linha; `navigationSteps` registra os movimentos confirmados.

Passaram 85 testes em 57,01 s, incluindo navegação/leitor/lançador HSR e parada/manifesto/guardas compartilhados com ZZZ. O stub agora bloqueia D na borda; percurso de 41 posições usa 75 teclas liberadas, registra 40 elegíveis incluindo nível 20 e encerra na posição 41 nível 1, com duas translações simuladas. Parada no primeiro A preserva as oito observações e não envia S; testes rejeitam direção errada, teclas fora da lista e grade estática como prova de deslocamento. Isso ainda não valida A/S/viewport/corte no jogo.

Novo build `20261104-121056-ec073490`, ZIP SHA256 `50248969470320feb32e75f7a59db1b23ca712cc64813c01d712dfc4659dcb3a`, 313.517.239 bytes. Extraído sem sobrescrita em `.cache/hsr-ready-20261104-asd/gacha-ocr-zzz`; 632 hashes e fontes do leitor conferidos. Worker congelado, com PATH restrito, reproduziu os três campos das oito imagens preservadas, sem captura/input; entrada EXE e checagem PowerShell passaram. Registro em `.cache/hsr/analyses/20261104-asd-portable/verification.json`. Pacotes/sessões anteriores preservados; para o teste vivo, fechar a janela antiga e usar a nova pasta `-asd`. Sem changelog encontrado, versão 0.1.0 mantida no mesmo recorte HSR.

## Scroll parcial e percurso alternado — 04/11/2026

Sessão portátil `20261104-134137-122ef151-selection`: 32 Cones elegíveis, todos níveis 80/80 legíveis, três mudanças de linha confirmadas. Quatro campos incertos no original (nomes nas posições visuais 10, 23, 28; sobreposição na 16), sem aprovação humana adicional. Após 60 teclas, a transição S da posição visual 32 para 33 parou por `selection-advance-unconfirmed`: contorno de `[92,437,90,107]` para `[92,475,90,107]`, movimento de 38 pixels combinado com grade subindo 77, total de uma linha (115). O programa só aceitava S sem scroll ou contorno praticamente parado com scroll de linha inteira. A parada preservou os dados; não houve falha de foco ou de leitura de nível.

Correção exige contorno + translação da grade compatíveis com uma linha, procurando o deslocamento próximo ao esperado. Confirma forte redução do erro entre frames e correspondência em pelo menos seis de sete faixas da grade, tolerando as diferenças de rasterização após deslocamento fracionário. Replay do par salvo confirmou 77 pixels de grade + 38 de contorno; é evidência desses arquivos, não validação de todas as rolagens possíveis. A captura anterior a cada S passa a ser gravada com hash para diagnosticar novas transições.

Cristian sugeriu ler as linhas em sentidos alternados e reforçou incluir Cones 3★ upados. Implementado D → S → A → S, sem voltar sobre itens já lidos. `position` mantém o índice visual; `acquisitionIndex` registra a ordem real. Tabela ordenada pela posição visual. Ordenação dos níveis é conferida por posição, aceitando o crescimento natural na linha reversa. **Linha reversa com níveis abaixo de 20 deve terminar antes do corte**, preservando elegíveis à esquerda; um nível pendente impede declarar cobertura. A linha normal ainda pode cortar no primeiro abaixo de 20. Raridade não é extraída nem filtra os dados; preparação/instruções agora pedem filtro de estrelas desligado para observar também 3★20+.

Passaram 153 testes em 121,15 s: leitor/navegação/lançadores HSR, janela com loop real e regressões de lançador/portátil/guardas/gravação ZZZ. Casos incluem linha reversa com níveis mistos, pendência nessa linha, última linha curta com ajuste de coluna, S parcial de 78 pixels, grade estática, salto de duas linhas e mudança só no painel. Em 41 observações, a simulação requer 40 teclas, sem retornos extras; isso não mede desempenho real.

Replay das 32 imagens originais e da imagem de avanço não confirmado, reorganizadas por posição em percurso alternado: 33 observações, 32 teclas de stub, transição S aceita até **Eyes of the Prey 80/80**, sobreposição ainda incerta (`a`/`4`). Todos os valores dos três campos das 32 observações originais foram preservados, inclusive suas pendências; nenhum original reescrito ou inventário aceito. Registros em `.cache/hsr/analyses/20261104-partial-scroll-122ef151/replay.json` e `.cache/hsr/analyses/20261104-alternating-real-frames-122ef151/`. Relógio controlado e frames repetidos não comprovam estabilidade viva ou novos inputs.

Build `20261104-140013-0fc2da2b`, ZIP SHA256 `de9a8baa906d0a9f07fd1810d50332c91501b53eb9eeb7681e55bd3d870e0e57`, 313.519.989 bytes. Extraído sem sobrescrita em `.cache/hsr-ready-20261104-zigzag/gacha-ocr-zzz`; 632 arquivos e hashes dos módulos conferidos. Self-check, entrada EXE/PowerShell e quatro imagens no worker congelado passaram com PATH restrito, sem captura/input. Registro em `.cache/hsr/analyses/20261104-zigzag-portable/verification.json`. Pendentes no jogo: percurso alternado, scroll corrigido e corte útil com inclusão dos 3★20+. Versão 0.1.0 mantida no mesmo recorte, sem changelog no projeto.

## Compartilhamento do log e segunda translação — 04/11/2026

Cristian informou `Falha ao acompanhar log` por arquivo em uso na sessão `20261104-141700-2d5dc172-selection`. Scanner já encerrado com saída 1, `selection-advance-unconfirmed`: 40 elegíveis, 40 pedidos de tecla, nenhum nível pendente ou falha de guarda. Cinco campos incertos preservados (nomes nas posições 10/23/28 e sobreposições 16/33). A solicitação `stop.request` da janela foi gravada após o encerramento do manifesto; `externalStop.observed=false`. Portanto o erro do acompanhamento não foi o motivo de parada registrado pelo scanner.

O leitor WinForms tratava qualquer falha de abertura como definitiva e solicitava parada. Agora apenas violações Windows de compartilhamento/bloqueio (32/33) adiam a leitura para o próximo timer, sem sleep, avanço de offset ou alteração do decoder. Mesmo após a saída do filho, aguarda a drenagem real. Uma espera contínua de cinco segundos ainda falha pelo caminho existente; outros erros não são mascarados. Teste com `FileShare.None` protege BOM, caractere UTF-16 dividido e drenagem final. Outro teste usa formulário/loop reais e filho separado segurando o arquivo exclusivamente: seis mensagens recuperadas, janela responsiva, resultado completo e nenhuma solicitação de parada.

A segunda translação falhou com contorno inalterado `[741,495,91,107]`. Imagens exatas antes/depois de S mostram grade subindo 115 pixels e painel **River Flows in Spring**; a comparação ampla anterior era contaminada por fundo/bordas e rejeitava esse par. A confirmação passa a comparar medianas no interior das cartas, fora de bordas/distintivos e fundo, exigindo pelo menos 12 recortes, seis colunas e duas linhas, com forte melhora em relação aos mesmos recortes sem deslocamento. Nenhum valor OCR ou identidade de cópia é deduzido desses recortes.

Replays dos pares reais: 56 pixels de grade + 59 de contorno (23 recortes/oito colunas/três linhas); 115 + 0 (22 recortes/oito colunas/três linhas); par anterior 77 + 38 (23 recortes). Os originais permanecem preservados. São verificações desses arquivos; não comprovam todos os scrolls futuros ou novo percurso no jogo.

Passaram 102 testes distintos: janela/leitor HSR (70 em 102,13 s) e lançadores/portátil (32 em 17,46 s). Build `20261104-142613-793216e4`, ZIP SHA256 `7cca3f8e323919f30310727f917fe17f3c2be37689da7ea1675a7052364d318a`, 313.521.437 bytes. Candidato extraído sem sobrescrita em `.cache/hsr-ready-20261104-logfix/gacha-ocr-zzz`; verificação em `.cache/hsr/analyses/20261104-logfix-portable/verification.json`. Pendentes no jogo: avançar além dos 40 e chegar ao corte 20+ pelo novo pacote. Sem nova coleta nesta correção; versão 0.1.0 mantida, sem changelog no projeto.

## Percurso até o corte e reprocessamento literal — 04/11/2026

Sessão `20261104-144540-a26ced48-selection`, pela pasta `hsr-ready-20261104-logfix/gacha-ocr-zzz`: saída zero, 68 observações, 66 elegíveis, 67 movimentos (D/A/S), oito mudanças de linha e cinco translações de grade confirmadas. Sem falha de guarda/monitoramento ou seleção. Imagens preservam Cones 3★ upados, inclusive Arrows/Chorus 20/20; raridade continua sem campo OCR ou aprovação humana. O original terminou `inventory-inconclusive`, `level-cutoff-with-unresolved-levels`, pois Shadowburn na posição 67 teve `9/20`/`5/20`; posição 68, Time Waits for No One, foi reconhecida em 1/20. Não declarar o original completo.

Inspeção da imagem da posição 67 mostra 5/20; o tratamento nativo de nível foi ajustado de 130/140 para 140/150, mantendo dois valores literais concordantes e sem mapear 9 para 5. Nas imagens salvas confirma 5/20 e preserva os níveis antes reconhecidos. Também tratados dois artefatos de nomes: equivalência de apóstrofos tipográficos com ASCII (sem inserir pontuação ausente) e tentativa adicional quando o sublinhado gera `|`. Essa tentativa remove seis pixels inferiores e exige duas leituras concordantes com uma leitura primária literal. Bruto, candidatos e leituras suplementares ficam registrados; nenhum catálogo, score ou aprovação humana é usado.

Replay completo do executor nas imagens, com teclado stub e relógio controlado, em `.cache/hsr/analyses/20261104-literal-reprocessing-a26ced48/`: encerra na posição 67 nível 5, 67 observações/66 elegíveis e zero níveis pendentes; 66 pedidos simulados, zero inputs reais. Nove campos antes incertos resolvidos (oito nomes e um nível); todos os valores anteriormente reconhecidos até o corte preservados. **Restam cinco campos:** nomes nas posições 23/28/41 e sobreposições nas 16/33. Original de 68 observações continua intacto e referenciado por hash; `mode=hsr-replay`, `offlineReplayOnly=true`, `inventoryAccepted=false` distinguem a saída derivada de uma nova coleta. O resumo explicita reprocessamento offline.

Passaram 57 testes em 53,65 s, cobrindo HSR/leitor/lançador e normalização sem inventar apóstrofos, retirada do sublinhado preservando bruto e rejeição de leituras suplementares contraditórias ou divergentes do literal primário. Isso é desenvolvimento/replay, não uma avaliação independente de precisão. Navegação/log/corte estão conferidos no fluxo local; os cinco campos restantes requerem revisão pontual nas imagens, sem nova aquisição por rotina.

Build `20261104-145627-b5230182`, ZIP SHA256 `14cb792eb482b2ae6f079e6e5f28585c02c91eaa68831b78ce98eb84eaa31d3f`, 313.521.415 bytes. Nova pasta `.cache/hsr-ready-20261104-ocr/gacha-ocr-zzz`, sem substituir pacotes/resultados anteriores. Verificação em `.cache/hsr/analyses/20261104-ocr-portable/verification.json`; ajuste OCR conferido offline, sem nova coleta pelo pacote. Versão 0.1.0 mantida no mesmo recorte; sem changelog encontrado.
