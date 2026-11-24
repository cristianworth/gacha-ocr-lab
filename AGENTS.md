# Regras do laboratório

## Escopo e mudanças

- As instruções atuais de Cristian definem a entrega. Consulte README.md para uso e docs/ROADMAP.md para o próximo recorte; não trate uma proposta histórica como requisito atual.
- Antes de desenvolver um percurso, estabeleça dado útil, filtro, ordenação, condição de parada e saída consumida. Use as fontes, o código executado e os arquivos salvos antes de criar comportamento ou pedir capturas.
- Em falhas recorrentes ou sucessivas no mesmo fluxo, reconstrua o percurso e seus limites de ponta a ponta, registre hipóteses e evidências que as confirmem ou descartem e avalie as próximas transições, não apenas o último erro. Planeje replays e simulações com os dados existentes antes de pedir outra execução; consulte fontes primárias externas quando esclarecerem uma dúvida concreta, preservando origem e licença.
- Faça a menor mudança coerente. Reaproveite contratos públicos; não crie framework, UI ampla, infraestrutura de testes ou identidade persistente de itens sem necessidade demonstrada.
- Use uma branch curta de trabalho a partir da branch padrão remota atualizada, respeitando a autorização da tarefa. Preserve alterações e commits alheios, handoffs e .ai-memory.toml; não faça limpeza, reset, push ou nova passagem de contexto fora do escopo autorizado.

## Evidência e dados

- Diferencie término do escopo, percurso até o fundo, qualidade OCR e aprovação humana. Não declarar leitura dos itens omitidos por filtro ou ordenação.
- Parada antecipada exige ordenação global adequada declarada ou verificada. Nível ilegível ou contradição de ordem não autoriza concluir cobertura. Configurações atuais do produto ficam no guia, não nestas regras.
- Preserve OCR bruto, incertezas e observações separadas de cópias. Igualdade de nome/atributos/imagem não identifica uma cópia. Não converter candidatos ou scores de similaridade em fatos reconhecidos.
- Confirmações humanas são específicas aos campos e à sessão informados. Grave revisão separada vinculada ao original; não reescreva o bruto nem aprove o inventário inteiro por uma correção parcial.
- Imagens, modelos, fontes externas em cache, resultados e temporários permanecem fora do Git. Preserve origem, revisão e avisos das dependências reutilizadas.

## Validação e operação

- Use arquivos, replays e simulações primeiro. Repita aquisição no jogo somente por dúvida concreta ou para conferir uma mudança do fluxo real; agrupe as intervenções e solicite apenas session.json quando suficiente.
- Não repita guardas, pilotos e percursos já encerrados por rotina. Testes sintéticos e replays não equivalem a novos inputs reais nem a uma avaliação independente de precisão.
- Preserve as proteções de parada, foco, janela, geometria e gravação parcial. Elevação da ferramenta não significa PowerShell Administrador no desktop.
- Durante coleta, acompanhe console.log; leia o manifesto depois do encerramento para não bloquear a substituição atômica no Windows.
- Toda saída pertence ao laboratório. Não escreva no Advisor nem use roteamento de memória por cwd implícito. Ausência numa coleta filtrada não remove fatos existentes do Advisor. Não envie mensagem a outro chat sem autorização humana explícita.

## Documentação e entrega

- README.md é a entrada curta; docs/zzz-scan.md é o guia de uso/contrato ZZZ; docs/ROADMAP.md é o plano único. Evidências ficam em docs/zzz-evidence.md e documentos históricos, sem pedidos de teste obsoletos nas instruções atuais.
- Regras duráveis ficam aqui; escopo, estado e próximos passos ficam no guia/roadmap. Documente limitações materiais sem duplicar cronologia em cada arquivo.
- Não criar handoff por cerimônia. Antes de commit ou merge, siga as regras de versão/changelog aplicáveis; não incremente versão a cada commit do mesmo recorte.
- Acompanhe a tarefa em execução e a próxima etapa em issues do GitHub: consulte as existentes para evitar duplicação, crie as que faltarem, registre avanços e limitações e feche cada issue quando seu escopo estiver efetivamente concluído. Se o GitHub estiver inacessível, preserve o progresso local e informe a pendência.
- Ao concluir uma parte coesa que represente progresso e esteja verificada de modo proporcional, faça commit e push das alterações correspondentes na branch acordada, respeitando o escopo autorizado e preservando arquivos locais e mudanças alheias. Não crie commits artificiais apenas para gerar atividade.
- Abra PR com problema, resultado, validação, limitações e issue relacionada; use rascunho enquanto houver revisão ou validação pendente. Revise o diff e os checks do SHA atual; se não houver CI aplicável, registre essa ausência e a validação local. CI verde não autoriza merge. Integre somente após aprovação de Cristian para o diff e autorização de integração; mudanças posteriores exigem nova revisão e aprovação. Push direto à principal exige autorização explícita. Confira CI/deploy e publicação após integrar, quando aplicáveis. Este processo não concede permissões operacionais além do pedido atual.
- Ao informar a validação, diga explicitamente se Cristian precisa executar um teste agora, se ele é opcional ou se ainda não há teste para ele fazer. Quando necessário, apresente passos, resultado esperado e o que enviar; quando a próxima ação for do agente, diga isso claramente.
- Em status e entregas, explicite **Minha parte** e **Sua parte agora**, ou uma tabela com responsável, ação e resultado esperado por jogo. Separe aprovação de PR, implementação, teste de OCR e captura manual. Diga se a ação humana é necessária agora, opcional, futura ou nenhuma; quando ela existir, informe exatamente os passos e o arquivo ou imagem a enviar. Se o próximo passo for do agente, diga que Cristian deve aguardar e continue o trabalho autorizado.
- Nas respostas de entrega, seja breve e claro: destaque o progresso, os entraves e suas causas e as próximas alterações. Use detalhes técnicos somente quando necessários para a decisão ou a execução do teste.
- Entregue mudança, verificações, limites e um roteiro prático proporcional. Em português, feche com Para testar (quando aplicável), Workflow e TL;DR.
- Ao orientar um teste pelo aplicativo, informe a pasta exata do `.exe` e se é necessário fechar/reabrir a janela para carregar a atualização. Diferencie o repositório atual de pacotes já extraídos.
