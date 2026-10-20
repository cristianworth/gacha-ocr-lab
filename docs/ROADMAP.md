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
- Resolução pode ser ajustada por jogo; primeiro ZZZ em janela 16:9 e escala Windows 100%. Perfil inicial proposto: área cliente 1280×720. Outra resolução terá validação própria.
- **ZZZ: somente W-Engines S e A**, de todos os níveis/progressões. B só pode aparecer como evidência de exclusão ou teste negativo, nunca como item do inventário-alvo.
- Genshin mantém armas 4/5 estrelas. Raridades dos jogos seguintes serão definidas antes de suas coletas, sem aplicar automaticamente esses filtros.
- Jogo visível em primeiro plano e uso exclusivo dos controles durante a coleta.
- Aceitação de licença de software livre compatível para priorizar reaproveitamento, após conferir arquivos/dependências.
- OCR local, sem credenciais/API paga, imagens/resultados/modelos fora do Git e nenhum snapshot do Advisor atualizado automaticamente.

Python e Youkai permanecem a recomendação técnica, condicionada à prova prática P1. O pedido atual autoriza o levantamento e o plano, não registra uma migração já realizada.

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

Fonte principal fixada nesta revisão: [Youkai](https://github.com/AJTDaedalus/youkai), commit 86a8b34511c86ec864d8f40c558789f7ccad4cc9. Foram lidos módulos, testes, configuração de build, avisos e metadados; **não foram executados os testes ou o scanner do Youkai**. O candidato ainda não está aceito.

## Etapas e critérios de avanço

| Etapa / estado | Entrega concreta | Critério para avançar |
|---|---|---|
| **P0 — Concluído neste planejamento** | Escopo, pesquisa, riscos concretos, sequência e protocolo de validação | Plano documentado e decisões de uso registradas. Não equivale a software novo. |
| **P1 — Qualificar a base ZZZ / próximo** | Instalação isolada, fonte/dependências fixadas, testes relevantes e leitura offline de W-Engines atuais | Instalação reproduzível; resultados e falhas conhecidos. Há um caminho executável para reaproveitar, sem exigir reconstruir o candidato inteiro. |
| **P2 — Núcleo comum e primeiro perfil** | Reaproveitar captura/coordenadas/OCR, separar perfil/percurso ZZZ e salvar sessão/revisão | Fluxo por arquivo funciona; dados não lidos permanecem pendentes. Um segundo perfil de imagem, usando HSR já disponível, passa pelo mesmo processamento, sem iniciar sua automação. |
| **P3 — ZZZ completo + executável** | Captura real, piloto, percurso S/A completo, revisão e pacote Windows | Duas coletas conferidas, cópias preservadas, escopo/contagem demonstrados e paradas testadas. Um executável de entrada inicia o fluxo. |
| **P4 — HSR no mesmo motor** | Perfil/parser de Cones de Luz e estratégia de avanço, com reaproveitamento do código consultado | Piloto e duas coletas completas no escopo acordado; sem duplicar janela, captura, executor OCR, sessão, cancelamento ou revisão. |
| **P5 — Genshin no mesmo motor** | Perfil 16:10, procedimentos aproveitados do Kamera e coleta 4/5 estrelas | Regredir imagens confirmadas, conferir raridade/cópias/transições e aceitar duas coletas completas. |
| **P6 — WuWa** | Qualificação da fonte, perfil de armas, percurso e integração do OCR adequado | Um fluxo completo aceito e regressão dos anteriores; trocar OCR não duplica o motor de coleta. |
| **P7 — NTE** | Primeiro confirmar categoria de arma, inglês, tela e fonte útil; depois imagem/piloto/coleta | Não iniciar copiando o scanner chinês de outras categorias. Definição do módulo depende desse levantamento específico. |
| **P8 — Exportação e Advisor** | Exportações revisadas, contrato de troca e aplicação explícita | Procedência, pendências e diff preservados; ausência no scan não remove automaticamente fato da conta. |
| **P9 — Avaliar expansão** | Decidir personagens/progressões/artefatos e equivalentes, por necessidade | Cada categoria acrescenta perfil/parser/percurso ao núcleo; não copiar todos os recursos dos projetos de origem. |

P6–P9 ficam no nível de marcos até aprendermos com os primeiros jogos. Não estimar prazo a partir de README, número de testes ou tamanho do repositório. Estimar o bloco seguinte depois da prova de compatibilidade, usando o trabalho observado.

## P1 — Prova prática da base

### P1.1 Preparar sem reestruturar

- Conferir origem/SHA e avisos dos arquivos selecionados. Usar cache/diretório local isolado, sem tocar nos logs ou na instalação pessoal de outro scanner.
- Verificar runtime Python real e criar ambiente isolado, fixando dependências resolvidas. Providenciar Tesseract e inglês localmente, com versões/hashes. Não instalar o aplicativo inteiro para obter apenas o scanner Python.
- Identificar o subconjunto de módulos necessário. Interface Rust, outras categorias e pastas de referência alheias ao OCR não fazem parte da primeira entrega.
- Executar primeiro os testes upstream relevantes para captura, grade, reconhecimento e W-Engines. Registrar pass/fail/skip e fixtures ausentes; não chamar um teste pulado de sucesso.

**Saída:** roteiro de instalação reproduzível e relatório curto do que foi possível executar. Se o ambiente/build exigir reescrever a base inteira, revisar o candidato antes de migrar o laboratório.

### P1.2 Conferir com imagens

- Usar capturas públicas do candidato apenas como desenvolvimento/regressão, respeitando procedência.
- Solicitar um conjunto compacto de capturas atuais de Cristian e referências dos campos. Não é necessário fornecer tudo de uma vez.
- Comparar nome, nível/limite, progressão e raridade. Nome fora do catálogo permanece bruto/candidato; não escolher o vizinho mais próximo silenciosamente.
- Identificar se as falhas são de instalação, regiões/layout, tratamento, catálogo ou interpretação. Não ajustar tudo ao mesmo tempo.

**Saída:** uma execução de OCR real sobre imagem atual, com bruto, recortes, candidatos e estados, e decisão explícita sobre continuar com a base. Nenhuma automação completa antes dessa prova.

## P2 — Extrair o motor sem multiplicar scanners

### P2.1 Contrato mínimo e responsabilidades

Motor comum: janela e coordenadas, emissão de ações, espera/tentativas limitadas, captura, tratamento/OCR, ciclo de observações, salvamento e revisão.

Módulo: identificação da janela, perfil visual, regiões, campos, raridades, estratégia de percurso e confirmação visual específica. Parâmetros simples ficam em dados; comportamento em funções pequenas. Não criar framework de plugins ou linguagem de automação em configuração.

Cada observação preserva jogo/categoria, posição/ordem, versão do leitor/perfil, imagem/hash, texto bruto ou evidência visual, candidatos, estados e decisão de escopo. Refinamento, sobreposição e códigos de raridade mantêm semântica por jogo. Separar texto OCR de classificações visuais; raridade/estrelas não são texto inventado.

### P2.2 Corrigir incompatibilidades de contrato conhecidas

- Falta de estrelas não vira valor mínimo reconhecido.
- Raridade incerta vira pendência de elegibilidade, não exclusão automática.
- Falha de célula não desaparece por não gerar um item válido.
- Igualdade de nome, atributos ou imagem não funde cópias nem prova que o clique falhou.
- Confiança de OCR/similaridade de catálogo não vira garantia de valor correto.
- Cobertura, processamento OCR e aprovação humana são estados separados.
- Arquivos anteriores e feedback humano permanecem rastreáveis, sem reescrita silenciosa.

### P2.3 Provar compartilhamento cedo

Ler imagem ZZZ e imagem HSR já existente pelo mesmo ciclo de recorte, reconhecimento, estados e salvamento, mudando perfil/parser. Não implementar coleta HSR ainda e não criar perfis vazios dos cinco jogos.

**Critério:** não há dois executores OCR, dois armazenamentos ou duas rotinas de revisão para sustentar os dois perfis. Adaptar somente o que a leitura real exigir.

## P3 — Primeiro produto completo: ZZZ

### P3.1 Captura e execução local

- Entrada única por executável/menu; escolher captura, piloto ou coleta, sem iniciar inputs só por abrir.
- Preservar solicitação UAC e verificação de compatibilidade com o alvo. Elevação não demonstra aceitação de input.
- Validar processo, área cliente, transformação de coordenadas, foco e captura. Gerar prévia com regiões/grade antes do piloto.
- Guardar evidências no mesmo diretório da sessão e fornecer caminho do relatório. OCR pode ser repetido em disco sem controlar o jogo.

### P3.2 Piloto de dez posições

- Começar no inventário de W-Engines, sem exigir navegação por personagens ou outros menus.
- Conferir ordenação/filtro S/A, seleção efetiva, espera, atualização do painel e sequência de posições.
- Incluir nomes longos, níveis/progressões diferentes e cópias quando existirem na conta. Testes sintéticos cobrem casos que a conta não possuir, sem declarar validação real deles.
- F8 interrompe a coleta; perda de foco ou mudança de geometria interrompe novos inputs. Sessão parcial é salva e visível.

**Critério:** os cliques chegaram às posições esperadas, nenhuma captura antiga virou outro item e nenhuma cópia foi fundida. Antes de pedir nova execução, reproduzir offline o máximo possível sobre as evidências dessa sessão.

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

## P4 — Segundo jogo e teste da arquitetura

1. Definir escopo de Cones de Luz e preparar inglês/16:9. Aproveitar as imagens existentes e ampliar níveis/progressões/referências conforme lacunas.
2. Reaproveitar configuração e interpretação HSR pertinentes. Não trazer UI ou controle virtual usado por outras categorias se o caminho de armas não precisar.
3. Adicionar a estratégia de avanço por teclas/ações ao mesmo ciclo. Não copiar captura, OCR, sessão ou revisão.
4. Remover o fallback de sobreposição 1 onde não houver leitura válida; preservar bruto e evidências.
5. Fazer captura, piloto, duas coletas conferidas e paradas. Repetir regressão ZZZ após mudanças compartilhadas.

**Teste decisivo:** o segundo jogo acrescenta perfil/parser/percurso e casos de teste. Se precisar de outra cópia do motor, revisar a separação antes de iniciar Genshin.

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
- Esta etapa de planejamento não instala dependências, não executa scanner externo e não controla o jogo.
- O experimento anterior M0/M1/M2 entregou leitores de imagem Genshin/HSR e referências confirmadas. O M3 antigo deixou scanner Genshin experimental, com captura/OCR estáticos e 135 testes JS, mas sem aceite de inventário completo. Eles não validam o novo motor.
- Os novos IDs P0–P9 distinguem este ciclo dos marcos M antigos. O [guia Genshin](genshin-scanner.md) é documentação do experimento legado; Git preserva seu roadmap anterior.
- GOOD/ZOD ou outro formato de consumidor podem ser entregas posteriores. O JSON de diagnóstico e revisão não deve perder incertezas para caber num export.

**Próximo bloco recomendado:** P1.1 preparação isolada e testes offline, seguido de P1.2 com uma captura atual ZZZ. Não começar extração geral ou pedir varreduras completas antes dessa prova.
