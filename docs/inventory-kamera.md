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

## Uso da referência no próximo marco

**Revisão focada em 28/10/2026:** o `WeaponScraper.cs` local já contém a estratégia de redução por nível. O construtor ativa `SortByLevel` quando `MinimumWeaponLevel > 1` (linha 20); `SelectSortingMethod` verifica/seleciona `level` (linhas 137–149); a coleta usa `ScanLevel(...) < MinimumWeaponLevel` e encerra quando essa condição é verdadeira sob ordenação por nível (linhas 197–198). Isso explica o comportamento observado por Cristian no Kamera e deve orientar a parada antecipada proposta para ZZZ. O código direto de W-Engines do Youkai fixado não apresenta opção equivalente de mínimo/parada por nível; usar a estratégia do Kamera exige adaptação explícita, não presumir que já veio pronta na base Python.

M1/M2 entregaram leitura regional de uma imagem e o antigo M3 deixou uma coleta Genshin experimental sem aceite completo. O [planejamento atual](ROADMAP.md) prioriza qualificar ZZZ e extrair um motor Python compartilhado, seguido de HSR e Genshin. O Kamera continua fonte de procedimentos/recortes para o módulo Genshin; o [guia legado](genshin-scanner.md) preserva as evidências anteriores.

**Revisão de velocidade em 02/11/2026:** no mesmo código local, `WeaponScraper.ScanWeapons` clica, espera a seleção e chama `QueueScan`. Essa função captura o cartão e verifica nível/raridade antes de enfileirar `OCRImageCollection` em `InventoryKamera.workerQueue`. `InventoryKamera.GatherData` inicia `ImageProcessorWorker` em threads antes da aquisição; os workers chamam `CatalogueFromBitmapsAsync`, que também distribui leituras de campos. Isso confirma a separação entre captura e OCR descrita por Cristian, sem comprovar o desempenho desse binário pessoal ou importar suas coordenadas/esperas para ZZZ. O [primeiro recorte ZZZ](zzz-performance-plan.md) adota aquisição seguida de processamento dos arquivos, ainda sequencial, mantendo as provas de painel e corte por nível.

O [Navigation.cs](https://github.com/taiwenlee/Inventory_Kamera/blob/a5d1c776301f688793d42f52c4c44c718f20c4a7/InventoryKamera/game/Navigation.cs) consultado mede a área cliente/posição da janela e separa captura de regiões e simulação de entrada. O [WeaponScraper.cs](https://github.com/taiwenlee/Inventory_Kamera/blob/a5d1c776301f688793d42f52c4c44c718f20c4a7/InventoryKamera/scraping/WeaponScraper.cs) percorre posições, conta itens e rola a lista. Essas separações são úteis para o desenho; seus offsets e esperas não são configuração comprovada para o laboratório.

Medir captura, foco, geometria, seleção e término no perfil real antes de reutilizar uma abordagem. O export antigo auxilia comparação somente se inventário e filtro forem equivalentes; não comprova cobertura atual. O código consultado continua apenas em `.cache/reference/inventory-kamera/`, ignorado pelo Git, sob licença MIT; nenhum scanner externo foi executado nesta investigação.

## Planejamento do projeto

O objetivo completo, a arquitetura acordada e os marcos estão em [ROADMAP.md](ROADMAP.md). Os leitores de uma imagem Genshin/HSR e os dados confirmados são referências já entregues. A ordem recomendada agora é ZZZ, HSR, Genshin, WuWa e NTE, com um motor comum. Este documento mantém apenas a pesquisa do Inventory Kamera e a origem das referências, evitando dois roadmaps concorrentes.
