# Objetivo e roadmap — Gacha OCR Lab

## Objetivo e direção atual

Construir um scanner local de inventário para Genshin Impact, Honkai: Star Rail, Wuthering Waves, Zenless Zone Zero e Neverness to Everness. Começar por armas e equivalentes; avaliar outras categorias depois. O fluxo desejado é coletar, interpretar, revisar e exportar dados com evidências e incertezas explícitas.

**Prioridade confirmada em 17/10/2026:** entregar um scanner Genshin utilizável, da captura ao inventário revisável, antes de adicionar os três jogos restantes. Os leitores de uma imagem de Genshin e HSR já existem; não precisam ser refeitos. HSR continua como segundo jogo para receber o fluxo completo.

Decisões confirmadas por Cristian:

- Projetos separados: executável e dados locais no `gacha-ocr-lab`; conhecimento e fatos revisados no `gacha-advisor`.
- Windows, interface em inglês; resolução inicial declarada de jogo 1440×900 em Genshin e HSR. Verificar área útil, escala e modo de janela na coleta real.
- Primeira versão automática: **todas as armas de 4★ e 5★ do Genshin**, preservando cópias distintas. Outras raridades e categorias ficam fora desse primeiro escopo.
- Jogo aberto em **primeiro plano**, com uso exclusivo de mouse/teclado durante a coleta. Funcionamento minimizado ou enquanto o usuário usa outro aplicativo não é requisito dessa versão.
- Entrega completa inicial = **coleta do escopo + JSON de inventário + revisão local**. GOOD, aplicação no Advisor, interface gráfica e instalador não são condições desse aceite.
- Integração com o Advisor permanece uma etapa própria, com revisão e aplicação explícita. Um OCR ou arquivo exportado não atualiza a conta.

As respostas acima definem o escopo; os detalhes de implementação abaixo são a proposta técnica para revisão. Este planejamento não implementa captura, cliques ou rolagem.

## O que aprendemos e o que continua incerto

| Evidência disponível | O que permite concluir | Ressalva e tratamento |
|---|---|---|
| M1: captura Aqua Simulacra confirmada, 8 cartões de desenvolvimento e 4 reservados | Leitor Genshin de nome, nível e refinamento funciona no perfil documentado | Um nível reservado continua incerto. Confiança ou concordância do OCR não garantem correção. Preservar pendências. |
| M2: 2 imagens HSR de desenvolvimento confirmadas e 2 reservadas | A infraestrutura atende a um segundo jogo com regras próprias | Uma sobreposição reservada incerta; todos os níveis reais são 80/80 e ranks somente 1/5. Não bloqueia coleta Genshin; ampliar antes do scanner HSR. |
| 59 testes, smoke test OCR real e regressão de 13 referências Genshin | Regras, contratos e fluxo de arquivo foram verificados; M2 manteve estados/valores de M1 | Não testam janela real, cliques, rolagem, foco ou inventário completo. Não foram reexecutados somente para esta alteração documental. |
| PNGs incluem bordas e tamanhos diferentes da resolução declarada | Coordenadas da imagem salva não são automaticamente coordenadas da área do jogo | Medir área cliente e conversões de coordenadas na máquina real antes de clicar. |
| Inventory Kamera fornece cartões, logs e exports | Referência útil para casos e comparação | Erros explícitos não são rótulos positivos. Saída sem erro ainda precisa de conferência; filtro/data podem diferir do inventário atual. |
| Leitores atuais retornam três campos por jogo | Base suficiente para começar captura controlada | Ainda não leem raridade, não mantêm inventário, não contam cópias e não provam completude. |

**Não há impedimento conhecido para iniciar um piloto de coleta Genshin.** O risco central mudou: além de interpretar um cartão, precisamos demonstrar que cada item elegível foi visitado uma vez, que cópias não foram fundidas e que a execução terminou pelo motivo correto. Incerteza de OCR pode permanecer como pendência; perda silenciosa de item ou declaração falsa de completude impede o aceite.

## Marcos reorganizados

| Marco / estado | Entrega | Critério para avançar |
|---|---|---|
| M0 — Base experimental / concluído | CLI local, imagem → OCR → interpretação → revisão → JSON | Base utilizável para medir comportamento real. |
| M1 — OCR Genshin / concluído no perfil documentado | Uma imagem de arma; nome, nível e refinamento; evidências e revisão | Imagem-alvo confirmada; avaliação por campo e limites registrados. |
| M2 — OCR HSR e infraestrutura compartilhada / concluído no piloto | Uma imagem de Cone de Luz; nome, nível e sobreposição; seleção explícita de jogo | Dois leitores separados por regras, com regressão Genshin preservada. Não equivale a scanner automático. |
| **M3 — Scanner Genshin utilizável / próximo** | Capturar janela, percorrer armas 4★/5★, preservar cópias/evidências, salvar inventário e relatório local de pendências | Teste pequeno e duas varreduras reais completas no escopo, com cobertura conferida; parada/interrupção preservam resultados parciais. Detalhamento abaixo. |
| M4 — Scanner HSR / planejado | Ampliar referências e adaptar coleta ao inventário de Cones de Luz, usando o leitor já existente | Fluxo completo HSR validado sem regredir Genshin; não copiar coordenadas ou regras de navegação. |
| M5 — Completar os cinco jogos / planejado | Adicionar WuWa, ZZZ e NTE, um de cada vez: leitura de uma imagem → coleta pequena → inventário revisável | Cada jogo chega a uma entrega utilizável antes de iniciar o próximo. Ordem entre os três continua proposta, conforme necessidade e material. |
| M6 — Exportação e integração Advisor / planejado | Export revisado por jogo; importação explícita no repositório vizinho, com diff, procedência e conflitos | Dados aprovados e pendentes distinguíveis; nenhuma ausência vira remoção automática de fato da conta. GOOD é uma opção Genshin, não contrato universal. |
| M7 — Avaliar outras categorias / decisão futura | Considerar personagens, progressões, artefatos e equivalentes por jogo | Benefício concreto, referências e escopo próprios; não ampliar armas silenciosamente. |

Sequência principal: **M1/M2 entregues → M3 Genshin completo → M4 HSR completo → M5 demais jogos → M6 Advisor**. Não tornar a eliminação de toda incerteza OCR uma condição para começar captura controlada. Também não expandir jogos enquanto a navegação Genshin ainda perde itens ou não sabe determinar o término.

Correspondência com o plano anterior: M1/M2 mantêm seus IDs e evidências; a antiga coleta M4 passa a M3/M4 e à coleta por jogo em M5; a antiga expansão M3 passa a M5; antigos M5/M6 passam a M6/M7. Não existem dois roadmaps concorrentes.

GOOD pode ser antecipado depois de M3 se houver necessidade concreta, em entrega própria. Exportar GOOD não deve ser tratado como renomear o JSON atual: ainda faltam mapeamento de identificadores e avaliação dos campos exigidos pelo consumidor. Essa antecipação não implica editar o Advisor nem exigir os cinco scanners prontos para produzir um arquivo revisado.

## M3 — Próximas entregas práticas do scanner Genshin

**Definição de pronto:** Cristian prepara o inventário de armas no estado documentado, executa um comando, acompanha a varredura de 4★/5★ e recebe um JSON de inventário e um relatório local. O relatório informa escopo, cobertura, motivo de término, itens lidos, pendentes e falhas, com acesso às imagens. Uma execução interrompida é identificada como parcial. Não exige abrir cada JSON ou cada revisão Markdown individualmente para encontrar problemas.

**Preparação proposta:** inventário aberto na aba Weapons, início da lista, idioma inglês, área cliente compatível com o perfil e ordenação/filtros verificáveis. Esse ponto inicial reduz navegação desnecessária no primeiro scanner. Abrir o jogo, autenticar ou navegar a partir de qualquer tela não faz parte do primeiro aceite.

| ID / estado | Trabalho e artefato | Verificação necessária |
|---|---|---|
| **M3.1 — Escopo confirmado; contrato operacional a detalhar** | Formalizar estado inicial, modo/escala de janela suportados, filtro 4★/5★, ordenação, condições de parada e estrutura da sessão. | Checklist curto e reproduzível; indicar se o total visível conta todas as armas ou apenas o filtro. Não usar esse número sem verificar seu significado. |
| **M3.2 — Planejado: captura sem navegação** | Localizar a janela e capturar a área útil real. Gerar uma imagem e sobreposição de painel/grade, com dimensões e transformação de coordenadas. Escolher a menor solução confiável de captura/input para Windows. | Com o mesmo item selecionado, captura automática passa pelo leitor existente e corresponde à leitura do PNG conferido. Verificar bordas, posição da janela, escala e quadro válido antes de habilitar cliques. |
| **M3.3 — Planejado: controle e persistência básica** | Iniciar sessão local, salvar configuração e evidências progressivamente; implementar tecla de parada e verificação de foco/posição da janela. | Interromper durante captura/espera/OCR preserva o que já foi salvo. Perda de foco ou mudança de geometria interrompe novos inputs; não continuar clicando em outro aplicativo. Reinício cria sessão distinta; retomada automática da navegação fica fora do primeiro aceite. |
| **M3.4 — Planejado: coleta de 5–10 posições sem rolagem** | Selecionar itens de uma grade conhecida, aguardar atualização verificável do painel e capturar cada posição. Usar esperas limitadas e evidências de seleção; não depender somente de um atraso fixo ou da mudança do nome. | Conferir ordem e contagem manualmente, incluindo duas cópias visualmente iguais. Painel antigo, seleção não confirmada ou timeout não podem virar novo item lido com sucesso. |
| **M3.5 — Planejado: elegibilidade 4★/5★** | Verificar filtro real da interface, se disponível, ou reconhecer estrelas/raridade com evidência suficiente. Usar ordenação para reduzir trabalho somente depois de validá-la. Guardar origem da decisão de inclusão/exclusão. | 4★ e 5★ entram, raridades inferiores ficam fora do inventário-alvo, e raridade incerta vira pendência. Não inferir raridade apenas pelo nome nem descartar um item por falha OCR. O leitor atual ainda não fornece essa informação. |
| **M3.6 — Planejado: rolagem e término** | Percorrer linhas/páginas, resolver sobreposição entre telas e última linha incompleta; registrar progresso e condições de término. Testar fim natural, filtro/limite, ausência de progresso e interrupção. | Testes com limites de página e cópias iguais; comparar contagem/primeiro/último e transições. Conteúdo repetido pode ser uma nova cópia ou uma página não avançada: hash do cartão sozinho não resolve. Se o fim/cobertura não puder ser confirmado, declarar isso. |
| **M3.7 — Planejado: inventário de sessão** | Reunir observações sem confundir arma, captura e resultado OCR. Salvar identificador da observação, ordem/posição/progresso, caminho/hash da evidência e estado do processamento. Agregar os três campos sem reescrever os diagnósticos. | Repetição da tela não duplica uma observação; armas com mesmo nome/nível/refinamento não são fundidas. Falha OCR continua visível na sessão. Reprocessar capturas em disco preserva dados e pode ocorrer sem repetir cliques. IDs da sessão não prometem identificar a mesma cópia em execuções futuras. |
| **M3.8 — Planejado: revisão local de inventário** | Entregar um JSON de inventário e relatório com resumo, itens e pendências acessíveis. Uma página HTML estática pode facilitar a conferência; não exige servidor, framework ou aplicação gráfica. Aprovação/correção continua separada. | Conferir um inventário pela visão de sessão, abrir a evidência de cada pendência e salvar feedback rastreável. Separar cobertura da coleta, conclusão do OCR e aprovação humana; a execução terminar não aprova campos. |
| **M3.9 — Planejado: aceite real e entrega repetível** | Rodar piloto pequeno e depois duas varreduras completas do mesmo escopo sem alterar o inventário entre elas. Medir cobertura, duplicações, faltas, leitura por campo, pendências e duração. Fechar comando/configuração e README de uso. | Mesma quantidade de cópias elegíveis nas duas execuções, conferida com referência/manual; nenhuma omissão/fusão silenciosa observada no cenário de aceite. Testar cancelamento, perda de foco e falhas. Comparação com Inventory Kamera é auxiliar e exige mesmo filtro/estado da conta. Não declarar precisão geral ou cobertura universal. |

Encadeamento: **M3.1 → M3.2 → M3.3 → M3.4 → M3.5 → M3.6 → M3.7 → M3.8 → M3.9**. A sessão mínima nasce em M3.3; M3.7 amplia sua agregação, sem esperar até o fim para salvar resultados. Referências, casos de cópias iguais e testes podem ser preparados durante essas entregas. Antes da primeira execução completa, M3.5/M3.6 precisam garantir o escopo e o percurso.

### Três medidas que não podem virar um indicador único

- **Cobertura:** quais posições/armas elegíveis foram visitadas, quais foram excluídas por critério comprovado e por que consideramos o percurso completo. Se não houver total elegível confiável, registrar cobertura não confirmada até conferência; não inventar um denominador.
- **Leitura:** campos corretos, ausentes, incertos e incorretos aceitos. Retentativa limitada pode ajudar, mas não basta escolher a leitura de maior confiança.
- **Revisão:** o que Cristian aprovou/corrigiu e o que segue pendente. Pendência de campo não apaga a existência daquela cópia; aprovação de um item não aprova o restante do inventário.

Uma sessão pode terminar a navegação e continuar com pendências OCR. Pode também ter todos os campos dos itens capturados legíveis e ainda ser um inventário parcial por interrupção. O resultado precisa distinguir esses casos.

### Decisões técnicas propostas para M3

- Manter JavaScript no fluxo existente. Avaliar na captura um helper Windows pequeno se for mais confiável que uma dependência Node; escolher após uma prova de captura/input, sem introduzir backend ou MCP.
- Separar captura/input, percurso do inventário e leitor de uma imagem. O CLI atual continua útil para reproduzir falhas em arquivos salvos.
- Priorizar processamento simples, espera verificada, limites e salvamento progressivo. Medir duração e consumo antes de adicionar paralelismo, filas complexas ou busca por velocidade.
- Não usar nome, atributos ou hash da imagem como identidade única de uma arma. Estado de navegação e evidências devem distinguir observações repetidas de cópias distintas.
- Falhas reais conhecidas de M1/M2 podem virar desenvolvimento em uma nova iteração; deixam então de ser casos independentes. Reservar capturas novas antes de afirmar melhoria na avaliação.
- Manter imagens/sessões/relatórios/modelos locais e ignorados pelo Git. Alterações de contrato de inventário devem ser explícitas; o JSON de um item existente não precisa ser sobrescrito.

A referência Windows distingue área cliente e janela em foco: [GetClientRect](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getclientrect) e [GetForegroundWindow](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getforegroundwindow), consultadas em 17/10/2026. São recursos para a proposta de implementação; ainda não há integração ou captura real testada no laboratório.

## M4 — Próximo jogo completo: HSR

HSR já tem leitor de uma imagem. A expansão deve aproveitar a experiência de uma varredura real Genshin, preservando campos e navegação próprios.

| ID / estado | Próxima entrega | Evidência de aceite |
|---|---|---|
| **M4.1 — Planejado** | Ampliar capturas reais: níveis/limites abaixo de 80, sobreposição 2–4, nomes mais longos e campos cortados/ilegíveis. Definir raridades/filtros desejados para HSR separadamente. | Referências conferidas e novo conjunto reservado; o escopo 4★/5★ de Genshin não é imposto ao HSR sem confirmação. |
| **M4.2 — Planejado** | Adaptar janela, grade, seleção, espera e rolagem à tela de Cones de Luz. Observar interferência/animação do fundo e estabilidade do painel. | Captura única e coleta pequena reproduzíveis; regras de Genshin não são copiadas por semelhança visual. |
| **M4.3 — Planejado** | Executar percurso completo com identidade de observação, pendências, término e revisão de sessão. | Cópias preservadas e cobertura conferida no escopo HSR, incluindo transições e interrupções. |
| **M4.4 — Planejado** | Avaliar reservados novos e repetir regressão Genshin após mudanças compartilhadas; documentar uso dos dois scanners. | Dois fluxos completos utilizáveis; melhorias HSR não alteram silenciosamente a navegação/interpretação Genshin. |

M5–M7 ficam no nível de marcos até aprendermos com M3/M4. Não detalhar agora coordenadas, APIs, campos ou prazos dos três jogos restantes.

## Evidências das entregas concluídas

**M1.1–M1.8:** leitor regional Genshin, seleção explícita de painel, texto bruto, estados e pacote visual. Desenvolvimento: 8/8 corretos por campo. Primeira avaliação reservada: nome 4/4, refinamento 4/4, nível 3/4 e um candidato incerto, sem valor incorreto aceito observado nesses exemplos. Cristian confirmou a captura Aqua Simulacra (90/90, R1) e três referências adicionais; isso não aprova individualmente todo o acervo. Evidências locais: `data/datasets/genshin-weapons.json`, `data/evaluation/baseline/`, `data/evaluation/profile-freeze.json`, `data/research/m1-delivery.json` e `data/research/m1-followup/`.

**M2.1–M2.7:** `--game genshin|hsr`, `itemType: weapon|light-cone` e campos específicos no schema 2. HSR desenvolvimento: firefly e sw_tricky, ambos confirmados e com três acertos. Reservados: phainon e topaz, nome 2/2, nível 2/2 e sobreposição 1/2 mais um candidato incerto. O perfil não foi ajustado sobre esse resultado. Evidências locais: `data/datasets/hsr-light-cones.json`, `data/evaluation/hsr-profile-freeze.json`, `data/reviews/m2/` e `data/research/m2/delivery.json`.

A última entrega executável teve 59 testes aprovados, smoke test de OCR real e 13 referências Genshin com estados/valores inalterados. Os testes de sucesso com OCR simulado são identificados como sintéticos e não medem reconhecimento. Novos congelamentos vinculam jogo, modo, perfil, manifesto, IDs, núcleo/lock e métricas; modelos em cache/runtime não são congelados. O freeze antigo Genshin permanece histórico após mudanças compartilhadas de M2. Repetir casos já examinados é regressão, não avaliação independente.

Este é o plano canônico. O [README](../README.md) descreve o programa atualmente executável; [inventory-kamera.md](inventory-kamera.md) registra a referência. Git preserva o detalhamento histórico das entregas. O planejamento não altera o Gacha Advisor, não publica dados pessoais e não pressupõe automação já implementada.