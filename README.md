# gacha-ocr-lab

Scanner local de inventário para vários gachas, começando por armas em Genshin, HSR, WuWa, ZZZ e NTE. Windows/inglês são o escopo inicial. HSR será o segundo jogo. Coleta automática e integração com o Gacha Advisor são futuras; os repositórios permanecem separados. Veja [objetivo e roadmap](docs/ROADMAP.md).

**Disponível agora:** uma imagem de arma do Genshin → regiões → OCR → interpretação → pacote de revisão → JSON. Perfil inicial: cartão do inventário com layout de jogo 16:10, desenvolvido com Genshin em 1440×900. Não há captura da janela, navegação, lote de inventário, catálogo, export GOOD ou importação de conta.

## Instalar e executar

Node.js **22+**, npm e Windows para o smoke test sintético. O CLI também usa módulos portáveis, mas só foi verificado no Windows/Node 24.20.0.

```powershell
cd D:\Repo\gacha-ocr-lab
npm.cmd ci --ignore-scripts --cache .cache/npm
# Sua captura completa, com o cartão selecionado explicitamente:
npm.cmd start -- "examples\aqua simulacra.png" --panel 982,125,370,722 --offline
# Um cartão inteiro já recortado, no perfil suportado:
npm.cmd start -- "C:\caminho\card.png" --layout card --offline
```

As coordenadas do exemplo são específicas da captura fornecida; **não estão fixas no programa**. `--panel left,top,width,height` usa pixels da imagem original e deve abranger o cartão inteiro, incluindo sua altura; o programa calcula as regiões proporcionais dentro dele. Não usar as coordenadas do cartão diretamente em uma captura com bordas de janela.

Aceita PNG/JPEG até 30 MiB, com aspas em caminhos com espaços. Rotação EXIF diferente da orientação normal ainda exige exportar um PNG orientado. Inglês é padrão; `--lang por` e `por+eng` continuam disponíveis, mas a validação real desta entrega é em inglês. O jogo pode estar fechado ou minimizado: somente o arquivo salvo é lido, sem modificar o original.

O primeiro uso de cada idioma requer internet para baixar modelos; nesse caso, remova `--offline`. Depois, `--offline` impede download e exige cache local. Imagens não são enviadas a um serviço. `npm.cmd` evita a política de execução do `npm.ps1` no PowerShell.

Layouts: `auto` (padrão) escolhe `screenshot` com `--panel`, `card` para imagem estreita e `text` nos demais casos. O formato estreito não prova que é uma arma: a leitura regional exige reconhecer também o tipo de arma. `--layout screenshot` exige `--panel`. `--layout text` mantém o OCR geral original; ele mistura a lista e o painel de uma tela de inventário e **não é o leitor validado da arma selecionada**. Não há detecção automática da janela/painel nesta etapa.

## Como vamos validar juntos

1. O CLI salva um JSON em `data/results/` e imprime o caminho de **`data/reviews/<execução>/review.md`**. Abra esse documento: ele mostra imagem com caixas, valores interpretados, recortes e texto bruto por tentativa. Verde = nome, azul = nível, laranja = refinamento.
2. Compare os valores com a imagem, não com o indicador de confiança. Responda no chat **“os três conferem”**, informe os campos corrigidos ou diga que estão ilegíveis. Não é preciso produzir outra imagem para conferir a atual.
3. A confirmação/correção fica em um JSON separado em `data/feedback/`, vinculado ao SHA-256 do resultado e da imagem. O diagnóstico original permanece intacto. Nada é aplicado ao Advisor.

Se preferir registrar você mesmo, **apenas depois de conferir**:

```powershell
npm.cmd run review -- "data\results\<resultado>.json" --confirm-all --reviewer "Cristian"
# Para corrigir, informe os três campos conferidos:
npm.cmd run review -- "data\results\<resultado>.json" --name "Nome correto" --level 80/90 --refinement 3 --reviewer "Cristian"
```

`--confirm-all` recusa campos ausentes/incertos; eles precisam de correção explícita. Se o limite do nível não estiver visível, `--level 80` registra `max: null`. Se algo estiver ilegível, mantenha a revisão pendente; não preencha com palpite. Há uma conferência automática contra referências visuais, separada dessa aprovação humana.

## Resultado e limites

Schema **2** acrescenta jogo/tipo, dimensões originais, perfil/painel, regiões, tratamentos e artefatos. Textos/TSV/confiança de cada tentativa ficam em `ocr.regions`; suas coordenadas são da imagem tratada, enquanto os retângulos das regiões são da imagem original. `ocr.rawText` concatena esses textos **sem inventar rótulos**. No modo regional não se calcula uma confiança global: `ocr.confidence` é `null`.

**No modo regional**, `recognized` = duas leituras válidas de tratamentos fixos concordam e o tipo de arma foi reconhecido; não é aprovação humana nem probabilidade calibrada. `uncertain` = há texto, mas falta concordância/validação; `absent` = nenhuma tentativa leu texto naquela região, o que não prova ausência na imagem. Nos dois últimos, `value` é `null`, com candidatos e evidências preservados. A concordância também pode ocorrer em um erro: `requiresManualReview` permanece `true`. No modo legado `text`, `recognized` continua significando apenas padrão textual explícito sem conflito; ele não é a validação regional nova.

Nomes em duas linhas são reunidos; somente espaços, NFC e aspas tipográficas são normalizados, preservando a leitura bruta. Não há aproximação de catálogo nem correção de letras em números. Guardas iniciais: nível 1–90, limite ≥ atual e ≤ 90 quando lido, refinamento 1–5. Não validam todos os estados legais de uma arma.

Cada execução salva arquivos novos. Saída 0 significa resultado salvo, **mesmo incompleto**; 1 significa falha de leitura/decodificação/OCR/gravação; 2 significa argumentos inválidos. O perfil é limitado às regiões proporcionais documentadas: outra escala de interface, proporção, tela ou painel deslocado pode exigir ajuste. Um recorte errado não tem garantia de ser detectado.

## Testes e avaliação

```powershell
npm.cmd test
npm.cmd run test:ocr
# Exige o manifesto pessoal conferido disponível nesta instalação:
npm.cmd run evaluate -- --split development
# Só depois de congelar a configuração; não usar para escolher tratamentos:
npm.cmd run evaluate -- --split evaluation --final
```

A avaliação é uma ferramenta de teste com manifesto de referências; não é processamento em lote de inventário. Ela verifica hashes, grupos de amostras e guarda relatórios sem sobrescrita. Os testes normais não dependem das capturas pessoais. O manifesto em `data/datasets/genshin-weapons.json` define caminho, hash, divisão, grupo, procedência e valores esperados; não pertence ao Git.

Nesta entrega: **23 testes automatizados passaram**, além do smoke test de OCR sintético, modo offline, imagem vazia e arquivo corrompido. Nas **8 referências de desenvolvimento**, os três campos acertaram. Na primeira avaliação das **4 referências reservadas**, nome e refinamento acertaram 4/4; nível acertou 3/4, com 1 incerto e nenhum valor incorreto aceito como válido. A captura completa fornecida produziu Aqua Simulacra, 90/90, refinamento 1 com painel explícito. Essas referências foram conferidas visualmente pelo assistente; não são aprovação humana nem prova de precisão geral. Cristian confirmou explicitamente os três campos da captura completa em 17/10/2026; a confirmação está registrada separadamente em `data/feedback/`. Isso não aprova individualmente os demais cartões.

O perfil foi congelado antes da primeira leitura OCR reservada. A incerteza foi preservada, sem ajustar o perfil sobre esse exemplo. Relatórios, baseline anterior, congelamento e caminhos da entrega ficam em `data/evaluation/` e `data/research/m1-delivery.json`, ignorados.

## Estrutura e decisões

- `src/image.js`: leitura do arquivo; `regions.js`: perfil, coordenadas e tratamento com Sharp.
- `src/ocr.js`: sessão Tesseract.js reutilizada por imagem, com liberação em `finally`.
- `src/read-weapon.js`: coordenação; `parse-regions.js`: interpretação das regiões; `parse-weapon.js`: parser legado do modo `text`.
- `src/review.js`, `result.js`, `feedback.js`: pacote visual, gravação e confirmação independente.
- `scripts/evaluate.js`: avaliação local; `scripts/review-result.js`: registro explícito de revisão; `test/`: testes sem dependência do acervo pessoal.
- `docs/ROADMAP.md`: marcos; [inventory-kamera.md](docs/inventory-kamera.md): referência e arquitetura.

JavaScript ESM + Tesseract.js 7.0.0 mantém OCR local sem Python, API ou credenciais. **Sharp 0.35.5** foi acrescentado para recortes, ampliação, contraste e imagens de diagnóstico: o teste real demonstrou a necessidade desse tratamento. Duas variantes fixas por campo foram escolhidas somente nas amostras de desenvolvimento; nomes usam limiares 220/230, nível/refinamento usam ampliação e cinza/normalização. O nome permite bloco multilinha; números usam linha única. As transformações são registradas; a margem branca é aplicada em uma etapa separada para evitar inversão/reordenação da borda. Treinamento de um modelo novo e catálogo foram adiados.

Não há interface gráfica, backend, banco ou MCP. O pacote de revisão é um documento local estático. Imagens, resultados, modelos e temporários são ignorados pelo Git: `examples/`, `data/`, `.cache/`, `tmp/`. Não force sua inclusão. O projeto tem commits locais; não há remoto ou publicação configurados.

Fontes técnicas: [Tesseract.js API](https://github.com/naptha/tesseract.js/blob/master/docs/api.md), [operações Sharp](https://sharp.pixelplumbing.com/api-operation/), [composição Sharp](https://sharp.pixelplumbing.com/api-composite/), consultadas em 17/10/2026.
