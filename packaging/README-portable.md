# Gacha OCR Lab — ZZZ portátil

Extraia a pasta inteira em um local com permissão de escrita. Não mova somente o executável nem misture arquivos de pacotes diferentes. Windows x64; não precisa instalar Python, Node.js ou Tesseract. Windows PowerShell 5.1 e Bloco de Notas são usados pelo lançador.

1. No jogo em inglês, use área cliente 1280×720 e escala Windows 100%.
2. Abra W-Engine Storage. Marque S+A, desmarque B/especialidades e ordene por Level do maior para o menor. Feche o filtro, volte ao topo, solte os controles e espere a lista parar. Não precisa clicar em item.
3. Abra `scan-zzz.cmd`, aceite o aviso de Administrador e confirme a preparação com Enter. Digite 0 para cancelar sem coletar.
4. Quando o console pedir, volte ao jogo e pressione/solte F8 uma vez. Mantenha o jogo na frente e não mexa nos controles. F8 interrompe; F9 não é usado.
5. Espere terminar. O resumo da própria execução abre no Bloco de Notas, inclusive se a coleta parar antes do fim.

O corte é fixo: S/A nível 20+. A primeira leitura confiável abaixo de 20 encerra o percurso com Level decrescente declarado. Nível ilegível permanece pendente. Nomes incertos não são substituídos por palpites. Não há verificação automática do seletor de ordenação.

Resultados ficam nesta pasta em `.cache/youkai-p1/runs/<sessão>/`: `summary.md`, `review.html` e `session.json`. O caminho também aparece no console. O pacote não inclui resultados pessoais. Preserve a pasta de resultados antes de trocar de versão.

Nada é enviado ou aplicado ao Advisor. Ausência nesta coleta parcial não apaga dados anteriores. O término do escopo não significa leitura do inventário inteiro nem aprovação humana.

Para conferir somente arquivos: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-zzz.ps1 -Check`. Para conferir também os módulos/OCR sem capturar ou controlar o jogo: `runtime\zzz-worker\zzz-worker.exe --self-check .cache\youkai-p1`.

Pacote local de desenvolvimento, ainda sem nova coleta pelo executável empacotado ou verificação em outro computador. Não altere `portable-build.json`: identifica o runtime portátil e registra a origem/hashes do build. Dependências e avisos em `THIRD-PARTY/` e no diretório do Tesseract; a fonte Youkai fixada acompanha o pacote para conferência.
