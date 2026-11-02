# Desktop — plano da interface simples

Plano de implementação solicitado em 01/11/2026. **Ainda não implementado.** Executar depois da melhoria localizada de velocidade e **antes do HSR**, conforme o [ROADMAP](ROADMAP.md). Este documento é um plano técnico; não cria chat, handoff ou novo escopo de scanner.

## Base recebida — 02/11/2026

P3.5 foi conferido por Cristian na sessão `20261102-193652-86205124-selection`, pacote `20261102-184806-173bed9f`: 34 itens, zero falhas/pendências, tempo ativo 34,04 s contra 43,78 s (22,2% menor), cinco campos preservados. [Evidência final](zzz-performance-plan.md#validação-integrada-final--etapa-encerrada). Não repetir essa coleta para iniciar a janela. O executor normal já usa OCR persistente, leitura detalhada após captura e gravação de imagens em segundo plano, com checkpoints por seleção. A UI deve preservar esse caminho e o fechamento do gravador, sem copiar o loop.

## Resultado esperado e limite

Cristian consegue abrir uma janela, confirmar a preparação, iniciar ZZZ, acompanhar o andamento e abrir o resultado sem operar o prompt. O scanner validado continua responsável pelos inputs, OCR, corte 20+, guardas e artefatos. A interface não prepara menus do jogo nem resolve nomes incertos automaticamente.

Começar com **ZZZ funcional**. Mostrar seleção de jogo, com HSR identificado como “em breve” e sem permitir início. Não simular suporte HSR nem esperar implementá-lo para entregar essa janela. Depois, adicionar HSR 20+ na mesma entrada; nível e raridade não viram um painel amplo de configurações agora.

## Tecnologia e reaproveitamento

**Candidato inicial: WinForms hospedado no Windows PowerShell 5.1**, com uma entrada gráfica própria. Motivo: produto só Windows, lançador já em PowerShell, runtime de captura já empacotado e nenhum Node/servidor necessário. A assembly `System.Windows.Forms` foi carregada em PowerShell STA na máquina local durante a consolidação, sem abrir janela; a janela, UAC e pacote gráfico ainda não foram implementados/testados.

Antes de investir na tela, fazer uma prova pequena: janela responsiva, processo filho sem console operacional e recebimento de término/erro. Se esse caminho exigir muito código de coordenação ou não resolver empacotamento/legibilidade, registrar o obstáculo antes de escolher outra tecnologia. Não introduzir Electron, aplicação web local ou framework multijogo por padrão. Não reutilizar inadvertidamente `gacha-ocr-lab.exe`: ele inicia o Genshin legado.

| Componente existente | Como aproveitar |
|---|---|
| `scripts/start-zzz.ps1` | É seguro carregar por dot-source: o bloco de entrada só executa quando chamado como script. Reaproveitar `Get-ZzzInstallation`, `Test-ZzzAdministrator`, `Request-ZzzElevation`, `Get-ZzzResult` e `Open-ZzzResult`; conferir assinaturas atuais antes de usar |
| `scripts/scan-zzz.ps1` e `scripts/probe-youkai.ps1` | São a fronteira de execução já testada. Executar em processo separado, passando flags explícitas e o diretório novo conhecido pela interface |
| `scripts/youkai_selection.py` | Mantém F8, guardas, progresso no console e manifesto. Não criar outro loop de captura dentro da UI |
| `scripts/zzz_inventory.py` | Emite linhas de progresso com posição, elegíveis e pendências. No início, usar essas mensagens como texto; não converter o contador total da lista em percentual dos elegíveis |
| `scripts/build_zzz_portable.py` e `packaging/zzz-worker.spec` | Acrescentar a entrada gráfica ao pacote existente; o executor congelado continua o mesmo. Atualizar README/checks sem substituir pacotes antigos |

Nomes candidatos de arquivos novos: `scripts/start-desktop.ps1` para janela/orquestração e `scan-desktop.cmd` para entrada. São propostas, não contratos existentes. Manter `scan-zzz.cmd` como fallback técnico.

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

O executor atual oferece F8; **não existe ainda um cancelamento cooperativo por arquivo ou API para o botão da UI**. Não documentar esse canal como implementado.

Planejar um sinal pequeno por sessão, por exemplo um arquivo de solicitação dentro da pasta exata, consultado pelo mesmo predicado de parada usado pelo `InputGuard`. O CLI continua funcionando sem esse sinal. A solicitação externa só pode parar; não pode mover/clicar, aprovar dados ou alterar preparação. Usar o caminho explícito da própria execução, sem canal global, arquivo em pasta de outro projeto ou dependência de biblioteca IPC.

O sinal precisa ser avaliado também na espera inicial por F8 e nos cinco segundos de preparação, se o botão da janela estiver disponível nessas fases; hoje esses pontos usam `event.wait(30)` e `time.sleep(5)`. Durante aquisição, aproveitar o predicado existente do `InputGuard`. Depois da aquisição, o comportamento atual é processar os painéis já salvos, sem exigir foco; definir o texto de parada da janela para não prometer encerramento imediato nem descartar essas imagens. Não há esse canal externo pronto.

Verificar no código real os pontos de checagem e o `finally` que libera botão, encerra listeners e salva parcial antes de adotar essa proposta. O botão/fechamento devem pedir parada e aguardar saída com janela responsiva. Não matar o processo como caminho normal: isso pode impedir cleanup e gravação. Erro de foco pode chegar antes da solicitação; ambos precisam terminar sem mais inputs e com motivo visível. Evitar confirmação modal enquanto houver aquisição ativa; exibir estado “interrompendo” sem tomar foco.

## Verificações e aceite

1. **Sem jogo:** usar stubs de processo para pronto, esperando F8, progresso, término, parcial, erro sem manifesto, cancelamento/UAC cancelado e término rápido. Conferir janela responsiva, um filho por vez, cwd diferente, espaços/apóstrofo no caminho e abertura só da própria sessão.
2. **Persistência/stop:** reutilizar testes existentes de gravação e guardas; acrescentar apenas o teste do novo sinal e seu efeito real no encerramento/cleanup. Não criar um framework de processos/UI para testar botões.
3. **Instalação:** conferir pelo pacote em pasta e pela instalação do laboratório, sem dependência nova no PATH. Garantir captura de diagnóstico caso a janela falhe antes de abrir; mensagens de erro precisam continuar acessíveis sem prompt operacional.
4. **Uma coleta integrada acompanhada, se necessária:** Cristian prepara o jogo como já faz, abre a janela, confirma preparação, clica Iniciar, volta ao jogo e usa F8 no aviso. A lista é movimentada pelo scanner; aguardar término sem clicar em item ou janela. Conferir resumo da pasta exibida. Se precisar investigar, pedir somente `session.json`. Não repetir os pilotos, a lista inteira ou guardas por rotina.

Aceite: ZZZ coletado a partir da janela sem operar prompt, instruções claras, UAC/F8/foco preservados, progresso honesto, interrupção com parcial, resultado correto e fallback CLI disponível. HSR aparece indisponível até ter executor real; sua chegada não exige redesenhar a tela.

## Fora deste recorte e continuidade

Não fazer HSR, otimização de captura/OCR ou novo empacotador junto da UI. Receber o resultado de [P3.5](zzz-performance-plan.md), registrar diff/testes/limitações e só então avançar para HSR 20+. Atualizar o ROADMAP com o estado realizado, preservando evidências. Nenhum handoff é criado até pedido explícito de Cristian.
