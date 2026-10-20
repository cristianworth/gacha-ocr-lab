# Youkai — reprodução isolada P1.1

Executado em **20/10/2026**, America/Sao_Paulo. Base do laboratório: `main`, versão `0.1.0`, HEAD `241c2b7455571fa17af61d6ab36e78ffc0e00f8f`. Cristian autorizou a reprodução depois de revisar a proposta do sucessor.

**Resultado:** o subconjunto upstream selecionado executa neste Windows, sem modificar o código original: **273 testes aprovados, 5 pulados, zero falhas/erros**. O caminho original de OCR estático também executou em duas referências públicas. Isso qualifica o ambiente e mede limitações; não aceita o leitor, o perfil atual do jogo nem um inventário completo. P1.2 e os ensaios de captura/avanço reais permanecem pendentes.

## Reproduzir

Na raiz do laboratório, usando Windows x64 e Windows PowerShell 5.1 ou PowerShell 7:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\qualify-youkai.ps1
# Depois do primeiro preparo, repetir sem acesso à rede:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\qualify-youkai.ps1 -Offline
```

O primeiro comando baixa arquivos fixados, confere SHA-256, extrai os fontes/runtime/OCR, sincroniza um ambiente virtual pelo lock, verifica os fontes contra o ZIP, executa os oito arquivos upstream selecionados e lê duas imagens públicas. O segundo exige esses artefatos e os pacotes no cache. Nenhum comando localiza uma janela, inicia captura de tela, cria listener ou emite input.

Tudo que é baixado ou gerado fica em `.cache/youkai-p1/`, já coberto por `.gitignore`: fontes originais, licenças/avisos, Python, ambiente virtual, uv/cache de pacotes, extrator, OCR/modelos, temporários e evidências. Não há instalação global nem alteração persistente do PATH. Os instaladores 7-Zip/Tesseract são tratados como arquivos para extração; não são executados como instaladores. A interface Rust não é compilada nem iniciada.

Cada execução salva um novo diretório `runs/<data-hora-id>/` com `upstream.log`, `upstream.xml`, `report.json`, versões e recortes originais. O JSON contém pacotes/licenças declaradas, hashes, motivos dos skips e saídas originais. Não registra aprovação humana. A releitura dos recortes em `rawRecheck` é separada da chamada original de extração; não é apresentada como um trace dessa chamada.

O tratamento de stderr no roteiro usa o exit code nativo: Windows PowerShell 5.1 representa mensagens normais do uv em stderr como registros de erro quando redirecionadas. Essa compatibilidade foi corrigida e o comando completo acima foi conferido nesse shell.

## Fonte e ambiente fixados

- Fonte: [AJTDaedalus/youkai, SHA 86a8b3](https://github.com/AJTDaedalus/youkai/tree/86a8b34511c86ec864d8f40c558789f7ccad4cc9). `pyproject.toml` declara `1.0.8` e Python `>=3.12`; o módulo mantém a identificação upstream `1.0.8+dev`.
- ZIP do SHA: SHA-256 `399fd104152b1b7867af103c09580f62d4314d4c77f45cfa995461f26992b50f`. **260 arquivos** conferidos por SHA-256 contra o arquivo baixado. Não houve patch da candidata.
- Python **3.12.15**, build standalone Astral de **20261013**, Windows x64. Arquivo de origem: SHA-256 `7a2aef48e5ee569e310b29b32681debbc5d888e92790d85331a47736c6b06aad`. A extração direta do arquivo foi conferida e produz o mesmo executável do runtime inicialmente provisionado pelo uv.
- uv **0.13.4**, ZIP Windows x64: SHA-256 `ccec7508a07d9933d7cb1261880633efcf1f30d6e6eddab21823f1dae6f23225`.
- Tesseract **5.4.0.20240606**, build Windows [UB-Mannheim](https://github.com/UB-Mannheim/tesseract/releases/tag/v5.4.0.20240606). Instalador-arquivo: SHA-256 `c885fff6998e0608ba4bb8ab51436e1c6775c2bafc2559a19b423e18678b60c9`.
- Modelo inglês extraído desse pacote: SHA-256 `7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2`.
- Extrator oficial 7-Zip **26.04**: os hashes do console reduzido e do pacote completo estão fixados no roteiro. Não é dependência do leitor, apenas do preparo.

Os digests de uv, Python e 7-Zip foram comparados com os publicados nas releases oficiais. Para o ZIP do código e o pacote/modelo Tesseract, os hashes registrados são os observados nos downloads HTTPS desta qualificação; não são apresentados como assinaturas ou verificações independentes do publicador.

O [lock](../scripts/youkai-requirements.lock) foi resolvido a partir de `project.dependencies` do SHA fixado mais `pytest>=8.0`, para CPython 3.12.15/Windows x64. A instalação usa `--require-hashes --only-binary :all:`. As 17 distribuições resolvidas foram:

| Distribuição | Versão |
|---|---|
| colorama | 0.4.6 |
| comtypes | 1.4.17 |
| dxcam | 0.3.0 |
| iniconfig | 2.3.1 |
| numpy | 2.5.4 |
| opencv-python-headless | 5.0.0.93 |
| packaging | 26.3 |
| pillow | 13.0.0 |
| pluggy | 1.7.0 |
| Pygments | 2.21.0 |
| pynput | 1.8.2 |
| pytesseract | 0.3.13 |
| pytest | 9.1.1 |
| pywin32 | 312 |
| PyYAML | 6.0.3 |
| RapidFuzz | 3.14.6 |
| six | 1.17.0 |

Os imports usam `PYTHONPATH` apontando para `src/` da candidata, preservando sua resolução original de `data/zzz_1.4/`. Não há instalação editable ou incorporação de módulos no `src/` do laboratório. Não foi necessário instalar Ruff, pytest-cov, Rust ou ferramentas de empacotamento.

## Subconjunto e avisos

Entradas conferidas: `capture.py`, `grid.py`, `recognize.py`, `wengine_scanner.py`, `matchers.py`, `normalizer.py`; suportes `input_utils.py`, `zod.py` e catálogos originais. `normalizer._load()` carrega os quatro catálogos, mesmo ao normalizar W-Engines; por isso o preparo não remove dados de outras categorias. Os testes compartilhados de grade também importam o scanner de discos em casos parametrizados. Isso não integra essas categorias ao produto.

Foram lidos `LICENSE` (MIT, copyright 2026 AJTDaedalus), `THIRD_PARTY_NOTICES.md` e os metadados de licença das distribuições instaladas. Os arquivos originais e seus avisos foram preservados no cache. Tesseract inclui `doc/LICENSE` Apache-2.0. Entre as dependências: pynput declara LGPLv3; pywin32 declara PSF; Pillow MIT-CMU; NumPy traz uma expressão composta; as demais declaram MIT/BSD/Apache conforme `report.json`. Não presumir licença MIT para toda a árvore apenas pela licença do Youkai. O pacote futuro terá de preservar os avisos efetivos dos componentes redistribuídos, inclusive bibliotecas nativas e modelos; esta execução não distribui um pacote do produto nem define uma licença nova para o laboratório.

## Testes upstream realmente executados

| Arquivo | Aprovados | Pulados |
|---|---:|---:|
| `test_capture.py` | 8 | 0 |
| `test_grid.py` | 7 | 3 |
| `test_grid_incomplete.py` | 13 | 0 |
| `test_recognize.py` | 27 | 0 |
| `test_wengine_scanner.py` | 26 | 1 |
| `test_matchers.py` | 12 | 0 |
| `test_normalizer.py` | 174 | 1 |
| `test_tesseract_resolve.py` | 6 | 0 |
| **Total** | **273** | **5** |

Skips explícitos:

- Três testes da barra/posição de grade dependem de `archive/live_20260605/preflight_discs.png`, ausente no ZIP.
- Um teste de W-Engine equipado depende de `archive/live_20260605/agent_018/equip_slot_6.png`, ausente.
- Um teste de normalização depende de `docs/diag_title_reocr_20260704.json`, ausente.

`test_capture.py` verifica calibração/geometria em imagens; seu próprio cabeçalho exclui `grab_window()` real. Os percursos executados usam simulações e ações substituídas pelos testes upstream. Nenhum teste ao vivo foi executado. Não foi rodada a suíte inteira de outras categorias, nem a suíte JS do laboratório nesta entrega; os 135 testes JS do README continuam sendo evidência histórica.

Execuções salvas, com o mesmo resultado e as mesmas saídas estáticas:

- Roteiro com preparo: `.cache/youkai-p1/runs/20261020-161302-563409e8/`.
- Roteiro `-Offline`, PowerShell 7.6.5: `.cache/youkai-p1/runs/20261020-161446-b20b4bf1/`.
- Roteiro corrigido `-Offline`, Windows PowerShell 5.1: `.cache/youkai-p1/runs/20261020-161616-ca9aebe9/`.

O primeiro preparo reutilizou o runtime/venv criados durante a investigação. A extração limpa do arquivo Python foi conferida separadamente; não foi simulado um Windows novo sem nenhum cache. Os arquivos locais de evidência são opcionais e ignorados: os comandos, hashes, resultados e limitações relevantes ficam registrados aqui e no roteiro versionável.

## OCR real pelo caminho original

Chamado `scan_single_frame_engine()` sobre `reference_2_wengine_inventory.png` e `reference_6_unequipped_wengine.png` do SHA fixado. O corte cliente `(1,32,1920,1080)` vem de `navigation.yaml`; as imagens originais têm 1922×1112. Nenhuma imagem foi esticada nem adaptada para o perfil pessoal 1280×720.

| Referência pública | Saída original | Inspeção visual do assistente |
|---|---|---|
| `reference_2_wengine_inventory.png` | `HellfireGears`, nível 60, ascensão 5, refinamento 1, lock false | Nome e 60/60 conferem. Há duas estrelas claras no painel e cadeado fechado; os valores originais de refinamento/lock não conferem com essa leitura visual. Sem confirmação humana. |
| `reference_6_unequipped_wengine.png` | `FusionCompiler`, nível 60, ascensão 5, refinamento 1, lock false | Nome e 60/60 conferem; há uma estrela clara. O helper estático usa sempre a primeira célula para lock, mas a seleção dessa referência está na sétima coluna: esse campo não foi validado para o item selecionado. Sem confirmação humana. |

Limitações concretas preservadas:

- `count_filled_stars()` procura dourado e faz `max(1, count)`. A faixa pública de Hellfire tem duas estrelas brancas e resulta em 1. Os testes aprovados também esperam o fallback para 1; não são nosso aceite de progressão.
- A extração atribui confiança fixa 80 ao refinamento/lock e 90 ao nível/ascensão dentro de limites, inclusive defaults. Esses números são scores da implementação, sem calibração probabilística.
- `detect_lock_from_text()` busca um marcador textual; não é leitura comprovada do ícone fechado. O helper por imagem também fixa a célula `(0,0)`, limitando sua evidência de lock fora dessa posição.
- Raridade é detectada, mas o valor é descartado; o retorno só preserva um score e o item exportado não traz S/A/B.
- O texto bruto relido do título ainda inclui ruído (`Hellfire Gears\nS ®`, `Fusion Compiler\n& y`); o catálogo normaliza ambos com score 100. Isso não mede nomes desconhecidos nem cobertura atual do catálogo.
- Os testes de grade aprovados mantêm a política upstream de pular célula com painel repetido. Não demonstram preservação de cópias visualmente idênticas no nosso contrato.

As referências públicas são dados de desenvolvimento, não avaliação independente nem capturas atuais de Cristian. Não validam raridade A/B, níveis intermediários, todos os refinamentos, geometria 1280×720, aquisição real, foco, cancelamento, rolagem ou completude.

## Decisão após P1.1

A hipótese de que a base Python pudesse ser reproduzida sem reconstruir captura/grade/reconhecimento **não foi refutada pelo preparo offline**. Não houve falha concreta que justificasse abandonar Youkai ou trocar a ordem agora. A compatibilidade do caminho ao vivo ainda precisa ser demonstrada.

Próximo recorte proposto para revisão: **P1.2**, uma captura ZZZ atual e conferência do layout/campos contra a saída original. Preparar foco/parada antes de qualquer avanço limitado no jogo; o mecanismo nativo do Youkai é Escape, não presumir F8. Só então delimitar as adaptações P2 para progressão incerta, raridade S/A/B, cópias e persistência de falhas. Não foi iniciada adaptação do piloto nem extração de núcleo.
