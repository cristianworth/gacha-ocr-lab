# Genshin — saída local para revisão

O Advisor mantém dados em documentos e não possui importador para esta saída. Este JSON é um documento **local de revisão**, não é GOOD, não é importado automaticamente e não autoriza atualizar ou remover dados do Advisor. Antes de qualquer integração, é necessário definir o contrato com o consumidor e apresentar as diferenças para revisão.

O formato `gacha-ocr-lab-genshin-review`, versão 1, contém o hash da sessão e, quando fornecidos, os hashes da revisão humana e da análise de raridade. Cada observação mantém sua posição, referência à captura e quatro campos. Em cada campo, `observed` preserva o resultado automático e seus candidatos; `observedSource` informa se veio da sessão ou do replay de raridade; `humanReview` contém apenas a confirmação humana específica daquele campo. Uma confirmação não altera o OCR nem aprova outros campos. As referências do replay à revisão também ficam registradas, mesmo quando a revisão não é fornecida.

O arquivo inclui também observações abaixo do corte e pendentes. `levelEligibilityFromSession` é a classificação original, não é recalculada a partir de revisões. Uma posição identifica apenas a observação naquela sessão; nomes ou imagens iguais não identificam cópias entre sessões. Os indicadores de término por nível e cobertura são copiados da sessão e dependem da preparação declarada; `inventoryAccepted` permanece falso. A ausência de um item em coleta filtrada não significa remoção.

Para examinar o JSON no terminal, informe uma sessão encerrada e, opcionalmente, os arquivos separados da revisão e do replay:

```powershell
node scripts/genshin-review-export.js --session CAMINHO\session.json --review CAMINHO\human-review.json --rarity CAMINHO\rarity-analysis.json
```

O comando imprime o resultado; não modifica os arquivos de entrada, não grava no Advisor e não envia dados. Os hashes das entradas e das referências entre elas são conferidos antes de apresentar a saída. As referências às capturas mantêm os hashes declarados nos arquivos, mas este comando não relê nem valida os bytes das imagens. Falhas ou referências divergentes interrompem o processamento. O usuário deve conservar os arquivos locais e proteger qualquer cópia, pois a saída contém dados do inventário.

## Prévia conservadora para o Advisor

O consumidor `advisor/account-snapshots.md` é uma fonte Markdown mantida manualmente: em Genshin, a tabela de armas 5★ registra nome, associação de assinatura, quantidade e refinamentos; outra tabela registra a posse das armas do passe de Snezhnaya. Níveis e arma equipada não são mantidos nessa tabela. O Advisor não oferece importador nem chave compartilhada de cópia, e não há padrão Genshin de uma cópia/R1. Seu README exige origem e alteração apenas dos campos afetados.

A prévia compara texto exato do nome confirmado, reconhecido ou candidato de OCR com os nomes dessas duas tabelas. Cada linha encontrada é **candidata**, inclusive quando há várias observações com o mesmo nome ou várias linhas possíveis; nem nome igual nem refinamento identifica uma cópia. A ausência de linha candidata não implica aquisição: outras seções e relatos amplos não são pesquisados. A prévia mostra campos lado a lado para inspeção, preserva todas as linhas consultadas e não calcula remoções, contagens, mudanças ou aprovação. Revisão humana vale somente para o campo e a observação indicados. Consulte o JSON estruturado para OCR bruto, recortes e incertezas completas; o Markdown conserva seu hash e o da captura de cada posição.

Com Node 22+, gere o arquivo **fora dos diretórios de entrada** (os caminhos abaixo são exemplos; ajuste à sua máquina):

```powershell
node scripts/genshin-advisor-preview.js --session CAMINHO\session.json --review CAMINHO\human-review.json --rarity CAMINHO\rarity-analysis.json --structured CAMINHO\review-structured.json --advisor CAMINHO\account-snapshots.md > .cache\genshin\preview.md
```

O comando reconstrói a saída estruturada pelas três entradas e exige equivalência com o JSON informado; valida referências da revisão e do replay e relê os bytes de cada captura para conferir seu SHA-256. Uma entrada divergente, captura indisponível ou mudança incompatível nas tabelas interrompe a execução. Os caminhos de captura no manifesto precisam estar acessíveis. O resultado inclui hashes das cinco entradas e não escreve no Advisor; mantenha o artefato e entradas em local privado. O exemplo 15/11 contém 91 observações, incluindo uma abaixo do corte; reprocessamento não comprova navegação, cobertura ou precisão independente. Não é um diff aplicável ou proposta de importação.
