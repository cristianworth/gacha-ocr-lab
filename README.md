# gacha-ocr-lab

Laboratório de OCR local para inventários de gachas. Disponível: **uma imagem de arma do Genshin ou Cone de Luz do HSR → OCR por regiões → campos interpretados → revisão visual → JSON**. Windows e interface em inglês; perfis iniciais desenvolvidos com resolução de jogo declarada de 1440×900 (16:10).

**Planejamento atualizado:** um motor Python compartilhado, com perfis e estratégias por jogo. Ordem recomendada: **ZZZ → HSR → Genshin → WuWa → NTE**, começando por W-Engines **S/A**. O piloto ZZZ tem dez posições reais, F8, perda de foco e movimentação da janela conferidos. A primeira transição P3.2 foi conferida no jogo. A etapa atual é P3.3: 54 posições e três transições reais concluídas, além de uma linha com NEW!/normais conferida. Falta fechar escopo S/A, cobertura e fim do inventário. Veja o [planejamento em etapas](docs/ROADMAP.md) e a [arquitetura pesquisada](docs/architecture-proposal.md).

**Software disponível hoje:** Genshin/HSR continuam em JavaScript; o piloto ZZZ usa Python isolado. Há captura/coleta Genshin 4★/5★ e lançador Windows, com **aceite de inventário completo pendente**. O [guia do scanner Genshin](docs/genshin-scanner.md) documenta esse caminho legado; os comandos abaixo ainda pertencem a ele. O motor compartilhado ainda não foi extraído; o piloto Python ZZZ está disponível em comando próprio. A [reprodução isolada P1.1 do Youkai](docs/youkai-qualification.md) executou 273 testes upstream e duas referências públicas, com limitações explícitas; esses testes não validam percurso ou inventário completo. Os repositórios do laboratório e Advisor permanecem separados.

**ZZZ por arquivo (P1.2):** há um [comando offline e diagnóstico em três capturas atuais 1280×720](docs/youkai-personal-images.md). Ele executa o leitor original; as divergências de progressão permanecem explícitas. A captura e a seleção de três posições reais foram exercitadas em P1.3; percurso completo continua pendente.

**Captura ZZZ (P1.3):** o [comando de captura única e prévia da grade](docs/youkai-capture.md) está preparado, sem cliques/teclas/rolagem. A primeira captura cliente real 1280×720 foi executada, inspecionada e relida pelo OCR original; os 36 pontos ficaram dentro dos cartões. A seleção limitada posterior foi conferida; percurso completo continua pendente.

**Seleção ZZZ (P1.3):** o [ensaio limitado de três posições](docs/youkai-selection.md) reutiliza o navegador original, com F8 explícito, guardas e rolagem bloqueada. Os 31 testes de seleção/captura passaram em simulação. Após o bloqueio inicial por integridade, Cristian executou no nível do jogo: três seleções reais conferidas, nomes/níveis corretos, sem rolagem. Lock e estabilização do painel foram adaptados em P2; dez posições e o segundo F8 foram conferidos posteriormente, conforme os registros abaixo.

**Piloto ZZZ (P2):** o [comando de dez posições e leitor adaptado](docs/zzz-pilot.md) já gera JSON e revisão HTML. Nas três referências humanas, nome/nível/raridade/progressão conferem; progressão foi corrigida para 4/2/1. O piloto espera seleção/painel estáveis, preserva cópias e mantém incertezas. O primeiro ensaio real percorreu dez posições, preservando duas cópias. Quatro nomes truncados ficaram incertos e receberam correção offline no perfil v2. O segundo F8 e as paradas por perda de foco e movimentação da janela foram validados em sessões reais; tamanho/DPI diferentes continuam fora dessa prova real. Não há inventário completo aceito.

**Parada e primeira transição:** o piloto oferece [teste F8 com pausa explícita](docs/zzz-pilot.md#teste-explícito-de-parada-f8), para aguardar o segundo sinal após a primeira leitura. P3.2 tem [comando de uma transição](docs/zzz-transition.md), com um clique de seleção, um passo de roda e verificação de deslocamento por sobreposição/scrollbar. O F8 real foi confirmado após a primeira leitura, sem novos cliques e com resultado parcial preservado. Perda de foco e movimentação da janela também foram confirmadas. O primeiro clique na última linha selecionou o cartão sem rolar. A correção em `transition-zzz.ps1 -Run` seleciona a terceira linha e solicita um único passo de roda dentro da grade, com evidências preservadas em falhas. A rolagem corrigida foi confirmada na sessão de 23/10: uma linha, scrollbar descendente e Weeping Gemini A, 60/60, progressão 5, travado. Não repetir esse ensaio por rotina.

**Percurso ZZZ integrado (P3.3):** [scan-zzz.ps1 -Run](docs/zzz-scan.md) reúne 54 posições, seis linhas e três rolagens em uma sessão, com imagens por posição, antes/depois das transições, cópias e campos incertos preservados. Duas execuções reais preservaram 45 posições; o perfil v3 corrige a parada por etiquetas NEW! com replay das capturas, nível zero e identidade literal de nome. O percurso corrigido concluiu 54/54 posições e três transições reais, com três nomes incertos preservados. Uma linha adicional de nove itens com NEW!/normais também foi conferida, sem falhas ou roda. Próxima implementação: escopo S/A e término; não é inventário completo nem pacote independente.

## Instalar e executar

Node.js **22+** e npm; verificado no Windows/Node 24.20.0. Sem API paga ou credenciais para OCR.

```powershell
cd D:\Repo\gacha-ocr-lab
npm.cmd ci --ignore-scripts --cache .cache/npm
# Genshin continua sendo o padrão:
npm.cmd start -- "examples\aqua simulacra.png" --panel 982,125,370,722 --offline
# HSR: imagem com tamanho diferente, incluindo bordas de janela:
npm.cmd start -- "examples\HSR\sw_tricky.png" --game hsr --panel 1048,133,345,670 --offline
# HSR: segunda captura fornecida:
npm.cmd start -- "examples\HSR\firefly.png" --game hsr --panel 1045,133,345,670 --offline
```

As imagens pessoais **não acompanham o clone**. Use seu próprio caminho e painel. No primeiro uso, remova `--offline` para baixar o modelo inglês; depois ele fica em `.cache/models/`. `--offline` impede download e falha se o cache estiver ausente. Imagens não são enviadas a um serviço. `npm.cmd` evita a política do `npm.ps1` no PowerShell.

`--panel left,top,width,height` seleciona o painel inteiro em pixels da **imagem original**. Coordenadas dos exemplos não estão fixas no código e não são universais. O PNG pode incluir bordas e ter tamanho diferente da resolução do jogo; não redimensione a captura para 1440×900 para compensá-las. Para um painel já recortado, use `--layout card` sem `--panel`.

Aceita uma imagem PNG/JPEG até 30 MiB. Use aspas em caminhos com espaços. Rotação EXIF diferente da orientação normal exige exportar um PNG orientado. O jogo pode estar fechado ou minimizado: apenas o arquivo salvo é lido, sem alterar o original.

## Atalho Windows para o scanner

Depois de instalar as dependências, dê dois cliques em **gacha-ocr-lab.exe**, na raiz do projeto, e aceite a solicitação de Administrador do Windows. O menu chama os scripts existentes: **1 captura**, **2 piloto de 10 armas**, **3 coleta completa**, **0 sair**. Não inicia coleta só por abrir. Prepare o jogo conforme o [guia do scanner](docs/genshin-scanner.md); comece pela captura e pelo piloto.

A janela mantém mensagens e caminhos de cada sessão em data/sessions/. O manifesto exige Administrador, e o Node/helper herdam esse nível; cancelar o UAC impede a abertura. A exibição do aviso depende da política UAC do Windows. Isso resolve a diferença de nível esperada, mas não garante aceitação dos cliques nem substitui as proteções de foco/oclusão ou o aceite real do M3.

**Decisão:** lançador de console em C#/.NET Framework, sem dependências novas, chamando diretamente o mesmo src/scan-cli.js dos comandos npm. Continua exigindo Node.js 22+, node_modules e modelos locais para OCR. Não é um pacote independente nem instalador. A CLI permanece disponível sem elevação automática. O executável deve ficar junto ao projeto; para abrir de outro lugar, crie um atalho do Windows.

Os fontes ficam em scripts/launcher/ e a compilação em scripts/build-launcher.ps1. O binário gerado fica fora do Git. Para gerar novamente no Windows:

~~~powershell
npm.cmd run build:launcher
~~~

Compilação, manifesto embutido e verificação de instalação sem inputs foram conferidos. O aviso UAC interativo, cancelamento durante a coleta e o piloto com inputs no jogo ainda dependem do teste local de Cristian.

## Jogos e limites do perfil

| Jogo / opção | Campos | Perfil inicial |
|---|---|---|
| Genshin / `--game genshin` (padrão) | `name`, `level`, `refinement` | Cartão do inventário 16:10, incluindo nome em duas linhas; nível 1–90 e refinamento 1–5. |
| HSR / `--game hsr` | `name`, `level`, `superimposition` | Painel direito do inventário 16:10, títulos em uma linha nas imagens fornecidas; nível 1–80 e sobreposição 1–5. |

São guardas de interpretação, não validação de todos os estados legais dos itens. Limite de nível invisível permanece `null`; refinamento/sobreposição ausente nunca vira 1. Não há catálogo nem correção silenciosa de letras ou dígitos. HSR lê o número no rótulo `Superimposition`, sem derivá-lo do ícone romano.

Jogo desconhecido é rejeitado, sem tentar outro leitor. HSR exige inglês e painel explícito em capturas completas; `--layout text` não é suportado. No Genshin, `auto` escolhe screenshot com painel, card para imagem estreita e text nos demais casos. O modo legado `text` continua disponível para comparação, mas **não é a leitura validada da arma selecionada em uma tela com lista**. Português continua opcional apenas nesse fluxo Genshin anterior, sem validação real nesta entrega.

Outra tela, escala, proporção, recorte ou um título HSR quebrado em duas linhas pode exigir novo perfil. As âncoras (tipo de arma em Genshin; frase completa de restrição de Caminho em HSR) reduzem leituras fora do painel, sem garantir detecção de qualquer recorte errado. A lista de Caminhos não é usada como catálogo universal.

## Conferir e salvar

O terminal mostra texto bruto, valores, estados e evidências. Cada execução salva JSON em `data/results/` e imprime o caminho de `data/reviews/<execução>/review.md`. Esse documento mostra imagem com caixas, recortes originais/tratados e tentativas OCR, incluindo a âncora diagnóstica. Verde = nome; azul = nível; laranja = refinamento/sobreposição.

No modo regional:

- `recognized`: duas leituras válidas de tratamentos fixos concordam, sem conflito válido, e a âncora foi reconhecida. **Não é aprovação humana nem probabilidade calibrada.**
- `uncertain`: há texto, mas falta concordância ou validação; `value: null`, com candidatos preservados.
- `absent`: as tentativas não leram texto; isso não prova que o campo inexiste na imagem.

Compare os três campos com a imagem. Confirme no chat, informe correções ou mantenha pendente se ilegível. A revisão fica separada, vinculada por SHA-256 ao resultado e à imagem; o diagnóstico original permanece intacto. Para registrar manualmente, **somente depois de conferir**:

```powershell
npm.cmd run review -- "data\results\<resultado>.json" --confirm-all --reviewer "Cristian"
# Correção Genshin: informe os três campos:
npm.cmd run review -- "data\results\<resultado>.json" --name "Nome correto" --level 80/90 --refinement 3 --reviewer "Cristian"
# Correção HSR: use sobreposição, nunca refinamento:
npm.cmd run review -- "data\results\<resultado>.json" --name "Nome correto" --level 80/80 --superimposition 1 --reviewer "Cristian"
```

`--confirm-all` recusa campos ausentes/incertos. `--level 70` preserva `max: null`. Não preencher dados ilegíveis com palpite. Nada atualiza snapshots ou o Advisor.

O resultado mantém **schema 2**, discriminado por `game` e `itemType` (`weapon` ou `light-cone`); cada jogo possui seus campos. Arquivos Genshin antigos não são reescritos. Confiança, TSV e tratamentos ficam em `ocr.regions`; caixas de palavras/TSV são da imagem tratada, retângulos das regiões são da imagem original. `ocr.rawText` concatena tentativas sem rótulos inventados e `ocr.confidence` regional é `null`. `requiresManualReview` permanece `true`, inclusive após um feedback separado.

Cada execução cria arquivos novos. Saída 0 = resultado salvo, mesmo incompleto; 1 = falha; 2 = argumentos inválidos.

## Validação executada

```powershell
npm.cmd test
npm.cmd run test:ocr
# Exigem manifestos e imagens pessoais disponíveis nesta instalação:
npm.cmd run evaluate -- --game genshin --split development
npm.cmd run evaluate -- --game hsr --split development
# Só com o perfil/manifesto previamente congelados:
npm.cmd run evaluate -- --game hsr --split evaluation --final
```

**135 testes automatizados passaram**; veja também a [validação M3 e o aceite real pendente](docs/genshin-scanner.md#validação-e-aceite-pendente). Incluem parser, coordenadas, erros de entrada/cache, despacho por jogo, revisão e feedback imutável. Os testes de sucesso do CLI com OCR simulado são identificados como sintéticos; não medem reconhecimento. O smoke test separado usa OCR real em imagens sintéticas de texto (Genshin legado), inglês/português, imagem vazia e PNG corrompido.

OCR real HSR: **2 imagens de desenvolvimento**, três campos corretos em ambas, referências confirmadas por Cristian. Após congelar código e manifesto, **2 reservadas**: nome 2/2, nível 2/2, sobreposição 1/2 e um candidato correto mantido incerto em Phainon; nenhum campo incorreto aceito observado. O caso incerto não orientou ajustes. As quatro capturas mostram 80/80 e somente sobreposições 1/5; outros níveis, ranks, títulos multilinha e campos parcialmente ocultos ainda precisam de capturas reais. Essa amostra pequena não estima precisão geral.

Regressão real Genshin: **13 referências mantiveram estados/valores de M1**, inclusive o nível incerto anterior. A captura completa Aqua Simulacra continua correta: 90/90, R1. Confirmações anteriores e relatórios históricos foram preservados.

A avaliação é ferramenta de teste, não lote de inventário no produto. Manifestos locais em `data/datasets/` guardam referências, grupos, hashes e procedência; relatórios distinguem conferência humana e inspeção pelo assistente. Novos congelamentos vinculam jogo, modo, perfil, manifesto completo, IDs e código do leitor/métricas. Modelos em cache, runtime e instalação efetiva não são congelados; lockfile é. O freeze antigo Genshin permanece histórico e não coincide com o núcleo compartilhado alterado em M2: não o regrave para aparentar avaliação independente. Repetir casos examinados é regressão.

## Estrutura e decisões

- `src/image.js`: leitura/hash; `regions.js`: funções de imagem e perfil Genshin; `hsr-regions.js`: perfil HSR.
- `src/ocr.js`: Tesseract.js, sessão reutilizada nas regiões da mesma imagem; `read-weapon.js`: coordenação por jogo.
- `src/games.js`: metadados e campos; `parse-regions.js` e `parse-hsr.js`: interpretação específica; `parse-weapon.js`: Genshin legado.
- `src/review.js`, `result.js`, `feedback.js`: diagnóstico, gravação e confirmação independente.
- `src/scan-cli.js`, `scan-inventory.js`, `genshin-inventory.js`, `windows-game.js`: captura, percurso e visão de inventário; `scripts/windows-game.ps1`: helper Windows.
- `src/inventory-session.js`, `inventory-review.js`: sessão e relatório HTML local; `scripts/process-inventory.js`/`review-session.js`: reprocessamento e revisão.
- `scripts/`: avaliação, congelamento e revisão; `test/`: verificações sem capturas pessoais.
- [Roadmap](docs/ROADMAP.md): objetivo, decisões e marcos; [Inventory Kamera](docs/inventory-kamera.md): estudo da referência.

JavaScript ESM + **Tesseract.js 7.0.0** mantém OCR local sem Python/API. **Sharp 0.35.5** faz recortes, ampliação e diagnóstico. Genshin preserva seus tratamentos; HSR usa título com limiares 130/140, nível cinza/normalização e limiar 140, sobreposição ampliada/cinza, e âncora com limiar 140. O recorte HSR exclui o sublinhado do título e o ícone romano. Escolhas vieram somente dos dois exemplos de desenvolvimento: escala colorida perdeu dígitos dourados e o sublinhado gerou caractere espúrio. Não houve treinamento de modelo.

Compartilhamos infraestrutura e mantivemos regiões/regras por jogo, com módulos simples, sem framework de plugins, interface gráfica, backend, banco ou MCP. As diferenças reais do HSR justificam essa separação. A automação Genshin M3 é experimental, com helper Windows separado; exportação e integração continuam futuras.

Repositório público: [cristianworth/gacha-ocr-lab](https://github.com/cristianworth/gacha-ocr-lab). Imagens, resultados, modelos e temporários ficam fora do Git: `examples/`, `data/`, `.cache/`, `tmp/`. Não force sua inclusão. Evidências locais de M2 ficam em `data/research/m2/`, `data/evaluation/` e `data/reviews/m2/`.

Fontes técnicas: [Tesseract.js API](https://github.com/naptha/tesseract.js/blob/master/docs/api.md), [Sharp](https://sharp.pixelplumbing.com/api-operation/). As regras deste piloto HSR são sustentadas pelos campos visíveis nas capturas fornecidas, sem herdar coordenadas ou nomes de campos do Genshin.