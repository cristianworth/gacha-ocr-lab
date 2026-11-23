# NTE: leitura offline de Arc

As três capturas de desenvolvimento mostram a aba de inventário **Arc** e interface em inglês. O painel mostra nome, `Lvl`, elemento, duas linhas de Main Attributes e uma linha `Tier`; também mostra estrelas e um emblema com letra, cuja semântica não foi estabelecida. Há conteúdo de descrição parcialmente oculto por rolagem em duas imagens. Esses termos são observações da interface, não equivalências com sistemas de outros jogos.

## Contrato antes de qualquer percurso

- Dado útil provisório: observações do painel Arc selecionado, com nome, nível, elemento, atributos e Tier visíveis, preservando originais e dúvidas.
- Filtro provisório: nenhum corte de nível ou raridade; preservar os três exemplos. O escopo de inventário futuro depende de decisão humana.
- Ordenação: as imagens mostram seletor `Level` e uma sequência visual decrescente nesta área, mas a direção e a ordem global ainda precisam ser verificadas.
- Parada: não definida; fim físico, ordenação e condição de término precisam ser qualificados antes de um percurso.
- Saída: observações locais revisáveis por imagem, com proveniência, recortes e OCR bruto; não identifica cópias nem grava no Advisor.

## Execução

Requer Node.js, `npm ci` e modelo inglês `eng.traineddata` em `.cache/models` (ou `--models` para outra pasta). O OCR opera offline; não baixa modelos. O modelo local reutilizado nesta qualificação foi copiado do cache do laboratório original, SHA-256 `5dc5d8d640a212c9d6184921ba103b186f50e0fed9ee716c53e6b312b400d747`; sua origem e licença não foram estabelecidas aqui. O usuário deve fornecer um modelo cuja origem e licença tenha verificado para outros ambientes.

```powershell
node scripts/nte-offline.js 'D:/Repo/gacha-ocr-lab/examples/NTE/Fluff of Fortitude.png' --panel 872,146,348,496 --output .cache/nte/replay-v2/fluff
node scripts/nte-offline.js 'D:/Repo/gacha-ocr-lab/examples/NTE/Raging Flames.png' --panel 868,145,348,496 --output .cache/nte/replay-v2/flames
node scripts/nte-offline.js 'D:/Repo/gacha-ocr-lab/examples/NTE/Umbrella.png' --panel 870,146,348,496 --output .cache/nte/replay-v2/umbrella
node --test test/nte-offline.test.js
```

Para outra imagem, informe o retângulo do painel em pixels da imagem, sem escala, e uma pasta de saída própria. O perfil só aceita 348×496 e não confirma que a imagem realmente contém o painel esperado: o usuário deve conferir recortes e geometria. Cada execução sobrescreve os arquivos de mesmo nome na pasta escolhida. `result.json` contém caminho/hash da fonte, tamanho, retângulos absolutos, hashes e caminhos dos PNGs recortados, tratamento e OCR com texto e TSV brutos. Todos os candidatos, inclusive vazios, exigem revisão; não há aprovação humana. Uma leitura pode estar errada mesmo não vazia.

## Qualificação local

Nas três imagens usadas para desenvolver o perfil, o replay retornou `Arc`, os três nomes, `Lvl 80`, `Lvl 60` e `Lvl 30`, os elementos `Plasma`, `Plasma` e `Condensate`, e as seis linhas de atributos visíveis. As linhas de Tier retornaram `1Tier`, `1Tier` e `5Tier`, com o texto de restrição visível; o OCR não inseriu espaço entre número e Tier e variou as aspas. Elemento vem de sua própria região, sem consultar Tier. Todos são candidatos sujeitos à revisão humana.

No primeiro processamento, normalização em tons de cinza deixou categoria vazia nas três imagens, elemento vazio em duas e ruidoso em uma; os ícones também invadiam os recortes de elemento e Tier. No experimento local, limiares 120 e 160 leram categoria e elemento nos três exemplos, enquanto 190 e 220 produziram erros em alguns deles; o perfil usa 120. Tier com normalização e recorte sem ícone preservou o texto visível nas três, enquanto os limiares também perderam ou corromperam texto. Os resultados originais permanecem em `.cache/nte/{fluff,flames,umbrella}/`, o replay em `.cache/nte/replay-v2/` e o registro das alternativas em `.cache/nte-experiment.log`, fora do Git.

Estrelas, letra, estado equipado/bloqueado e descrição não são extraídos. O texto fora da área visível não pode ser recuperado. Estas observações não são revisão de Cristian nem medição independente de precisão. Após revisão, a próxima etapa é qualificar aquisição real sem presumir navegação, cobertura ou ordenação a partir destes arquivos.

O piloto limitado sem rolagem tem contrato, geometria e roteiro próprios em [piloto NTE](nte-pilot.md); o perfil offline acima continua recebendo coordenadas da imagem original.
