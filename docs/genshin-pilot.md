# Genshin — percurso limitado de armas em 1280×720

Este é o contrato atual **experimental** do percurso na janela do laboratório. O [scanner legado](genshin-scanner.md) documenta outro fluxo, em 1440×900 e ordenação Quality; seus comandos e resultados não validam este perfil. O plano e os próximos recortes ficam no [roadmap](ROADMAP.md).

## Preparação e execução

1. No Genshin, use inglês, área cliente **1280×720** e escala Windows **100%**. Abra **Inventory → Weapons**, escolha **Level decrescente**, volte ao topo e selecione a primeira arma. Não use filtro que oculte armas 3★, 4★ ou 5★. Feche o filtro e solte os controles.
2. Feche uma janela anterior do laboratório e abra `D:\Repo\gacha-ocr-lab\gacha-ocr.exe`. Selecione **Genshin — Armas 60+ (rolagem limitada)**, confirme a preparação e inicie. O executável da raiz chama os scripts atuais; pacotes já extraídos têm arquivos próprios e não recebem essa atualização.
3. O aplicativo ativa o jogo após cinco segundos. Mantenha o jogo em primeiro plano e os controles livres. **F8 interrompe**; o botão Interromper ou fechar a janela solicita parada cooperativa e aguarda o filho terminar. O piloto Genshin não espera F8 para começar.
4. Aguarde o encerramento. **Abrir resultado** abre `summary.md`; **Abrir pasta** mostra os arquivos da tentativa. O local aparece na janela. O manifesto `session.json` deve ser consultado somente depois do encerramento, para não interferir na substituição atômica no Windows.

É necessário Node.js disponível, dependências Node instaladas e `.cache/models/eng.traineddata` no repositório. O executável da janela solicita elevação; o piloto também confere a integridade do jogo antes de enviar inputs. A janela requer o ambiente ZZZ existente para abrir. O pacote portátil anterior não inclui este piloto nem seu runtime Node.

## Escopo, saída e limites

O objetivo são armas 3★/4★/5★ de nível atual 60+, com nome, nível atual/máximo, refinamento e raridade. O percurso experimental busca o primeiro nível inferior a 60 e tem limites de segurança de 1.000 posições, 1.500 passos de roda e 16 passos consecutivos sem registrar uma nova posição. Esses limites produzem resultado parcial; não comprovam o fim do inventário. Um cartão próximo à borda inferior só é selecionado após ser trazido à área de confirmação; cada passo de roda precisa demonstrar deslocamento em dois quadros. A raridade é lida pelas estrelas do painel e não controla a parada nem descarta observações. Mesmo com corte por nível, o resultado não declara cobertura integral ou aprovação humana. Preparar Level decrescente e o topo é uma declaração humana; o OCR apenas confere os rótulos Weapons e Level.

O executor observa níveis na ordem visual e para por contradição; nível ilegível impede afirmar término por nível. Depois de uma rolagem, exige em dois quadros sobreposição visual única e estável de pelo menos duas linhas completas e distintas antes de avançar. A comparação usa trechos internos dos cartões para identificar deslocamento da grade, não para identificar cópias. Se o deslocamento ou a seleção for ambíguo, a tentativa termina parcial e preserva os frames anteriores e posteriores.

Cada tentativa usa uma pasta em `.cache/genshin/runs/`, com `console.log`, `exit-code.txt` e, depois de iniciado o executor, `session.json`, `summary.md` e frames. O manifesto conserva OCR bruto, candidatos, incertezas, posição, hash e evidências de seleção. `lastCapture` e `currentAttempt` ajudam a localizar uma falha; uma captura com OCR pendente ou âncora não verificada permanece registrada. Os caminhos e as imagens são locais e não entram no Git. Se falhar antes de o executor iniciar, pode haver somente log e código de saída.

O resumo distingue posições dentro e abaixo do corte e informa se nível e raridade as colocam no escopo. Se um desses dados estiver incerto, a elegibilidade permanece pendente; armas de raridade fora de 3–5 estrelas permanecem registradas, identificadas como fora do escopo. Campos incertos aparecem em uma lista de revisão com candidatos e links para os frames, quando disponíveis. Esses candidatos não são confirmações humanas. Sessões anteriores preservam seus resultados originais e não ganham raridade retroativamente.

Há também uma [saída estruturada local para revisão](genshin-review-format.md), que mantém OCR e confirmações humanas separados. O Advisor não possui importador para ela.

O piloto confirma um contorno na posição alvo e estabilidade do painel em dois quadros; ele interrompe se não puder fazê-lo. Igualdade de arte ou nome não identifica cópia. Foco, geometria, DPI, oclusão, integridade e parada são verificados pelo helper; um bloqueio ou falha conserva a saída parcial. Nada é enviado ao Advisor.

Em 10/11, o piloto no jogo alcançou dez posições. Em 11/11, as tentativas pararam após 32 posições por dificuldades de detecção da grade e da borda; as correções e suas evidências estão no [roadmap](ROADMAP.md). Não há aprovação humana integral, comprovação de cobertura ou percurso completo.

Em 15/11, uma execução no jogo chegou ao corte de 60+, com 90 posições de nível reconhecido dentro do corte, uma abaixo e dois nomes incertos depois revisados por Cristian. Um replay separado reconheceu estrelas nas imagens salvas, sem comprovar precisão independente. O inventário não foi aprovado integralmente. Os limites da evidência estão no [roadmap](ROADMAP.md).

Uma conferência técnica de quatro imagens de outra sessão concordou com o leitor para 1★, 3★, 4★ e 5★; a seleção não foi cega. Outra amostra de cinco imagens, com rótulos visuais registrados antes da comparação com o leitor, também concordou nas leituras de 3★, 4★ e 5★. As amostras são pequenas, do mesmo inventário e não aleatórias; não representam precisão geral nem aprovação de Cristian para a raridade.
