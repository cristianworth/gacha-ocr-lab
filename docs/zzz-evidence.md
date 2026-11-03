# ZZZ — evidências e histórico de investigação

Registro técnico, sem novos pedidos de teste. Para uso normal, siga o [guia ZZZ](zzz-scan.md); próximos passos ficam somente no [ROADMAP](ROADMAP.md). Sessões, imagens e revisões citadas estão no cache local e não acompanham o clone. Os números demonstram os recortes descritos, não a precisão geral do OCR.

## Primeiro uso da interface ZZZ — 02/11/2026

Sessão `D:\Repo\gacha-ocr-lab\.cache\desktop-ready\gacha-ocr-zzz\.cache\youkai-p1\runs\20261102-213358-ac9ca5c4-selection\session.json`, SHA256 `3c4110f009729df787d18375b25f8619a1d6912ba22d6fad73569718817b92bc`. Pacote `20261102-212533-c72eee8e`, ZIP SHA256 `afb2d198ee774eaab6d459e149811cb787b61536c30658421f6c1f0b4e7317b7`. A entrada `gacha-ocr-zzz.exe` chama o CMD adjacente, que abre a janela PowerShell/WinForms. Cristian confirmou explicitamente UAC, término claro e abertura do resumo pelo botão **Abrir resultado**.

- Saída zero, fase finalizada, `scope-captured`/`level-cutoff-reached`: 34 elegíveis lidos, 35 posições observadas, 34 cliques e uma roda. Zero níveis/seleções/processamentos pendentes ou falhas. Corte na posição 35, nível 0, com ordenação declarada e sem contradição observada.
- `scopeComplete`/`coverageConfirmed` verdadeiros; `captureComplete=false`, `endOfInventory=null`, `inventoryAccepted=false`. O cabeçalho 1567 é o total observado da lista preparada, sem validação independente de S/A. As 1532 posições restantes não foram lidas individualmente.
- Os valores **e estados** dos cinco campos dos 34 itens coincidem com a sessão final de performance `20261102-193652-86205124-selection`. Os nomes humanos 14/25/34 continuam incertos no bruto; confirmações anteriores não foram transferidas. A comparação não é uma avaliação independente de precisão.
- Conferidos 400 hashes de imagens referenciadas, oito módulos e os 622 arquivos do pacote, sem divergências. Gravador em segundo plano: 365 imagens submetidas/gravadas, zero pendências/erros, pico de duas na fila. Sem erro de cleanup; OCR nativo. Acompanhamento só por log durante atividade; manifesto lido após código de saída e fim do worker.
- Parada externa durante F8/preparação/aquisição e fechamento têm testes do CLI com desktop simulado e processo filho de stub; o worker congelado também reconheceu parada antes do início, sem inputs. **Interromper/X não foram acionados nesta coleta real** (`externalStop.observed=false`). Não repetir aquisição/guardas por rotina nem apresentar essas simulações como uma interrupção real no jogo. Performance não foi reaberta.

Revisão técnica separada em `.cache/youkai-p1/analyses/20261102-desktop-live-ac9ca5c4/review.json`. Após abrir o resumo, Cristian confirmou somente o nome da posição 34 como **“Demara Battery”**. `name-review.json` preserva esse texto exato, vínculo/hash do original e imagem; nenhum sufixo ou identificador de catálogo foi inferido. `reviewed-summary.md` aplica essa confirmação apenas à cópia. Os demais nomes/campos continuam do OCR, sem aceite humano global. Manifesto e resumo originais preservados por hash. Nada foi aplicado ao Advisor.

P3.6 concluído no fluxo local de abrir/coletar/acompanhar/resultado. 116 casos automatizados focados passaram; montagem, relocação e self-check sem inputs conferidos. O pacote testado foi preservado com seu README do momento do build (que ainda descrevia a validação real como pendente); os documentos-fonte agora registram o resultado, sem remonta ou nova coleta por alteração documental. Sem push/publicação remota; outra máquina não foi testada.

## Revisão humana dos nomes — 29/10/2026

A coleta curta sinalizou somente três nomes. Cristian confirmou explicitamente, apenas para esses campos:

| Posição | Nome confirmado | Outros valores registrados pelo OCR |
|---|---|---|
| 14 | Marcato Desire | 60/60, A, progressão 5, travado |
| 25 | Weeping Gemini | 60/60, A, progressão 1, travado |
| 34 | Demara Battery Mark II | 40/40, A, progressão 2, travado |

Confirmação em `.cache/youkai-p1/analyses/20261029-name-confirmation-63e0e42b/name-review.json`; cópia revisada `reviewed-summary.md` na mesma pasta. O JSON e o resumo bruto foram preservados por hash, e não houve aprovação global dos outros campos. As leituras visuais iniciais e os seis painéis amostrados (posições 1/14/23/25/29/34) estão em `.cache/youkai-p1/analyses/20261029-focused-review-88e49d34/review.md`. Não houve outra divergência observada nessa amostra; ela não mede precisão geral.

### Caminho curto real — 29/10/2026

Manifesto preservado: `.cache/youkai-p1/runs/20261029-152830-40df8371-selection/session.json`, SHA256 `c9b7a7023dd81171eb6352bc3fab3666e0b4104154e2f35bb09d3c47ce5ad1c2`. Resultado `scope-captured`, motivo `level-cutoff-reached`, saída zero. As posições 1–34 foram lidas; a posição 35 confirmou nível zero e encerrou a coleta sem clique. Foram 34 cliques e uma roda verificada, com 83 posições restantes não lidas por ordenação. `scopeComplete` e `coverageConfirmed` são verdadeiros; `captureComplete` é falso e `endOfInventory` permanece sem confirmação. A declaração de Level decrescente é do usuário; o seletor não foi verificado automaticamente.

Conferidos 194 hashes de imagens e cinco módulos; os cinco campos dos 34 elegíveis mantêm os valores/estados da sessão completa de 28/10. Nenhum nível/seleção pendente; os mesmos três nomes permanecem incertos. `summary.md`, `review.html` e manifesto estão na pasta da sessão. Revisão do assistente, sem aprovação humana, em `.cache/youkai-p1/analyses/20261029-levelcut-live-f030e0bc/review.json`. Duração da sessão bem-sucedida: aproximadamente 124 s, incluindo preparação; não atribuir isso a um benchmark controlado. Nada foi aplicado ao Advisor.

**Falha de gravação corrigida antes da execução válida:** `20261029-152449-ec53b3a1-selection` parou com dez leituras e a posição seguinte falha, sem roda, por `WinError 5` ao substituir `session.tmp` por `session.json`. Uma reprodução local confirmou que um leitor aberto sem compartilhamento de exclusão pode causar esse erro no Windows. O acompanhamento estava lendo o manifesto durante a gravação; passou a ler somente `console.log` até `exit-code.txt` existir. `save_report` mantém a substituição atômica, com até cinco tentativas somente para erros Windows 5/32/33 e esperas somadas de 0,375 s. Bloqueio persistente continua falhando com o JSON anterior e o temporário preservados; outros erros não são repetidos. Três testes focados de arquivo e um teste de integração passaram. As guardas de inputs não foram alteradas e a tentativa original permanece preservada.

### Primeiro percurso completo — 28/10/2026

Sessão `.cache/youkai-p1/runs/20261028-185740-399e71f1-selection/session.json`, SHA256 `049a883cbd399e21d6bbea70592c1d010d626dff7eea22feaa91e5bea261333c`. Perfil inglês, cliente 1280×720/100%, lista S+A preparada por Cristian e corte 20. Resultado: `inventory-captured`, motivo `inventory-end-confirmed`, saída zero. As 118 posições são contíguas e distintas; dez transições verificadas e 52 cliques. Resumo: 34 elegíveis, 84 abaixo de 20, zero níveis ou seleções pendentes. Das exclusões, 66 ocorreram antes do clique/OCR detalhado e 18 depois da leitura do painel. Três nomes permanecem incertos, nos índices 13/24/33 (posições 14/25/34).

A última tela contém 28 cartões e oito EMPTY. O cartão isolado final, posição 118 (índice 117), foi registrado com duas leituras `Lv.0`, sem clique. `captureComplete`, `coverageConfirmed` e `endOfInventory` são verdadeiros; `inventoryAccepted` permanece falso. O assistente conferiu hashes de 322 imagens e cinco módulos e inspecionou início/meio/fim. A comparação das primeiras 108 posições com 26/10 não encontrou mudanças nos campos ou decisões registrados. Revisão separada em `.cache/youkai-p1/analyses/20261028-inventory-first-complete-674512a7/review.json`, com `humanApproved=false`. O manifesto original permanece intacto e nada foi aplicado ao Advisor.

Esta primeira coleta completa resolve a falha real de estabilização neste perfil e fornece a base para revisão de P3.3-B. Não mede precisão geral de OCR nem prova listas vazias/curtas, outros tamanhos/DPI ou níveis 20–39 em imagens reais. A coleta curta posterior aproveitou essa referência; o [ROADMAP](ROADMAP.md) mantém o próximo passo, sem exigir outra travessia completa por rotina.

### Coleta integrada de 26/10 e correção da parada

Manifesto preservado: `.cache/youkai-p1/runs/20261026-213337-5baaf3b0-selection/session.json`, SHA256 `330b67e9d0c744a2383411298a5d06bff6d2bf485a7468cf447a6b0e52446f38`. Foram processadas 108 posições distintas, com 50 cliques e dez rodas solicitadas (nove transições verificadas). Resultado parcial: 34 elegíveis, 74 abaixo de 20, zero níveis pendentes e três nomes incertos. Das exclusões, 58 ocorreram antes do clique/OCR detalhado e 16 depois da leitura do painel. As últimas dez posições não foram processadas; nada foi aceito ou aplicado ao Advisor.

A última roda chegou ao fundo normal, com 28 cartões e oito EMPTY. A parada `viewport-not-stable-within-4-seconds` foi causada pela comparação do cabeçalho amplo, que incluía cenário animado acima do texto. Nos frames finais, a diferença dessa região excedia 2,5, enquanto a barra ficava imóvel. A correção em `zzz_transition.py` compara o rótulo `(20,120,560,155)` nas coordenadas de referência, mantendo a grade, a barra, os mesmos limiares, prazo e guardas. Não exige seleção ou painel para estabilizar a lista.

O replay dos nove frames da última roda confirma a estabilização com o recorte corrigido. O observador também reconstrói as dez telas já verificadas e mapeia a tela final às posições restantes 108–117 (índices zero-based), todas selecionáveis. Isso verifica geometria e término observado, sem inventar leituras dos dez itens ausentes ou alterar o resultado original. Testes sintéticos continuam recusando grade, contador ou barra em movimento e aceitando lista vazia/painel independente. São oito verificações focadas aprovadas; a suíte inteira não foi repetida.

## Parada repetida antes da posição 46 — diagnóstico de 23/10/2026

Sessões `.cache/youkai-p1/runs/20261023-101045-ac61dc4d-selection/` e `20261023-101543-ad9b1eb4-selection/`, ambas no código `99fbfa2`: 45 posições processadas, 45 pares de pressionamento/liberação e três rodas solicitadas; duas transições aceitas, terceira interrompida com `selection-or-panel-not-stable-within-4-seconds`. As 45 leituras ficaram preservadas e não houve erro de cleanup.

Na terceira roda, a grade realmente avançou uma linha e o scrollbar desceu de 246 para 249; a sobreposição confirmou o movimento. O detector antigo observava só a faixa superior de cada cartão. Etiquetas amarelas NEW! na quarta linha foram interpretadas como seleções adicionais (27, 30, 33 e 34), junto da seleção real 17. O painel estava estável, com diferença de pixels zero; a alternância entre `[17]` e vários candidatos impediu o estado pronto por quatro segundos. Aumentar o prazo não corrige esse defeito.

O perfil v3 exige amarelo no topo **e na lateral esquerda** do contorno. No replay, ambas as sequências chegaram à seleção correta e estável no terceiro frame pós-roda, preservando as seleções das 90 imagens de itens já lidas. Foram conferidos os hashes de 227/225 frames, imagens por posição e transição e versões do leitor. Revisões separadas em `scan-review.json`, vinculadas aos manifestos originais. Isso comprova a correção sobre a evidência existente; as nove posições seguintes não foram capturadas/lidas ao vivo.

Os brutos também demonstraram nível inicial `Lv. 00/10`: o parser passou a aceitar zero. A identidade literal completa `Drill Rig - Red Axis` com `DrillRigRedAxis` passa a ser aceita com score original 95, sem alterar o texto nem relaxar correspondência para nomes parecidos. Reinterpretar os brutos corrige 11 níveis e esse nome por sessão; três outros nomes continuam incertos. Brutos/manifestos antigos permanecem intactos. Não há atualização de conta nem aprovação humana automática.

As regressões locais passaram com o perfil v3 (123 casos, incluindo os cenários integrados anteriores). Essa conferência foi concluída posteriormente na sessão de 54 posições abaixo. Não repetir o prefixo, NEW!, nível zero ou clique/roda por rotina; seguir ao escopo/fim conforme o [roadmap atual](ROADMAP.md).

## Cadência observada em 23/10/2026

Nas duas execuções, a mediana entre pressionamentos foi 2,54 s e 2,41 s. Do pressionamento ao último frame estável registrado: 1,00 s e 0,99 s. Do frame estável ao próximo pressionamento: 1,54 s e 1,41 s. Esses intervalos misturam espera do jogo, processamento, PNG/JSON/HTML e movimento do mouse; não isolam uma medida exata de OCR ao vivo.

O caminho atual é serial: movimento/click público Youkai, confirmação por frames consecutivos por pelo menos 0,25 s, OCR adaptado e releituras quando necessárias, comparação adicional com o leitor original e gravação extensa de evidências. O timeout de quatro segundos é o limite para confirmação, sem ser uma pausa fixa por item.

Um replay offline de quatro imagens na máquina deste chat mediu 1,36–2,41 s por `read_frame`, dos quais 0,58–1,05 s pertenciam à comparação upstream. Esse ensaio inclui OCR/crops e tem carga/condições diferentes da coleta; não é benchmark da versão final nem previsão de ganho. Dados em `20261023-101543-ad9b1eb4-selection/offline-timing/profile.json`.

A versão final deve manter a confirmação de painel correto; há espaço para reduzir comparação duplicada e escrita de diagnóstico no caminho normal e separar melhor captura/processamento. Essas otimizações ainda não foram implementadas/medidas. Não há garantia de velocidade equivalente a outro scanner; a prioridade desta correção é concluir o percurso. A medição/otimização acompanha o produto sem criar outra rodada de ensaios manuais isolados.

## Percurso de 54 posições concluído — 23/10/2026

Sessão `20261023-103911-485104ab-selection`, código `906e7b0`: 54/54 posições, três transições verificadas, 54 observações S/A, sem falhas. Permanecem três nomes incertos (posições de índice 13, 24 e 33); nenhum nível ficou incerto. Hashes de todos os frames e das 54 imagens conferidos, com seleção correspondente em cada imagem e versão do código verificada. Revisão separada vinculada ao manifesto original, sem aprovação humana automática ou conferência manual dos campos de todos os itens. Isso aceita o recorte, sem provar fim/contagem S/A global.

## Linha com NEW! e cópias conferida — 23/10/2026

Sessão `20261023-105454-c3458594-selection`, código `1613e83`: `row-read`, `selected-row-end-reached`, 9/9 posições, oito cliques e nenhuma roda. Começou na primeira coluna da primeira linha visível, longe do topo; scrollbar 259,5 permaneceu igual e as nove verificações de viewport confirmaram a mesma grade.

Cartões NEW! nas colunas 4, 7 e 8, intercalados com normais, não foram confundidos com seleção. Housekeeper ×3, Starlight Engine Replica ×3, Drill Rig - Red Axis ×2 e Steam Oven ×1 ficaram em observações separadas. Nome, A, nível 0/10, progressão 1 e travado conferem visualmente nos nove painéis; sem campos incertos ou posições falhas nesta linha.

Hashes de 40 frames, nove imagens de posição e imagens inicial/final conferidos; destaques das nove posições reproduzidos offline, quatro módulos correspondentes ao commit e 260 arquivos upstream íntegros. Revisão separada em `row-review.json`, vinculada ao hash do manifesto original. Revisão do assistente, sem aprovação humana automática. Não demonstra exclusão B, item destravado, cobertura ou fim do inventário.

O diagnóstico da linha está encerrado. Não repetir a linha nem o prefixo de 54 por rotina; usar o [guia atual](zzz-scan.md) e o [ROADMAP](ROADMAP.md).

## Referências agrupadas de filtro e fundo — 24/10/2026

Referência agrupada: `.cache/youkai-p1/runs/20261024-guided-tail-2e081b07/session.json`, SHA256 `44c90633d2368af6fc19f0d14e3bc14d741f78e3fbbe8907b392322dee6b6014`, com revisão separada `reference-review.json`. Conferidos novamente os hashes das sete imagens e dos quinze frames da continuação. Versão do jogo não informada; perfil inglês/1280×720/100%, em 24/10/2026.

- S+A simultâneos foram observados, com B e especialidades desmarcados. O contador passou de 1567 para **118 na lista filtrada**. Isso não informa a quantidade 20+ nem prova que qualquer filtro futuro tenha a mesma semântica.
- O painel fotografado mostra raridade e especialidades, sem filtro de nível visível. O seletor superior não foi aberto. Não há filtro numérico comprovado para depender dele; o corte é feito pela leitura conservadora do rótulo `Lv.` na grade.
- Etapas 5 e 7: alinhamento normal no fundo, 28 posições visíveis (três linhas completas e um cartão), seguidas de oito EMPTY. Contador 118 e nove colunas são coerentes com essas posições, sem comprovar os itens intermediários ainda não coletados.
- Etapa 5 seleciona o último cartão; etapa 7 seleciona a cópia anterior. As duas posições finais continuam distintas. A etiqueta solicitada para uma captura não é aprovação do seu conteúdo.
- Etapa 6 foi obtida com o controle mantido pressionado, segundo Cristian; ao soltar, a lista retorna ao alinhamento normal. Ela serve como contraexemplo e é recusada pelo observador. Não demonstra deslocamento final fracionário de uma roda automática comum.

## Execução pelo lançador — 01/11/2026

Cristian apresentou o encerramento do lançador com resultado salvo em `.cache/youkai-p1/runs/20261101-195855-9469d5d5-selection/session.json`, SHA256 `1f881c51b4ff9f332f99ca42a2f9bec4b782b6553fc031fbb2ae199213fdd6a4`. `exit-code.txt` contém 0. O resumo e o relatório visual existem na mesma pasta. Cristian confirmou explicitamente que o resumo abriu automaticamente no Bloco de Notas. Isso encerra a pendência de abertura do resultado; o gesto de duplo clique e a aceitação do UAC não foram observados separadamente.

- Lista preparada: 118; 35 posições observadas, 34 elegíveis com leitura detalhada, uma exclusão observada por nível e 83 não lidas por ordenação. Zero níveis/seleções pendentes; 34 cliques e uma roda.
- Parada na posição 35, nível 0, com Level decrescente declarado e sem contradição observada. `scopeComplete` e `coverageConfirmed` verdadeiros; `captureComplete` falso, `endOfInventory` desconhecido e `inventoryAccepted` falso.
- Comparação dos cinco campos por posição com a sessão `20261029-152830-40df8371-selection`: mesmos valores e estados. As posições humanas 14, 25 e 34 continuam com nome incerto no OCR. As confirmações humanas anteriores pertencem à sessão anterior e não foram transferidas automaticamente.
- Conferidos os hashes de 192 imagens registradas e dos cinco módulos locais, sem divergências. Não foi feita nova revisão visual nem avaliação independente de precisão.

Revisão técnica separada: `.cache/youkai-p1/analyses/20261101-launcher-result-9469d5d5/review.json`. Manifesto, imagens e resumo originais preservados. Não há necessidade de repetir aquisição para conferir a abertura do resumo.

## Montagem portátil e relocação — 01/11/2026

Build `.cache/zzz-portable/20261101-201111-e58b9868/`, contendo pasta `gacha-ocr-zzz/`, ZIP de 313.408.772 bytes e recibo `build-result.json`. SHA256 do ZIP: `89ebbf86991dfca17d49a108aecd93633e6c31de725d7e2391e200d4f70abc1c`. Versão mantida em 0.1.0; protótipo local, sem commit/push/publicação.

O PyInstaller 6.22.3 e suas ferramentas fixadas foram instalados em cache separado. O spec adapta a referência Youkai para `youkai_selection.main`; o lançador PowerShell e os argumentos/guardas existentes permanecem. O pacote conserva o ZIP/fonte Youkai para verificação de 260 arquivos, dados do leitor, Tesseract inglês e avisos disponíveis. Não inclui venv de desenvolvimento, sessões da conta, marcador de memória ou handoffs.

- 25 testes passaram em 15,70 s: 21 do lançador existente e quatro de seleção portátil/recusa de runtime ausente/conferência de arquivo upstream/extração fora do destino. Sintaxe PowerShell e `git diff --check` conferidos.
- Self-check do executável passou no build e depois da extração do ZIP em outro caminho com espaços/apóstrofo. Importou módulos e executou Tesseract, sem iniciar captura, listener ou mouse. PATH restrito ao System32; PYTHONPATH/PYTHONHOME vazios; nenhuma venv no pacote. Nenhuma falha nos 614 hashes dos arquivos extraídos.
- Três imagens salvas da sessão de 01/11, posições humanas 1/14/34, foram processadas pelo `probe-youkai.ps1` extraído, que chamou o executável portátil. Valores/estados dos cinco campos coincidem com os originais; inclusive nomes incertos permanecem incertos. Zero inputs; sem nova captura ou aprovação humana.

Recibo separado em `.cache/zzz-portable-validation/20261101/<pasta de relocação>/verification.json`, com logs e as sessões offline na cópia extraída. Nenhuma imagem pessoal foi adicionada ao ZIP original. Essa verificação não equivale a aquisição integrada pelo executável empacotado, ausência física de Python no computador ou funcionamento em outro Windows. Nova conferência no jogo fica para o próximo uso normal, mantendo os ensaios anteriores encerrados. [Guia de montagem e limites](zzz-portable.md).

## Primeiro uso integrado do portátil — 01/11/2026

Cristian executou a pasta extraída `D:\Repo\gacha-ocr-zzz` e informou sucesso. Sessão original: `D:\Repo\gacha-ocr-zzz\.cache\youkai-p1\runs\20261101-230702-880080ba-selection\session.json`, SHA256 `02422e51c6f3204246e7c95754b72a949cde679fa61f7b708cb834a5d9c3b818`. Build `20261101-201111-e58b9868`; `exit-code.txt` contém 0.

- Lista preparada 118; 35 observados, 34 elegíveis, uma exclusão observada por nível e 83 não lidos por ordenação. Zero níveis/seleções pendentes, 34 cliques e uma roda. Parada na posição humana 35, nível 0.
- `scopeComplete` e `coverageConfirmed` verdadeiros; `captureComplete` falso, `endOfInventory` desconhecido e inventário não aprovado automaticamente. Os cinco campos têm os mesmos valores/estados da sessão `20261101-195855-9469d5d5-selection`; os nomes 14/25/34 continuam incertos no bruto, sem transferência das confirmações de outra sessão.
- 186 imagens e 614 arquivos do pacote conferidos por hash, sem divergências. O resumo e o relatório existem na pasta dessa execução. A abertura do resumo não foi perguntada novamente; o relato de sucesso e o registro de término confirmam o percurso integrado, sem alegar uma observação separada de cada janela.

Revisão técnica em `.cache/youkai-p1/analyses/20261101-portable-live-880080ba/review.json`, no laboratório. Nenhuma escrita foi feita na pasta portátil durante a revisão; originais preservados. P3.4 concluído para uso local, sem novo ensaio exigido. Não demonstra ambiente fisicamente sem Python, outro computador ou aprovação de todos os campos. Avisos antes de publicação pública permanecem no [guia portátil](zzz-portable.md).

**Cadência dessa sessão:** 116,32 s de `startedAt` a `endedAt`, incluindo preparação; 101,48 s entre os timestamps do primeiro e do último dos 151 frames, com 34 leituras detalhadas. Esses intervalos não isolam captura de tela, OCR, estabilização ou escrita. A percepção de lentidão foi apontada por Cristian. O caminho atual ainda faz comparação diagnóstica upstream em `read_frame` e atualiza manifesto/relatório durante as capturas. São candidatos de investigação, não gargalos comprovados por esse total nem promessa de ganho. Medição e melhoria localizada ficam em P3.5, separadas da consolidação Git e da interface.

## Primeiro recorte de velocidade — 02/11/2026

Solicitado por Cristian após observar a cadência do Inventory Kamera. A fonte Kamera local fixada confirma captura/checagem mínima e enfileiramento para workers; o [README HSR](https://github.com/kel-z/HSR-Scanner#instructions) documenta processamento que pode continuar após a captura. Não foram executados esses scanners ou atualizadas suas dependências. Pesquisa e implementação em [plano de velocidade](zzz-performance-plan.md).

O caminho ZZZ normal separa aquisição e leitura detalhada: confirma painel/imobilidade, salva imagem/hash e avança, depois processa os arquivos sem inputs ou exigência de foco. Nível ilegível continua com OCR imediato. A comparação upstream é opcional no caminho normal e preservada em `-Diagnostics`/`-FullInventory`. JSON/brutos/imagens permanecem; HTML ao término/erro e uma gravação duplicada por frame removida. Resultado só pode concluir após a leitura dos painéis; falha/confusão de nível mantém parcial.

Medição de posições 1/14/25/34 da sessão de 01/11, duas passagens por modo: oito amostras preservadas em `.cache/youkai-p1/analyses/20261102-speed/`. Mesmos valores e estados dos cinco campos. Na segunda passagem, mediana de `read_frame` 1,259 → 0,773 s (38,6% menor nesse trecho). Comparação adicional custava 0,456–0,516 s por imagem; foram evitadas três chamadas OCR por imagem. Faixas e primeira passagem preservadas em `comparison.json`, sem somar spans sobrepostos. Não é benchmark de aquisição nem promessa de ganho de 38,6% ao vivo.

Regressões focadas passaram em grupos de 70, 104 e 32 testes, com sobreposição, seguidas dos 13 casos finais de processamento diferido/CLI simulada; não somar os grupos. O replay da sessão completa nos modos síncrono/diferido mantém 34 elegíveis, parada em 35 e uma roda simulada, sem promover cópias ou nomes incertos. Os casos finais cobrem foco/F8, imagem alterada, conflito grade/painel, lista vazia, falha de um OCR sem descartar outros painéis, preservação do motivo de captura e escolha real de modo na CLI simulada.

Pacote final desta revisão: `.cache/zzz-portable/20261102-093823-668fd527/gacha-ocr-zzz.zip`, SHA256 `193968a5525ff1c67e7b088821c8581411fabff1b2c7fabf67a010a5e5569964`. Os builds intermediários foram preservados no cache, mas não são a entrega final. Conferidos os 614 arquivos do pacote final e a correspondência com os scripts atuais. Self-check e imagem estática pelo executável passaram em outro cwd, removendo caminhos de desenvolvimento do ambiente filho. Recibo em `20261102-speed/package-check.json`; original, imagens da conta, marcador de memória e handoffs preservados. Não houve captura nova, commit/push ou alteração do Advisor. Próxima validação: um uso integrado desse pacote, ainda pendente.

## Validação real final da performance — 02/11/2026

Sessão `D:\gacha-ocr-zzz\gacha-ocr-zzz\.cache\youkai-p1\runs\20261102-193652-86205124-selection\session.json`, SHA256 `16906d1588e5e84a24d42ec8f6789e15d8e9f73a495fd16bbd8fa8e54938efdb`; pacote `20261102-184806-173bed9f`. Cristian relatou melhora. Saída zero, escopo 20+ concluído: 34 elegíveis lidos/35 observados, 34 cliques e uma roda. Zero níveis/seleções/processamentos pendentes, falhas ou erros de limpeza. Valores/estados dos cinco campos iguais à referência de 01/11, mantendo três nomes incertos e `inventoryAccepted=false`.

Tempos reais: aquisição 31,53 s, processamento 2,51 s, trecho ativo **34,04 s**, contra 43,78 s anteriores (**22,2% menor**). Total registrado 51,11 s contra 57,29 s (10,8% menor, inclui preparação/encerramento). Painel 21,56 s contra 31,65 s. São duas execuções locais, sem promessa geral ou benchmark controlado.

369 imagens de verificação submetidas/gravadas, zero pendências/erros, fila máxima duas, nenhuma pressão de fila. Conferidos **405 hashes de imagens**, **618 arquivos do pacote** e os oito módulos registrados, sem divergência. Revisão separada `.cache/youkai-p1/analyses/20261102-combined-live-86205124/review.json`. Total 1567 continua sendo cabeçalho observado, não S/A validado; cobertura física integral não declarada e aprovação humana não transferida. P3.5 encerrado no ambiente local, sem necessidade de nova coleta. Nesta revisão: somente leitura dos artefatos e atualização documental, sem novo input, commit/push ou escrita no Advisor.

## Gravação e agendamento integrados — 02/11/2026

Cristian autorizou implementar a combinação, permitindo ignorar ganhos inferiores a 10%. O fluxo normal integra um gravador com fila de quatro imagens e checkpoints por seleção. Polling de 60 ms incluindo trabalho, 0,25 s de estabilidade, seleção/progressão e diferença máxima 2,5 preservados; acrescentada comparação com o início da janela para impedir falsa estabilidade por animação lenta. `-SynchronousEvidence` mantém o modo anterior.

Replay final `20261102-combined-evidence/20261102-184638/comparison.json`: 34 seleções, gravação real e ordem alternada. Síncrono 33,925 s/215 imagens; combinado 25,731 s/425 imagens, economia 8,194 s. Projeção de 18,7% no total ativo anterior, sem ganho real novo no jogo comprovado. As 640 imagens mantiveram pixels/hashes; os 34 painéis relidos mantiveram valores/estados/evidências dos cinco campos (`field-check.json`). Fonte dba199e7 preservada, sem aprovação humana transferida. O volume de imagens aproximadamente dobra. Passaram 80 testes focados finais e 72 regressões anteriores dos demais caminhos afetados. Pacote final `20261102-184806-173bed9f` conferido, 618 hashes íntegros; detalhes e limitações no [plano](zzz-performance-plan.md#combinação-implementada--gravação-e-agendamento). Sem captura/input real, escrita no Advisor, commit/push ou handoff nesta implementação.

## Experimento de gravação em segundo plano — 02/11/2026

Autorizado por Cristian após reavaliar o custo de replicar o fluxo nos jogos futuros. Protótipo `scripts/zzz_evidence.py`, sem integração ao executor. Replay de 34 seleções salvas, com gravação real em disco e ordem alternada: síncrono 33,41 s/211 imagens; background 27,72 s/235 imagens. Economia 5,69 s no trecho medido; projeção de 13,0% no total ativo de 43,78 s, abaixo do limiar de 20%. Não é novo tempo medido no jogo. Todas as 446 imagens mantiveram pixels e hashes; recortes dos cinco campos idênticos, sem novo OCR ou aprovação humana. Dez testes focados passaram. Artefatos em `.cache/youkai-p1/analyses/20261102-background-evidence/20261102-181328/comparison.json`, script no diretório pai. Limitações e tratamento de falhas no [plano](zzz-performance-plan.md#experimento-de-gravação--pausado-após-medição). Pausado antes de integração/build/coleta; original dba199e7 preservado. Sem commit/push ou escrita no Advisor.

## Triagem das esperas — 02/11/2026

Por solicitação de Cristian, o recorte seguinte investigou o maior custo com limite mínimo de retorno de 20% no tempo ativo. Usou somente imagens/horários salvos da sessão dba199e7, sem inputs. Foram medidas verificações e persistência; o modelo de agendamento projetou 9,3% ao descontar trabalho da pausa e 18,7% com maior frequência. O modelo não reproduz exatamente o tempo original e não conhece a animação entre amostras. Esses valores são projeções, sem ganho real novo comprovado. A investigação foi pausada conforme a instrução, sem alteração de comportamento ou pacote. Resultados e scripts em `.cache/youkai-p1/analyses/20261102-panel-wait/`; detalhes no [plano](zzz-performance-plan.md#terceiro-recorte--pausado-pelo-limite-de-retorno). A sessão original mantém SHA256 `8e080598022d810eb5d0e653576c98c7fd2d176930fc3c46f637913d04c77416`.

## Uso integrado do engine persistente — 02/11/2026

Cristian executou o pacote `20261102-102439-ffaf12a7` e relatou melhora perceptível. Sessão `D:\gacha-ocr-zzz\gacha-ocr-zzz\.cache\youkai-p1\runs\20261102-141417-dba199e7-selection\session.json`, SHA256 `8e080598022d810eb5d0e653576c98c7fd2d176930fc3c46f637913d04c77416`. Saída zero, fase finalizada, `scopeComplete=true`, 34 lidos/elegíveis, 35 observados, 34 cliques e uma roda. Zero falhas e zero níveis/seleções/processamentos pendentes; nomes 14/25/34 continuam incertos. Valores/estados dos cinco campos iguais à referência `20261101-195855-9469d5d5-selection`; aprovação humana anterior não foi transferida. `inventoryAccepted=false`, percurso físico completo não declarado.

Conferidos 248 hashes de imagens, os 616 arquivos do pacote e os sete módulos registrados na sessão, sem divergências. `ocrBackend.engine=tesseract-native`, inicialização 0,159 s. Revisão técnica separada em `.cache/youkai-p1/analyses/20261102-native-live-dba199e7/review.json`; o bruto foi apenas lido e não reescrito.

Comparação com o primeiro pacote de velocidade: total registrado 97,47 → 57,29 s (41,2% menor, inclui preparação); aquisição 60,38 → 41,45 s; processamento posterior 23,26 → 2,33 s (90,0% menor). Aquisição + processamento 83,63 → 43,78 s (47,7% menor). Os timestamps atuais cobrem 14:14:18–14:15:15, horário de Brasília. A sessão antiga já não existe no caminho portátil informado; seus números e verificação estão preservados na revisão `20261102-speed-live-b726a84b/review.json` e no registro abaixo. São execuções locais distintas, não benchmark controlado. Ambas mostram cabeçalho 1567; isso não prova contagem S/A ou filtro aplicado.

Captura pura 0,70 s, OCR de grade 0,42 s, espera de painel 31,65 s, gravação/hash de frames 8,81 s. Subspans são sobrepostos; não somar. Espera do painel é candidata futura a decomposição, preservando confirmação de seleção/estabilização. P3.5 encerrado no recorte local; interface é a próxima entrega. Nenhuma nova aquisição/teste manual exigido. Nesta revisão houve somente verificação de arquivos e atualização de documentação, sem mudar comportamento, commitar, publicar ou escrever no Advisor.

## Retorno de velocidade e engine persistente — 02/11/2026

Sessão enviada por Cristian: `D:\gacha-ocr-zzz\gacha-ocr-zzz\.cache\youkai-p1\runs\20261102-095018-b726a84b-selection\session.json`, SHA256 `a40efe3abe517729823582089b29824c8b1001d2716deebf1435808c14d961a4`. JSON válido, 34 leituras concluídas, zero falhas e zero níveis/seleções/processamentos pendentes; mesmas três incertezas de nome. Os cinco campos coincidem com a sessão anterior. Conferidos 209 hashes de imagens e 614 arquivos do pacote, sem divergências. O contador preparado agora é 1567, antes 118; não é comparação controlada de listas iguais nem contagem S/A validada adicional. Revisão separada em `.cache/youkai-p1/analyses/20261102-speed-live-b726a84b/review.json`.

Tempo: 97,47 s totais, incluindo preparação; aquisição 60,38 s e processamento posterior 23,26 s. A captura pura levou 0,84 s. Espera de painel 32,05 s, OCR do nível da grade 13,10 s, gravação/hash dos frames 14,36 s e leitura imediata 3,34 s são subspans, alguns sobrepostos. Houve 29 leituras diferidas e cinco imediatas (posições humanas 3/11/12/13/18). O relato de lentidão levou a investigar custos reais, sem atribuir o total à captura da tela.

Segundo recorte: API C oficial da DLL/modelo já incluídos, engine único por sessão, mesmo preprocessamento/OEM/PSM e limpeza de imagem/adaptação a cada trecho; fallback de inicialização explícito para CLI. Modelo carregado em memória via `TessBaseAPIInit5` para resolver limitação Unicode verificada no carregamento por nome de arquivo. Nenhuma fonte upstream foi alterada. PNG lossless nível 1 reduz CPU de gravação mantendo todos os pixels e hashes, com arquivos cerca de 31% maiores na amostra.

Replays completos: 34 imagens pela CLI 36,03 s, pela API persistente 3,37 s na repetição sem regressões concorrentes; wrapper final com modelo em memória releu em 3,49 s. Os cinco campos, estados e evidências brutas coincidem. As 35 decisões da grade também coincidem. A ordem real de leituras imediatas/diferidas foi reproduzida sem inputs, preservando campos/evidências completos. Não é promessa de ganho igual no tempo total no jogo. Medições e detalhes em [plano de velocidade](zzz-performance-plan.md).

Passaram 21 testes focados de buffers/cleanup/fallback/PNG, gravação e fluxo diferido, 69 de inventário/nível/replay/pacote e 18 após mudar o carregamento do modelo para memória; grupos sobrepostos. Pacote final `.cache/zzz-portable/20261102-102439-ffaf12a7/gacha-ocr-zzz.zip`, SHA256 `69e0d6628e8c4386f9aeee777888e21f803cc418128ff348da2c2be8ab37941a`. Conferidos 616 arquivos e correspondência com os leitores atuais; self-check nativo passou em outro diretório com espaços/apóstrofo/acento e ambiente sem caminhos de desenvolvimento. Recibo `20261102-speed-live-b726a84b/native-package-check.json`. Naquele ponto, a aquisição integrada estava pendente; foi conferida na sessão dba199e7 documentada acima. Nenhum original foi reescrito; não houve commit/push ou escrita no Advisor.

Fontes técnicas consultadas: [API C Tesseract 5.4](https://raw.githubusercontent.com/tesseract-ocr/tesseract/5.4.0/include/tesseract/capi.h), [compressão PNG do Pillow](https://pillow.readthedocs.io/en/stable/handbook/image-file-formats.html#png).

## Roteiro passivo de referências — somente por dúvida concreta

Quando houver uma necessidade concreta de captura passiva, o lançador existente aceita `-Inventory -CollectReferences -Run`. **As referências acima já estão coletadas; não repetir este roteiro por rotina.** Durante a preparação passiva, é permitido conversar no chat entre capturas. Ao capturar, o jogo precisa estar na frente e manter janela/geometria/DPI. Uma tentativa sem foco não salva a referência; pede F9 novamente na mesma etapa, preservando as anteriores. Não há cliques, rodas ou movimentos automáticos nesse modo.

**Objetivo da preparação passiva:** registrar filtros e posição final da lista para resolver uma dúvida visual específica, em uma sessão acompanhada e com um único `session.json`.

| Etapa | O que fazer e como a lista deve ficar | Clique em item | F9 e espera |
|---|---|---|---|
| Sem filtro, topo | Retirar os filtros e rolar para cima até a primeira linha; soltar e esperar parar | Não | F9 quando parar; aguardar próximo aviso sem mexer |
| Opções do filtro | Abrir filtro, marcar S+A, desmarcar B; deixar opções abertas e esperar a atualização parar | Não | F9 com as opções visíveis; aguardar |
| Filtro aplicado, topo | Fechar filtro e voltar à primeira linha; soltar e esperar parar | Não | F9 com a lista parada; aguardar |
| Um passo acima do fundo | Rolar para baixo até a barra chegar embaixo e aparecerem os EMPTY; soltar e esperar voltar ao alinhamento normal. Subir um passo da rodinha e esperar parar | Não | F9 só depois de parar; aguardar |
| Fundo normal | Descer um passo da rodinha; soltar todo controle e esperar a lista voltar e parar | Não | F9 após soltar e parar; aguardar |
| Confirmação do fundo | Descer mais um passo; soltar completamente e esperar a lista voltar e parar | Não | F9 somente no alinhamento normal, sem botão pressionado; aguardar |
| Último item | Clicar no último cartão ocupado antes dos EMPTY (na referência de 118, o cartão isolado na última linha); soltar e esperar lista e painel pararem | Sim, no último cartão | F9 depois de ambos pararem; aguardar aviso de término |

Se a lista estiver vazia, mantê-la vazia nas etapas finais e não clicar em item inexistente. Depois de F9, não preparar a etapa seguinte antes do aviso. Esse modo apenas coleta referências: `references-collected` não significa inventário percorrido ou aprovado.
