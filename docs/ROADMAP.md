# Planejamento — scanner local e motor compartilhado

Atualizado em **23/10/2026**. Plano canônico, revisado após as sessões reais de 54 posições e da linha com NEW!. **Estamos em P3.3: o percurso intermediário funciona; falta fechar escopo, cobertura e fim do inventário ZZZ.** O motor multijogo e o pacote Python independente ainda não existem.

## Objetivo e prioridades

Entregar um aplicativo Windows que capture armas/equivalentes, faça OCR local, preserve cópias e permita revisar/salvar o inventário. Um núcleo compartilhado cuida de janela, coordenadas, ações, captura, execução OCR, sessão e revisão; cada jogo mantém interpretação e estratégia de percurso próprias.

1. Reaproveitar código executável e verificável.
2. Entregar ZZZ completo antes de ampliar a arquitetura.
3. Comprovar compartilhamento com HSR, sem duplicar o scanner.
4. Completar **Genshin → WuWa → NTE**, um por vez.
5. Exportar dados revisados ao Advisor; avaliar outras categorias depois.

Condições confirmadas por Cristian:

- Windows, jogos em inglês e uma entrada para o aplicativo. ZZZ inicialmente em janela, área cliente **1280×720**, escala Windows **100%**.
- **ZZZ: W-Engines S/A de todos os níveis e progressões.** B é exclusão/evidência, nunca item do inventário-alvo. Genshin: armas 4/5 estrelas; demais jogos terão escopo definido antes da coleta.
- Inventário preparado manualmente, jogo visível em primeiro plano e controles exclusivos durante a aquisição. Navegação desde menus não é requisito inicial.
- OCR local, sem credenciais/API paga. Imagens, modelos, resultados e temporários fora do Git; nenhum snapshot do Advisor é atualizado automaticamente.
- Software livre compatível é aceitável, com origem e avisos conferidos por arquivo/dependência. Não atribuir uma única licença a todo o conjunto.

## Onde estamos, pela evidência

| Chunk | Estado real | Evidência / limite |
|---|---|---|
| P0 — Seleção da base | Concluído | Youkai Python fixado, riscos e alternativas levantados. |
| P1 — Reprodução isolada | Concluído no recorte | Fonte/dependências fixadas, OCR offline, captura e três seleções reais. Não foi uma coleta completa. |
| P2 / P3.1 — Piloto e proteções | Conferidos no ambiente inicial | Dez posições, cópias, F8 em curso, perda de foco e movimentação da janela. Resize/DPI diferentes só simulados. |
| P3.2 — Transição | Conferido | Uma roda real desloca uma linha. Clicar na última linha não rolou neste ambiente; essa hipótese foi descartada. |
| **P3.3-A — Percurso intermediário** | **Concluído no recorte** | 54/54 posições, seis linhas e três transições verificadas. Três nomes incertos preservados. Linha adicional: 9/9, NEW!/normais, oito cliques, zero roda, campos conferidos visualmente. |
| **P3.3-B — Escopo e coleta até o fim** | **Próxima implementação** | Filtro/contador S/A, cobertura do início ao fim, borda final e última linha parcial. |
| P3.4 — Uso normal, aceite e pacote | Pendente | Reduzir custo de diagnóstico, revisar/comparar inventários e entregar entrada Windows independente do ambiente de desenvolvimento. |
| P4 — HSR e núcleo comum | Pendente | Segundo jogo comprova as fronteiras reais de compartilhamento. |

A sessão `20261023-103911-485104ab-selection` concluiu o prefixo de 54 posições. A sessão `20261023-105454-c3458594-selection` concluiu a linha selecionada: Housekeeper ×3, Starlight Engine Replica ×3, Drill Rig - Red Axis ×2 e Steam Oven ×1; todos A, 0/10, progressão 1 e travados. Etiquetas NEW! nas colunas 4, 7 e 8 não geraram falsas seleções. Foram conferidos hashes de 40 frames e 11 imagens adicionais, versões dos quatro módulos e 260 arquivos upstream; revisão separada em `row-review.json`, sem alterar o manifesto ou aprovar dados como humanos.

**Essas provas encerram os recortes, não o inventário inteiro.** As nove leituras sem incerteza não medem a precisão geral do OCR. Os três nomes incertos do prefixo continuam pendentes; ausência de B/destravado nessa linha também continua explícita.

## Revisão crítica e decisões

- **O avanço foi real, mas fragmentado demais.** Captura, cliques, guardas, leitura e várias rolagens funcionam. O planejamento antigo continuava pedindo repetir 54 posições já concluídas. A próxima entrega precisa mudar o resultado disponível: sair de prefixo limitado para inventário com cobertura explicável.
- **Não aumentar o limite de 54 para 100/180 como próximo marco.** Isso exercita mais do percurso intermediário e continua sem resolver a última linha, a contagem ou o término.
- **A base Youkai continua útil.** Reutilizamos APIs de captura, calibração, grade, controle e OCR com fonte original preservada. Seleção, campos e percurso ZZZ receberam adaptações onde os dados reais mostraram divergências. Não há motivo atual para outra pesquisa ampla ou troca de base.
- **Não extrair agora um framework multijogo.** O segundo jogo deve revelar quais fronteiras compartilhar. Ao fechar ZZZ, separar apenas o executor de sessão necessário para não acumular comportamento de produto no lançador de diagnóstico.
- **Separar cobertura de qualidade dos campos.** Um nome incerto não deve interromper a captura nem desaparecer do resultado. Cobertura completa pode coexistir com pendências OCR; inventário aprovado exige revisão explícita.
- **Velocidade é trabalho de produto.** Hoje a cadência observada é cerca de 2,4–2,5 s entre cliques, com OCR duplicado e escrita extensa de diagnóstico. Não prometer esse tempo como definitivo nem velocidade igual a outro scanner. Remover custos medidos mantendo seleção/painel corretos; evitar paralelismo complexo antes de medir o ganho simples.

## Próximo chunk — P3.3-B: escopo e término em uma entrega

**Resultado esperado:** uma sessão percorre o inventário preparado do início ao fim, preserva cada posição/cópia, identifica itens S/A e explica quando a cobertura está confirmada ou por que ficou incompleta. O limite de segurança deixa de ser o motivo normal de conclusão.

### 1. Fechar a preparação e a semântica de contagem

- Preferir **filtro S/A preparado manualmente**, se o jogo oferecer essa combinação. Confirmar disponibilidade e efeito real antes de depender dele; não implementar navegação de menus para resolver isso.
- O cabeçalho observado `1567/2000` é **candidato global**. Ainda não sabemos se muda com o filtro. Não usá-lo como quantidade S/A sem prova.
- Se não houver filtro adequado, escolher explicitamente entre percorrer a lista global com B excluído ou usar ordenação por raridade comprovada. Não cortar na primeira raridade inferior por suposição; raridade incerta não autoriza corte.
- Uma referência de contagem independente ajuda a conferir cobertura. Se o jogo não a fornecer, documentar a alternativa por início/fim, ocupação e transições verificadas; sem evidência suficiente, manter cobertura pendente.

### 2. Implementar a borda final e a cobertura

- Identificar início, posições novas e último cartão; lidar com inventários menores que uma tela e linha final parcial.
- Tratar o alinhamento do último viewport: perto do fundo, a roda pode deslocar menos de uma linha. A hipótese intermediária de uma linha exata não deve decidir o fim.
- Combinar ocupação da grade, âncoras/sobreposição, seleção e scrollbar para distinguir fim, clique perdido e roda sem progresso. Se a evidência for ambígua, preservar a parcial e explicar a pendência.
- Não usar igualdade de nome, campos ou painel como identidade da cópia ou prova de fim. Não gerar duplicatas ao rever a mesma posição nem fundir novas posições visualmente iguais.
- Manter limites de segurança, guardas e salvamento parcial. Limite atingido ou timeout significa incompleto, nunca sucesso integral.
- Resumo deve separar posições visitadas, S/A, B excluídos, raridade pendente, campos incertos, cobertura e motivo de encerramento. Não promover `inventoryAccepted` automaticamente.

### 3. Preparar tudo localmente antes da próxima execução

- Reaproveitar as imagens existentes para os três nomes incertos, NEW!, nível zero e cópias. Não pedir novas capturas desses casos por rotina.
- Simular especialmente cauda curta, deslocamento final parcial, ausência de progresso e interrupção. Reprocessar as sessões reais como regressão das regras alteradas; não repetir toda a bateria sem relação com a mudança.
- Caso faltem referências de filtro/fim, solicitar **um conjunto agrupado**: lista/cabeçalho antes e depois do filtro, opções de filtro e cauda. Esse recurso serve para fechar um contrato visual; não abre uma sequência de testes manuais de cliques.
- Quando pronto, pedir **uma coleta completa integrada** que reúna início, várias fronteiras, cauda, resumo e evidências automáticas de falha. Cristian envia apenas `session.json`. Se falhar, corrigir a partir dos artefatos antes de pedir outra.

**Critério de saída:** percurso completo demonstrado, escopo explícito e cobertura sustentada por evidências; pendências de campo separadas. Uma repetição estável sozinha não prova completude.

## P3.4 — Tornar o ZZZ utilizável e aceitar a entrega

1. **Uso normal e revisão:** separar comparação OCR upstream e diagnóstico exaustivo do caminho normal; reduzir PNG/HTML redundantes sem perder imagem/evidência por posição e falha. Medir tempos no próprio fluxo, sem pedir benchmark manual isolado. Oferecer uma entrada ZZZ, resultado revisável e resumo/comparação de sessões; não criar uma UI ampla.
2. **Pacote Windows:** preferir pacote de pasta com um exe de entrada, runtime, OCR/modelos e avisos necessários. Verificar lançamento sem Node/Python de desenvolvimento; o lançador legado Genshin não equivale a esse pacote.
3. **Aceite integrado:** aproveitar a primeira coleta completa válida de P3.3-B. Fazer a segunda, preferencialmente já pelo pacote, com inventário estável; comparar contagem e multiplicidade de cópias, conteúdo e transições. Conferência visual agrupada de início/meio/fim e casos relevantes dá controle adicional contra erro sistemático. Não exigir nova campanha de F8/foco/geometria já conferidos sem mudança relacionada.
4. **Pendências honestas:** nomes desconhecidos/incertos continuam visíveis para revisão; divergências não alteram o bruto. Ajustes do executável exigem validação proporcional à mudança, sem reiniciar automaticamente todo o histórico.

**Pronto para seguir:** duas coletas completas conferidas com evidência de cobertura, resultado útil/revisável e entrada Windows utilizável. Amostras usadas para corrigir o leitor são desenvolvimento/regressão; não chamá-las de avaliação independente.

## Depois do primeiro jogo completo

| Etapa | Entrega / critério |
|---|---|
| **P4 — HSR e núcleo compartilhado** | Definir raridades, ler referências existentes, integrar interpretação/percurso pertinentes do HSR-Scanner. Extrair janela, captura, ações, OCR, sessão e revisão a partir dos dois usos reais. Piloto e duas coletas completas; ZZZ continua funcionando. Progressão ausente não vira 1. |
| **P5 — Genshin** | Perfil 16:10 e armas 4/5 estrelas; aproveitar evidência anterior e procedimentos pertinentes do Kamera. Conferir duas coletas completas, sem portar automaticamente ferramentas/heurísticas legadas. |
| **P6 — WuWa** | Qualificar fonte, escopo/perfil de armas e OCR adequado; fluxo completo aceito e regressão dos anteriores. |
| **P7 — NTE** | Primeiro verificar categoria, inglês, tela e fonte útil. Não copiar scanner de outras categorias/idiomas como se já servisse. |
| **P8 — Exportação e Advisor** | Exportar somente dados revisados, com procedência, pendências e diff. Ausência no scan não remove fatos da conta; aplicação explícita. |
| **P9 — Expansão** | Avaliar personagens, artefatos e equivalentes por necessidade, depois do fluxo de armas. |

Não estimar prazos por quantidade de testes/arquivos. Núcleo comum significa contratos compartilhados, não impor o mesmo algoritmo de seleção/rolagem/fim a todos os jogos. Se HSR exigir copiar o scanner ou grandes condicionais no núcleo, corrigir a fronteira antes de Genshin.

## Protocolo de validação com poucas intervenções

- Uma sessão por entrega funcional, com o máximo de contexto relevante. Pedido manual informa comportamento, resultado esperado e um único caminho de saída a enviar.
- Usar primeiro arquivos salvos, replays e simulações; teste manual só para dúvida que eles não resolvem. Analisar cada falha antes de solicitar repetição.
- Não repetir captura, piloto, F8, foco, geometria, uma roda ou linha NEW! já conferidos por rotina. Ensaio isolado apenas por falha concreta ou pedido explícito de Cristian.
- Campos corretos, incertos e incorretos aceitos são métricas distintas. Dois scans iguais não provam cobertura sozinhos; contagem coincidente também não prova conteúdo.
- Sessão parcial permanece válida como evidência. Revisão do assistente não se apresenta como aprovação humana.

## Materiais e histórico

A [arquitetura e pesquisa de fontes](architecture-proposal.md) detalham os candidatos. A fonte Youkai está fixada em `86a8b34511c86ec864d8f40c558789f7ccad4cc9`, com dependências/runtime no cache isolado e original preservado. Reprodução e limitações: [P1.1](youkai-qualification.md), [imagens pessoais](youkai-personal-images.md), [captura](youkai-capture.md), [seleção](youkai-selection.md), [piloto](zzz-pilot.md), [transição](zzz-transition.md) e [percurso integrado/diagnósticos](zzz-scan.md). Esses documentos conservam os resultados históricos; a próxima ação é a deste roadmap.

O experimento JavaScript Genshin/HSR permanece preservado e congelado para novas funcionalidades durante esta rota. Seus leitores de imagem e o [scanner Genshin legado](genshin-scanner.md) não comprovam o motor Python nem inventário completo. Os IDs P0–P9 pertencem à rota atual, separados dos antigos marcos M. GOOD/ZOD e demais formatos de consumidor são posteriores; não remover incerteza para caber num export.

**Próximo passo recomendado:** implementar **P3.3-B — escopo e término**, após fechar as referências de filtro/cauda necessárias. Não solicitar novamente o prefixo de 54 ou a linha de nove. Esta revisão atualiza diagnóstico e planejamento; não implementa essa próxima funcionalidade.
