# P3.3 — percurso ZZZ integrado com limite

Implementado em **23/10/2026**, após a [transição real conferida](zzz-transition.md#transição-real-aceita-no-recorte--23102026). O padrão é **54 posições, seis linhas lógicas e três rolagens**, em uma sessão. Implementação verificada em simulação; percurso real com várias rolagens ainda pendente. Este recorte entrega ampliação do percurso, sem declarar inventário completo nem fim da lista.

## Uma execução para validar o conjunto

1. Deixar W-Engines **no topo da lista**, inglês, janela 1280×720 e escala Windows 100%, com o mesmo inventário. Não mudar filtros/ordenação durante a coleta.
2. No PowerShell **como Administrador**, executar:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "D:\Repo\gacha-ocr-lab\scripts\scan-zzz.ps1" -Run
```

3. Pressionar e soltar F8 na confirmação inicial. Após cinco segundos, o programa pede foco ao jogo. Manter o jogo em primeiro plano e deixar os controles livres até encerrar. Pode levar alguns minutos; o terminal registra o avanço de cada posição. F8 interrompe se necessário.
4. Enviar **somente o caminho de `session.json`**, inclusive em caso de recusa. Não precisa copiar o terminal, revisar todos os itens manualmente ou executar os testes antigos.

**Pergunta que esta sessão resolve:** a seleção/leitura continua correta ao percorrer seis linhas, atravessar três rolagens e preservar cópias, exclusões e incertezas? O resultado esperado é `status: prefix-read`, `reason: requested-limit-reached`, `prefixTraversalComplete: true`, 54 posições processadas e três transições verificadas. Isso não exige que todos os campos estejam reconhecidos: a incerteza deve permanecer registrada.

## Percurso e evidências

[scripts/scan-zzz.ps1](../scripts/scan-zzz.ps1) usa o lançador/ambiente de [probe-youkai.ps1](../scripts/probe-youkai.ps1). [zzz_scan.py](../scripts/zzz_scan.py) acrescenta somente o percurso ZZZ; captura, OCR v2, controle guardado e revisão são reutilizados. Não extrai o núcleo multijogo antes de ZZZ funcional.

- Lê as primeiras três linhas. Depois, usa uma roda descendente por nova linha, mantém como âncora o último cartão selecionado e comprova deslocamento de uma linha pela seleção, sobreposição e scrollbar. Lê a nova terceira linha, sem clicar nas bordas superior/inferior da grade rolada.
- A ordem das posições deriva do percurso e das transições verificadas. Nome, campos ou hashes iguais não fundem cópias. Não há retentativa automática de clique/roda; falha mantém o estado parcial.
- Cada posição tem imagem, hash, linha lógica, linha visual, coluna, deslocamento da janela de inventário, prova de seleção e leitura/candidatos/brutos. As tentativas de estabilização também são preservadas.
- Cada transição tem capturas antes/depois, medida de sobreposição, scrollbar, estado e motivo de falha. A sessão contém frames iniciais/finais, eventos e contadores de inputs.
- `scanSummary` reúne processados, transições verificadas, `included` (S/A), `excluded-B`, `pending-rarity`, campos incertos e posições falhas. `review.html` mostra resumo, imagens e campos. O assistente analisa essa evidência antes de pedir outra execução.

## Limites e interpretação

`-Limit` aceita 1–180; o padrão 54 foi escolhido para observar várias fronteiras em uma coleta curta. O orçamento permite um clique por posição e `ceil(limit/9)-3` rodas (mínimo zero). Para 54, até 354 segundos para novos inputs e 708 frames; um OCR em andamento não é encerrado à força. Sem `-Run`, só confere metadados/acesso.

O topo do scrollbar ainda é candidato; índice absoluto e cobertura não são promovidos automaticamente. O cabeçalho continua candidato de contagem global e não comprova quantidade S/A. O percurso exige espaço de pelo menos uma linha completa abaixo do recorte pedido (para 54, cabeçalho candidato de pelo menos 63), além de quatro linhas iniciais preenchidas. Não tenta resolver a borda final do inventário por falta de progresso.

`prefixTraversalComplete` significa somente que o recorte foi processado. `captureComplete`, `inventoryAccepted` e `coverageConfirmed` permanecem falsos; `endOfInventory` fica nulo. B pode ser registrado como evidência de exclusão, sem entrar no inventário-alvo. A quantidade processada não equivale à quantidade S/A aprovada. Paradas preservam os itens anteriores e frames; não retomam automaticamente.

## Verificação local e próxima implementação

Quatro cenários integrados percorrem o CLI com janela, controlador, OCR e tempo simulados: 54 posições/3 transições; 50 posições com última linha do recorte parcial; perda de foco após a segunda roda; segunda roda sem progresso. Conferem ordem/ausência de omissões, cópias com campos iguais, B excluído, campos incertos, limites de inputs e sessão parcial. Nenhum input nativo é emitido por esses testes. A regressão dos modos anteriores acompanha as mudanças no lançador compartilhado: 120 casos locais aprovados nesta entrega. O comando sem `-Run` também foi exercitado no Windows PowerShell 5.1: sessão `20261023-100309-e33e75a7-selection`, recusada por integridade helper inferior à do jogo antes de foco/captura/inputs. A execução real requer o PowerShell como Administrador já utilizado por Cristian.

Depois de conferir a sessão real integrada, concluir em P3.3 a estratégia de última linha/fim e a semântica de contagem/filtro S/A. Agrupar a validação desses comportamentos em um percurso; não voltar a pedir fragmentos manuais por campo/ação. P3.4 mantém duas coletas completas conferidas e pacote Windows.
