# Desktop — plano da interface simples

Plano de implementação solicitado em 01/11/2026. **Protótipo aprovado; integração ZZZ conferida no fluxo local em 02/11.** Cristian confirmou UAC, término e abertura do resultado; 34 elegíveis preservados. Parada/X cobertos por simulações, sem acionamento nessa coleta. Executado depois da melhoria localizada de velocidade e **antes do HSR**, conforme o [ROADMAP](ROADMAP.md). Este documento não cria chat, handoff ou novo escopo de scanner.

## Base recebida — 02/11/2026

P3.5 foi conferido por Cristian na sessão `20261102-193652-86205124-selection`, pacote `20261102-184806-173bed9f`: 34 itens, zero falhas/pendências, tempo ativo 34,04 s contra 43,78 s (22,2% menor), cinco campos preservados. [Evidência final](zzz-performance-plan.md#validação-integrada-final--etapa-encerrada). Não repetir essa coleta para iniciar a janela. O executor normal já usa OCR persistente, leitura detalhada após captura e gravação de imagens em segundo plano, com checkpoints por seleção. A UI deve preservar esse caminho e o fechamento do gravador, sem copiar o loop.

## Resultado esperado e limite

Cristian consegue abrir uma janela, confirmar a preparação, iniciar ZZZ, acompanhar o andamento e abrir o resultado sem operar o prompt. O scanner validado continua responsável pelos inputs, OCR, corte 20+, guardas e artefatos. A interface não prepara menus do jogo nem resolve nomes incertos automaticamente.

Começar com **ZZZ funcional**. Mostrar seleção de jogo, com HSR identificado como “em breve” e sem permitir início. Não simular suporte HSR nem esperar implementá-lo para entregar essa janela. Depois, adicionar HSR 20+ na mesma entrada; nível e raridade não viram um painel amplo de configurações agora.

## Primeiro recorte — simulação aprovada, 02/11/2026

Cristian aprovou a prova pequena após o diagnóstico da passagem v2 e trouxe a aprovação do main: 12 testes reproduzidos em 28,50 s. `scripts/start-desktop.ps1 -Simulation` conserva o filho de teste, sem imports do scanner, OCR ou inputs. A entrada gráfica real foi acrescentada na integração abaixo; a simulação continua explícita e separada.

```powershell
powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File .\scripts\start-desktop.ps1 -Simulation
```

Use **Iniciar simulação**, **Testar resposta** durante o progresso e **Interromper**, ou feche a janela durante a execução. Não precisa abrir o jogo nem pressionar F8. O fechamento solicita parada e aguarda o filho, mantendo o loop da janela ativo. `-Outcome Partial`, `-Outcome Error` e `-Outcome Quick` exercitam outros términos; `-StepMilliseconds 1500` torna as fases mais fáceis de acompanhar.

Cada tentativa recebe pasta exclusiva em `.cache/desktop-simulation/runs/`, distinta das sessões ZZZ. Um timer acompanha o processo e lê no máximo 64 KiB de log por tick, mantendo posição em bytes, estado do decodificador UTF-16 LE/BOM e linha incompleta. O arquivo pode ainda não existir. A solicitação `stop.request` pertence somente à tentativa; não mata o filho nem é um canal já integrado ao scanner. Não há leitura de `session.json`. Código de saída, recibo e resultado simulado precisam concordar; parcial com saída zero continua parcial.

**Verificação atual:** 12 testes em `test/test_desktop_launcher.py`, 33,77 s, com Windows PowerShell 5.1. Incluem `Application.Run`, formulário exibido, timer da janela e filho real separado: respostas de botão enquanto o filho vive e emite progresso, segundo início bloqueado, término rápido, parcial, erro antes/depois do log, parada antes do log/durante captura, fechamento adiado, sinal isolado entre execuções e parada tardia. O teste incremental também divide um caractere acentuado e uma linha entre leituras. Instalação de teste usa caminho com espaços/apóstrofo e cwd diferente.

```powershell
.\.cache\youkai-p1\.venv\Scripts\python.exe -m pytest -p no:cacheprovider test/test_desktop_launcher.py -q --basetemp=.cache/desktop-review
```

Evidência local opcional em `.cache/desktop-review/`: cada caso guarda `observations.json`. No caso completo, `Shown=true`, `Progress=true`, 28 respostas com o filho ativo, uma única execução e término confirmado. `window-running.png` é renderização do próprio formulário durante o loop, **não uma captura do desktop**. A ferramenta de inspeção Windows não listou a janela hospedada no PowerShell, portanto não houve conferência por clique externo. Isso limita a validação visual; não substitui a prova do loop real nem demonstra UX integrada ao jogo.

**Marco 2 aprovado:** Cristian autorizou integração ZZZ, UAC e pacote. O primeiro recorte não foi uma coleta e não validou o scanner conectado à janela.

## Integração ZZZ — conferida no fluxo local

`gacha-ocr-zzz.exe` é uma entrada pequena que chama o `scan-desktop.cmd` adjacente. O CMD abre Windows PowerShell 5.1/STA sem console operacional; a janela reutiliza instalação/elevação/resultado de `start-zzz.ps1`. O `.exe` precisa permanecer junto do CMD, scripts e runtime; não contém outro scanner. A montagem usa o compilador .NET Framework já presente no Windows, com `scripts/build-desktop-launcher.ps1`; preserva um executável de destino já existente. Não substitui o lançador Genshin legado.

Na janela real, ZZZ está disponível e HSR “em breve” bloqueia início. A confirmação de preparação habilita **Iniciar coleta**. A orquestração executa `run-desktop-zzz.ps1` em processo separado; esse adaptador chama `scan-zzz.ps1 -Inventory -SAFilterPrepared -LevelDescendingPrepared -Run -RunDirectory <pasta>`. O probe cria a pasta nova diretamente em `runs/`; a UI não a pré-cria. Log incremental e ciclo de processo são compartilhados com a simulação. Nenhum manifesto é lido até o processo inteiro encerrar. **Abrir resultado** e **Abrir pasta** ficam disponíveis depois, vinculados àquela tentativa, inclusive parcial.

A entrada pede uma única elevação da janela se necessário. Cancelar o UAC não inicia coleta; erro ao elevar não entra em ciclo. A opção `-Check` confere arquivos, incluindo os da entrada desktop, sem elevação ou inputs. Não considere os stubs de UAC como confirmação do aviso real no desktop.

**Interromper/X:** a janela solicita `stop.request` somente na pasta da execução. Se o probe ainda não criou a pasta, o timer entrega a solicitação assim que ela existir; o fechamento aguarda a saída. O scanner verifica o sinal antes dos inputs, na espera F8, nos cinco segundos e no predicado de `InputGuard`. O motivo observado fica no bruto em `externalStop`, separado da mera solicitação. Durante processamento dos painéis salvos não se descartam imagens nem se exige foco; a janela informa que está aguardando esse trabalho. Perda de foco pode ser observada antes do arquivo e continua sendo motivo válido de parcial.

O pacote inclui a entrada gráfica e o mesmo worker recompilado com essa extensão. A simulação é ferramenta do repositório e não é incluída no portátil. Guardas, fila, OCR, corte fixo 20+, incertezas e revisão humana permanecem com o scanner. A única coleta de validação da janela terminou com 34 elegíveis, zero falhas/pendências e cinco campos preservados. Cristian confirmou UAC, término claro e abertura do resumo. [Sessão, revisão e limites](zzz-evidence.md#primeiro-uso-da-interface-zzz--02112026). Não repetir a aquisição por rotina.

**Verificações da integração em 02/11:** 22 casos de janela (lote final em 80,96 s), 24 de parada externa/processamento (`test_zzz_external_stop.py`, `test_zzz_deferred.py`), 43 de guardas/gravação/cleanup (`test_youkai_selection.py`, `test_zzz_report_save.py`, `test_zzz_evidence.py`), 25 dos lançadores/portátil existentes e dois do EXE passaram: 116 casos em lotes focados. A janela real usa stubs do scanner para flags/pasta exatas, resultado após saída, confirmação/HSR, abertura do resultado, UAC cancelado/recursão e fechamento antes da criação da pasta. Falha ao iniciar uma tentativa nova não reabre o sucesso anterior. UAC de desktop e aquisição real não foram simulados como aceites humanos.

Pacote final deste recorte: build `20261102-212533-c72eee8e`, ZIP SHA256 `afb2d198ee774eaab6d459e149811cb787b61536c30658421f6c1f0b4e7317b7`. Conferidos 622 hashes depois de extrair em `.cache/desktop-ready/gacha-ocr-zzz`; entradas, pré-checagem desktop e self-check do worker/OCR passaram a partir de outro cwd com PATH restrito. O worker congelado reconheceu parada antes do início e salvou JSON/resumo/revisão sem captura ou inputs. Recibo opcional em `.cache/desktop-diagnosis/package-validation.json`; pacote/ZIP em `.cache/zzz-portable/<build-id>/`. Build intermediário `20261102-211952-8beaa6ba` foi preservado; o pacote final é o que foi usado na coleta. A versão permanece 0.1.0, sem publicação remota. Binários, imagens e revisões locais não entram no Git.

## Tecnologia e reaproveitamento

**Tecnologia adotada: WinForms hospedado no Windows PowerShell 5.1**, com entrada gráfica própria. Motivo: produto só Windows, lançador já em PowerShell, runtime de captura já empacotado e nenhum Node/servidor necessário. O protótipo da janela, processo filho e responsividade foi implementado, testado e aprovado. A integração real e o pacote foram acrescentados depois; UAC, coleta e resultado foram conferidos por Cristian no desktop local.

A prova pequena de janela responsiva/processo filho foi concluída. Manter a coordenação simples e registrar obstáculos antes de trocar tecnologia. Não introduzir Electron, aplicação web local ou framework multijogo por padrão. Não reutilizar inadvertidamente `gacha-ocr-lab.exe`: ele inicia o Genshin legado.

| Componente existente | Como aproveitar |
|---|---|
| `scripts/start-zzz.ps1` | É seguro carregar por dot-source: o bloco de entrada só executa quando chamado como script. Reaproveitar `Get-ZzzInstallation`, `Test-ZzzAdministrator`, `Request-ZzzElevation`, `Get-ZzzResult` e `Open-ZzzResult`; conferir assinaturas atuais antes de usar |
| `scripts/scan-zzz.ps1` e `scripts/probe-youkai.ps1` | São a fronteira de execução já testada. Executar em processo separado, passando flags explícitas e o diretório novo conhecido pela interface |
| `scripts/youkai_selection.py` | Mantém F8, guardas, progresso no console e manifesto. Não criar outro loop de captura dentro da UI |
| `scripts/zzz_inventory.py` | Emite linhas de progresso com posição, elegíveis e pendências. No início, usar essas mensagens como texto; não converter o contador total da lista em percentual dos elegíveis |
| `scripts/build_zzz_portable.py` e `packaging/zzz-worker.spec` | Acrescentar a entrada gráfica ao pacote existente; o executor congelado continua o mesmo. Atualizar README/checks sem substituir pacotes antigos |

Entradas implementadas: `scripts/start-desktop.ps1` para janela/orquestração, `scan-desktop.cmd` e `gacha-ocr-zzz.exe` para abertura. Manter `scan-zzz.cmd` como fallback técnico.

## Uma janela, sem navegação ampla

- **Jogo:** seletor com ZZZ disponível e HSR indisponível até P4. Não criar submenus para jogos sem executor.
- **Preparação:** instruções curtas e confirmação explícita de S+A, Level decrescente, filtro fechado/topo e controles soltos. Manter o corte 20 fixo e a exigência de idioma/resolução/escala do guia atual.
- **Iniciar coleta:** habilitado somente sem outra coleta ativa e depois de confirmar preparação. A confirmação da tela substitui Enter no prompt; não presume filtros/ordenação automaticamente.
- **Estado:** pronta, aguardando F8, capturando, processando imagens, finalizada, parcial/erro. O primeiro recorte de velocidade já separa aquisição/processamento; usar as mensagens dessas fases sem ler o manifesto ativo. Mostrar último progresso conhecido; sem percentual inventado, promessa de tempo restante ou termos técnicos desnecessários.
- **Interromper:** disponível na janela e orientação permanente “F8 interrompe no jogo”. O botão deve usar uma solicitação cooperativa; ver detalhe de cancelamento abaixo.
- **Resultado:** abrir resumo e pasta da execução corrente. Se ainda não houver arquivos, informar isso. Manter os diagnósticos acessíveis sem expor implementação no fluxo normal.

Não implementar edição dos equipamentos, revisão visual complexa, sincronização Advisor, histórico/banco ou identidade de cópias. O resumo e `review.html` atuais atendem à revisão inicial.

## Fluxo entre interface e executor

1. Resolver todos os caminhos pela instalação da entrada, nunca pelo cwd. Conferir instalação antes de iniciar. Preservar distinção entre repositório/venv e pacote/worker; runtime portátil incompleto falha sem fallback silencioso.
2. Tratar o aviso de Administrador com uma única elevação explícita da entrada gráfica, mantendo a origem e os argumentos bem citados. Se Cristian cancelar, voltar a estado claro sem criar coleta. Não aceitar o aviso automaticamente nem chamar uma ferramenta elevada de PowerShell Administrador no desktop.
3. Ao clicar Iniciar, reservar nome exclusivo sob o `runs/` desta instalação e bloquear segundo início/troca de jogo. Não procurar “a pasta mais recente”. A restrição existente de `RunDirectory` continua: filho direto novo, sem sobrescrever sessão.
4. Iniciar o processo do scanner com `-Inventory -SAFilterPrepared -LevelDescendingPrepared -Run -RunDirectory <pasta>` após a declaração humana. Não chamar `Read-ZzzPreparation` ou o lançador interativo inteiro no filho: eles pedem Enter e pausam ao sair. Reaproveitar suas funções de resultado e a fronteira CLI em vez de duplicar a política.
5. Mostrar “Volte ao jogo e pressione/solte F8 quando solicitado”. O scanner mantém a espera inicial e os cinco segundos para foco. A interface não deve tomar foco, se manter por cima do jogo, mostrar modal ou notificação no meio da captura.
6. Acompanhar `console.log` incrementalmente com posição de leitura, sem varrer o arquivo inteiro a cada tick. Conferir a codificação gerada por `Tee-Object` no PowerShell 5.1 em vez de presumir UTF-8. Usar timer/eventos no loop da janela para atualizar controles e observar saída do processo; não bloquear com `WaitForExit` no thread da UI nem fazer loop `DoEvents`. Se redirecionar stdout/stderr, drená-los sem bloquear o filho.
7. Nunca consultar `session.json` enquanto o scanner estiver escrevendo. Após o processo encerrar, conferir `exit-code.txt` quando existir e usar `Get-ZzzResult` no diretório exato. Código zero isolado não significa escopo completo; falha de leitura não pode virar sucesso. Abrir resumo mesmo parcial quando disponível, com fallback para relatório/pasta.
8. Restaurar controles ao finalizar e preservar log/resultado. Trocar jogo só depois do fim. Não fazer leitura de scanner ou importação OCR no thread da janela.

O foco no jogo continua obrigatório durante aquisição automática. Clicar na janela pode provocar a parada de segurança por perda de foco; tratar isso como parcial claro, sem afrouxar a proteção para manter a coleta rodando. F8 é a forma prática de parar sem tirar o foco.

## Cancelamento e fechamento: pequena extensão necessária

O executor oferece F8 e observa `stop.request` na própria pasta da execução. A extensão está coberta por simulações do CLI, incluindo cleanup/parcial e worker congelado antes do início. A coleta real pela janela chegou normalmente ao corte; o botão de parada e o X não foram acionados nela. Não apresentar as simulações como uma interrupção real no jogo.

O sinal pequeno por sessão é consultado pelo predicado de parada usado pelo `InputGuard`. O CLI continua funcionando sem esse sinal. A solicitação externa só pode parar; não pode mover/clicar, aprovar dados ou alterar preparação. Usa o caminho explícito da própria execução, sem canal global, arquivo em pasta de outro projeto ou dependência de biblioteca IPC.

`wait_for_f8` mantém o limite de 30 segundos consultando o sinal/listener em intervalos de até 50 ms. `wait_for_preparation` preserva os cinco segundos em passos de 50 ms com F8/sinal. A aquisição usa o predicado do guard. Depois da aquisição, processa os painéis já salvos sem exigir foco; o texto da janela informa essa espera, sem prometer encerramento imediato.

Verificar no código real os pontos de checagem e o `finally` que libera botão, encerra listeners e salva parcial antes de adotar essa proposta. O botão/fechamento devem pedir parada e aguardar saída com janela responsiva. Não matar o processo como caminho normal: isso pode impedir cleanup e gravação. Erro de foco pode chegar antes da solicitação; ambos precisam terminar sem mais inputs e com motivo visível. Evitar confirmação modal enquanto houver aquisição ativa; exibir estado “interrompendo” sem tomar foco.

## Verificações e aceite

O leitor incremental preserva BOM UTF-16 LE, linhas/caracteres incompletos e offset. Violações temporárias de compartilhamento do log adiam a leitura para o próximo timer por até cinco segundos, inclusive na drenagem final; não provocam parada imediata nem bloqueiam o formulário. Outros erros continuam visíveis. Correção e testes com arquivo realmente exclusivo, formulário e filho separados registrados em [evidências HSR](hsr-evidence.md#compartilhamento-do-log-e-segunda-translação--04112026).

1. **Sem jogo:** usar stubs de processo para pronto, esperando F8, progresso, término, parcial, erro sem manifesto, cancelamento/UAC cancelado e término rápido. Conferir janela responsiva, um filho por vez, cwd diferente, espaços/apóstrofo no caminho e abertura só da própria sessão.
2. **Persistência/stop:** reutilizar testes existentes de gravação e guardas; acrescentar apenas o teste do novo sinal e seu efeito real no encerramento/cleanup. Não criar um framework de processos/UI para testar botões.
3. **Instalação:** conferir pelo pacote em pasta e pela instalação do laboratório, sem dependência nova no PATH. Garantir captura de diagnóstico caso a janela falhe antes de abrir; mensagens de erro precisam continuar acessíveis sem prompt operacional.
4. **Uma coleta integrada acompanhada, se necessária:** Cristian prepara o jogo como já faz, abre a janela, confirma preparação, clica Iniciar, volta ao jogo e usa F8 no aviso. A lista é movimentada pelo scanner; aguardar término sem clicar em item ou janela. Conferir resumo da pasta exibida. Se precisar investigar, pedir somente `session.json`. Não repetir os pilotos, a lista inteira ou guardas por rotina.

Aceite: ZZZ coletado a partir da janela sem operar prompt, instruções claras, UAC/F8/foco preservados, progresso honesto, interrupção com parcial, resultado correto e fallback CLI disponível. HSR aparece indisponível até ter executor real; sua chegada não exige redesenhar a tela.

## Fora deste recorte e continuidade

Não fazer HSR, otimização de captura/OCR ou novo empacotador junto da UI. Receber o resultado de [P3.5](zzz-performance-plan.md), registrar diff/testes/limitações e só então avançar para HSR 20+. Atualizar o ROADMAP com o estado realizado, preservando evidências. Nenhum handoff é criado até pedido explícito de Cristian.
