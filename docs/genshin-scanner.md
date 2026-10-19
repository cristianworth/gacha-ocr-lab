# Scanner Genshin — M3 experimental

A implementação está disponível para teste; **o aceite M3.9 está pendente**. A captura cliente real feita por Cristian em 18/10 foi conferida, incluindo grade, painel e OCR da Aqua salva. Piloto com seleção, rolagem, paradas e varreduras completas ainda aguardam validação no jogo; simulações e OCR de imagens salvas não substituem esse aceite.

## Preparação

- Windows com Node.js 22+, PowerShell do Windows e dependências do projeto instaladas. O helper C# compila em memória; o lançador opcional gacha-ocr-lab.exe apenas abre um menu para os scripts. Não há serviço, API ou dependência npm nova.
- Genshin em inglês, controle por mouse/teclado, **área cliente exatamente 1440×900**, preferencialmente em janela para o primeiro teste. Bordas não contam nessa medida. Não redimensionar um PNG para contornar erro de dimensão.
- Inventário aberto na aba **Weapons**, ordenação **Quality decrescente**, início da lista e sem filtros que escondam armas 4★/5★. Não alterar o inventário durante a sessão.
- Para scans com cliques/rolagem, o terminal deve ter integridade compatível com o jogo. Se o Genshin estiver elevado, abra Git Bash ou PowerShell como Administrador, ou execute ambos no mesmo nível. O preflight consulta esses níveis antes da ativação e salva config.inputAccess; captura isolada não exige esse acesso de input. A CLI não se eleva automaticamente; o lançador opcional exige Administrador ao abrir, por manifesto do Windows.
- Jogo em primeiro plano e controles exclusivos. A automação seleciona posições da grade e usa a roda do mouse; não abre o jogo nem navega a partir de qualquer tela.
- Modelo inglês disponível em `.cache/models/`. No primeiro scan, `--download-model` permite baixá-lo antes de ativar o jogo; capturas não são enviadas a um serviço. A captura diagnóstica não requer OCR/modelo.

## Testar em ordem

Alternativa aos comandos: abra gacha-ocr-lab.exe na raiz do projeto e aceite o UAC. Escolha 1 para captura, depois 2 para piloto e, somente após conferir, 3 para coleta completa. O menu preserva as mensagens e retorna após cada execução. Feche com 0; durante a coleta, use F8 ou Ctrl+C para permitir o salvamento parcial. Não feche a janela à força.

Execute a partir de `D:\Repo\gacha-ocr-lab`. O atraso de cinco segundos permite preparar a janela; depois o programa tenta ativar apenas o processo Genshin anexado.

Pode executar no Git Bash com npm.cmd; o programa inicia seu próprio helper PowerShell. Durante a contagem, clique no jogo para deixá-lo em foco e depois mantenha os controles livres. Minimize janelas flutuantes e overlays sobre a área do jogo, inclusive ChatGPT, antes do teste. Estar em foco não garante ausência de sobreposição.

Se a proteção bloquear uma janela sobreposta, o erro informa aplicativo/PID, classe e retângulo, sem incluir título ou conteúdo da janela. Remova a sobreposição e repita somente a captura. O retângulo de um overlay pode incluir regiões transparentes; não é prova de que todo ele cobre pixels. A proteção permanece conservadora e não possui bypass. Esse bloqueio não pede elevação de administrador; permissões de input, se houver falha nessa etapa futura, são um diagnóstico separado.


```powershell
# 1. Somente captura e diagnóstico: sem cliques ou rolagem.
npm.cmd run capture -- --delay 5

# 2. Depois de conferir a prévia, piloto de até 10 posições, sem rolagem.
npm.cmd run scan -- --limit 10 --delay 5

# 3. Depois de conferir o piloto, percurso completo do escopo 4★/5★.
npm.cmd run scan -- --full --delay 5
```

**F8: mantenha pressionado até a interrupção.** Perda de foco, minimização, mudança de posição/tamanho, saída do jogo ou oclusão detectada interrompem novos inputs. Ctrl+C no terminal cancela com salvamento parcial. Uma sessão interrompida exige reinício explícito; não há retomada automática de navegação.

A captura imprime caminhos de `preview.png`, `inventory.json` e `review.html`. Confira se o painel direito e os cartões estão dentro das caixas. Se o diagnóstico falhar, abra a captura inicial no relatório; não avance aos cliques antes de conferir. Se houver várias janelas candidatas, use `--pid` com o processo desejado. Uma dimensão incompatível é recusada.

Cada scan imprime o progresso e termina mostrando os caminhos da sessão. Abra **`review.html`** no navegador: há resumo, índice de pendências OCR, imagens e evidências recolhíveis. O piloto é parcial por definição quando para no limite/página; saída 0 significa arquivos salvos, não inventário completo nem dados aprovados.

## Cobertura, leitura e revisão

- `items` contém observações classificadas como 4★/5★, inclusive as que falharam no OCR. Cópias com nome/nível/refinamento iguais continuam distintas. IDs identificam observações daquela sessão, não identidades persistentes de armas entre execuções.
- `observations` também preserva exclusões, raridade incerta e falhas. Um item incerto não desaparece. O primeiro item inferior a 4★ encerra o percurso ordenado somente depois de haver itens elegíveis; uma lista que começa com raridade baixa não é presumida vazia de 4★/5★.
- `captureComplete` indica início/término do percurso estabelecidos. `coverage.status` só fica `verified` quando também não há elegibilidade incerta e a contagem incluída coincide com **uma contagem independente informada** por `--expected-count N`. O contador geral `Weapons N/2000` inclui outras raridades e não deve ser copiado como total 4★/5★.
- Sem contagem independente, a coleta pode terminar com cobertura `unconfirmed`. O total geral é usado apenas como evidência de término se todas aquelas posições foram visitadas; duas leituras fixas precisam concordar para usá-lo. Isso não aprova campos.
- Se a barra não permitir confirmar o topo, `--at-top` registra uma declaração explícita do usuário. Essa declaração não substitui evidência reconhecida de que a barra está fora do topo. Ordenação decrescente e ausência de filtros ocultando itens continuam sendo preparação do usuário; o OCR verifica os rótulos Weapons/Quality, não prova todos os estados da interface.

O percurso exige correspondência única de pelo menos duas linhas na rolagem. Linhas cortadas não recebem cliques. Ambiguidade, grade alterada, ausência de progresso ou limites de execução geram sessão parcial, sem forçar contagem ou fundir cópias.

## Corrigir ou confirmar localmente

O relatório e os diagnósticos originais permanecem pendentes/imutáveis. A decisão humana é salva separadamente em `data/feedback/<sessão>/reviews/`, com hashes. Nenhum dado atualiza o Advisor.

```powershell
# Informe o UUID da observação mostrado no relatório e os três valores conferidos:
npm.cmd run review:scan -- "data\sessions\SESSAO\inventory.json" --item ITEM --name "Nome conferido" --level 90/90 --refinement 1 --reviewer "Cristian"

# Se a raridade estiver incerta ou precisar de correção, inclua --rarity 1–5:
npm.cmd run review:scan -- "data\sessions\SESSAO\inventory.json" --item ITEM --rarity 4 --name "Nome conferido" --level 80/90 --refinement 3 --reviewer "Cristian"

# Somente após conferir todo o inventário e sem pendências:
npm.cmd run review:scan -- "data\sessions\SESSAO\inventory.json" --confirm-all --reviewer "Cristian"
```

Substitua `SESSAO`/`ITEM` pelos identificadores reais. `--rarity` registra também se a observação pertence ao escopo, sem alterar sua classificação bruta. Confirmação total recusa captura/processamento incompletos, cobertura não verificada, raridade incerta, falhas ou campos não reconhecidos. Os bytes da captura e o diagnóstico vinculado são conferidos antes de registrar revisão.

## Reprocessar sem repetir inputs

```powershell
npm.cmd run process:scan -- "data\sessions\SESSAO\inventory.json"
```

Reutiliza as capturas, verifica seus hashes, usa o painel registrado e salva resultados novos com histórico dos diagnósticos anteriores. Mantém cobertura, motivo de término e completude da captura; revisão fica pendente. Não reclassifica raridade automaticamente nem retoma navegação. Arquivos alterados/fora da sessão são recusados. `--download-model` é opcional também aqui.

Para inspecionar um arquivo que já seja uma imagem cliente válida, sem abrir backend Windows:

```powershell
npm.cmd run scan -- --image "C:\caminho\cliente-1440x900.png"
```

## Decisões e limitações conhecidas

- JavaScript coordena OCR, percurso e arquivos. Um helper PowerShell/C# usa Win32/GDI para janela, captura e input; JSON-lines serializado e timeouts separam esse processo. Escolhemos recursos já presentes no Windows em vez de adicionar uma biblioteca nativa npm/instalador.
- O helper restringe o alvo a GenshinImpact/YuanShen, mede a área cliente, verifica foco/geometria/oclusão e monitora F8 em intervalos nominais de 50 ms. `SendInput` é global: checagens reduzem, mas não tornam atômica uma troca externa de foco. Por isso o uso exclusivo é parte do contrato. Oclusão por retângulos Win32 pode ser conservadora e não comprova ausência de overlays injetados; jogo/elevação podem recusar inputs. Não há fallback silencioso ou elevação automática.
- O perfil mede cartões por faixas de nível/arestas e conta componentes alinhados de estrelas. Exige ao menos duas linhas completas; layouts pequenos, alterações de interface, HDR/escala e imagens parcialmente cobertas podem ser recusados. Nome/hash do cartão não serve como identidade de cópia.
- Seleção requer contorno verificável nos quatro lados por contraste local ou brilho, com amostragem fora do retrato equipado, arte compatível com a grade-base e duas observações consecutivas selecionadas com recortes estáveis. Retries, páginas, posições e OCR têm limites. Uma sessão OCR é reutilizada, sem paralelismo de inputs.
- Dados ficam em `data/sessions/`, ignorados pelo Git; capturas por observação ocupam disco. Não há limpeza automática das evidências. Captura pode conter UID; ela permanece local e não acompanha o repositório.

Referências técnicas: [SendInput](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-sendinput), [GetAsyncKeyState](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getasynckeystate), e o [estudo do Inventory Kamera](inventory-kamera.md). O código do scanner de referência não foi incorporado.

## Validação e aceite pendente

**131 testes automatizados**: contratos antigos, imagem/grade/raridade sintéticas, sessão, CLI, reprocessamento, revisões, cancelamento e percurso simulado. O helper real foi compilado; protocolo, enumeração com processo inexistente e recusa de attach sem alvo foram verificados. Isso não testa aceitação de input pelo jogo.

Na imagem legada recortada de forma declaradamente aproximada: grade de 40 posições, seleção Aqua e raridade 5; três cartões locais retornaram raridade 4. A preparação e os três campos da Aqua tiveram OCR real correto; uma reprodução estática de uma observação integrou visão/OCR/sessão sem backend nativo. Esse recorte mantém problemas de borda e não é prova de captura cliente correta. Raridades 1–3, barra no meio/fim e rolagem têm cobertura sintética. Regressão: 13 exemplos Genshin e 4 HSR mantiveram estados/valores; não são avaliações independentes novas.

Para fechar M3.9: conferir captura real, piloto e duas varreduras completas do mesmo inventário 4★/5★ sem alterações entre elas; comparar contagens/cópias/primeiro/último/transições, resolver discrepâncias e testar F8/perda de foco. Não considerar M3 aceito só porque a suíte passa. Evidências locais desta entrega: `data/research/m3-inspection/`.
## Localização da janela: correção de 18/10/2026

O primeiro teste do usuário revelou timeout em attach. A enumeração original consultava metadados de processo para cada HWND; a reprodução local com allowlist inexistente levou cerca de 13 s, além do limite de 10 s. Agora os PIDs permitidos são resolvidos uma vez por enumeração, mantendo o limite e as guardas de alvo.

Na mesma investigação, HasExited do .NET Framework retornou acesso negado ao consultar o processo Genshin. A identidade passou a usar caminho do executável e horário de criação com PROCESS_QUERY_LIMITED_INFORMATION, mantendo a allowlist e a detecção de reutilização do PID. Não há elevação automática. Referências: [GetProcessTimes](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-getprocesstimes) e [direitos de processo](https://learn.microsoft.com/en-us/windows/win32/procthread/process-security-and-access-rights).

A seleção também ignora janelas ocultas ou sem área cliente: duas janelas auxiliares IME do mesmo PID eram contadas como candidatas. Múltiplas janelas utilizáveis continuam sendo recusadas. Após as correções, attach/status na janela real confirmou 1440×900 em aproximadamente 100 ms, sem ativar, armar, capturar ou enviar inputs. Isso valida a localização; captura/piloto/varreduras e aceite M3.9 permanecem pendentes. Evidências locais: data/research/attach-debug/.

## Captura real e detecção de topo — 18/10/2026

A captura automática de 1440×900 preservou a área cliente, com 40 cartões completos em oito colunas, linha inferior parcial e painel direito alinhados na prévia. O OCR do arquivo salvo leu Aqua Simulacra, 90/90 e R1; a mesma arma já tinha referência humana anterior. Isso é conferência do caminho de captura/leitura, não nova avaliação independente.

O piloto foi interrompido antes dos cliques porque parte do trilho escuro da barra tinha contraste inferior ao limiar do detector. O detector agora verifica esse trilho de baixo contraste a partir da área útil da barra, excluindo o marcador acima dela. As duas imagens reais salvas e a aproximação legada retornaram topo reconhecido; testes sintéticos cobrem trilho fraco no topo/meio e continuam recusando indicador sem trilho. As sessões antigas permanecem intactas.

Novas sessões preservam initialInspection com barra/geometria e quantidades de linhas, inclusive quando a confirmação do topo falha. O erro de evidência incerta orienta conferir a imagem em vez de presumir que a lista está rolada. O comando --at-top continua sendo uma declaração humana opcional, sem sobrepor evidência de barra fora do topo.

No teste inicial, a seleção brilhante não passou o limiar nas duas imagens isoladas; a correção e os replays abaixo tratam esse caso. O sucesso do piloto com inputs reais permanece pendente. Evidências locais: data/research/scrollbar-debug/. Uma captura diagnóstica bem-sucedida termina com captureComplete=false porque esse campo se refere ao percurso do inventário.

## Seleção e testes antes de nova execução

O timeout seguinte mostrou que uma borda translúcida e o retrato sobreposto não eram bem representados pelo teste de branco quase puro. A verificação agora aceita um contorno com contraste local e examina trechos fora do retrato, mantendo a exigência dos quatro lados. Borda incompleta, faixa clara de nível, cartão vizinho e cópia sem seleção continuam recusados. Quadros muito apagados permanecem incertos; duas capturas consecutivas precisam confirmar seleção e estabilidade.

A suíte chegou a 131 testes, incluindo um piloto de dez posições com visão real sobre imagens sintéticas, transição sem borda, painel ainda mudando, raridades 4/5, cópias com valores iguais e nenhum scroll. Esse teste automatizado simula OCR e input; não mede reconhecimento do jogo.

Também executamos offline o fluxo com os quadros reais salvos e OCR real: preparação, seleção, estabilidade e Aqua 90/90 R1 passaram. Um segundo replay usou grade sintética e dez cartões reais conhecidos, redimensionados para composição, com OCR real: dez observações distintas, inclusive duas Aquas iguais; 25 campos reconhecidos coincidiram com as referências e cinco ficaram incertos com o candidato correto preservado. Nenhum valor incorreto aceito foi observado nesse replay. A composição alterou o comportamento de alguns campos, portanto não é avaliação independente nem precisão geral, e o OCR não foi ajustado para forçar concordância.

Falhas de seleção agora preservam métricas por tentativa, alvo e até oito quadros com hashes; o review.html dá acesso a essa sequência. Sucesso guarda a evidência de seleção/estabilidade na observação e remove os intermediários. Interrupção antes de qualquer observação não aparece como processamento completo. Evidências locais: data/research/selection-debug/; os dois replays e seus dados não usam backend Windows nem demonstram que o jogo aceitou cliques/rolagem.

O próximo teste no jogo continua sendo somente o piloto de dez posições. Se falhar, uma sessão terá a sequência necessária para distinguir borda apagada, painel instável, alteração da grade e interrupção, evitando depender de uma única imagem final.

## Piloto real: bloqueio de inputs por integridade

A sessão seguinte reconheceu a Aqua (90/90, R1, 5★) na primeira posição, mas a segunda nunca ficou selecionada: a sequência preservada continuou mostrando a primeira arma e o mesmo painel. O scanner recusou reaproveitar essa leitura para a segunda posição. Processamento completo dos itens capturados não significa percurso completo.

A consulta somente de leitura confirmou Git Bash/helper em integridade média (8192) e Genshin em alta (12288), com botões do mouse não invertidos. A restrição UIPI do [SendInput](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-sendinput) limita o envio para processos de nível superior. Nenhum input foi executado pelo assistente nessa investigação.

O scan agora verifica essa compatibilidade antes de ativar/armar a janela e registra os níveis na sessão. Incompatibilidade retorna input-integrity-mismatch com instrução de execução, sem elevar o processo. O helper também verifica o acesso antes de cada clique/rolagem. Captura isolada continua sem essa exigência. Dois testes novos verificam a recusa antes de ativação/input e a independência do modo de captura.

Para repetir o piloto: abra o terminal como Administrador se mantiver o jogo elevado, entre na pasta do laboratório e execute o mesmo comando de dez posições. A troca de shell não muda o nível de integridade por si só. Sucesso dos cliques e rolagem ainda requer validação no jogo; o aceite M3.9 permanece aberto. Evidência local: data/research/input-access-debug/.
