# Gacha OCR Lab — ZZZ e HSR portátil

Extraia a pasta inteira em um local com permissão de escrita. Não mova somente o executável nem misture arquivos de pacotes diferentes. Windows x64; não precisa instalar Python, Node.js ou Tesseract. Windows PowerShell 5.1 e Bloco de Notas são usados pelo lançador.

1. No jogo em inglês, use área cliente 1280×720 e escala Windows 100%.
2. Abra W-Engine Storage. Marque S+A, desmarque B/especialidades e ordene por Level do maior para o menor. Feche o filtro, volte ao topo, solte os controles e espere a lista parar. Não precisa clicar em item.
3. Abra `gacha-ocr-zzz.exe` (ou `scan-desktop.cmd`), aceite o aviso de Administrador, selecione ZZZ e confirme a preparação na janela. Clique em Iniciar coleta.
4. Quando o andamento pedir F8, volte ao jogo e pressione/solte F8 uma vez. Mantenha o jogo na frente e não mexa nos controles. F8 interrompe os inputs; F9 não é usado. Clicar na janela durante captura pode parar por perda de foco.
5. Quando aparecer “Captura encerrada. Processando imagens salvas”, não haverá novos cliques ou rolagens. Já pode usar o computador enquanto aguarda a leitura das imagens. Se o nível na grade estiver ilegível durante a captura, o programa ainda lê esse painel imediatamente para decidir o corte.
6. Espere terminar o processamento. Clique em Abrir resultado para abrir o resumo da própria execução no Bloco de Notas, inclusive parcial; Abrir pasta mostra os arquivos. Interromper ou fechar a janela solicita parada e aguarda a gravação/leitura das imagens já capturadas.

A interface integrada foi conferida no fluxo local em 02/11/2026: 34 elegíveis preservados; UAC, término e abertura do resumo confirmados por Cristian. Parada/X têm testes simulados e não foram acionados nessa coleta. `scan-zzz.cmd` permanece como fallback técnico, com confirmação por Enter/0 e resumo automático. O `.exe` apenas abre o CMD adjacente; mantenha ambos junto do restante da pasta.

O corte é fixo: S/A nível 20+. A primeira leitura confiável abaixo de 20 encerra o percurso com Level decrescente declarado. Nível ilegível permanece pendente. Nomes incertos não são substituídos por palpites. Não há verificação automática do seletor de ordenação.

O leitor normal mantém o Tesseract incluído carregado durante a sessão. Se a DLL/modelo não inicializar, usa o leitor CLI e registra o motivo em `ocrBackend`. PNGs usam compressão rápida sem perda de pixels, com arquivos um pouco maiores. O pacote mantém os critérios de seleção, estabilidade de 0,25 segundo, foco e término. A coleta normal grava as imagens em segundo plano e agenda novas verificações a cada 60 ms incluindo o trabalho já feito. A estabilidade também é comparada ao início da janela de confirmação para não aceitar uma animação lenta só porque as imagens são mais próximas. Antes de confirmar cada item, espera todas as imagens daquela seleção serem gravadas. Isso gera mais imagens intermediárias e usa mais espaço.

Resultados ficam nesta pasta em `.cache/youkai-p1/runs/<sessão>/`: `summary.md`, `review.html` e `session.json`. O caminho também aparece na janela. O pacote não inclui resultados pessoais. Preserve a pasta de resultados antes de trocar de versão.

## HSR — Cones de Luz 20+ em validação

No HSR em inglês, cliente 1280×720 e escala 100%, abra Inventory → Light Cone, ordene **Lv do maior para o menor**, volte ao topo e **selecione o primeiro Cone**. Filtro 4/5 estrelas é opcional. Na janela escolha **HSR — Cones de Luz 20+ (validação)**, confirme a preparação e inicie. Use F8 quando solicitado e mantenha o jogo na frente, com controles livres.

O scanner usa D na linha. Na última coluna, volta com A pela linha já lida e usa S para começar a próxima pela primeira coluna; confirma cada movimento e lê nome, nível e sobreposição. Inclui nível 20 e para depois de ler o primeiro abaixo de 20, com ordenação preparada e sem níveis pendentes. Não equipará itens nem abrirá menus. O contador/limite de segurança pode encerrar como parcial; não comprova fundo físico. Raridade e trava não são extraídas. Resultados HSR ficam em `.cache/hsr/runs/<sessão>/`. Mantenha HSR na frente até o término; a leitura ocorre durante o percurso.

Três Cones e dois avanços reais foram conferidos; percurso ampliado/corte 20+ e este portátil ainda precisam de validação no jogo. Atualizações do repositório não modificam um pacote já extraído. Para usar outra montagem, feche a janela anterior e abra o `.exe` dentro da nova pasta completa. Não é preciso reconstruir manualmente o `.exe`: ele chama o CMD da própria pasta.

Nada é enviado ou aplicado ao Advisor. Ausência nesta coleta parcial não apaga dados anteriores. O término do escopo não significa leitura do inventário inteiro nem aprovação humana.

Para conferir somente arquivos: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-zzz.ps1 -Check`. Para conferir também os módulos/OCR sem capturar ou controlar o jogo: `runtime\zzz-worker\zzz-worker.exe --self-check .cache\youkai-p1`.

Pacote local de desenvolvimento. O engine persistente e PNG rápido já foram conferidos em coleta real. A combinação de gravação em segundo plano e verificações agendadas também foi conferida no jogo em 02/11: mesmos 34 itens, zero falhas/pendências e 22,2% menos tempo ativo no ambiente local. Isso não garante o mesmo tempo em outras contas ou máquinas. Não foi testado em outro computador. Não altere `portable-build.json`: identifica o runtime portátil e registra a origem/hashes do build. Dependências e avisos em `THIRD-PARTY/` e no diretório do Tesseract; a fonte Youkai fixada acompanha o pacote para conferência.

Diagnóstico técnico: `scripts/scan-zzz.ps1 -Inventory -SAFilterPrepared -LevelDescendingPrepared -Run -SynchronousEvidence` usa gravação/verificações síncronas anteriores com o mesmo OCR nativo. Não é necessário para o uso normal e requer executar o comando como Administrador quando o jogo estiver elevado.
