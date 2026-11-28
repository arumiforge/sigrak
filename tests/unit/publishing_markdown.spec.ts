import { test } from '@japa/runner'
import { markdownToText, renderMarkdown, safeUrl, sanitizeHtml } from '#publishing/markdown'
import { slugify } from '#publishing/slugs'

/**
 * The safe rich text of R2-05: Markdown renders to a few allowlisted
 * tags; raw HTML, scripts, handlers and unsafe links never pass.
 */
test.group('Publishing | Markdown renderer', () => {
  test('renders the supported subset', ({ assert }) => {
    const html = renderMarkdown(
      [
        '# Judul besar',
        '### Subjudul',
        'Paragraf **tebal**, *miring*, _juga miring_ dan `kode`.',
        'Baris kedua.',
        '',
        '- satu',
        '- dua',
        '',
        '1. pertama',
        '2. kedua',
        '',
        '> kutipan',
        '',
        '---',
        '',
        '[Kabar](https://sigrak.com/kabar) dan [di sini](/kabar/uji).',
      ].join('\n')
    )
    assert.include(html, '<h2>Judul besar</h2>')
    assert.include(html, '<h3>Subjudul</h3>')
    assert.include(
      html,
      '<p>Paragraf <strong>tebal</strong>, <em>miring</em>, <em>juga miring</em> dan <code>kode</code>.<br>Baris kedua.</p>'
    )
    assert.include(html, '<ul><li>satu</li><li>dua</li></ul>')
    assert.include(html, '<ol><li>pertama</li><li>kedua</li></ol>')
    assert.include(html, '<blockquote><p>kutipan</p></blockquote>')
    assert.include(html, '<hr>')
    assert.include(
      html,
      '<a href="https://sigrak.com/kabar" rel="nofollow noopener noreferrer">Kabar</a>'
    )
    assert.include(html, '<a href="/kabar/uji" rel="nofollow noopener noreferrer">di sini</a>')
  })

  test('a heading right above a paragraph still renders as a heading', ({ assert }) => {
    assert.equal(renderMarkdown('## Akun\nTeks.'), '<h2>Akun</h2>\n<p>Teks.</p>')
  })

  test('raw HTML in the Markdown shows as text', ({ assert }) => {
    const html = renderMarkdown(
      '<script>alert(1)</script>\n<img src=x onerror="alert(1)">\n<a href="javascript:alert(1)">x</a>'
    )
    assert.notInclude(html, '<script')
    assert.notInclude(html, '<img')
    assert.notInclude(html, '<a href')
    assert.include(html, '&lt;script&gt;alert(1)&lt;/script&gt;')
    assert.include(html, '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;')
  })

  test('unsafe link targets lose the link but keep the text', ({ assert }) => {
    for (const url of [
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      'data:text/html;base64,PHNjcmlwdD4=',
      'vbscript:msgbox(1)',
      '//evil.example/x',
      '/\\evil.example',
    ]) {
      const html = renderMarkdown(`[klik](${url})`)
      assert.notInclude(html, '<a', url)
      assert.include(html, 'klik', url)
    }
    assert.isNull(safeUrl('java\tscript:alert(1)'))
    assert.isNull(safeUrl('https://ok.example/\u0000'))
    assert.equal(safeUrl('mailto:tim@sigrak.com'), 'mailto:tim@sigrak.com')
    assert.equal(safeUrl('https://sigrak.com/a?b=1&c=2'), 'https://sigrak.com/a?b=1&c=2')
  })

  test('quotes in a link target cannot break out of the attribute', ({ assert }) => {
    const html = renderMarkdown('[x](https://ok.example/"onmouseover="alert(1))')
    assert.notInclude(html, '" onmouseover')
    assert.notInclude(html, 'onmouseover="')
  })

  test('the sanitiser keeps only allowlisted tags and attributes', ({ assert }) => {
    assert.equal(
      sanitizeHtml('<p class="x" onclick="evil()">a <b>b</b> <strong style="c">c</strong></p>'),
      '<p>a &lt;b&gt;b&lt;/b&gt; <strong>c</strong></p>'
    )
    assert.equal(sanitizeHtml('<a href="javascript:alert(1)" onclick="x">t</a>'), '<a>t</a>')
    assert.equal(
      sanitizeHtml('<a href="https://ok.example" target="_blank">t</a>'),
      '<a href="https://ok.example" rel="nofollow noopener noreferrer">t</a>'
    )
    assert.equal(sanitizeHtml('<scr<script>ipt>x'), '&lt;scr&lt;script&gt;ipt&gt;x')
    assert.equal(
      sanitizeHtml('<iframe src="x"></iframe>'),
      '&lt;iframe src=&quot;x&quot;&gt;&lt;/iframe&gt;'
    )
    // Open tags are closed, stray closing tags dropped.
    assert.equal(sanitizeHtml('<ul><li>a'), '<ul><li>a</li></ul>')
    assert.equal(sanitizeHtml('a</p></em>'), 'a')
  })

  test('plain text for summaries', ({ assert }) => {
    assert.equal(
      markdownToText('Pukul **22.00 WIB**. Simpan [di sini](/x).'),
      'Pukul 22.00 WIB. Simpan di sini.'
    )
    assert.equal(markdownToText('## Judul\n**Tebal** & <b>aman</b>'), 'Judul Tebal & <b>aman</b>')
    assert.equal(markdownToText('a'.repeat(30), 10), `${'a'.repeat(9)}…`)
  })

  test('slugs are plain kebab-case without accents', ({ assert }) => {
    assert.equal(
      slugify('Webinar Kurikulum 2026: Apa yang Baru?'),
      'webinar-kurikulum-2026-apa-yang-baru'
    )
    assert.equal(slugify('Pemeliharaan sistem — Sabtu'), 'pemeliharaan-sistem-sabtu')
    assert.equal(slugify('Café déjà vu'), 'cafe-deja-vu')
    assert.equal(slugify('!!!'), 'tulisan')
    assert.isAtMost(slugify('kata '.repeat(40)).length, 80)
  })
})
