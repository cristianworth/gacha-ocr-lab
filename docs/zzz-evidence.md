# ZZZ — evidências e histórico de investigação

Registro técnico, sem novos pedidos de teste. Para uso normal, siga o [guia ZZZ](zzz-scan.md); próximos passos ficam somente no [ROADMAP](ROADMAP.md). Sessões, imagens e revisões citadas estão no cache local e não acompanham o clone. Os números demonstram os recortes descritos, não a precisão geral do OCR.

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
