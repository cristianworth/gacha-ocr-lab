# WuWa — piloto visível ainda bloqueado

O recorte observa candidatos a nome, tipo, nível e Rank de um a três cartões completos distintos, na ordem declarada, sem filtro nem rolagem. Raridade não está qualificada. A sessão é sempre parcial: `coverageConfirmed=false` e `inventoryAccepted=false`. Seleção geométrica não identifica cópia nem aprova dados; nada é enviado ao Advisor.

**Não executar no jogo agora.** O executor exige OCR do cabeçalho inglês `Weapons` no primeiro frame e preserva o bruto antes de verificar a seleção. Mesmo que essa preparação passe, a seleção permanece `selection-viewport-unqualified` antes de qualquer clique. A seleção inicial teria de ser o primeiro alvo declarado; isso não foi validado em jogo.

## Evidência e limite

Os quatro exemplos foram usados para desenvolver o perfil, não para avaliação independente. Nos três exemplos anteriores há um candidato completo em índices zero-based 12, 0 e 9; no novo frame há seleção parcial real na primeira coluna da quarta linha e nenhum candidato completo. As faixas superior e laterais visíveis dessa seleção são fortes; outros cartões parciais apresentam valores baixos. Isso confirma que uma seleção parcial pode ser detectada nesse frame, mas não prova que uma seleção fraca ou ilegível produza sinal distinguível de ausência. Valores intermediários são registrados como `partial-uncertain`; valores baixos continuam não qualificados. Conflitos e seleção parcial não autorizam clique. O frame estático não mostra rolagem ou movimento.

Clientes medidos nos arquivos, respectivamente: `0,29,1280,720`, `0,30,1276,718`, `1,34,1280,720` e `1,29,1280,718`. No último, a borda ocupa a coluna zero e o conteúdo começa após a barra de título; a imagem termina aos 718 pixels disponíveis. O perfil de alvos usa 18 retângulos nominais com canto `(119 + 118*coluna, 95 + 141*linha)`, largura 95 e altura 118, para colunas 0–5 e linhas 0–2. A quarta linha é apenas inspecionada, nunca alvo. As medições completas e hashes estão no relatório local ignorado `.cache/wuwa/selection-qualification-report.md` e em `.cache/wuwa/measurements.jsonl`.

A preparação recorta `(72,34,82,27)` no cliente 1280×720 e exige texto exato `Weapons`; falha ou texto diferente bloqueia antes de input. O OCR bruto e seu processamento ficam no manifesto. Isso não comprova foco, geometria ou seleção; os guardas correspondentes continuam independentes. A guarda final acontece imediatamente após persistir `click-in-progress`, sem gravação aguardada entre ela e o clique.

## Validação local

```powershell
npm ci
node --test test/wuwa-selection.test.js test/wuwa-pilot.test.js test/wuwa-offline.test.js
$env:WUWA_EXAMPLES='D:/Repo/gacha-ocr-lab/examples/Wuwa'
node --test test/wuwa-selection.test.js test/wuwa-pilot.test.js test/wuwa-offline.test.js
```

Com os exemplos locais os 16 testes passaram. O OCR real no novo frame retornou candidatos Novaburst, pistols, 90/90 e Rank 5; raridade continua incerta. A leitura do cabeçalho e os campos são evidência de desenvolvimento, não aprovação humana. Testes simulados cobrem preparação errada ou ausente, cancelamento durante OCR e após persistência do clique com zero cliques, estabilidade, OCR falho e preservação parcial. Nenhum input ou aquisição no jogo foi realizado.

## Futuro piloto, após qualificação e revisão

A entrada é o script Node neste repositório, **não existe `.exe` WuWa**. O diretório de trabalho desta branch é `C:/Users/crist/orca/workspaces/gacha-ocr-lab/wuwa-selection-qualification`, com script em `scripts/wuwa-pilot.js`. `npm ci` e `.cache/models/eng.traineddata` precisam estar preparados; o modelo local medido tem SHA-256 `5dc5d8d640a212c9d6184921ba103b186f50e0fed9ee716c53e6b312b400d747`, origem e licença não estabelecidas e não deve ser distribuído. O nome real do processo deve ser verificado pelo usuário, sem extensão; `--pid` opcional distingue processos.

Após desbloqueio e nova revisão, preparar Weapons em inglês, cliente 1280×720 a 96 DPI, primeiro alvo completamente visível já selecionado, controles livres e um a três alvos nominais distintos. Sintaxe proposta, atualmente bloqueada:

```powershell
node scripts/wuwa-pilot.js --prepared --process NOME_REAL_DO_PROCESSO --target 119,95,95,118
```

O helper verifica processo, janela, integridade, foco, oclusão e geometria. Depois dos cinco segundos de espera, F8 interrompe quando armado; Ctrl+C ou arquivo `stop.request` na pasta da sessão solicita cancelamento cooperativo. O resultado fica em uma pasta exclusiva `.cache/wuwa/runs/`, com `session.json`, `summary.md` e frames; é sempre parcial. Após término, enviar somente `session.json`. Será preciso abrir um console novo para carregar código atualizado; não há aplicativo ou pacote extraído a reabrir.

**Minha parte:** revisar a evidência que falta para distinguir contorno fraco de ausência e o diff antes de decidir sobre o bloqueio. **Sua parte agora:** nenhuma; não execute o piloto nem envie captura. O teste vivo é futuro e depende de autorização e qualificação; não foi validado por replays ou simulações.
