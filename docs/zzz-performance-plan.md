# ZZZ — plano de melhoria de velocidade

Plano de implementação acordado em 01/11/2026. **Ainda não implementado.** O [ROADMAP](ROADMAP.md) define a ordem: consolidação ZZZ → velocidade → interface simples → HSR 20+ → demais jogos. Este documento detalha o trabalho de velocidade; não é um handoff nem autorização para executar uma nova coleta.

## Resultado esperado

Reduzir o tempo da coleta útil S/A 20+ com uma mudança localizada, sustentada por medições, preservando os cinco campos, as cópias observadas, os nomes incertos e a recuperação parcial. Não há meta de segundos ou percentual demonstrada. Entregar números antes/depois e seus limites; não chamar um ganho offline de ganho real no jogo.

O usuário prepara S+A, Level decrescente, filtro fechado e topo. O scanner coleta até o primeiro nível confiável abaixo de 20. Esse percurso já funciona; não reabrir a implementação do inventário inteiro nem os testes manuais de NEW!, guardas e prefixos.

## Base e evidência disponível

| Referência | O que permite concluir |
|---|---|
| `D:\Repo\gacha-ocr-zzz\.cache\youkai-p1\runs\20261101-230702-880080ba-selection\session.json` | Pacote real: 34 elegíveis, 35 observados, 34 cliques e uma roda; 116,32 s totais, incluindo preparação; 101,48 s entre primeiro/último dos 151 frames |
| `.cache/youkai-p1/analyses/20261101-portable-live-880080ba/review.json` | 186 imagens e 614 arquivos do pacote íntegros; cinco campos com valores/estados iguais à sessão anterior |
| `.cache/youkai-p1/runs/20261101-195855-9469d5d5-selection/session.json` | Mesma lista e resultado pelo caminho do repositório; imagens locais reutilizáveis |
| `.cache/youkai-p1/runs/20261028-185740-399e71f1-selection/session.json` | Diagnóstico de percurso físico 118/118; não precisa ser repetido para medir o caminho útil |
| `20261023-101543-ad9b1eb4-selection/offline-timing/profile.json`, dentro de `runs/` | Medição antiga de quatro imagens: `read_frame` 1,36–2,41 s; comparação upstream 0,58–1,05 s. Hipótese útil, não benchmark da versão atual |

Hashes completos, correções e limites em [evidências ZZZ](zzz-evidence.md). Referências brutas não entram no Git. Não modificar a pasta portátil existente para investigar; toda saída nova fica no laboratório em `.cache/youkai-p1/analyses/<identificador>/`.

## Ler primeiro no código

| Arquivo / função | Responsabilidade e hipótese a conferir |
|---|---|
| `scripts/youkai_selection.py:main`, `capture_and_record`, `record_inventory` | A captura grava PNG/hash/manifesto; `record_inventory` acrescenta a evidência e salva novamente. Medir custo e confirmar onde uma gravação pode ser consolidada sem perder o registro de falha |
| `scripts/youkai_selection.py:save_report` | JSON temporário/substituição atômica e atualização do HTML. Medir separadamente; manter retentativas Windows e último manifesto válido |
| `scripts/zzz_inventory.py:run_inventory` | Seleção, prova de imobilidade, OCR, corte, resumos e salvamentos. Usar os callbacks existentes para observar etapas; não reescrever a máquina de percurso |
| `scripts/zzz_pilot.py:read_frame` | Leitura dos campos, releituras condicionais, gravação de crops e comparação com `scan_single_frame_engine`. A comparação executa OCR adicional; conferir quem consome seus campos antes de torná-la opcional |
| `scripts/zzz_pilot.py:wait_for_panel` | Confirma seleção e painel estável por frames consecutivos. Os quatro segundos são timeout; não são uma pausa fixa por item |
| `scripts/zzz_transition.py:wait_for_viewport` | Estabilização da lista, independente do painel. Não fundir as duas esperas nem tornar item selecionado requisito da lista vazia |
| `scripts/build_zzz_portable.py`, `packaging/zzz-worker.spec` | O pacote contém código congelado. Uma alteração de Python exige novo build para validar o produto distribuído; mudar o arquivo ao lado do exe não atualiza o código congelado |

## Primeiro recorte: medir sem mudar o resultado

1. Usar as imagens salvas das posições humanas 1, 14 e 34: título reconhecido, título incerto e nível diferente. Incluir a posição 25 se necessário para investigar releitura. Registrar hash das imagens, revisão/hash dos módulos e versões efetivamente usadas.
2. Medir com relógio monotônico o tempo de captura, estabilização, OCR principal/releituras, comparação upstream, escrita de imagens e gravação JSON/HTML/resumo. Coletar contagem de chamadas e bytes/arquivos quando isso ajudar a explicar o custo. Definir fronteiras para não somar spans inclusivos duas vezes.
3. Separar inicialização/importação, tempo esperando F8 e preparação, trecho ativo de aquisição e encerramento. Os timestamps existentes misturam etapas; não atribuir seus 116 s à captura de tela.
4. Manter os tempos em relatório técnico separado ou campos adicionais compatíveis. Não introduzir dependência de profiling, banco, serviço ou dashboard. Medir um conjunto pequeno, registrando primeira execução e variação, sem selecionar apenas o melhor tempo.
5. Medir antes/depois na mesma máquina e nas mesmas imagens. Replays offline medem leitura/escrita; não medem latência de renderização do jogo. Para esse trecho, instrumentar o próximo uso integrado necessário, sem começar uma campanha manual.

Entregar o diagnóstico e escolher o maior custo removível antes de ampliar a mudança. Se as hipóteses abaixo não se confirmarem, registrar o descarte e atacar o custo medido.

## Hipóteses e menor alteração correspondente

| Hipótese falseável | Alteração candidata se confirmada | Condição para aceitar |
|---|---|---|
| Comparação diagnóstica upstream consome parcela relevante sem participar da decisão dos cinco campos | Disponibilizar comparação no modo diagnóstico, sem executá-la em toda leitura normal | Preservar o diagnóstico acessível e as chaves compatíveis; distinguir explicitamente “não executado” de erro ou ausência de resultado. Testar consumidores antes de alterar o default |
| PNGs intermediários e renderização repetida do HTML dominam escrita | Consolidar gravações repetidas e gerar HTML nos checkpoints necessários | Manter imagem selecionada, bruto/crops necessários, hashes, motivo de parada e resumo parcial; evidência em memória precisa ser salva mesmo no erro. Não retirar silenciosamente o rastreio usado pelos diagnósticos |
| Releituras repetem trabalho estável dentro do mesmo item | Reutilizar apenas o valor estável já calculado nessa leitura ou evitar uma releitura comprovadamente redundante | Mesmas decisões de reconhecido/incerto, sem reaproveitar painel de outro item nem transformar cópias iguais em um só registro |
| Captura/transformação de imagem é o maior custo | Investigar a API de captura já usada e conversões duplicadas | Medir isoladamente antes de trocar backend; não justificar troca de tecnologia apenas pela duração total |

Não começar com paralelismo de mouse/OCR, pipeline genérico, redução arbitrária de timeout ou remoção da estabilização. Se uma gravação for adiada, definir o que acontece em F8, perda de foco, falha OCR e erro de disco antes de implementá-la.

## Verificações e aceite

- Comparar valores **e estados** de nome, nível, raridade, progressão e lock nas imagens escolhidas. Manter as posições 14/25/34 incertas no OCR enquanto não houver nova evidência; confirmação humana de sessão anterior não corrige o leitor.
- Rodar os testes dos caminhos alterados: `test_zzz_pilot.py` para leitura, `test_zzz_report_save.py` para persistência, `test_zzz_inventory.py`/`test_zzz_inventory_scope.py`/`test_zzz_level_cutoff.py` para percurso e pendências. Usar seleção de casos proporcional; não repetir a suíte inteira por rotina.
- Garantir lista vazia sem painel, barra comprovadamente ausente versus ilegível, parada no nível baixo, nível desconhecido sem exclusão, ordem contraditória e parcial recuperável. Reaproveitar as simulações existentes.
- Se mudar gravação, testar falha no checkpoint que mudou e preservação do último manifesto válido. Não esconder exceção para ganhar tempo.
- Construir novo pacote apenas depois da alteração medida; conferir relocação e uma imagem offline pelo executável. Não substituir ou apagar o ZIP já validado.
- Se uma aquisição real for necessária, agrupar tudo numa única sessão acompanhada: preparação usual, iniciar, voltar ao jogo, pressionar/soltar F8 quando solicitado e aguardar sem mexer. Conferir resultado e tempo; pedir somente `session.json`. Não solicitar lista inteira, ensaio de guardas ou novas fotos por rotina.

Aceite: melhoria localizada com ganho demonstrado no trecho medido, sem regressão dos dados/guardas; diff, comandos e resultado das verificações; riscos e limitações explícitos. Se só houver ganho offline, registrar assim. Não existe velocidade prometida a atingir para liberar a interface.

## Saída para a etapa seguinte

Atualizar este plano/ROADMAP com a mudança realizada, medições e referências locais. A etapa seguinte é a [interface simples](desktop-ui-plan.md), ainda **antes do HSR**. Preservar o executor CLI como caminho técnico e manter as instruções operacionais em português simples. Não criar um handoff até Cristian pedir.
