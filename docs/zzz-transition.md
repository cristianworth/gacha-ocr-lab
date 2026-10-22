# P3.2 — uma transição de grade ZZZ

Implementado em **22/10/2026**, após o [piloto de dez posições](zzz-pilot.md). **Implementação verificada em simulação; transição real ainda pendente.** F8, perda de foco e movimentação da janela em P2 foram confirmados em sessões reais. O próximo passo é executar a transição limitada já preparada. Este recorte não implementa coleta completa, contagem S/A, término de inventário ou executável independente.

## Comportamento limitado

[scripts/transition-zzz.ps1](../scripts/transition-zzz.ps1) reutiliza o ambiente, preflight, F8 inicial, captura/calibração, guardas, leitor v2, JSON e revisão HTML já existentes. O módulo [zzz_transition.py](../scripts/zzz_transition.py) acrescenta uma única transição:

1. Captura e espera o painel inicial legível/estável; registra a grade e o scrollbar. Exige candidato de topo e última linha visível preenchida, além de cabeçalho global acima de 36 posições.
2. Usa `natural_click()` e `DEFAULT_GRID.cell_center(0, 3)` públicos do Youkai: o mesmo clique na primeira célula da última linha utilizado pela estratégia original para avançar a grade. O orçamento permite **um único clique**, sem roda ou retentativa automática.
3. Espera a célula correspondente aparecer selecionada na linha anterior, com painel legível/estável. Verifica o avanço do scrollbar e a sobreposição de miniaturas entre três linhas anteriores/posteriores.
4. Só lê o item se houver evidência de deslocamento de **exatamente uma linha**. Grade parada, salto de duas linhas, scrollbar imóvel ou sobreposição ambígua preservam os frames e encerram sem aceitar a leitura.

As comparações de miniaturas medem movimento de tela; não identificam itens nem deduplicam cópias. Um nome/hash diferente não comprova rolagem. O limiar de topo herda a geometria medida do Youkai, mas não garante um índice global: o relatório mantém `absoluteInventoryPositionConfirmed: false`. A posição registrada é a célula na tela após a transição. `coverageConfirmed` fica falso e `endOfInventory` fica nulo.

Não chama métodos privados do navegador nem modifica fonte upstream. A decisão de testar uma transição separada evita passar um limite de ensaio como se fosse a quantidade total do inventário. O percurso completo será ampliado após observar esta fronteira real.

## Antes do ensaio real

O [teste explícito de F8](zzz-pilot.md#segundo-f8-confirmado--22102026) foi aprovado na sessão `20261022-113802-38781f4a-selection`: segunda tecla recebida após a primeira leitura, parcial salva e nenhum novo pressionamento após o sinal. A perda de foco foi confirmada na sessão `20261022-115151-d35db31b-selection`. A [movimentação da janela](zzz-pilot.md#movimentação-da-janela-confirmada--22102026) foi confirmada em `20261022-120911-985f905a-selection`, sem novos inputs após a detecção. As guardas previstas têm evidência real no ambiente inicial; não repetir esses ensaios por rotina.

Preparação para a transição: W-Engines no topo, inglês, cliente 1280×720, escala 100%, quatro linhas preenchidas e itens além delas. Usar PowerShell **como Administrador**, no mesmo nível do jogo. Reservar os controles e manter o jogo em primeiro plano. O comando só deve ser executado como ensaio limitado combinado, não como coleta completa.

```powershell
# Somente metadados/acesso, sem captura ou inputs:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "D:\Repo\gacha-ocr-lab\scripts\transition-zzz.ps1"
# Ensaio real de uma transição, depois da validação de parada:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "D:\Repo\gacha-ocr-lab\scripts\transition-zzz.ps1" -Run
```

No ensaio real, pressionar/soltar F8 quando solicitado confirma o listener. Após cinco segundos, o programa solicita foco, prepara a captura, faz o único clique e verifica o resultado. F8 novamente interrompe. Não há elevação automática.

**Resultado esperado:** uma linha avançada e um item lido; relatório `status: transition-read`, `transition.verified: true`. Se não houver comprovação, deve encerrar com motivo e evidências, sem inventar posição nem fim de inventário. O comportamento nativo da rolagem ainda será medido; uma recusa será analisada a partir da sessão antes de pedir repetição.

## Roteiro do primeiro ensaio

1. Abrir W-Engines no topo da lista, em inglês, janela 1280×720 e escala Windows 100%. Manter quatro linhas preenchidas e itens além delas. A posição da janela pode ser a atual: o comando faz nova calibração.
2. No PowerShell como Administrador, executar somente o comando real abaixo:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "D:\Repo\gacha-ocr-lab\scripts\transition-zzz.ps1" -Run
```

3. Pressionar e soltar F8 na confirmação inicial. Após cinco segundos, o programa pede foco ao jogo.
4. Deixar os controles livres e o jogo em primeiro plano. O scanner deve clicar **uma vez no primeiro cartão da quarta linha**. Esperamos que a grade suba uma linha e que esse cartão apareça selecionado na terceira linha.
5. O comando confere movimento, espera o painel estabilizar, lê esse único item e encerra. Não há beep/pausa para uma ação humana neste ensaio. Aguardar cerca de 15 segundos após o clique antes de voltar ao terminal; o limite de novos inputs é 30 segundos, sem interromper à força um OCR já iniciado.
6. Enviar o caminho de `session.json`, inclusive se houver recusa. Se houver qualquer ação inesperada, F8 interrompe; informar isso ao enviar a sessão. Não repetir sem análise.

**Esperado no relatório:** `status: transition-read`, `transition.verified: true`, um pressionamento e uma leitura. Isso comprova uma transição, sem afirmar índice global, cobertura ou fim de inventário.

## O que enviar

Basta o caminho de `session.json` ou da pasta que o terminal informar. Não precisa copiar o terminal inteiro quando o relatório foi salvo. Se o comando falhar antes de produzir o caminho, enviar a mensagem de erro.

Os arquivos ficam em nova pasta `.cache/youkai-p1/runs/<data-hora-id>-selection/`: `session.json`, `review.html`, captura inicial, `transition-before.png`, frames de espera e `position-00.png`/recortes quando disponíveis. Falhas mantêm sessão parcial. Nada é aplicado ao Advisor.

## Verificação executada

**89 testes aprovados:** 16 novos de transição/parada e 73 regressões anteriores. Os testes novos não emitem inputs nativos.

- Deslocamentos de zero, uma e duas linhas; grade indistinguível; scrollbar parado; contagem global pequena; perda de foco/parada após clique; preservação do frame quando a transição é recusada.
- A sequência positiva simulada envia só o clique de fundo e lê um item; não afirma cobertura nem término. Nenhum input nativo foi enviado pelos testes.
- Fluxo completo do novo teste F8 exercitado com Win32/mouse/teclado simulados: sinal inicial + segundo sinal gera `stopTest.passed: true` e sessão parcial; somente sinal inicial termina como teste não concluído. A primeira leitura permanece preservada.
- Medições sobre a captura real já salva: scrollbar em 238,5, nove recortes da última linha com variação visual suficiente, e duas imagens sem rolagem corretamente recusadas como avanço. Isso não é execução real de rolagem.
- Preflight do comando no Windows PowerShell 5.1: `.cache/youkai-p1/runs/20261022-111906-40763847-selection/session.json`. Recusou integridade inferior do helper antes de captura/foco/inputs. O processo deste chat não recebeu elevação Windows por executar ferramentas fora do sandbox.

Depois da transição aceita: exercitar linha final parcial, verificar filtro/contador S/A e estratégia de término em P3.3. Em P3.4, duas coletas conferidas e pacote Windows. O F8 já tem prova real separada; foco e movimentação da janela também foram conferidos. Mudança real de tamanho/DPI não foi exercitada; a transição real continua sendo o próximo passo.
