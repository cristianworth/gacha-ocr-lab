# Coordenação e revisão dos pilotos OCR

Aprendizados das rodadas Genshin/WuWa/NTE de 22–23/11/2026, aplicando a skill local `$github-flow`. Este guia explica decisões e evidências do laboratório; as instruções atuais de Cristian e [AGENTS.md](../AGENTS.md) continuam definindo escopo e permissões. Estado e próxima tarefa ficam no [roadmap](ROADMAP.md), não nesta retrospectiva.

## Distribuir por fronteira real

Três workers foram úteis enquanto cada jogo tinha código, dados e guia próprios. Genshin continuou a saída revisável; WuWa/NTE começaram pelos exemplos offline. Depois, a entrada assistida passou a compartilhar ciclo de vida, log e seleção de processo: um único worker evitou dois lançadores divergentes. Não manter três agentes ativos apenas porque existem três jogos.

Cada tarefa precisa de dado útil, filtro, ordem, parada, saída e prova de conclusão. Nos pilotos atuais, a ordem é a dos alvos declarados, não a ordem global do inventário; não há filtro, corte ou scroll e a sessão permanece parcial. Nome igual, imagem igual e score não identificam uma cópia. Esses limites devem aparecer no spec e no resultado.

Definir quem pode editar cada arquivo evita conflitos: módulos por jogo podem avançar em paralelo; README/roadmap e módulos compartilhados têm um responsável por rodada. Reaproveitar contratos públicos antes de extrair abstrações. Só criar um novo recorte quando houver trabalho concreto: uma sessão viva pendente não justifica implementar logo uma travessia ampla.

## Rodar Orca com supervisão verificável

Ler a skill de orquestração e o guia da versão do CLI em uso antes de operar; não copiar flags antigas sem conferência. Guardar Run, Task, Dispatch, workspace, branch e resultado. Após iniciar tarefas independentes, encerrar o turno e receber os eventos do Orca; não executar polling que consuma a caixa do coordenador.

Um `worker_done` é um relato a revisar. A primeira tentativa da entrada #26 preparou apenas ambiente e investigação: foi corretamente registrada como falha, não como entrega. A retomada usou a mesma Task e workspace, com decisões concretas sobre a fronteira bloqueada. Uma falha de início, tentativa incompleta e defeito descoberto após entrega são eventos diferentes; usar o fluxo de recuperação aplicável, preservando o histórico e sem duplicar issues.

No caso da #26, "tratar log e cancelamento" era amplo demais para destravar o worker. Definir log próprio, marcador da sessão, parada pendente e espera pelo fechamento tornou o recorte implementável. Uma pergunta do worker que pode ser respondida pelo código ou por autorização já existente é trabalho do coordenador, não motivo para devolver a decisão a Cristian.

## Qualificar o observável sem inventar certeza

O WuWa começou com um bloqueio por falta de exemplo de seleção na quarta linha cortada. A captura solicitada foi específica: selecionar manualmente um cartão parcial e enviar a janela inteira; não executar OCR. `Novaburst.png` forneceu esse caso. O agente mediu a imagem, preservou hash e explicou o resultado.

O pedido inicial passou a exigir prova de ausência de qualquer contorno arbitrariamente fraco. Esse requisito não era demonstrável com capturas finitas e manteve a guarda bloqueada até nos exemplos positivos. A correção foi delimitar uma confirmação geométrica experimental, baseada no sinal visível: candidato completo forte no alvo, todos os slots inspecionados e rejeição de concorrência observável. O [PR #24](https://github.com/cristianworth/gacha-ocr-lab/pull/24) acrescentou contraste relativo para sinais enfraquecidos, sem usar nome/painel como identidade e sem promover confirmação geométrica a fato interno do jogo.

Os três exemplos completos confirmam apenas seus alvos; Novaburst rejeita todos os alvos completos. A margem parcial negativa 0,221 contra limiar 0,25 é uma limitação do perfil, não uma taxa de acerto. Não recalibrar novamente sem falha concreta. Replays desenvolvem o perfil; o próximo teste vivo precisa verificar o render atual. Um alvo já selecionado confere leitura/render; dois alvos distintos permitem observar também a troca na mesma sessão.

## Revisar o fluxo inteiro, inclusive a falha

Não aceitar apenas contagem de testes ou resumo do worker. Conferir diff, SHA, artefatos, hashes, cenários negativos e o que cada teste realmente demonstra. Em NTE, a revisão levou à checagem de Arc antes do primeiro clique e ao ancoramento das saídas no repositório. Em WuWa, cancelamento durante persistência levou a salvar `click-in-progress` antes da guarda final imediatamente anterior ao input, sem gravação aguardada entre ambos.

Na entrada assistida, o log não pode pré-criar a pasta exclusiva do WuWa. O lançador usa uma pasta própria e recebe `PILOT_SESSION_DIR=` do filho daquela chamada. Deve rejeitar pasta antiga, externa ou marcador conflitante, nunca procurar "a mais recente". Só ler o manifesto depois do fechamento do filho, preservando a substituição atômica no Windows.

A entrega inicial do [PR #27](https://github.com/cristianworth/gacha-ocr-lab/pull/27) tinha 33 testes passando, mas a revisão reproduziu um erro de escrita no log que gerava rejeição não tratada e encerrava o pai fora do fluxo de parada. A correção captura o erro imediatamente, mantém diagnóstico no console, solicita parada cooperativa, espera o filho fechar e retorna erro mesmo diante de `pilot-limit`. Duas regressões passaram com falhas antes/depois do marcador, filho aguardando `stop.request` e sentinela de término. O handler testado não comprova o gesto físico Ctrl+C.

Também houve uma correção no relato do coordenador: a reprodução inicial não comprovou que um filho ficou órfão. A revisão foi corrigida para afirmar apenas o observado — rejeição não tratada e ausência de término gracioso comprovado. Distinguir risco inferido de efeito observado vale para o coordenador tanto quanto para os workers.

## Integrar pelo diff aprovado

Usar branch curta a partir da referência remota atualizada, preservando alterações e caches de outros workspaces. O fluxo adotado é commit/push coeso, PR rascunho, revisão técnica, aceite de Cristian do diff atual e integração por squash com comparação do HEAD aprovado. Novo commit após aceite pede nova revisão; aprovação de um PR anterior não se transfere ao próximo. Push direto em main continua dependendo de autorização explícita.

Separar os gates: validação local, CI do SHA, aprovação humana, merge, pacote/deploy e teste no jogo. Nesta rodada não havia workflows de CI nem deploy aplicável; isso foi registrado como ausência, não como "CI verde". Nenhum `.exe` ou pacote existente foi atualizado por integrar os scripts. Não havia changelog; versão 0.1.0 foi preservada. Se uma política de versão aparecer, relê-la antes do próximo commit/merge.

Manter implementação e validação viva em issues distintas: #15/#17/#16/#26 encerram os recortes implementados; [#22](https://github.com/cristianworth/gacha-ocr-lab/issues/22) e [#25](https://github.com/cristianworth/gacha-ocr-lab/issues/25) continuam abertas até existir evidência do jogo. Não fechar essas pendências com testes sintéticos.

## Fechar com responsável e evidência mínima

Toda entrega distingue **Minha parte** e **Sua parte agora**, por jogo quando necessário. Aprovar PR, iniciar aplicativo, testar OCR e capturar imagem não são a mesma ação. Se a próxima ação é do agente, Cristian aguarda e o agente continua o trabalho autorizado. Uma intervenção humana deve ter preparação, passos, resultado esperado e arquivo exato a enviar.

Para os pilotos reais, combinar uma sessão por jogo, manter guardas/F8, aguardar o processo encerrar e pedir inicialmente apenas `session.json`; frames só para uma dúvida específica. Acompanhar `console.log` durante aquisição. Não testar dois jogos ao mesmo tempo: foco e controles são compartilhados. Não exigir que Cristian valide novamente uma guarda já encerrada sem dúvida concreta.

Na passagem de chat, deixar o guia versionado como referência e o snapshot em arquivos locais de handoff, respeitando o ignore existente. Registrar os SHAs, o que foi executado agora e o que é evidência histórica. Não transportar autorização de input, merge ou mensagens diretas por inferência; preparar o pacote manual de validação para o main quando necessário.
