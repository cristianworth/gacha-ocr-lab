# Planejamento — motor compartilhado de OCR

Atualizado em 20/10/2026. **Planejamento recomendado; o novo motor Python ainda não foi implementado.** Este documento é o plano canônico. A [arquitetura e pesquisa de fontes](architecture-proposal.md) explicam as alternativas; o [README](../README.md) descreve o software que existe hoje.

## Objetivo, prioridades e escopo

Entregar um aplicativo Windows com um motor compartilhado para ler armas e equivalentes nos cinco jogos, salvar inventário local e permitir revisão. O motor cuida de janela/coordenadas, ações, captura, OCR, sessão e revisão. Cada jogo fornece perfil visual, interpretação e estratégia de percurso.

Prioridades, em ordem:

1. Reaproveitar código existente que possamos executar e verificar.
2. Entregar um primeiro jogo completo, com resultado útil e conferível.
3. Demonstrar que o segundo jogo usa o mesmo núcleo, sem copiar o scanner.
4. Completar os cinco jogos, um por vez.
5. Exportar dados revisados ao Advisor e avaliar outras categorias.

**Ordem recomendada: ZZZ → HSR → Genshin → WuWa → NTE.** ZZZ usa o ambiente de origem da candidata a base; HSR verifica cedo outro percurso em Python; Genshin acrescenta 16:10 e referências já conhecidas; WuWa amplia condições visuais/OCR; NTE tem mais lacunas de fonte e idioma.

Confirmado por Cristian:

- Windows exclusivo, interface dos jogos em inglês e um aplicativo de entrada.
- Resolução pode ser ajustada por jogo; primeiro ZZZ em janela 16:9 e escala Windows 100%. Área cliente 1280×720 confirmada por Cristian e exercitada offline em três prints; aquisição/inputs ainda precisam da prova real. Outra resolução terá validação própria.
- **ZZZ: somente W-Engines S e A**, de todos os níveis/progressões. B só pode aparecer como evidência de exclusão ou teste negativo, nunca como item do inventário-alvo.
- Genshin mantém armas 4/5 estrelas. Raridades dos jogos seguintes serão definidas antes de suas coletas, sem aplicar automaticamente esses filtros.
- Jogo visível em primeiro plano e uso exclusivo dos controles durante a coleta.
- Aceitação de licença de software livre compatível para priorizar reaproveitamento, após conferir arquivos/dependências.
- OCR local, sem credenciais/API paga, imagens/resultados/modelos fora do Git e nenhum snapshot do Advisor atualizado automaticamente.

Python e Youkai permanecem a recomendação técnica, condicionada à prova prática P1. P1.1/P1.2 offline foram executados; em 20/10/2026 Cristian autorizou revisar o plano e avançar à captura única P1.3. Isso não registra uma migração ou inventário completo já aceito.

## Revisão crítica da rota — 20/10/2026

O objetivo é um coletor utilizável nos cinco jogos. Até aqui, comprovamos leitores por imagem Genshin/HSR; ainda não aceitamos um inventário completo. A quantidade de testes, commits ou documentos não substitui esse resultado.

- **Reaproveitamento tardio:** o scanner Genshin criou visão/percurso próprios antes de reproduzir o comportamento da referência. Os ajustes de máscaras, cores e seleção resolveram casos locais, mas o piloto real continuou sem aceite. A próxima base deve ser executada antes de ser generalizada.
- **Compartilhamento parcial:** `src/read-weapon.js` já compartilha o processamento de imagem entre Genshin/HSR. Porém, `src/scan-inventory.js` importa visão Genshin e fixa jogo/preparação; `src/inventory-session.js` aceita somente Genshin. Não temos um coletor multijogo comprovado.
- **Generalização antecipada:** o plano anterior colocava extração do núcleo e um perfil HSR antes do primeiro piloto ZZZ. Isso aumenta a superfície de mudança antes de saber se captura, seleção e OCR da base funcionam juntos. P2 passa a ser uma adaptação pequena para dez posições; P4 comprova e refina as fronteiras com HSR.
- **Planejamento sem nova evidência executável:** os três commits anteriores a esta revisão alteraram documentação. A próxima entrega de implementação precisa produzir uma execução reproduzível e um diagnóstico, em vez de outra reformulação de arquitetura.

Manter Python/Youkai como hipótese de maior reaproveitamento, sem tratar a escolha como garantia. Preservar o experimento JS e seus exemplos confirmados; congelar novas funcionalidades nele durante a prova. Não portar automaticamente suas ferramentas, todos os testes ou seus detectores.

O núcleo comum é uma direção de projeto. Compartilhar captura, coordenadas, emissão de ações, OCR e persistência é plausível; seleção, rolagem, confirmação e término exigem estratégias por jogo. Não obrigar percursos diferentes ao mesmo algoritmo nem esconder comportamento em um arquivo de coordenadas.

**Regra de decisão:** se reproduzir o caminho W-Engines exigir reconstruir captura, grade e reconhecimento antes do piloto, interromper a extração e comparar a base HSR já levantada. Trocar a ordem é preferível a reconstruir um scanner para justificar a escolha inicial. Não iniciar outra pesquisa ampla sem uma falha concreta que a justifique.

**Adiar:** framework de plugins, UI nova, navegação desde o menu principal, outras categorias, suporte amplo a resoluções e empacotamento independente antes do fluxo funcionar. A entrada elevada necessária ao piloto permanece no escopo; validação do pacote sem ferramentas de desenvolvimento fica no aceite P3. Preservar desde o início parada, foco, sessão parcial, dados brutos, incerteza e cópias distintas.

## Levantamento concluído — P0

| Evidência verificada | Consequência no plano |
|---|---|
| Youkai tem scanner Python de W-Engines, módulos de captura/grade/OCR, 33 arquivos de testes Python e empacotamento onedir | Reproduzir uma versão fixada antes de extrair código. Quantidade de arquivos não mede cobertura nem significa testes executados. |
| Há release portátil v1.0.8 com arquivo de checksum, além de capturas de referência e casos de W-Engines | Podemos fazer verificações offline antes de pedir novas execuções. Referências públicas ficam no cache ignorado, não no Git do laboratório. |
| Dependências Python usam limites amplos, como versões mínimas | Fixar versões resolvidas, Tesseract/modelo e hashes na primeira prova. Um SHA do código sozinho não congela o comportamento. |
| README e metadados do catálogo indicam 1.4; arquivo contém 99 entradas e data de atualização própria | Conferir nomes atuais com capturas. O nome da pasta não prova catálogo desatualizado; tampouco suas 99 entradas provam completude atual. |
| O scanner calcula raridade, mas sua saída de W-Engine não a preserva como campo do item | Expor evidência e classificação S/A/B antes de implementar nosso filtro. Não filtrar apenas pela confiança ou pelo nome. |
| O classificador usa números internos 4=S, 3=A e 2=B | Interpretar como códigos do módulo ZZZ, não estrelas universais; não usar o corte Genshin 4/5 no ZZZ. |
| Contagem de estrelas retorna no mínimo 1, inclusive quando não detecta estrela; há teste que espera esse comportamento | Adaptar ao contrato: falta de evidência é incerta, não progressão 1 reconhecida. Não copiar esse teste como nosso critério de qualidade. |
| Grade trata painel repetido como possível clique perdido e possui caminho que pula uma célula permanentemente parada | Preservar cópias visualmente iguais e registrar observações falhas; não omitir posições silenciosamente. |
| No PATH desta inspeção, Python apontou para o alias WindowsApps e Tesseract não foi localizado | Preparar runtime isolado e OCR nativo. Isso não prova ausência de instalações em outros caminhos; não exigir preparação manual de Cristian antes de verificar. |
| Exemplos locais fornecidos: Aqua Genshin e quatro imagens HSR; não há captura pessoal ZZZ nessa pasta | Precisamos de referências reais ZZZ para confirmar compatibilidade. A pesquisa e os testes offline independentes podem avançar antes disso. |

Fonte principal fixada nesta revisão: [Youkai](https://github.com/AJTDaedalus/youkai), commit 86a8b34511c86ec864d8f40c558789f7ccad4cc9. No levantamento P0 foram lidos módulos, testes, configuração de build, avisos e metadados; **não houve execução naquela pesquisa**. A reprodução offline P1.1 posterior está registrada abaixo e no relatório específico; o candidato ainda não está aceito para coleta.

## Etapas e critérios de avanço

| Etapa / estado | Entrega concreta | Critério para avançar |
|---|---|---|
| **P0 — Concluído neste planejamento** | Escopo, pesquisa, riscos concretos, sequência e protocolo de validação | Plano documentado e decisões de uso registradas. Não equivale a software novo. |
| **P1 — Base ZZZ em qualificação** | Instalação isolada, fonte/dependências fixadas, testes e leitura offline pelo caminho original | Base executável com limitações medidas; confirmar captura/avanço controlado antes de reorganizar. Se exigir reconstrução, reavaliar o candidato. |
| **P2 — Piloto ZZZ com adaptação mínima** | W-Engines S/A, evidências/JSON/revisão simples e dez posições | Seleções reais, imagens correspondentes, estados honestos, cópias preservadas e paradas verificadas. Não depende de abstrair os cinco jogos. |
| **P3 — ZZZ completo + executável** | Captura real, piloto, percurso S/A completo, revisão e pacote Windows | Duas coletas conferidas, cópias preservadas, escopo/contagem demonstrados e paradas testadas. Um executável de entrada inicia o fluxo. |
| **P4 — HSR e núcleo comprovado** | Extrair responsabilidades comuns a partir de ZZZ funcional e integrar perfil/parser/percurso HSR | Piloto e duas coletas completas; reusar janela, captura, OCR, sessão, cancelamento e revisão sem forçar o mesmo algoritmo de percurso. |
| **P5 — Genshin no mesmo motor** | Perfil 16:10, procedimentos aproveitados do Kamera e coleta 4/5 estrelas | Regredir imagens confirmadas, conferir raridade/cópias/transições e aceitar duas coletas completas. |
| **P6 — WuWa** | Qualificação da fonte, perfil de armas, percurso e integração do OCR adequado | Um fluxo completo aceito e regressão dos anteriores; trocar OCR não duplica o motor de coleta. |
| **P7 — NTE** | Primeiro confirmar categoria de arma, inglês, tela e fonte útil; depois imagem/piloto/coleta | Não iniciar copiando o scanner chinês de outras categorias. Definição do módulo depende desse levantamento específico. |
| **P8 — Exportação e Advisor** | Exportações revisadas, contrato de troca e aplicação explícita | Procedência, pendências e diff preservados; ausência no scan não remove automaticamente fato da conta. |
| **P9 — Avaliar expansão** | Decidir personagens/progressões/artefatos e equivalentes, por necessidade | Cada categoria acrescenta perfil/parser/percurso ao núcleo; não copiar todos os recursos dos projetos de origem. |

P6–P9 ficam no nível de marcos até aprendermos com os primeiros jogos. Não estimar prazo a partir de README, número de testes ou tamanho do repositório. Estimar o bloco seguinte depois da prova de compatibilidade, usando o trabalho observado.

## P1 — Prova prática da base

### P1.1 Preparar sem reestruturar

**Executado isoladamente em 20/10/2026:** 273 testes upstream aprovados, 5 pulados por fixtures ausentes; OCR original em duas referências públicas, sem patch da candidata. [Roteiro, versões/hashes e limitações medidas](youkai-qualification.md). Cristian autorizou diretamente a continuidade da qualificação em 20/10/2026. A parte offline de P1.2 foi executada posteriormente, conforme a seção abaixo; captura/avanço reais seguem pendentes.

- Conferir origem/SHA e avisos dos arquivos selecionados. Usar cache/diretório local isolado, sem tocar nos logs ou na instalação pessoal de outro scanner.
- Verificar runtime Python real e criar ambiente isolado, fixando dependências resolvidas. Providenciar Tesseract e inglês localmente, com versões/hashes. Não instalar o aplicativo inteiro para obter apenas o scanner Python.
- Identificar o subconjunto de módulos necessário. Interface Rust, outras categorias e pastas de referência alheias ao OCR não fazem parte da primeira entrega.
- Executar primeiro os testes upstream relevantes para captura, grade, reconhecimento e W-Engines. Registrar pass/fail/skip e fixtures ausentes; não chamar um teste pulado de sucesso.

**Saída:** roteiro de instalação reproduzível e relatório curto do que foi possível executar. Se o ambiente/build exigir reescrever a base inteira, revisar o candidato antes de migrar o laboratório.

### P1.2 Conferir com imagens

**Parte offline executada em 20/10/2026:** três capturas atuais 1280×720 com recorte cliente explícito, sem redimensionar ou modificar a candidata. Nome/nível e a consulta separada de raridade conferem visualmente; progressão diverge em dois casos. Referências humanas confirmadas por Cristian em 20/10/2026; captura/avanço reais permanecem pendentes. [Comando por arquivo e limitações](youkai-personal-images.md).

- Usar capturas públicas do candidato apenas como desenvolvimento/regressão, respeitando procedência.
- Solicitar um conjunto compacto de capturas atuais de Cristian e referências dos campos. Não é necessário fornecer tudo de uma vez.
- Comparar nome, nível/limite, progressão e raridade. Nome fora do catálogo permanece bruto/candidato; não escolher o vizinho mais próximo silenciosamente.
- Identificar se as falhas são de instalação, regiões/layout, tratamento, catálogo ou interpretação. Não ajustar tudo ao mesmo tempo.

**Saída por arquivo concluída:** OCR original sobre três imagens atuais, referências humanas confirmadas e divergências preservadas. O resultado original é diagnóstico, não inventário aprovado. A aquisição e o avanço ficam explícitos no subpasso seguinte.

### P1.3 Captura e avanço controlados — atual

1. **Captura única, sem inputs:** executar o caminho original em janela única, 1280×720/100%, conferindo foco e geometria antes/depois. Salvar imagem cliente, prévia da grade e relatório de falha/parada. [Comando e evidências](youkai-capture.md). Implementado e exercitado com 14 testes simulados; a consulta real não encontrou janela ZZZ disponível. Captura real permanece pendente.
2. **Conferir a aquisição:** inspecionar imagem/36 pontos e reler o arquivo capturado. Nenhum clique antes dessa conferência. A prévia offline já coloca os pontos dentro dos cartões dos prints fornecidos, mas não comprova entrega de input.
3. **Avanço pequeno:** preparar foco/geometria, parada efetiva e limite de poucas posições antes do ensaio combinado com Cristian. Registrar imagens anterior/posterior e posição; parar em perda de foco, mudança de janela ou falha. Conferir Escape nativo antes de usar o candidato; F8 do laboratório não é presumido nele.
4. **Decisão:** se aquisição/avanço originais exigirem reconstrução, aplicar a regra de reavaliação da candidata. Se funcionarem, seguir à adaptação mínima P2. Pode agrupar esse ensaio e o piloto em uma janela de teste após preparar as correções necessárias; não iniciar coleta completa.

**Critério:** aquisição real inspecionável e seleção limitada rastreável, com parada conhecida; testes simulados/prints salvos não encerram esta etapa.

## P2 — Adaptação mínima e piloto ZZZ

### P2.1 Reutilizar antes de reorganizar

- Partir da versão qualificada em P1. Preservar seu caminho funcional de captura, seleção e reconhecimento; registrar arquivos de origem/SHA, avisos e alterações.
- Começar no inventário de W-Engines já preparado. Não trazer interface Rust, navegação geral ou outras categorias.
- Uma entrada local, com elevação quando necessária, oferece captura e piloto limitado. Um comando/lançador basta; distribuição independente não bloqueia o piloto.
- Separar somente as fronteiras necessárias para repetir OCR em arquivo e injetar captura/ações nos testes. Não construir o perfil HSR nem extrair toda a grade nesta etapa.

### P2.2 Contrato pequeno e correções necessárias

Cada observação mantém jogo/categoria, posição/ordem na sessão, versão do leitor, captura, texto bruto/evidência visual, candidatos, estados e decisão de escopo. Um JSON versionado e uma revisão local simples bastam. Não migrar resultados antigos nem impor uma entidade universal para progressões de jogos distintos.

- Preservar raridade S/A/B, distinguindo-a de códigos internos numéricos.
- Falta de estrelas não vira progressão 1; raridade incerta vira pendência. Casos P1.2 confirmaram estrelas claras e recorte que termina antes da quinta: corrigir região e detector em conjunto, preservando a saída original como comparação.
- Falha de célula permanece no relatório, mesmo sem item válido.
- Igualdade de nome, atributos ou imagem não funde cópias nem prova clique perdido.
- Catálogo auxilia normalização; nomes desconhecidos mantêm bruto/candidatos, sem correção silenciosa.
- Separar término do percurso, cobertura, processamento e revisão humana. Salvar a sessão parcial em falhas/parada.

### P2.3 Prova real em dez posições

- Primeiro conferir captura cliente e sobreposição de regiões/grade. Só iniciar inputs após verificar foco, geometria e mecanismo de parada.
- Executar dez posições (ou as disponíveis), incluindo repetição visual quando houver. Confirmar que ações chegam ao alvo e o painel corresponde à posição esperada.
- Registrar ação/posição, tentativas, captura anterior/posterior nos pontos de falha e interpretação; distinguir captura antiga de erro OCR.
- F8 deve interromper o fluxo do laboratório; perda de foco/mudança de geometria impede novos inputs. Uma parada nativa diferente do candidato precisa ser conferida antes da prova original P1, sem presumir F8 disponível nele.
- Reprocessar arquivos salvos e acrescentar o caso real à regressão antes de pedir repetição. Alterar uma causa por vez.

**Critério:** dez posições rastreáveis, campos conferíveis, falhas explícitas, cópias preservadas e interrupção testada. Não chamar esse piloto de inventário completo. Se P1 já permitir um ensaio de seleção, agrupar os testes de jogo em uma janela combinada, sem exigir execuções redundantes.

## P3 — Primeiro produto completo: ZZZ

### P3.1 Consolidar o piloto aceito

Preservar a entrada, a captura, as paradas e o diagnóstico exercitados em P2. Antes de ampliar o percurso, resolver divergências observadas no piloto, sem reescrever o leitor para acomodar jogos futuros.

### P3.2 Ampliar uma transição de cada vez

Exercitar uma passagem entre telas/linhas e a linha final parcial com limites pequenos antes da coleta completa. Reutilizar evidências de P2; não exigir novo piloto idêntico quando o comportamento já tiver sido conferido. Casos sintéticos cobrem estados indisponíveis na conta, com essa limitação explícita.

### P3.3 Rolagem, escopo S/A e término

- Verificar se o jogo permite filtro S/A e se o contador reflete esse filtro. Não presumir a semântica do número a partir de duas leituras OCR iguais.
- Se o total incluir B, usá-lo apenas como total global. A quantidade S/A precisa de referência própria; registrar cobertura não confirmada quando faltar.
- Corte na primeira raridade inferior exige ordenação comprovável e preparação documentada. Raridade incerta não autoriza corte nem sumiço da observação.
- Verificar primeira/última posição, fronteiras de rolagem, linha final parcial, ausência de progresso e cópias idênticas.
- Uma repetição da tela não deve gerar outra observação; uma nova cópia com atributos iguais deve gerar registro próprio.

**Critério:** percurso e escopo explicáveis com evidências, sem aceitar o fim só porque não houve mudança no nome ou no hash do painel.

### P3.4 Aceite e pacote

- Duas coletas completas do mesmo inventário sem alterações entre elas, comparadas com contagem S/A conferida e evidências das transições.
- Mesma quantidade e conteúdo esperado, sem omissão/fusão silenciosa observada; divergências investigadas, não corrigidas no resultado bruto.
- Campos incertos continuam disponíveis para revisão. Inventário coletado não é inventário aprovado.
- Testar o pacote em ambiente Windows sem Node/Python de desenvolvimento. Incluir/explicitar dependências nativas e modelos. Preferir pacote de pasta, com um exe de entrada, antes de one-file.
- O experimento JS só sai do caminho normal depois do aceite novo. Dados e histórico permanecem intactos.

## P4 — HSR e consolidação do núcleo compartilhado

1. Definir escopo de Cones de Luz e preparar inglês/16:9. Reutilizar as imagens existentes e referências confirmadas para uma primeira leitura em arquivo.
2. Com ZZZ funcionando, extrair suas operações de janela/coordenadas, ações, captura, execução OCR, sessão e revisão nas fronteiras efetivamente usadas pelos dois jogos. Preservar a regressão ZZZ em cada mudança.
3. Reaproveitar interpretação e avanço pertinentes do HSR-Scanner, sem trazer a UI ou controle virtual de outras categorias. Percurso HSR pode usar teclas; a grade ZZZ continua uma estratégia específica.
4. Usar o mesmo processamento/salvamento para imagem ZZZ e HSR. Não criar perfis vazios dos demais jogos. Não duplicar motores nem forçar algoritmos de seleção/fim incompatíveis.
5. Remover o fallback de sobreposição 1 sem leitura válida; manter bruto, evidências e semântica própria do campo.
6. Fazer captura, piloto, transição/fim e duas coletas conferidas, com paradas. Comparar os resultados e repetir regressão ZZZ após alterações compartilhadas.

**Teste decisivo:** o segundo jogo acrescenta perfil/parser/percurso, mas reaproveita as operações e os contratos comuns. Se isso exigir grandes condicionais por jogo no núcleo ou sua cópia, corrigir a fronteira antes de iniciar Genshin. A arquitetura só passa a ser comprovada nesse momento; ler duas imagens não comprova reutilização de coleta.

## Validação com poucas idas e voltas

| Momento | O que o assistente prepara | Participação necessária de Cristian |
|---|---|---|
| Antes do jogo | Instalação, testes relevantes, casos sintéticos, replays e diagnóstico de arquivos salvos | Conjunto inicial de capturas ZZZ atuais e conferência dos campos |
| Uma imagem | Folha de revisão com imagem/recortes e valores candidatos; correções salvas separadamente | Confirmar/corrigir vários exemplos juntos |
| Piloto | Executável/comando concreto, preparação curta, parada e evidências automáticas de falha | Executar um piloto e informar a sessão; não repetir uma falha sem análise |
| Aceite | Instruções agrupadas para duas coletas e testes de parada, relatório comparativo e pendências | Manter inventário estável, executar e conferir contagem/itens necessários |

Conjunto inicial sugerido, não requisito para começar: 6–10 capturas diversas de W-Engines, incluindo S/A, nome longo/em duas linhas, nível abaixo do máximo, progressões diferentes e B como caso negativo se disponível. Uma captura completa atual do inventário já permite começar a conferir layout; não exigir todos os casos da conta.

Capturas usadas para ajustar código passam a desenvolvimento/regressão. Reservar exemplos novos antes de declarar avaliação independente. Medir por campo valores corretos, incertos/ausentes e incorretos aceitos, sem inventar porcentagem geral com amostra pequena. Dois scans iguais também não provam completude sozinhos.

## Materiais, limites e histórico

- Cada sessão guarda capturas, OCR bruto, candidatos, decisões de escopo, motivo de parada e relatório local. Falhas preservam posição/ação esperada, tentativas, evidência e motivo. Esse diagnóstico deve distinguir erro de clique de erro de leitura.
- Modelos, fontes de referência em cache, imagens, saídas e temporários permanecem ignorados pelo Git. Configurar o ignore Python antes de criar ambiente/build ou incorporar código.
- O planejamento P0 não instalou dependências nem executou scanners. P1.1 preparou o ambiente isolado e executou testes/OCR offline, conforme o relatório; nenhum jogo foi controlado.
- O experimento anterior M0/M1/M2 entregou leitores de imagem Genshin/HSR e referências confirmadas. O M3 antigo deixou scanner Genshin experimental, com captura/OCR estáticos e 135 testes JS, mas sem aceite de inventário completo. Eles não validam o novo motor.
- Os novos IDs P0–P9 distinguem este ciclo dos marcos M antigos. O [guia Genshin](genshin-scanner.md) é documentação do experimento legado; Git preserva seu roadmap anterior.
- GOOD/ZOD ou outro formato de consumidor podem ser entregas posteriores. O JSON de diagnóstico e revisão não deve perder incertezas para caber num export.

**Próximo bloco em andamento:** P1.3, captura cliente única com o comando preparado assim que a janela ZZZ estiver disponível, seguida da conferência de imagem/grade. Depois alinhar avanço limitado com paradas e adaptar apenas o necessário ao piloto P2. Nova arquitetura geral só se a prova trouxer uma razão concreta.
