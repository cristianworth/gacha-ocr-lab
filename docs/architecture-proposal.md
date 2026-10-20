# Proposta de arquitetura e retomada do scanner

Pesquisa: 19/10/2026. **Proposta para validação de Cristian; não autoriza nem registra uma migração já realizada.** O roadmap e o código atuais permanecem como estão até a aprovação desta direção.

## Objetivo e decisões de escopo

Entregar um aplicativo Windows para coletar armas e equivalentes de Genshin, HSR, WuWa, ZZZ e NTE, preservar evidências, apresentar pendências e exportar inventários revisáveis. Expansão para personagens e outros equipamentos continua futura. Genshin vem primeiro; HSR é o segundo jogo.

Cristian confirmou nesta revisão: Windows exclusivo, um aplicativo de entrada mesmo com componentes internos diferentes, possibilidade de ajustar resolução por jogo e aceitação de uma licença de software livre compatível quando necessária ao reaproveitamento. Inglês, processamento local e integração posterior e explícita com o Advisor permanecem requisitos. O escopo 4/5 estrelas está definido para Genshin; não deve ser aplicado automaticamente às categorias dos outros jogos.

## Recomendação

**Python para coordenação, sessões, interpretação/revisão e integrações; coleta Genshin reaproveitada em C# do Inventory Kamera.** Cada jogo tem um módulo ou executável de coleta próprio. Código novo tende a Python; não traduzir um coletor funcional só para uniformizar a linguagem.

Isso substitui a direção JavaScript + helper PowerShell como arquitetura do produto. O experimento atual permanece no histórico e pode servir como referência de regressão durante a transição. Imagens, referências confirmadas e requisitos de qualidade são mais valiosos que preservar seus módulos a qualquer custo.

Não recomendo um fork integral da interface e arquitetura Genshin do Kamera, nem uma reescrita dos cinco coletores em C#. A reutilização direta deve ser demonstrada por build e execução, não apenas pela semelhança dos algoritmos.

## Evidência encontrada

Os projetos abaixo foram consultados como fontes primárias. README, implementação e metadados não são validação na máquina de Cristian.

| Jogo | Candidato e evidência | Adequação e limite |
|---|---|---|
| Genshin | [Inventory Kamera](https://github.com/Andrewthe13th/Inventory_Kamera), C#, MIT. WeaponScraper, InventoryScraper, Navigation, manifesto e projeto foram inspecionados. | Já utilizado por Cristian; fluxo de armas é a primeira base. O projeto consultado usa .NET Framework 4.7.2 e depende de configurações, UI, fila e bibliotecas. Separar armas requer mais de um arquivo. Confirmar correspondência entre fonte e binário; o nome da pasta instalada não prova origem. |
| HSR | [HSR-Scanner](https://github.com/kel-z/HSR-Scanner), Python, GPL-3.0. Scanner, LightConeStrategy e OCR inspecionados. | Cones de Luz implementados, com filtros e diagnóstico. Documenta inglês e 16:9. É candidato, ainda não executado aqui. Possui acoplamento PyQt e fallback que transforma sobreposição ilegível em 1; isso precisa mudar no nosso caminho de dados. |
| WuWa | [WuWa Inventory Kamera](https://github.com/Psycho-Marcus/WuWa_Inventory_Kamera), Python, GPL-3.0. weaponsScraper e dependências inspecionados. | Existe implementação de armas, não apenas anúncio no README. Documenta fullscreen e resoluções específicas; 1440x900 não está entre as verificadas. Usa RapidOCR/ONNX. Falha de contagem pode virar 24 itens/uma página; não aceitar isso como prova de cobertura. |
| ZZZ | [Youkai](https://github.com/AJTDaedalus/youkai), Python, MIT. wengine_scanner, CLI e dependências inspecionados. | Implementa W-Engines e leitura de quadro estático. Documenta janela, 16:9 e escala Windows 100%. Base de dados indicada como ZZZ 1.4 e branch dev: atualizar/conferir catálogo e comportamento antes de adotá-lo. |
| NTE | [NTE Drive Calculator](https://github.com/hxwd94666/NTE-Drive-Calculator), Python, AGPL-3.0. README, árvore e configuração de regiões inspecionados. | As rotas consultadas tratam drives e cassettes; não confirmam coleta das armas do nosso escopo. Documenta chinês e driver de controle virtual. Referência para visão/captura; não contar como módulo de armas pronto nem incorporá-lo nesta primeira migração. |

SHAs consultados via API pública do GitHub, para repetir a análise:

- Inventory Kamera: 01e08c0527149ef40083608f50f16a2963293285.
- HSR-Scanner: cad008e2509b6b086fd892b140c8b277424fcb03.
- WuWa Inventory Kamera: 7b5ecf4eca355d3f4a06fb0d65e8419d1f984883.
- Youkai: 86a8b34511c86ec864d8f40c558789f7ccad4cc9.
- NTE Drive Calculator: 0e7a6b4e8e61d7a288e520bbc192a411d68c2fb1.

Isso não substitui fixar e verificar versões de dependências, modelos e catálogos na implementação. O estudo anterior usa um fork do Kamera guardado localmente; não presumir que o SHA desse fork é igual ao upstream acima.

Outras opções consultadas: [YAS](https://github.com/wormtql/yas) tem arquitetura multijogo em Rust, mas documenta chinês e foco em artefatos; [ZZZ Scanner Next](https://github.com/ZztIsolation/ZZZ-Scanner.Next) usa C#/.NET e OCR ONNX, mas seu escopo documentado é Drive Discs em chinês. Nenhum é uma base imediata dos cinco leitores de armas em inglês.

## Comparação das rotas

| Rota | Vantagem | Custo relevante | Escolha |
|---|---|---|---|
| Continuar JavaScript | Menor alteração no experimento atual | Pouco reaproveitamento direto dos coletores encontrados; continuamos construindo automação | Não priorizar. |
| Tudo em C#/.NET moderno | Integração Windows e distribuição nativa; boa opção para produto desktop | Traduzir motores Python ou mantê-los como processos, de qualquer forma. Não remove diferenças de layout ou OCR | Viável, mas sem benefício suficiente para impor a todos os jogos. |
| Python principal + coletor C# Genshin | Reaproveita a base já usada e permite adaptar diretamente três candidatos Python | Duas linguagens, empacotamento e controle explícito de processos | **Recomendado.** |
| Apenas um menu para abrir aplicativos externos | Menor trabalho inicial | Não entrega revisão, evidências, cancelamento e contratos consistentes | Pode ajudar a medir uma base, não é o produto final. |

Python não é escolhido por precisão inerente do OCR nem por desempenho presumido: a razão é concentrar código de integração na linguagem dos candidatos encontrados. C# e Python coexistiriam em ambas as alternativas de reaproveitamento amplo; a decisão é onde fica a maior parte do trabalho.

Se escolhêssemos um novo host C#, [a opção LTS atual seria .NET 10, com suporte até novembro de 2028](https://learn.microsoft.com/en-us/dotnet/core/releases-and-support). Não é necessário migrar o motor legado do Kamera ao mesmo tempo que o isolamos. Primeiro reproduzir o build original; modernizar só com evidência de benefício e regressão.

## Estrutura mínima do produto

~~~text
Aplicativo Windows: escolher jogo, iniciar, acompanhar e parar
    -> adaptador do jogo
        -> coletor existente adaptado (C# ou Python)
        -> capturas, OCR bruto, candidatos e falhas
    -> sessão local, conferência e exportação explícita
~~~

Compartilhar sessão, evidências, estados, revisão e formatos de comunicação. Manter navegação, regiões, categorias e catálogos por jogo. Uma biblioteca comum só surge quando dois usos reais justificarem; não criar framework de plugins.

Contrato inicial dos coletores: jogo/categoria, versão do coletor e perfil, ordinal/ID da observação, origem e hashes das imagens, texto OCR, campos candidatos, falhas e motivo de parada. Completude de percurso, cobertura e revisão são estados separados. A ausência de um campo em saída importada não será convertida em texto reconhecido.

Uma cópia física observada recebe registro próprio: nome/atributos/hash iguais não justificam fundir cópias. Usar tipos por jogo, como refinamento e sobreposição, sem tratá-los como o mesmo campo obrigatório.

Coleta: um processo por vez, sessão de saída própria, cancelamento cooperativo e salvamento parcial. O host deve distinguir término do coletor, término do OCR e aprovação humana. Não presumir que matar um processo elevado permite salvar seus arquivos.

Reaproveitar o fluxo completo de navegação/recorte do Kamera antes de modificá-lo por estética. Ajustar interface e políticas de dados onde necessário. A rotina original ResetLogging apaga diretórios de logging: executar adaptações em área isolada por sessão, sem apontar para os logs pessoais existentes.

## Tecnologias e distribuição propostas

- Python como linguagem principal. Candidata inicial: linha 3.12; a primeira prova de build fixa a versão de patch disponível e suportada pelas dependências. Motores podem exigir ambientes próprios.
- C# e bibliotecas originais necessárias para o coletor Genshin. Não duplicar sua lógica em Python. Confirmar toolchain e dependências antes de prometer build reproduzível.
- Manter os motores OCR existentes dos coletores no primeiro comparativo: Tesseract para os candidatos Genshin/HSR/ZZZ; RapidOCR/ONNX em WuWa. Não trocar tudo por um motor nem treinar modelo sem medir uma falha.
- Console/menu e revisão local são suficientes para a primeira entrega; interface gráfica pode ser acrescentada depois, sem reescrever coleta.
- [PyInstaller em modo de pasta](https://pyinstaller.org/en/stable/operating-mode.html), com um executável de entrada e componentes internos. A documentação recomenda validar esse modo antes de one-file; ele também evita a extração temporária de bibliotecas de um one-file elevado.
- Primeiro pacote mantém a solicitação UAC ao abrir, como o lançador atual; coletores herdam o nível e ainda verificam acesso/foco. Administrador não prova que o jogo aceitou inputs.
- Testar o pacote numa instalação Windows sem Node/Python de desenvolvimento. Modelos, DLLs e eventual pré-requisito nativo precisam ser incluídos ou explicitados; não prometer portabilidade antes desse teste.
- JSON e imagens locais; sem backend, banco, MCP, serviço ou automação de combate. Advisor permanece separado.

Versões divergentes de bibliotecas não devem ser forçadas para um único ambiente apenas por usar Python. Isolar motores quando necessário e evitar importar todas as interfaces originais no processo principal. O custo real de extração/empacotamento faz parte da primeira prova, não deve ser escondido.

## Plano de execução depois da aprovação

| Etapa | Entrega concreta | Condição para avançar |
|---|---|---|
| M3.0 — Provar reaproveitamento | Fixar origem, compilar base Genshin com dependências e separar caminho de armas numa área de trabalho isolada | Build reproduzível e leitura/captura de arma comparável à base. Se depender de reescrever grade/rolagem novamente, parar e revisar a extração antes de migrar o restante. |
| M3.1 — Conectar ao aplicativo | Python coordena coletor C#, cria sessão nova e recebe imagens/resultado/progresso/parada; menu executável mínimo | Rodar pelo aplicativo, sem abrir o Kamera manualmente. Testar protocolo offline com dados Genshin e HSR para evitar contrato exclusivo de Genshin; isso não implementa scanner HSR ainda. |
| M3.2 — Preservar qualidade | Manter bruto e candidatos; remover defaults silenciosos e registrar falhas; revisão local | Ausente/incerto não vira R1, item descartado ou cobertura completa. Comparar referências já confirmadas, sem confundir adaptação a exemplos com avaliação independente. |
| M3.3 — Piloto real | Até dez armas, incluindo cópias; capturas e sequência auditáveis | Conferir seleção efetiva, ordem, cópias, dados e interrupção. Só então avançar à rolagem. |
| M3.4 — Inventário Genshin | Duas coletas completas 4/5 estrelas, sem alterar inventário entre elas | Contagem e transições conferidas, primeiro/último e cópias preservados, pendências explícitas, F8/perda de foco/parcial verificados. |
| M3.5 — Substituição do experimento | Pacote utilizável, guia atualizado e retirada do Node/helper antigo do caminho normal | Fluxo Genshin novo aceito e evidências preservadas. Não manter dois scanners como produto permanente. |
| M4.1 — Qualificar HSR | Fixar candidato Python, conferir licença/dependências, preparar 16:9 e casos reais | Separar Cones de Luz das demais categorias e verificar se precisa das dependências de controle usadas por personagens. |
| M4.2 — Adaptar HSR | Conectar aquisição/OCR ao mesmo contrato de sessão; remover fallback de sobreposição 1 | Leitura de uma imagem e falhas verificadas; regressão Genshin preservada. |
| M4.3 — Aceitar HSR | Piloto, duas coletas completas no escopo acordado e pacote pelo mesmo aplicativo | Mesmas verificações de cobertura/cópias/parada, com regras e nomes de campos próprios do HSR. |
| M5 — Outros jogos | WuWa, ZZZ e NTE, cada um com prova do candidato, imagem, piloto e coleta completa | Aceitar um jogo antes da automação do próximo. NTE exige primeiro confirmar categoria de arma, inglês e disponibilidade de código aproveitável. |
| M6/M7 — Depois | Exportação revisada ao Advisor; avaliar categorias adicionais | Manter autorização explícita e contratos próprios. Não copiar funcionalidades de modificação de equipamentos dos projetos pesquisados. |

Não estimar prazo a partir de README ou estrelas de GitHub. O primeiro ponto de decisão é o build/adaptador real; o segundo é o piloto. Uma contagem do upstream ou arquivo JSON aparentemente válido não substitui verificação de cobertura.

## Licenças e procedência

Cristian aceita priorizar reaproveitamento com licença compatível. Proposta: avaliar GPL-3.0 para o código próprio junto aos componentes efetivamente incorporados; a decisão exata depende da auditoria de versões, dependências e modelos. Não aplicar uma nova licença agora nem rotular código GPL como MIT.

Preservar LICENSE/avisos, origem, SHA e alterações de cada componente. Importar arquivos/módulos com histórico de origem identificável, não copiar código remotamente a cada execução. Não presumir que usar subprocessos elimina obrigações de licença; a [FAQ oficial GNU](https://www.gnu.org/licenses/gpl-faq.en.html#MereAggregation) distingue mecanismo e natureza da integração. NTE/AGPL será uma avaliação separada antes de qualquer incorporação.

## O que está e não está validado

Verificado: documentação oficial e dos projetos; versões e licenças declaradas via GitHub; existência dos módulos de armas Genshin/HSR/WuWa/ZZZ; dependências principais e comportamentos de fallback citados. O experimento atual possui referências e regressões úteis, mas seu M3 continua sem aceite real.

Não verificado: build conjunto, execução dos candidatos externos pelo laboratório, precisão comparativa, compatibilidade com versões atuais dos cinco jogos, coleta de armas NTE em inglês e pacote final. Nenhum jogo foi controlado nesta pesquisa. Nenhuma reestruturação, instalação de SDK ou substituição de implementação foi realizada.

**Decisão proposta para aprovação:** um aplicativo Windows, Python na coordenação e reaproveitamento por jogo, começando pela coleta Genshin em C#. O próximo trabalho, após aprovação, é M3.0; não a migração completa de uma vez.
