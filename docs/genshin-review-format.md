# Genshin — saída local para revisão

O Advisor mantém dados em documentos e não possui importador para esta saída. Este JSON é um documento **local de revisão**, não é GOOD, não é importado automaticamente e não autoriza atualizar ou remover dados do Advisor. Antes de qualquer integração, é necessário definir o contrato com o consumidor e apresentar as diferenças para revisão.

O formato `gacha-ocr-lab-genshin-review`, versão 1, contém o hash da sessão e, quando fornecidos, os hashes da revisão humana e da análise de raridade. Cada observação mantém sua posição, referência à captura e quatro campos. Em cada campo, `observed` preserva o resultado automático e seus candidatos; `observedSource` informa se veio da sessão ou do replay de raridade; `humanReview` contém apenas a confirmação humana específica daquele campo. Uma confirmação não altera o OCR nem aprova outros campos. As referências do replay à revisão também ficam registradas, mesmo quando a revisão não é fornecida.

O arquivo inclui também observações abaixo do corte e pendentes. `levelEligibilityFromSession` é a classificação original, não é recalculada a partir de revisões. Uma posição identifica apenas a observação naquela sessão; nomes ou imagens iguais não identificam cópias entre sessões. Os indicadores de término por nível e cobertura são copiados da sessão e dependem da preparação declarada; `inventoryAccepted` permanece falso. A ausência de um item em coleta filtrada não significa remoção.

Para examinar o JSON no terminal, informe uma sessão encerrada e, opcionalmente, os arquivos separados da revisão e do replay:

```powershell
node scripts/genshin-review-export.js --session CAMINHO\session.json --review CAMINHO\human-review.json --rarity CAMINHO\rarity-analysis.json
```

O comando imprime o resultado; não modifica os arquivos de entrada, não grava no Advisor e não envia dados. Os hashes das entradas e das referências entre elas são conferidos antes de apresentar a saída. As referências às capturas mantêm os hashes declarados nos arquivos, mas este comando não relê nem valida os bytes das imagens. Falhas ou referências divergentes interrompem o processamento. O usuário deve conservar os arquivos locais e proteger qualquer cópia, pois a saída contém dados do inventário.
