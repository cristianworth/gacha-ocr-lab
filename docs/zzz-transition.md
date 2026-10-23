# P3.2 — transição ZZZ com um passo de roda

Atualizado em **22/10/2026**. O primeiro ensaio real selecionou o cartão, mas não rolou a grade. A estratégia foi corrigida para uma seleção em linha interna seguida de um passo explícito de roda. **Roda confirmada no jogo em 23/10/2026. Próxima validação: percurso integrado P3.3, sem repetir o ensaio isolado.** F8, perda de foco e movimentação da janela foram conferidos em P2. Este recorte não implementa inventário completo, contagem S/A ou executável independente.

## Diagnóstico do primeiro ensaio real

Sessão `.cache/youkai-p1/runs/20261022-122109-7df244d1-selection/`, código `98cfedb`: um par de pressionamento/liberação na primeira célula da quarta linha; zero leituras aceitas e nenhum erro de cleanup. O cartão ficou selecionado na posição visual 27 (r3c0). O código esperava posição 18 (r2c0) e encerrou com `selection-or-panel-not-stable-within-4-seconds`.

A inspeção visual e a comparação das miniaturas mostram a mesma grade; scrollbar antes/depois em 238,5. A melhor correspondência foi deslocamento zero, erro mediano 8,45 e fração compatível 97,2%. A descrição da estratégia original Youkai dizia que o clique na borda avançava uma linha; essa suposição não se confirmou neste ambiente 1280×720. Não foi demonstrada falha de foco, entrega do clique ou tempo insuficiente de OCR.

Foram conferidos os hashes dos 23 frames, da imagem anterior, dos módulos locais contra `98cfedb` e de 260 arquivos upstream contra o ZIP fixado. A revisão separada `transition-review.json` está vinculada ao manifesto SHA-256 `842b373c07e6760cbef169dd565c470281487f1ce7b5b6c911f6be684ba5104d`, preservado.

Reprocessamento separado do último frame: seleção 27/painel estáveis quando a expectativa corresponde à célula real; Bloodmarrow Coffer, A, 60/60, progressão 1 e travado. Esses campos conferem visualmente pelo assistente. Saída em `offline-reading-actual-selected-cell/` e na revisão separada. Não é nova coleta ao vivo nem aprovação humana do inventário.

## Comportamento corrigido e limites

[scripts/transition-zzz.ps1](../scripts/transition-zzz.ps1) reutiliza o ambiente, preflight, F8 inicial, captura/calibração, guardas, leitor v2 e revisão existentes. [zzz_transition.py](../scripts/zzz_transition.py) usa:

1. Captura inicial estável, topo candidato do scrollbar, quatro linhas preenchidas e cabeçalho global acima de 36. O cabeçalho continua sendo candidato de total global, sem contagem S/A confirmada.
2. Um clique na primeira célula da **terceira linha**, usando `natural_click` público do Youkai. Aguarda a seleção/painel dessa célula estabilizarem.
3. Move o ponteiro para o interior da grade (quinta coluna da segunda linha) e solicita uma única roda vertical descendente: `scroll(0, -1)` pela API pública do controlador, com guarda própria.
4. Espera que o cartão selecionado apareça na **segunda linha**, compara as três linhas sobrepostas e exige movimento descendente do scrollbar de pelo menos 1,5 unidades de referência. Só lê se houver prova positiva de exatamente uma linha.

A guarda autoriza somente essa direção, magnitude e posição, com orçamentos separados de **um clique e uma solicitação de roda**. Nova roda, direção/magnitude diferente ou posição fora do alvo são recusadas. Os pilotos normais continuam com roda bloqueada. F8, foco, geometria e prazo são conferidos antes de ações; cleanup só libera botões já pressionados pelo scanner. `scrollRequests` e eventos mostram solicitações, sem presumir entrega ao jogo.

Se um passo não mover a grade, mover uma fração ou mais de uma linha, ou deixar seleção/painel sem estabilidade, o comando encerra sem retentativa e sem aceitar a leitura. Nos timeouts de seleção após a roda, também salva a última imagem, comparação e scrollbar: o próximo diagnóstico não depende só da mensagem de timeout. Perdas de foco/paradas preservam os frames já salvos e não fazem captura adicional para completar evidências.

Um passo avançou uma linha na sessão de 23/10. Repetição e fronteiras serão exercitadas juntas no percurso integrado. Uma recusa não prova fim do inventário. Miniaturas medem movimento, sem identificar itens/deduplicar cópias. Índice absoluto, cobertura e fim permanecem não confirmados. Fonte Youkai não foi modificada e não são chamados métodos privados do navegador.

## Roteiro histórico da correção — já conferido

1. Deixar W-Engines **no topo da lista**, inglês, janela 1280×720, escala Windows 100%, quatro linhas preenchidas e itens além delas. A posição da janela pode ser a atual; há nova calibração.
2. No PowerShell **como Administrador**, executar:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "D:\Repo\gacha-ocr-lab\scripts\transition-zzz.ps1" -Run
```

3. Pressionar e soltar F8 apenas na confirmação inicial. Depois dos cinco segundos, o programa pede foco ao jogo.
4. Manter o jogo em primeiro plano e deixar os controles livres. Agora haverá **um clique no primeiro cartão da terceira linha**, depois **um único passo de roda dentro da grade**. Não há beep nem ação manual solicitada.
5. Buscamos confirmar que a grade sobe uma linha e que o cartão selecionado passa para a segunda linha. O scanner lê um item somente se essa transição for comprovada. Se a roda tiver outro efeito, salva as evidências e encerra para análise.
6. Após encerrar, enviar apenas o caminho de `session.json`, inclusive se houver recusa. F8 interrompe qualquer comportamento inesperado; informar isso ao enviar a sessão. Não repetir sem análise.

**Resultado positivo esperado:** `status: transition-read`, `transition.verified: true`, `pressRequests: 1`, `scrollRequests: 1`, uma leitura. Isso não significa inventário completo. Sem `-Run`, o comando continua apenas conferindo metadados/acesso, sem captura ou inputs.

## Verificação local desta correção

**116 testes aprovados:** os 102 anteriores e 14 casos adicionais. Incluem fluxo completo do CLI com Win32/controlador simulados, uma seleção + uma roda + leitura, roda sem movimento com última imagem preservada, foco perdido após roda, proibição de roda fora do alvo/direção/magnitude/orçamento e regressão de F8/geometria/captura/leitor. Nenhum input nativo foi emitido pelos testes.

A verificação local e o replay do clique sem rolagem acima pertencem à entrega de 22/10. A sessão de 23/10 abaixo confirmou a nova roda no jogo. Seguir para o percurso integrado P3.3, com fronteiras e diagnóstico juntos; filtro/contador S/A e término ainda precisam ser concluídos. Em P3.4, duas coletas completas conferidas e pacote Windows.

## Transição real aceita no recorte — 23/10/2026

Sessão `.cache/youkai-p1/runs/20261023-095006-716da4f3-selection/`, leitor de `aff9440`: `transition-read`, uma solicitação de clique, uma de roda, uma leitura, sem erro de cleanup. Seleção visual 18 → 9, scrollbar 238,5 → 241,5, deslocamento de uma linha aceito pela sobreposição (erro mediano 6,70; 85,2% das 27 miniaturas compatíveis).

Weeping Gemini, A, 60/60, progressão 5 e travado conferem visualmente pelo assistente. Nome primário truncado foi recuperado pela releitura ampliada literal; o score original de 96,296 é preservado e não representa probabilidade. A imagem passa a desenvolvimento/regressão, sem avaliação independente nem aprovação humana dos campos.

Foram conferidos 14 hashes de frames, a imagem inicial da transição, a imagem da posição, os hashes dos módulos contra `aff9440` e 260 arquivos upstream contra o ZIP fixado. Revisão separada `transition-review.json`, vinculada ao SHA-256 `f3097b5cb2bdd302248d08c3ef82ed22b2baa0574bd06a72aa6513b32a2ed578` do manifesto preservado. Índice absoluto e cobertura continuam não confirmados.

Não repetir o teste isolado por rotina. O próximo comando é o [percurso integrado](zzz-scan.md), que reúne posições, várias rolagens e diagnóstico em uma sessão.
