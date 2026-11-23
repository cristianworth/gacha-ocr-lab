# WuWa — piloto visível bloqueado para qualificação

O recorte proposto observa nome, tipo, nível e Rank de um a três cartões completos declarados, na ordem declarada, sem filtro ou rolagem. Raridade não é qualificada. A saída é local e sempre parcial: `coverageConfirmed=false` e `inventoryAccepted=false`. Nenhuma observação identifica uma cópia, comprova ordem global ou altera o Advisor.

**Não executar no jogo agora:** a verificação da quarta linha visível não está qualificada. A CLI inicializa e arma o helper, captura o primeiro frame e para em `selection-viewport-unqualified` antes de qualquer clique. Isto é um bloqueio deliberado, não um piloto vivo validado; os demais passos foram exercitados somente com backend simulado. O coordenador avaliará evidência adicional depois da revisão.

## Geometria e evidência

As imagens de desenvolvimento mostram três seleções em slots distintos. Para converter da imagem original ao cliente, use respectivamente `0,29,1280,720`, `0,30,1276,718` e `1,34,1280,720`; a avaliação converte as posições nominais do cliente para a imagem considerando offset e escala. As linhas completas nominais têm canto superior esquerdo `(119 + 118*coluna, 95 + 141*linha)` e dimensões `95,118`, com coluna 0–5 e linha 0–2. São as únicas posições aceitas como alvos experimentais, e não uma detecção geral ou comprovação de que a tela atual é a grade correta.

O detector mede pixels amarelos nas quatro bordas dos 18 retângulos completos. Nos exemplos, os índices zero-based dos candidatos foram 12, 0 e 9; o mínimo das quatro frações foi respectivamente 0,991, 0,851 e 0,845. Os 18 retângulos e a quarta linha são inspecionados independentemente do alvo pedido; nenhum candidato equivale a confirmação ou identidade. Para os seis cartões parciais da quarta linha, são medidos topo e os primeiros 76 pixels das laterais. A detecção de duas faixas com fração >=0,35 registra `partial-candidate` e ambiguidade; pontuação inferior é `unqualified`, nunca prova de ausência. Os exemplos originais não contêm seleção conhecida na quarta linha. Contornos sintéticos fortes e fracos sobrepostos aos frames verificam somente a resposta do código, não a aparência real de um cartão parcial selecionado. A viewport inteira continua `selection-viewport-unqualified`, mesmo quando há um único candidato completo.

## Replays e simulações

```powershell
npm ci
node --test test/wuwa-selection.test.js test/wuwa-pilot.test.js test/wuwa-offline.test.js
$env:WUWA_EXAMPLES='D:/Repo/gacha-ocr-lab/examples/Wuwa'
node --test test/wuwa-selection.test.js
```

O último comando é opcional e usa arquivos locais não distribuídos; sem a variável, esse caso é ignorado. Os testes restantes geram cenas em memória e sessões temporárias sob `.cache/wuwa`. O OCR real pode ser reexecutado conforme [o guia offline](wuwa-offline.md), usando pastas novas. O modelo de referência tem SHA-256 `5dc5d8d640a212c9d6184921ba103b186f50e0fed9ee716c53e6b312b400d747`; sua origem anterior não foi estabelecida, portanto não distribuí-lo. Esses frames ajudaram a desenvolver o perfil e não são uma avaliação independente.

O executor injetável registra tentativas, frames e SHA-256, conserva OCR bruto e incertezas do leitor público, grava `session.json` por substituição atômica e escreve `summary.md`; uma pasta existente é recusada. Em simulações, exige duas confirmações geométricas consecutivas e estabilidade das regiões de campos (distância média <=2) antes de ler, sem comparar nomes para inferir troca. Guarda/cancelamento são verificados antes e depois de capturas, clique, inspeção e OCR; uma falha mantém o estágio e observações anteriores. Dois frames repetidos de uma imagem não comprovam estabilidade viva, ordem real dos cliques, foco, input ou cobertura.

O estágio do clique é salvo antes da última conferência de cancelamento e da janela, imediatamente anterior ao input. O resumo identifica cada observação como leitura retornada ou captura com OCR pendente e contém links relativos para a captura e o `session.json`; uma leitura retornada não constitui aprovação humana.

## Caminho vivo e próximo recorte

O código de entrada fica no repositório, não há `.exe` WuWa empacotado. Depois da qualificação e revisão da guarda, o roteiro proposto é executar no diretório `C:/Users/crist/orca/workspaces/gacha-ocr-lab/wuwa-selection-pilot` com Node, modelo local e Weapons em inglês, cliente exato 1280×720 a 96 DPI, controles livres e um a três retângulos completos declarados com `--target left,top,width,height` repetido. Exemplo de sintaxe, **ainda bloqueado**:

```powershell
node scripts/wuwa-pilot.js --prepared --process NOME_REAL_DO_PROCESSO --target 119,95,95,118
```

O nome real do processo deve ser informado sem extensão; `--pid` opcional escolhe entre processos correspondentes. O helper valida a janela, integridade, foco, oclusão, geometria e F8; há espera de cinco segundos antes de ativar e armar. `Ctrl+C` ou `stop.request` na pasta da sessão solicita cancelamento. A pasta é criada em `.cache/wuwa/runs/` e não é sobrescrita. A CLI atual retorna erro deliberado antes do primeiro clique e salva a sessão parcial; não há teste humano a executar agora. Caso a guarda venha a ser qualificada, será preciso reabrir qualquer janela de console já encerrada para usar o código atualizado; nenhuma janela de aplicativo `.exe` participa deste caminho. A futura intervenção mínima deve esclarecer como o contorno realmente aparece numa seleção parcial da quarta linha, e o coordenador definirá preparação e coleta após revisão. O artefato a examinar será `session.json` da execução específica, sem transferir aprovação entre sessões.
