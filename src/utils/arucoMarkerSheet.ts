const ARUCO_CODES = [0x1084210, 0x1084217, 0x1084209, 0x108420e]
const MARKER_POSITIONS = ['좌측 상단 (A)', '우측 상단 (B)', '우측 하단 (C)', '좌측 하단 (D)']

function generateArucoSvg(id: number): string {
  const bits = ARUCO_CODES[id].toString(2).padStart(25, '0')
  const cells = [...bits].map((bit, index) => {
    if (bit !== '1') return ''
    return `<rect x="${index % 5 + 2}" y="${Math.floor(index / 5) + 2}" width="1" height="1" fill="white"/>`
  }).join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 9 9">
    <rect width="9" height="9" fill="white"/>
    <rect x="1" y="1" width="7" height="7" fill="black"/>
    ${cells}
  </svg>`
}

export function openArucoMarkerSheet(): void {
  const popup = window.open('', '_blank')
  if (!popup) throw new Error('팝업이 차단되었습니다. 이 사이트의 팝업을 허용한 뒤 다시 시도하세요.')
  popup.opener = null

  const markerCards = MARKER_POSITIONS.map((position, id) => `
    <article>
      ${generateArucoSvg(id)}
      <strong>ID ${id}</strong>
      <span>${position}</span>
    </article>
  `).join('')

  popup.document.write(`<!doctype html>
    <html lang="ko"><head><meta charset="UTF-8"><title>ANT TRACKER ArUco Markers</title>
    <style>
      @page { size: A4; margin: 16mm; }
      * { box-sizing: border-box; }
      body { margin: 0; color: #111; font-family: Arial, sans-serif; }
      h1 { margin: 0 0 4mm; font-size: 18pt; }
      p { margin: 0 0 9mm; font-size: 10pt; }
      main { display: grid; grid-template-columns: 1fr 1fr; gap: 12mm; }
      article { display: grid; justify-items: center; gap: 2mm; break-inside: avoid; }
      svg { width: 55mm; height: 55mm; background: white; padding: 5mm; }
      strong { font-size: 16pt; }
      span { font-size: 10pt; }
      button { margin-top: 10mm; padding: 3mm 6mm; }
      @media print { button { display: none; } }
    </style></head><body>
      <h1>ANT TRACKER · ARUCO Marker Set</h1>
      <p>인쇄 배율 100%로 출력하고 검은 테두리와 흰 여백을 자르지 마세요.</p>
      <main>${markerCards}</main>
      <button onclick="window.print()">인쇄</button>
    </body></html>`)
  popup.document.close()
}
