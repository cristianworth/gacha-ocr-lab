# HSR — evidências e investigação

## Inicialização do primeiro piloto — 03/11/2026

Cristian informou a parada em `.cache/hsr/runs/20261103-200333-eadb83c9-selection`. O processo já havia encerrado: `exit-code.txt=2`, somente log e recibo presentes, sem manifesto ou captura. O leitor não chegou à espera por F8.

Confirmada falha em `scan-hsr.ps1`: uma expressão `if` desembrulhava o array inicial de um elemento em `string`. O `+=` posterior concatenava o caminho do script e os argumentos em uma única string, produzindo chamada nativa inválida. A correção mantém o array por fora da expressão. O log também passa a preservar stderr nativo antes de registrar e avaliar o código de saída; antes, a janela mostrava somente a mensagem genérica do adaptador.

Cinco testes do lançador passaram em 5,18 s com Windows PowerShell: roteamento do app, recusa de diretório existente, processo nativo real recebendo os seis argumentos separados nos modos repositório/portátil (caminho com espaços/apóstrofo) e preservação de stderr/código 2 em falha nativa. O executável de teste só imprime argumentos; não captura nem envia inputs. Isso corrige a inicialização, mas não valida o perfil vivo, OCR ou avanço HSR. Os arquivos da tentativa foram preservados; aguarda-se o piloto de três posições após a correção.

## Primeiro frame HSR 1280×720 — 03/11/2026

Tentativa `.cache/hsr/runs/20261103-201719-b34c349e-selection`: F8 confirmado, cliente 1280×720/DPI 96 e integridade compatíveis, saída 1 por `selection-delivery-or-panel-stability-unconfirmed`. Zero D/cliques/rolagens, nenhuma observação registrada. Manifesto e `unconfirmed-start.png` preservados; imagem SHA256 `c71f9aa945de3ed3759a14219b690c33305a77f497ec9dcfb34256747da351ef`.

O primeiro cartão está selecionado com borda em `[91,90,91,108]` (x,y,largura,altura). O detector começava em 15% da altura (y=108), cortava o topo da borda e devolvia seleção ausente. Corrigida somente a região de busca para manter a borda inteira, preservando tamanho/formato, quatro lados e unicidade. Os limites da seleção inicial foram restringidos para rejeitar segunda coluna/linha; a espera agora distingue seleção ausente/ambígua, avanço não confirmado e painel instável, com evidência no manifesto.

Replay da mesma imagem também mostrou o ícone do Caminho entrando no recorte da frase e caracteres decorativos no recorte da ordenação. Ajustados o recorte textual do Caminho e o rótulo de ordenação; sem flexibilizar concordância/valores. A imagem passa a confirmar nome **On the Fall of an Aeon**, nível **80/80** e sobreposição **5**, sem nova captura/inputs. O rótulo real é **Rarity**, rejeitado corretamente para o corte por nível; próxima tentativa requer mudar para **Lv decrescente** e selecionar o primeiro Cone no topo.

Replay técnico em `.cache/hsr/analyses/20261103-start-selection-b34c349e/replay.json`. A repetição de um único frame confirma geometria/leitura nesse arquivo; não demonstra estabilidade de uma sequência viva nem entrega da próxima seleção por D. Piloto de três posições permanece pendente.

## Ordenação e nível 80 — 04/11/2026

Sessão `20261104-112817-c395b86c-selection`, encerrada com saída 1 por `prepare-Light-Cone-tab-and-Lv-sort`: zero observações e zero D/cliques/rolagens. `before.png` (SHA256 `a11a50d4111ecc0d476f0f739ce29d4e80e65ad82254c13d5ff244a65781f91d`) mostra **Rarity**, confirmado pelas duas leituras do cabeçalho. O nível máximo 80 já é aceito; a parada ocorreu antes de ler os campos dos Cones.

Replay offline dessa imagem reconheceu literalmente `80/80` nas duas variantes, mas revelou uma falha independente na âncora do painel: o fundo translúcido interferia na frase e no nome dourado do Caminho. O perfil 16:9 agora recorta somente a frase branca fixa completa `The following effects only work on characters of the Path of`, com limiares 170/180; mantém concordância de duas leituras e exige a frase inteira. Não extrai nem deduz o Caminho. O perfil legado mantém seu contrato anterior.

Após o ajuste, as duas imagens reais já preservadas confirmam âncora, **On the Fall of an Aeon**, **80/80** e sobreposição **5**; ambas continuam rejeitando Rarity. Replays antes/depois em `.cache/hsr/analyses/20261104-preparation-c395b86c/`. Passaram 37 testes HSR/leitor/lançador em 11,21 s. Nenhuma nova captura ou input durante o diagnóstico, sem alteração dos originais ou aprovação humana dos campos. Ainda falta piloto vivo com **Lv decrescente**, confirmação dos avanços por D e validação do portátil.

## Primeiro avanço real por D — 04/11/2026

Sessão `20261104-113747-49388685-selection`: rótulo **Lv.** confirmado nas duas leituras, cliente 1280×720 e integridades compatíveis. Três posições capturadas, dois pedidos D com liberação registrada, zero cliques/rolagens e nenhuma falha de guarda. Bordas selecionadas em `[92,90,90,108]`, `[184,90,91,108]` e `[277,90,91,108]`, com nomes distintos nos respectivos painéis. Isso confirma os dois avanços, sem comprovar ainda troca de linha ou corte 20+.

O original encerrou com saída 1, `light-cone-panel-anchor-unconfirmed` na terceira posição. A frase branca estava correta, mas o nome dourado **The Hunt** começava na mesma linha e gerava `|` em uma variante. Na segunda posição, o recorte apertado da sobreposição gerava `1.` em ambas. A correção separa pixels coloridos antes de preparar a âncora branca e acrescenta margem branca na leitura do dígito; não tolera texto extra, não usa catálogo e não inventa valores.

Replay separado em `.cache/hsr/analyses/20261104-delivery-49388685/`, sem inputs ou novas capturas:

| Posição | Nome literal | Nível | Sobreposição após ajuste |
|---|---|---|---|
| 1 | On the Fall of an Aeon | 80/80 | 5 |
| 2 | Thus Burns the Dawn | 80/80 | 1 |
| 3 | Cruising in the Stellar Sea | 80/80 | 5 |

Os três arquivos mantêm os hashes do manifesto original: `57b0bedc9b579f519264bc30985760721fbebf6c357d8cbbd7b20e9e7621225e`, `2e3f58a51afc26c0b00aebe431a5701267808578efabc820d4a1258c4f5e0b1c`, `0c0af403c322282a57cb508f20dfefe3a2763e676faa12d79be56fe82c37db35`. O replay do percurso com esses frames termina no limite de três, com três elegíveis, sem campos pendentes e sem alegar cobertura. O original permanece parcial, sem reescrita ou aprovação humana. Próximas validações: percurso ampliado incluindo troca de linha/corte 20+ e portátil.

Verificação da entrega: 138 testes passaram em 73,18 s, cobrindo leitor/percurso/lançador HSR, formulário com loop real, lançadores/portátil ZZZ, guardas/parada externa, gravação e processamento diferido. Os dois frames HSR anteriores também continuam reconhecidos após o filtro de cor/margem. São testes/replays, sem nova aquisição ZZZ/HSR ou medição de precisão. Não há changelog no projeto; versão 0.1.0 mantida nesta entrega em validação.
