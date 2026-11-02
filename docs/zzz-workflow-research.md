# ZZZ: objetivo de uso, pesquisa e decisões

Revisão de **28/10/2026**, solicitada por Cristian após a primeira coleta completa. Este documento reúne evidências e decisões; o [ROADMAP](ROADMAP.md) é o único plano de execução. Não houve nova coleta nem mudança de comportamento durante esta pesquisa.

**Atualização posterior à pesquisa:** o caminho curto e `summary.md` foram implementados em 28/10 e conferidos no jogo em 29/10. Cristian confirmou os três nomes pendentes em revisão específica. As recomendações abaixo registram o desenho que orientou a implementação; estado/execução ficam no [guia ZZZ](zzz-scan.md), evidências em [histórico técnico](zzz-evidence.md) e próximos passos no [ROADMAP](ROADMAP.md).

## O resultado que vale entregar

Cristian confirmou no chat:

- Coleta curta de **W-Engines S/A com nível atual >=20**, para revisar e depois atualizar o Advisor. O corte fica **fixo em 20 nesta entrega**; configuração de outros níveis fica adiada.
- Ele prepara filtros, ordenação e início da lista; o aplicativo coleta. Não precisamos automatizar menus.
- Quantidade de cópias não é essencial. Preservar as observações que já existem é barato; não investir em deduplicação, identificação persistente ou reconciliação de cópias entre sessões.
- Resultado útil com pendências explícitas é preferível a perseguir perfeição antes de entregar. Itens baixos não interessam ao uso normal desta conta.

O critério é poupar trabalho manual e fornecer fatos úteis ao Advisor. Visitar mais posições, aumentar testes ou construir uma arquitetura genérica não constitui valor por si só.

## O que as fontes realmente dizem

| Fonte primária consultada | Evidência | Consequência para o laboratório |
|---|---|---|
| [Inventory Kamera: WeaponScraper.cs](https://github.com/Andrewthe13th/Inventory_Kamera/blob/master/InventoryKamera/scraping/WeaponScraper.cs), também no fork local `taiwenlee`, SHA `a5d1c776301f688793d42f52c4c44c718f20c4a7` | No fork: linha 20 ativa ordenação por nível conforme o mínimo; 137–149 verificam/selecionam `level`; 197–198 interrompem abaixo do mínimo nessa ordenação. O código público consultado mantém a estratégia. | Aproveitar a estratégia de parar por nível. A preparação fica manual conforme a escolha de Cristian; não copiar coordenadas Genshin para ZZZ. |
| [Youkai: leitor de W-Engines](https://github.com/AJTDaedalus/youkai/blob/dev/src/youkai_ocr/wengine_scanner.py), comparado ao cache fixado em `86a8b34511c86ec864d8f40c558789f7ccad4cc9` | O scanner consulta o contador e percorre o navegador; a API consultada não oferece mínimo de nível/parada ordenada. | A base reutiliza captura/OCR, mas a política de coleta útil precisa ser nossa adaptação. Não presumir que um scanner completo possui o filtro desejado. |
| [README do Youkai](https://github.com/AJTDaedalus/youkai) e `packaging/youkai.spec`, `run.py`, `assemble.ps1` locais, na mesma revisão fixada | Há distribuição portátil documentada. O spec usa PyInstaller em pasta, e a montagem inclui Tesseract. | Reaproveitar o procedimento de distribuição depois de estabilizar o caminho curto. O entry point original chama a CLI original: empacotá-lo sem adaptar não inclui automaticamente nosso executor. Não executar instaladores/downloads como parte desta pesquisa. |
| [HSR-Scanner: instruções e configurações](https://github.com/kel-z/HSR-Scanner#scanner-settings-and-configurations) | Documenta filtros por nível/raridade, preparação de idioma/tela e processamento após a captura. | Quando chegar ao HSR, começar pelo escopo útil e configurações existentes, antes de portar todo o fluxo. Isso não comprova ordenação ou coordenadas ZZZ. |
| [Youkai: contrato eZOD](https://github.com/AJTDaedalus/youkai/blob/dev/eZOD.md#w-engines--zodwengine) | Separa nível, ascensão, refinamento, personagem equipado e lock. | Não confundir nível com progressão. Export eZOD não é o formato canônico do Advisor; não exigir um exportador universal para entregar um resumo revisável. |

Os links de branches são mutáveis; as conclusões aplicadas ao código local usam os arquivos fixados no cache. A revisão web não atualizou dependências, catálogo ou fonte upstream. Algumas URLs fixadas não abriram no navegador de pesquisa; nesses casos, foi lido o arquivo local, sem fingir uma nova verificação remota daquela revisão.

## Conhecimento do jogo que muda a coleta

**Filtro e ordenação são controles distintos.** Na imagem `reference-filter-options.png` da sessão `20261024-guided-tail-2e081b07`, S e A estão selecionados, B/especialidades não; o seletor superior mostra **Rarity**. Essa captura não comprova que o jogo sempre ordena globalmente por nível, nem mostra o menu de opções aberto. Uma lista pode parecer decrescente numa conta sem que isso comprove a regra para qualquer inventário. Para o caminho curto, preparar explicitamente **Level decrescente** e registrar essa preparação. Não inventar navegação desse seletor.

Pesquisei documentação pública do jogo, incluindo as [notas oficiais de 1.4](https://zenless.hoyoverse.com/en-us/news/127445), que registram mudanças na interface de melhoria, e de [2.5](https://zenless.hoyoverse.com/id-id/news/161722), que descrevem desmontagem por tier. Os corpos dessas páginas não ficaram disponíveis na abertura; os trechos indexados não estabelecem a ordenação padrão do inventário. Guias de criadores no HoYoLAB, inclusive um da fase beta (`article/27885400`), também não são garantia da interface atual. A decisão sobre ordenação usa a preparação confirmada por Cristian e as imagens locais, sem promover uma busca sem resposta a documentação oficial.

Fatos comprovados no ambiente local:

- A lista S+A tem 118 posições na sessão de 28/10; o contador não é a quantidade de itens 20+.
- Os níveis registrados foram 28 itens em 60, quatro em 50, dois em 40 e 84 em zero. Não houve aumento ao longo dessa sessão; o primeiro abaixo de 20 está na posição 35.
- As imagens mostram `Lv.0` e painel `Lv.00/10`. Não transformar zero em um porque um formato externo descreve intervalo 1–60. No escopo atual ambos seriam baixos, mas o bruto deve continuar verdadeiro.
- Etiquetas NEW!, retratos e cópias existem na grade. Já temos regressão para esses casos; não é necessário começar outra campanha.
- Nível atual e progressão são dimensões diferentes: todas as progressões de itens 20+ continuam incluídas. Lock não é condição de inclusão.
- Os três nomes pendentes são leituras truncadas/contaminadas; há candidatos no catálogo, mas isso não autoriza substituir o texto por uma aproximação. Não são motivo para exigir nova coleta ou bloquear os demais itens.

Não confirmei documentalmente um filtro numérico do jogo. Nosso **corte 20** é política do aplicativo, independente desse filtro existir.

## Menor adaptação recomendada

1. Coletar desde o topo preparado em Level decrescente. Ao primeiro nível confiável `<20`, concluir o escopo elegível. Um ilegível não dispara parada; pode receber leitura do painel ou continuar pendente. Uma contradição observada na ordem invalida a inferência de término.
2. Separar total da lista, posições observadas, elegíveis, excluídos observados e restantes não lidos pela ordenação. Não declarar fundo físico ou leitura de itens omitidos. Pendência de nome permanece separada da cobertura.
3. Usar as capturas de 28/10 como comparação: mesmos 34 elegíveis, limite na posição 35, expectativa de 34 cliques e uma roda. Isso é uma previsão do percurso, não um benchmark nem uma execução já realizada.
4. Entregar resumo local legível, com nome/nível/raridade/progressão/lock e pendências destacadas. Cristian pode usar o texto revisado no Advisor. Nada é escrito automaticamente no repositório vizinho e ausência não remove fatos existentes.
5. Manter o percurso inteiro como diagnóstico disponível. Não usá-lo como validação obrigatória de cada incremento.

## O que aprendemos e como evitar repetir

- Antes de implementar uma travessia, definir o dado que o usuário precisa, o filtro, a ordenação, a condição de parada e a saída que ele usará.
- Investigar README, opções e código do caminho relevante nas referências. A existência de um método de captura não responde como limitar a coleta.
- Perguntar cedo por decisões que mudam escopo. Agora estão respondidas: preparação manual, nível 20 fixo e cópias sem investimento extra. Não há dúvida bloqueante para desenhar o caminho curto.
- Tolerar OCR pendente não significa aceitar um palpite como fato. Um resultado parcial útil com revisão visível é suficiente para entregar valor.
- Pesquisa deve terminar em uma decisão pequena e verificável. Não é justificativa para recomeçar o projeto, mudar de base ou desenhar outro framework.
