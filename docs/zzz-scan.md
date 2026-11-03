# ZZZ — coleta S/A nível 20+

Guia de uso atual. O aplicativo coleta W-Engines **S/A com nível atual >=20**, em todas as progressões, e encerra no primeiro nível confiável abaixo de 20. Cristian prepara os filtros e a ordenação; o programa não navega pelos menus.

## Preparar o jogo

- Windows, jogo em inglês, área cliente **1280×720**, escala Windows **100%**. Manter o perfil já conferido, sem HDR/filtros de cor que alterem as capturas.
- Em W-Engine Storage, selecionar **S e A**, desmarcar **B** e deixar as especialidades desmarcadas.
- Preparar **Level do maior para o menor**, fechar o filtro e voltar ao topo. Depois soltar os controles e esperar a lista parar. Não precisa clicar em um item.
- Durante a coleta, manter o jogo em primeiro plano e reservar mouse/teclado ao scanner.

Filtro e ordenação são diferentes: uma referência antiga mostra **Rarity**, mesmo com níveis decrescentes naquela conta. O corte antecipado requer **Level decrescente declarado na preparação**; o aplicativo não confirma visualmente o seletor.

## Abrir a janela

Abra `gacha-ocr-zzz.exe` ou `scan-desktop.cmd` junto da instalação completa e aceite o aviso de Administrador. O `.exe` é só a chamada do CMD. Confirme a preparação na janela e clique **Iniciar coleta**. HSR fica “em breve”, sem coleta. Quando o andamento solicitar F8, volte ao jogo e pressione/solte uma vez; os cinco segundos para foco continuam.

Durante aquisição, mantenha o jogo na frente. F8 interrompe sem tirar o foco; clicar na janela pode disparar a proteção de foco e preservar parcial. **Interromper** ou **X** envia uma solicitação cooperativa e aguarda o processo; painéis já salvos ainda são processados. Depois do término, **Abrir resultado** abre o resumo da própria tentativa (ou relatório/pasta como fallback) e **Abrir pasta** mostra seus arquivos. A janela só consulta o manifesto depois de o processo sair.

A integração gráfica tem testes com processos reais de stub e testes do sinal no CLI com desktop simulado. A coleta pela janela em 02/11 preservou os 34 elegíveis; Cristian confirmou UAC, término e abertura do resumo. Parada/X não foram acionados nessa coleta; permanecem cobertos por simulações. [Evidências](zzz-evidence.md#primeiro-uso-da-interface-zzz--02112026). O fluxo de console abaixo continua disponível e já foi conferido anteriormente.

## Fallback — console por duplo clique

**Objetivo:** obter um resumo dos W-Engines 20+ sem digitar comandos ou percorrer os níveis baixos.

1. Depois de preparar o jogo, abrir **`scan-zzz.cmd`**, na raiz do laboratório ou na pasta portátil extraída. Aceitar o aviso de Administrador do Windows. Isso abre um console visível; ainda não deve clicar ou rolar o jogo.
2. Ler a preparação no console e confirmar com **Enter**. **0 cancela** antes da coleta. A lista deve permanecer parada; não precisa clicar em item.
3. Quando aparecer **“Antes de comecar: pressione e solte F8”**, voltar ao jogo e pressionar/soltar **F8 uma vez**, em até 30 segundos. Não esperar mensagem do chat. Aguardar os cinco segundos de preparação com o jogo na frente.
4. Durante a captura, não clicar nem rolar. A lista se move somente pelo programa. **F9 não é usado**; **F8 interrompe os inputs** se necessário.
5. No caminho normal, o programa salva os painéis confirmados e faz a leitura detalhada depois. Quando aparecer **“Captura encerrada. Processando imagens salvas”**, não haverá novos cliques ou rolagens; já pode usar o computador enquanto aguarda. Nível ilegível na grade ainda recebe leitura imediata para decidir o corte com segurança.
6. Aguardar o encerramento do processamento. O resumo da própria sessão abre no **Bloco de Notas**, inclusive quando o resultado for parcial. Se não houver resumo, o lançador tenta o relatório visual ou mostra a pasta/diagnóstico disponível.

No repositório, o lançador reutiliza a instalação local de Python/Tesseract/cache. No [pacote portátil](zzz-portable.md), usa o executável e o OCR incluídos na pasta, sem instalar dependências. O `gacha-ocr-lab.exe` antigo pertence ao experimento Genshin e não inicia esta coleta ZZZ.

## Entender o resultado

A pasta da sessão fica em `.cache/youkai-p1/runs/` e é identificada no console. Não escolher “a pasta mais recente” durante uma execução: o lançador conhece a pasta que criou para aquela chamada.

| Arquivo | Uso |
|---|---|
| `summary.md` | Tabela dos elegíveis, campos pendentes e resultado da coleta |
| `review.html` | Imagens e diagnóstico detalhado para conferir uma dúvida |
| `session.json` | Registro original, campos, evidências e motivo do término |
| `console.log` / `exit-code.txt` | Acompanhar a operação e verificar quando o processo encerrou |

O total do cabeçalho representa a **lista preparada**, incluindo os níveis baixos. O resumo separa total, posições observadas, elegíveis, exclusões observadas e restantes não lidos pela ordenação. O primeiro item abaixo do corte pode ser registrado sem clique/OCR detalhado; os demais não são apresentados como individualmente lidos.

- Nível ilegível não dispara parada: recebe leitura do painel ou permanece pendente. Contradição observada na ordenação impede confirmar cobertura por nível.
- Nome incerto fica visível, sem trocar o bruto por um candidato. Cópias já observadas ficam separadas; não há identificação persistente entre sessões.
- Cobertura dos elegíveis e aprovação humana são resultados distintos. Um código de saída zero não aprova os dados.
- Confirmação humana é específica aos campos e à sessão. Revisão separada não corrige automaticamente o OCR de futuras coletas.
- Nada é aplicado automaticamente ao Advisor. Ausência numa coleta filtrada não remove fatos existentes.

A revisão recomendada é focada nas pendências; não exigir conferência dos 34 itens nem outra coleta por rotina. Na sessão de referência, Cristian confirmou os nomes das posições 14, 25 e 34 em revisão separada. [Evidências e links locais](zzz-evidence.md#revisão-humana-dos-nomes--29102026).

## Se parar ou falhar

A execução preserva o resultado parcial quando possível. Não preparar outra campanha de teste antes de analisar os arquivos. Em atendimento acompanhado, basta avisar que terminou: o agente pode localizar a execução mais recente na instalação conhecida, conferir a pasta/horário e esperar `exit-code.txt` antes de ler o resultado. Usar horário como pista, sem confundir outra instalação ou sessão em andamento com a coleta informada. Pedir **somente o caminho de `session.json`** quando a pasta mudou, está inacessível ou há ambiguidade; não é necessário copiar o terminal ou mandar capturas soltas. O lançador e a futura interface continuam vinculados à pasta exata criada por eles.

F8, perda de foco, mudança de janela/geometria/DPI e limites de segurança interrompem os inputs. Elevação do comando precisa ser compatível com o jogo; aprovação da ferramenta do agente não equivale a PowerShell Administrador no desktop.

O executor também observa `stop.request` na pasta exata da sessão, inclusive durante a espera inicial de F8 e os cinco segundos. A janela entrega esse sinal sem pré-criar a pasta exigida pelo probe. `externalStop.observed` no bruto distingue observação efetiva do sinal de uma perda de foco que tenha ocorrido antes. Nenhum comando de input, configuração ou aprovação é recebido por esse arquivo. Após cessar a aquisição, o processamento já previsto continua sem novos inputs.

Durante a execução, acompanhar apenas `console.log`. Ler `session.json` depois de existir `exit-code.txt`: leitores podem bloquear sua substituição atômica no Windows. A gravação tem retentativas curtas e limitadas para bloqueio temporário; erro persistente continua explícito.

O caminho normal mantém PNGs, hashes, crops e OCR bruto. O JSON continua sendo salvo nos checkpoints; o HTML é gerado ao finalizar ou parar, sem ser refeito a cada frame. Imagens aguardando leitura são `captured-pending` e não contam como escopo concluído. Uma imagem alterada, erro de leitura ou conflito entre nível da grade e painel mantém resultado parcial. F8/perda de foco encerram os inputs; os painéis já salvos ainda podem ser processados sem exigir foco no jogo.

A coleta normal usa um gravador com fila limitada a quatro imagens, em paralelo às verificações do painel. O JSON continua sob responsabilidade do processo principal; cada seleção só é confirmada depois de todas as suas imagens estarem gravadas. F8/perda de foco encerram os inputs e a limpeza espera as imagens aceitas. Falha de gravação deixa a saída parcial; não autoriza mais inputs nem cobertura concluída. Interromper o processo à força pode perder imagens ainda na fila.

As verificações normais são agendadas a cada 60 ms, contando o trabalho já executado e respeitando os mesmos 0,25 s de estabilidade. A diferença visual também é limitada em relação ao início dessa janela; aumentar a frequência não autoriza aceitar uma animação lenta. Isso pode gerar aproximadamente o dobro de PNGs intermediários; evidências não são descartadas para ganhar tempo. `evidenceWriting` registra fila, gravações e falhas; `performance.panelPolling` registra a política. Para comparação técnica com o modo anterior, `scan-zzz.ps1 -Inventory -SAFilterPrepared -LevelDescendingPrepared -Run -SynchronousEvidence`; OCR nativo e leitura após captura continuam. `-Diagnostics`/`-FullInventory` preservam seus modos anteriores.

O leitor normal reutiliza um engine da DLL Tesseract que acompanha o pacote, em vez de iniciar o executável para cada crop. Modelo e regras dos campos permanecem. `ocrBackend` identifica esse caminho ou registra fallback para CLI se a inicialização nativa falhar. As evidências usam PNG lossless com compressão mais rápida: pixels preservados e arquivos maiores. Os modos de diagnóstico mantêm seu leitor CLI/comparação original.

## Instalação e comandos técnicos

Para preparar o ambiente isolado em uma instalação de desenvolvimento, seguir a [qualificação do Youkai](youkai-qualification.md#reproduzir). Depois de preparado, a coleta ZZZ usa `.cache/youkai-p1/.venv/`, Tesseract e a fonte fixada em cache; Node.js não participa desse caminho.

Verificar a instalação do lançador, sem UAC, jogo ou inputs:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-zzz.ps1 -Check
```

A CLI continua disponível para desenvolvimento, em PowerShell como Administrador:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\scan-zzz.ps1 -Inventory -SAFilterPrepared -LevelDescendingPrepared -Run
```

Para diagnosticar com o caminho síncrono anterior e a comparação OCR upstream adicional, acrescentar `-Diagnostics`. `-FullInventory` mantém esse comportamento diagnóstico. Nenhum desses modos precisa ser repetido por rotina. A leitura de uma imagem estática continua com a comparação por padrão. No caminho normal, `originalComparison.state=not-requested` distingue comparação dispensada de falha; os cinco campos mantêm seu leitor e suas regras.

O relatório normal registra `phase` (`acquiring`, `processing`, `finished`) e `performance`: tempo de aquisição, processamento posterior, OCR imediato por nível ilegível, captura, espera da lista/painel, OCR do nível na grade e gravação dos frames intermediários. Esperas incluem as capturas/gravações chamadas dentro delas: **não somar esses spans como se fossem etapas independentes**. Esses tempos não incluem toda a preparação anterior ao percurso. [Medições e limites da melhoria](zzz-performance-plan.md).

`-SAFilterPrepared` e `-LevelDescendingPrepared` registram a preparação manual, sem abrir menus. O corte é fixo em 20; o parâmetro de compatibilidade `-MinLevel` aceita somente 20. O fluxo normal não oferece 40+.

O lançador passa `-RunDirectory` aos scripts para identificar sua própria tentativa. Esse parâmetro técnico aceita somente uma pasta nova diretamente dentro de `.cache/youkai-p1/runs/` deste laboratório; não reutiliza ou sobrescreve uma sessão existente. O resultado é lido somente após o scanner encerrar, e um manifesto parcial não é tratado como sucesso apenas porque o processo retornou zero.

### Diagnósticos preservados

Usar somente por uma dúvida concreta, sem reabrir ensaios encerrados:

| Necessidade | Comando / referência |
|---|---|
| Percorrer a lista S/A até o fundo | `scan-zzz.ps1 -Inventory -SAFilterPrepared -FullInventory -Run` |
| Prefixo limitado | `scan-zzz.ps1 -Run` mantém o recorte histórico de 54 posições |
| Ler da seleção atual até a última coluna, sem roda | `row-zzz.ps1 -Run` |
| Referências passivas de filtro/fundo | `scan-zzz.ps1 -Inventory -CollectReferences -Run`; [roteiro histórico](zzz-evidence.md#roteiro-passivo-de-referências--somente-por-dúvida-concreta) |

Na coleta passiva, pode conversar no chat entre capturas. O jogo precisa estar na frente durante cada captura; **F9** sinaliza a referência. Esse modo não faz cliques/rodas e não equivale a aquisição do inventário.

## Contratos e limites do perfil

O executor está em [zzz_inventory.py](../scripts/zzz_inventory.py), integrado por [youkai_selection.py](../scripts/youkai_selection.py). A estabilização de lista em [zzz_transition.py](../scripts/zzz_transition.py) independe de painel/seleção. O leitor dos cinco campos permanece em [zzz_pilot.py](../scripts/zzz_pilot.py).

| Campo | Significado |
|---|---|
| `scopeComplete` | Processamento do escopo elegível concluído |
| `captureComplete` | Todas as posições do percurso físico processadas; continua falso na parada antecipada com posições omitidas |
| `endOfInventory` | Fundo físico observado; pode ficar sem confirmação no caminho curto |
| `coverageConfirmed` | Cobertura sustentada pelas evidências e preparação, sem pendências de nível/raridade/seleção; nomes incertos não a bloqueiam |
| `inventoryAccepted` | Aprovação humana global; não é promovida automaticamente |
| `notReadByLevelOrder` | Restantes não lidos pela ordenação, separados das exclusões efetivamente observadas |

O observador combina contagem, ocupação/EMPTY, início, sobreposição e barra. Cada roda precisa de avanço confirmado; repetição de painel não identifica cópia nem prova fim. Barra ausente exige evidência de ausência e difere de barra ilegível. A grade não presume linha cheia no fundo. Confirmação após seleção distingue movimento comprovado de evidência insuficiente.

O nível da grade exige duas leituras literais concordantes `Lv.` + inteiro 0–60. Não se trocam letras por dígitos. No ambiente observado existem `Lv.0` e `Lv.00/10`; não normalizar para um por convenção externa. Todas as progressões de 20+ continuam incluídas; lock não filtra elegibilidade.

Listas vazias/curtas e deslocamento final fracionário têm contratos/simulações, mas não novas referências reais aceitas para todos os casos. Outros tamanhos/DPI, barra ilegível e inventário alterado durante a captura podem produzir parcial. O perfil atual não mede a precisão geral do OCR.

A [evidência técnica](zzz-evidence.md) conserva hashes, sessões, correções e amostras. O [ROADMAP](ROADMAP.md) define o próximo recorte; este guia não mantém uma segunda lista de tarefas.
