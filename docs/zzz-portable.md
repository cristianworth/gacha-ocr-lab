# ZZZ — pacote portátil local

O pacote em pasta inclui a janela por `gacha-ocr-zzz.exe`/`scan-desktop.cmd`, conserva `scan-zzz.cmd` como fallback e usa o mesmo `runtime/zzz-worker/zzz-worker.exe` com runtime Python incluído. A integração gráfica foi conferida na coleta local de 02/11. Não precisa instalar Python, Node ou Tesseract para executar. Requer Windows x64 e os componentes do Windows usados pelo lançador: PowerShell 5.1, aviso de Administrador e Bloco de Notas.

Montagem de 04/11 inclui também **HSR em validação**, com guia e candidato atual em [HSR](hsr-scan.md). O novo pacote passou por relocação, hashes e leitura de três imagens no worker congelado; coleta HSR pelo portátil ainda pendente. Pacotes ZZZ anteriores permanecem preservados. Ao testar uma atualização, feche a janela anterior e abra o `.exe` da pasta exata indicada; alterar os fontes do repositório não atualiza um pacote extraído.

## Usar

Extraia o ZIP inteiro em uma pasta com permissão de escrita. Abra `gacha-ocr-zzz.exe` nessa pasta e siga o [guia de coleta](zzz-scan.md). O `.exe` é uma chamada pequena do CMD adjacente, sem outro scanner. Para conferir só a abertura, aceite o aviso do Windows e feche a janela sem confirmar/iniciar; não é necessário coletar. Os botões de resultado ficam vinculados à pasta da própria execução.

Cada pacote possui seu próprio `.cache/youkai-p1/runs/`. Antes de substituir um pacote, preserve seus resultados. Não mova apenas o executável e não misture partes de versões diferentes. Se `portable-build.json` estiver presente e o executável faltar, o lançador recusa a execução; não tenta usar o Python do computador como alternativa.

## Construir

Requer o ambiente do laboratório já qualificado. Na primeira montagem:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-zzz.ps1 -InstallBuildTools
```

As ferramentas fixadas em `packaging/requirements-build.in` são baixadas para o cache de build; não alteram a venv usada na coleta. Nas montagens seguintes, omita `-InstallBuildTools` para usar as ferramentas disponíveis sem download. O script funciona a partir de outro diretório quando chamado pelo caminho absoluto.

Cada execução cria uma pasta nova em `.cache/zzz-portable/<build-id>/`, sem apagar montagens anteriores:

| Arquivo/pasta | Conteúdo |
|---|---|
| `gacha-ocr-zzz/` | Pasta executável completa |
| `gacha-ocr-zzz.zip` | A mesma pasta compactada, sem sessões pessoais |
| `build.log` | Diagnóstico do PyInstaller |
| `self-check.log` | Importação de módulos, conferência da fonte e Tesseract sem captura/inputs |
| `build-result.json` | Caminhos, tamanho e hash do ZIP concluído |

Se falhar, o script preserva a montagem e os logs para diagnóstico. Não distribua uma pasta parcial. O fluxo de build verifica a fonte fixada, monta o executável e faz uma checagem com PATH restrito antes de compactar. `portable-build.json` registra versão, revisões, dependências e hashes dos arquivos. O ZIP só é declarado pronto depois dessa checagem e da criação do recibo.

## O que acompanha a pasta

- O executor atual, janela WinForms e entradas EXE/CMD; sem outro scanner ou relaxamento das guardas. A simulação do repositório não acompanha o pacote.
- Runtime Python, módulos necessários, dados do leitor e Tesseract com OCR inglês.
- Arquivo original e fonte fixada do Youkai: a verificação dos 260 arquivos permanece. Essa duplicação aumenta o pacote, mas conserva a verificação já usada na coleta.
- Avisos disponíveis das dependências, documentação do Tesseract e licença Python. A distribuição é um protótipo local; os avisos dos binários transitivos do Tesseract ainda precisam de conferência antes de publicação pública.

As dependências vêm do ambiente qualificado; não são atualizadas automaticamente no empacotamento. Resultados, screenshots da conta, `.ai-memory.toml`, handoffs, credenciais e a venv de desenvolvimento não acompanham o ZIP. As imagens públicas que já fazem parte da fonte Youkai permanecem com ela.

## Verificação proporcional

Sem jogo ou aviso de Administrador:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-zzz.ps1 -Check
powershell -NoProfile -STA -ExecutionPolicy Bypass -File scripts/start-desktop.ps1 -Check
runtime\zzz-worker\zzz-worker.exe --self-check .cache\youkai-p1
```

O primeiro comando confere arquivos essenciais. O segundo importa os módulos, confere a fonte e executa `tesseract --version`, sem iniciar captura, teclado ou mouse. O teste offline por imagem usa o mesmo `probe-youkai.ps1 -Pilot -ImagePath ... -ClientArea 0,0,1280,720`; não exige o jogo em primeiro plano.

A validação inicial de build, relocação e imagens salvas foi seguida de coleta real pela pasta `D:\Repo\gacha-ocr-zzz`, sessão `20261101-230702-880080ba-selection`: 34 elegíveis, zero níveis/seleções pendentes e os mesmos valores/estados dos cinco campos da sessão anterior. O pacote está conferido para uso local; outro computador permanece sem teste. Não repetir percurso até o fundo, guardas ou revisão integral por rotina. Evidência da montagem e do uso em [evidências ZZZ](zzz-evidence.md); estado em [ROADMAP](ROADMAP.md).

O spec adapta a montagem em pasta do Youkai para nosso executor. A localização dos dados e do executável segue a [documentação de runtime do PyInstaller](https://pyinstaller.org/en/stable/runtime-information.html); a inclusão de dados e bibliotecas usa o [formato oficial de spec](https://pyinstaller.org/en/stable/spec-files.html).
