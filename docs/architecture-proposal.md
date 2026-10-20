# Proposta de arquitetura e retomada do scanner

Pesquisa em 19–20/10/2026. **Arquitetura recomendada, ainda não implementada.** A sequência e o detalhamento de execução são mantidos somente no [planejamento canônico](ROADMAP.md).

## Objetivo e escopo confirmado

Construir um aplicativo Windows com **um motor de scanner compartilhado** para armas e equivalentes de Genshin, HSR, WuWa, ZZZ e NTE. Cada jogo acrescenta seu perfil visual, interpretação e estratégia de navegação. A expansão futura para personagens ou outros itens deverá aproveitar o mesmo motor.

Windows exclusivo, inglês, um aplicativo de entrada, ajustes de resolução por jogo e aceitação de licença de software livre compatível foram confirmados por Cristian. Ordem recomendada: ZZZ, HSR, Genshin, WuWa e NTE. Cristian confirmou W-Engines S/A em ZZZ, janela 16:9 e escala Windows 100%. Genshin mantém 4/5 estrelas; não é um filtro universal para os cinco jogos.

## Decisão proposta

**Python como linguagem principal, um único motor e módulos pequenos por jogo.** Aproveitar código existente de captura, coordenadas e reconhecimento, usando como primeira candidata a organização dos módulos do [Youkai](https://github.com/AJTDaedalus/youkai). Aproveitar do Inventory Kamera os recortes, parâmetros e procedimentos comprováveis para Genshin. Os demais scanners fornecem implementações e referências para as particularidades de cada jogo.

Isso substitui a proposta anterior de Python coordenando cinco coletores completos, incluindo um coletor C# permanente para Genshin. O produto terá captura, input, execução do OCR, controle de sessão, cancelamento e revisão compartilhados. Não manter cinco ciclos de coleta copiados.

A escolha não decorre de uma precisão inerente da linguagem: Python permite reaproveitar diretamente mais módulos dos candidatos consultados e dispõe das mesmas bibliotecas de visão usadas por eles. C# continua uma alternativa válida, mas padronizá-lo exigiria traduzir mais código existente. O Inventory Kamera é uma referência importante, sem obrigar a tecnologia dos cinco jogos.

## O que a leitura do código confirmou

| Fonte | Partes consultadas e contribuição possível | Limites observados |
|---|---|---|
| [Inventory Kamera](https://github.com/Andrewthe13th/Inventory_Kamera), C#, MIT | WeaponScraper, InventoryScraper, Navigation, manifesto e projeto. Recorte proporcional do painel, regiões de campos, enumeração e percurso de armas | .NET Framework 4.7.2, configurações/UI/fila estáticas e bibliotecas próprias. Não é um núcleo multijogo pronto. Seu recorte por proporções evita depender da cor do cenário. |
| [HSR-Scanner](https://github.com/kel-z/HSR-Scanner), Python, GPL-3.0 | Scanner, LightConeStrategy, Navigation, Screenshot, OCR e configuração de Cones de Luz | Inglês/16:9; mistura interface PyQt e categorias. Navegação e captura estão separadas do parser. Sobreposição ilegível pode virar 1: adaptar esse comportamento. |
| [WuWa Inventory Kamera](https://github.com/Psycho-Marcus/WuWa_Inventory_Kamera), Python, GPL-3.0 | weaponsScraper e dependências: existe código de armas, captura e recortes configuráveis; usa RapidOCR/ONNX | Fullscreen e resoluções documentadas específicas; 1440x900 não foi validado pelo projeto. Falha de contagem pode virar 24 itens/uma página, sem prova de cobertura. |
| [Youkai](https://github.com/AJTDaedalus/youkai), Python, MIT | capture, grid, recognize, wengine_scanner, CLI e dependências. Transformação cliente/tela, parâmetros de grade, captura injetável e interface de reconhecimento são pontos concretos de reutilização | Branch dev, catálogo indicado como ZZZ 1.4 e perfil 16:9. A grade ainda contém regiões, esperas e rolagem de ZZZ. Extrair os parâmetros não basta: separar seu comportamento específico. |
| [NTE Drive Calculator](https://github.com/hxwd94666/NTE-Drive-Calculator), Python, AGPL-3.0 | README, árvore e configuração de regiões: referência para aquisição/visão de equipamentos | Chinês e categorias drives/cassettes nas rotas consultadas. Não confirmei coleta de armas do nosso escopo em inglês. Não incorporar como módulo de armas pronto. |

Commits consultados via API pública do GitHub:

- Inventory Kamera: 01e08c0527149ef40083608f50f16a2963293285.
- HSR-Scanner: cad008e2509b6b086fd892b140c8b277424fcb03.
- WuWa Inventory Kamera: 7b5ecf4eca355d3f4a06fb0d65e8419d1f984883.
- Youkai: 86a8b34511c86ec864d8f40c558789f7ccad4cc9.
- NTE Drive Calculator: 0e7a6b4e8e61d7a288e520bbc192a411d68c2fb1.

A leitura foi de fontes e configurações; esses candidatos não foram executados nesta pesquisa. O fork Kamera guardado no cache anteriormente tem outra origem/SHA; não afirmar correspondência entre ele, o upstream e o binário pessoal sem verificar.

Também foram considerados [YAS](https://github.com/wormtql/yas), Rust/multijogo, que documenta chinês e foco em artefatos, e [ZZZ Scanner Next](https://github.com/ZztIsolation/ZZZ-Scanner.Next), C#/.NET, que documenta Drive Discs em chinês. Não são encaixes imediatos para armas em inglês nos cinco jogos.

## Arquitetura proposta

~~~text
Aplicativo / comando único
         |
Motor compartilhado
  janela e coordenadas -> input -> espera limitada -> captura
  -> regiões -> OCR -> interpretação -> evidências e sessão -> revisão
         |
Módulo do jogo
  perfil visual + estratégia de percurso + regras de campos/categoria
~~~

### Responsabilidades do motor

- Localizar a janela pelo alvo configurado, medir área cliente e converter coordenadas para a tela.
- Executar cliques/teclas/rolagem, esperas e tentativas limitadas, com parada e verificação de foco.
- Capturar e recortar imagens, executar tratamentos e chamar o OCR.
- Coordenar a sequência selecionar, aguardar, capturar, interpretar e salvar, sem duplicá-la por jogo.
- Preservar imagens/texto/candidatos, registrar falhas e manter sessão/relatório/revisão.
- Distinguir percurso terminado, cobertura conferida, processamento OCR e aprovação humana.

### Responsabilidades dos módulos

- Perfil: processo/janela, idioma, proporção/resolução de referência, regiões, grade e campos esperados.
- Percurso: como selecionar o próximo item, avançar a lista e confirmar progresso/fim.
- Interpretação: nome, nível e progressão da categoria, raridade e catálogo daquele jogo.
- Verificações visuais específicas para seleção/painel pronto e estado inicial.

Dados simples ficam no perfil; comportamento fica em funções pequenas. Não criar uma linguagem de scripts em JSON/YAML nem um framework de plugins. Um método de percurso pode ser compartilhado por vários módulos; só criar outro quando a interação realmente diferir.

O HSR pode usar avanço por tecla, enquanto outros inventários exigem grade/rolagem. O núcleo continuará emitindo ações e processando capturas da mesma maneira. Ter o mesmo motor reduz o trabalho, mas não torna layouts, fim de lista e evidências de seleção automaticamente equivalentes.

### Limites importantes do reaproveitamento

O GridNavigator do Youkai recebe função de captura, calibração, parâmetros e cancelamento, mas ainda usa rolagem ao clicar na linha inferior, regiões de renderização e barra próprias de ZZZ. Sua calibração também rejeita proporções diferentes de 16:9. Esses detalhes devem sair do núcleo para o módulo, com perfis distintos para Genshin 16:10 e HSR 16:9; não esticar uma imagem para simular outra proporção.

Seu tratamento de painel repetido parte de uma hipótese específica sobre cópias visuais. No laboratório, duas armas podem ter os mesmos atributos e imagem: igualdade de painel não pode determinar identidade nem justificar descartar uma cópia. A política de confirmação deverá ser compatível com esse requisito.

Portanto, aproveitar módulos não significa declarar que eles já são genéricos ou copiar suas suposições. A primeira prova precisa executar o caminho original e medir o reaproveitamento real, evitando usar referências apenas como inspiração. A adaptação inicial entrega um piloto ZZZ; as fronteiras definitivas de núcleo/perfil/percurso são extraídas e verificadas com HSR, após ZZZ funcional.

## Comparação das rotas

| Rota | Vantagem | Custo | Decisão |
|---|---|---|---|
| Continuar JavaScript + helper PowerShell | Preserva o experimento atual | Pouco reaproveitamento direto das bases consultadas; fronteira nativa adicional | Substituir depois da prova e do aceite novos. |
| Um motor C#/.NET | Integração Windows e base Kamera | Tradução de mais módulos Python; seu código legado também exige separação | Alternativa válida, com menor reaproveitamento direto no conjunto pesquisado. |
| Um motor Python com módulos por jogo | Reutiliza captura/visão/OCR dos candidatos e concentra a evolução | Generalizar os pontos necessários e empacotar dependências nativas | **Recomendado.** |
| Python coordenando cinco programas | Reaproveita mais executáveis inteiros inicialmente | Duplica motores, políticas e manutenção; não atende ao núcleo comum desejado | Não é a arquitetura-alvo. |

Um host C# moderno poderia usar [.NET 10 LTS](https://learn.microsoft.com/en-us/dotnet/core/releases-and-support). A facilidade de gerar um exe não é o fator decisivo: Python também pode ser distribuído com seu interpretador e bibliotecas. A proposta prioriza reaproveitamento do motor e manutenção dos módulos.

## Tecnologias e distribuição

- Python como linguagem principal; primeira prova fixa versão de runtime compatível com os módulos/dependências selecionados, com linha 3.12 como candidata inicial.
- Pillow/NumPy/OpenCV para imagens e visão, aproveitando implementações existentes.
- Tesseract local como primeiro OCR, para comparar com referências ZZZ e as já disponíveis de Genshin/HSR. A interface permite outra implementação quando a medição justificar, sem duplicar o fluxo.
- Um executável de entrada em pacote de pasta, com dependências/modelos incluídos e solicitação UAC como no lançador atual. Não exige Node/Python de desenvolvimento no computador do usuário depois de validado o pacote.
- [PyInstaller em modo de pasta](https://pyinstaller.org/en/stable/operating-mode.html) como primeira opção de distribuição. A documentação recomenda validar esse modo antes de one-file e desaconselha um one-file elevado que extraia bibliotecas temporárias.
- Console/menu e revisão local inicialmente. Interface gráfica futura usa o mesmo motor.
- Sem backend, banco, MCP, serviço ou automação de combate. Advisor permanece separado.

Não forçar todos os jogos a um motor OCR nem incorporar todas as dependências dos aplicativos originais. Separar processamento da aquisição permite repetir OCR sobre arquivos salvos e testar módulos sem controlar o jogo.

## Plano de execução

O [ROADMAP.md](ROADMAP.md) contém os marcos P0–P9, os próximos subpassos ZZZ/HSR, as condições de aceite e a participação necessária de Cristian. P0 é o levantamento concluído; P1 reproduz o candidato, P2 entrega um piloto ZZZ com adaptação mínima, P3 aceita o inventário completo e P4 consolida o núcleo ao integrar HSR. Nenhum candidato passa a base aceita só por ter módulos, testes ou releases.

A revisão de 20/10 confirmou release v1.0.8, testes específicos e fixtures, mas também incompatibilidades de contrato: fallback de estrelas para 1, classificação interna 4=S/3=A/2=B, raridade não preservada no item exportado e possibilidade de pular célula parada. Essas políticas precisam ser adaptadas e testadas para o escopo S/A.

Não foi executado o scanner/testes do candidato. Dependências, runtime e catálogo devem ser fixados/conferidos durante P1. As condições documentadas do candidato e as referências públicas orientam a primeira prova; capturas atuais de Cristian confirmam compatibilidade.

## Qualidade, evidências e procedência

Preservar dados reconhecidos, incertos e ausentes. Não aceitar defaults silenciosos dos projetos-fonte, não transformar correspondência aproximada de catálogo em texto bruto e não tratar confiança OCR como garantia. Nenhuma falha pode desaparecer apenas porque não virou um item no JSON final.

Cada cópia observada tem registro próprio. Não usar igualdade de nome/atributos/imagem para fundir cópias. Não confundir quantidade do inventário inteiro com quantidade do filtro. Revisões humanas ficam separadas das evidências originais; nenhum snapshot do Advisor é atualizado automaticamente.

O código JS pode ser substituído. Devem ser preservados os casos confirmados, os diagnósticos, as incertezas conhecidas e o histórico. Testes simulados protegem contratos, mas não aceitam varreduras no jogo.

Cristian aceita licença compatível para priorizar reaproveitamento. Conferir licença efetiva de arquivos, dependências, modelos e catálogos antes de incorporar. Preservar avisos, SHA e alterações. Definir a licença do código próprio conforme o conjunto adotado; não aplicar uma nova licença nesta proposta. [A FAQ oficial GNU](https://www.gnu.org/licenses/gpl-faq.en.html#MereAggregation) não permite presumir que separar processos elimina obrigações.

## Estado da pesquisa

Verificado: documentação, commits e licenças declaradas dos candidatos; módulos de armas de quatro jogos; pontos de extensão e acoplamentos citados. A leitura adicional de captura/grade/OCR confirmou que o Youkai é uma candidata a fonte do núcleo, com trabalho explícito de separação.

Não verificado: execução comparativa dos scanners externos, build/empacotamento do novo motor, precisão dos cinco jogos ou funcionamento genérico dos módulos. Nenhum scanner externo foi executado e nenhum jogo foi controlado nesta pesquisa. A etapa atual alterou somente documentação de arquitetura, planejamento e contexto do experimento legado.

**Direção recomendada:** um motor Python compartilhado, com perfis, parsers e estratégias por jogo; reutilização seletiva; ZZZ completo primeiro e HSR como primeira prova de expansão. O plano permanece separado do software atualmente executável.
