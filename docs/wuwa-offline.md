# WuWa: leitor offline experimental

## Contrato e próximo percurso

Dado útil provisório: observação de arma com nome, nível atual/máximo e Rank; tipo pode ajudar a verificar o painel. As três imagens mostram Weapons em inglês, dois tipos (Rectifier e Sword), seleção e esses campos. O produto consumidor ainda não tem importador confirmado; a saída proposta é JSON local revisável, sem escrita no Advisor nem identidade de cópias.

Não há filtro na leitura offline; mínimo de nível e categorias úteis dependem de decisão futura. As imagens mostram `Sort by Level`, porém não comprovam direção, ordenação global ou itens omitidos. Ordenação e condição de parada devem ser declaradas ou verificadas antes de definir percurso vivo; nível ilegível ou contradição não permitem concluir cobertura. Este recorte não planeja inputs nem opera o jogo.

## Execução

Requer Node >=22, `npm ci` e modelo inglês local `.cache/models/eng.traineddata`. O comando só lê modelos locais e não baixa dados. Para este experimento foi copiado a partir do cache preexistente `D:/Repo/gacha-ocr-lab/.cache/models/eng.traineddata`, SHA-256 `5dc5d8d640a212c9d6184921ba103b186f50e0fed9ee716c53e6b312b400d747`; a origem anterior desse arquivo não foi estabelecida. `--models` permite apontar outra pasta de modelos. Não altere os exemplos originais; grave resultados em `.cache` ignorado.

```powershell
New-Item -ItemType Directory -Force .cache/wuwa | Out-Null
node scripts/wuwa-offline.js 'D:/Repo/gacha-ocr-lab/examples/Wuwa/Augment.png' --client 0,29,1280,720 | Set-Content -Encoding utf8 .cache/wuwa/augment.json
node scripts/wuwa-offline.js 'D:/Repo/gacha-ocr-lab/examples/Wuwa/Blooming Jadehaven.png' --client 0,30,1276,718 | Set-Content -Encoding utf8 .cache/wuwa/blooming.json
node scripts/wuwa-offline.js 'D:/Repo/gacha-ocr-lab/examples/Wuwa/Emerald of Genesis.png' --client 1,34,1280,720 | Set-Content -Encoding utf8 .cache/wuwa/emerald.json
node --test test/wuwa-offline.test.js
```

Para outra imagem, informe o retângulo do cliente `left,top,width,height` em pixels da imagem original; sem `--client`, só uma imagem de 1280×720 é aceita. A escala aproximadamente 16:9 e dimensões próximas foram medidas apenas nesses exemplos; a geometria informada não é automaticamente verificada como painel correto. Ajustes de resolução, idioma, interface ou painel podem invalidar os recortes. Cada tentativa registra retângulo original, tratamento, texto, TSV, confiança e motor; o arquivo registra caminho e hash da imagem. A concordância de dois tratamentos é uma leitura automática, não validação humana ou garantia de precisão. Tipo não confirmado torna os demais campos incertos. Raridade permanece pendente: os símbolos visíveis não foram qualificados para contagem confiável. Revisões humanas devem ser mantidas separadas do bruto.

## Resultado técnico dos exemplos de desenvolvimento

Com os retângulos acima e o modelo identificado, o OCR reconheceu tipo, 90/90 e Rank 1 nos três; reconheceu o nome Blooming Jadehaven. Os nomes Augment e Emerald of Genesis ficaram incertos por divergência/ruído entre tentativas, apesar de candidatos legíveis no bruto. Raridade permanece incerta nos três. Esses exemplos orientaram os recortes e tratamentos, portanto não são avaliação independente nem aprovação de Cristian. Uma imagem isolada não comprova navegação, ordem global, cobertura ou identidade de cópias.
