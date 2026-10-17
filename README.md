# gacha-ocr-lab

Laboratório pessoal de OCR para jogos gacha, preparado para evoluir conforme os experimentos. **Suporte atual: uma imagem local da página de uma arma do Genshin Impact**, com interface em inglês e resolução de referência **1440×900** → OCR local → conferência → JSON. Outros jogos ainda não foram implementados. Não captura janelas, clica, navega, processa lotes, consulta catálogo ou atualiza contas. É independente do Gacha Advisor.

## Instalação e execução

Requer **Node.js 22+** e npm. No PowerShell:

```powershell
cd D:\Repo\gacha-ocr-lab
npm.cmd ci --ignore-scripts --cache .cache/npm
npm.cmd start -- "examples\aqua simulacra.png"
# Depois de baixar os modelos:
npm.cmd start -- "examples\aqua simulacra.png" --offline
# Opcional: português + inglês:
npm.cmd start -- "C:\caminho\arma.jpg" --lang por+eng
```

As dependências já estão instaladas nesta entrega. `npm.cmd` evita depender da política de execução de `npm.ps1`. Aceita um PNG/JPEG até 30 MiB, com caminho absoluto ou relativo ao diretório atual. Idioma padrão: **`eng`**. `por` e `por+eng` continuam disponíveis como opções explícitas.

O jogo pode estar minimizado, fechado ou em qualquer tela: nesta etapa, o programa lê somente a imagem já salva. Para produzir a captura, abra no jogo o painel de detalhes da arma com os campos visíveis; não precisa ficar na tela inicial do jogo.

O primeiro uso baixa modelos gratuitos em `.cache/models/`; o OCR roda no computador, sem enviar a imagem a um serviço. `--offline` exige modelos locais e impede download. A inicialização tem limite de 120 segundos; se o download falhar, confira a conexão e tente novamente.

O terminal apresenta texto bruto e campos. O resultado vai para **`data/results/<data-UUID>.json`**, relativo ao projeto, sem sobrescrever arquivos. Código de saída: **0** = resultado salvo, mesmo incompleto; **1** = falha de leitura/OCR/gravação; **2** = argumentos inválidos. Uma imagem vazia também produz JSON; OCR que falhou não produz resultado de sucesso.

## Como conferir

1. Para validar sua configuração, use uma captura original **1440×900 em inglês**, mantendo nome, tipo, nível e refinamento visíveis. Recortes manuais também são aceitos. Não há redimensionamento nem corte automático: a resolução é uma referência, sem rejeitar outras dimensões. O terminal mostra o tamanho decodificado, também salvo em `ocr.imageSize` (`width`/`height`; `null` se indisponível).
2. Compare a imagem com `ocr.rawText` antes dos campos. `ocr.tsv` guarda coordenadas e confiança por palavra para diagnóstico.
3. Confira `fields.name`, `fields.level`, `fields.refinement` e `candidates[].evidence`, com texto e linha do OCR (a partir de 1).

Estados: `recognized` = padrão textual explícito sem conflito, **ainda sujeito a erro**; `absent` = nenhuma evidência no texto, não prova ausência na imagem; `uncertain` = candidato incompleto, conflitante ou baseado em posição. Nos dois últimos, `value` é `null`. Nível contém `{ current, max }`, com `max: null` se não foi lido. Não há valores padrão para campos ausentes.

O JSON inclui esquema, data UTC, caminho/formato/tamanho/SHA-256 da imagem, versão/configuração do OCR e `requiresManualReview: true`. A imagem original não é copiada nem modificada. Não há aprovação/importação automática.

## Estrutura

```text
src/cli.js                 Argumentos e coordenação
src/image.js               Leitura, assinatura PNG/JPEG e hash
src/ocr.js                 Tesseract.js, idiomas, cache e worker
src/parse-weapon.js        Interpretação pura do texto
src/result.js              Apresentação e gravação JSON
docs/inventory-kamera.md   Estrutura proposta e estudo do scanner de referência
test/                     Testes com node:test
scripts/test-ocr.ps1        Smoke test Windows com imagens sintéticas
examples/                 Capturas reais fornecidas pelo usuário (ignorado)
data/                     Testes sintéticos e resultados locais (ignorado)
.cache/                   Modelos e cache npm (ignorado)
```

O `.gitignore` exclui imagens, JSON (exceto manifesto/lock), texto bruto, TSV, modelos, temporários e dependências. Guarde capturas reais em `examples/`, resultados/testes sintéticos em `data/` e temporários em `tmp/`. A pasta `examples/` inteira é ignorada, além das exclusões por formato de imagem. Modelos e resultados anteriores foram preservados na renomeação; caminhos em JSON antigos permanecem como registro histórico. O projeto é versionado em Git local; imagens, exports e dados de pesquisa continuam fora do histórico. Nenhum remoto ou publicação foi configurado. Não force a inclusão desses dados.

## Decisões e limitações

- **JavaScript ESM + Tesseract.js 7.0.0**, com lockfile: mantém a preferência por JS, sem Python/Tesseract nativo. Uma dependência direta, sem framework, GUI, servidor ou banco. O nome do projeto é genérico; as regras atuais de armas continuam específicas do Genshin, sem abstração de múltiplos jogos antecipada. Alternativas: pytesseract exigiria Python e Tesseract; API adicionaria serviço/credenciais; OCR do Windows prenderia o código à plataforma. CLI verificado somente no Windows/Node 24.20.0.
- **Uma passada na imagem inteira, `SPARSE_TEXT`**: ponto de partida para texto disperso de uma interface. Sem filtros, escala ou regiões automáticas antes de avaliar captura real. Texto pequeno, efeitos, fundo ilustrado e colunas podem prejudicar a leitura e a ordem das linhas.
- **Regras conservadoras PT/EN**: rótulos de nível (`Lv.`, `Nv.`, `Nív.`, `Nível`, `Level`) e refinamento (`Refinement Rank`, `Rank/Grau de Refinamento`, `Refinamento`). Não corrigimos `O` para `0` ou `S` para `5`. Guardas iniciais: nível 1–90, máximo legível ≥ atual e ≤ 90, refinamento 1–5; não validam todos os estados legais de uma arma.
- **Nome sem catálogo**: rótulos `Weapon Name:` / `Nome da arma:` permitem reconhecimento explícito em testes. Na tela do jogo, a linha anterior a um tipo isolado (`Sword`, `Espada`, etc.) é apenas **candidato incerto**. Não assumimos a primeira linha como nome. Nomes quebrados podem ficar incompletos; a heurística depende de avaliação com captura real.
- **Confiança não garante interpretação**: `ocr.confidence` (0–100) é global; confiança por palavra está no TSV. Nenhuma é probabilidade de acerto do campo. Estados refletem regras textuais, sem limiar calibrado; um erro de OCR pode formar um padrão válido. Revisão humana permanece necessária.
- A assinatura não garante arquivo íntegro: o motor faz a decodificação e reporta falhas. Não há validação contra catálogo, estrelas ou conta.

Referências consultadas em 17/10/2026: [Tesseract.js](https://github.com/naptha/tesseract.js), [API](https://github.com/naptha/tesseract.js/blob/master/docs/api.md), [formatos do motor](https://github.com/naptha/tesseract.js/blob/master/docs/image-format.md). O CLI restringe intencionalmente a PNG/JPEG.

## Validação

```powershell
npm.cmd test
npm.cmd run test:ocr
```

Verificados **13 testes automatizados**: regras, conflitos, campos ausentes/ilegíveis, leitura, gravação sem sobrescrita, revisão e CLI. O smoke test usa System.Drawing do Windows e gera arquivos em `data/synthetic/`: OCR real em imagens **1440×900**, incluindo painel em inglês à direita com texto de 22 pt e sem rótulo de nome, imagem rotulada em inglês, compatibilidade opcional em português, imagem vazia offline e falha de PNG corrompido. Os testes verificam o idioma efetivo e as dimensões salvas no JSON. Cada chamada do CLI processa uma imagem; o primeiro teste OCR pode baixar modelos.

**Captura real testada em 17/10/2026:** `examples/aqua simulacra.png`, em inglês, tem **1444×932 pixels**, incluindo a borda da janela; a resolução do arquivo difere da resolução de jogo informada. A execução normal, offline, salvou o texto bruto e JSON, mas **não extraiu os três campos corretamente**: nome e refinamento ausentes; nível incerto por misturar várias armas da lista. Visualmente, o painel selecionado mostra Aqua Simulacra, nível 90/90 e refinamento 1.

Experimento diagnóstico na mesma imagem, sem modificar o arquivo: restringir ao painel inteiro não resolveu. Três regiões manuais em modo de linha única leram `Lv. 90/90` e `Refinement Rank 1`, mas o nome saiu **`Agua Simulacra`**, com erro no lugar de `Aqua Simulacra`. Esse experimento não é uma opção implementada no CLI; coordenadas da captura não foram fixadas no código. A confiança do OCR não impediu o erro no nome.

Próximo passo técnico: melhorar a seleção do texto da arma e avaliar reconhecimento de nomes sobre a captura real, preservando incerteza. Até isso ser implementado e testado, a extração automática dessa tela completa permanece insuficiente. Não há captura de janela ou navegação automática.

## Integração e referência

Recomendação: manter este laboratório separado do Gacha Advisor, com exports revisados permanecendo no laboratório até existir uma importação explícita. O estudo do Inventory Kamera v1.3.17, formatos encontrados e próximo experimento estão em [docs/inventory-kamera.md](docs/inventory-kamera.md). Ainda não há export GOOD nem importador implementado.
