# P3.3 — percurso ZZZ integrado com limite

Implementado em **23/10/2026**, após a [transição real conferida](zzz-transition.md#transição-real-aceita-no-recorte--23102026). O padrão é **54 posições, seis linhas lógicas e três rolagens**, em uma sessão. Primeiro percurso real chegou a 45 posições e três solicitações de roda; a terceira transição foi recusada por falso destaque em etiquetas NEW!. O perfil v3 corrigiu essa falha, com replay offline das duas sessões; posteriormente, a sessão `20261023-103911-485104ab-selection` concluiu 54/54 posições e três transições verificadas. Este recorte entrega ampliação do percurso, sem declarar inventário completo nem fim da lista.

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

[scripts/scan-zzz.ps1](../scripts/scan-zzz.ps1) usa o lançador/ambiente de [probe-youkai.ps1](../scripts/probe-youkai.ps1). [zzz_scan.py](../scripts/zzz_scan.py) acrescenta somente o percurso ZZZ; captura, leitor v3, controle guardado e revisão são reutilizados. Não extrai o núcleo multijogo antes de ZZZ funcional.

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

A sessão real integrada de 54 posições foi conferida; concluir agora em P3.3 a estratégia de última linha/fim e a semântica de contagem/filtro S/A. Agrupar a validação desses comportamentos em um percurso; não voltar a pedir fragmentos manuais por campo/ação. P3.4 mantém duas coletas completas conferidas e pacote Windows.

## Parada repetida antes da posição 46 — diagnóstico de 23/10/2026

Sessões `.cache/youkai-p1/runs/20261023-101045-ac61dc4d-selection/` e `20261023-101543-ad9b1eb4-selection/`, ambas no código `99fbfa2`: 45 posições processadas, 45 pares de pressionamento/liberação e três rodas solicitadas; duas transições aceitas, terceira interrompida com `selection-or-panel-not-stable-within-4-seconds`. As 45 leituras ficaram preservadas e não houve erro de cleanup.

Na terceira roda, a grade realmente avançou uma linha e o scrollbar desceu de 246 para 249; a sobreposição confirmou o movimento. O detector antigo observava só a faixa superior de cada cartão. Etiquetas amarelas NEW! na quarta linha foram interpretadas como seleções adicionais (27, 30, 33 e 34), junto da seleção real 17. O painel estava estável, com diferença de pixels zero; a alternância entre `[17]` e vários candidatos impediu o estado pronto por quatro segundos. Aumentar o prazo não corrige esse defeito.

O perfil v3 exige amarelo no topo **e na lateral esquerda** do contorno. No replay, ambas as sequências chegaram à seleção correta e estável no terceiro frame pós-roda, preservando as seleções das 90 imagens de itens já lidas. Foram conferidos os hashes de 227/225 frames, imagens por posição e transição e versões do leitor. Revisões separadas em `scan-review.json`, vinculadas aos manifestos originais. Isso comprova a correção sobre a evidência existente; as nove posições seguintes não foram capturadas/lidas ao vivo.

Os brutos também demonstraram nível inicial `Lv. 00/10`: o parser passou a aceitar zero. A identidade literal completa `Drill Rig - Red Axis` com `DrillRigRedAxis` passa a ser aceita com score original 95, sem alterar o texto nem relaxar correspondência para nomes parecidos. Reinterpretar os brutos corrige 11 níveis e esse nome por sessão; três outros nomes continuam incertos. Brutos/manifestos antigos permanecem intactos. Não há atualização de conta nem aprovação humana automática.

As regressões locais passaram com o perfil v3 (123 casos, incluindo os cenários integrados anteriores). Essa conferência foi concluída posteriormente na sessão de 54 posições abaixo. Não repetir o prefixo, NEW!, nível zero ou clique/roda por rotina; seguir ao escopo/fim conforme o [roadmap atual](ROADMAP.md).

## Cadência atual e versão final

Nas duas execuções, a mediana entre pressionamentos foi 2,54 s e 2,41 s. Do pressionamento ao último frame estável registrado: 1,00 s e 0,99 s. Do frame estável ao próximo pressionamento: 1,54 s e 1,41 s. Esses intervalos misturam espera do jogo, processamento, PNG/JSON/HTML e movimento do mouse; não isolam uma medida exata de OCR ao vivo.

O caminho atual é serial: movimento/click público Youkai, confirmação por frames consecutivos por pelo menos 0,25 s, OCR adaptado e releituras quando necessárias, comparação adicional com o leitor original e gravação extensa de evidências. O timeout de quatro segundos é o limite para confirmação, sem ser uma pausa fixa por item.

Um replay offline de quatro imagens na máquina deste chat mediu 1,36–2,41 s por `read_frame`, dos quais 0,58–1,05 s pertenciam à comparação upstream. Esse ensaio inclui OCR/crops e tem carga/condições diferentes da coleta; não é benchmark da versão final nem previsão de ganho. Dados em `20261023-101543-ad9b1eb4-selection/offline-timing/profile.json`.

A versão final deve manter a confirmação de painel correto; há espaço para reduzir comparação duplicada e escrita de diagnóstico no caminho normal e separar melhor captura/processamento. Essas otimizações ainda não foram implementadas/medidas. Não há garantia de velocidade equivalente a outro scanner; a prioridade desta correção é concluir o percurso. A medição/otimização acompanha o produto sem criar outra rodada de ensaios manuais isolados.

## Ler da seleção atual até a última coluna

Modo solicitado por Cristian para uma linha com cartões NEW! e normais intercalados. Não volta ao topo e a roda fica bloqueada. Selecione o W-Engine inicial na linha desejada e execute no PowerShell como Administrador:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "D:\Repo\gacha-ocr-lab\scripts\row-zzz.ps1" -Run
```

Pressione/solte F8 na confirmação inicial; depois mantenha o jogo em primeiro plano até encerrar. O item já selecionado é lido sem novo clique; os seguintes são selecionados para a direita até a nona coluna, na mesma linha visível. Começando na primeira coluna: nove leituras e até oito cliques. Começando no meio: lê somente o restante, incluindo a seleção atual. Não muda a linha nem emite roda. Se a grade se mover por comportamento do jogo, recusa continuar e preserva os frames.

Resultado esperado: `row-read`, `selected-row-end-reached`, `prefixTraversalComplete: true`, `scrollRequests: 0`. `rowStart` registra linha/coluna iniciais; os índices são relativos ao início manual, sem cobertura global. Salva o mesmo JSON/revisão/frames do percurso. Enviar apenas `session.json`. Três cenários integrados do modo passaram localmente: início na primeira coluna, início no meio e quarta linha com NEW! alternados, todos longe do topo. Sintaxe dos lançadores conferida no PowerShell 5.1. Esse ensaio isolado foi pedido explicitamente; a preferência geral por validações integradas permanece.

## Percurso de 54 posições concluído — 23/10/2026

Sessão `20261023-103911-485104ab-selection`, código `906e7b0`: 54/54 posições, três transições verificadas, 54 observações S/A, sem falhas. Permanecem três nomes incertos (posições de índice 13, 24 e 33); nenhum nível ficou incerto. Hashes de todos os frames e das 54 imagens conferidos, com seleção correspondente em cada imagem e versão do código verificada. Revisão separada vinculada ao manifesto original, sem aprovação humana automática ou conferência manual dos campos de todos os itens. Isso aceita o recorte, sem provar fim/contagem S/A global.

## Linha com NEW! e cópias conferida — 23/10/2026

Sessão `20261023-105454-c3458594-selection`, código `1613e83`: `row-read`, `selected-row-end-reached`, 9/9 posições, oito cliques e nenhuma roda. Começou na primeira coluna da primeira linha visível, longe do topo; scrollbar 259,5 permaneceu igual e as nove verificações de viewport confirmaram a mesma grade.

Cartões NEW! nas colunas 4, 7 e 8, intercalados com normais, não foram confundidos com seleção. Housekeeper ×3, Starlight Engine Replica ×3, Drill Rig - Red Axis ×2 e Steam Oven ×1 ficaram em observações separadas. Nome, A, nível 0/10, progressão 1 e travado conferem visualmente nos nove painéis; sem campos incertos ou posições falhas nesta linha.

Hashes de 40 frames, nove imagens de posição e imagens inicial/final conferidos; destaques das nove posições reproduzidos offline, quatro módulos correspondentes ao commit e 260 arquivos upstream íntegros. Revisão separada em `row-review.json`, vinculada ao hash do manifesto original. Revisão do assistente, sem aprovação humana automática. Não demonstra exclusão B, item destravado, cobertura ou fim do inventário.

O diagnóstico da linha está encerrado. O próximo chunk é P3.3-B, escopo e término; não pedir novamente a linha nem o prefixo de 54 para autorizar essa implementação. Ver o [roadmap revisado](ROADMAP.md).
