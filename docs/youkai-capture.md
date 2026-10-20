# Youkai — P1.3 captura cliente única

Preparado em **20/10/2026**, base `f579f122648d47cc900a2ac8e4a60665bad73937`. Cristian pediu revisar o planejamento existente e avançar ao próximo passo. Este recorte executa somente a aquisição de uma imagem pelo caminho original; seleção, cliques, teclas e rolagem ficam para a prova limitada seguinte.

## Preparação e comando

Deixe ZZZ aberto e restaurado no inventário de W-Engines, em **janela 1280×720**, inglês, escala Windows **100%**. O ambiente isolado de P1.1 deve estar preparado.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\capture-youkai.ps1 -FocusGame
```

Há uma contagem de cinco segundos. `-FocusGame` pede à função original do Youkai para trazer a janela à frente, sem selecionar itens. Para focar manualmente, omita a opção e traga ZZZ à frente durante a contagem. Ctrl+C cancela; este comando de captura única não instala um listener de Escape/F8.

O resultado fica em um novo diretório `.cache/youkai-p1/runs/<data-hora-id>-capture/`:

- `client.png`: a imagem original da área cliente 1280×720, sem barra de título e sem recorte manual.
- `grid-preview.png`: cópia com o retângulo e 36 pontos calculados pelo `DEFAULT_GRID` original, em coordenadas da imagem. São marcações diagnósticas; nenhum ponto foi clicado.
- `capture.json`: estado, motivo de falha/parada, janela/calibração, SHA-256 da captura e flags explícitas de validação pendente.

O comando recusa janela ausente/ambígua, título diferente de `ZenlessZoneZero`, área cliente fora de 1280×720, DPI diferente de 96 (100%), falta/perda de foco, mudança de posição/geometria e imagem com tamanho inesperado. A estabilidade é conferida antes e depois da aquisição. Uma imagem rejeitada por essas verificações não é salva como captura aceita.

Para somente inspecionar metadados, sem capturar pixels nem alterar foco:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\capture-youkai.ps1 -CheckWindow
```

`-CheckWindow` não pode ser combinado com `-FocusGame`. Ele permite diagnosticar disponibilidade; não prova captura.

## Conferência prática

1. Abra `client.png`: deve mostrar o inventário ZZZ completo, incluindo grade e painel do item, sem barra de janela ou sobreposição que impeça conferir os campos.
2. Abra `grid-preview.png`: confira se todos os pontos estão dentro dos cartões correspondentes. Isso avalia coordenadas, não entrega de input.
3. Com a captura conferida, a leitura original por arquivo usa a imagem já pronta, sem remover bordas:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\read-youkai-image.ps1 -ImagePath "<diretorio-da-captura>\client.png" -ClientArea "0,0,1280,720"
```

As falhas de progressão e os limites de raridade/lock da candidata continuam explícitos. Uma captura válida não transforma seus resultados em inventário aprovado.

## Reaproveitamento e limites

`scripts/youkai_capture.py` usa as funções públicas originais `list_game_windows()`, `focus_game_window()` (quando solicitado) e `calibrate_window()`/callback. Não reimplementa a aquisição de tela nem altera a candidata. A função original tenta dxcam e permite fallback Pillow; o caminho efetivamente usado não foi instrumentado e não é apresentado como confirmado. Os 260 arquivos upstream são conferidos contra o ZIP antes da operação.

As verificações adicionais são locais a esta prova: alvo único, foco, DPI, geometria e estabilidade. Não foi extraído um núcleo geral, incorporada a interface Rust ou iniciado um coletor ZZZ. Os arquivos pessoais e resultados permanecem ignorados pelo Git.

## O que foi verificado nesta entrega

- **14 testes novos aprovados**, com APIs de desktop simuladas: captura única, foco explícito ou ausente, janela ausente/ambígua, título/tamanho incompatível, DPI incompatível, calibração divergente, janela movida, foco perdido e frame inesperado.
- Comando `-CheckWindow` executado no **Windows PowerShell 5.1**, na sessão real acessível (25 janelas visíveis na consulta inicial). Não havia janela ZZZ visível/restaurada que correspondesse aos títulos aceitos. Resultado: `game-window-not-found`, relatório de falha salvo e nenhuma imagem capturada. Isso não prova que o processo esteja fechado; janela minimizada ou título diferente também não é aceita.
- Relatório real: `.cache/youkai-p1/runs/20261020-171603-5c18a217-capture/capture.json`. A ausência de imagem/flag de captura foi conferida.
- Prévia offline sobre um PNG pessoal já fornecido: `.cache/youkai-p1/runs/capture-preview-offline/grid-preview.png`. A inspeção do assistente encontrou os 36 pontos dentro dos cartões. Essa imagem não é captura ao vivo e não valida cliques.
- Os testes upstream/P1.1 e leituras P1.2 continuam históricos; não foram repetidos nesta entrega.

**Pendente:** captura cliente real com o jogo disponível, conferência visual da aquisição e prova limitada de avanço. A resposta de prontidão foi solicitada a Cristian; nenhuma janela de teste com cliques foi iniciada. O passo seguinte exige mecanismo de parada e recusa de foco/geometria antes dos inputs; Escape nativo não deve ser confundido com o F8 previsto para o piloto do laboratório.
