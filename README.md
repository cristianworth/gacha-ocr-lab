# gacha-ocr-lab

Scanner local de equipamentos para poupar a digitação de dados úteis ao Advisor. O caminho atual é **ZZZ: W-Engines S/A nível 20+**, em Windows, inglês, área cliente 1280×720 e escala 100%. O OCR é local, sem API paga.

## Coletar no ZZZ

1. Prepare W-Engine Storage com **S e A**, B/especialidades desmarcados, **Level do maior para o menor**, filtro fechado e lista no topo. Solte os controles e espere parar; não precisa selecionar um item.
2. Abrir **`scan-zzz.cmd`** na raiz do projeto e aceitar o aviso de Administrador. Confirmar a preparação com **Enter** no console; **0 cancela**.
3. Quando o console pedir, voltar ao jogo e pressionar/soltar **F8 uma vez**. Manter o jogo na frente e os controles livres. F8 interrompe; F9 não é usado.
4. Aguardar o término. O resumo da própria sessão abre no **Bloco de Notas**, inclusive em resultado parcial.

Na raiz do repositório, o ambiente Python/OCR precisa estar preparado no cache do laboratório. A distribuição em pasta inclui essas dependências: extraia o ZIP completo e use o `scan-zzz.cmd` de dentro dele. Montagem, verificação e limites do protótipo local estão no [guia portátil](docs/zzz-portable.md); preparação e diagnósticos da coleta estão no [guia ZZZ](docs/zzz-scan.md). Não é necessário instalar Node.js para esse caminho.

## Resultado e revisão

A pasta da sessão, impressa no console, contém `summary.md` (elegíveis e pendências), `review.html` (imagens/diagnóstico) e `session.json` (registro original). O total da lista é separado dos itens observados e dos restantes não lidos por ordenação. Nível ilegível não dispara parada; nomes incertos continuam visíveis. Cópias já observadas são preservadas sem reconciliação entre sessões.

O caminho curto foi conferido no jogo em 29/10: **34 elegíveis, 35 posições observadas, 34 cliques e uma roda**, com os mesmos cinco campos da coleta completa anterior. Cristian confirmou três nomes em revisão separada, sem aprovar automaticamente os demais campos. Não é necessário repetir essa coleta por rotina. Evidências e limites: [registro técnico](docs/zzz-evidence.md).

Nada é aplicado automaticamente ao Advisor. Uma coleta filtrada não remove dados existentes. Imagens, resultados, dependências em cache e modelos não acompanham o clone nem devem entrar no Git.

## Organização

| Documento | Finalidade |
|---|---|
| [AGENTS.md](AGENTS.md) | Regras estáveis para trabalhar no laboratório |
| [Guia ZZZ](docs/zzz-scan.md) | Preparação, execução, saídas, falhas e contratos atuais |
| [Pacote portátil](docs/zzz-portable.md) | Build local, runtime incluído, uso e limites de distribuição |
| [Plano de velocidade](docs/zzz-performance-plan.md) | Próxima melhoria: medir etapas e reduzir custo comprovado preservando evidências/guardas |
| [Plano da interface](docs/desktop-ui-plan.md) | Janela simples para ZZZ antes do HSR, execução e cancelamento sem operar o prompt |
| [ROADMAP](docs/ROADMAP.md) | Estado e próximo recorte, em uma única fonte |
| [Evidências ZZZ](docs/zzz-evidence.md) | Sessões, correções e diagnósticos históricos |
| [Pesquisa de uso](docs/zzz-workflow-research.md) | Objetivo, fontes e decisões que simplificaram a coleta |
| [Arquitetura pesquisada](docs/architecture-proposal.md) | Referências e direção multijogo, sem framework pronto |

## Experimentos preservados

Os leitores JavaScript de uma imagem Genshin/HSR e o scanner Genshin experimental continuam disponíveis, mas não são a entrada ZZZ. Comandos, dependências Node.js, formatos e limites daquele ciclo estão em [leitores e scanner legado](docs/legacy-ocr.md). O executável `gacha-ocr-lab.exe` existente pertence ao lançador Genshin legado; não confundir com distribuição ZZZ independente.

A ordem atual é consolidar ZZZ → melhorar velocidade → interface simples → HSR 20+ → Genshin/WuWa/NTE, um recorte útil por vez. A melhoria de velocidade foi conferida no jogo em 02/11: aquisição e processamento dos mesmos 34 itens passaram de 83,63 para 43,78 s, com valores/estados dos cinco campos preservados. São duas execuções locais, sem garantia de tempo geral. A extensão com gravação em segundo plano e verificações agendadas também foi conferida no jogo: mais 22,2% de redução no trecho ativo (43,78 → 34,04 s), campos preservados e mais imagens intermediárias. Depois vem a interface simples, ainda planejada. Não há motor multijogo extraído nem sincronização automática com Advisor. Repositório: [cristianworth/gacha-ocr-lab](https://github.com/cristianworth/gacha-ocr-lab).
