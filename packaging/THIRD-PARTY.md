# Dependências e origem do pacote local

- Youkai: AJTDaedalus/youkai, revisão `86a8b34511c86ec864d8f40c558789f7ccad4cc9`, MIT. Fonte e arquivo original em `.cache/youkai-p1/`. https://github.com/AJTDaedalus/youkai
- Python: runtime 3.12 do ambiente qualificado, licença e avisos em `Python-LICENSE.txt`. https://www.python.org/
- Tesseract: distribuição UB Mannheim 5.4.0.20240606, OCR inglês. Executável/DLLs e documentação original preservados em `.cache/youkai-p1/tesseract/`. Origem: https://github.com/UB-Mannheim/tesseract/releases/tag/v5.4.0.20240606 ; projeto: https://github.com/tesseract-ocr/tesseract
- Pacotes Python: versões e ferramentas de build registradas em `portable-build.json`; arquivos de licença disponíveis nas distribuições são copiados para subpastas deste diretório, incluindo avisos de NumPy, OpenCV, Pillow e demais dependências.
- PyInstaller 6.22.3: ferramenta de empacotamento, sem alterar a licença do código incluído. Avisos presentes na distribuição da ferramenta foram preservados. https://pyinstaller.org/

Este diretório preserva os avisos disponíveis no ambiente de build; não declara auditoria jurídica completa dos binários transitivos da distribuição Windows do Tesseract. Antes de publicação pública, conferir avisos e obrigações de redistribuição desses componentes. Nenhum instalador ou pacote de dependência é executado pelo usuário final para iniciar o scanner.
