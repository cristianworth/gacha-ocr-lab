# WuWa — piloto visível experimental

O piloto observa candidatos a nome, tipo, nível e Rank de um a três cartões completos distintos, na ordem declarada, sem filtro ou rolagem. Raridade não é qualificada. Toda sessão é parcial: `coverageConfirmed=false`, `inventoryAccepted=false`; não identifica cópias nem escreve no Advisor.

**A implementação aguarda revisão. Não executar no jogo agora.** O detector pode retornar `confirmed` para uma correspondência geométrica única sob o perfil e as condições visíveis medidas. Isso não prova seleção interna única, ausência de marcas invisíveis, identidade ou cobertura global. Um piloto vivo curto deve avaliar o render atual antes de qualquer percurso maior.

## Perfil e evidência

O primeiro frame deve conter o cabeçalho inglês exato `Weapons`, verificado por OCR no recorte cliente `72,34,82,27` com bruto preservado, e o primeiro alvo declarado já selecionado e completamente visível. Nome do item, igualdade do painel e processo não substituem essa verificação. O executor examina os 18 cartões completos e seis parciais; aceita somente um candidato completo forte correspondente ao alvo e sem sinal concorrente detectável. Sinais ambíguos, alvo errado ou nenhum candidato rejeitam o preflight antes de qualquer clique.

Retângulos completos nominais: canto `119 + 118*coluna, 95 + 141*linha`, largura 95 e altura 118, coluna 0–5 e linha 0–2. A quarta linha é inspecionada em topo e 76 pixels das laterais, sem aceitar clique nela. A amostragem busca nas faixas de ±5 pixels das bordas, excluindo quatro pixels das pontas; frações são a proporção de posições com sinal. O contorno forte requer no mínimo 0,70 em todas as quatro bordas tanto na medida amarela brilhante quanto na medida relativa.

A medida relativa exige vermelho menos azul ≥6, verde menos azul ≥3 e média vermelho/verde ao menos 8 acima da menor das duas amostras a ±8 pixels da borda. Para competidor completo fraco, base relativa ≥0,65 e pelo menos duas outras bordas ≥0,25 geram incerteza; três bordas brilhantes ≥0,50 também geram incerteza. Na linha parcial, duas faixas brilhantes ≥0,35 indicam candidato; uma faixa brilhante ≥0,20 ou relativa ≥0,25 indica incerteza. Valores inferiores significam **nenhum contorno concorrente detectado**, não ausência comprovada. A imagem de um cartão tinha arte amarela nas laterais e topo, por isso a base participa da regra de competidor completo; um contorno visível muito fraco ou com geometria diferente ainda pode escapar.

Os três frames completos fornecidos produziram candidatos 12, 0 e 9 (índices zero-based) e confirmam apenas o alvo correspondente; no quarto, a primeira posição parcial é candidata e todos os alvos completos são rejeitados. A maior faixa relativa das parciais sem candidato foi 0,221, próxima do limiar 0,25. As imagens têm clientes medidos respectivamente `0,29,1280,720`, `0,30,1276,718`, `1,34,1280,720` e `1,29,1280,718`; no último o conteúdo disponível termina em 718 pixels. São evidências de desenvolvimento, não avaliação independente; o frame parcial estático não comprova movimento ou estabilidade. As medições e hashes ficam em `.cache/wuwa/measurements-final.jsonl` e no relatório local ignorado.

## Verificação local

`npm ci` prepara dependências. Execute `node --test test/wuwa-selection.test.js test/wuwa-pilot.test.js test/wuwa-offline.test.js`; para os testes com imagens privadas, defina antes `$env:WUWA_EXAMPLES='D:/Repo/gacha-ocr-lab/examples/Wuwa'`. Dezoito testes passaram com os quatro exemplos. Sobreposições sintéticas a 25%, 50% e 100% ilustram sinais concorrentes; não estabelecem contraste mínimo geral. O executor usa duas confirmações consecutivas com estabilidade do painel, guarda final imediatamente antes do clique e gravação parcial. Cancelamento na preparação ou após persistir `click-in-progress` foi simulado com zero cliques; falha OCR conserva observações e captura pendente. Não houve aquisição ou input no jogo.

## Procedimento futuro após revisão e autorização

Não existe `.exe` WuWa. O diretório de trabalho é `C:/Users/crist/orca/workspaces/gacha-ocr-lab/wuwa-selection-qualification`, com entrada `scripts/wuwa-pilot.js`. É necessário Node, `npm ci` e modelo inglês em `.cache/models/eng.traineddata`; o modelo local tem SHA-256 `5dc5d8d640a212c9d6184921ba103b186f50e0fed9ee716c53e6b312b400d747`, origem/licença não estabelecidas e não deve ser distribuído. Verificar o nome real do processo sem extensão; `--pid` opcional escolhe entre processos.

Para um futuro piloto mínimo, preparar Weapons em inglês no cliente 1280×720 e 96 DPI, deixar o primeiro cartão completo escolhido selecionado, controles livres e declarar um único alvo nominal. Após a revisão, a sintaxe é:

`node scripts/wuwa-pilot.js --prepared --process NOME_REAL_DO_PROCESSO --target 119,95,95,118`

O helper verifica processo, janela, integridade, foco, oclusão e geometria. Após a espera de cinco segundos, F8 interrompe quando armado; Ctrl+C ou `stop.request` na pasta da sessão solicita parada cooperativa. A pasta exclusiva em `.cache/wuwa/runs/` contém `session.json`, resumo e frames; após término, enviar apenas `session.json`. Abrir um console novo para carregar o código atualizado; nenhum pacote extraído ou janela de aplicativo participa.

**Minha parte:** coordenador revisa o diff e decide sobre futuro teste vivo. **Sua parte agora:** nenhuma; não execute o piloto nem envie captura. Confirmações geométricas e OCR são candidatos, sem aceite humano de inventário.
