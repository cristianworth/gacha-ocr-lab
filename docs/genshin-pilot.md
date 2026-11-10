# Genshin — piloto de armas em 1280×720

Este é o contrato atual **experimental** do piloto na janela do laboratório. O [scanner legado](genshin-scanner.md) documenta outro fluxo, em 1440×900 e ordenação Quality; seus comandos e resultados não validam este perfil. O plano e os próximos recortes ficam no [roadmap](ROADMAP.md).

## Preparação e execução

1. No Genshin, use inglês, área cliente **1280×720** e escala Windows **100%**. Abra **Inventory → Weapons**, escolha **Level decrescente**, volte ao topo e selecione a primeira arma. Não use filtro que oculte armas 3★, 4★ ou 5★. Feche o filtro e solte os controles.
2. Feche uma janela anterior do laboratório e abra `D:\Repo\gacha-ocr-lab\gacha-ocr.exe`. Selecione **Genshin — Armas 20+ (piloto)**, confirme a preparação e inicie. O executável da raiz chama os scripts atuais; pacotes já extraídos têm arquivos próprios e não recebem essa atualização.
3. O aplicativo ativa o jogo após cinco segundos. Mantenha o jogo em primeiro plano e os controles livres. **F8 interrompe**; o botão Interromper ou fechar a janela solicita parada cooperativa e aguarda o filho terminar. O piloto Genshin não espera F8 para começar.
4. Aguarde o encerramento. **Abrir resultado** abre `summary.md`; **Abrir pasta** mostra os arquivos da tentativa. O local aparece na janela. O manifesto `session.json` deve ser consultado somente depois do encerramento, para não interferir na substituição atômica no Windows.

É necessário Node.js disponível, dependências Node instaladas e `.cache/models/eng.traineddata` no repositório. O executável da janela solicita elevação; o piloto também confere a integridade do jogo antes de enviar inputs. A janela requer o ambiente ZZZ existente para abrir. O pacote portátil anterior não inclui este piloto nem seu runtime Node.

## Escopo, saída e limites

O objetivo futuro são armas 3★/4★/5★ de nível atual 20+, com nome, nível atual/máximo e refinamento. **O piloto registra até dez posições, sem rolagem e sem filtrar elegibilidade**: não extrai raridade, não aplica corte por nível e não prova cobertura ou aprovação humana. Preparar Level decrescente e o topo é uma declaração humana; o OCR apenas confere os rótulos Weapons e Level.

Cada tentativa usa uma pasta em `.cache/genshin/runs/`, com `console.log`, `exit-code.txt` e, depois de iniciado o executor, `session.json`, `summary.md` e frames. O manifesto conserva OCR bruto, candidatos, incertezas, posição, hash e evidências de seleção. `lastCapture` e `currentAttempt` ajudam a localizar uma falha; uma captura com OCR pendente ou âncora não verificada permanece registrada. Os caminhos e as imagens são locais e não entram no Git. Se falhar antes de o executor iniciar, pode haver somente log e código de saída.

O piloto confirma um contorno na posição alvo e estabilidade do painel em dois quadros; ele interrompe se não puder fazê-lo. Igualdade de arte ou nome não identifica cópia. Foco, geometria, DPI, oclusão, integridade e parada são verificados pelo helper; um bloqueio ou falha conserva a saída parcial. Nada é enviado ao Advisor.

Em 10/11, o piloto no jogo alcançou dez posições e encerrou no limite configurado. O manifesto registrou os 30 campos como reconhecidos e os hashes das dez capturas foram conferidos; não houve aprovação humana dos campos. Esse piloto não comprova cobertura, precisão independente, rolagem ou corte por nível. Não há percurso completo ou integração portátil nova.
