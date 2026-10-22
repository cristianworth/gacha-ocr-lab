# Youkai — prova limitada de seleção ZZZ (P1.3)

Implementação preparada em 20/10/2026, após a [captura cliente real](youkai-capture.md). **Primeira seleção real conferida posteriormente nesta data:** três posições e quatro cliques normais; interrupção durante execução ainda pendente. O comando limita a prova às duas ou três primeiras posições da primeira linha, sem rolagem. Não é o piloto de dez posições nem coleta de inventário.

## Reaproveitamento

O helper [youkai_selection.py](../scripts/youkai_selection.py) importa a fonte original fixada no SHA `86a8b34511c86ec864d8f40c558789f7ccad4cc9`, em cache isolado. Confere os 260 arquivos contra o ZIP antes da operação. Executa as APIs públicas `GridNavigator.scan()`, `calibrate_window()`, `read_engine_count()`, `scan_single_frame_engine()` e `make_kill_listener(kill_key=Key.f8)`.

A única substituição temporária de dependência é a fábrica pública `pynput.mouse.Controller`, que recebe um controlador com guardas. O algoritmo original da grade e os arquivos upstream permanecem intactos; não acessamos nem sobrescrevemos métodos privados do navegador. Nenhum código do Youkai foi incorporado ao `src/` do laboratório. Fonte e avisos originais permanecem no cache descrito na [qualificação](youkai-qualification.md).

O navegador original prepara a seleção clicando na segunda célula antes de visitar a primeira, segunda e terceira. São **quatro cliques normais para três posições**. As retentativas originais permitem até 13 solicitações de pressionamento nesse recorte. O parâmetro `scan(3)` significa apenas prefixo de qualificação; não representa o total do inventário. A política original para painel parado ainda pode pular uma célula; o relatório mantém essa posição como falha explícita.

## Preparação e comando

Use o ambiente isolado já preparado por `scripts/qualify-youkai.ps1`. Abra ZZZ no inventário de **W-Engines**, inglês, janela com área cliente **1280×720**, escala Windows **100%**. Deixe a lista no topo manualmente e mantenha pelo menos três posições disponíveis. Durante o ensaio, reserve mouse/teclado para o processo.

**Nível Windows observado:** no preflight real, o jogo tinha integridade 12288 e o helper 8192. O comando recusou qualquer input. Para esse ambiente, abra **PowerShell como Administrador** e execute:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "D:\Repo\gacha-ocr-lab\scripts\probe-youkai.ps1" -Run
```

1. O processo verifica fonte, janela, resolução, DPI e nível de integridade antes de inputs.
2. O terminal pede para pressionar e soltar **F8** em até 30 segundos. Isso verifica o listener antes de mover/clicar; sem esse sinal, interrompe.
3. Após a confirmação, há cinco segundos para soltar F8. O processo solicita foco pela API original e confere o cabeçalho de W-Engines por OCR.
4. Executa a preparação original e o prefixo de três posições. **F8 interrompe**; Ctrl+C funciona no terminal. Não pressione F8 de novo para iniciar: após o primeiro sinal, ele é a parada.
5. O terminal informa a pasta e o `session.json`. Envie esse caminho para análise. As imagens devem mostrar a seleção correspondente a cada posição; contagem de solicitações não prova que o jogo recebeu os cliques.

O listener original tem Escape como padrão; este helper passa F8 explicitamente. Não afirmamos que Escape foi testado. O processo não solicita elevação automática. O lançador `.exe` existente continua pertencendo ao experimento Genshin e não executa este ensaio.

Opções adicionais:

```powershell
# Somente metadados e acesso; sem pixels, foco ou inputs:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\probe-youkai.ps1
# Somente verificar o listener de F8, sem emitir mouse/teclado:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\probe-youkai.ps1 -CheckStop
# Recorte menor, ainda incluindo o clique de preparação original:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\probe-youkai.ps1 -Run -Limit 2
```

`-StopReceipt <session.json>` permite reutilizar um check F8 separado com a mesma fonte, idade máxima de 30 minutos e status verificado. Um listener novo continua ativo na execução. Sem essa opção, o próprio `-Run` realiza a verificação inicial; não é necessário copiar caminhos.

## Guardas e evidências

- Antes de movimentos/pressionamentos, verifica parada/listener, prazo de 60 segundos para permitir inputs, foco, processo, visibilidade, janela restaurada, posição, tamanho e DPI. Não é um timeout que interrompe à força uma chamada OCR em andamento; a próxima operação protegida verifica o prazo.
- Apenas botão esquerdo nos centros aprovados da primeira linha, com a tolerância de três pixels usada pelo jitter original; orçamento de 13 pressionamentos para três posições. Movimentos naturais originais permanecem permitidos sob guarda.
- Toda tentativa de rolagem interrompe antes de enviar roda. Se o navegador não reconhecer o topo, a prova para; não tenta corrigir a tela automaticamente.
- Capturas conferidas antes/depois da aquisição, máximo de 80 frames. Registra frame, hash, sequência, posição e quantidade de pressionamentos solicitados. Libera somente botões pressionados por este helper, mesmo após parada/perda de foco.
- Todas as posições existem no manifesto desde o início. Falhas OCR, posições não visitadas e skips upstream permanecem visíveis. A coleta de observações não funde posições com conteúdo igual; isso não corrige a política upstream de painel parado.

Saídas em `.cache/youkai-p1/runs/<data-hora-id>-selection/`: `session.json`, `before.png`, frames intermediários, `position-00.png` etc., recortes OCR e diagnóstico upstream. F8 confirmado no próprio comando gera `stop-check.json`. Preserva sessão parcial e motivo de parada. Imagens e resultados permanecem ignorados pelo Git.

`pressRequests` conta solicitações, não cliques comprovadamente entregues. `liveInputTested` só indica tentativa de pressionamento; `selectionDeliveryVerified` fica falso para conferência posterior. `captureComplete` e `inventoryAccepted` permanecem falsos: mesmo um prefixo lido não é um inventário completo/aprovado. `prefix-read` indica retornos do leitor, não campos corretos.

As [divergências medidas no leitor original](youkai-personal-images.md) continuam: progressão, descarte da raridade no item e lock. O helper estático original usa a faixa de lock da célula 0,0; por isso cada observação registra `lockSelectedCellVerified: false`. Não aplicar esses resultados à conta nem considerar o total do cabeçalho uma contagem S/A.

## Verificação executada e pendências

- **17 testes novos passaram**, sem inputs no desktop, cobrindo parada antes de eventos, foco/geometria, liberação após parada, rolagem bloqueada, alvos, orçamento/prazo, posições iguais, skip/falha OCR e recibos inválidos/expirados.
- Um desses testes executa o **`GridNavigator.scan(3)` original**, com imagens e controlador simulados. Produziu índices 0/1/2 e quatro cliques simulados nas colunas 1/0/1/2, sem rolagem. Não é entrega de input ao jogo.
- Em conjunto com os 14 testes de captura: **31 aprovados**. Os 273 upstream/P1.1 e 135 JS são históricos; não foram repetidos nesta etapa.
- Preflight real em Windows PowerShell 5.1: `.cache/youkai-p1/runs/20261020-175721-ddb1c7ab-selection/session.json`, parado por integridade **8192 < 12288**, `liveInputTested: false`. Nenhum clique, tecla ou rolagem foi emitido.
- OCR do cabeçalho sobre a captura real já salva, sem nova captura: leu `W-Engine Storage [ 1567/2000 |`, candidato 1567. A condição textual/numérica do helper aceita essa referência; não confirma contagem S/A nem cobertura atual.

**Estado atual:** check F8 inicial e seleção real conferidos na execução abaixo. Falta testar interrupção em curso; preparar as correções mínimas do piloto P2 com essa pendência explícita. Se o caminho exigir reconstruir captura/grade/reconhecimento, aplicar a regra de reavaliação do [ROADMAP](ROADMAP.md).

## Primeira seleção real — 20/10/2026

Cristian executou o comando no PowerShell elevado, sobre o código do commit `ebbbb23`, e forneceu o log. Sessão local: `.cache/youkai-p1/runs/20261020-180856-c241469b-selection/`. Helper e jogo apresentaram integridade **12288**, permitindo o ensaio. O recibo confirma F8 observado antes dos inputs. O navegador reconheceu o topo com **zero rajadas de rolagem** e concluiu três posições, sem retentativas registradas, `upstreamIncomplete: null`.

O assistente abriu os três PNGs de posição e o frame intermediário da preparação. A seleção destacada corresponde às colunas 0/1/2 da primeira linha, e cada painel mostra o item correspondente. Os três nomes e níveis 60/60 retornados pelo leitor original conferem com a inspeção visual. As imagens mostram candidatos S/progressão 1; essa amostra não valida os casos de progressão 2/4 já divergentes. Todos exibem cadeado fechado, enquanto o leitor retorna `lock: false`.

Foram conferidos cinco hashes de frames, os três vínculos imagem/observação e quatro pares de solicitação de pressionamento/liberação: preparação na coluna 1, depois colunas 0/1/2. A correspondência entre destaque, painel e posição comprova entrega de seleção neste recorte; o hash diferente sozinho não faria isso. As observações 1/2 pegaram o painel ainda escurecido pela transição, apesar de nome e nível corretos. P2 precisa conferir estabilização do painel antes de aceitar a leitura; mudança de hash não prova que a animação acabou.

A revisão separada está em `selection-review.json`, vinculada pelo SHA-256 do `session.json`. O relatório original foi preservado, incluindo `selectionDeliveryVerified: false`; a revisão do assistente registra a conferência posterior. Não existe aprovação humana dos campos desses três itens. Imagens, relatório e revisão continuam ignorados pelo Git; este registro agregado preserva o resultado no histórico versionado.

**Comprovado:** captura e seleção originais funcionaram juntas neste ambiente 1280×720/100%, com acesso de input compatível. **Ainda não comprovado:** F8 interrompendo durante cliques, reação real a perda de foco/geometria, cópias iguais, rolagem/fim, filtro S/A ou inventário completo. Não repetir este ensaio bem-sucedido sem motivo; agrupar as paradas restantes com o próximo piloto preparado. Não houve nova execução de suítes nem mudança de comportamento ao registrar esta prova.

**Continuidade — 22/10/2026:** o [piloto P2](zzz-pilot.md) agora tem comando de dez posições, leitor adaptado, verificação de estabilidade, recuperação de cópias por evidência de seleção e revisão HTML. Validado offline; a seleção real documentada aqui continua sendo a prova de três posições original, sem ser apresentada como execução do novo piloto.
