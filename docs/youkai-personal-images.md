# Youkai — P1.2 por arquivo no perfil 1280×720

Conferido em **20/10/2026**, sobre a base `7ccbacada331d39293d9523d8bd74befc133478b`, versão `0.1.0`. Cristian informou resolução de jogo **1280×720**, modo janela, escala Windows **100%** e interface em **inglês**. Foram encontrados três PNGs em `examples/ZZZ/`, embora a mensagem mencionasse quatro. Os exemplos pessoais e seus resultados detalhados permanecem ignorados pelo Git.

**Resultado:** o leitor original executa sobre os três arquivos atuais após remover somente barra de título/margens. Nomes e texto de nível conferem visualmente nos três; a consulta diagnóstica separada de raridade retornou A/A/S, também conforme a inspeção visual do assistente. A progressão retornou 1 em todos: divergência observada em dois casos e coincidência em um. Cristian confirmou explicitamente nome, raridade, nível/limite e progressão dos três exemplos em 20/10/2026. As referências locais, vinculadas aos hashes dos PNGs e resultados, estão em `data/datasets/youkai-zzz-p1.2-references.json` (ignorado); as saídas originais não foram alteradas. Isso confirma as duas divergências de progressão, sem aprovar um inventário. Nada atualiza o Advisor.

## Executar em um arquivo salvo

Depois do preparo [P1.1](youkai-qualification.md), este comando não baixa dependências nem controla o jogo:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\read-youkai-image.ps1 -ImagePath .\examples\ZZZ\1.png -ClientArea "2,33,1280,720"
```

`ClientArea` é `left,top,width,height` em pixels da imagem original, incluindo seu eventual chrome de janela. Não é uma coordenada universal nem uma configuração de resolução do jogo. O roteiro valida os limites, recorta sem redimensionar, usa `calibrate()` e `scan_single_frame_engine()` originais e salva `image-result.json`, `client.png` e os recortes de campos em um diretório novo de `.cache/youkai-p1/runs/`. Os fontes originais continuam no SHA fixado e são conferidos antes de cada leitura.

Recortes medidos nestes arquivos:

| Arquivo local | PNG original | Área cliente: left,top,width,height |
|---|---|---|
| `1.png` | 1285×754 | `2,33,1280,720` |
| `2.png` | 1286×753 | `2,33,1280,720` |
| `3.png` | 1284×752 | `3,32,1280,720` |

As bordas e a transição entre barra branca e imagem do jogo foram inspecionadas. A calibração original usa escala **2/3** contra 1920×1080. Não se usou o deslocamento `(1,32)` das referências públicas, pois estes PNGs têm margens diferentes.

## Evidência e limites

- Os três resultados do comando novo coincidem com a execução direta anterior do leitor original: item, texto relido e código de raridade. Os hashes dos três PNGs permaneceram iguais.
- Os dois exemplos públicos da reprodução P1.1 mantiveram suas saídas na regressão direcionada. Três recortes inválidos (origem negativa, fora dos limites e dimensão zero) foram recusados. Os 260 arquivos upstream continuam iguais ao ZIP.
- O comando por arquivo foi executado no Windows PowerShell 5.1. Os 273 testes upstream aprovados e 5 pulados pertencem a P1.1; não foi repetida a suíte completa nesta entrega.
- São três imagens de desenvolvimento do mesmo inventário, com dois títulos em duas linhas. Não constituem avaliação independente, taxa de precisão ou prova de cobertura do catálogo. O texto bruto dos títulos ainda pode incluir ícones como ruído.
- Todos os exemplos têm texto de nível no máximo. Ainda faltam evidências para níveis intermediários/limites menores e B como caso negativo.
- A consulta `rarityProbe` chama `detect_rarity()` no recorte salvo e converte os códigos documentados 4/3/2 em S/A/B. É diagnóstico separado: não altera o item original nem implementa filtro S/A.
- O retorno original guarda nível e ascensão; o limite lido permanece no texto bruto, não em um campo próprio de máximo. Os scores upstream não são probabilidades calibradas.
- A falha de progressão envolve o detector original que busca estrelas douradas e retorna no mínimo 1; os exemplos têm estrelas claras. Além disso, o recorte proporcional original termina antes da quinta estrela neste layout 1280×720, como mostrou a comparação com um recorte diagnóstico mais amplo. Não basta trocar o critério de cor: a faixa também precisa ser revista na adaptação. Nenhuma correção foi aplicada.
- O helper estático original usa a primeira célula `(0,0)` para lock. Nenhuma das três imagens seleciona essa célula: o booleano retornado não foi validado como cadeado do item selecionado.
- Foco, captura real, avanço, interrupção, rolagem, cópias e completude não foram testados. Não houve input ou captura de tela ao vivo.

Evidências pessoais locais: leitura direta em `.cache/youkai-p1/runs/20261020-165911-personal-zzz/`; comandos reproduzíveis em `20261020-170027-c2c422a9-image/`, `20261020-170031-14ea5ab7-image/`, `20261020-170034-33ccb589-image/`; verificações direcionadas em `20261020-170316-image-checks/`. Esses diretórios são referências opcionais, não acompanham o clone. Outros usuários podem reproduzir o comando com seus próprios PNGs e recortes.

## Próximo passo

A conferência humana dos campos visuais foi concluída. Alinhar uma captura cliente única, sem cliques, antes de qualquer prova limitada de seleção. A parte offline de P1.2 mostrou compatibilidade dos recortes proporcionais neste conjunto e confirmou as falhas já previstas; não foi necessária reconstrução do leitor. A aceitação do percurso continua em aberto. A adaptação de progressão/raridade/cópias e persistência pertence a P2 e ainda não começou.
