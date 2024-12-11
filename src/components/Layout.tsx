import { html } from 'hono/html'
import type { FC } from 'hono/jsx'

export const Layout: FC = (props) => {
  return html`<!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>ななみとほのかのクリエイティブテクノロジーニュース</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body>
      ${props.children}
    </body>
    </html>`
}