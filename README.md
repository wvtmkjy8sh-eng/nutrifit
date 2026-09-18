# NutriFit — Interface profissional

Protótipo front-end funcional, responsivo e pronto para abrir no VS Code.

## Executar
Para uso geral, abra `index.html` diretamente no navegador ou use a extensão Live Server do VS Code.

**Importante:** a instalação como PWA e o funcionamento offline (service worker) só funcionam quando o app é servido via `http://`/`https://` — o navegador desativa essas duas tecnologias quando o arquivo é aberto direto (`file://`). Para testar isso, sirva a pasta com um servidor local:

```bash
npm start
```

Isso abre o app em `http://localhost:5173`. Qualquer outro servidor estático (Live Server, `npx serve`, `python -m http.server`, etc.) também funciona.

## Incluído
- Dashboard
- Alimentação
- Plano alimentar
- Calculadora metabólica funcional
- Hidratação funcional
- Evolução
- Receitas
- Tema claro/escuro
- SVG 2D preenchidos
- Layout responsivo para desktop/tablet/mobile

## Observação
Os cálculos exibidos são estimativas educativas. Para produção clínica, valide fórmulas, regras de prescrição e banco nutricional com profissional habilitado.


Versão 5 — interface da aba Plano alimentar simplificada, com paciente/metas no topo, ações principais agrupadas e refeições organizadas em lista compacta.
