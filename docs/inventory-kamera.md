# Estrutura e referência: Inventory Kamera

Investigação inicial em 17/10/2026. Referência: [taiwenlee/Inventory_Kamera, tag v1.3.17](https://github.com/taiwenlee/Inventory_Kamera/tree/v1.3.17), commit `a5d1c776301f688793d42f52c4c44c718f20c4a7`, fork de [Andrewthe13th/Inventory_Kamera](https://github.com/Andrewthe13th/Inventory_Kamera). A tag corresponde à versão informada nos logs locais; a origem do binário instalado não foi verificada independentemente. Não executamos o scanner nesta investigação.

## Arquitetura acordada

Decisão confirmada: manter `gacha-ocr-lab` e `gacha-advisor` como repositórios irmãos. O primeiro tem código executável, dependências de OCR, imagens e resultados experimentais. O segundo mantém instruções e conhecimento Markdown, com fatos da conta revisados. A relação entre eles é um formato de troca, sem exigir a mesma árvore ou o mesmo histórico Git.

Fluxo proposto, ainda sem implementação de exportação/importação:

```text
gacha-ocr-lab/examples/             Capturas locais
        → OCR e interpretação
        → data/results/             Texto bruto, evidências e incertezas
        → revisão humana
        → data/exports/genshin/     Futuro export estruturado revisado
        → atualização explícita do account-snapshots.md no gacha-advisor
```

Manter saídas no laboratório. Não gravar automaticamente no repositório vizinho nem sincronizar snapshots. O Advisor hoje não possui um importador JSON; copiar um arquivo para lá não atualiza seu contexto canônico. Uma futura importação precisa mostrar o diff, preservar procedência e tratar conflitos. Se depois houver uma pasta de entrada no Advisor, ela deverá ser local/ignorada e criada naquele escopo.

Para Genshin, considerar **GOOD** como formato de exportação compatível com ferramentas existentes. O JSON de diagnóstico continua separado: ele contém texto bruto, candidatos e ausências que não devem ser escondidos por defaults ao produzir um export. Outros jogos terão contratos próprios quando forem implementados; não é necessário criar agora uma camada genérica nem mover os módulos atuais.

## O que o Inventory Kamera faz

- O [README da versão](https://github.com/taiwenlee/Inventory_Kamera/blob/a5d1c776301f688793d42f52c4c44c718f20c4a7/README.md) descreve inglês, proporções 16:9/16:10 e export GOOD. 1440×900 é 16:10. As instruções de deixar o menu Paimon aberto e não usar mouse/teclado pertencem ao scanner automático; nosso CLI continua lendo arquivo, com o jogo podendo estar fechado.
- [InventoryScraper.cs](https://github.com/taiwenlee/Inventory_Kamera/blob/a5d1c776301f688793d42f52c4c44c718f20c4a7/InventoryKamera/scraping/InventoryScraper.cs) obtém o cartão do item usando proporções da área do jogo e trata o nome com gamma, escala de cinza e inversão.
- [WeaponScraper.cs](https://github.com/taiwenlee/Inventory_Kamera/blob/a5d1c776301f688793d42f52c4c44c718f20c4a7/InventoryKamera/scraping/WeaponScraper.cs) separa regiões de nome, nível e refinamento, adapta posições à proporção de tela e tenta escalas diferentes para refinamento.
- [GenshinProcesor.cs](https://github.com/taiwenlee/Inventory_Kamera/blob/a5d1c776301f688793d42f52c4c44c718f20c4a7/InventoryKamera/scraping/GenshinProcesor.cs) compara nomes com listas locais por similaridade. Isso pode sugerir um nome conhecido, mas não transforma a sugestão em texto reconhecido ou certeza. No laboratório, qualquer normalização futura deverá preservar o OCR original e a ambiguidade.
- [Weapon.cs](https://github.com/taiwenlee/Inventory_Kamera/blob/a5d1c776301f688793d42f52c4c44c718f20c4a7/InventoryKamera/game/Weapon.cs) serializa `key`, `level`, `ascension`, `refinement`, `location`, `lock` e `id`. [GOOD.cs](https://github.com/taiwenlee/Inventory_Kamera/blob/a5d1c776301f688793d42f52c4c44c718f20c4a7/InventoryKamera/data/GOOD.cs) envolve as armas com `format`, `version`, `source` e `kamera_version`; a versão consultada escreve GOOD 2.

## Material local e cuidados de interpretação

Os arquivos fornecidos contêm `logging/weapons/weaponN/card.png` e `weapon.json`; alguns diretórios incluem `log.txt` e recortes intermediários. O cartão já está recortado, diferente da captura completa com borda de janela. Não aplicar suas coordenadas diretamente à captura completa.

Também foram encontrados exports agregados em `GenshinData/`, com `format: GOOD`, `version: 2` e armas nos campos acima. `inventorylists/weapons.json` é o catálogo de consulta, não o inventário possuído. Os caminhos concretos para retomar o estudo estão em `data/research/inventory-kamera-local.json`, ignorado pelo Git; nenhuma imagem ou export pessoal foi copiado para documentação versionada.

Um log local registra nome de arma inválido. Portanto, `weapon.json` de logging não é necessariamente um resultado aprovado nem um rótulo infalível para testes. Comparar sempre cartão, log e saída; a presença de um arquivo não confirma extração correta ou inventário completo.

## Próximo experimento dentro da etapa de uma imagem

Comparar a captura completa com um cartão já recortado; depois testar regiões de texto e pré-processamento simples, avaliando o nome sem preenchimento automático. Usar as rotinas acima como referência de abordagem, sem portar cliques, navegação ou processamento em lote. O código consultado está apenas em `.cache/reference/inventory-kamera/`, ignorado pelo Git, e não foi incorporado ao runtime do laboratório. A licença do código consultado é MIT.

## Rota de ações: validar OCR antes de exportar

Prioridade confirmada por Cristian: validar o OCR próprio em uma imagem e deixar a exportação para depois. Não implementar integração, captura automática, navegação ou OCR em lote nesta etapa.

1. **Selecionar referências locais.** Excluir dos exemplos positivos os diretórios com erros explícitos no log. Para os demais, conferir consistência do JSON, presença do cartão e correspondência com o export GOOD. Isso gera candidatos a referência, não comprovação independente: o scanner pode produzir um valor plausível errado. Não apagar os exemplos rejeitados; mantê-los separados para futuros testes de falha. Dados e relatórios de auditoria permanecem em `data/research/`, ignorado pelo Git.
2. **Conferir um conjunto pequeno e variado.** Começar com aproximadamente 8–12 cartões, cobrindo nomes curtos/em duas linhas, níveis e refinamentos diferentes. Comparar visualmente os três campos com o JSON antes de usá-los como resultados esperados. Separar alguns cartões para avaliação final, sem ajustar regras sobre eles. Agrupar versões da mesma captura e exemplos equivalentes para evitar medir repetidamente o mesmo caso; preservar as cópias reais no inventário.
3. **Resolver primeiro um cartão de arma.** Usar um `card.png` já recortado para isolar a leitura dos campos. Separar regiões de nome, nível e refinamento e comparar o original com poucas variantes de tratamento, como escala, cinza, inversão/contraste. Registrar configuração, texto bruto por região, evidências e saída interpretada. O sucesso precisa estar nos campos conferidos, não apenas em uma confiança global maior. Não treinar um novo modelo nesta fase: primeiro avaliar o motor já instalado com entradas adequadas.
4. **Voltar à captura completa existente.** Usar o print de `examples/` para testar a separação entre área do jogo e borda da janela, e entre lista de armas e painel selecionado. O recorte precisa ser explícito e reproduzível, sem assumir que dimensões do arquivo são as da área cliente nem colar coordenadas de uma amostra como regra universal. Manter cartões já recortados e capturas completas como entradas distintas e documentadas. Uma execução do CLI continua recebendo uma imagem.
5. **Fechar a validação e só então exportar.** Executar os exemplos reservados individualmente; medir acerto de nome, nível e refinamento contra a conferência visual, relatando ausências e incertezas. Sugestões de catálogo devem ficar separadas do texto reconhecido, sem correção silenciosa. Considerar a etapa aprovada quando os três campos da imagem-alvo corresponderem à revisão e os exemplos reservados não revelarem erros silenciosos; esse conjunto pequeno não prova acurácia geral. Na sequência, definir export revisado compatível com GOOD e, em escopo próprio, a importação no Advisor.

Não são necessários novos prints agora: há cartões e uma captura completa suficientes para iniciar. Pedir novas capturas somente para lacunas observadas, como um layout não coberto, nome longo no painel completo, escala de interface diferente ou uma divergência sem leitura visual clara. Não tratar os exports do scanner como treinamento supervisionado confiável sem revisar os rótulos. Treinar o modelo OCR só será reavaliado se regiões e pré-processamento não resolverem padrões persistentes de erro.
