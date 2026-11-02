# ZZZ — plano de melhoria de velocidade

Plano de implementação acordado em 01/11/2026. **Combinação de gravação/agendamento conferida no jogo em 02/11; etapa de performance encerrada no ambiente local.** Cristian solicitou o início neste chat, dispensando a transferência prevista anteriormente. O [ROADMAP](ROADMAP.md) define a ordem: consolidação ZZZ → velocidade → interface simples → HSR 20+ → demais jogos. Não foi gerado handoff.

## Validação integrada final — etapa encerrada

Cristian executou o pacote `20261102-184806-173bed9f`, relatou melhora e forneceu a sessão `20261102-193652-86205124-selection`. SHA256 `16906d1588e5e84a24d42ec8f6789e15d8e9f73a495fd16bbd8fa8e54938efdb`. Saída zero, fase finalizada, 34 elegíveis lidos, 35 posições observadas, zero falhas/pendências e os mesmos valores/estados dos cinco campos da referência de 01/11. Mantém os três nomes incertos, sem transferência de aprovação humana ou aceite automático de inventário.

| Medição real | Engine persistente anterior | Gravação/agendamento |
|---|---:|---:|
| Aquisição | 41,45 s | 31,53 s |
| Processamento posterior | 2,33 s | 2,51 s |
| Aquisição + processamento | 43,78 s | **34,04 s** |
| Total registrado, incluindo preparação/encerramento | 57,29 s | **51,11 s** |

Economia de 9,74 s no trecho ativo (**22,2%**), superando o mínimo atual de 10%; total registrado 10,8% menor. Duas execuções locais, sem garantia geral ou benchmark controlado; tempo de preparação varia. O trecho de confirmação de painel caiu de 31,65 para 21,56 s. Subspans incluem trabalho sobreposto e não são somáveis.

`evidenceWriting`: 369 imagens submetidas e gravadas, zero pendências/erros, pico de duas imagens na fila de capacidade quatro e nenhuma espera por fila cheia. Foram conferidos **405 hashes de imagens**, os **618 arquivos do pacote** e os oito módulos registrados na sessão; nenhuma divergência. A nova frequência preserva mais imagens intermediárias, com custo maior de espaço já documentado. O cabeçalho continua 1567; isso não valida contagem S/A. Escopo 20+ concluído não significa percurso físico integral ou aprovação humana de todos os campos.

Revisão separada em `.cache/youkai-p1/analyses/20261102-combined-live-86205124/review.json`; bruto apenas lido, sem novas capturas/inputs nesta revisão. **P3.5 encerrado no recorte local.** Não há outra coleta pendente ou necessidade de repetir pilotos/guardas. A entrega de desempenho é versionada neste fechamento. Próxima implementação é a interface P3.6, seguida de HSR 20+; sem novas otimizações menores por rotina.

## Combinação implementada — gravação e agendamento

Cristian autorizou a implementação após reavaliar o experimento isolado, permitindo ignorar melhorias abaixo de **10%**. Esse é o limiar deste recorte, substituindo o mínimo anterior de 20%. Não foram feitas otimizações isoladas de mouse, OCR ou backend de captura.

O caminho normal S/A 20+ agora integra `InventoryEvidenceRecorder`/`BufferedEvidenceWriter`: um único gravador, quatro imagens pendentes no máximo, cópia de pixels/metadados e recibos PNG/hash. O worker não acessa janela/input/OCR nem altera o relatório; só o processo principal publica recibos e grava JSON. Todas as imagens da seleção são gravadas antes do checkpoint e antes do próximo item. Ao receber F8/foco perdido, os inputs cessam e o encerramento aguarda as imagens aceitas. Falha de disco impede confirmação de cobertura; preserva recibos de outras imagens gravadas. Processo morto à força pode perder até quatro imagens na fila.

A confirmação de painel usa verificações a cada 60 ms **incluindo** o trabalho já executado, com próxima espera limitada pelo prazo de estabilidade. Permanecem seleção esperada, progressão legível, diferença visual máxima 2,5, estabilidade mínima de 0,25 s e timeout de quatro segundos. Como amostras próximas tornam uma animação lenta artificialmente parecida, o modo agendado limita também a diferença em relação ao início da janela (`stabilityWindowDifference`). O modo síncrono anterior não muda; `-SynchronousEvidence`/`--synchronous-evidence` restaura gravação e polling anteriores, conservando OCR nativo e leitura diferida. Diagnóstico/lista completa/referências não adotam o novo fluxo.

**Medição final após a proteção de deriva:** replay pareado das 34 seleções, gravação real em disco, ordem alternada, checkpoints e espera da fila incluídos; sem testes concorrentes ou inputs. Síncrono **33,925 s**, combinado **25,731 s**: economia de **8,194 s** (24,2% do trecho). Mantendo os demais custos da sessão real de 43,78 s constantes, isso projeta **18,7% no tempo ativo total**, acima do novo mínimo de 10%. Não é um novo tempo medido no jogo nem deve ser somado aos ganhos dos experimentos anteriores. Uma passagem pareada não estabelece variabilidade geral.

O replay gerou 215 PNGs no síncrono e 425 no combinado: **640 imagens** com pixels/hashes iguais à imagem efetivamente amostrada, sem descarte. Pico de duas imagens na fila, nenhuma falha ou pressão de fila. A frequência maior aproximadamente dobra imagens intermediárias e espaço de evidências nesse percurso. Isso é uma troca material do recorte, não uma redução geral de consumo. Guardas e limite de frames continuam; orçamento de segurança esgotado permanece parcial.

Os 34 painéis finais foram relidos pelo mesmo engine nativo: zero divergências em valores, estados ou evidências completas dos cinco campos, incluindo nomes incertos. Nenhuma confirmação humana foi transferida. Fonte dba199e7 preservada por SHA256 `8e080598022d810eb5d0e653576c98c7fd2d176930fc3c46f637913d04c77416`.

Verificações: **80 testes focados finais** em `test_zzz_pilot.py`, `test_zzz_evidence.py` e `test_zzz_deferred.py`; mais 72 regressões de inventário, corte, gravação e pacote no lote anterior. Cobrem polling com custo de gravação, animação lenta, seleção anterior, fila/posse/erros, pressão da fila com verificação de foco sem reentrância, CLI normal/síncrono/diagnóstico, lista vazia, F8/foco e disco cheio antes do primeiro clique. Não houve repetição da suíte inteira ou teste manual. Artefatos em `.cache/youkai-p1/analyses/20261102-combined-evidence/20261102-184638/`: `comparison.json`, `field-check.json`, imagens/checkpoints; scripts no diretório pai. A passagem intermediária `184029` precede a proteção de deriva e não é a medição final.

Pacote final conferido (618 arquivos e hashes dos leitores iguais à fonte): `.cache/zzz-portable/20261102-184806-173bed9f/gacha-ocr-zzz.zip`. SHA256 do ZIP: `12eecba7ebd5cb3b7f6e4c99f2c922b804f727090c82476b743a3473f782cd5b`; recibo `20261102-combined-evidence/package-check.json`. Self-check dos módulos/OCR passou sem captura/input. O intermediário `184438-eef7599b` precede a proteção final e não deve ser usado para validar esta entrega. Versão 0.1.0 mantida; nenhuma publicação/commit neste recorte. O uso integrado do pacote final foi conferido conforme a seção acima; próximo passo é a interface. Não repetir pilotos/guardas/percurso completo encerrados.

## Experimento de gravação — pausado após medição

Cristian reavaliou a prioridade e autorizou um experimento de gravação antes da interface, para evitar replicar custos nos próximos jogos. Naquele experimento, o protótipo em `scripts/zzz_evidence.py` ficou **isolado, sem alterar o default ou entrar em pacote**; a integração posterior está descrita acima. `BufferedEvidenceWriter` usa um único worker e até quatro imagens pendentes; faz cópias dos pixels/metadados, grava PNG lossless/hash e retorna recibos. O JSON pertence ao chamador. Imagem enfileirada não é considerada gravada; o experimento espera a gravação de todas as imagens da seleção antes do checkpoint. Não sobrescreve destinos existentes.

A espera por fila cheia admite verificação de parada/foco; encerramento drena imagens aceitas inclusive após uma falha. Arquivos gravados com sucesso continuam recuperáveis, mas qualquer erro permanece explícito. A fila reduz a sincronização por captura e passa a salvar o JSON por seleção confirmada. Uma morte abrupta do processo pode perder até quatro imagens ainda pendentes; parada cooperativa foi simulada. Isso é um limite novo do protótipo, não uma mudança no produto validado.

**Medição pareada, uma passagem:** replay das 34 seleções da sessão dba199e7, gravando PNGs/JSON reais em novas pastas do laboratório; ordem normal/background alternada entre seleções. Inclui cópia da imagem, finalização das gravações e checkpoint. Usa o `wait_for_panel` atual, sem mudar seleção, progressão, diferença visual, estabilidade de 0,25 s, pausa de 0,12 s ou timeout. Não houve inputs ou captura do desktop. Testes não rodaram simultaneamente com o benchmark.

| Resultado | Gravação normal | Segundo plano |
|---|---:|---:|
| Tempo das confirmações no replay | 33,41 s | 27,72 s |
| Imagens geradas | 211 | 235 |
| Economia medida no replay | — | 5,69 s (17,0% desse trecho) |
| Redução projetada no total ativo de 43,78 s | — | **13,0%** |

A projeção ficou abaixo do limite de 20% (mínimo 8,76 s de economia). **Experimento pausado conforme a instrução; não integrar, combinar outras otimizações ou solicitar nova coleta automaticamente.** Os ganhos da triagem anterior e deste experimento atuam sobre intervalos sobrepostos e não podem ser somados.

Conferidos os 446 PNGs por hash e pixels contra a imagem exata usada em cada amostra; nenhuma diferença. Os recortes finais dos cinco campos também permaneceram idênticos aos da última imagem conhecida de cada seleção. Não foi feita nova leitura OCR nem aprovação de campos/inventário. Fonte preservada por SHA256 `8e080598022d810eb5d0e653576c98c7fd2d176930fc3c46f637913d04c77416`.

**Limites:** gravação e tempos do replay foram medidos, mas o ganho de 13% no jogo é projeção. O replay mantém a última imagem conhecida até o horário da próxima referência, sem conhecer a animação intermediária. O trecho normal medido (33,41 s) difere dos 31,65 s reais. Uma passagem pareada não estima variabilidade geral, outros discos ou outras contas. O experimento não demonstra impossibilidade de atingir 20% com outra estratégia; não justifica mais investimento sem reavaliação.

Passaram **10 testes focados** em `test/test_zzz_evidence.py`: propriedade dos pixels/metadados, fila limitada/ordem/nenhum descarte, F8/foco durante pressão da fila, erro/arquivo parcial/timeout, preservação de outros recibos, rejeição de sobrescrita e encerramento. `git diff --check` também passou. Não foi repetida a suíte inteira nem coleta manual. Artefatos: `.cache/youkai-p1/analyses/20261102-background-evidence/benchmark.py` e `20261102-181328/comparison.json`, checkpoints e imagens. Sem build, commit ou push.

Recomendação após a pausa: interface desacoplada do executor validado; depois HSR com regras visuais próprias e extração somente do que os dois usos comprovarem compartilhado. Naquele ponto, o gravador ficou como referência isolada. Sua integração posterior ao ZZZ não define regras visuais dos jogos seguintes.

## Terceiro recorte — pausado pelo limite de retorno

Após a validação, Cristian priorizou o maior custo restante e definiu parar a análise quando o ganho apontado fosse menor que 20%. O critério operacional informado foi redução no tempo ativo total (43,78 s), que exige economizar pelo menos 8,76 s. A investigação foi pausada antes de alterar comportamento; não há terceiro pacote ou nova aquisição.

A sessão dba199e7 contém 34 confirmações de painel: uma com quatro capturas e 33 com seis. Houve 168 pausas explícitas de 0,12 s, somando 20,16 s. O trecho de 31,65 s também inclui verificação, PNG/hash e JSON; não representa tempo integral removível. Nas seleções seguintes à primeira, as imagens iniciais mostram o destaque anterior e depois mudança efetiva no painel.

Perfil offline localizado: seis imagens da segunda seleção, três passagens, sem inputs. Medianas por imagem: seleção 5,27 ms, progressão 0,99 ms, assinatura/diferença 0,24 ms, PNG/hash 57,57 ms, manifesto 19,45 ms. A medição de manifesto usa uma cópia final do JSON em estado ativo, maior que os primeiros checkpoints; esses valores não são subspans medidos durante a coleta e não devem ser multiplicados como tempo real exato.

Um modelo de agendamento conservou as mesmas verificações e os 0,25 s de estabilidade, mantendo cada imagem conhecida até o horário da próxima amostra salva. Trabalho por seleção foi calibrado pelos intervalos reais. Descontar o trabalho da pausa de 120 ms projetou 4,09 s (9,3% do total ativo); verificar a cada 60 ms projetou 8,20 s (18,7%), com 438 verificações contra 218 no modelo original. Aumentar ainda mais a frequência não melhorou a projeção. Gravar mais amostras reduz o retorno da frequência maior.

**Limites:** modelo original soma 34,46 s, contra 31,65 s reais, portanto não reproduz precisamente o tempo original. As amostras não revelam os estados intermediários da animação, e o modelo não prova que uma implementação real ficará abaixo ou acima de 20%. Serve como triagem, não como benchmark/aceite. O ganho estimado ficou abaixo do limiar, motivando a pausa solicitada; não se concluiu que nenhuma outra otimização possa atingir 20%.

Artefatos locais em `.cache/youkai-p1/analyses/20261102-panel-wait/`: `profile.py`, `profile.json`, `model.py`, `cadence-model.json`. O original permaneceu íntegro. Nenhuma mudança no scanner, remoção de evidências, redução da estabilidade, nova coleta, build, commit ou push neste recorte. Naquele ponto, a recomendação era seguir para a interface. Depois Cristian autorizou explicitamente o experimento de gravação registrado acima; isso não autoriza investigações adicionais após sua pausa.

## Resultado integrado e avanço

Sessão `20261102-141417-dba199e7-selection`, pacote `20261102-102439-ffaf12a7`, engine `tesseract-native`: 34 elegíveis lidos, 35 posições observadas, zero pendências/falhas e valores/estados dos cinco campos iguais à referência de 01/11. Conferidos 248 hashes de imagens, 616 arquivos do pacote e os sete módulos registrados pela sessão. Os três nomes incertos continuam visíveis; nenhuma aprovação humana foi transferida. Revisão separada: `.cache/youkai-p1/analyses/20261102-native-live-dba199e7/review.json`.

| Trecho | Primeiro pacote de velocidade | Engine persistente + PNG rápido |
|---|---:|---:|
| Total registrado, incluindo preparação | 97,47 s | 57,29 s |
| Aquisição | 60,38 s | 41,45 s |
| Processamento posterior | 23,26 s | 2,33 s |
| Aquisição + processamento | 83,63 s | 43,78 s |

Redução de 47,7% no trecho ativo e 41,2% no total registrado; processamento posterior 90,0% menor. São duas execuções reais locais, não benchmark controlado ou promessa para outras contas/máquinas. Ambas mostram total 1567; isso não valida contagem S/A. A sessão antiga já não está na pasta portátil atual: comparação usa sua revisão técnica preservada e as medições anteriormente registradas.

O custo restante mais relevante é `panelWaitSeconds` (31,65 s); gravação de evidências soma 8,81 s dentro dos spans, sem somá-los como etapas independentes. Otimização futura deve decompor confirmação de seleção/painel e trabalho executado durante essa espera antes de mudar intervalos. Não reduzir estabilização ou retirar evidências por suposição. Não bloqueia a interface nem exige outra coleta agora. Próximo recorte: interface simples, mantendo o executor validado.

## Retorno real e segundo recorte

Sessão `D:\gacha-ocr-zzz\gacha-ocr-zzz\.cache\youkai-p1\runs\20261102-095018-b726a84b-selection\session.json`: 34 lidos, zero níveis/seleções/processamentos pendentes e os mesmos valores/estados dos cinco campos da referência anterior. 209 imagens e 614 arquivos do pacote íntegros. Total preparado agora 1567, antes 118: não tratar como lista filtrada idêntica ou benchmark controlado. Os três nomes incertos permanecem os mesmos; nenhum inventário foi aprovado automaticamente. Revisão em `.cache/youkai-p1/analyses/20261102-speed-live-b726a84b/review.json`.

Tempos reais: 97,47 s totais, 60,38 s de aquisição e 23,26 s de processamento posterior. Captura pura 0,84 s, espera de painel 32,05 s, OCR do nível da grade 13,10 s e gravação/hash dos frames 14,36 s; esses subspans se sobrepõem. Houve cinco leituras imediatas por nível da grade ilegível e 29 posteriores. O ganho real foi modesto; a redução offline anterior não equivalia a 39% do tempo total.

A investigação seguinte confirmou que `pytesseract.image_to_string` inicia o executável e carrega o modelo em cada chamada. O segundo recorte usa a **API C oficial da mesma DLL Tesseract já incluída**, com um engine carregado por sessão e o mesmo `eng.traineddata`, OEM 1, PSM 6/7 e preprocessamento público do Youkai. Não há novo OCR, download, concorrência ou redução da estabilização. Imagem/resultados e adaptação são limpos após cada trecho; memória e handle são liberados ao encerrar. A integração usa `read_frame(recognizer=...)` e os callbacks existentes, sem alterar a fonte upstream.

`scripts/zzz_ocr.py` implementa somente os métodos `read_text`/`read_line` usados por este caminho ZZZ; não é substituto universal do protocolo upstream. `ocrBackend` registra engine e tempo de inicialização. DLL/API/modelo indisponível na inicialização gera fallback explícito para o leitor CLI, com motivo no relatório. Falha de OCR durante leitura continua visível como falha/pendência; não é encoberta por palpite ou aprovação. Diagnóstico, lista completa e referências mantêm o caminho anterior. O self-check do pacote também inicializa/lê/fecha a API nativa sem captura ou inputs.

A checagem de relocação encontrou limitação de caminhos com acentos na inicialização por nome de arquivo dessa DLL Windows. O wrapper final usa `TessBaseAPIInit5`, lendo os mesmos bytes de `eng.traineddata` pela API Python e mantendo o buffer vivo até excluir o engine. Isso evita conversão ANSI do caminho; nenhum modelo é trocado. A repetição do wrapper final manteve os 34 campos e as 35 decisões de nível, com cerca de 3,49 s no trecho completo de leitura offline. A ordem real de cinco leituras imediatas seguida das 29 posteriores também passou, com campos/evidências completos idênticos. A relocação final confirmou o ajuste no executável com espaços, apóstrofo e acento, sem caminhos de desenvolvimento no ambiente filho.

Pacote final do segundo recorte: `.cache/zzz-portable/20261102-102439-ffaf12a7/gacha-ocr-zzz.zip`; SHA256 `69e0d6628e8c4386f9aeee777888e21f803cc418128ff348da2c2be8ab37941a`. 616 arquivos conferidos; self-check nativo no pacote e em relocação passou. Recibo `20261102-speed-live-b726a84b/native-package-check.json`. Builds anteriores preservados não contêm necessariamente a correção de Unicode. Coleta integrada desse pacote conferida acima; não repetir por rotina.

O outro custo atacado é compressão: evidências passam a usar **PNG lossless nível 1**, em vez do default 6. Benchmark de quatro imagens em duas passagens: mediana 75,94 → 37,06 ms por gravação; tamanho mediano 860.167 → 1.128.395 bytes (cerca de 31% maior). Cada arquivo foi reaberto e seus pixels comparados integralmente, sem diferença. PNG/hash/crops permanecem; não há JPEG, redução de resolução ou descarte de frames. Novos spans `clickSeconds` e `viewObservationSeconds` ajudam a separar o custo restante da aquisição.

Antes da integração, o protótipo nativo releu as 34 imagens em cerca de 3,6 s, com os mesmos cinco campos em todas. A comparação com o wrapper final também verificou texto bruto/evidência e as 35 decisões de nível da grade: nenhuma divergência. Na repetição sem os testes concorrentes, o mesmo conjunto completo levou **36,03 s pela CLI e 3,37 s pela API nativa**, incluindo carregamento de imagens, crops e leitura; os 35 níveis pela API levaram 1,34 s. Isso é comparação offline na máquina local, sem estimativa prometida para a espera do painel/jogo ou todo o percurso.

Artefatos em `20261102-speed-live-b726a84b/`: `native-probe.json`, `engine-comparison.json`, `png-benchmark.json`. O ensaio executado junto das regressões está preservado separadamente como `engine-comparison-with-regressions.json`; não usar seu resultado como se tivesse a mesma carga da repetição.

Verificações focadas: 21 casos de API/buffers/cleanup/fallback/PNG, processamento diferido e gravação; 69 de inventário, nível, replay e pacote. Esses grupos reutilizam testes existentes. Nenhuma nova aquisição foi feita durante a implementação; depois, Cristian executou o pacote e forneceu o resultado integrado descrito acima. Não há teste manual pendente deste recorte.

## Primeiro recorte realizado em 02/11

A leitura do fork Kamera local fixado em `a5d1c776301f688793d42f52c4c44c718f20c4a7` confirmou a ideia de Cristian: `WeaponScraper.QueueScan` captura/recorta, verifica mínimo de nível/raridade e coloca imagens em `workerQueue`; `InventoryKamera.GatherData` inicia workers, e `ImageProcessorWorker` consome a fila. O avanço entre itens ainda tem uma espera; não basta copiar o intervalo de outro jogo. O [HSR-Scanner](https://github.com/kel-z/HSR-Scanner#instructions) também documenta processamento que pode continuar após a captura. Fontes locais do Kamera e seus links fixados em [pesquisa da referência](inventory-kamera.md); não houve atualização de dependências ou execução desses scanners.

Escolha inicial: separar aquisição e leitura no caminho S/A 20+, sem threads ou fila genérica. A captura confirma seleção/estabilização e imobilidade, salva a imagem/hash e avança. Nível ilegível exige OCR imediato; por isso o corte não depende de uma suposição nova. Depois de encerrar todos os inputs, o executor lê os arquivos por posição, confere hashes e aplica o mesmo leitor de cinco campos. Falhas ou conflitos impedem conclusão. Mouse é liberado antes do processamento, que não exige foco no jogo. A leitura posterior é sequencial nesta versão; concorrência fica para uma medição posterior se necessária.

A comparação diagnóstica upstream deixou de rodar em toda leitura normal: usa 3 chamadas OCR adicionais nas quatro imagens medidas e não decide nossos cinco campos. `read_frame` conserva a opção `compare_original=True` por compatibilidade; o inventário normal passa `False`. `-Diagnostics` e `-FullInventory` mantêm a comparação e o fluxo síncrono. Estado explícito `originalComparison.state` diferencia `not-requested`, `completed` e `failed`. Não foram removidos crops/textos brutos do leitor principal.

Também foi eliminada uma gravação duplicada por frame no inventário, preservando a evidência antes de salvar. JSON/checkpoints e todos os frames continuam; o HTML deixa de ser renderizado a cada captura/processamento e é gerado ao finalizar/erro. Interrupção permite processar os painéis já salvos e mantém o resultado parcial, sem novos inputs.

**Medição offline:** posições 1/14/25/34, duas passagens por modo (oito amostras), mesmos valores/estados dos cinco campos. Mediana da segunda passagem: **1,259 s → 0,773 s**, redução aproximada de **38,6% no trecho `read_frame` medido**. Faixas das oito amostras: original 1,061–1,963 s; normal 0,647–1,294 s. Comparação adicional: 0,456–0,516 s; chamadas OCR passaram de 7/8 para 4/5 por imagem. Primeira passagem/variação preservadas. Isso não demonstra ganho igual no percurso ao vivo nem mede redução do tempo com o jogo em foco.

Artefatos em `.cache/youkai-p1/analyses/20261102-speed/`: `baseline.json`, `normal.json`, `comparison.json` e scripts de medição. Os tempos de OCR/comparação/gravação incluem spans sobrepostos; não devem ser somados. Base anterior: commit `fa44553`. O relatório da próxima aquisição registra spans de aquisição/processamento e subspans para localizar o custo restante.

Verificações: 70 testes de leitura/corte/gravação; 104 de inventário/escopo/lançador/pacote e casos novos; 32 após adicionar o replay diferido e spans; **13 casos novos finais** cobrindo aquisição antes de OCR, foco/F8/parcial, conflito de nível, hash alterado, erro OCR, lista vazia, preservação do motivo específico, modo diagnóstico e CLI simulada não vazia nos dois modos. As execuções têm sobreposição e não formam uma soma de testes distintos. O replay de arquivos completos passa nos dois modos, preservando os 34 elegíveis e o limite na posição 35. Não houve aquisição nova no jogo. Naquele ponto, o próximo passo era o uso integrado; ambos os recortes já foram conferidos conforme o resultado no início deste documento.

Pacote para essa validação: `.cache/zzz-portable/20261102-093823-668fd527/gacha-ocr-zzz.zip`; checagem em `20261102-speed/package-check.json`, incluindo 614 hashes, código atual e leitura estática pelo executável com ambiente/cwd independentes dos caminhos de desenvolvimento. Os builds anteriores no cache não contêm necessariamente a última correção; usar o identificador final. [Registro técnico e hash do ZIP](zzz-evidence.md#primeiro-recorte-de-velocidade--02112026).

## Resultado esperado

Reduzir o tempo da coleta útil S/A 20+ com uma mudança localizada, sustentada por medições, preservando os cinco campos, as cópias observadas, os nomes incertos e a recuperação parcial. Não há meta de segundos ou percentual demonstrada. Entregar números antes/depois e seus limites; não chamar um ganho offline de ganho real no jogo.

O usuário prepara S+A, Level decrescente, filtro fechado e topo. O scanner coleta até o primeiro nível confiável abaixo de 20. Esse percurso já funciona; não reabrir a implementação do inventário inteiro nem os testes manuais de NEW!, guardas e prefixos.

## Base e evidência disponível

| Referência | O que permite concluir |
|---|---|
| `D:\Repo\gacha-ocr-zzz\.cache\youkai-p1\runs\20261101-230702-880080ba-selection\session.json` | Pacote real: 34 elegíveis, 35 observados, 34 cliques e uma roda; 116,32 s totais, incluindo preparação; 101,48 s entre primeiro/último dos 151 frames |
| `.cache/youkai-p1/analyses/20261101-portable-live-880080ba/review.json` | 186 imagens e 614 arquivos do pacote íntegros; cinco campos com valores/estados iguais à sessão anterior |
| `.cache/youkai-p1/runs/20261101-195855-9469d5d5-selection/session.json` | Mesma lista e resultado pelo caminho do repositório; imagens locais reutilizáveis |
| `.cache/youkai-p1/runs/20261028-185740-399e71f1-selection/session.json` | Diagnóstico de percurso físico 118/118; não precisa ser repetido para medir o caminho útil |
| `20261023-101543-ad9b1eb4-selection/offline-timing/profile.json`, dentro de `runs/` | Medição antiga de quatro imagens: `read_frame` 1,36–2,41 s; comparação upstream 0,58–1,05 s. Hipótese útil, não benchmark da versão atual |

Hashes completos, correções e limites em [evidências ZZZ](zzz-evidence.md). Referências brutas não entram no Git. Não modificar a pasta portátil existente para investigar; toda saída nova fica no laboratório em `.cache/youkai-p1/analyses/<identificador>/`.

## Ler primeiro no código

| Arquivo / função | Responsabilidade e hipótese a conferir |
|---|---|
| `scripts/youkai_selection.py:main`, `capture_and_record`, `record_inventory` | A captura grava PNG/hash/manifesto; `record_inventory` acrescenta a evidência e salva novamente. Medir custo e confirmar onde uma gravação pode ser consolidada sem perder o registro de falha |
| `scripts/youkai_selection.py:save_report` | JSON temporário/substituição atômica e atualização do HTML. Medir separadamente; manter retentativas Windows e último manifesto válido |
| `scripts/zzz_inventory.py:run_inventory` | Seleção, prova de imobilidade, OCR, corte, resumos e salvamentos. Usar os callbacks existentes para observar etapas; não reescrever a máquina de percurso |
| `scripts/zzz_pilot.py:read_frame` | Leitura dos campos, releituras condicionais, gravação de crops e comparação com `scan_single_frame_engine`. A comparação executa OCR adicional; conferir quem consome seus campos antes de torná-la opcional |
| `scripts/zzz_pilot.py:wait_for_panel` | Confirma seleção e painel estável por frames consecutivos. Os quatro segundos são timeout; não são uma pausa fixa por item |
| `scripts/zzz_transition.py:wait_for_viewport` | Estabilização da lista, independente do painel. Não fundir as duas esperas nem tornar item selecionado requisito da lista vazia |
| `scripts/build_zzz_portable.py`, `packaging/zzz-worker.spec` | O pacote contém código congelado. Uma alteração de Python exige novo build para validar o produto distribuído; mudar o arquivo ao lado do exe não atualiza o código congelado |

## Primeiro recorte: medir sem mudar o resultado

1. Usar as imagens salvas das posições humanas 1, 14 e 34: título reconhecido, título incerto e nível diferente. Incluir a posição 25 se necessário para investigar releitura. Registrar hash das imagens, revisão/hash dos módulos e versões efetivamente usadas.
2. Medir com relógio monotônico o tempo de captura, estabilização, OCR principal/releituras, comparação upstream, escrita de imagens e gravação JSON/HTML/resumo. Coletar contagem de chamadas e bytes/arquivos quando isso ajudar a explicar o custo. Definir fronteiras para não somar spans inclusivos duas vezes.
3. Separar inicialização/importação, tempo esperando F8 e preparação, trecho ativo de aquisição e encerramento. Os timestamps existentes misturam etapas; não atribuir seus 116 s à captura de tela.
4. Manter os tempos em relatório técnico separado ou campos adicionais compatíveis. Não introduzir dependência de profiling, banco, serviço ou dashboard. Medir um conjunto pequeno, registrando primeira execução e variação, sem selecionar apenas o melhor tempo.
5. Medir antes/depois na mesma máquina e nas mesmas imagens. Replays offline medem leitura/escrita; não medem latência de renderização do jogo. Para esse trecho, instrumentar o próximo uso integrado necessário, sem começar uma campanha manual.

Entregar o diagnóstico e escolher o maior custo removível antes de ampliar a mudança. Se as hipóteses abaixo não se confirmarem, registrar o descarte e atacar o custo medido.

## Hipóteses e menor alteração correspondente

| Hipótese falseável | Alteração candidata se confirmada | Condição para aceitar |
|---|---|---|
| Comparação diagnóstica upstream consome parcela relevante sem participar da decisão dos cinco campos | Disponibilizar comparação no modo diagnóstico, sem executá-la em toda leitura normal | Preservar o diagnóstico acessível e as chaves compatíveis; distinguir explicitamente “não executado” de erro ou ausência de resultado. Testar consumidores antes de alterar o default |
| PNGs intermediários e renderização repetida do HTML dominam escrita | Consolidar gravações repetidas e gerar HTML nos checkpoints necessários | Manter imagem selecionada, bruto/crops necessários, hashes, motivo de parada e resumo parcial; evidência em memória precisa ser salva mesmo no erro. Não retirar silenciosamente o rastreio usado pelos diagnósticos |
| Releituras repetem trabalho estável dentro do mesmo item | Reutilizar apenas o valor estável já calculado nessa leitura ou evitar uma releitura comprovadamente redundante | Mesmas decisões de reconhecido/incerto, sem reaproveitar painel de outro item nem transformar cópias iguais em um só registro |
| Captura/transformação de imagem é o maior custo | Investigar a API de captura já usada e conversões duplicadas | Medir isoladamente antes de trocar backend; não justificar troca de tecnologia apenas pela duração total |

Não começar com paralelismo de mouse/OCR, pipeline genérico, redução arbitrária de timeout ou remoção da estabilização. Se uma gravação for adiada, definir o que acontece em F8, perda de foco, falha OCR e erro de disco antes de implementá-la.

## Verificações e aceite

- Comparar valores **e estados** de nome, nível, raridade, progressão e lock nas imagens escolhidas. Manter as posições 14/25/34 incertas no OCR enquanto não houver nova evidência; confirmação humana de sessão anterior não corrige o leitor.
- Rodar os testes dos caminhos alterados: `test_zzz_pilot.py` para leitura, `test_zzz_report_save.py` para persistência, `test_zzz_inventory.py`/`test_zzz_inventory_scope.py`/`test_zzz_level_cutoff.py` para percurso e pendências. Usar seleção de casos proporcional; não repetir a suíte inteira por rotina.
- Garantir lista vazia sem painel, barra comprovadamente ausente versus ilegível, parada no nível baixo, nível desconhecido sem exclusão, ordem contraditória e parcial recuperável. Reaproveitar as simulações existentes.
- Se mudar gravação, testar falha no checkpoint que mudou e preservação do último manifesto válido. Não esconder exceção para ganhar tempo.
- Construir novo pacote apenas depois da alteração medida; conferir relocação e uma imagem offline pelo executável. Não substituir ou apagar o ZIP já validado.
- Se uma aquisição real for necessária, agrupar tudo numa única sessão acompanhada: preparação usual, iniciar, voltar ao jogo, pressionar/soltar F8 quando solicitado e aguardar sem mexer. Conferir resultado e tempo; pedir somente `session.json`. Não solicitar lista inteira, ensaio de guardas ou novas fotos por rotina.

Aceite: melhoria localizada com ganho demonstrado no trecho medido, sem regressão dos dados/guardas; diff, comandos e resultado das verificações; riscos e limitações explícitos. Se só houver ganho offline, registrar assim. Não existe velocidade prometida a atingir para liberar a interface.

## Saída para a etapa seguinte

Atualizar este plano/ROADMAP com a mudança realizada, medições e referências locais. A etapa seguinte é a [interface simples](desktop-ui-plan.md), ainda **antes do HSR**. Preservar o executor CLI como caminho técnico e manter as instruções operacionais em português simples. Não criar um handoff até Cristian pedir.
