# Assinatura estável do APK (distribuição interna)

Os APKs do Solar Calculator são assinados com `solar-calculator.keystore`.

**Por quê?** No GitHub Actions cada runner gera um `debug.keystore` novo. Se cada
versão tiver um certificado diferente, o Android **recusa atualizar** o app
instalado (“App not installed” / erro ao atualizar).

Com este keystore versionado, todas as releases futuras compartilham o mesmo
certificado e a atualização in-place funciona.

## Transição (uma vez)

Se você já tem uma versão antiga (≤ 1.0.20) instalada — assinada com keystore
efêmero do CI — **desinstale** o Solar Calculator e instale o APK novo.
Depois disso, as próximas atualizações sobem normalmente.

## Credenciais (uso interno)

- Alias: `solarcalculator`
- Store / key password: ver `keystore.properties`
