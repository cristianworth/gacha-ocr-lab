# Objetivo e roadmap — Gacha OCR Lab

## Objetivo do projeto

Construir um scanner local de inventário para jogos gacha, inspirado na proposta do Inventory Kamera, começando pela leitura de armas e seus equivalentes em **Genshin Impact, Honkai: Star Rail, Wuthering Waves, Zenless Zone Zero e Neverness to Everness**. Depois de validar essa cobertura, evoluir a coleta automática e a integração dos dados revisados com o **Gacha Advisor**.

O resultado desejado é permitir coletar, conferir e exportar informações do inventário com evidências e incertezas explícitas. A primeira imagem de Genshin é a prova inicial desse produto; não é o objetivo completo.

Decisões confirmadas por Cristian em 17/10/2026:

- Projetos separados: scanner executável no `gacha-ocr-lab`; conhecimento e fatos revisados no `gacha-advisor`.
- Plataforma e idioma iniciais: **Windows e interface em inglês nos cinco jogos**. A resolução e a escala de interface serão verificadas por jogo; 1440×900 é a referência atual do Genshin.
- Prioridade: armas nos cinco jogos antes de implementar outras categorias. Eles formam a primeira cobertura; novos gachas poderão ser adicionados depois, conforme demanda e viabilidade, pelo mesmo fluxo de validação por jogo.
- O objetivo final inclui captura da janela e navegação automática, mas essas funções pertencem a fases futuras.
- Integração com o Advisor vem depois da validação de armas nos cinco jogos. Não atualizar snapshots diretamente como efeito do OCR.
- Personagens, constelações/progressões equivalentes, artefatos e outros itens são possibilidades a avaliar, não entregas já assumidas.

## O que significa ler armas

Em cada jogo, identificar o item e seus campos relevantes a partir da tela, mantendo a nomenclatura e as regras daquele jogo. O primeiro recorte de Genshin cobre nome, nível e refinamento quando visíveis. Ao entrar em outro jogo, confirmar campos equivalentes, obrigatórios e opcionais com capturas reais; não impor o modelo de Genshin aos demais.

Distinguir **ler um item**, **reunir um inventário** e **transferir fatos revisados**. Um leitor correto não prova que uma varredura encontrou todos os itens; um JSON exportado não significa que o Advisor foi atualizado.

## Marcos do projeto

| Marco | Entrega e limite | Critério para avançar |
|---|---|---|
| M0 — Base experimental | CLI local, imagem → OCR → interpretação → revisão → JSON. Já existe; a leitura da captura real ainda é insuficiente. | Base utilizável para medir e melhorar a leitura, sem confundir testes sintéticos com precisão real. |
| M1 — Leitor de armas Genshin | **Próxima entrega.** Uma imagem por execução, cartão recortado ou captura completa com seleção reproduzível do painel. Nome, nível e refinamento, com evidências e revisão. | Os três campos da imagem-alvo correspondem à conferência visual; avaliação em exemplos reservados informa acertos, ausências, incertezas e erros. |
| M2 — Segundo jogo e base compartilhada | Leitor de armas de um segundo jogo, preservando o funcionamento de Genshin. Consolidar apenas o que for realmente compartilhado. | O mesmo fluxo atende aos dois jogos com regras e testes separados; adicionar o segundo não exige alterar arbitrariamente a interpretação do primeiro. |
| M3 — Armas nos cinco jogos | Expandir progressivamente os leitores aos três jogos restantes, com amostras reais e campos documentados. | Todos os cinco possuem leitura de armas avaliada no escopo suportado; limitações e configurações de tela estão claras. Não declarar acurácia geral com uma amostra pequena. |
| M4 — Coleta automática | Começar em um jogo e depois expandir: captura de janela, navegação, identificação de itens repetidos e término da varredura. Continua separado da leitura OCR. | Execução interrompível, evidências por item e relatório de itens lidos, pendentes e falhas; inventário parcial não é apresentado como completo. Armas iguais continuam podendo ser cópias distintas. |
| M5 — Exportação e Advisor | Export revisado por jogo, seguido de importação explícita no projeto vizinho, com diff e procedência. GOOD é candidato para Genshin, não padrão obrigatório dos cinco jogos. | Revisão antes da aplicação; conflitos e cópias preservados; nenhuma ausência de OCR vira remoção automática de um fato da conta. |
| M6 — Avaliar novas categorias | Decisão sobre personagens, progressões, artefatos e outros itens, por utilidade e viabilidade em cada jogo. | Escolher uma categoria e um jogo somente se houver benefício concreto, capturas e critérios verificáveis; ampliar em entrega própria. Pode ser adiado. |

A dependência principal é **M1 → M2 → M3**. Não aperfeiçoar indefinidamente Genshin antes de experimentar o segundo jogo. Após M3, automação e integração podem ser entregues incrementalmente: um export revisado manualmente não precisa esperar navegação automática perfeita em todos os jogos. A avaliação de novas categorias pode ocorrer nesse ponto, mas sua implementação não desloca o foco em armas.

Ordem sugerida para os leitores: **Genshin → HSR → WuWa → ZZZ → NTE**. Genshin tem material disponível; HSR é o candidato inicial ao segundo piloto. Reavaliar a ordem dos demais conforme capturas, prioridade de uso e dificuldade observada, sem tratar a ordem como estimativa de complexidade.

## Frentes de trabalho e responsabilidades

- **Referências e avaliação:** pares imagem/resultado, conferência visual, configuração de tela e exemplos reservados. Casos com erro explícito do Inventory Kamera ficam fora das referências positivas; os demais são candidatos, até serem conferidos. Imagens e dados pessoais ficam fora do Git.
- **Imagem e OCR compartilhados:** leitura, seleção de região, tratamentos mensuráveis, execução local e evidências. Medir os campos finais; confiança do motor não é garantia de interpretação correta.
- **Regras por jogo:** regiões, rótulos, validações, catálogo e mapeamento dos campos. Texto reconhecido, sugestão de catálogo e correção aprovada são informações distintas. Catálogos precisam de origem e versão/data.
- **Revisão e resultados:** estrutura versionada com jogo, origem, configuração, campos específicos, estado de revisão e incertezas. Preservar o diagnóstico original; um resultado aceito ou corrigido deve ser rastreável à imagem.
- **Coleta e inventário:** somente em M4. Uma identidade de captura não substitui a identidade de uma cópia da arma. Não deduplicar o inventário apenas por nome, nível ou refinamento.
- **Exportação e integração:** somente no marco correspondente. O laboratório gera resultados; a integração com o Advisor constitui um contrato explícito entre repositórios.

Essas são responsabilidades, não uma exigência de criar seis camadas ou pacotes agora. Os módulos simples atuais são suficientes para M1. Separar implementações por jogo e consolidar interfaces quando M2 mostrar as diferenças reais. Não introduzir framework, backend, banco ou MCP para antecipar a expansão.

## Próxima entrega completa: M1

1. Escolher aproximadamente 8–12 cartões variados do material já disponível e conferir visualmente nome, nível e refinamento. Reservar alguns para avaliação final; versões da mesma captura não contam como exemplos independentes.
2. Melhorar o leitor usando regiões de texto e poucos tratamentos de imagem comparáveis, com diagnóstico por campo. Primeiro um cartão, depois a captura completa já existente, incluindo sua borda de janela.
3. Entregar no CLI o fluxo de uma imagem, com os formatos de entrada suportados explícitos e seleção do jogo documentada quando necessária. Não embutir coordenadas de uma captura como regra universal.
4. Medir acerto por campo, extrações incorretas aceitas como válidas e proporção de resultados que exigem revisão. Comparar com o resultado atual e registrar o conjunto usado; não inventar uma meta percentual antes de medir o baseline.
5. Entregar código, testes relevantes e instruções de revisão. Para avançar, a imagem-alvo precisa produzir os três campos corretos; falhas nos exemplos reservados devem orientar correções ou limites explícitos, sem encobrir erros silenciosos.

Não treinar um novo modelo OCR neste primeiro ciclo. Usar as referências como conjunto de desenvolvimento e avaliação do motor instalado; reavaliar treinamento apenas diante de padrões persistentes que recortes e tratamento não resolvam. Não são necessários novos prints para iniciar M1. Pedir capturas de outros jogos ao entrar nos respectivos pilotos, com uma lista específica das telas e variações necessárias.

## Estado e documentos

Estado em 17/10/2026: M0 implementado, M1 planejado; demais marcos não implementados. Os testes automatizados existentes verificam o fluxo e regras, mas a captura completa real revelou falhas de extração. A auditoria e as conferências pessoais ficam em `data/research/`, ignorado pelo Git.

Este documento é o norte do projeto e a referência única dos marcos. [inventory-kamera.md](inventory-kamera.md) mantém o estudo da implementação de referência e a origem do material. O [README](../README.md) explica a capacidade atual, instalação e execução. Git mantém entregas coesas; datas, percentuais de progresso e prazos não são estimados sem evidências.
