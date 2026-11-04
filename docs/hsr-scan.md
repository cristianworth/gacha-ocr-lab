# HSR — primeiro percurso de Cones de Luz 20+

Iniciado em **03/11/2026**, após ZZZ/interface conferidos. **Em validação:** piloto real de 04/11 confirmou três seleções e dois avanços por D; ajustes de OCR foram conferidos nas imagens salvas. Percurso ampliado/corte 20+ e portátil ainda pendentes. O app encaminha HSR ao executor próprio; este guia define o primeiro recorte, sem importar o aplicativo HSR-Scanner inteiro.

## Dado útil, preparação e saída

- Dado útil: **nome, nível atual/máximo e sobreposição** de Cones de Luz com nível atual **>=20**. OCR bruto, imagens, candidatos e pendências ficam separados de confirmação humana. Raridade e trava ainda não são extraídas neste perfil.
- Preparação manual: HSR em inglês, cliente **1280×720**, escala Windows **100%**, fundo escuro atrás do painel translúcido. Abra **Inventory → Light Cone**, ordene **Lv do maior para o menor**, volte ao topo e **selecione o primeiro Cone**. Filtro 4/5 estrelas é opcional; um Cone 3 estrelas 20+ não é descartado por inferência.
- Percurso: o primeiro Cone já está selecionado pelo usuário. O scanner usa somente **D** para avançar, sem cliques, rolagens, equipar ou navegar por menus. Um contorno de seleção único, avanço coerente e painel estável são necessários antes de registrar a posição seguinte. Painéis iguais com seleções diferentes continuam sendo cópias observadas distintas.
- Parada útil: primeiro nível confiável **abaixo de 20**, com Lv decrescente declarado, rótulo de ordenação conferido e nenhuma contradição/nível pendente anterior. Ao contrário do ZZZ, o primeiro nível baixo é lido no painel depois de avançar até ele.
- Saída: `.cache/hsr/runs/<sessão>/summary.md`, `review.html`, `session.json`, `console.log`, `exit-code.txt`. Os botões do app abrem somente a tentativa que ele iniciou; o JSON é lido depois do processo sair. Nada é aplicado ao Advisor.

## Entrada de desenvolvimento

Use o `gacha-ocr-zzz.exe` da **raiz do repositório**, que chama o CMD/janela atuais. O nome do executável ainda é o da primeira entrega ZZZ; a seleção de jogo escolhe o executor. Os pacotes ZZZ já validados permanecem preservados e não adquirem HSR por alterar os fontes do repositório.

Selecione **HSR — Cones de Luz 20+ (validação)**, leia as instruções e confirme a preparação. Após o piloto validado por Cristian, a janela libera o percurso até o primeiro nível abaixo de 20, mantendo o limite de segurança de 2000 posições/uma hora e o contador como limite adicional. Clique **Iniciar coleta**; quando o andamento pedir, volte ao HSR e pressione/solte **F8** uma vez. Aguarde cinco segundos com HSR na frente e os controles livres. D é enviado pelo programa; não pressione D manualmente. F8 interrompe; Interromper/X solicitam parada cooperativa e aguardam o processo, preservando parcial. Perda de foco/janela/processo/geometria/DPI também para novos inputs.

**Quando reabrir:** alterações no formulário PowerShell exigem fechar a janela ociosa e abrir novamente `D:\Repo\gacha-ocr-lab\gacha-ocr-zzz.exe`; o executável chama o CMD atual e não precisa ser reconstruído para isso. Se aparecer “Piloto 3 Cones”, a janela ainda é antiga. Cada nova coleta no repositório carrega o Python atual; alterações somente nesse leitor não exigem reabrir uma janela ociosa. Num pacote portátil, use sempre a pasta completa da montagem indicada no teste: alterações do repositório não atualizam o worker congelado. Feche a janela antiga e abra o `.exe` da nova pasta.

**Candidato para o percurso ampliado (04/11):** `D:\Repo\gacha-ocr-lab\.cache\hsr-ready-20261104\gacha-ocr-zzz\gacha-ocr-zzz.exe`, build `20261104-115200-d27a0d9d`. Feche a janela anterior e abra essa entrada. A montagem já passou por checagem offline/relocação; a próxima coleta confere pacote e percurso juntos. Seus resultados ficarão em `.cache\hsr\runs` dentro dessa nova pasta. Não use um portátil ZZZ antigo para este teste.

Para a primeira validação real, acompanhar a própria pasta pelo log. Falha de preparação/seleção deve produzir relatório parcial e captura de diagnóstico quando disponível; conferir esses arquivos antes de pedir nova tentativa. Não há pedido de captura ou teste HSR encerrado anteriormente a repetir.

## Limites do primeiro percurso

- O contador é lido por dois tratamentos, preservando bruto. Serve como limite adicional; **atingi-lo não comprova fundo físico**. Nesse caso, os dados ficam salvos com `prepared-count-reached-physical-end-unverified`, parcial. O limite absoluto é 2000 posições/uma hora. Um avanço sem confirmação encerra sem tentar mais teclas.
- A direção da ordenação é declaração humana; o rótulo Lv é conferido por OCR e os níveis observados não podem subir. Um nível ilegível continua pendente; nunca vira 1 e não autoriza corte. Nome/sobreposição ilegíveis também não recebem defaults ou candidatos aceitos silenciosamente.
- A leitura literal usa concordância de dois limiares fixos, não probabilidade calibrada ou precisão garantida. Nenhum catálogo de nomes é consultado; a confirmação de “Demara” no ZZZ não muda leitores nem aprova outras sessões.
- A validade do nome/nível/sobreposição exige a frase branca fixa de restrição de Caminho no painel; o texto dourado do Caminho é separado pela cor, sem inferir seu valor. A aquisição inicial requer primeira seleção na região superior esquerda; seleção ambígua, painel incorreto ou tamanho não suportado falham antes de avançar.
- O piloto real de 04/11 confirmou foco/geometria, preparação Lv e três seleções/dois D. Parou na âncora do terceiro painel; após os ajustes, o replay das três imagens reconheceu nome/80/80/sobreposição (5, 1, 5). Cristian confirmou esses três campos nas três posições em revisão separada. O replay não reescreve o original nem equivale a nova captura. Troca de linha, deslocamento da lista e corte foram simulados em 41 posições; ainda requerem a execução ampliada no jogo. Duas imagens históricas de desenvolvimento 16:10 também reproduziram os três campos; isso não mede precisão independente. [Evidências](hsr-evidence.md).

## Reaproveitamento e referência

`scan_runtime.py` extrai do executor ZZZ os guardas públicos, F8, parada por arquivo, integridade e escrita atômica, mantendo os imports antigos compatíveis. HSR usa o mesmo OCR C API por `read_text`/`read_line`/`read_word`; não presume que a classe implemente todo protocolo do Youkai. Captura HSR vincula cliente/PID/geometria e exige foco; a seleção/percurso são específicos. O caminho de captura/OCR/fila ZZZ permanece com seu módulo, sem modernização ou reabertura de performance.

Fontes conferidas: [regiões 16:9](https://github.com/kel-z/HSR-Scanner/blob/cad008e2509b6b086fd892b140c8b277424fcb03/src/config/screenshot.py), [percurso/tecla D](https://github.com/kel-z/HSR-Scanner/blob/cad008e2509b6b086fd892b140c8b277424fcb03/src/services/scanner/scanner.py) e [filtros/ordenação](https://github.com/kel-z/HSR-Scanner/blob/cad008e2509b6b086fd892b140c8b277424fcb03/src/services/scanner/parsers/light_cone_strategy.py), revisão fixa `cad008e2509b6b086fd892b140c8b277424fcb03`, GPL-3.0. README e arquivos de referência, licença e hashes permanecem no cache `.cache/hsr-reference/<sha>/`. O upstream escolhe Lv para filtro de nível e avança por D; seus defaults para falhas de nível/sobreposição e normalização aproximada de nomes não foram reaproveitados. PyQt, pyautogui e vgamepad do aplicativo de referência não são dependências novas.

O build existente inclui os módulos HSR e a licença de referência. O worker conserva a entrada ZZZ e despacha `--hsr` para `hsr_scan.py`. Um novo portátil só deve ser indicado para uso depois de self-check/relocação; não trocar fontes ao lado de um worker congelado antigo supondo atualizar o código interno.
